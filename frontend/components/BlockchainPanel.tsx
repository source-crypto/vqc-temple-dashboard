import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link, ExternalLink, CheckCircle, Clock, Network } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function BlockchainPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [attestationId, setAttestationId] = useState('');
  const [verifyTxHash, setVerifyTxHash] = useState('');

  const { data: blockchainStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['blockchain-status'],
    queryFn: async () => {
      try {
        return await backend.temple.getBlockchainStatus();
      } catch (err) {
        console.error('Failed to fetch blockchain status:', err);
        toast({
          title: "Error",
          description: "Failed to fetch blockchain status",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: attestations } = useQuery({
    queryKey: ['attestations-for-blockchain'],
    queryFn: async () => {
      try {
        return await backend.temple.listAttestations();
      } catch (err) {
        console.error('Failed to fetch attestations:', err);
        return { records: [] };
      }
    },
  });

  const publishAttestationMutation = useMutation({
    mutationFn: async (attestationId: number) => {
      return await backend.temple.publishAttestation({ attestationId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blockchain-status'] });
      queryClient.invalidateQueries({ queryKey: ['attestations-for-blockchain'] });
      setAttestationId('');
      toast({
        title: "Success",
        description: `Attestation published to blockchain. TX: ${data.txHash.substring(0, 16)}...`,
      });
    },
    onError: (err) => {
      console.error('Failed to publish attestation:', err);
      toast({
        title: "Error",
        description: "Failed to publish attestation to blockchain",
        variant: "destructive",
      });
    },
  });

  const verifyBlockchainMutation = useMutation({
    mutationFn: async (txHash: string) => {
      return await backend.temple.verifyBlockchainRecord({ txHash });
    },
    onSuccess: (data) => {
      toast({
        title: data.valid ? "Verification Successful" : "Verification Failed",
        description: data.valid 
          ? `Transaction verified with ${data.confirmations} confirmations`
          : "Transaction could not be verified",
        variant: data.valid ? "default" : "destructive",
      });
    },
    onError: (err) => {
      console.error('Failed to verify blockchain record:', err);
      toast({
        title: "Error",
        description: "Failed to verify blockchain record",
        variant: "destructive",
      });
    },
  });

  const handlePublishAttestation = () => {
    const id = parseInt(attestationId);
    if (isNaN(id)) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid attestation ID",
        variant: "destructive",
      });
      return;
    }

    publishAttestationMutation.mutate(id);
  };

  const handleVerifyTransaction = () => {
    if (!verifyTxHash.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a transaction hash",
        variant: "destructive",
      });
      return;
    }

    verifyBlockchainMutation.mutate(verifyTxHash.trim());
  };

  const verifiedAttestations = attestations?.records.filter(a => a.verificationStatus === 'verified') || [];
  const publishedAttestations = attestations?.records.filter(a => a.blockchainTxHash) || [];

  return (
    <div className="space-y-6">
      {/* Blockchain Status */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Network className="w-5 h-5 mr-2" />
            Blockchain Network Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-600 rounded w-1/4"></div>
              <div className="h-4 bg-slate-600 rounded w-1/2"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-400">Connection Status</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant={blockchainStatus?.connected ? "default" : "destructive"}>
                    {blockchainStatus?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Network ID</div>
                <div className="text-white font-mono">
                  {blockchainStatus?.networkId || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Latest Block</div>
                <div className="text-white">
                  #{blockchainStatus?.latestBlock?.toLocaleString() || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Published Records</div>
                <div className="text-white">
                  {blockchainStatus?.publishedRecords || 0}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish Attestation */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Link className="w-5 h-5 mr-2" />
            Publish Attestation to Blockchain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="attestation-id" className="text-slate-300">Attestation ID</Label>
            <Input
              id="attestation-id"
              type="number"
              placeholder="Enter attestation ID to publish..."
              value={attestationId}
              onChange={(e) => setAttestationId(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
            />
          </div>
          
          <Button 
            onClick={handlePublishAttestation}
            disabled={publishAttestationMutation.isPending}
            className="w-full"
          >
            {publishAttestationMutation.isPending ? 'Publishing...' : 'Publish to Blockchain'}
          </Button>
          
          {verifiedAttestations.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-slate-400 mb-2">Verified Attestations Available:</div>
              <div className="space-y-2">
                {verifiedAttestations.slice(0, 5).map((attestation) => (
                  <div key={attestation.id} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                    <div className="text-sm text-white">
                      Attestation #{attestation.id}
                    </div>
                    <div className="flex items-center space-x-2">
                      {attestation.blockchainTxHash ? (
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setAttestationId(attestation.id.toString())}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify Blockchain Record */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Verify Blockchain Record
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tx-hash" className="text-slate-300">Transaction Hash</Label>
            <Input
              id="tx-hash"
              placeholder="Enter transaction hash to verify..."
              value={verifyTxHash}
              onChange={(e) => setVerifyTxHash(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
            />
          </div>
          
          <Button 
            onClick={handleVerifyTransaction}
            disabled={verifyBlockchainMutation.isPending}
            className="w-full"
          >
            {verifyBlockchainMutation.isPending ? 'Verifying...' : 'Verify Transaction'}
          </Button>
        </CardContent>
      </Card>

      {/* Published Records */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Published Attestation Records</CardTitle>
        </CardHeader>
        <CardContent>
          {publishedAttestations.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No attestations have been published to the blockchain yet.
            </div>
          ) : (
            <div className="space-y-4">
              {publishedAttestations.map((record) => (
                <div key={record.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-white">
                        Attestation #{record.id}
                      </span>
                      <Badge variant="default">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Published
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Transaction Hash:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {record.blockchainTxHash}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Canonical Hash:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {record.canonicalHash}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center space-x-2">
                    <a href={`https://vqcscan.io/tx/${record.blockchainTxHash}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View on Explorer
                      </Button>
                    </a>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setVerifyTxHash(record.blockchainTxHash || '')}
                    >
                      Verify
                    </Button>
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
