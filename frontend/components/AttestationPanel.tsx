import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle, XCircle, Clock, ExternalLink, UploadCloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function AttestationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tpmQuote, setTpmQuote] = useState('');
  const [signature, setSignature] = useState('');

  const { data: attestations, isLoading } = useQuery({
    queryKey: ['attestations'],
    queryFn: async () => {
      try {
        return await backend.temple.listAttestations();
      } catch (err) {
        console.error('Failed to fetch attestations:', err);
        toast({
          title: "Error",
          description: "Failed to fetch attestations",
          variant: "destructive",
        });
        throw err;
      }
    },
  });

  const createAttestationMutation = useMutation({
    mutationFn: async (data: { tpmQuote: string; signature: string }) => {
      const pcrValues = {
        pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
        pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
        pcr2: "c3d4e5f6789012345678901234567890abcdef12",
        pcr3: "d4e5f6789012345678901234567890abcdef123",
        pcr4: "e5f6789012345678901234567890abcdef1234",
        pcr5: "f6789012345678901234567890abcdef12345",
        pcr6: "789012345678901234567890abcdef123456",
        pcr7: "89012345678901234567890abcdef1234567",
      };
      
      return await backend.temple.createAttestation({
        pcrValues,
        tpmQuote: data.tpmQuote,
        signature: data.signature,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attestations'] });
      setTpmQuote('');
      setSignature('');
      toast({
        title: "Success",
        description: "Attestation record created successfully",
      });
    },
    onError: (err) => {
      console.error('Failed to create attestation:', err);
      toast({
        title: "Error",
        description: "Failed to create attestation record",
        variant: "destructive",
      });
    },
  });

  const verifyAttestationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await backend.temple.verifyAttestation({ id });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attestations'] });
      toast({
        title: data.verified ? "Verification Successful" : "Verification Failed",
        description: data.verified 
          ? "Attestation verified against canonical values"
          : "Attestation failed verification",
        variant: data.verified ? "default" : "destructive",
      });
    },
    onError: (err) => {
      console.error('Failed to verify attestation:', err);
      toast({
        title: "Error",
        description: "Failed to verify attestation",
        variant: "destructive",
      });
    },
  });

  const publishAttestationMutation = useMutation({
    mutationFn: async (attestationId: number) => {
      return await backend.temple.publishAttestation({ attestationId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attestations'] });
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

  const handleCreateAttestation = () => {
    if (!tpmQuote.trim() || !signature.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both TPM quote and signature",
        variant: "destructive",
      });
      return;
    }

    createAttestationMutation.mutate({
      tpmQuote: tpmQuote.trim(),
      signature: signature.trim(),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Attestation */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Create TPM Attestation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tmp-quote" className="text-slate-300">TPM Quote</Label>
            <Textarea
              id="tmp-quote"
              placeholder="Enter TPM quote data..."
              value={tpmQuote}
              onChange={(e) => setTpmQuote(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="signature" className="text-slate-300">Signature</Label>
            <Textarea
              id="signature"
              placeholder="Enter cryptographic signature..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
              rows={3}
            />
          </div>
          <Button 
            onClick={handleCreateAttestation}
            disabled={createAttestationMutation.isPending}
            className="w-full"
          >
            {createAttestationMutation.isPending ? 'Creating...' : 'Create Attestation'}
          </Button>
        </CardContent>
      </Card>

      {/* Attestation Records */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Attestation Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : attestations?.records.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No attestation records found.
            </div>
          ) : (
            <div className="space-y-4">
              {attestations?.records.map((record) => (
                <div key={record.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-white">
                        Attestation #{record.id}
                      </span>
                      {getStatusBadge(record.verificationStatus)}
                      {record.blockchainTxHash && (
                        <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          On-Chain
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {record.verificationStatus === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => verifyAttestationMutation.mutate(record.id)}
                          disabled={verifyAttestationMutation.isPending}
                        >
                          Verify
                        </Button>
                      )}
                      {record.verificationStatus === 'verified' && !record.blockchainTxHash && (
                        <Button
                          size="sm"
                          onClick={() => publishAttestationMutation.mutate(record.id)}
                          disabled={publishAttestationMutation.isPending}
                        >
                          <UploadCloud className="w-3 h-3 mr-1" />
                          Publish
                        </Button>
                      )}
                      {record.blockchainTxHash && (
                        <a href={`https://vqcscan.io/tx/${record.blockchainTxHash}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View on Chain
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Timestamp:</span>
                      <div className="text-white">
                        {new Date(record.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Canonical Hash:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {record.canonicalHash}
                      </div>
                    </div>
                    {record.blockchainTxHash && (
                      <div className="md:col-span-2">
                        <span className="text-slate-400">Blockchain TX Hash:</span>
                        <div className="text-cyan-400 font-mono text-xs break-all">
                          {record.blockchainTxHash}
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <span className="text-slate-400">TPM Quote:</span>
                      <div className="text-white font-mono text-xs break-all bg-slate-800 p-2 rounded mt-1">
                        {record.tpmQuote}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Published Attestation Records Summary */}
      {attestations?.records.filter(r => r.blockchainTxHash).length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Published Attestation Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attestations?.records
                .filter(record => record.blockchainTxHash)
                .map((record) => (
                  <div key={record.id} className="p-3 bg-slate-700 rounded-lg border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">
                        Attestation #{record.id}
                      </span>
                      <Badge variant="default" className="bg-cyan-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Published
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400">TX Hash:</span>
                      <div className="text-cyan-400 font-mono break-all">
                        {record.blockchainTxHash?.substring(0, 16)}...
                      </div>
                    </div>
                    <div className="mt-2">
                      <a href={`https://vqcscan.io/tx/${record.blockchainTxHash}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="w-full">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View on Explorer
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
