import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

interface RealTimeStreamProps {
  onConnectionChange: (status: 'connected' | 'disconnected' | 'connecting') => void;
}

interface StreamData {
  type: 'metrics' | 'attestation' | 'harmonics' | 'system';
  timestamp: Date;
  data: any;
}

function RealTimeStreamContent({ onConnectionChange }: RealTimeStreamProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [latestHarmonics, setLatestHarmonics] = useState<any>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const streamRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectToStream = async () => {
    try {
      onConnectionChange('connecting');
      setConnectionAttempts(prev => prev + 1);

      const stream = await backend.temple.vqcDashboardStream({
        clientId: `dashboard-${Date.now()}`,
        subscriptions: ['metrics', 'harmonics', 'system']
      });

      streamRef.current = stream;
      setIsConnected(true);
      onConnectionChange('connected');
      setConnectionAttempts(0);

      // Listen for incoming data
      for await (const data of stream) {
        handleStreamData(data);
      }
    } catch (error) {
      console.error('Stream connection error:', error);
      setIsConnected(false);
      onConnectionChange('disconnected');
      
      if (connectionAttempts < 5) {
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToStream();
        }, delay);
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to establish real-time connection after multiple attempts",
          variant: "destructive",
        });
      }
    }
  };

  const handleStreamData = (data: StreamData) => {
    switch (data.type) {
      case 'metrics':
        setLatestMetrics(data.data);
        break;
      case 'harmonics':
        setLatestHarmonics(data.data);
        break;
      case 'system':
        if (data.data.status === 'connected') {
          toast({
            title: "Connected",
            description: "Real-time stream established",
          });
        }
        break;
    }
  };

  useEffect(() => {
    connectToStream();

    return () => {
      if (streamRef.current) {
        streamRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Connection Status */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-300 flex items-center">
            {isConnected ? (
              <Wifi className="w-4 h-4 mr-2 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 mr-2 text-red-400" />
            )}
            Real-time Stream
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {connectionAttempts > 0 && !isConnected && (
              <div className="text-xs text-slate-400">
                Attempt {connectionAttempts}/5
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Metrics */}
      {latestMetrics && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-blue-400" />
              Live VQC Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">System Health</span>
                <span className="text-white">{(latestMetrics.systemHealth * 100).toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics.systemHealth * 100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Entropy Level</span>
                <span className="text-white">{(latestMetrics.entropyLevel * 100).toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics.entropyLevel * 100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Quantum Coherence</span>
                <span className="text-white">{(latestMetrics.quantumCoherence * 100).toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics.quantumCoherence * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Harmonics */}
      {latestHarmonics && (
        <Card className="bg-slate-800 border-slate-700 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-purple-400" />
              Live Harmonics Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-400">CPU Frequency:</span>
                <div className="text-white font-mono">
                  {(latestHarmonics.cpuFrequency / 1000).toFixed(2)} GHz
                </div>
              </div>
              <div>
                <span className="text-slate-400">Network Activity:</span>
                <div className="text-white">
                  {latestHarmonics.networkActivity.toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-slate-400">Musical Tempo:</span>
                <div className="text-white">
                  {latestHarmonics.musicalPattern?.tempo || 'N/A'} BPM
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RealTimeStream({ onConnectionChange }: RealTimeStreamProps) {
  return (
    <ErrorBoundary>
      <RealTimeStreamContent onConnectionChange={onConnectionChange} />
    </ErrorBoundary>
  );
}
