import { api, APIError } from "encore.dev/api";
import { templeDB } from "./db";
import { logAuditEvent } from "./audit";
import { validateVQCMetrics } from "./validation";

export interface VQCMetrics {
  id: number;
  timestamp: Date;
  cycleCount: number;
  entropyLevel: number;
  systemHealth: number;
  quantumCoherence: number;
  temperature: number;
  powerConsumption: number;
}

export interface VQCMetricsResponse {
  metrics: VQCMetrics[];
}

// Retrieves the latest VQC quantum cycle metrics.
export const getVQCMetrics = api<void, VQCMetricsResponse>(
  { expose: true, method: "GET", path: "/vqc/metrics" },
  async () => {
    try {
      const rows = await templeDB.queryAll<{
        id: number;
        timestamp: Date;
        cycle_count: number;
        entropy_level: number;
        system_health: number;
        quantum_coherence: number;
        temperature: number;
        power_consumption: number;
      }>`
        SELECT * FROM vqc_metrics 
        ORDER BY timestamp DESC 
        LIMIT 100
      `;

      const metrics = rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        cycleCount: row.cycle_count,
        entropyLevel: row.entropy_level,
        systemHealth: row.system_health,
        quantumCoherence: row.quantum_coherence,
        temperature: row.temperature,
        powerConsumption: row.power_consumption,
      }));

      return { metrics };
    } catch (error) {
      console.error('Failed to get VQC metrics:', error);
      throw APIError.internal("Failed to retrieve VQC metrics");
    }
  }
);

export interface CreateVQCMetricsRequest {
  cycleCount: number;
  entropyLevel: number;
  systemHealth: number;
  quantumCoherence: number;
  temperature: number;
  powerConsumption: number;
}

// Records new VQC quantum cycle metrics.
export const createVQCMetrics = api<CreateVQCMetricsRequest, VQCMetrics>(
  { expose: true, method: "POST", path: "/vqc/metrics" },
  async (req) => {
    try {
      // Input validation
      validateVQCMetrics(req);

      const row = await templeDB.queryRow<{
        id: number;
        timestamp: Date;
        cycle_count: number;
        entropy_level: number;
        system_health: number;
        quantum_coherence: number;
        temperature: number;
        power_consumption: number;
      }>`
        INSERT INTO vqc_metrics (
          cycle_count, entropy_level, system_health, 
          quantum_coherence, temperature, power_consumption
        )
        VALUES (${req.cycleCount}, ${req.entropyLevel}, ${req.systemHealth}, 
                ${req.quantumCoherence}, ${req.temperature}, ${req.powerConsumption})
        RETURNING *
      `;

      if (!row) {
        throw new Error("Failed to create VQC metrics");
      }

      const metrics = {
        id: row.id,
        timestamp: row.timestamp,
        cycleCount: row.cycle_count,
        entropyLevel: row.entropy_level,
        systemHealth: row.system_health,
        quantumCoherence: row.quantum_coherence,
        temperature: row.temperature,
        powerConsumption: row.power_consumption,
      };

      // Audit log
      await logAuditEvent(
        'create_vqc_metrics',
        'vqc_metrics',
        {
          metricsId: metrics.id,
          cycleCount: req.cycleCount,
          systemHealth: req.systemHealth,
          entropyLevel: req.entropyLevel
        },
        'success',
        undefined,
        metrics.id.toString()
      );

      return metrics;
    } catch (error) {
      // Audit log for failure
      await logAuditEvent(
        'create_vqc_metrics',
        'vqc_metrics',
        {
          cycleCount: req.cycleCount,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'failure',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }
);
