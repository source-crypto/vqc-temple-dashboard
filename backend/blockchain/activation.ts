import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";

export interface ActivationRequest {
  protocolName?: string;
  entityType?: string;
  entityId?: number;
  forceReactivation?: boolean;
}

export interface ActivationResponse {
  success: boolean;
  message: string;
  activatedCount: number;
  failedCount: number;
  details: ActivationDetail[];
}

export interface ActivationDetail {
  protocolName: string;
  entityType: string;
  entityId?: number;
  status: 'activated' | 'already_active' | 'failed';
  message: string;
}

export interface ProtocolStatus {
  protocolName: string;
  isActive: boolean;
  totalEntities: number;
  activatedEntities: number;
  activationPercentage: number;
  lastActivation?: Date;
  metadata?: Record<string, any>;
}

export interface MasterActivationResponse {
  success: boolean;
  totalProtocols: number;
  activatedProtocols: number;
  totalEntities: number;
  activatedEntities: number;
  protocols: ProtocolStatus[];
  logs: string[];
}

const PROTOCOL_TABLES = [
  { protocol: 'amm_pools', table: 'liquidity_pools' },
  { protocol: 'yield_farming', table: 'yield_farming_pools' },
  { protocol: 'flash_loans', table: 'flash_loans' },
  { protocol: 'bridge_transfers', table: 'bridge_transfers' },
  { protocol: 'user_balances', table: 'user_balances' },
];

export const activateProtocol = api<ActivationRequest, ActivationResponse>(
  { expose: true, method: "POST", path: "/blockchain/activation/activate" },
  async (req) => {
    return withPerformanceMonitoring("/blockchain/activation/activate", "POST", async () => {
      const details: ActivationDetail[] = [];
      let activatedCount = 0;
      let failedCount = 0;

      await using tx = await blockchainDB.begin();

      try {
        if (req.entityType && req.entityId) {
          const tableName = PROTOCOL_TABLES.find(p => p.protocol === req.protocolName)?.table;
          if (!tableName) {
            throw APIError.invalidArgument(`Unknown protocol: ${req.protocolName}`);
          }

          const result = await activateSingleEntity(tx, tableName, req.entityType, req.entityId, req.forceReactivation || false);
          details.push(result);
          if (result.status === 'activated') activatedCount++;
          else if (result.status === 'failed') failedCount++;
        } else if (req.protocolName) {
          const tableName = PROTOCOL_TABLES.find(p => p.protocol === req.protocolName)?.table;
          if (!tableName) {
            throw APIError.invalidArgument(`Unknown protocol: ${req.protocolName}`);
          }

          const result = await activateAllInTable(tx, tableName, req.protocolName, req.forceReactivation || false);
          details.push(...result.details);
          activatedCount += result.activatedCount;
          failedCount += result.failedCount;
        } else {
          throw APIError.invalidArgument("Must specify either protocolName or both entityType and entityId");
        }

        await tx.commit();

        return {
          success: failedCount === 0,
          message: `Activated ${activatedCount} entities, ${failedCount} failed`,
          activatedCount,
          failedCount,
          details,
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

export const masterActivation = api<{ forceReactivation?: boolean }, MasterActivationResponse>(
  { expose: true, method: "POST", path: "/blockchain/activation/master" },
  async (req) => {
    return withPerformanceMonitoring("/blockchain/activation/master", "POST", async () => {
      const logs: string[] = [];
      let totalEntities = 0;
      let activatedEntities = 0;
      const protocolStatuses: ProtocolStatus[] = [];

      await using tx = await blockchainDB.begin();

      try {
        logs.push("🚀 Starting Master Activation System...");

        for (const { protocol, table } of PROTOCOL_TABLES) {
          logs.push(`\n📦 Processing protocol: ${protocol}`);
          
          const result = await activateAllInTable(tx, table, protocol, req.forceReactivation || false);
          
          totalEntities += result.details.length;
          activatedEntities += result.activatedCount;

          const statusRow = await tx.rawQueryRow<{
            is_active: boolean;
            total_entities: number;
            activated_entities: number;
            activation_percentage: number;
            last_activation: Date | null;
            metadata: any;
          }>(`
            SELECT is_active, total_entities, activated_entities, activation_percentage, last_activation, metadata
            FROM protocol_status WHERE protocol_name = $1
          `, protocol);

          if (statusRow) {
            protocolStatuses.push({
              protocolName: protocol,
              isActive: statusRow.is_active,
              totalEntities: statusRow.total_entities,
              activatedEntities: statusRow.activated_entities,
              activationPercentage: Number(statusRow.activation_percentage),
              lastActivation: statusRow.last_activation || undefined,
              metadata: statusRow.metadata,
            });
          }

          logs.push(`  ✅ Activated ${result.activatedCount}/${result.details.length} entities`);
        }

        logs.push("\n🎯 Master activation complete!");
        logs.push(`📊 Total: ${activatedEntities}/${totalEntities} entities activated`);

        await tx.exec`
          INSERT INTO activation_logs (activation_type, entity_type, status, details)
          VALUES ('master_activation', 'all', 'completed', ${JSON.stringify({ totalEntities, activatedEntities, logs })})
        `;

        await tx.commit();

        return {
          success: true,
          totalProtocols: PROTOCOL_TABLES.length,
          activatedProtocols: protocolStatuses.filter(p => p.isActive).length,
          totalEntities,
          activatedEntities,
          protocols: protocolStatuses,
          logs,
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

export const getProtocolStatus = api<{ protocolName?: string }, { protocols: ProtocolStatus[] }>(
  { expose: true, method: "GET", path: "/activation/status" },
  async (req) => {
    const whereClause = req.protocolName ? `WHERE protocol_name = '${req.protocolName}'` : '';
    
    const rows = await blockchainDB.rawQueryAll<{
      protocol_name: string;
      is_active: boolean;
      total_entities: number;
      activated_entities: number;
      activation_percentage: string;
      last_activation: Date | null;
      metadata: any;
    }>(`
      SELECT protocol_name, is_active, total_entities, activated_entities, 
             activation_percentage, last_activation, metadata
      FROM protocol_status
      ${whereClause}
      ORDER BY protocol_name
    `);

    return {
      protocols: rows.map(row => ({
        protocolName: row.protocol_name,
        isActive: row.is_active,
        totalEntities: row.total_entities,
        activatedEntities: row.activated_entities,
        activationPercentage: Number(row.activation_percentage),
        lastActivation: row.last_activation || undefined,
        metadata: row.metadata,
      }))
    };
  }
);

async function activateSingleEntity(
  tx: any,
  tableName: string,
  entityType: string,
  entityId: number,
  forceReactivation: boolean
): Promise<ActivationDetail> {
  const existingRow = await tx.rawQueryRow(`
    SELECT id, factability FROM ${tableName} WHERE id = $1
  `, entityId) as { id: number; factability: boolean } | null;

  if (!existingRow) {
    await tx.exec`
      INSERT INTO activation_logs (activation_type, entity_type, entity_id, status, details)
      VALUES ('single_activation', ${entityType}, ${entityId}, 'failed', '{"error": "Entity not found"}')
    `;
    return {
      protocolName: entityType,
      entityType,
      entityId,
      status: 'failed',
      message: 'Entity not found',
    };
  }

  if (existingRow.factability && !forceReactivation) {
    return {
      protocolName: entityType,
      entityType,
      entityId,
      status: 'already_active',
      message: 'Already activated',
    };
  }

  await tx.rawExec(`UPDATE ${tableName} SET factability = true WHERE id = $1`, entityId);

  await tx.exec`
    INSERT INTO protocol_activations (protocol_name, entity_type, entity_id, factability_status, activated_at)
    VALUES (${entityType}, ${entityType}, ${entityId}, true, NOW())
    ON CONFLICT (protocol_name, entity_type, entity_id) 
    DO UPDATE SET factability_status = true, activated_at = NOW(), updated_at = NOW()
  `;

  await tx.exec`
    INSERT INTO activation_logs (activation_type, entity_type, entity_id, status, details)
    VALUES ('single_activation', ${entityType}, ${entityId}, 'activated', '{"factability": true}')
  `;

  return {
    protocolName: entityType,
    entityType,
    entityId,
    status: 'activated',
    message: 'Successfully activated',
  };
}

async function activateAllInTable(
  tx: any,
  tableName: string,
  protocolName: string,
  forceReactivation: boolean
): Promise<{ details: ActivationDetail[]; activatedCount: number; failedCount: number }> {
  const whereClause = forceReactivation ? '' : 'WHERE factability IS NULL OR factability = false';
  
  const tableExistsCheck = await tx.rawQueryRow(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    ) as exists
  `, tableName) as { exists: boolean } | null;

  if (!tableExistsCheck?.exists) {
    return {
      details: [{
        protocolName,
        entityType: tableName,
        status: 'failed',
        message: `Table ${tableName} does not exist`,
      }],
      activatedCount: 0,
      failedCount: 1,
    };
  }

  const columnExistsCheck = await tx.rawQueryRow(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = 'factability'
    ) as exists
  `, tableName) as { exists: boolean } | null;

  if (!columnExistsCheck?.exists) {
    await tx.rawExec(`ALTER TABLE ${tableName} ADD COLUMN factability BOOLEAN DEFAULT false`);
  }

  const rows = await tx.rawQueryAll(`
    SELECT id, factability FROM ${tableName} ${whereClause}
  `) as { id: number; factability: boolean }[];

  const details: ActivationDetail[] = [];
  let activatedCount = 0;

  for (const row of rows) {
    await tx.rawExec(`UPDATE ${tableName} SET factability = true WHERE id = $1`, row.id);

    await tx.exec`
      INSERT INTO protocol_activations (protocol_name, entity_type, entity_id, factability_status, activated_at)
      VALUES (${protocolName}, ${tableName}, ${row.id}, true, NOW())
      ON CONFLICT (protocol_name, entity_type, entity_id) 
      DO UPDATE SET factability_status = true, activated_at = NOW(), updated_at = NOW()
    `;

    details.push({
      protocolName,
      entityType: tableName,
      entityId: row.id,
      status: 'activated',
      message: 'Activated successfully',
    });

    activatedCount++;
  }

  const totalCount = await tx.rawQueryRow(`SELECT COUNT(*) as count FROM ${tableName}`) as { count: number } | null;
  const activatedTotal = await tx.rawQueryRow(`SELECT COUNT(*) as count FROM ${tableName} WHERE factability = true`) as { count: number } | null;

  const activationPercentage = totalCount && totalCount.count > 0 
    ? (activatedTotal!.count / totalCount.count) * 100 
    : 0;

  await tx.exec`
    UPDATE protocol_status 
    SET is_active = true,
        total_entities = ${totalCount?.count || 0},
        activated_entities = ${activatedTotal?.count || 0},
        activation_percentage = ${activationPercentage},
        last_activation = NOW(),
        updated_at = NOW()
    WHERE protocol_name = ${protocolName}
  `;

  return {
    details,
    activatedCount,
    failedCount: 0,
  };
}
