import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Shield, Zap, Music, Cpu, Network, Database, RefreshCw, DollarSign, Coins, TrendingUp, Scale, ArrowRightLeft, Gem, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import MetricsPanel from './MetricsPanel';
import AttestationPanel from './AttestationPanel';
import CeremonialPanel from './CeremonialPanel';
import HarmonicsPanel from './HarmonicsPanel';
import ActivationPanel from './ActivationPanel';
import BlockchainPanel from './BlockchainPanel';
import VQCNetworkPanel from './VQCNetworkPanel';
import CurrencyExchangePanel from './CurrencyExchangePanel';
import AMMPanel from './AMMPanel';
import VQCScanExplorer from './VQCScanExplorer';
import RealTimeStream from './RealTimeStream';
import PerformanceMonitor from './PerformanceMonitor';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';
import GovernancePanel from './GovernancePanel';
import BridgePanel from './BridgePanel';
import NFTMarketplacePanel from './NFTMarketplacePanel';
import QuantumLedgerPanel from './QuantumLedgerPanel';
import { ActivationDashboard } from './ActivationDashboard';

export default function VQCDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    // Simulate connection establishment
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleSeedData = async () => {
    setIsSeeding(true);
    toast({
      title: "Seeding Data",
      description: "Populating databases with initial data...",
    });
    try {
      const templeResponse = await backend.temple.seedTempleData();
      if (templeResponse.success) {
        toast({
          title: "Success",
          description: "Temple data seeded successfully",
        });
      } else {
        toast({
          title: "Error",
          description: templeResponse.message || "Failed to seed Temple data",
          variant: "destructive",
        });
      }

      const blockchainResponse = await backend.blockchain.seedBlockchainData();
      if (blockchainResponse.success) {
        toast({
          title: "Success",
          description: "Blockchain data seeded successfully",
        });
      } else {
        toast({
          title: "Error",
          description: blockchainResponse.message || "Failed to seed Blockchain data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to seed data:', error);
      toast({
        title: "Error",
        description: "An error occurred while seeding data",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries();
    }
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              VQC Temple Dashboard
            </h1>
            <p className="text-slate-300">
              Quantum Verification Core - Real-time Monitoring & Control
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleSeedData}
              disabled={isSeeding}
              variant="outline"
              size="sm"
            >
              {isSeeding ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              {isSeeding ? 'Seeding...' : 'Seed Data'}
            </Button>
            <Badge 
              variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
              className="px-3 py-1"
            >
              <Activity className="w-4 h-4 mr-2" />
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>

        {/* Real-time Stream Component */}
        <ErrorBoundary>
          <RealTimeStream onConnectionChange={setConnectionStatus} />
        </ErrorBoundary>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="master-activation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-15 bg-slate-800 border-slate-700">
            <TabsTrigger value="master-activation" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Master</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Metrics</span>
            </TabsTrigger>
            <TabsTrigger value="exchange" className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>Exchange</span>
            </TabsTrigger>
            <TabsTrigger value="amm" className="flex items-center space-x-2">
              <Coins className="w-4 h-4" />
              <span>AMM</span>
            </TabsTrigger>
            <TabsTrigger value="explorer" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Explorer</span>
            </TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Ledger</span>
            </TabsTrigger>
            <TabsTrigger value="attestation" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Attestation</span>
            </TabsTrigger>
            <TabsTrigger value="ceremonial" className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Ceremonial</span>
            </TabsTrigger>
            <TabsTrigger value="harmonics" className="flex items-center space-x-2">
              <Music className="w-4 h-4" />
              <span>Harmonics</span>
            </TabsTrigger>
            <TabsTrigger value="activation" className="flex items-center space-x-2">
              <Cpu className="w-4 h-4" />
              <span>Activation</span>
            </TabsTrigger>
            <TabsTrigger value="blockchain" className="flex items-center space-x-2">
              <Network className="w-4 h-4" />
              <span>Blockchain</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center space-x-2">
              <Network className="w-4 h-4" />
              <span>VQC Network</span>
            </TabsTrigger>
            <TabsTrigger value="governance" className="flex items-center space-x-2">
              <Scale className="w-4 h-4" />
              <span>Governance</span>
            </TabsTrigger>
            <TabsTrigger value="bridge" className="flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Bridge</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="flex items-center space-x-2">
              <Gem className="w-4 h-4" />
              <span>Marketplace</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="master-activation">
            <ErrorBoundary>
              <ActivationDashboard />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="metrics">
            <ErrorBoundary>
              <MetricsPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="exchange">
            <ErrorBoundary>
              <CurrencyExchangePanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="amm">
            <ErrorBoundary>
              <AMMPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="explorer">
            <ErrorBoundary>
              <VQCScanExplorer />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="ledger">
            <ErrorBoundary>
              <QuantumLedgerPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="attestation">
            <ErrorBoundary>
              <AttestationPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="ceremonial">
            <ErrorBoundary>
              <CeremonialPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="harmonics">
            <ErrorBoundary>
              <HarmonicsPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="activation">
            <ErrorBoundary>
              <ActivationPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="blockchain">
            <ErrorBoundary>
              <BlockchainPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="network">
            <ErrorBoundary>
              <VQCNetworkPanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="governance">
            <ErrorBoundary>
              <GovernancePanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="bridge">
            <ErrorBoundary>
              <BridgePanel />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="marketplace">
            <ErrorBoundary>
              <NFTMarketplacePanel />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>

        {/* Performance Monitor */}
        <ErrorBoundary>
          <PerformanceMonitor />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
