import { api } from "encore.dev/api";
import { getBlockchainDBMonitor, DatabaseHealth } from "./db";

export interface SystemHealth {
  database: DatabaseHealth;
  api: {
    isHealthy: boolean;
    avgResponseTime: number;
    errorRate: number;
    requestCount: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: Date;
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: number;
  cpuUsage: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getMetrics(endpoint?: string, timeRange?: number): PerformanceMetrics[] {
    let filtered = this.metrics;
    
    if (endpoint) {
      filtered = filtered.filter(m => m.endpoint === endpoint);
    }
    
    if (timeRange) {
      const cutoff = new Date(Date.now() - timeRange);
      filtered = filtered.filter(m => m.timestamp > cutoff);
    }
    
    return filtered;
  }

  getAverageResponseTime(endpoint?: string, timeRange?: number): number {
    const metrics = this.getMetrics(endpoint, timeRange);
    if (metrics.length === 0) return 0;
    
    return metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
  }

  getErrorRate(endpoint?: string, timeRange?: number): number {
    const metrics = this.getMetrics(endpoint, timeRange);
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(m => m.statusCode >= 400).length;
    return (errors / metrics.length) * 100;
  }
}

// Middleware for performance monitoring
export function withPerformanceMonitoring<T>(
  endpoint: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  return fn()
    .then(result => {
      const responseTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;
      
      PerformanceMonitor.getInstance().recordMetric({
        endpoint,
        method,
        responseTime,
        statusCode: 200,
        timestamp: new Date(),
        memoryUsage,
        cpuUsage: process.cpuUsage().user / 1000000 // Convert to milliseconds
      });
      
      return result;
    })
    .catch(error => {
      const responseTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;
      
      PerformanceMonitor.getInstance().recordMetric({
        endpoint,
        method,
        responseTime,
        statusCode: (error as any).code === 'not_found' ? 404 : 500,
        timestamp: new Date(),
        memoryUsage,
        cpuUsage: process.cpuUsage().user / 1000000
      });
      
      throw error;
    });
}

// Health check endpoint
export const getSystemHealth = api<void, SystemHealth>(
  { expose: true, method: "GET", path: "/health" },
  async () => {
    const dbMonitor = getBlockchainDBMonitor();
    const perfMonitor = PerformanceMonitor.getInstance();
    
    const dbHealth = await dbMonitor.checkHealth();
    const memUsage = process.memoryUsage();
    
    return {
      database: dbHealth,
      api: {
        isHealthy: true,
        avgResponseTime: perfMonitor.getAverageResponseTime(undefined, 300000), // Last 5 minutes
        errorRate: perfMonitor.getErrorRate(undefined, 300000),
        requestCount: perfMonitor.getMetrics(undefined, 300000).length
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      timestamp: new Date()
    };
  }
);

// Performance metrics endpoint
export const getPerformanceMetrics = api<void, { metrics: PerformanceMetrics[] }>(
  { expose: true, method: "GET", path: "/metrics/performance" },
  async () => {
    const perfMonitor = PerformanceMonitor.getInstance();
    return {
      metrics: perfMonitor.getMetrics(undefined, 3600000) // Last hour
    };
  }
);
