import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, FileText, Shapes, Zap, Gem } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function CeremonialPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [artifactType, setArtifactType] = useState<'poem' | 'geometry' | 'ritual'>('poem');
  const [entropySource, setEntropySource] = useState('');
  const userId = 'demo-user-123';

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['ceremonial-artifacts'],
    queryFn: async () => {
      try {
        return await backend.temple.listArtifacts();
      } catch (err) {
        console.error('Failed to fetch ceremonial artifacts:', err);
        toast({
          title: "Error",
          description: "Failed to fetch ceremonial artifacts",
          variant: "destructive",
        });
        throw err;
      }
    },
  });

  const generateArtifactMutation = useMutation({
    mutationFn: async (data: { artifactType: 'poem' | 'geometry' | 'ritual'; entropySource: string }) => {
      return await backend.temple.generateArtifact(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceremonial-artifacts'] });
      setEntropySource('');
      toast({
        title: "Success",
        description: "Ceremonial artifact generated successfully",
      });
    },
    onError: (err) => {
      console.error('Failed to generate artifact:', err);
      toast({
        title: "Error",
        description: "Failed to generate ceremonial artifact",
        variant: "destructive",
      });
    },
  });

  const mintNFTMutation = useMutation({
    mutationFn: async (artifactId: number) => {
      return await backend.temple.mintArtifactAsNFT({ artifactId, ownerId: userId });
    },
    onSuccess: (data) => {
      toast({
        title: "NFT Minted",
        description: `Artifact successfully minted as NFT. TX: ${data.txHash.substring(0, 12)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['ceremonial-artifacts'] });
      queryClient.invalidateQueries({ queryKey: ['user-nfts'] });
    },
    onError: (err) => {
      console.error('Failed to mint NFT:', err);
      toast({
        title: "Minting Failed",
        description: "Could not mint artifact as NFT.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateArtifact = () => {
    if (!entropySource.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide an entropy source",
        variant: "destructive",
      });
      return;
    }

    generateArtifactMutation.mutate({
      artifactType,
      entropySource: entropySource.trim(),
    });
  };

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'poem':
        return <FileText className="w-4 h-4" />;
      case 'geometry':
        return <Shapes className="w-4 h-4" />;
      case 'ritual':
        return <Zap className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getArtifactBadge = (type: string) => {
    const colors = {
      poem: 'bg-blue-600',
      geometry: 'bg-purple-600',
      ritual: 'bg-orange-600',
    };
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-600'}>
        {getArtifactIcon(type)}
        <span className="ml-1 capitalize">{type}</span>
      </Badge>
    );
  };

  const renderArtifactContent = (artifact: any) => {
    if (artifact.artifactType === 'geometry' || artifact.artifactType === 'ritual') {
      try {
        const parsed = JSON.parse(artifact.content);
        return (
          <div className="bg-slate-800 p-3 rounded text-xs font-mono">
            <pre className="text-cyan-400 whitespace-pre-wrap">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      } catch {
        return (
          <div className="bg-slate-800 p-3 rounded text-xs font-mono text-white">
            {artifact.content}
          </div>
        );
      }
    }
    
    return (
      <div className="bg-slate-800 p-3 rounded text-sm text-white whitespace-pre-wrap">
        {artifact.content}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Generate New Artifact */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            Generate Ceremonial Artifact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="artifact-type" className="text-slate-300">Artifact Type</Label>
            <Select value={artifactType} onValueChange={(value: 'poem' | 'geometry' | 'ritual') => setArtifactType(value)}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="poem">Quantum Poetry</SelectItem>
                <SelectItem value="geometry">Sacred Geometry</SelectItem>
                <SelectItem value="ritual">Ritual Elements</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="entropy-source" className="text-slate-300">Entropy Source</Label>
            <Textarea
              id="entropy-source"
              placeholder="Enter quantum entropy source data..."
              value={entropySource}
              onChange={(e) => setEntropySource(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
              rows={3}
            />
          </div>
          
          <Button 
            onClick={handleGenerateArtifact}
            disabled={generateArtifactMutation.isPending}
            className="w-full"
          >
            {generateArtifactMutation.isPending ? 'Generating...' : 'Generate Artifact'}
          </Button>
        </CardContent>
      </Card>

      {/* Artifact Gallery */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Ceremonial Artifact Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                  <div className="h-20 bg-slate-600 rounded mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : artifacts?.artifacts.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No ceremonial artifacts found. Generate your first artifact above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {artifacts?.artifacts.map((artifact) => (
                <div key={artifact.id} className="p-4 bg-slate-700 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-white">
                          Artifact #{artifact.id}
                        </span>
                        {getArtifactBadge(artifact.artifactType)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(artifact.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      {renderArtifactContent(artifact)}
                    </div>
                    
                    <div className="text-xs text-slate-400">
                      <div className="mb-1">
                        <span className="font-medium">Entropy Seed:</span> {artifact.entropySeed.substring(0, 16)}...
                      </div>
                      <div>
                        <span className="font-medium">Sealed:</span> {artifact.sealedData.substring(0, 32)}...
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => mintNFTMutation.mutate(artifact.id)}
                    disabled={mintNFTMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                  >
                    <Gem className="w-4 h-4 mr-2" />
                    Mint as NFT
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
