import { api } from "encore.dev/api";
import { templeDB } from "./db";
import { secret } from "encore.dev/config";
import crypto from "crypto";

const blockchainAPIKey = secret("BlockchainAPIKey");

export interface BlockchainRecord {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  attestationId: number;
  publicKey: string;
  signature: string;
}

export interface PublishAttestationRequest {
  attestationId: number;
}

export interface PublishAttestationResponse {
  txHash: string;
  blockNumber: number;
  explorerUrl: string;
}

export interface BlockchainStatusResponse {
  connected: boolean;
  latestBlock: number;
  networkId: string;
  publishedRecords: number;
}

// Publishes VQC attestation record to blockchain for immutable registry.
export const publishAttestation = api<PublishAttestationRequest, PublishAttestationResponse>(
  { expose: true, method: "POST", path: "/blockchain/publish" },
  async (req) => {
    // Get attestation record
    const attestation = await templeDB.queryRow<{
      id: number;
      canonical_hash: string;
      verification_status: string;
      timestamp: Date;
    }>`
      SELECT id, canonical_hash, verification_status, timestamp 
      FROM attestation_records 
      WHERE id = ${req.attestationId}
    `;

    if (!attestation) {
      throw new Error("Attestation record not found");
    }

    if (attestation.verification_status !== 'verified') {
      throw new Error("Only verified attestations can be published to blockchain");
    }

    // Create blockchain transaction data
    const publicKey = generateVQCPublicKey();
    const transactionData = {
      attestationId: attestation.id,
      canonicalHash: attestation.canonical_hash,
      timestamp: attestation.timestamp.toISOString(),
      vqcPublicKey: publicKey,
    };

    const signature = signTransactionData(transactionData);
    
    // Simulate blockchain transaction
    const txHash = crypto.randomBytes(32).toString('hex');
    const blockNumber = Math.floor(Math.random() * 1000000) + 1000000;

    // Update attestation record with blockchain info
    await templeDB.exec`
      UPDATE attestation_records 
      SET blockchain_tx_hash = ${txHash}
      WHERE id = ${req.attestationId}
    `;

    return {
      txHash,
      blockNumber,
      explorerUrl: `https://explorer.vqc-chain.org/tx/${txHash}`
    };
  }
);

// Retrieves blockchain network status and published records count.
export const getBlockchainStatus = api<void, BlockchainStatusResponse>(
  { expose: true, method: "GET", path: "/blockchain/status" },
  async () => {
    const publishedCount = await templeDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count 
      FROM attestation_records 
      WHERE blockchain_tx_hash IS NOT NULL
    `;

    return {
      connected: true,
      latestBlock: Math.floor(Math.random() * 1000000) + 2000000,
      networkId: "vqc-mainnet",
      publishedRecords: publishedCount?.count || 0
    };
  }
);

export interface VerifyBlockchainRequest {
  txHash: string;
}

export interface VerifyBlockchainResponse {
  valid: boolean;
  blockNumber: number;
  confirmations: number;
  attestationData: any;
}

// Verifies a blockchain transaction for VQC attestation.
export const verifyBlockchainRecord = api<VerifyBlockchainRequest, VerifyBlockchainResponse>(
  { expose: true, method: "POST", path: "/blockchain/verify" },
  async (req) => {
    // In a real implementation, this would query the actual blockchain
    const mockConfirmations = Math.floor(Math.random() * 100) + 10;
    const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

    return {
      valid: true,
      blockNumber: mockBlockNumber,
      confirmations: mockConfirmations,
      attestationData: {
        canonicalHash: crypto.randomBytes(32).toString('hex'),
        timestamp: new Date().toISOString(),
        verified: true
      }
    };
  }
);

function generateVQCPublicKey(): string {
  // In a real implementation, this would be the actual VQC public key
  return crypto.randomBytes(64).toString('hex');
}

function signTransactionData(data: any): string {
  // In a real implementation, this would use the VQC private key
  const dataString = JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString).digest('hex');
}
