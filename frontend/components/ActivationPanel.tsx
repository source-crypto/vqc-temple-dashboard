import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Key, Shield, Users, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function ActivationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create token form state
  const [yubikeySerial, setYubikeySerial] = useState('');
  const [shamirShares, setShamirShares] = useState('');
  const [threshold, setThreshold] = useState('');
  const [expirationHours, setExpirationHours] = useState('24');
  
  // Activate token form state
  const [tokenId, setTokenId] = useState('');
  const [yubikeyOTP, setYubikeyOTP] = useState('');
  const [activationShares, setActivationShares] = useState('');

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['activation-tokens'],
    queryFn: async () => {
      try {
        return await backend.temple.listActivationTokens();
      } catch (err) {
        console.error('Failed to fetch activation tokens:', err);
        toast({
          title: "Error",
          description: "Failed to fetch activation tokens",
          variant: "destructive",
        });
        throw err;
      }
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: async (data: {
      yubikeySerial: string;
      shamirShares?: string[];
      threshold?: number;
      expirationHours?: number;
    }) => {
      return await backend.temple.createActivationToken(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activation-tokens'] });
      setYubikeySerial('');
      setShamirShares('');
      setThreshold('');
      setExpirationHours('24');
      toast({
        title: "Success",
        description: "Activation token created successfully",
      });
    },
    onError: (err) => {
      console.error('Failed to create activation token:', err);
      toast({
        title: "Error",
        description: "Failed to create activation token",
        variant: "destructive",
      });
    },
  });

  const activateTokenMutation = useMutation({
    mutationFn: async (data: {
      tokenId: string;
      yubikeyOTP: string;
      shamirShares?: string[];
    }) => {
      return await backend.temple.activateToken(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activation-tokens'] });
      setTokenId('');
      setYubikeyOTP('');
      setActivationShares('');
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (err) => {
      console.error('Failed to activate token:', err);
      toast({
        title: "Error",
        description: "Failed to activate token",
        variant: "destructive",
      });
    },
  });

  const handleCreateToken = () => {
    if (!yubikeySerial.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide YubiKey serial number",
        variant: "destructive",
      });
      return;
    }

    const shares = shamirShares.trim() 
      ? shamirShares.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      : undefined;
    
    const thresholdNum = threshold.trim() ? parseInt(threshold) : undefined;
    const expirationNum = expirationHours.trim() ? parseInt(expirationHours) : undefined;

    if (shares && shares.length > 0 && (!thresholdNum || thresholdNum > shares.length)) {
      toast({
        title: "Validation Error",
        description: "Threshold must be less than or equal to number of shares",
        variant: "destructive",
      });
      return;
    }

    createTokenMutation.mutate({
      yubikeySerial: yubikeySerial.trim(),
      shamirShares: shares,
      threshold: thresholdNum,
      expirationHours: expirationNum,
    });
  };

  const handleActivateToken = () => {
    if (!tokenId.trim() || !yubikeyOTP.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide token ID and YubiKey OTP",
        variant: "destructive",
      });
      return;
    }

    const shares = activationShares.trim()
      ? activationShares.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      : undefined;

    activateTokenMutation.mutate({
      tokenId: tokenId.trim(),
      yubikeyOTP: yubikeyOTP.trim(),
      shamirShares: shares,
    });
  };

  const getTokenStatusBadge = (token: any) => {
    const now = new Date();
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
    
    if (!token.isActive) {
      return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
    }
    
    if (expiresAt && expiresAt < now) {
      return <Badge variant="destructive"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    }
    
    // Check if expiring soon (within 24 hours)
    if (expiresAt && (expiresAt.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) {
      return <Badge variant="secondary" className="bg-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" />Expiring Soon</Badge>;
    }
    
    return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Create Activation Token */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Create Activation Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="yubikey-serial" className="text-slate-300">YubiKey Serial Number</Label>
              <Input
                id="yubikey-serial"
                placeholder="Enter YubiKey serial..."
                value={yubikeySerial}
                onChange={(e) => setYubikeySerial(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="expiration" className="text-slate-300">Expiration (hours)</Label>
              <Input
                id="expiration"
                type="number"
                placeholder="24"
                value={expirationHours}
                onChange={(e) => setExpirationHours(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shamir-shares" className="text-slate-300">Shamir Shares (optional)</Label>
              <Textarea
                id="shamir-shares"
                placeholder="Enter one share per line..."
                value={shamirShares}
                onChange={(e) => setShamirShares(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="threshold" className="text-slate-300">Threshold</Label>
              <Input
                id="threshold"
                type="number"
                placeholder="Required shares..."
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCreateToken}
            disabled={createTokenMutation.isPending}
            className="w-full"
          >
            {createTokenMutation.isPending ? 'Creating...' : 'Create Activation Token'}
          </Button>
        </CardContent>
      </Card>

      {/* Activate Token */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Activate VQC Lifecycle Operation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="token-id" className="text-slate-300">Token ID</Label>
              <Input
                id="token-id"
                placeholder="Enter token ID..."
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="yubikey-otp" className="text-slate-300">YubiKey OTP</Label>
              <Input
                id="yubikey-otp"
                placeholder="Touch YubiKey to generate OTP..."
                value={yubikeyOTP}
                onChange={(e) => setYubikeyOTP(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="activation-shares" className="text-slate-300">Shamir Shares (if required)</Label>
            <Textarea
              id="activation-shares"
              placeholder="Enter required shares, one per line..."
              value={activationShares}
              onChange={(e) => setActivationShares(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
              rows={3}
            />
          </div>
          
          <Button 
            onClick={handleActivateToken}
            disabled={activateTokenMutation.isPending}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {activateTokenMutation.isPending ? 'Activating...' : 'Activate VQC Operation'}
          </Button>
        </CardContent>
      </Card>

      {/* Token List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Activation Tokens</CardTitle>
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
          ) : tokens?.tokens.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No activation tokens found.
            </div>
          ) : (
            <div className="space-y-4">
              {tokens?.tokens.map((token) => (
                <div key={token.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-white">
                        Token #{token.id}
                      </span>
                      {getTokenStatusBadge(token)}
                      {token.shamirShares && token.shamirShares.length > 0 && (
                        <Badge variant="outline" className="text-slate-300">
                          <Users className="w-3 h-3 mr-1" />
                          Multi-Custodian
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateShort(token.createdAt)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Token ID:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {token.tokenId}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">YubiKey Serial:</span>
                      <div className="text-white">
                        {token.yubikeySerial}
                      </div>
                    </div>
                    {token.threshold && token.shamirShares && (
                      <div>
                        <span className="text-slate-400">Threshold:</span>
                        <div className="text-white">
                          {token.threshold} of {token.shamirShares.length}
                        </div>
                      </div>
                    )}
                    {token.expiresAt && (
                      <div>
                        <span className="text-slate-400">Expires:</span>
                        <div className="text-white">
                          {formatDate(token.expiresAt)}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick activation for active tokens */}
                  {token.isActive && (!token.expiresAt || new Date(token.expiresAt) > new Date()) && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTokenId(token.tokenId)}
                        >
                          Select for Activation
                        </Button>
                        <span className="text-xs text-slate-400">
                          Click to auto-fill token ID above
                        </span>
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
