
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Music, Cpu, Network, Zap, Play, Pause } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function HarmonicsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: harmonicsData, isLoading } = useQuery({
    queryKey: ['system-harmonics'],
    queryFn: async () => {
      try {
        return await backend.temple.getHarmonics();
      } catch (err) {
        console.error('Failed to fetch system harmonics:', err);
        toast({
          title: "Error",
          description: "Failed to fetch system harmonics",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const createHarmonicsMutation = useMutation({
    mutationFn: async () => {
      // Generate mock system data
      const mockData = {
        cpuFrequency: Math.random() * 1000 + 2000, // 2-3 GHz
        networkActivity: Math.random() * 100,
        dbStats: {
          connections: Math.floor(Math.random() * 50) + 10,
          queries_per_second: Math.floor(Math.random() * 1000) + 100,
          cache_hit_ratio: Math.random() * 0.3 + 0.7,
        },
      };
      
      return await backend.temple.createHarmonics(mockData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-harmonics'] });
      toast({
        title: "Success",
        description: "New harmonic pattern generated",
      });
    },
    onError: (err) => {
      console.error('Failed to create harmonics:', err);
      toast({
        title: "Error",
        description: "Failed to generate harmonic pattern",
        variant: "destructive",
      });
    },
  });

  const latestHarmonics = harmonicsData?.harmonics[0];

  const renderMusicalPattern = (pattern: any) => {
    if (!pattern) return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Tempo:</span>
            <span className="text-white ml-2">{pattern.tempo} BPM</span>
          </div>
          <div>
            <span className="text-slate-400">Key:</span>
            <span className="text-white ml-2">{pattern.key}</span>
          </div>
        </div>
        
        {pattern.frequencies && (
          <div>
            <div className="text-sm text-slate-400 mb-2">Harmonic Frequencies:</div>
            <div className="grid grid-cols-2 gap-2">
              {pattern.frequencies.slice(0, 6).map((freq: any, index: number) => (
                <div key={index} className="bg-slate-800 p-2 rounded text-xs">
                  <div className="text-cyan-400">{freq.note}</div>
                  <div className="text-white">{freq.frequency.toFixed(1)} Hz</div>
                  <Progress value={freq.amplitude * 100} className="mt-1 h-1" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLaserSync = (laserData: any) => {
    if (!laserData) return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Beam Count:</span>
            <span className="text-white ml-2">{laserData.beamCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Rotation:</span>
            <span className="text-white ml-2">{laserData.rotationSpeed?.toFixed(1)} RPM</span>
          </div>
        </div>
        
        {laserData.colors && (
          <div>
            <div className="text-sm text-slate-400 mb-2">Color Patterns:</div>
            <div className="flex flex-wrap gap-2">
              {laserData.colors.slice(0, 8).map((color: any, index: number) => (
                <div 
                  key={index}
                  className="w-8 h-8 rounded border-2 border-slate-600"
                  style={{
                    backgroundColor: `hsl(${color.hue}, ${color.saturation}%, ${color.brightness}%)`
                  }}
                  title={`${color.hue}° ${color.saturation}% ${color.brightness}%`}
                />
              ))}
            </div>
          </div>
        )}
        
        {laserData.effects && (
          <div>
            <div className="text-sm text-slate-400 mb-2">Effects:</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(laserData.effects).map(([effect, enabled]) => (
                <Badge 
                  key={effect}
                  variant={enabled ? "default" : "secondary"}
                  className="text-xs"
                >
                  {effect}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Music className="w-5 h-5 mr-2" />
            Harmonics Engine Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => createHarmonicsMutation.mutate()}
              disabled={createHarmonicsMutation.isPending}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Generate New Pattern</span>
            </Button>
            <Badge variant="outline" className="text-slate-300">
              Real-time Music Logic Engine
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current System State */}
      {latestHarmonics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center">
                <Cpu className="w-4 h-4 mr-2" />
                CPU Frequency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">
                {(latestHarmonics.cpuFrequency / 1000).toFixed(2)} GHz
              </div>
              <Progress 
                value={(latestHarmonics.cpuFrequency / 4000) * 100} 
                className="mb-2"
              />
              <div className="text-xs text-slate-400">
                Driving musical tempo and harmonics
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center">
                <Network className="w-4 h-4 mr-2" />
                Network Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">
                {latestHarmonics.networkActivity.toFixed(1)}%
              </div>
              <Progress 
                value={latestHarmonics.networkActivity} 
                className="mb-2"
              />
              <div className="text-xs text-slate-400">
                Controlling rhythm patterns
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Laser Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">
                {latestHarmonics.laserSyncData?.beamCount || 0} Beams
              </div>
              <div className="text-xs text-slate-400">
                Synchronized visualization output
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Musical Pattern Visualization */}
      {latestHarmonics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Musical Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMusicalPattern(latestHarmonics.musicalPattern)}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Laser Synchronization</CardTitle>
            </CardHeader>
            <CardContent>
              {renderLaserSync(latestHarmonics.laserSyncData)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Harmonics History */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Harmonic Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : harmonicsData?.harmonics.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No harmonic patterns found. Generate your first pattern above.
            </div>
          ) : (
            <div className="space-y-4">
              {harmonicsData?.harmonics.slice(0, 5).map((harmonic) => (
                <div key={harmonic.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-white">
                      Pattern #{harmonic.id}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(harmonic.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">CPU:</span>
                      <div className="text-white">
                        {(harmonic.cpuFrequency / 1000).toFixed(2)} GHz
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Network:</span>
                      <div className="text-white">
                        {harmonic.networkActivity.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Tempo:</span>
                      <div className="text-white">
                        {harmonic.musicalPattern?.tempo || 'N/A'} BPM
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Key:</span>
                      <div className="text-white">
                        {harmonic.musicalPattern?.key || 'N/A'}
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
  );
}
