import { useState, useEffect } from 'react';
import backend from '~backend/client';
import type { ProtocolStatus, MasterActivationResponse } from '~backend/blockchain/activation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Zap, Activity, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ActivationDashboard() {
  const [protocols, setProtocols] = useState<ProtocolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activationLogs, setActivationLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const loadProtocolStatus = async () => {
    try {
      const response = await backend.blockchain.getProtocolStatus({});
      setProtocols(response.protocols);
    } catch (error) {
      console.error('Failed to load protocol status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load protocol status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProtocolStatus();
  }, []);

  const handleMasterActivation = async () => {
    setActivating(true);
    setActivationLogs([]);
    
    try {
      const response = await backend.blockchain.masterActivation({ forceReactivation: false });
      
      setActivationLogs(response.logs);
      setProtocols(response.protocols);

      toast({
        title: 'Activation Complete',
        description: `Successfully activated ${response.activatedEntities}/${response.totalEntities} entities across ${response.activatedProtocols} protocols`,
      });
    } catch (error) {
      console.error('Master activation failed:', error);
      toast({
        title: 'Activation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setActivating(false);
    }
  };

  const handleProtocolActivation = async (protocolName: string) => {
    setActivating(true);
    
    try {
      const response = await backend.blockchain.activateProtocol({ protocolName });
      
      toast({
        title: 'Protocol Activated',
        description: `Activated ${response.activatedCount} entities in ${protocolName}`,
      });

      await loadProtocolStatus();
    } catch (error) {
      console.error('Protocol activation failed:', error);
      toast({
        title: 'Activation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalEntities = protocols.reduce((sum, p) => sum + p.totalEntities, 0);
  const activatedEntities = protocols.reduce((sum, p) => sum + p.activatedEntities, 0);
  const overallPercentage = totalEntities > 0 ? (activatedEntities / totalEntities) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Protocol Activation System</h2>
          <p className="text-muted-foreground">Master control for all protocol factabilities</p>
        </div>
        
        <Button 
          onClick={handleMasterActivation} 
          disabled={activating}
          size="lg"
          className="gap-2"
        >
          {activating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Master Activation
            </>
          )}
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Protocols</p>
              <p className="text-2xl font-bold">{protocols.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entities</p>
              <p className="text-2xl font-bold">{totalEntities}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activated</p>
              <p className="text-2xl font-bold text-green-600">{activatedEntities}</p>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Activation Progress</span>
              <span className="font-medium">{overallPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={overallPercentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {protocols.map((protocol) => (
          <Card key={protocol.protocolName} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {protocol.protocolName}
                  </CardTitle>
                  <CardDescription>
                    {protocol.metadata?.description || 'Protocol system'}
                  </CardDescription>
                </div>
                
                <Badge variant={protocol.isActive ? 'default' : 'secondary'}>
                  {protocol.isActive ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {protocol.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold">{protocol.totalEntities}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Activated</p>
                  <p className="font-semibold text-green-600">{protocol.activatedEntities}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{protocol.activationPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={protocol.activationPercentage} className="h-2" />
              </div>

              {protocol.lastActivation && (
                <p className="text-xs text-muted-foreground">
                  Last: {new Date(protocol.lastActivation).toLocaleString()}
                </p>
              )}

              <Button
                onClick={() => handleProtocolActivation(protocol.protocolName)}
                disabled={activating}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Activate Protocol
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {activationLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activation Logs</CardTitle>
            <CardDescription>Real-time activation status and results</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full rounded-md border p-4 font-mono text-sm">
              {activationLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
