import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database health check and monitoring
export interface DatabaseHealth {
  isHealthy: boolean;
  connectionCount: number;
  activeQueries: number;
  avgResponseTime: number;
  lastError?: string;
  uptime: number;
}

export class DatabaseMonitor {
  private healthMetrics: DatabaseHealth = {
    isHealthy: true,
    connectionCount: 0,
    activeQueries: 0,
    avgResponseTime: 0,
    uptime: Date.now()
  };
  private queryTimes: number[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private slowQueryThreshold = 500; // ms
  private db: SQLDatabase;

  constructor(db: SQLDatabase, slowQueryThreshold: number = 500) {
    this.db = db;
    this.slowQueryThreshold = slowQueryThreshold;
  }

  async checkHealth(): Promise<DatabaseHealth> {
    try {
      const startTime = Date.now();
      await this.db.queryRow`SELECT 1 as health_check`;
      const responseTime = Date.now() - startTime;
      
      this.updateMetrics(responseTime, true);
      this.reconnectAttempts = 0;
      
      return this.healthMetrics;
    } catch (error) {
      console.error('Database health check failed:', error);
      this.updateMetrics(0, false, error instanceof Error ? error.message : 'Unknown error');
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.attemptReconnection(), 1000 * Math.pow(2, this.reconnectAttempts));
      }
      
      return this.healthMetrics;
    }
  }

  private updateMetrics(responseTime: number, isHealthy: boolean, error?: string) {
    if (responseTime > 0) {
      this.queryTimes.push(responseTime);
      if (this.queryTimes.length > 100) {
        this.queryTimes.shift();
      }
      this.healthMetrics.avgResponseTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
    }
    
    this.healthMetrics.isHealthy = isHealthy;
    this.healthMetrics.lastError = error;
    this.healthMetrics.uptime = Date.now() - this.healthMetrics.uptime;
  }

  private async attemptReconnection() {
    console.log(`Attempting database reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    await this.checkHealth();
  }

  trackQuery<T>(queryPromise: Promise<T>, queryText?: string): Promise<T> {
    const startTime = Date.now();
    this.healthMetrics.activeQueries++;
    
    return queryPromise
      .then(result => {
        const responseTime = Date.now() - startTime;
        if (responseTime > this.slowQueryThreshold) {
          console.warn(`Slow query detected (${responseTime}ms):`, {
            query: queryText,
          });
        }
        this.updateMetrics(responseTime, true);
        return result;
      })
      .catch(error => {
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, false, (error as Error).message);
        throw error;
      })
      .finally(() => {
        this.healthMetrics.activeQueries--;
      });
  }
}
