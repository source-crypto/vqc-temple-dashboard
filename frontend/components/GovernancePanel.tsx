import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Scale, Plus, Vote, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function GovernancePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = 'demo-user-123';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      try {
        return await backend.blockchain.listProposals();
      } catch (err) {
        console.error('Failed to fetch proposals:', err);
        return { proposals: [] };
      }
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      return await backend.blockchain.createProposal({
        proposerId: userId,
        ...data,
      });
    },
    onSuccess: () => {
      toast({ title: "Proposal Created" });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setTitle('');
      setDescription('');
    },
    onError: (err) => {
      console.error('Failed to create proposal:', err);
      toast({ title: "Proposal Creation Failed", variant: "destructive" });
    },
  });

  const castVoteMutation = useMutation({
    mutationFn: async (data: { proposalId: number; voteOption: 'for' | 'against' | 'abstain' }) => {
      return await backend.blockchain.castVote({ voterId: userId, ...data });
    },
    onSuccess: () => {
      toast({ title: "Vote Cast" });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (err) => {
      console.error('Failed to cast vote:', err);
      toast({ title: "Vote Failed", variant: "destructive" });
    },
  });

  const handleCreateProposal = () => {
    if (!title || !description) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    createProposalMutation.mutate({ title, description });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-600',
      pending: 'bg-yellow-600',
      succeeded: 'bg-blue-600',
      executed: 'bg-purple-600',
      defeated: 'bg-red-600',
    };
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-600'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create New Proposal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-300">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-slate-300">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1"
            />
          </div>
          <Button onClick={handleCreateProposal} disabled={createProposalMutation.isPending}>
            {createProposalMutation.isPending ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Scale className="w-5 h-5 mr-2" />
            Governance Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading proposals...</div>
          ) : (
            <div className="space-y-4">
              {proposals?.proposals.map((p) => (
                <div key={p.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-white">{p.title}</h3>
                      <p className="text-sm text-slate-400">{p.description}</p>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>
                  <div className="mt-4">
                    <div className="space-y-2">
                      <Progress value={50} /> {/* Placeholder for vote progress */}
                    </div>
                    {p.status === 'active' && (
                      <div className="flex space-x-2 mt-4">
                        <Button size="sm" onClick={() => castVoteMutation.mutate({ proposalId: p.id, voteOption: 'for' })}>
                          <Check className="w-4 h-4 mr-1" /> For
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => castVoteMutation.mutate({ proposalId: p.id, voteOption: 'against' })}>
                          <X className="w-4 h-4 mr-1" /> Against
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => castVoteMutation.mutate({ proposalId: p.id, voteOption: 'abstain' })}>
                          Abstain
                        </Button>
                      </div>
                    )}
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
