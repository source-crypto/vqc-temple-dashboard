import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProposal, listProposals, castVote } from '../governance';
import { blockchainDB } from '../db';

describe('Governance API', () => {
  const testUserId = 'test-governance-user';
  const asmContractAddress = 'ASM_CONTRACT_ADDRESS'; // Mock contract address

  beforeEach(async () => {
    // Ensure user exists with ASM balance
    await blockchainDB.exec`
      INSERT INTO token_balances (address, token_contract, balance)
      VALUES (${testUserId}, ${asmContractAddress}, '2000000000000000000000000') -- 2,000,000 ASM
      ON CONFLICT (address, token_contract) DO UPDATE SET balance = '2000000000000000000000000';
    `;
  });

  afterEach(async () => {
    // Cleanup
    await blockchainDB.exec`DELETE FROM governance_votes WHERE voter_id = ${testUserId}`;
    await blockchainDB.exec`DELETE FROM governance_proposals WHERE proposer_id = ${testUserId}`;
    await blockchainDB.exec`DELETE FROM token_balances WHERE address = ${testUserId}`;
  });

  it('should allow a user with enough tokens to create a proposal', async () => {
    const response = await createProposal({
      proposerId: testUserId,
      title: 'Test Proposal',
      description: 'This is a test proposal.',
    });

    expect(response.proposal).toBeDefined();
    expect(response.proposal.title).toBe('Test Proposal');
    expect(response.proposal.status).toBe('active');
  });

  it('should prevent a user with insufficient tokens from creating a proposal', async () => {
    // Update balance to be below threshold
    await blockchainDB.exec`
      UPDATE token_balances SET balance = '1000' WHERE address = ${testUserId} AND token_contract = ${asmContractAddress}
    `;

    await expect(
      createProposal({
        proposerId: testUserId,
        title: 'Test Proposal',
        description: 'This should fail.',
      })
    ).rejects.toThrow('Insufficient ASM balance to create a proposal.');
  });

  it('should list created proposals', async () => {
    await createProposal({
      proposerId: testUserId,
      title: 'List Test Proposal',
      description: 'A proposal to be listed.',
    });

    const response = await listProposals();
    expect(response.proposals.length).toBeGreaterThan(0);
    const found = response.proposals.find(p => p.title === 'List Test Proposal');
    expect(found).toBeDefined();
  });

  it('should allow a user to cast a vote', async () => {
    const proposalResponse = await createProposal({
      proposerId: testUserId,
      title: 'Vote Test Proposal',
      description: 'A proposal to vote on.',
    });
    const proposalId = proposalResponse.proposal.id;

    const voteResponse = await castVote({
      proposalId,
      voterId: testUserId,
      voteOption: 'for',
    });

    expect(voteResponse.success).toBe(true);

    // Verify vote was recorded
    const vote = await blockchainDB.queryRow`
      SELECT * FROM governance_votes WHERE proposal_id = ${proposalId} AND voter_id = ${testUserId}
    `;
    expect(vote).toBeDefined();
    expect(vote!.vote_option).toBe('for');
    expect(BigInt(vote!.voting_weight)).toBeGreaterThan(0n);
  });

  it('should prevent voting on an inactive proposal', async () => {
    const proposalResponse = await createProposal({
      proposerId: testUserId,
      title: 'Inactive Vote Test',
      description: 'This proposal will be inactive.',
    });
    const proposalId = proposalResponse.proposal.id;

    // Manually set proposal to ended
    await blockchainDB.exec`
      UPDATE governance_proposals SET status = 'defeated', end_time = NOW() - INTERVAL '1 day' WHERE id = ${proposalId}
    `;

    await expect(
      castVote({
        proposalId,
        voterId: testUserId,
        voteOption: 'for',
      })
    ).rejects.toThrow('Proposal is not active for voting.');
  });
});
