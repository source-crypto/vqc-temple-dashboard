import { api, APIError } from "encore.dev/api";
import { monitoredTempleDB as templeDB } from "./db";
import { logAuditEvent } from "./audit";
import { validateYubikeySerial, validateYubikeyOTP, validateShamirShares, validateExpirationHours } from "./validation";
import crypto from "crypto";

export interface ActivationToken {
  id: number;
  tokenId: string;
  yubikeySerial: string;
  shamirShares?: string[];
  threshold?: number;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface CreateTokenRequest {
  yubikeySerial: string;
  shamirShares?: string[];
  threshold?: number;
  expirationHours?: number;
}

export interface CreateTokenResponse {
  token: ActivationToken;
}

export interface ActivateTokenRequest {
  tokenId: string;
  yubikeyOTP: string;
  shamirShares?: string[];
}

export interface ActivateTokenResponse {
  success: boolean;
  message: string;
}

export interface TokenListResponse {
  tokens: ActivationToken[];
}

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

function validateRequestSize(data: any, maxSizeKB: number = 100): void {
  const size = JSON.stringify(data).length;
  if (size > maxSizeKB * 1024) {
    throw APIError.invalidArgument(`Request size exceeds ${maxSizeKB}KB limit`);
  }
}

// Creates a new activation token with YubiKey and optional Shamir secret sharing.
export const createActivationToken = api<CreateTokenRequest, CreateTokenResponse>(
  { expose: true, method: "POST", path: "/activation/token" },
  async (req) => {
    try {
      // Rate limiting: 5 tokens per hour
      if (!checkRateLimit('create-token', 5, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for token creation");
      }

      validateRequestSize(req, 50);

      // Input validation
      validateYubikeySerial(req.yubikeySerial);
      
      if (req.shamirShares && req.shamirShares.length > 0) {
        validateShamirShares(req.shamirShares, req.threshold);
      }
      
      if (req.expirationHours !== undefined) {
        validateExpirationHours(req.expirationHours);
      }

      const tokenId = crypto.randomUUID();
      const expiresAt = req.expirationHours 
        ? new Date(Date.now() + req.expirationHours * 60 * 60 * 1000)
        : null;

      // Validate Shamir secret sharing parameters
      if (req.shamirShares && req.shamirShares.length > 0) {
        if (!req.threshold || req.threshold > req.shamirShares.length) {
          throw APIError.invalidArgument("Threshold must be less than or equal to number of shares");
        }
      }

      const row = await templeDB.queryRow<{
        id: number;
        token_id: string;
        yubikey_serial: string;
        shamir_shares: any;
        threshold: number | null;
        created_at: Date;
        expires_at: Date | null;
        is_active: boolean;
      }>`
        INSERT INTO activation_tokens (
          token_id, yubikey_serial, shamir_shares, threshold, expires_at
        )
        VALUES (
          ${tokenId}, ${req.yubikeySerial}, 
          ${req.shamirShares ? JSON.stringify(req.shamirShares) : null},
          ${req.threshold || null}, ${expiresAt}
        )
        RETURNING *
      `;

      if (!row) {
        throw APIError.internal("Failed to create activation token");
      }

      const token = {
        id: row.id,
        tokenId: row.token_id,
        yubikeySerial: row.yubikey_serial,
        shamirShares: row.shamir_shares ? row.shamir_shares : undefined,
        threshold: row.threshold || undefined,
        createdAt: row.created_at,
        expiresAt: row.expires_at || undefined,
        isActive: row.is_active,
      };

      // Audit log
      await logAuditEvent(
        'create_activation_token',
        'activation_token',
        {
          tokenId: token.tokenId,
          yubikeySerial: req.yubikeySerial,
          hasShamirShares: !!req.shamirShares,
          threshold: req.threshold,
          expirationHours: req.expirationHours
        },
        'success',
        undefined,
        token.tokenId
      );

      return { token };
    } catch (error) {
      console.error('Failed to create activation token:', error);
      
      // Audit log for failure
      await logAuditEvent(
        'create_activation_token',
        'activation_token',
        {
          yubikeySerial: req.yubikeySerial,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'failure',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create activation token");
    }
  }
);

// Activates a token using YubiKey OTP and optional Shamir shares.
export const activateToken = api<ActivateTokenRequest, ActivateTokenResponse>(
  { expose: true, method: "POST", path: "/temple/activation/activate" },
  async (req) => {
    try {
      // Rate limiting: 3 activations per hour (very sensitive operation)
      if (!checkRateLimit('activate-token', 3, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for token activation");
      }

      validateRequestSize(req, 50);

      // Input validation
      if (!req.tokenId || typeof req.tokenId !== 'string') {
        throw APIError.invalidArgument("Token ID is required and must be a string");
      }
      
      validateYubikeyOTP(req.yubikeyOTP);
      
      if (req.shamirShares && req.shamirShares.length > 0) {
        validateShamirShares(req.shamirShares);
      }

      const row = await templeDB.queryRow<{
        id: number;
        token_id: string;
        yubikey_serial: string;
        shamir_shares: any;
        threshold: number | null;
        created_at: Date;
        expires_at: Date | null;
        is_active: boolean;
      }>`
        SELECT * FROM activation_tokens 
        WHERE token_id = ${req.tokenId} AND is_active = true
      `;

      if (!row) {
        await logAuditEvent(
          'activate_token',
          'activation_token',
          { tokenId: req.tokenId, error: 'Token not found or inactive' },
          'failure',
          undefined,
          req.tokenId,
          'Token not found or inactive'
        );
        throw APIError.notFound("Activation token not found or inactive");
      }

      // Check expiration
      if (row.expires_at && new Date() > row.expires_at) {
        await logAuditEvent(
          'activate_token',
          'activation_token',
          { tokenId: req.tokenId, error: 'Token expired' },
          'failure',
          undefined,
          req.tokenId,
          'Token expired'
        );
        throw APIError.failedPrecondition("Activation token has expired");
      }

      // Verify YubiKey OTP
      const yubikeyValid = verifyYubikeyOTP(req.yubikeyOTP, row.yubikey_serial);
      if (!yubikeyValid) {
        await logAuditEvent(
          'activate_token',
          'activation_token',
          { tokenId: req.tokenId, error: 'Invalid YubiKey OTP' },
          'failure',
          undefined,
          req.tokenId,
          'Invalid YubiKey OTP'
        );
        throw APIError.unauthenticated("Invalid YubiKey OTP");
      }

      // Verify Shamir shares if required
      if (row.shamir_shares && row.threshold) {
        if (!req.shamirShares || req.shamirShares.length < row.threshold) {
          await logAuditEvent(
            'activate_token',
            'activation_token',
            { tokenId: req.tokenId, error: 'Insufficient Shamir shares' },
            'failure',
            undefined,
            req.tokenId,
            'Insufficient Shamir shares'
          );
          throw APIError.failedPrecondition("Insufficient Shamir shares provided");
        }

        const shamirValid = verifyShamirShares(req.shamirShares, row.shamir_shares, row.threshold);
        if (!shamirValid) {
          await logAuditEvent(
            'activate_token',
            'activation_token',
            { tokenId: req.tokenId, error: 'Invalid Shamir shares' },
            'failure',
            undefined,
            req.tokenId,
            'Invalid Shamir shares'
          );
          throw APIError.unauthenticated("Invalid Shamir shares");
        }
      }

      // Deactivate the token after successful use
      await templeDB.exec`
        UPDATE activation_tokens 
        SET is_active = false 
        WHERE token_id = ${req.tokenId}
      `;

      // Audit log for successful activation
      await logAuditEvent(
        'activate_token',
        'activation_token',
        {
          tokenId: req.tokenId,
          yubikeySerial: row.yubikey_serial,
          shamirSharesUsed: req.shamirShares?.length || 0
        },
        'success',
        undefined,
        req.tokenId
      );

      return {
        success: true,
        message: "VQC lifecycle operation activated successfully"
      };
    } catch (error) {
      console.error('Failed to activate token:', error);
      
      // Audit log for failure (if not already logged above)
      if (!(error instanceof APIError)) {
        await logAuditEvent(
          'activate_token',
          'activation_token',
          {
            tokenId: req.tokenId,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'failure',
          undefined,
          req.tokenId,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to activate token");
    }
  }
);

// Retrieves all activation tokens.
export const listActivationTokens = api<void, TokenListResponse>(
  { expose: true, method: "GET", path: "/activation/tokens" },
  async () => {
    try {
      // Rate limiting: 30 requests per minute
      if (!checkRateLimit('list-tokens', 30, 60000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for token listing");
      }

      const rows = await templeDB.queryAll<{
        id: number;
        token_id: string;
        yubikey_serial: string;
        shamir_shares: any;
        threshold: number | null;
        created_at: Date;
        expires_at: Date | null;
        is_active: boolean;
      }>`
        SELECT * FROM activation_tokens 
        ORDER BY created_at DESC
      `;

      const tokens = rows.map(row => ({
        id: row.id,
        tokenId: row.token_id,
        yubikeySerial: row.yubikey_serial,
        shamirShares: row.shamir_shares ? row.shamir_shares : undefined,
        threshold: row.threshold || undefined,
        createdAt: row.created_at,
        expiresAt: row.expires_at || undefined,
        isActive: row.is_active,
      }));

      return { tokens };
    } catch (error) {
      console.error('Failed to list activation tokens:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve activation tokens");
    }
  }
);

function verifyYubikeyOTP(otp: string, expectedSerial: string): boolean {
  // In a real implementation, this would verify the OTP against YubiKey's validation service
  // For now, we'll do basic format validation
  if (otp.length !== 44) return false;
  
  // Extract the serial from the OTP (first 12 characters contain device info)
  const otpSerial = otp.substring(0, 12);
  return otpSerial.includes(expectedSerial.substring(0, 4));
}

function verifyShamirShares(providedShares: string[], storedShares: string[], threshold: number): boolean {
  // In a real implementation, this would use proper Shamir secret sharing reconstruction
  // For now, we'll verify that enough shares are provided and they match stored shares
  if (providedShares.length < threshold) return false;
  
  let matchCount = 0;
  for (const provided of providedShares) {
    if (storedShares.includes(provided)) {
      matchCount++;
    }
  }
  
  return matchCount >= threshold;
}
