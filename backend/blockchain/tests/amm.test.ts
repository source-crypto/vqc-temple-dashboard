import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addLiquidity,
  stakeLPTokens,
  unstakeLPTokens,
  claimRewards,
  getUserStakingPositions,
  getYieldFarms,
} from '../amm';
import { blockchainDB } from '../db';
import { createWallet, getUserBalances } from '../currency_exchange';

describe('AMM & Yield Farming API', () => {
  const testUserId = 'test-user-yield-farming';
  let poolId: number;
  let farmId: number;

  beforeEach(async () => {
    // Ensure user and balances exist
    try {
      await createWallet({ userId: testUserId });
    } catch (e) {
      // Ignore if wallet already exists
    }
    await blockchainDB.exec`
      INSERT INTO user_balances (user_id, currency, balance)
      VALUES (${testUserId}, 'ASM', '1000000000000000000000'), (${testUserId}, 'USD', '1000000000000000000000')
      ON CONFLICT (user_id, currency) DO UPDATE SET balance = '1000000000000000000000';
    `;

    // Get a farm to test with
    const farms = await getYieldFarms();
    if (farms.farms.length === 0) {
      throw new Error("No yield farms found for testing. Please seed the database.");
    }
    farmId = farms.farms[0].id;
    poolId = farms.farms[0].poolId;

    // Ensure user has liquidity in the required pool
    await addLiquidity({
      userId: testUserId,
      tokenA: 'ASM',
      tokenB: 'USD',
      amountA: '100000000000000000000', // 100 ASM
      amountB: '1250000000000000000', // 1.25 USD
      slippageTolerance: 0.5,
    });
  });

  afterEach(async () => {
    // Cleanup
    await blockchainDB.exec`DELETE FROM staking_positions WHERE user_id = ${testUserId}`;
    await blockchainDB.exec`DELETE FROM liquidity_positions WHERE user_id = ${testUserId}`;
    await blockchainDB.exec`DELETE FROM user_balances WHERE user_id = ${testUserId}`;
    await blockchainDB.exec`DELETE FROM user_wallets WHERE user_id = ${testUserId}`;
  });

  it('should allow a user to stake LP tokens', async () => {
    const lpPositions = await blockchainDB.queryRow<{ liquidity_tokens: string }>`
      SELECT liquidity_tokens FROM liquidity_positions WHERE user_id = ${testUserId} AND pool_id = ${poolId}
    `;
    const stakeAmount = (BigInt(lpPositions!.liquidity_tokens) / 2n).toString();

    const response = await stakeLPTokens({ userId: testUserId, farmId, amount: stakeAmount });
    expect(response.success).toBe(true);

    const positions = await getUserStakingPositions({ userId: testUserId });
    expect(positions.positions.length).toBe(1);
    expect(positions.positions[0].stakedAmount).toBe(stakeAmount);
    expect(positions.positions[0].farmId).toBe(farmId);
  });

  it('should not allow staking more LP tokens than owned', async () => {
    const lpPositions = await blockchainDB.queryRow<{ liquidity_tokens: string }>`
      SELECT liquidity_tokens FROM liquidity_positions WHERE user_id = ${testUserId} AND pool_id = ${poolId}
    `;
    const stakeAmount = (BigInt(lpPositions!.liquidity_tokens) + 1n).toString();

    await expect(
      stakeLPTokens({ userId: testUserId, farmId, amount: stakeAmount })
    ).rejects.toThrow('Insufficient LP tokens');
  });

  it('should allow a user to unstake their tokens', async () => {
    const lpPositions = await blockchainDB.queryRow<{ liquidity_tokens: string }>`
      SELECT liquidity_tokens FROM liquidity_positions WHERE user_id = ${testUserId} AND pool_id = ${poolId}
    `;
    const stakeAmount = lpPositions!.liquidity_tokens;

    await stakeLPTokens({ userId: testUserId, farmId, amount: stakeAmount });
    
    const stakingPositions = await getUserStakingPositions({ userId: testUserId });
    const stakingPositionId = stakingPositions.positions[0].id;

    // Wait for a bit to ensure lock period (if any) passes, assuming default is 0
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await unstakeLPTokens({ userId: testUserId, stakingPositionId, amount: stakeAmount });
    expect(response.success).toBe(true);

    const finalStakingPositions = await getUserStakingPositions({ userId: testUserId });
    expect(finalStakingPositions.positions.length).toBe(0);
  });

  it('should calculate and allow claiming rewards', async () => {
    const lpPositions = await blockchainDB.queryRow<{ liquidity_tokens: string }>`
      SELECT liquidity_tokens FROM liquidity_positions WHERE user_id = ${testUserId} AND pool_id = ${poolId}
    `;
    const stakeAmount = lpPositions!.liquidity_tokens;

    await stakeLPTokens({ userId: testUserId, farmId, amount: stakeAmount });
    
    const stakingPositions = await getUserStakingPositions({ userId: testUserId });
    const stakingPositionId = stakingPositions.positions[0].id;

    // Wait for rewards to accumulate
    await new Promise(resolve => setTimeout(resolve, 2000));

    const balancesBefore = await getUserBalances({ userId: testUserId });
    const asmBalanceBefore = balancesBefore.balances.find(b => b.currency === 'ASM')?.balance || 0;

    const claimResponse = await claimRewards({ userId: testUserId, stakingPositionId });
    expect(claimResponse.success).toBe(true);
    expect(BigInt(claimResponse.claimedAmount)).toBeGreaterThan(0n);

    const balancesAfter = await getUserBalances({ userId: testUserId });
    const asmBalanceAfter = balancesAfter.balances.find(b => b.currency === 'ASM')?.balance || 0;

    expect(asmBalanceAfter).toBeGreaterThan(asmBalanceBefore);
  });

  it('should respect time-locked stakes', async () => {
    // Find a farm with a lock period or create one for testing
    const farmWithLock = await blockchainDB.queryRow<{ id: number; pool_id: number; }>`
      INSERT INTO yield_farming_pools (pool_id, reward_token, reward_rate, start_time, end_time, lock_period_days)
      VALUES (1, 'ASM', '100000000000000000', NOW(), NOW() + INTERVAL '1 day', 1)
      RETURNING id, pool_id
    `;
    if (!farmWithLock) throw new Error("Failed to create test farm with lock");

    const lpPositions = await blockchainDB.queryRow<{ liquidity_tokens: string }>`
      SELECT liquidity_tokens FROM liquidity_positions WHERE user_id = ${testUserId} AND pool_id = ${farmWithLock.pool_id}
    `;
    const stakeAmount = lpPositions!.liquidity_tokens;

    await stakeLPTokens({ userId: testUserId, farmId: farmWithLock.id, amount: stakeAmount });
    
    const stakingPositions = await getUserStakingPositions({ userId: testUserId });
    const stakingPositionId = stakingPositions.positions.find(p => p.farmId === farmWithLock.id)!.id;

    await expect(
      unstakeLPTokens({ userId: testUserId, stakingPositionId, amount: stakeAmount })
    ).rejects.toThrow('Stake is time-locked');

    // Cleanup test farm
    await blockchainDB.exec`DELETE FROM yield_farming_pools WHERE id = ${farmWithLock.id}`;
  });
});
