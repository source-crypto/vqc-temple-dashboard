import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Box, Activity, Network, Code, TrendingUp, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

function VQCScanExplorerContent() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: networkStats, isLoading: statsLoading } = useQuery({
    queryKey: ['network-stats'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getNetworkStats();
      } catch (err) {
        console.error('Failed to fetch network stats:', err);
        toast({
          title: "Error",
          description: "Failed to fetch network statistics",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 10000,
  });

  const { data: latestBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['latest-blocks'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getLatestBlocks();
      } catch (err) {
        console.error('Failed to fetch latest blocks:', err);
        return { blocks: [], total: 0 };
      }
    },
    refetchInterval: 15000,
  });

  const { data: latestTransactions, isLoading: txLoading } = useQuery({
    queryKey: ['latest-transactions'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getLatestTransactions();
      } catch (err) {
        console.error('Failed to fetch latest transactions:', err);
        return { transactions: [], total: 0 };
      }
    },
    refetchInterval: 10000,
  });

  const { data: contracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      try {
        return await backend.blockchain.listContracts();
      } catch (err) {
        console.error('Failed to fetch contracts:', err);
        return { contracts: [], total: 0 };
      }
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search term",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await backend.blockchain.search({ query: searchQuery.trim() });
      
      if (result.type === 'not_found') {
        toast({
          title: "Not Found",
          description: "No results found for your search query",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Search Result",
          description: `Found ${result.type}: ${searchQuery}`,
        });
        // In a real app, you would navigate to the result page
      }
    } catch (err) {
      console.error('Search failed:', err);
      toast({
        title: "Search Error",
        description: "Failed to perform search",
        variant: "destructive",
      });
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatValue = (value: string) => {
    const num = parseFloat(value);
    if (num === 0) return '0 ASM';
    if (num < 1e18) return `${(num / 1e18).toFixed(6)} ASM`;
    return `${(num / 1e18).toFixed(2)} ASM`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            VQCScan Explorer
          </h2>
          <p className="text-slate-300">
            VQC Blockchain Network Explorer
          </p>
        </div>
        <Badge variant="default" className="px-3 py-1">
          <Network className="w-4 h-4 mr-2" />
          VQC Mainnet
        </Badge>
      </div>

      {/* Search Bar */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search by address, transaction hash, block number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="px-6">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Box className="w-4 h-4 mr-2" />
              Total Blocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : formatNumber(networkStats?.totalBlocks || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : formatNumber(networkStats?.totalTransactions || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <Code className="w-4 h-4 mr-2" />
              Smart Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : formatNumber(networkStats?.totalContracts || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Market Cap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : `$${formatNumber(Math.floor((networkStats?.marketCap || 0) / 1000000))}M`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="blocks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
          <TabsTrigger value="blocks">Latest Blocks</TabsTrigger>
          <TabsTrigger value="transactions">Latest Transactions</TabsTrigger>
          <TabsTrigger value="contracts">Smart Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="blocks">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Latest Blocks</CardTitle>
            </CardHeader>
            <CardContent>
              {blocksLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                      <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {latestBlocks?.blocks.map((block) => (
                    <div key={block.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">Block #{block.blockNumber}</Badge>
                          <span className="text-sm text-slate-400">
                            {new Date(block.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {block.transactionCount} txns
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Hash:</span>
                          <div className="text-white font-mono">
                            {formatHash(block.blockHash)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Miner:</span>
                          <div className="text-white font-mono">
                            {formatHash(block.minerAddress)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Gas Used:</span>
                          <div className="text-white">
                            {formatNumber(block.gasUsed)} / {formatNumber(block.gasLimit)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Latest Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                      <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {latestTransactions?.transactions.map((tx) => (
                    <div key={tx.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge variant={tx.status === 1 ? "default" : "destructive"}>
                            {tx.status === 1 ? 'Success' : 'Failed'}
                          </Badge>
                          <span className="text-sm text-slate-400">
                            Block #{tx.blockNumber}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Hash:</span>
                          <div className="text-white font-mono">
                            {formatHash(tx.txHash)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">From:</span>
                          <div className="text-white font-mono">
                            {formatHash(tx.fromAddress)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Value:</span>
                          <div className="text-white">
                            {formatValue(tx.value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Smart Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contracts?.contracts.map((contract) => (
                  <div key={contract.id} className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{contract.contractType}</Badge>
                        <span className="text-white font-medium">
                          {contract.contractName}
                        </span>
                        <Badge variant={contract.verificationStatus === 'verified' ? "default" : "secondary"}>
                          {contract.verificationStatus}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Address:</span>
                        <div className="text-white font-mono">
                          {formatHash(contract.contractAddress)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Creator:</span>
                        <div className="text-white font-mono">
                          {formatHash(contract.creatorAddress)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function VQCScanExplorer() {
  return (
    <ErrorBoundary>
      <VQCScanExplorerContent />
    </ErrorBoundary>
  );
}
