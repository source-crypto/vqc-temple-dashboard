import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: number;
  cpuUsage: number;
}

interface SystemHealth {
  database: {
    isHealthy: boolean;
    connectionCount: number;
    activeQueries: number;
    avgResponseTime: number;
    uptime: number;
  };
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

function PerformanceMonitorContent() {
  const [isVisible, setIsVisible] = useState(false);

  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getSystemHealth();
      } catch (err) {
        console.error('Failed to fetch system health:', err);
        return null;
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: performanceMetrics } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getPerformanceMetrics();
      } catch (err) {
        console.error('Failed to fetch performance metrics:', err);
        return { metrics: [] };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Monitor client-side performance
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          console.log('Page Load Performance:', {
            domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
            loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
            totalTime: navEntry.loadEventEnd - navEntry.fetchStart,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['navigation', 'measure'] });

    return () => observer.disconnect();
  }, []);

  const getHealthStatus = (isHealthy: boolean) => {
    return isHealthy ? (
      <Badge variant="default" className="bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" />
        Healthy
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Unhealthy
      </Badge>
    );
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime < 100) return 'text-green-400';
    if (responseTime < 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full border border-slate-600 shadow-lg"
          title="Show Performance Monitor"
        >
          <Activity className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card className="bg-slate-800 border-slate-700 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Performance Monitor
            </CardTitle>
            <button
              onClick={() => setIsVisible(false)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* System Health */}
          {systemHealth && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Database</span>
                {getHealthStatus(systemHealth.database.isHealthy)}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Response Time:</span>
                  <div className={getResponseTimeColor(systemHealth.database.avgResponseTime)}>
                    {systemHealth.database.avgResponseTime.toFixed(0)}ms
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Active Queries:</span>
                  <div className="text-white">
                    {systemHealth.database.activeQueries}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Memory Usage</span>
                  <span className="text-white">
                    {systemHealth.memory.percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={systemHealth.memory.percentage} className="h-2" />
                <div className="text-xs text-slate-400 mt-1">
                  {formatBytes(systemHealth.memory.used)} / {formatBytes(systemHealth.memory.total)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">API Error Rate:</span>
                  <div className={systemHealth.api.errorRate > 5 ? 'text-red-400' : 'text-green-400'}>
                    {systemHealth.api.errorRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Requests:</span>
                  <div className="text-white">
                    {systemHealth.api.requestCount}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent API Performance */}
          {performanceMetrics?.metrics && performanceMetrics.metrics.length > 0 && (
            <div className="space-y-2">
              <div className="text-slate-400 text-sm flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Recent API Calls
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {performanceMetrics.metrics.slice(0, 5).map((metric, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={metric.statusCode < 400 ? "default" : "destructive"}
                        className="text-xs px-1 py-0"
                      >
                        {metric.statusCode}
                      </Badge>
                      <span className="text-slate-300 truncate max-w-24">
                        {metric.endpoint}
                      </span>
                    </div>
                    <span className={getResponseTimeColor(metric.responseTime)}>
                      {metric.responseTime}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client Performance */}
          <div className="space-y-2">
            <div className="text-slate-400 text-sm flex items-center">
              <Zap className="w-3 h-3 mr-1" />
              Client Performance
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Memory:</span>
                <div className="text-white">
                  {(performance.memory as any)?.usedJSHeapSize 
                    ? formatBytes((performance.memory as any).usedJSHeapSize)
                    : 'N/A'
                  }
                </div>
              </div>
              <div>
                <span className="text-slate-400">Connection:</span>
                <div className="text-white">
                  {(navigator as any).connection?.effectiveType || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PerformanceMonitor() {
  return (
    <ErrorBoundary>
      <PerformanceMonitorContent />
    </ErrorBoundary>
  );
}
