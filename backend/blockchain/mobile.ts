import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";
import crypto from "crypto";

export interface RegisterPushRequest {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
}

export interface QRCodeRequest {
  type: 'address' | 'transaction';
  data: {
    to?: string;
    amount?: string;
    token?: string;
    txData?: string;
  };
}

export interface QRCodeResponse {
  payload: string;
  qrCodeId?: string;
}

export interface WalletKeyRequest {
  userId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  deviceId: string;
}

export interface TransactionHistoryRequest {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface TransactionHistoryResponse {
  transactions: any[];
  total: number;
}

export const registerForPushNotifications = api<RegisterPushRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/mobile/register-push" },
  async ({ userId, deviceToken, platform }) => {
    await blockchainDB.exec`
      INSERT INTO push_notification_subscriptions (user_id, device_token, platform)
      VALUES (${userId}, ${deviceToken}, ${platform})
      ON CONFLICT (device_token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        created_at = NOW()
    `;
    return { success: true };
  }
);

export const generateTransactionQRCode = api<QRCodeRequest, QRCodeResponse>(
  { expose: true, method: "POST", path: "/mobile/qr-code" },
  async (req) => {
    let payload: string;
    const qrCodeId = crypto.randomBytes(16).toString('hex');

    switch (req.type) {
      case 'address':
        if (!req.data.to) {
          throw APIError.invalidArgument("Address is required for address QR code.");
        }
        payload = `vqc:${req.data.to}`;
        break;
      case 'transaction':
        if (!req.data.to || !req.data.amount) {
          throw APIError.invalidArgument("Recipient address and amount are required for transaction QR code.");
        }
        payload = `vqc:${req.data.to}?amount=${req.data.amount}`;
        if (req.data.token) {
          payload += `&token=${req.data.token}`;
        }
        break;
      default:
        throw APIError.invalidArgument("Invalid QR code type.");
    }

    await blockchainDB.exec`
      INSERT INTO mobile_qr_codes (qr_code_id, type, payload, expires_at)
      VALUES (${qrCodeId}, ${req.type}, ${payload}, NOW() + INTERVAL '15 minutes')
    `;

    return { payload, qrCodeId };
  }
);

export const registerWalletKeys = api<WalletKeyRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/mobile/register-keys" },
  async ({ userId, publicKey, encryptedPrivateKey, deviceId }) => {
    await using tx = await blockchainDB.begin();
    
    try {
      await tx.exec`
        INSERT INTO mobile_wallet_keys (user_id, public_key, encrypted_private_key, device_id)
        VALUES (${userId}, ${publicKey}, ${encryptedPrivateKey}, ${deviceId})
        ON CONFLICT (user_id, device_id) DO UPDATE SET
          public_key = EXCLUDED.public_key,
          encrypted_private_key = EXCLUDED.encrypted_private_key,
          updated_at = NOW()
      `;

      await tx.commit();
      return { success: true };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);

export const getMobileTransactionHistory = api<TransactionHistoryRequest, TransactionHistoryResponse>(
  { expose: true, method: "GET", path: "/mobile/transactions/:userId" },
  async ({ userId, limit = 20, offset = 0 }) => {
    const transactions = await blockchainDB.rawQueryAll<any>(`
      SELECT 
        ct.id, ct.transaction_type, ct.from_currency, ct.to_currency,
        ct.from_amount, ct.to_amount, ct.exchange_rate, ct.fee_amount,
        ct.status, ct.created_at
      FROM currency_transactions ct
      WHERE ct.user_id = $1
      ORDER BY ct.created_at DESC
      LIMIT $2 OFFSET $3
    `, userId, limit, offset);

    const totalRow = await blockchainDB.rawQueryRow<{ count: number }>(`
      SELECT COUNT(*) as count FROM currency_transactions WHERE user_id = $1
    `, userId);

    return {
      transactions,
      total: totalRow?.count || 0,
    };
  }
);

export const validateQRCode = api<{ qrCodeId: string }, { valid: boolean; payload?: string }>(
  { expose: true, method: "GET", path: "/mobile/qr-validate/:qrCodeId" },
  async ({ qrCodeId }) => {
    const qrCode = await blockchainDB.queryRow<{ payload: string; expires_at: Date }>`
      SELECT payload, expires_at FROM mobile_qr_codes WHERE qr_code_id = ${qrCodeId}
    `;

    if (!qrCode || new Date(qrCode.expires_at) < new Date()) {
      return { valid: false };
    }

    return { valid: true, payload: qrCode.payload };
  }
);
