import { monitoredBlockchainDB as blockchainDB } from "../blockchain/db";

export interface AuditLogEntry {
  id: number;
  timestamp: Date;
  operationType: string;
  resourceType: string;
  resourceId?: string;
  userContext?: any;
  operationDetails: any;
  outcome: string;
  errorDetails?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  roles?: string[];
}

export async function logAuditEvent(
  operationType: string,
  resourceType: string,
  operationDetails: any,
  outcome: 'success' | 'failure' | 'warning',
  userContext?: UserContext,
  resourceId?: string,
  errorDetails?: string
): Promise<void> {
  try {
    await blockchainDB.exec`
      INSERT INTO audit_logs (
        operation_type, resource_type, resource_id, user_context,
        operation_details, outcome, error_details, ip_address,
        user_agent, session_id
      )
      VALUES (
        ${operationType}, ${resourceType}, ${resourceId || null},
        ${userContext ? JSON.stringify(userContext) : null},
        ${JSON.stringify(operationDetails)}, ${outcome}, ${errorDetails || null},
        ${userContext?.ipAddress || null}, ${userContext?.userAgent || null},
        ${userContext?.sessionId || null}
      )
    `;
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw here to avoid breaking the main operation
  }
}

export async function getAuditLogs(
  limit: number = 100,
  operationType?: string,
  resourceType?: string,
  outcome?: string
): Promise<AuditLogEntry[]> {
  let query = `
    SELECT * FROM audit_logs 
    WHERE 1=1
  `;
  const params: any[] = [];

  if (operationType) {
    query += ` AND operation_type = $${params.length + 1}`;
    params.push(operationType);
  }

  if (resourceType) {
    query += ` AND resource_type = $${params.length + 1}`;
    params.push(resourceType);
  }

  if (outcome) {
    query += ` AND outcome = $${params.length + 1}`;
    params.push(outcome);
  }

  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const rows = await blockchainDB.rawQueryAll<{
    id: number;
    timestamp: Date;
    operation_type: string;
    resource_type: string;
    resource_id: string | null;
    user_context: any;
    operation_details: any;
    outcome: string;
    error_details: string | null;
    ip_address: string | null;
    user_agent: string | null;
    session_id: string | null;
  }>(query, ...params);

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    operationType: row.operation_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id || undefined,
    userContext: row.user_context || undefined,
    operationDetails: row.operation_details,
    outcome: row.outcome,
    errorDetails: row.error_details || undefined,
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
    sessionId: row.session_id || undefined,
  }));
}
