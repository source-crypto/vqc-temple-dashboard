
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Hash, Box, Clock, Zap, ChevronLeft, ChevronRight, Table, Grid } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import backend from '~backend/client';

function QuantumLedgerPanelContent() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['quantum-ledger', page, limit],
    queryFn: async () => {
      try {
        return await backend.temple.getQuantumLedgerEntries({ page, limit });
      } catch (err) {
        console.error('Failed to fetch quantum ledger:', err);
        toast({
          title: "Error",
          description: "Failed to fetch quantum ledger data",
          variant: "destructive",
        });
        throw err;
      }
    },
    refetchInterval: 30000,
  });

  const totalPages = ledgerData?.totalPages || 1;

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Public Quantum Chain Ledger
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {ledgerData?.total || 0} Total Entries
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <Table className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-700 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : ledgerData?.entries.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No entries found in the quantum ledger.
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">ID</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Block</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Timestamp</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Transaction Hash</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Canonical Hash</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Entropy</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Health</th>
                    <th className="text-left py-3 px-2 text-slate-300 font-semibold">Coherence</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData?.entries.map((entry) => (
                    <tr key={entry.ledgerId} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">#{entry.ledgerId}</Badge>
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        <div className="flex items-center">
                          <Box className="w-3 h-3 mr-1 text-slate-400" />
                          {entry.blockNumber}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-slate-300 text-xs">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" />
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-mono text-xs text-white break-all max-w-xs truncate" title={entry.transactionHash}>
                          {entry.transactionHash}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-mono text-xs text-white break-all max-w-xs truncate" title={entry.canonicalHash}>
                          {entry.canonicalHash}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-purple-400 font-semibold">
                          {(entry.vqcMetrics.entropyLevel * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-green-400 font-semibold">
                          {(entry.vqcMetrics.systemHealth * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-cyan-400 font-semibold">
                          {(entry.vqcMetrics.quantumCoherence * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {ledgerData?.entries.map((entry) => (
                <div key={entry.ledgerId} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">Ledger Entry #{entry.ledgerId}</Badge>
                      <div className="text-sm text-slate-400 flex items-center">
                        <Box className="w-3 h-3 mr-1" />
                        Block #{entry.blockNumber}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400 flex items-center"><Hash className="w-3 h-3 mr-1" />Transaction Hash:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {entry.transactionHash}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 flex items-center"><Hash className="w-3 h-3 mr-1" />Canonical Hash:</span>
                      <div className="text-white font-mono text-xs break-all">
                        {entry.canonicalHash}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <div className="text-sm text-slate-300 mb-2 flex items-center">
                      <Zap className="w-4 h-4 mr-2 text-purple-400" />
                      VQC Metrics Snapshot
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Entropy:</span>
                        <div className="text-purple-400">
                          {(entry.vqcMetrics.entropyLevel * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Health:</span>
                        <div className="text-green-400">
                          {(entry.vqcMetrics.systemHealth * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Coherence:</span>
                        <div className="text-cyan-400">
                          {(entry.vqcMetrics.quantumCoherence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && ledgerData && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuantumLedgerPanel() {
  return (
    <ErrorBoundary>
      <QuantumLedgerPanelContent />
    </ErrorBoundary>
  );
}
