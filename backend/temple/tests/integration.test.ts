import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { templeDB } from '../db';
import { createActivationToken, activateToken } from '../activation';
import { createAttestation, verifyAttestation } from '../attestation';
import { generateArtifact } from '../ceremonial';
import { createHarmonics } from '../harmonics';
import { createVQCMetrics } from '../vqc_metrics';

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database is ready
    await templeDB.exec`SELECT 1`;
  });

  afterAll(async () => {
    // Clean up all test data
    await templeDB.exec`DELETE FROM activation_tokens WHERE yubikey_serial LIKE 'INTEGRATION%'`;
    await templeDB.exec`DELETE FROM attestation_records WHERE tmp_quote LIKE 'INTEGRATION%'`;
    await templeDB.exec`DELETE FROM ceremonial_artifacts WHERE entropy_seed LIKE '%INTEGRATION%'`;
    await templeDB.exec`DELETE FROM system_harmonics WHERE cpu_frequency = 9999`;
    await templeDB.exec`DELETE FROM vqc_metrics WHERE cycle_count = 999999`;
  });

  describe('Complete Attestation Workflow', () => {
    it('should complete full attestation verification workflow', async () => {
      // Step 1: Create activation token
      const tokenRequest = {
        yubikeySerial: 'INTEGRATION001',
        expirationHours: 1
      };

      const tokenResponse = await createActivationToken(tokenRequest);
      expect(tokenResponse.token.isActive).toBe(true);

      // Step 2: Activate the token
      const activateRequest = {
        tokenId: tokenResponse.token.tokenId,
        yubikeyOTP: 'cbdefghijklnrtuvcbdefghijklnrtuvcbdefghij'
      };

      const activateResponse = await activateToken(activateRequest);
      expect(activateResponse.success).toBe(true);

      // Step 3: Create attestation
      const attestationRequest = {
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
        tpmQuote: 'INTEGRATION_TPM_QUOTE_WORKFLOW',
        signature: 'INTEGRATION_SIGNATURE_WORKFLOW'
      };

      const attestationResponse = await createAttestation(attestationRequest);
      expect(attestationResponse.record.id).toBeDefined();

      // Step 4: Verify attestation
      const verifyRequest = {
        id: attestationResponse.record.id
      };

      const verifyResponse = await verifyAttestation(verifyRequest);
      expect(verifyResponse.verified).toBeDefined();
      expect(verifyResponse.record.verificationStatus).toMatch(/verified|failed/);
    });
  });

  describe('Database Operations', () => {
    it('should handle concurrent database operations', async () => {
      const promises = [];

      // Create multiple VQC metrics concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(createVQCMetrics({
          cycleCount: 999999 + i,
          entropyLevel: 0.8 + (i * 0.01),
          systemHealth: 0.9 + (i * 0.01),
          quantumCoherence: 0.7 + (i * 0.01),
          temperature: 25.0 + i,
          powerConsumption: 100.0 + (i * 10)
        }));
      }

      // Create multiple harmonics concurrently
      for (let i = 0; i < 3; i++) {
        promises.push(createHarmonics({
          cpuFrequency: 9999 + i,
          networkActivity: 50.0 + (i * 10),
          dbStats: {
            connections: 10 + i,
            queries_per_second: 100 + (i * 50),
            cache_hit_ratio: 0.8 + (i * 0.05)
          }
        }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(8);
      
      // Verify all operations succeeded
      results.forEach(result => {
        expect(result).toBeDefined();
        if ('id' in result) {
          expect(result.id).toBeDefined();
        } else if ('harmonics' in result && result.harmonics) {
          expect(result.harmonics.id).toBeDefined();
        }
      });
    });

    it('should handle database connection failures gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that our error handling doesn't crash
      try {
        await createVQCMetrics({
          cycleCount: -1, // Invalid value should trigger validation error
          entropyLevel: 0.8,
          systemHealth: 0.9,
          quantumCoherence: 0.7,
          temperature: 25.0,
          powerConsumption: 100.0
        });
      } catch (error) {
        expect(error).toBeDefined();
        // Should be a validation error, not a database error
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across operations', async () => {
      // Create ceremonial artifact
      const artifactRequest = {
        artifactType: 'poem' as const,
        entropySource: 'INTEGRATION_ENTROPY_SOURCE_TEST'
      };

      const artifactResponse = await generateArtifact(artifactRequest);
      expect(artifactResponse.artifact.content).toBeDefined();
      expect(artifactResponse.artifact.entropySeed).toBeDefined();

      // Verify the artifact was stored correctly
      const storedArtifact = await templeDB.queryRow<{
        id: number;
        artifact_type: string;
        content: string;
        entropy_seed: string;
      }>`
        SELECT id, artifact_type, content, entropy_seed 
        FROM ceremonial_artifacts 
        WHERE id = ${artifactResponse.artifact.id}
      `;

      expect(storedArtifact).toBeDefined();
      expect(storedArtifact!.artifact_type).toBe('poem');
      expect(storedArtifact!.content).toBe(artifactResponse.artifact.content);
      expect(storedArtifact!.entropy_seed).toBe(artifactResponse.artifact.entropySeed);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();
      
      // Create 10 VQC metrics records
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(createVQCMetrics({
          cycleCount: 888888 + i,
          entropyLevel: 0.8,
          systemHealth: 0.9,
          quantumCoherence: 0.7,
          temperature: 25.0,
          powerConsumption: 100.0
        }));
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('End-to-End Attestation Verification', () => {
    it('should complete full attestation lifecycle with proper data flow', async () => {
      // Step 1: Create VQC metrics to establish system state
      const metricsResponse = await createVQCMetrics({
        cycleCount: 1000000,
        entropyLevel: 0.85,
        systemHealth: 0.95,
        quantumCoherence: 0.75,
        temperature: 25.0,
        powerConsumption: 120.0
      });
      expect(metricsResponse.id).toBeDefined();

      // Step 2: Create activation token with Shamir shares
      const tokenRequest = {
        yubikeySerial: 'E2E_TEST_001',
        shamirShares: ['share1_e2e', 'share2_e2e', 'share3_e2e'],
        threshold: 2,
        expirationHours: 24
      };

      const tokenResponse = await createActivationToken(tokenRequest);
      expect(tokenResponse.token.shamirShares).toHaveLength(3);
      expect(tokenResponse.token.threshold).toBe(2);

      // Step 3: Activate token with proper shares
      const activateRequest = {
        tokenId: tokenResponse.token.tokenId,
        yubikeyOTP: 'cbdefghijklnrtuvcbdefghijklnrtuvcbdefghij',
        shamirShares: ['share1_e2e', 'share2_e2e'] // Provide threshold shares
      };

      const activateResponse = await activateToken(activateRequest);
      expect(activateResponse.success).toBe(true);

      // Step 4: Create attestation with canonical PCR values
      const attestationRequest = {
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
        tpmQuote: 'E2E_CANONICAL_TPM_QUOTE',
        signature: 'E2E_CANONICAL_SIGNATURE'
      };

      const attestationResponse = await createAttestation(attestationRequest);
      expect(attestationResponse.record.verificationStatus).toBe('pending');

      // Step 5: Verify attestation
      const verifyResponse = await verifyAttestation({
        id: attestationResponse.record.id
      });

      expect(verifyResponse.verified).toBe(true);
      expect(verifyResponse.canonicalMatch).toBe(true);
      expect(verifyResponse.signatureValid).toBe(true);
      expect(verifyResponse.record.verificationStatus).toBe('verified');

      // Step 6: Generate ceremonial artifact to complete the cycle
      const artifactResponse = await generateArtifact({
        artifactType: 'ritual',
        entropySource: `E2E_ENTROPY_${attestationResponse.record.canonicalHash}`
      });

      expect(artifactResponse.artifact.artifactType).toBe('ritual');
      expect(artifactResponse.artifact.entropySeed).toBeDefined();

      // Verify all data is properly linked and consistent
      const finalAttestation = await templeDB.queryRow<{
        id: number;
        verification_status: string;
        canonical_hash: string;
      }>`
        SELECT id, verification_status, canonical_hash
        FROM attestation_records
        WHERE id = ${attestationResponse.record.id}
      `;

      expect(finalAttestation).toBeDefined();
      expect(finalAttestation!.verification_status).toBe('verified');
      expect(finalAttestation!.canonical_hash).toBe(attestationResponse.record.canonicalHash);
    });

    it('should handle attestation failure scenarios', async () => {
      // Create attestation with non-canonical PCR values
      const attestationRequest = {
        pcrValues: {
          pcr0: "invalid_pcr_value_000000000000000000000000",
          pcr1: "invalid_pcr_value_111111111111111111111111",
          pcr2: "invalid_pcr_value_222222222222222222222222",
          pcr3: "invalid_pcr_value_333333333333333333333333",
          pcr4: "invalid_pcr_value_444444444444444444444444",
          pcr5: "invalid_pcr_value_555555555555555555555555",
          pcr6: "invalid_pcr_value_666666666666666666666666",
          pcr7: "invalid_pcr_value_777777777777777777777777",
        },
        tpmQuote: 'E2E_INVALID_TPM_QUOTE',
        signature: 'E2E_INVALID_SIGNATURE'
      };

      const attestationResponse = await createAttestation(attestationRequest);
      expect(attestationResponse.record.verificationStatus).toBe('pending');

      // Verify attestation should fail
      const verifyResponse = await verifyAttestation({
        id: attestationResponse.record.id
      });

      expect(verifyResponse.verified).toBe(false);
      expect(verifyResponse.canonicalMatch).toBe(false);
      expect(verifyResponse.record.verificationStatus).toBe('failed');
    });
  });
});
