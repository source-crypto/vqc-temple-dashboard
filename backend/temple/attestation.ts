import { api, APIError } from "encore.dev/api";
import { monitoredTempleDB as templeDB } from "./db";
import { logAuditEvent } from "./audit";
import { validateTPMQuote, validateSignature, validatePCRValues } from "./validation";
import { withErrorHandling, generateRequestId, logRequest, logResponse } from "./middleware";
import crypto from "crypto";

export interface PCRValues {
  pcr0: string;
  pcr1: string;
  pcr2: string;
  pcr3: string;
  pcr4: string;
  pcr5: string;
  pcr6: string;
  pcr7: string;
}

export interface AttestationRecord {
  id: number;
  timestamp: Date;
  pcrValues: PCRValues;
  tpmQuote: string;
  signature: string;
  canonicalHash: string;
  verificationStatus: string;
  blockchainTxHash?: string;
}

export interface CreateAttestationRequest {
  pcrValues: PCRValues;
  tpmQuote: string;
  signature: string;
}

export interface AttestationResponse {
  record: AttestationRecord;
}

export interface VerifyAttestationRequest {
  id: number;
}

export interface VerifyAttestationResponse {
  verified: boolean;
  canonicalMatch: boolean;
  signatureValid: boolean;
  record: AttestationRecord;
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

// Creates a new TPM attestation record.
export const createAttestation = api<CreateAttestationRequest, AttestationResponse>(
  { expose: true, method: "POST", path: "/attestation" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'POST',
        path: '/attestation'
      });

      // Rate limiting: 10 attestations per hour
      if (!checkRateLimit('create-attestation', 10, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for attestation creation");
      }

      validateRequestSize(req, 50);

      // Input validation
      validatePCRValues(req.pcrValues);
      validateTPMQuote(req.tpmQuote);
      validateSignature(req.signature);

      // Generate canonical hash from PCR values
      const canonicalHash = generateCanonicalHash(req.pcrValues);
      
      const record = await withErrorHandling(
        'create-attestation',
        requestId,
        async () => {
          const row = await templeDB.queryRow<{
            id: number;
            timestamp: Date;
            pcr_values: any;
            tmp_quote: string;
            signature: string;
            canonical_hash: string;
            verification_status: string;
            blockchain_tx_hash: string | null;
          }>`
            INSERT INTO attestation_records (
              pcr_values, tmp_quote, signature, canonical_hash
            )
            VALUES (${JSON.stringify(req.pcrValues)}, ${req.tpmQuote}, ${req.signature}, ${canonicalHash})
            RETURNING *
          `;

          if (!row) {
            throw new Error("Failed to create attestation record");
          }

          return {
            id: row.id,
            timestamp: row.timestamp,
            pcrValues: row.pcr_values,
            tpmQuote: row.tmp_quote,
            signature: row.signature,
            canonicalHash: row.canonical_hash,
            verificationStatus: row.verification_status,
            blockchainTxHash: row.blockchain_tx_hash || undefined,
          };
        }
      );

      // Audit log
      await logAuditEvent(
        'create_attestation',
        'attestation_record',
        {
          attestationId: record.id,
          canonicalHash: record.canonicalHash,
          pcrCount: Object.keys(req.pcrValues).length
        },
        'success',
        undefined,
        record.id.toString()
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return { record };
    } catch (error) {
      console.error(`[${requestId}] Failed to create attestation:`, error);
      
      // Audit log for failure
      await logAuditEvent(
        'create_attestation',
        'attestation_record',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          pcrValuesProvided: !!req.pcrValues
        },
        'failure',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create attestation record");
    }
  }
);

// Verifies a TPM attestation record against canonical values.
export const verifyAttestation = api<VerifyAttestationRequest, VerifyAttestationResponse>(
  { expose: true, method: "POST", path: "/attestation/:id/verify" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'POST',
        path: `/attestation/${req.id}/verify`
      });

      // Rate limiting: 30 verifications per hour
      if (!checkRateLimit('verify-attestation', 30, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for attestation verification");
      }

      if (!req.id || typeof req.id !== 'number' || req.id <= 0) {
        throw APIError.invalidArgument("Valid attestation ID is required");
      }

      const result = await withErrorHandling(
        'verify-attestation',
        requestId,
        async () => {
          const row = await templeDB.queryRow<{
            id: number;
            timestamp: Date;
            pcr_values: any;
            tmp_quote: string;
            signature: string;
            canonical_hash: string;
            verification_status: string;
            blockchain_tx_hash: string | null;
          }>`
            SELECT * FROM attestation_records WHERE id = ${req.id}
          `;

          if (!row) {
            await logAuditEvent(
              'verify_attestation',
              'attestation_record',
              { attestationId: req.id, error: 'Attestation not found' },
              'failure',
              undefined,
              req.id.toString(),
              'Attestation not found'
            );
            throw APIError.notFound("Attestation record not found");
          }

          // Verify against canonical values
          const canonicalPCRs = getCanonicalPCRValues();
          const canonicalHash = generateCanonicalHash(canonicalPCRs);
          const canonicalMatch = row.canonical_hash === canonicalHash;

          // Verify signature
          const signatureValid = verifyTPMSignature(row.tmp_quote, row.signature);

          const verified = canonicalMatch && signatureValid;

          // Update verification status
          await templeDB.exec`
            UPDATE attestation_records 
            SET verification_status = ${verified ? 'verified' : 'failed'}
            WHERE id = ${req.id}
          `;

          const record = {
            id: row.id,
            timestamp: row.timestamp,
            pcrValues: row.pcr_values,
            tpmQuote: row.tmp_quote,
            signature: row.signature,
            canonicalHash: row.canonical_hash,
            verificationStatus: verified ? 'verified' : 'failed',
            blockchainTxHash: row.blockchain_tx_hash || undefined,
          };

          return {
            verified,
            canonicalMatch,
            signatureValid,
            record
          };
        }
      );

      // Audit log
      await logAuditEvent(
        'verify_attestation',
        'attestation_record',
        {
          attestationId: req.id,
          verified: result.verified,
          canonicalMatch: result.canonicalMatch,
          signatureValid: result.signatureValid
        },
        'success',
        undefined,
        req.id.toString()
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Failed to verify attestation:`, error);
      
      // Audit log for failure (if not already logged above)
      if (!(error instanceof APIError)) {
        await logAuditEvent(
          'verify_attestation',
          'attestation_record',
          {
            attestationId: req.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'failure',
          undefined,
          req.id.toString(),
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to verify attestation");
    }
  }
);

export interface AttestationListResponse {
  records: AttestationRecord[];
}

// Retrieves all attestation records.
export const listAttestations = api<void, AttestationListResponse>(
  { expose: true, method: "GET", path: "/attestation" },
  async () => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'GET',
        path: '/attestation'
      });

      // Rate limiting: 60 requests per minute
      if (!checkRateLimit('list-attestations', 60, 60000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for attestation listing");
      }

      const records = await withErrorHandling(
        'list-attestations',
        requestId,
        async () => {
          const rows = await templeDB.queryAll<{
            id: number;
            timestamp: Date;
            pcr_values: any;
            tmp_quote: string;
            signature: string;
            canonical_hash: string;
            verification_status: string;
            blockchain_tx_hash: string | null;
          }>`
            SELECT * FROM attestation_records 
            ORDER BY timestamp DESC
          `;

          return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            pcrValues: row.pcr_values,
            tpmQuote: row.tmp_quote,
            signature: row.signature,
            canonicalHash: row.canonical_hash,
            verificationStatus: row.verification_status,
            blockchainTxHash: row.blockchain_tx_hash || undefined,
          }));
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return { records };
    } catch (error) {
      console.error(`[${requestId}] Failed to list attestations:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve attestation records");
    }
  }
);

function generateCanonicalHash(pcrValues: PCRValues): string {
  const concatenated = Object.values(pcrValues).join('');
  return crypto.createHash('sha256').update(concatenated).digest('hex');
}

function getCanonicalPCRValues(): PCRValues {
  // These would be the known good PCR values for the canonical VQC instance
  return {
    pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
    pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
    pcr2: "c3d4e5f6789012345678901234567890abcdef12",
    pcr3: "d4e5f6789012345678901234567890abcdef123",
    pcr4: "e5f6789012345678901234567890abcdef1234",
    pcr5: "f6789012345678901234567890abcdef12345",
    pcr6: "789012345678901234567890abcdef123456",
    pcr7: "89012345678901234567890abcdef1234567",
  };
}

function verifyTPMSignature(quote: string, signature: string): boolean {
  // In a real implementation, this would verify the TPM signature
  // using the TPM's public key and proper cryptographic verification
  try {
    const hash = crypto.createHash('sha256').update(quote).digest('hex');
    return hash.length > 0 && signature.length > 0;
  } catch {
    return false;
  }
}
