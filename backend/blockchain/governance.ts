import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";

const PROPOSAL_DURATION_DAYS = 7;
const MIN_PROPOSAL_THRESHOLD = "1000000000000000000000000"; // 1,000,000 ASM

export interface Proposal {
  id: number;
  proposerId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'succeeded' | 'defeated' | 'executed';
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  executionTxHash?: string;
  createdAt: Date;
}

export interface CreateProposalRequest {
  proposerId: string;
  title: string;
  description: string;
}

export interface VoteRequest {
  proposalId: number;
  voterId: string;
  voteOption: 'for' | 'against' | 'abstain';
}

// Creates a new governance proposal.
export const createProposal = api<CreateProposalRequest, { proposal: Proposal }>(
  { expose: true, method: "POST", path: "/governance/proposals" },
  async (req) => {
    return withPerformanceMonitoring("/governance/proposals", "POST", async () => {
      const { proposerId, title, description } = req;

      // Check if proposer has enough ASM to create a proposal
      const balance = await blockchainDB.queryRow<{ balance: string }>`
        SELECT balance FROM token_balances WHERE address = ${proposerId} AND token_contract = 'ASM_CONTRACT_ADDRESS'
      `;
      if (!balance || BigInt(balance.balance) < BigInt(MIN_PROPOSAL_THRESHOLD)) {
        throw APIError.permissionDenied("Insufficient ASM balance to create a proposal.");
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + PROPOSAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

      const proposal = await blockchainDB.queryRow<any>`
        INSERT INTO governance_proposals (proposer_id, title, description, start_time, end_time, status)
        VALUES (${proposerId}, ${title}, ${description}, ${startTime}, ${endTime}, 'active')
        RETURNING *
      `;

      return {
        proposal: {
          id: proposal.id,
          proposerId: proposal.proposer_id,
          title: proposal.title,
          description: proposal.description,
          startTime: proposal.start_time,
          endTime: proposal.end_time,
          status: proposal.status,
          forVotes: proposal.for_votes,
          againstVotes: proposal.against_votes,
          abstainVotes: proposal.abstain_votes,
          createdAt: proposal.created_at,
        }
      };
    });
  }
);

// Lists all governance proposals.
export const listProposals = api<void, { proposals: Proposal[] }>(
  { expose: true, method: "GET", path: "/governance/proposals" },
  async () => {
    const proposals = await blockchainDB.queryAll<any>`
      SELECT * FROM governance_proposals ORDER BY created_at DESC
    `;
    return {
      proposals: proposals.map(p => ({
        id: p.id,
        proposerId: p.proposer_id,
        title: p.title,
        description: p.description,
        startTime: p.start_time,
        endTime: p.end_time,
        status: p.status,
        forVotes: p.for_votes,
        againstVotes: p.against_votes,
        abstainVotes: p.abstain_votes,
        createdAt: p.created_at,
        executionTxHash: p.execution_tx_hash,
      }))
    };
  }
);

// Casts a vote on a proposal.
export const castVote = api<VoteRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/governance/vote" },
  async (req) => {
    return withPerformanceMonitoring("/governance/vote", "POST", async () => {
      const { proposalId, voterId, voteOption } = req;

      const proposal = await blockchainDB.queryRow<{ status: string; end_time: Date }>`
        SELECT status, end_time FROM governance_proposals WHERE id = ${proposalId}
      `;
      if (!proposal || proposal.status !== 'active' || new Date() > new Date(proposal.end_time)) {
        throw APIError.failedPrecondition("Proposal is not active for voting.");
      }

      // Get voter's ASM balance for voting weight
      const balance = await blockchainDB.queryRow<{ balance: string }>`
        SELECT balance FROM token_balances WHERE address = ${voterId} AND token_contract = 'ASM_CONTRACT_ADDRESS'
      `;
      const votingWeight = balance ? BigInt(balance.balance) : 0n;

      if (votingWeight === 0n) {
        throw APIError.permissionDenied("No voting power (zero ASM balance).");
      }

      await using tx = await blockchainDB.begin();
      try {
        await tx.exec`
          INSERT INTO governance_votes (proposal_id, voter_id, vote_option, voting_weight)
          VALUES (${proposalId}, ${voterId}, ${voteOption}, ${votingWeight.toString()})
          ON CONFLICT (proposal_id, voter_id) DO UPDATE SET
            vote_option = EXCLUDED.vote_option,
            voting_weight = EXCLUDED.voting_weight,
            timestamp = NOW()
        `;

        const voteColumn = `${voteOption}_votes`;
        await tx.exec`
          UPDATE governance_proposals
          SET ${voteColumn} = ${voteColumn} + ${votingWeight.toString()}
          WHERE id = ${proposalId}
        `;

        await tx.commit();
        return { success: true };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);
