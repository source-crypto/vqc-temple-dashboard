import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, Droplets, TrendingUp, Coins, Plus, Minus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

function AMMPanelContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = 'demo-user-123';

  // Swap state
  const [tokenIn, setTokenIn] = useState('USD');
  const [tokenOut, setTokenOut] = useState('ASM');
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  // Liquidity state
  const [liquidityTokenA, setLiquidityTokenA] = useState('ASM');
  const [liquidityTokenB, setLiquidityTokenB] = useState('USD');
  const [liquidityAmountA, setLiquidityAmountA] = useState('');
  const [liquidityAmountB, setLiquidityAmountB] = useState('');

  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: ['amm-pools'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getLiquidityPools();
      } catch (err) {
        console.error('Failed to fetch liquidity pools:', err);
        return { pools: [] };
      }
    },
    refetchInterval: 10000,
  });

  const { data: userPositions } = useQuery({
    queryKey: ['user-liquidity-positions', userId],
    queryFn: async () => {
      try {
        return await backend.blockchain.getUserLiquidityPositions({ userId });
      } catch (err) {
        console.error('Failed to fetch user positions:', err);
        return { positions: [] };
      }
    },
  });

  const { data: yieldFarms } = useQuery({
    queryKey: ['yield-farms'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getYieldFarms();
      } catch (err) {
        console.error('Failed to fetch yield farms:', err);
        return { farms: [] };
      }
    },
  });

  const { data: swapQuote } = useQuery({
    queryKey: ['swap-quote', tokenIn, tokenOut, amountIn],
    queryFn: async () => {
      if (!amountIn || parseFloat(amountIn) <= 0) return null;
      try {
        const amountInWei = (parseFloat(amountIn) * 1e18).toString();
        return await backend.blockchain.getSwapQuote({
          tokenIn,
          tokenOut,
          amountIn: amountInWei
        });
      } catch (err) {
        console.error('Failed to get swap quote:', err);
        return null;
      }
    },
    enabled: !!amountIn && parseFloat(amountIn) > 0,
  });

  const swapMutation = useMutation({
    mutationFn: async (data: {
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      minimumAmountOut: string;
    }) => {
      return await backend.blockchain.executeSwap({
        userId,
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        amountIn: data.amountIn,
        minimumAmountOut: data.minimumAmountOut,
        slippageTolerance: parseFloat(slippage)
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['amm-pools'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      setAmountIn('');
      toast({
        title: "Swap Successful",
        description: `Swapped ${tokenIn} for ${(parseFloat(data.amountOut) / 1e18).toFixed(6)} ${tokenOut}`,
      });
    },
    onError: (err) => {
      console.error('Swap failed:', err);
      toast({
        title: "Swap Failed",
        description: "Failed to execute token swap",
        variant: "destructive",
      });
    },
  });

  const addLiquidityMutation = useMutation({
    mutationFn: async (data: {
      tokenA: string;
      tokenB: string;
      amountA: string;
      amountB: string;
    }) => {
      return await backend.blockchain.addLiquidity({
        userId,
        tokenA: data.tokenA,
        tokenB: data.tokenB,
        amountA: data.amountA,
        amountB: data.amountB,
        slippageTolerance: parseFloat(slippage)
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['amm-pools'] });
      queryClient.invalidateQueries({ queryKey: ['user-liquidity-positions'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      setLiquidityAmountA('');
      setLiquidityAmountB('');
      toast({
        title: "Liquidity Added",
        description: `Added liquidity and received ${(parseFloat(data.liquidityTokens) / 1e18).toFixed(6)} LP tokens`,
      });
    },
    onError: (err) => {
      console.error('Add liquidity failed:', err);
      toast({
        title: "Add Liquidity Failed",
        description: "Failed to add liquidity to pool",
        variant: "destructive",
      });
    },
  });

  const handleSwap = () => {
    if (!amountIn || !swapQuote) {
      toast({
        title: "Invalid Swap",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const amountInWei = (parseFloat(amountIn) * 1e18).toString();
    const minimumAmountOut = swapQuote.minimumOutput;

    swapMutation.mutate({
      tokenIn,
      tokenOut,
      amountIn: amountInWei,
      minimumAmountOut
    });
  };

  const handleAddLiquidity = () => {
    if (!liquidityAmountA || !liquidityAmountB) {
      toast({
        title: "Invalid Amounts",
        description: "Please enter valid amounts for both tokens",
        variant: "destructive",
      });
      return;
    }

    const amountAWei = (parseFloat(liquidityAmountA) * 1e18).toString();
    const amountBWei = (parseFloat(liquidityAmountB) * 1e18).toString();

    addLiquidityMutation.mutate({
      tokenA: liquidityTokenA,
      tokenB: liquidityTokenB,
      amountA: amountAWei,
      amountB: amountBWei
    });
  };

  const handleTokenSwitch = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
  };

  const formatTokenAmount = (amount: string, decimals: number = 6) => {
    return (parseFloat(amount) / 1e18).toFixed(decimals);
  };

  const calculateAPY = (pool: any) => {
    // Simplified APY calculation based on trading volume and fees
    const dailyVolume = parseFloat(pool.reserveA) * 0.1; // Assume 10% daily volume
    const dailyFees = dailyVolume * pool.feeRate;
    const totalLiquidity = parseFloat(pool.totalLiquidity);
    const dailyReturn = dailyFees / totalLiquidity;
    const apy = (Math.pow(1 + dailyReturn, 365) - 1) * 100;
    return Math.min(apy, 1000); // Cap at 1000% APY
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="swap" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
          <TabsTrigger value="swap">Swap</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          <TabsTrigger value="pools">Pools</TabsTrigger>
          <TabsTrigger value="farms">Yield Farms</TabsTrigger>
        </TabsList>

        <TabsContent value="swap">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Token Swap
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">From</Label>
                  <div className="flex space-x-2 mt-1">
                    <Select value={tokenIn} onValueChange={setTokenIn}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ASM">ASM</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={amountIn}
                      onChange={(e) => setAmountIn(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white flex-1"
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleTokenSwitch}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <Label className="text-slate-300">To</Label>
                  <div className="flex space-x-2 mt-1">
                    <Select value={tokenOut} onValueChange={setTokenOut}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ASM">ASM</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      placeholder="0.0"
                      value={swapQuote ? formatTokenAmount(swapQuote.outputAmount) : ''}
                      readOnly
                      className="bg-slate-700 border-slate-600 text-white flex-1"
                    />
                  </div>
                </div>

                {swapQuote && (
                  <div className="p-3 bg-slate-700 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price Impact:</span>
                      <span className={swapQuote.priceImpact > 5 ? 'text-red-400' : 'text-green-400'}>
                        {swapQuote.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fee:</span>
                      <span className="text-white">
                        {formatTokenAmount(swapQuote.fee)} {tokenIn}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Minimum Received:</span>
                      <span className="text-white">
                        {formatTokenAmount(swapQuote.minimumOutput)} {tokenOut}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-slate-300">Slippage Tolerance</Label>
                  <Select value={slippage} onValueChange={setSlippage}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="0.1">0.1%</SelectItem>
                      <SelectItem value="0.5">0.5%</SelectItem>
                      <SelectItem value="1.0">1.0%</SelectItem>
                      <SelectItem value="3.0">3.0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSwap}
                  disabled={swapMutation.isPending || !swapQuote}
                  className="w-full"
                >
                  {swapMutation.isPending ? 'Swapping...' : 'Swap Tokens'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Available Pools</CardTitle>
              </CardHeader>
              <CardContent>
                {poolsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-3 bg-slate-700 rounded animate-pulse">
                        <div className="h-4 bg-slate-600 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pools?.pools.slice(0, 5).map((pool) => (
                      <div key={pool.id} className="p-3 bg-slate-700 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">
                            {pool.tokenA}/{pool.tokenB}
                          </span>
                          <Badge variant="outline">
                            {(pool.feeRate * 100).toFixed(1)}% Fee
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">TVL:</span>
                            <div className="text-white">
                              ${((parseFloat(pool.reserveA) + parseFloat(pool.reserveB)) / 1e18 * 12.5).toFixed(0)}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">APY:</span>
                            <div className="text-green-400">
                              {calculateAPY(pool).toFixed(1)}%
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
        </TabsContent>

        <TabsContent value="liquidity">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Liquidity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Token A</Label>
                    <Select value={liquidityTokenA} onValueChange={setLiquidityTokenA}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="ASM">ASM</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={liquidityAmountA}
                      onChange={(e) => setLiquidityAmountA(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Token B</Label>
                    <Select value={liquidityTokenB} onValueChange={setLiquidityTokenB}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ASM">ASM</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={liquidityAmountB}
                      onChange={(e) => setLiquidityAmountB(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-2"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleAddLiquidity}
                  disabled={addLiquidityMutation.isPending}
                  className="w-full"
                >
                  {addLiquidityMutation.isPending ? 'Adding...' : 'Add Liquidity'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Your Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {userPositions?.positions.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    No liquidity positions found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userPositions?.positions.map((position) => (
                      <div key={position.id} className="p-3 bg-slate-700 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">
                            Pool #{position.poolId}
                          </span>
                          <Badge variant="outline">
                            {position.sharePercentage.toFixed(2)}% Share
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">LP Tokens:</span>
                            <span className="text-white">
                              {formatTokenAmount(position.liquidityTokens)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pools">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Droplets className="w-5 h-5 mr-2" />
                Liquidity Pools
              </CardTitle>
            </CardHeader>
            <CardContent>
              {poolsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                      <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {pools?.pools.map((pool) => (
                    <div key={pool.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-white font-medium text-lg">
                            {pool.tokenA}/{pool.tokenB}
                          </span>
                          <Badge variant="outline">
                            {(pool.feeRate * 100).toFixed(1)}% Fee
                          </Badge>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {calculateAPY(pool).toFixed(1)}% APY
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Total Value Locked:</span>
                          <div className="text-white font-bold">
                            ${((parseFloat(pool.reserveA) + parseFloat(pool.reserveB)) / 1e18 * 12.5).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">{pool.tokenA} Reserve:</span>
                          <div className="text-white">
                            {formatTokenAmount(pool.reserveA, 2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">{pool.tokenB} Reserve:</span>
                          <div className="text-white">
                            {formatTokenAmount(pool.reserveB, 2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="text-xs text-slate-400 mb-1">Liquidity Distribution</div>
                        <Progress 
                          value={(parseFloat(pool.reserveA) / (parseFloat(pool.reserveA) + parseFloat(pool.reserveB))) * 100} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>{pool.tokenA}</span>
                          <span>{pool.tokenB}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="farms">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Yield Farms
              </CardTitle>
            </CardHeader>
            <CardContent>
              {yieldFarms?.farms.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  No yield farms available.
                </div>
              ) : (
                <div className="space-y-4">
                  {yieldFarms?.farms.map((farm) => (
                    <div key={farm.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-white font-medium">
                            Farm #{farm.id}
                          </span>
                          <Badge variant="outline">
                            Pool #{farm.poolId}
                          </Badge>
                        </div>
                        <Badge variant={farm.isActive ? "default" : "secondary"}>
                          {farm.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Reward Token:</span>
                          <div className="text-white font-bold">
                            {farm.rewardToken}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Reward Rate:</span>
                          <div className="text-green-400">
                            {formatTokenAmount(farm.rewardRate)} / sec
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Total Staked:</span>
                          <div className="text-white">
                            {formatTokenAmount(farm.totalStaked)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div>
                          <span className="text-slate-400">Start Time:</span>
                          <div className="text-white">
                            {new Date(farm.startTime).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">End Time:</span>
                          <div className="text-white">
                            {new Date(farm.endTime).toLocaleDateString()}
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
      </Tabs>
    </div>
  );
}

export default function AMMPanel() {
  return (
    <ErrorBoundary>
      <AMMPanelContent />
    </ErrorBoundary>
  );
}
