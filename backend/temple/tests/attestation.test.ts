import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAttestation, verifyAttestation, listAttestations } from '../attestation';
import { templeDB } from '../db';

describe('Attestation API', () => {
  beforeEach(async () => {
    // Clean up test data
    await templeDB.exec`DELETE FROM attestation_records WHERE tmp_quote LIKE 'TEST%'`;
  });

  afterEach(async () => {
    // Clean up test data
    await templeDB.exec`DELETE FROM attestation_records WHERE tmp_quote LIKE 'TEST%'`;
  });

  describe('createAttestation', () => {
    it('should create a valid attestation record', async () => {
      const request = {
        pcrValues: {
          pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
          pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
          pcr2: "c3d4e5f6789012345678901234567890abcdef12",
          pcr3: "d4e5f6789012345678901234567890abcdef123",
          pcr4: "e5f6789012345678901234567890abcdef1234",
          pcr5: "f6789012345678901234567890abcdef12345",
          pcr6: "789012345678901234567890abcdef123456",
          pcr7: "89012345678901234567890abcdef1234567",
        },
        tpmQuote: 'TEST_TPM_QUOTE_DATA_12345',
        signature: 'TEST_SIGNATURE_DATA_67890'
      };

      const response = await createAttestation(request);

      expect(response.record).toBeDefined();
      expect(response.record.id).toBeDefined();
      expect(response.record.canonicalHash).toBeDefined();
      expect(response.record.verificationStatus).toBe('pending');
      expect(response.record.tpmQuote).toBe('TEST_TPM_QUOTE_DATA_12345');
    });

    it('should reject invalid PCR values', async () => {
      const request = {
        pcrValues: {
          pcr0: "invalid",
          pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
          pcr2: "c3d4e5f6789012345678901234567890abcdef12",
          pcr3: "d4e5f6789012345678901234567890abcdef123",
          pcr4: "e5f6789012345678901234567890abcdef1234",
          pcr5: "f6789012345678901234567890abcdef12345",
          pcr6: "789012345678901234567890abcdef123456",
          pcr7: "89012345678901234567890abcdef1234567",
        },
        tpmQuote: 'TEST_TPM_QUOTE_DATA',
        signature: 'TEST_SIGNATURE_DATA'
      };

      await expect(createAttestation(request)).rejects.toThrow();
    });

    it('should reject empty TPM quote', async () => {
      const request = {
        pcrValues: {
          pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
          pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
          pcr2: "c3d4e5f6789012345678901234567890abcdef12",
          pcr3: "d4e5f6789012345678901234567890abcdef123",
          pcr4: "e5f6789012345678901234567890abcdef1234",
          pcr5: "f6789012345678901234567890abcdef12345",
          pcr6: "789012345678901234567890abcdef123456",
          pcr7: "89012345678901234567890abcdef1234567",
        },
        tpmQuote: '',
        signature: 'TEST_SIGNATURE_DATA'
      };

      await expect(createAttestation(request)).rejects.toThrow();
    });
  });

  describe('verifyAttestation', () => {
    it('should verify an existing attestation', async () => {
      // First create an attestation
      const createRequest = {
        pcrValues: {
          pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
          pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
          pcr2: "c3d4e5f6789012345678901234567890abcdef12",
          pcr3: "d4e5f6789012345678901234567890abcdef123",
          pcr4: "e5f6789012345678901234567890abcdef1234",
          pcr5: "f6789012345678901234567890abcdef12345",
          pcr6: "789012345678901234567890abcdef123456",
          pcr7: "89012345678901234567890abcdef1234567",
        },
        tpmQuote: 'TEST_VERIFY_TPM_QUOTE',
        signature: 'TEST_VERIFY_SIGNATURE'
      };

      const createResponse = await createAttestation(createRequest);

      // Then verify it
      const verifyRequest = {
        id: createResponse.record.id
      };

      const verifyResponse = await verifyAttestation(verifyRequest);

      expect(verifyResponse.verified).toBeDefined();
      expect(verifyResponse.canonicalMatch).toBeDefined();
      expect(verifyResponse.signatureValid).toBeDefined();
      expect(verifyResponse.record).toBeDefined();
      expect(verifyResponse.record.tpmQuote).toBe('TEST_VERIFY_TPM_QUOTE');
    });

    it('should reject invalid attestation ID', async () => {
      const request = {
        id: -1
      };

      await expect(verifyAttestation(request)).rejects.toThrow();
    });

    it('should reject non-existent attestation', async () => {
      const request = {
        id: 999999
      };

      await expect(verifyAttestation(request)).rejects.toThrow();
    });
  });

  describe('listAttestations', () => {
    it('should return empty list when no attestations exist', async () => {
      const response = await listAttestations();
      
      expect(response.records).toBeDefined();
      expect(Array.isArray(response.records)).toBe(true);
    });

    it('should return created attestations', async () => {
      // Create a test attestation
      const createRequest = {
        pcrValues: {
          pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
          pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
          pcr2: "c3d4e5f6789012345678901234567890abcdef12",
          pcr3: "d4e5f6789012345678901234567890abcdef123",
          pcr4: "e5f6789012345678901234567890abcdef1234",
          pcr5: "f6789012345678901234567890abcdef12345",
          pcr6: "789012345678901234567890abcdef123456",
          pcr7: "89012345678901234567890abcdef1234567",
        },
        tpmQuote: 'TEST_LIST_TPM_QUOTE',
        signature: 'TEST_LIST_SIGNATURE'
      };

      await createAttestation(createRequest);

      const response = await listAttestations();
      
      expect(response.records.length).toBeGreaterThan(0);
      const testRecord = response.records.find(r => r.tpmQuote === 'TEST_LIST_TPM_QUOTE');
      expect(testRecord).toBeDefined();
    });
  });
});
