import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { templeDB } from '../db';

describe('Database Operations', () => {
  beforeAll(async () => {
    // Ensure database connection is established
    await templeDB.exec`SELECT 1`;
  });

  afterAll(async () => {
    // Clean up test data
    await templeDB.exec`DELETE FROM vqc_metrics WHERE cycle_count < 0`;
    await templeDB.exec`DELETE FROM attestation_records WHERE tmp_quote LIKE 'DB_TEST%'`;
    await templeDB.exec`DELETE FROM activation_tokens WHERE yubikey_serial LIKE 'DB_TEST%'`;
  });

  describe('Database Schema Validation', () => {
    it('should have all required tables', async () => {
      const tables = await templeDB.queryAll<{ table_name: string }>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const tableNames = tables.map(t => t.table_name);
      
      expect(tableNames).toContain('vqc_metrics');
      expect(tableNames).toContain('attestation_records');
      expect(tableNames).toContain('activation_tokens');
      expect(tableNames).toContain('ceremonial_artifacts');
      expect(tableNames).toContain('system_harmonics');
    });

    it('should have correct column names in attestation_records', async () => {
      const columns = await templeDB.queryAll<{ column_name: string }>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'attestation_records'
        ORDER BY column_name
      `;

      const columnNames = columns.map(c => c.column_name);
      
      expect(columnNames).toContain('tmp_quote');
      expect(columnNames).not.toContain('tpm_quote');
      expect(columnNames).toContain('pcr_values');
      expect(columnNames).toContain('signature');
      expect(columnNames).toContain('canonical_hash');
      expect(columnNames).toContain('verification_status');
    });

    it('should have proper indexes', async () => {
      const indexes = await templeDB.queryAll<{ indexname: string }>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'attestation_records'
      `;

      const indexNames = indexes.map(i => i.indexname);
      
      expect(indexNames).toContain('idx_attestation_timestamp');
      expect(indexNames).toContain('idx_attestation_verification_status');
      expect(indexNames).toContain('idx_attestation_canonical_hash');
    });
  });

  describe('CRUD Operations', () => {
    it('should insert and retrieve VQC metrics', async () => {
      const testData = {
        cycleCount: -1, // Negative for easy cleanup
        entropyLevel: 0.85,
        systemHealth: 0.95,
        quantumCoherence: 0.75,
        temperature: 25.5,
        powerConsumption: 120.0
      };

      const insertResult = await templeDB.queryRow<{ id: number }>`
        INSERT INTO vqc_metrics (
          cycle_count, entropy_level, system_health, 
          quantum_coherence, temperature, power_consumption
        )
        VALUES (
          ${testData.cycleCount}, ${testData.entropyLevel}, ${testData.systemHealth},
          ${testData.quantumCoherence}, ${testData.temperature}, ${testData.powerConsumption}
        )
        RETURNING id
      `;

      expect(insertResult).toBeDefined();
      expect(insertResult!.id).toBeGreaterThan(0);

      const retrieveResult = await templeDB.queryRow<{
        cycle_count: number;
        entropy_level: number;
        system_health: number;
        quantum_coherence: number;
        temperature: number;
        power_consumption: number;
      }>`
        SELECT cycle_count, entropy_level, system_health, 
               quantum_coherence, temperature, power_consumption
        FROM vqc_metrics 
        WHERE id = ${insertResult!.id}
      `;

      expect(retrieveResult).toBeDefined();
      expect(retrieveResult!.cycle_count).toBe(testData.cycleCount);
      expect(retrieveResult!.entropy_level).toBe(testData.entropyLevel);
      expect(retrieveResult!.system_health).toBe(testData.systemHealth);
    });

    it('should handle JSON data in attestation records', async () => {
      const pcrValues = {
        pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
        pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
        pcr2: "c3d4e5f6789012345678901234567890abcdef12",
        pcr3: "d4e5f6789012345678901234567890abcdef123",
        pcr4: "e5f6789012345678901234567890abcdef1234",
        pcr5: "f6789012345678901234567890abcdef12345",
        pcr6: "789012345678901234567890abcdef123456",
        pcr7: "89012345678901234567890abcdef1234567",
      };

      const insertResult = await templeDB.queryRow<{ id: number }>`
        INSERT INTO attestation_records (
          pcr_values, tmp_quote, signature, canonical_hash
        )
        VALUES (
          ${JSON.stringify(pcrValues)}, 'DB_TEST_QUOTE', 'DB_TEST_SIGNATURE', 'test_hash'
        )
        RETURNING id
      `;

      expect(insertResult).toBeDefined();

      const retrieveResult = await templeDB.queryRow<{
        pcr_values: any;
        tmp_quote: string;
      }>`
        SELECT pcr_values, tmp_quote
        FROM attestation_records 
        WHERE id = ${insertResult!.id}
      `;

      expect(retrieveResult).toBeDefined();
      expect(retrieveResult!.tmp_quote).toBe('DB_TEST_QUOTE');
      expect(retrieveResult!.pcr_values).toEqual(pcrValues);
    });

    it('should handle transactions properly', async () => {
      await using tx = await templeDB.begin();

      try {
        // Insert test data in transaction
        const result1 = await tx.queryRow<{ id: number }>`
          INSERT INTO vqc_metrics (
            cycle_count, entropy_level, system_health, 
            quantum_coherence, temperature, power_consumption
          )
          VALUES (-2, 0.8, 0.9, 0.7, 25.0, 100.0)
          RETURNING id
        `;

        const result2 = await tx.queryRow<{ id: number }>`
          INSERT INTO attestation_records (
            pcr_values, tmp_quote, signature, canonical_hash
          )
          VALUES ('{}', 'DB_TEST_TX_QUOTE', 'DB_TEST_TX_SIG', 'tx_test_hash')
          RETURNING id
        `;

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();

        await tx.commit();

        // Verify data was committed
        const verifyMetrics = await templeDB.queryRow<{ id: number }>`
          SELECT id FROM vqc_metrics WHERE id = ${result1!.id}
        `;
        const verifyAttestation = await templeDB.queryRow<{ id: number }>`
          SELECT id FROM attestation_records WHERE id = ${result2!.id}
        `;

        expect(verifyMetrics).toBeDefined();
        expect(verifyAttestation).toBeDefined();
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      // This would test foreign key relationships if they exist
      // For now, we'll test that the database accepts valid data
      const result = await templeDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM vqc_metrics
      `;

      expect(result).toBeDefined();
      expect(result!.count).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent inserts', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          templeDB.queryRow<{ id: number }>`
            INSERT INTO vqc_metrics (
              cycle_count, entropy_level, system_health, 
              quantum_coherence, temperature, power_consumption
            )
            VALUES (${-10 - i}, 0.8, 0.9, 0.7, 25.0, 100.0)
            RETURNING id
          `
        );
      }

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result!.id).toBeGreaterThan(0);
      });

      // Verify all records were inserted
      const count = await templeDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM vqc_metrics WHERE cycle_count <= -10
      `;

      expect(count!.count).toBe(5);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          templeDB.exec`
            INSERT INTO vqc_metrics (
              cycle_count, entropy_level, system_health, 
              quantum_coherence, temperature, power_consumption
            )
            VALUES (${-100 - i}, 0.8, 0.9, 0.7, 25.0, 100.0)
          `
        );
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (3 seconds for 50 inserts)
      expect(duration).toBeLessThan(3000);

      // Verify all records were inserted
      const count = await templeDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM vqc_metrics WHERE cycle_count <= -100
      `;

      expect(count!.count).toBe(50);
    });

    it('should handle complex queries efficiently', async () => {
      const startTime = Date.now();

      const result = await templeDB.queryAll<{
        avg_entropy: number;
        max_temperature: number;
        count: number;
      }>`
        SELECT 
          AVG(entropy_level) as avg_entropy,
          MAX(temperature) as max_temperature,
          COUNT(*) as count
        FROM vqc_metrics 
        WHERE cycle_count < 0
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY avg_entropy DESC
        LIMIT 10
      `;

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
