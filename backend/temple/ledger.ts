import { api, APIError } from "encore.dev/api";
import { templeDB } from "./db";
import { withErrorHandling, generateRequestId, logRequest, logResponse } from "./middleware";
import { blockchain } from "~encore/clients";

// A public entry in the quantum chain ledger.
// Represents a verified attestation that has been recorded on the blockchain.
export interface QuantumLedgerEntry {
  ledgerId: number; // attestation_records.id
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  canonicalHash: string;
  vqcMetrics: {
    entropyLevel: number;
    systemHealth: number;
    quantumCoherence: number;
  };
}

// Response for a list of ledger entries.
export interface QuantumLedgerResponse {
  entries: QuantumLedgerEntry[];
  total: number;
  page: number;
  totalPages: number;
}

// Request for getting ledger entries with pagination.
export interface GetLedgerEntriesRequest {
  page?: number;
  limit?: number;
}

// Retrieves entries from the public quantum chain ledger.
export const getQuantumLedgerEntries = api<GetLedgerEntriesRequest, QuantumLedgerResponse>(
  { expose: true, method: "GET", path: "/ledger/quantum" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    logRequest({ requestId, timestamp: new Date(), method: 'GET', path: '/ledger/quantum' });

    try {
      const result = await withErrorHandling("getQuantumLedgerEntries", requestId, async () => {
        const page = req.page || 1;
        const limit = req.limit || 20;
        const offset = (page - 1) * limit;

        // Get published attestations from templeDB
        const attestations = await templeDB.queryAll<{
          id: number;
          blockchain_tx_hash: string;
          canonical_hash: string;
          timestamp: Date;
        }>`
          SELECT id, blockchain_tx_hash, canonical_hash, timestamp
          FROM attestation_records
          WHERE verification_status = 'verified' AND blockchain_tx_hash IS NOT NULL
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const totalResult = await templeDB.queryRow<{ count: string }>`
          SELECT COUNT(*) as count
          FROM attestation_records
          WHERE verification_status = 'verified' AND blockchain_tx_hash IS NOT NULL
        `;
        const total = parseInt(totalResult?.count || '0', 10);

        const entries: QuantumLedgerEntry[] = [];
        for (const attestation of attestations) {
          // Get transaction details from blockchain service
          const txDetails = await blockchain.search({ query: attestation.blockchain_tx_hash });
          
          // Get VQC metrics around the time of attestation
          const metrics = await templeDB.queryRow<{
            entropy_level: number;
            system_health: number;
            quantum_coherence: number;
          }>`
            SELECT entropy_level, system_health, quantum_coherence
            FROM vqc_metrics
            WHERE timestamp <= ${attestation.timestamp}
            ORDER BY timestamp DESC
            LIMIT 1
          `;

          if (txDetails.type === 'transaction' && txDetails.result) {
            entries.push({
              ledgerId: attestation.id,
              blockNumber: txDetails.result.blockNumber,
              transactionHash: txDetails.result.txHash,
              timestamp: new Date(txDetails.result.timestamp),
              canonicalHash: attestation.canonical_hash,
              vqcMetrics: {
                entropyLevel: metrics?.entropy_level || 0,
                systemHealth: metrics?.system_health || 0,
                quantumCoherence: metrics?.quantum_coherence || 0,
              }
            });
          }
        }

        return {
          entries,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      });
      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve quantum ledger entries");
    }
  }
);

// Request for a single ledger entry.
export interface GetLedgerEntryRequest {
  id: number; // attestation_records.id
}

// Retrieves a single entry from the public quantum chain ledger.
export const getQuantumLedgerEntry = api<GetLedgerEntryRequest, { entry: QuantumLedgerEntry }>(
  { expose: true, method: "GET", path: "/ledger/quantum/:id" },
  async ({ id }) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    logRequest({ requestId, timestamp: new Date(), method: 'GET', path: `/ledger/quantum/${id}` });

    try {
      const result = await withErrorHandling("getQuantumLedgerEntry", requestId, async () => {
        const attestation = await templeDB.queryRow<{
          id: number;
          blockchain_tx_hash: string;
          canonical_hash: string;
          timestamp: Date;
        }>`
          SELECT id, blockchain_tx_hash, canonical_hash, timestamp
          FROM attestation_records
          WHERE id = ${id} AND verification_status = 'verified' AND blockchain_tx_hash IS NOT NULL
        `;

        if (!attestation) {
          throw APIError.notFound("Ledger entry not found");
        }

        const txDetails = await blockchain.search({ query: attestation.blockchain_tx_hash });
        
        const metrics = await templeDB.queryRow<{
          entropy_level: number;
          system_health: number;
          quantum_coherence: number;
        }>`
          SELECT entropy_level, system_health, quantum_coherence
          FROM vqc_metrics
          WHERE timestamp <= ${attestation.timestamp}
          ORDER BY timestamp DESC
          LIMIT 1
        `;

        if (txDetails.type !== 'transaction' || !txDetails.result) {
          throw APIError.internal("Could not retrieve transaction details for ledger entry");
        }

        const entry: QuantumLedgerEntry = {
          ledgerId: attestation.id,
          blockNumber: txDetails.result.blockNumber,
          transactionHash: txDetails.result.txHash,
          timestamp: new Date(txDetails.result.timestamp),
          canonicalHash: attestation.canonical_hash,
          vqcMetrics: {
            entropyLevel: metrics?.entropy_level || 0,
            systemHealth: metrics?.system_health || 0,
            quantumCoherence: metrics?.quantum_coherence || 0,
          }
        };

        return { entry };
      });
      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve quantum ledger entry");
    }
  }
);
