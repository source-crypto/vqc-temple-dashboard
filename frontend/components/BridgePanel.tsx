import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowRightLeft, Clock, Loader2, Key } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { BridgeTransfer } from '~backend/blockchain/bridge';

export default function BridgePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = 'demo-user-123'; // In a real app, this would come from auth
  const signerAddress = 'signer-address-1'; // Mock signer address

  const [fromNetwork, setFromNetwork] = useState('VQC Mainnet');
  const [toNetwork, setToNetwork] = useState('Ethereum');
  const [amount, setAmount] = useState('');

  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ['bridge-transfers', userId],
    queryFn: () => backend.blockchain.getUserBridgeTransfers({ userId }),
    refetchInterval: 5000,
  });

  const initiateTransferMutation = useMutation({
    mutationFn: async (data: {
      fromNetwork: string;
      toNetwork: string;
      amount: string;
    }) => {
      return await backend.blockchain.initiateBridgeTransfer({
        userId,
        fromNetwork: data.fromNetwork,
        toNetwork: data.toNetwork,
        tokenAddress: 'ASM_CONTRACT_ADDRESS', // Assuming ASM token
        amount: data.amount,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Transfer Initiated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['bridge-transfers', userId] });
      setAmount('');
    },
    onError: (err) => {
      console.error('Bridge transfer failed:', err);
      toast({
        title: "Transfer Failed",
        description: "Could not initiate bridge transfer.",
        variant: "destructive",
      });
    },
  });

  const signTransferMutation = useMutation({
    mutationFn: async (transferId: number) => {
      // In a real app, this would involve a cryptographic signature
      const mockSignature = `sig_${Date.now()}`;
      return await backend.blockchain.signBridgeTransfer({
        transferId,
        signature: mockSignature,
        signerAddress,
      });
    },
    onSuccess: () => {
      toast({ title: "Transaction Signed" });
      queryClient.invalidateQueries({ queryKey: ['bridge-transfers', userId] });
    },
    onError: (err) => {
      console.error('Failed to sign transfer:', err);
      toast({ title: "Signing Failed", variant: "destructive" });
    },
  });

  const handleInitiateTransfer = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    initiateTransferMutation.mutate({
      fromNetwork,
      toNetwork,
      amount: (parseFloat(amount) * 1e18).toString(),
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-600',
      confirmed: 'bg-blue-600',
      completed: 'bg-green-600',
      failed: 'bg-red-600',
    };
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-600'}>{status}</Badge>;
  };

  const formatAmount = (value: string) => {
    return (parseFloat(value) / 1e18).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <ArrowRightLeft className="w-5 h-5 mr-2" />
            Cross-Chain Bridge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-slate-300">From</Label>
              <Select value={fromNetwork} onValueChange={setFromNetwork}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VQC Mainnet">VQC Mainnet</SelectItem>
                  <SelectItem value="Ethereum">Ethereum</SelectItem>
                  <SelectItem value="Binance Smart Chain">Binance Smart Chain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">To</Label>
              <Select value={toNetwork} onValueChange={setToNetwork}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ethereum">Ethereum</SelectItem>
                  <SelectItem value="VQC Mainnet">VQC Mainnet</SelectItem>
                  <SelectItem value="Polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Amount (ASM)</Label>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          <Button
            onClick={handleInitiateTransfer}
            disabled={initiateTransferMutation.isPending}
            className="w-full"
          >
            {initiateTransferMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {initiateTransferMutation.isPending ? 'Initiating...' : 'Initiate Transfer'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {transfersLoading ? (
            <div className="text-center text-slate-400 py-8">Loading transfers...</div>
          ) : transfersData?.transfers.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No recent bridge transfers found.
            </div>
          ) : (
            <div className="space-y-4">
              {transfersData?.transfers.map((transfer: BridgeTransfer) => (
                <div key={transfer.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-white">
                        {transfer.fromNetwork} → {transfer.toNetwork}
                      </div>
                      <div className="text-sm text-slate-300">
                        {formatAmount(transfer.amount)} ASM
                      </div>
                    </div>
                    {getStatusBadge(transfer.status)}
                  </div>
                  
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>TX Hash: <span className="font-mono text-slate-300">{transfer.initiationTxHash.substring(0, 16)}...</span></div>
                    <div>Created: {new Date(transfer.createdAt).toLocaleString()}</div>
                    {transfer.unlockTime && (
                      <div className="flex items-center text-yellow-400">
                        <Clock className="w-3 h-3 mr-1" />
                        Time-locked until: {new Date(transfer.unlockTime).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {transfer.multiSig && (
                    <div className="mt-3">
                      <div className="text-sm text-slate-300 mb-1">Multi-Signature Approval</div>
                      <Progress value={(transfer.multiSig.currentSignatures / transfer.multiSig.requiredSignatures) * 100} />
                      <div className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>{transfer.multiSig.currentSignatures} / {transfer.multiSig.requiredSignatures} signatures</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => signTransferMutation.mutate(transfer.id)}
                          disabled={signTransferMutation.isPending}
                        >
                          <Key className="w-3 h-3 mr-1" />
                          Sign
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
