import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowUpDown, History, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function CurrencyExchangePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Demo user ID - in a real app this would come from authentication
  const userId = 'demo-user-123';
  
  // Buy tokens form state
  const [usdAmount, setUsdAmount] = useState('');
  const [estimatedTokens, setEstimatedTokens] = useState(0);

  // Sell tokens form state
  const [asmAmount, setAsmAmount] = useState('');
  const [estimatedUsd, setEstimatedUsd] = useState(0);

  const { data: exchangeRates, isLoading: ratesLoading } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getExchangeRates();
      } catch (err) {
        console.error('Failed to fetch exchange rates:', err);
        return { rates: [] };
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: userBalances, isLoading: balancesLoading, isError: balancesError } = useQuery({
    queryKey: ['user-balances', userId],
    queryFn: () => backend.blockchain.getUserBalances({ userId }),
    refetchInterval: 5000,
    onError: (err) => {
      console.error('Failed to fetch user balances:', err);
      toast({
        title: "Error",
        description: "Failed to fetch your wallet balances.",
        variant: "destructive",
      });
    }
  });

  const { data: transactionHistory } = useQuery({
    queryKey: ['transaction-history', userId],
    queryFn: async () => {
      try {
        return await backend.blockchain.getTransactionHistory({ userId });
      } catch (err) {
        console.error('Failed to fetch transaction history:', err);
        return { transactions: [] };
      }
    },
  });

  const createWalletMutation = useMutation({
    mutationFn: async () => {
      return await backend.blockchain.createWallet({ userId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-balances', userId] });
      toast({
        title: "Wallet Created",
        description: `New wallet created: ${data.wallet.address.substring(0, 16)}...`,
      });
    },
    onError: (err) => {
      console.error('Failed to create wallet:', err);
      toast({
        title: "Error",
        description: "Failed to create wallet",
        variant: "destructive",
      });
    },
  });

  const buyTokensMutation = useMutation({
    mutationFn: async (data: { usdAmount: number }) => {
      return await backend.blockchain.buyTokens({
        userId,
        usdAmount: data.usdAmount,
        targetCurrency: 'ASM'
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-balances', userId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-history', userId] });
      setUsdAmount('');
      setEstimatedTokens(0);
      toast({
        title: "Purchase Successful",
        description: `Bought ${data.estimatedTokens.toFixed(6)} ASM tokens`,
      });
    },
    onError: (err) => {
      console.error('Failed to buy tokens:', err);
      toast({
        title: "Purchase Failed",
        description: "Failed to complete token purchase",
        variant: "destructive",
      });
    },
  });

  const sellTokensMutation = useMutation({
    mutationFn: async (data: { asmAmount: number }) => {
      return await backend.blockchain.sellTokens({
        userId,
        asmAmount: data.asmAmount,
        targetCurrency: 'USD'
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-balances', userId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-history', userId] });
      setAsmAmount('');
      setEstimatedUsd(0);
      toast({
        title: "Sale Successful",
        description: `Sold ${data.transaction.fromAmount.toFixed(6)} ASM for $${data.estimatedUsd.toFixed(2)}`,
      });
    },
    onError: (err) => {
      console.error('Failed to sell tokens:', err);
      toast({
        title: "Sale Failed",
        description: "Failed to complete token sale",
        variant: "destructive",
      });
    },
  });

  const asmRate = exchangeRates?.rates.find(r => r.currencyPair === 'ASM/USD');

  const handleUsdAmountChange = (value: string) => {
    setUsdAmount(value);
    const amount = parseFloat(value);
    if (asmRate && !isNaN(amount) && amount > 0) {
      const feePercentage = 0.025; // 2.5% fee
      const netAmount = amount * (1 - feePercentage);
      const tokens = netAmount / asmRate.rate;
      setEstimatedTokens(tokens);
    } else {
      setEstimatedTokens(0);
    }
  };

  const handleAsmAmountChange = (value: string) => {
    setAsmAmount(value);
    const amount = parseFloat(value);
    if (asmRate && !isNaN(amount) && amount > 0) {
      const feePercentage = 0.025;
      const grossUsd = amount * asmRate.rate;
      const netUsd = grossUsd * (1 - feePercentage);
      setEstimatedUsd(netUsd);
    } else {
      setEstimatedUsd(0);
    }
  };

  const handleBuyTokens = () => {
    const amount = parseFloat(usdAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid USD amount",
        variant: "destructive",
      });
      return;
    }

    if (amount < 1) {
      toast({
        title: "Minimum Purchase",
        description: "Minimum purchase amount is $1.00",
        variant: "destructive",
      });
      return;
    }

    buyTokensMutation.mutate({ usdAmount: amount });
  };

  const handleSellTokens = () => {
    const amount = parseFloat(asmAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid ASM amount",
        variant: "destructive",
      });
      return;
    }

    sellTokensMutation.mutate({ asmAmount: amount });
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'USD') {
      return `$${amount.toFixed(2)}`;
    } else if (currency === 'ASM') {
      return `${amount.toFixed(6)} ASM`;
    } else {
      return `${amount.toFixed(8)} ${currency}`;
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    if (change < 0) return <TrendingDown className="w-3 h-3" />;
    return null;
  };

  const BalancesCard = () => (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Wallet className="w-5 h-5 mr-2" />
          Your Balances
        </CardTitle>
      </CardHeader>
      <CardContent>
        {balancesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-700 rounded animate-pulse">
                <div className="h-4 bg-slate-600 rounded w-1/4"></div>
                <div className="h-4 bg-slate-600 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : balancesError ? (
          <div className="text-center text-red-400 py-8">
            Could not load your balances.
          </div>
        ) : userBalances?.balances.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No wallet found. Create a wallet to start trading.
          </div>
        ) : (
          <div className="space-y-3">
            {userBalances?.balances.map((balance) => (
              <div key={balance.id} className="flex justify-between items-center p-3 bg-slate-700 rounded">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline">{balance.currency}</Badge>
                  <span className="text-white font-medium">
                    {balance.currency === 'USD' ? 'US Dollar' : 
                     balance.currency === 'ASM' ? 'Assimilator' : balance.currency}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">
                    {formatCurrency(balance.balance, balance.currency)}
                  </div>
                  {balance.lockedBalance > 0 && (
                    <div className="text-xs text-slate-400">
                      Locked: {formatCurrency(balance.lockedBalance, balance.currency)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Exchange Rates Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ratesLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-slate-600 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-600 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-slate-600 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))
        ) : (
          exchangeRates?.rates.map((rate) => (
            <Card key={rate.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  {rate.currencyPair}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">
                  ${rate.rate.toFixed(8)}
                </div>
                <div className={`flex items-center text-sm ${getChangeColor(rate.change24h)}`}>
                  {getChangeIcon(rate.change24h)}
                  <span className="ml-1">
                    {rate.change24h > 0 ? '+' : ''}{rate.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  24h Volume: ${rate.volume24h.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Main Exchange Interface */}
      <Tabs defaultValue="buy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
          <TabsTrigger value="buy">Buy ASM</TabsTrigger>
          <TabsTrigger value="sell">Sell ASM</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Buy ASM Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="usd-amount" className="text-slate-300">USD Amount</Label>
                  <Input
                    id="usd-amount"
                    type="number"
                    placeholder="Enter USD amount..."
                    value={usdAmount}
                    onChange={(e) => handleUsdAmountChange(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="1"
                    step="0.01"
                  />
                </div>

                {estimatedTokens > 0 && (
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-2">Estimated Purchase:</div>
                    <div className="text-lg font-bold text-white">
                      {estimatedTokens.toFixed(6)} ASM
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Fee: ${(parseFloat(usdAmount) * 0.025).toFixed(2)} (2.5%)
                    </div>
                    <div className="text-xs text-slate-400">
                      Rate: ${asmRate?.rate.toFixed(8)} per ASM
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleBuyTokens}
                  disabled={buyTokensMutation.isPending || !estimatedTokens}
                  className="w-full"
                >
                  {buyTokensMutation.isPending ? 'Processing...' : 'Buy ASM Tokens'}
                </Button>

                <div className="text-xs text-slate-400 text-center">
                  Minimum purchase: $1.00 • Maximum purchase: $10,000.00
                </div>
              </CardContent>
            </Card>
            <BalancesCard />
          </div>
        </TabsContent>

        <TabsContent value="sell">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Sell ASM Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="asm-amount" className="text-slate-300">ASM Amount</Label>
                  <Input
                    id="asm-amount"
                    type="number"
                    placeholder="Enter ASM amount to sell..."
                    value={asmAmount}
                    onChange={(e) => handleAsmAmountChange(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="0"
                  />
                </div>

                {estimatedUsd > 0 && (
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-2">Estimated Payout:</div>
                    <div className="text-lg font-bold text-white">
                      ${estimatedUsd.toFixed(2)} USD
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Fee: ${(parseFloat(asmAmount) * (asmRate?.rate || 0) * 0.025).toFixed(2)} (2.5%)
                    </div>
                    <div className="text-xs text-slate-400">
                      Rate: ${asmRate?.rate.toFixed(8)} per ASM
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSellTokens}
                  disabled={sellTokensMutation.isPending || !estimatedUsd}
                  className="w-full"
                >
                  {sellTokensMutation.isPending ? 'Processing...' : 'Sell ASM Tokens'}
                </Button>
              </CardContent>
            </Card>
            <BalancesCard />
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Wallet Management</CardTitle>
            </CardHeader>
            <CardContent>
              {!userBalances?.wallet ? (
                <div className="text-center py-8">
                  <div className="text-slate-400 mb-4">
                    You don't have a wallet yet. Create one to start trading ASM tokens.
                  </div>
                  <Button 
                    onClick={() => createWalletMutation.mutate()}
                    disabled={createWalletMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{createWalletMutation.isPending ? 'Creating...' : 'Create Wallet'}</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-2">Wallet Address:</div>
                    <div className="text-white font-mono break-all">
                      {userBalances.wallet.address}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Created: {new Date(userBalances.wallet.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userBalances.balances.map((balance) => (
                      <div key={balance.id} className="p-4 bg-slate-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{balance.currency}</Badge>
                          <div className="text-white font-bold">
                            {formatCurrency(balance.balance, balance.currency)}
                          </div>
                        </div>
                        <Progress 
                          value={balance.currency === 'ASM' ? Math.min((balance.balance / 1000000) * 100, 100) : 
                                 balance.currency === 'USD' ? Math.min((balance.balance / 10000) * 100, 100) : 50} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <History className="w-5 h-5 mr-2" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionHistory?.transactions.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  No transactions found.
                </div>
              ) : (
                <div className="space-y-4">
                  {transactionHistory?.transactions.map((tx) => (
                    <div key={tx.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge variant={tx.status === 'completed' ? "default" : 
                                        tx.status === 'pending' ? "secondary" : "destructive"}>
                            {tx.transactionType.toUpperCase()}
                          </Badge>
                          <span className="text-white">
                            {tx.fromCurrency} → {tx.toCurrency}
                          </span>
                        </div>
                        <Badge variant={tx.status === 'completed' ? "default" : 
                                      tx.status === 'pending' ? "secondary" : "destructive"}>
                          {tx.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Amount:</span>
                          <div className="text-white">
                            {formatCurrency(tx.fromAmount, tx.fromCurrency)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Received:</span>
                          <div className="text-white">
                            {formatCurrency(tx.toAmount, tx.toCurrency)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Fee:</span>
                          <div className="text-white">
                            ${tx.feeAmount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-400 mt-2">
                        {new Date(tx.createdAt).toLocaleString()}
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
