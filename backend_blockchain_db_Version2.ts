/**
 * Pluggable DB adapter for the network service.
 *
 * - Default: File-backed adapter (no runtime deps)
 * - Optional: PostgresAdapter when DATABASE_URL is provided (uses `pg` only when DATABASE_URL is set)
 *
 * The adapters implement a simple key/value cache used by the network service to persist
 * recent responses (to allow simple live caching and persistence across restarts).
 *
 * Created to be tiny and dependency-free by default.
 */

import fs from "fs";
import path from "path";

export interface DBAdapter {
  init(): Promise<void>;
  getCache(key: string): Promise<any | null>;
  setCache(key: string, value: any): Promise<void>;
  close?(): Promise<void>;
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), "backend", "data");
const DEFAULT_CACHE_FILE = path.join(DEFAULT_DATA_DIR, "network_cache.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * File-backed adapter. Uses a JSON file with structure:
 * { "<key>": { value: <any>, updated_at: "<iso>" }, ... }
 */
export class FileAdapter implements DBAdapter {
  private filePath: string;
  private cache: Record<string, any> | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_CACHE_FILE;
  }

  async init(): Promise<void> {
    ensureDir(path.dirname(this.filePath));
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw || "{}");
    } catch (err: any) {
      // If file doesn't exist or is invalid, start with empty cache
      this.cache = {};
      await this.persist();
    }
  }

  private async persist() {
    await fs.promises.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), {
      encoding: "utf8",
    });
  }

  async getCache(key: string) {
    if (!this.cache) await this.init();
    const entry = this.cache![key];
    return entry ? entry.value : null;
  }

  async setCache(key: string, value: any) {
    if (!this.cache) await this.init();
    this.cache![key] = {
      value,
      updated_at: new Date().toISOString(),
    };
    await this.persist();
  }
}

/**
 * Postgres-backed adapter. Only required if you set DATABASE_URL.
 *
 * This adapter will try to require('pg') lazily. If 'pg' is not installed and DATABASE_URL
 * is provided, you will get a helpful error telling you to install 'pg'.
 *
 * It creates a single table `network_cache` to store key -> json values for simple persistence.
 */
export class PostgresAdapter implements DBAdapter {
  private pool: any;
  private databaseUrl: string;

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
  }

  async init() {
    // Lazy require to avoid adding pg as mandatory runtime dependency
    let Pg: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Pg = require("pg");
    } catch (err) {
      throw new Error(
        "Postgres adapter requested but 'pg' is not installed. Run `npm install pg` or unset DATABASE_URL."
      );
    }

    const { Pool } = Pg;
    this.pool = new Pool({ connectionString: this.databaseUrl });

    // Create table if not exists
    const createSql = `
      CREATE TABLE IF NOT EXISTS network_cache (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await this.pool.query(createSql);
  }

  async getCache(key: string) {
    const res = await this.pool.query(`SELECT value, updated_at FROM network_cache WHERE key = $1`, [key]);
    if (res.rowCount === 0) return null;
    // Return stored shape { value, updated_at } to match FileAdapter
    return {
      value: res.rows[0].value,
      updated_at: res.rows[0].updated_at,
    };
  }

  async setCache(key: string, value: any) {
    await this.pool.query(
      `INSERT INTO network_cache(key, value, updated_at) VALUES($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [key, value]
    );
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}