import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";
import crypto from "crypto";

const LARGE_TRANSFER_THRESHOLD = 1000000; // e.g., $1,000,000 USD value
const TIME_LOCK_DURATION_MINUTES = 60; // 1 hour
const MULTI_SIG_REQUIRED_SIGNATURES = 3;

export interface BridgeRequest {
  userId: string;
  fromNetwork: string;
  toNetwork: string;
  tokenAddress: string;
  amount: string;
}

export interface BridgeResponse {
  success: boolean;
  transferId: number;
  initiationTxHash: string;
  message: string;
}

export interface BridgeStatusResponse {
  transferId: number;
  status: string;
  unlockTime?: Date;
  requiredSignatures?: number;
  currentSignatures?: number;
}

export interface SignBridgeRequest {
  transferId: number;
  signature: string;
  signerAddress: string;
}

export interface BridgeTransfer {
  id: number;
  userId: string;
  fromNetwork: string;
  toNetwork: string;
  tokenAddress: string;
  amount: string;
  status: string;
  initiationTxHash: string;
  completionTxHash?: string;
  fee: string;
  createdAt: Date;
  completedAt?: Date;
  unlockTime?: Date;
  multiSig?: {
    requiredSignatures: number;
    currentSignatures: number;
  };
}

// Initiates a cross-chain token transfer.
export const initiateBridgeTransfer = api<BridgeRequest, BridgeResponse>(
  { expose: true, method: "POST", path: "/bridge/initiate" },
  async (req) => {
    return withPerformanceMonitoring("/bridge/initiate", "POST", async () => {
      const { userId, fromNetwork, toNetwork, tokenAddress, amount } = req;
      const transferAmount = BigInt(amount);

      if (transferAmount <= 0n) {
        throw APIError.invalidArgument("Transfer amount must be positive.");
      }
      if (fromNetwork === toNetwork) {
        throw APIError.invalidArgument("Cannot bridge to the same network.");
      }

      const recentTransfers = await blockchainDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM bridge_transfers 
        WHERE user_id = ${userId} 
        AND created_at > NOW() - INTERVAL '1 hour'
        AND status = 'pending'
      `;
      if (recentTransfers && recentTransfers.count >= 5) {
        throw APIError.resourceExhausted("Too many pending bridge transfers. Please wait for completion.");
      }

      const balance = await blockchainDB.queryRow<{ balance: string }>`
        SELECT balance FROM token_balances WHERE address = ${userId} AND token_contract = ${tokenAddress}
      `;
      if (!balance || BigInt(balance.balance) < transferAmount) {
        throw APIError.failedPrecondition("Insufficient token balance.");
      }

      const replayCheck = await blockchainDB.queryRow<{ id: number }>`
        SELECT id FROM bridge_transfers 
        WHERE user_id = ${userId} 
        AND from_network = ${fromNetwork}
        AND to_network = ${toNetwork}
        AND amount = ${amount}
        AND created_at > NOW() - INTERVAL '5 minutes'
      `;
      if (replayCheck) {
        throw APIError.alreadyExists("Duplicate transfer detected. Please wait before retrying.");
      }

      const initiationTxHash = "0x" + crypto.randomBytes(32).toString('hex');
      const fee = (transferAmount * 5n) / 1000n;

      const isLargeTransfer = Number(transferAmount) > LARGE_TRANSFER_THRESHOLD;
      const unlockTime = isLargeTransfer ? new Date(Date.now() + TIME_LOCK_DURATION_MINUTES * 60 * 1000) : null;
      
      await using tx = await blockchainDB.begin();
      try {
        // Lock user funds
        await tx.exec`
          UPDATE token_balances 
          SET balance = balance - ${amount}
          WHERE address = ${userId} AND token_contract = ${tokenAddress}
        `;

        const transfer = await tx.queryRow<{ id: number }>`
          INSERT INTO bridge_transfers (user_id, from_network, to_network, token_address, amount, fee, initiation_tx_hash, unlock_time)
          VALUES (${userId}, ${fromNetwork}, ${toNetwork}, ${tokenAddress}, ${amount}, ${fee.toString()}, ${initiationTxHash}, ${unlockTime})
          RETURNING id
        `;

        if (!transfer) {
          throw new Error("Failed to create bridge transfer record.");
        }

        if (isLargeTransfer) {
          await tx.exec`
            INSERT INTO multi_sig_transactions (bridge_transfer_id, required_signatures)
            VALUES (${transfer.id}, ${MULTI_SIG_REQUIRED_SIGNATURES})
          `;
        }

        await tx.commit();

        let message = "Bridge transfer initiated successfully.";
        if (isLargeTransfer) {
          message += ` This is a large transfer and is time-locked for ${TIME_LOCK_DURATION_MINUTES} minutes and requires multi-signature approval.`;
        }

        return {
          success: true,
          transferId: transfer.id,
          initiationTxHash,
          message,
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

// Gets the status of a bridge transfer.
export const getBridgeTransferStatus = api<{ transferId: number }, BridgeStatusResponse>(
  { expose: true, method: "GET", path: "/bridge/status/:transferId" },
  async ({ transferId }) => {
    const transfer = await blockchainDB.queryRow<{ id: number; status: string; unlock_time: Date | null }>`
      SELECT id, status, unlock_time FROM bridge_transfers WHERE id = ${transferId}
    `;

    if (!transfer) {
      throw APIError.notFound("Transfer not found.");
    }

    const multiSig = await blockchainDB.queryRow<{ required_signatures: number; signed_by: string[] }>`
      SELECT required_signatures, signed_by FROM multi_sig_transactions WHERE bridge_transfer_id = ${transferId}
    `;

    return {
      transferId: transfer.id,
      status: transfer.status,
      unlockTime: transfer.unlock_time || undefined,
      requiredSignatures: multiSig?.required_signatures,
      currentSignatures: multiSig?.signed_by.length,
    };
  }
);

// Signs a multi-signature bridge transfer.
export const signBridgeTransfer = api<SignBridgeRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/bridge/sign" },
  async ({ transferId, signature, signerAddress }) => {
    // In a real app, signature and signerAddress would be cryptographically verified.
    await using tx = await blockchainDB.begin();
    try {
      const multiSig = await tx.queryRow<{ id: number; required_signatures: number; signed_by: string[] }>`
        SELECT id, required_signatures, signed_by FROM multi_sig_transactions 
        WHERE bridge_transfer_id = ${transferId} FOR UPDATE
      `;

      if (!multiSig) {
        throw APIError.notFound("Multi-signature transaction not found for this transfer.");
      }

      if (multiSig.signed_by.includes(signerAddress)) {
        throw APIError.alreadyExists("Signer has already signed this transaction.");
      }

      const newSigners = [...multiSig.signed_by, signerAddress];
      await tx.exec`
        UPDATE multi_sig_transactions SET signed_by = ${JSON.stringify(newSigners)} WHERE id = ${multiSig.id}
      `;

      if (newSigners.length >= multiSig.required_signatures) {
        await tx.exec`
          UPDATE multi_sig_transactions SET status = 'approved' WHERE id = ${multiSig.id}
        `;
      }

      await tx.commit();
      return { success: true };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);

// Gets user's bridge transfers.
export const getUserBridgeTransfers = api<{ userId: string }, { transfers: BridgeTransfer[] }>(
  { expose: true, method: "GET", path: "/bridge/transfers/:userId" },
  async ({ userId }) => {
    const transfers = await blockchainDB.rawQueryAll<any>(`
      SELECT 
        bt.id, bt.user_id, bt.from_network, bt.to_network, bt.token_address, bt.amount,
        bt.status, bt.initiation_tx_hash, bt.completion_tx_hash, bt.fee,
        bt.created_at, bt.completed_at, bt.unlock_time,
        mst.required_signatures, mst.signed_by
      FROM bridge_transfers bt
      LEFT JOIN multi_sig_transactions mst ON bt.id = mst.bridge_transfer_id
      WHERE bt.user_id = $1
      ORDER BY bt.created_at DESC
      LIMIT 20
    `, userId);

    return {
      transfers: transfers.map(t => ({
        id: t.id,
        userId: t.user_id,
        fromNetwork: t.from_network,
        toNetwork: t.to_network,
        tokenAddress: t.token_address,
        amount: t.amount,
        status: t.status,
        initiationTxHash: t.initiation_tx_hash,
        completionTxHash: t.completion_tx_hash || undefined,
        fee: t.fee,
        createdAt: t.created_at,
        completedAt: t.completed_at || undefined,
        unlockTime: t.unlock_time || undefined,
        multiSig: t.required_signatures ? {
          requiredSignatures: t.required_signatures,
          currentSignatures: t.signed_by.length,
        } : undefined,
      }))
    };
  }
);
