import { SQLDatabase } from "encore.dev/storage/sqldb";
import { DatabaseMonitor } from "../shared/db_monitor";
export type { DatabaseHealth } from "../shared/db_monitor";

export const templeDB = new SQLDatabase("temple", {
  migrations: "./migrations",
});

const monitor = new DatabaseMonitor(templeDB);

export const monitoredTempleDB = {
  async queryRow<T extends object>(query: TemplateStringsArray, ...params: any[]): Promise<T | null> {
    const queryText = query.join('?');
    return monitor.trackQuery(templeDB.queryRow<T>(query, ...params), queryText);
  },

  async queryAll<T extends object>(query: TemplateStringsArray, ...params: any[]): Promise<T[]> {
    const queryText = query.join('?');
    return monitor.trackQuery(templeDB.queryAll<T>(query, ...params), queryText);
  },

  async exec(query: TemplateStringsArray, ...params: any[]): Promise<void> {
    const queryText = query.join('?');
    return monitor.trackQuery(templeDB.exec(query, ...params), queryText);
  },

  async rawQueryRow<T extends object>(query: string, ...params: any[]): Promise<T | null> {
    return monitor.trackQuery(templeDB.rawQueryRow<T>(query, ...params), query);
  },

  async rawQueryAll<T extends object>(query: string, ...params: any[]): Promise<T[]> {
    return monitor.trackQuery(templeDB.rawQueryAll<T>(query, ...params), query);
  },

  async rawExec(query: string, ...params: any[]): Promise<void> {
    return monitor.trackQuery(templeDB.rawExec(query, ...params), query);
  },

  begin: templeDB.begin.bind(templeDB),
};

export function getTempleDBMonitor(): DatabaseMonitor {
  return monitor;
}
