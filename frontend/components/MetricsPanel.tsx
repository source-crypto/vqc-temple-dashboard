
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, Thermometer, Power, Cpu, Gauge } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

function MetricsPanelContent() {
  const { toast } = useToast();

  const { data: metricsData, isLoading, error } = useQuery({
    queryKey: ['vqc-metrics'],
    queryFn: async () => {
      try {
        return await backend.temple.getVQCMetrics();
      } catch (err) {
        console.error('Failed to fetch VQC metrics:', err);
        toast({
          title: "Error",
          description: "Failed to fetch VQC metrics",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-slate-600 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-slate-600 rounded w-1/2 mb-4"></div>
              <div className="h-2 bg-slate-600 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            Failed to load VQC metrics. Please check your connection.
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestMetrics = metricsData?.metrics[0];

  if (!latestMetrics) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="text-center text-slate-400">
            No VQC metrics available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthColor = (value: number) => {
    if (value >= 0.8) return 'text-green-400';
    if (value >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBadge = (value: number) => {
    if (value >= 0.8) return <Badge variant="default" className="bg-green-600">Optimal</Badge>;
    if (value >= 0.6) return <Badge variant="secondary" className="bg-yellow-600">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Quantum Cycles
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {latestMetrics.cycleCount.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400">
              Total quantum processing cycles
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Entropy Level
            </CardTitle>
            <Zap className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(latestMetrics.entropyLevel)}`}>
              {(latestMetrics.entropyLevel * 100).toFixed(1)}%
            </div>
            <Progress 
              value={latestMetrics.entropyLevel * 100} 
              className="mt-2"
            />
            <p className="text-xs text-slate-400 mt-1">
              Quantum entropy generation
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              System Health
            </CardTitle>
            <Gauge className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-bold ${getHealthColor(latestMetrics.systemHealth)}`}>
                {(latestMetrics.systemHealth * 100).toFixed(1)}%
              </div>
              {getHealthBadge(latestMetrics.systemHealth)}
            </div>
            <Progress 
              value={latestMetrics.systemHealth * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Quantum Coherence
            </CardTitle>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(latestMetrics.quantumCoherence)}`}>
              {(latestMetrics.quantumCoherence * 100).toFixed(1)}%
            </div>
            <Progress 
              value={latestMetrics.quantumCoherence * 100} 
              className="mt-2"
            />
            <p className="text-xs text-slate-400 mt-1">
              Quantum state coherence
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Temperature
            </CardTitle>
            <Thermometer className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {latestMetrics.temperature.toFixed(1)}°C
            </div>
            <p className="text-xs text-slate-400">
              Core temperature
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Power Consumption
            </CardTitle>
            <Power className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {latestMetrics.powerConsumption.toFixed(0)}W
            </div>
            <p className="text-xs text-slate-400">
              Current power draw
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historical Data */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Metrics History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metricsData?.metrics.slice(0, 5).map((metric, index) => (
              <div key={metric.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-slate-400">
                    {new Date(metric.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-white">
                    Cycles: {metric.cycleCount.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <span className="text-slate-400">Health: </span>
                    <span className={getHealthColor(metric.systemHealth)}>
                      {(metric.systemHealth * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-400">Entropy: </span>
                    <span className={getHealthColor(metric.entropyLevel)}>
                      {(metric.entropyLevel * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MetricsPanel() {
  return (
    <ErrorBoundary>
      <MetricsPanelContent />
    </ErrorBoundary>
  );
}
