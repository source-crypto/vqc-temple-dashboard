import { SQLDatabase } from "encore.dev/storage/sqldb";
import { DatabaseMonitor } from "../shared/db_monitor";
export type { DatabaseHealth } from "../shared/db_monitor";

// Enhanced database configuration with connection pooling.
// Encore automatically manages connection pooling. For advanced configurations,
// such as setting max open connections or idle timeouts, you would typically
// configure this at the infrastructure level, not in the application code.
export const blockchainDB = new SQLDatabase("blockchain", {
  migrations: "./migrations",
});

const monitor = new DatabaseMonitor(blockchainDB);

// Enhanced query helper with automatic monitoring.
// For production systems, it's crucial to analyze query performance using tools
// like EXPLAIN ANALYZE to understand query plans and identify bottlenecks.
// This helps in deciding where to add or modify indexes for optimization.
export const monitoredBlockchainDB = {
  async queryRow<T extends object>(query: TemplateStringsArray, ...params: any[]): Promise<T | null> {
    const queryText = query.join('?');
    return monitor.trackQuery(blockchainDB.queryRow<T>(query, ...params), queryText);
  },

  async queryAll<T extends object>(query: TemplateStringsArray, ...params: any[]): Promise<T[]> {
    const queryText = query.join('?');
    return monitor.trackQuery(blockchainDB.queryAll<T>(query, ...params), queryText);
  },

  async exec(query: TemplateStringsArray, ...params: any[]): Promise<void> {
    const queryText = query.join('?');
    return monitor.trackQuery(blockchainDB.exec(query, ...params), queryText);
  },

  async rawQueryRow<T extends object>(query: string, ...params: any[]): Promise<T | null> {
    return monitor.trackQuery(blockchainDB.rawQueryRow<T>(query, ...params), query);
  },

  async rawQueryAll<T extends object>(query: string, ...params: any[]): Promise<T[]> {
    return monitor.trackQuery(blockchainDB.rawQueryAll<T>(query, ...params), query);
  },

  async rawExec(query: string, ...params: any[]): Promise<void> {
    return monitor.trackQuery(blockchainDB.rawExec(query, ...params), query);
  },

  begin: blockchainDB.begin.bind(blockchainDB),
};

// Expose the monitor for health checks
export function getBlockchainDBMonitor(): DatabaseMonitor {
  return monitor;
}
