import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Network, Zap, Activity, Cpu, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function VQCNetworkPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Connect node form state
  const [nodeAddress, setNodeAddress] = useState('');
  const [nodePort, setNodePort] = useState('8545');
  const [nodeType, setNodeType] = useState<'quantum' | 'validator' | 'relay'>('quantum');
  
  // Quantum state form state
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [initialEntropy, setInitialEntropy] = useState('0.8');
  const [coherenceTarget, setCoherenceTarget] = useState('50.0');

  const { data: networkStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['vqc-network-status'],
    queryFn: async () => {
      try {
        return await backend.temple.getVQCNetworkStatus();
      } catch (err) {
        console.error('Failed to fetch VQC network status:', err);
        toast({
          title: "Error",
          description: "Failed to fetch VQC network status",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const connectNodeMutation = useMutation({
    mutationFn: async (data: {
      address: string;
      port: number;
      nodeType: 'quantum' | 'validator' | 'relay';
    }) => {
      return await backend.temple.connectVQCNode(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vqc-network-status'] });
      setNodeAddress('');
      setNodePort('8545');
      setNodeType('quantum');
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (err) => {
      console.error('Failed to connect VQC node:', err);
      toast({
        title: "Error",
        description: "Failed to connect VQC node",
        variant: "destructive",
      });
    },
  });

  const initQuantumStateMutation = useMutation({
    mutationFn: async (data: {
      nodeId: string;
      initialEntropy: number;
      coherenceTarget: number;
    }) => {
      return await backend.temple.initializeQuantumState(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vqc-network-status'] });
      setSelectedNodeId('');
      setInitialEntropy('0.8');
      setCoherenceTarget('50.0');
      toast({
        title: "Success",
        description: `Quantum state initialized: ${data.quantumState.substring(0, 50)}...`,
      });
    },
    onError: (err) => {
      console.error('Failed to initialize quantum state:', err);
      toast({
        title: "Error",
        description: "Failed to initialize quantum state",
        variant: "destructive",
      });
    },
  });

  const syncNetworkMutation = useMutation({
    mutationFn: async (forceSync: boolean = false) => {
      return await backend.temple.synchronizeVQCNetwork({ forceSync });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vqc-network-status'] });
      toast({
        title: data.success ? "Success" : "Warning",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (err) => {
      console.error('Failed to synchronize VQC network:', err);
      toast({
        title: "Error",
        description: "Failed to synchronize VQC network",
        variant: "destructive",
      });
    },
  });

  const handleConnectNode = () => {
    if (!nodeAddress.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide node address",
        variant: "destructive",
      });
      return;
    }

    const port = parseInt(nodePort);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast({
        title: "Validation Error",
        description: "Please provide valid port number",
        variant: "destructive",
      });
      return;
    }

    connectNodeMutation.mutate({
      address: nodeAddress.trim(),
      port,
      nodeType,
    });
  };

  const handleInitQuantumState = () => {
    if (!selectedNodeId) {
      toast({
        title: "Validation Error",
        description: "Please select a node",
        variant: "destructive",
      });
      return;
    }

    const entropy = parseFloat(initialEntropy);
    const coherence = parseFloat(coherenceTarget);

    if (isNaN(entropy) || entropy < 0 || entropy > 1) {
      toast({
        title: "Validation Error",
        description: "Initial entropy must be between 0 and 1",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(coherence) || coherence <= 0) {
      toast({
        title: "Validation Error",
        description: "Coherence target must be positive",
        variant: "destructive",
      });
      return;
    }

    initQuantumStateMutation.mutate({
      nodeId: selectedNodeId,
      initialEntropy: entropy,
      coherenceTarget: coherence,
    });
  };

  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'inactive':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNodeTypeBadge = (type: string) => {
    const colors = {
      quantum: 'bg-purple-600',
      validator: 'bg-blue-600',
      relay: 'bg-green-600',
    };
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-600'}>
        {type}
      </Badge>
    );
  };

  const getHealthColor = (health: number) => {
    if (health >= 0.8) return 'text-green-400';
    if (health >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Network className="w-4 h-4 mr-2" />
              Network Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(networkStatus?.status.networkHealth || 0)}`}>
              {statusLoading ? '...' : `${((networkStatus?.status.networkHealth || 0) * 100).toFixed(1)}%`}
            </div>
            <Progress 
              value={(networkStatus?.status.networkHealth || 0) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Active Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statusLoading ? '...' : `${networkStatus?.status.activeNodes || 0}/${networkStatus?.status.totalNodes || 0}`}
            </div>
            <div className="text-xs text-slate-400">
              {networkStatus?.status.quantumNodes || 0} quantum nodes
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Avg Entropy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {statusLoading ? '...' : `${((networkStatus?.status.averageEntropy || 0) * 100).toFixed(1)}%`}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Cpu className="w-4 h-4 mr-2" />
              Avg Coherence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-400">
              {statusLoading ? '...' : `${(networkStatus?.status.averageCoherence || 0).toFixed(1)}μs`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connect Node */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Connect VQC Node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="node-address" className="text-slate-300">Node Address</Label>
              <Input
                id="node-address"
                placeholder="vqc-node.quantum.network"
                value={nodeAddress}
                onChange={(e) => setNodeAddress(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="node-port" className="text-slate-300">Port</Label>
                <Input
                  id="node-port"
                  type="number"
                  placeholder="8545"
                  value={nodePort}
                  onChange={(e) => setNodePort(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="node-type" className="text-slate-300">Node Type</Label>
                <Select value={nodeType} onValueChange={(value: 'quantum' | 'validator' | 'relay') => setNodeType(value)}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="quantum">Quantum Node</SelectItem>
                    <SelectItem value="validator">Validator Node</SelectItem>
                    <SelectItem value="relay">Relay Node</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={handleConnectNode}
              disabled={connectNodeMutation.isPending}
              className="w-full"
            >
              {connectNodeMutation.isPending ? 'Connecting...' : 'Connect Node'}
            </Button>
          </CardContent>
        </Card>

        {/* Initialize Quantum State */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Initialize Quantum State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="node-select" className="text-slate-300">Select Node</Label>
              <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Select a quantum node..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {networkStatus?.nodes
                    .filter(node => node.nodeType === 'quantum' && node.status === 'active')
                    .map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.address}:{node.port}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="initial-entropy" className="text-slate-300">Initial Entropy</Label>
                <Input
                  id="initial-entropy"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="0.8"
                  value={initialEntropy}
                  onChange={(e) => setInitialEntropy(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="coherence-target" className="text-slate-300">Coherence Target (μs)</Label>
                <Input
                  id="coherence-target"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="50.0"
                  value={coherenceTarget}
                  onChange={(e) => setCoherenceTarget(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleInitQuantumState}
              disabled={initQuantumStateMutation.isPending}
              className="w-full"
            >
              {initQuantumStateMutation.isPending ? 'Initializing...' : 'Initialize Quantum State'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Network Synchronization */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Network Synchronization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-300 mb-1">
                Sync Status: <span className="text-white">{networkStatus?.status.syncStatus || 'Unknown'}</span>
              </div>
              <div className="text-xs text-slate-400">
                Last updated: {networkStatus?.lastUpdate ? new Date(networkStatus.lastUpdate).toLocaleTimeString() : 'Never'}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={() => syncNetworkMutation.mutate(false)}
                disabled={syncNetworkMutation.isPending}
                variant="outline"
              >
                {syncNetworkMutation.isPending ? 'Syncing...' : 'Sync Network'}
              </Button>
              <Button 
                onClick={() => syncNetworkMutation.mutate(true)}
                disabled={syncNetworkMutation.isPending}
                variant="destructive"
              >
                Force Sync
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Connected Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : networkStatus?.nodes.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No VQC nodes connected.
            </div>
          ) : (
            <div className="space-y-4">
              {networkStatus?.nodes.map((node) => (
                <div key={node.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getNodeStatusIcon(node.status)}
                      <span className="text-white font-medium">
                        {node.address}:{node.port}
                      </span>
                      {getNodeTypeBadge(node.nodeType)}
                      <Badge variant={node.status === 'active' ? 'default' : 'secondary'}>
                        {node.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400">
                      {node.version}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Entropy Level:</span>
                      <div className="text-purple-400">
                        {(node.entropyLevel * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Coherence Time:</span>
                      <div className="text-cyan-400">
                        {node.coherenceTime.toFixed(1)}μs
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Last Seen:</span>
                      <div className="text-white">
                        {new Date(node.lastSeen).toLocaleTimeString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Quantum State:</span>
                      <div className="text-white font-mono text-xs truncate">
                        {node.quantumState.substring(0, 20)}...
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
