import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";
import crypto from "crypto";
import { publishTransactionConfirmation } from "./notifications";

export interface LiquidityPool {
  id: number;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
  feeRate: number;
  createdAt: Date;
  lastUpdated: Date;
}

export interface LiquidityPosition {
  id: number;
  userId: string;
  poolId: number;
  liquidityTokens: string;
  sharePercentage: number;
  createdAt: Date;
  lastUpdated: Date;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: string;
  minimumOutput: string;
  route: string[];
}

export interface AddLiquidityRequest {
  userId: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  slippageTolerance: number;
}

export interface RemoveLiquidityRequest {
  userId: string;
  poolId: number;
  liquidityTokens: string;
  slippageTolerance: number;
}

export interface SwapRequest {
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minimumAmountOut: string;
  slippageTolerance: number;
}

export interface YieldFarmingPool {
  id: number;
  poolId: number;
  rewardToken: string;
  rewardRate: string;
  totalStaked: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  lockPeriodDays?: number;
}

export interface StakingPosition {
  id: number;
  userId: string;
  farmId: number;
  stakedAmount: string;
  rewardDebt: string;
  pendingRewards: string;
  createdAt: Date;
  lastUpdated: Date;
  lockedUntil?: Date;
}

export interface StakeRequest {
  userId: string;
  farmId: number;
  amount: string; // Amount of LP tokens to stake
}

export interface UnstakeRequest {
  userId: string;
  stakingPositionId: number;
  amount: string; // Amount of LP tokens to unstake
}

export interface ClaimRewardsRequest {
  userId: string;
  stakingPositionId: number;
}

export interface FlashLoanSwapPayload {
  type: 'swap';
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // The amount to swap from the borrowed funds
}

export interface FlashLoanRequest {
  userId: string;
  loanToken: string;
  loanAmount: string;
  payload: FlashLoanSwapPayload[]; // For now, only support swaps
}

export interface FlashLoanResponse {
  success: boolean;
  txHash: string;
  profit: string;
  feePaid: string;
}

// Helper function to update rewards for a farm
async function updateYieldFarmRewards(farmId: number, tx: any) {
  const farm = await tx.queryRow<{
    id: number;
    total_staked: string;
    reward_rate: string;
    last_updated: Date;
    acc_reward_per_share: string;
  }>`
    SELECT id, total_staked, reward_rate, last_updated, acc_reward_per_share
    FROM yield_farming_pools
    WHERE id = ${farmId}
    FOR UPDATE
  `;

  if (!farm) {
    throw APIError.notFound("Yield farm not found");
  }

  const now = new Date();
  const lastUpdated = new Date(farm.last_updated);

  if (now <= lastUpdated) {
    return;
  }

  const totalStaked = BigInt(farm.total_staked);
  if (totalStaked === 0n) {
    await tx.exec`
      UPDATE yield_farming_pools
      SET last_updated = NOW()
      WHERE id = ${farmId}
    `;
    return;
  }

  const timeDiff = BigInt(Math.floor((now.getTime() - lastUpdated.getTime()) / 1000));
  if (timeDiff <= 0n) {
    return;
  }

  const rewardRate = BigInt(farm.reward_rate);
  const precision = 10n ** 18n;
  const reward = timeDiff * rewardRate;
  const accRewardPerShare = BigInt(farm.acc_reward_per_share);
  const newAccRewardPerShare = accRewardPerShare + (reward * precision / totalStaked);

  await tx.exec`
    UPDATE yield_farming_pools
    SET acc_reward_per_share = ${newAccRewardPerShare.toString()},
        last_updated = NOW()
    WHERE id = ${farmId}
  `;
}

// Get all liquidity pools
export const getLiquidityPools = api<void, { pools: LiquidityPool[] }>(
  { expose: true, method: "GET", path: "/amm/pools" },
  async () => {
    return withPerformanceMonitoring("/amm/pools", "GET", async () => {
      const rows = await blockchainDB.queryAll<{
        id: number;
        token_a: string;
        token_b: string;
        reserve_a: string;
        reserve_b: string;
        total_liquidity: string;
        fee_rate: number;
        created_at: Date;
        last_updated: Date;
      }>`
        SELECT * FROM liquidity_pools 
        ORDER BY total_liquidity DESC
      `;

      const pools = rows.map(row => ({
        id: row.id,
        tokenA: row.token_a,
        tokenB: row.token_b,
        reserveA: row.reserve_a,
        reserveB: row.reserve_b,
        totalLiquidity: row.total_liquidity,
        feeRate: row.fee_rate,
        createdAt: row.created_at,
        lastUpdated: row.last_updated,
      }));

      return { pools };
    });
  }
);

// Get swap quote
export const getSwapQuote = api<{
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}, SwapQuote>(
  { expose: true, method: "GET", path: "/amm/quote" },
  async (req) => {
    return withPerformanceMonitoring("/amm/quote", "GET", async () => {
      if (!req.tokenIn || !req.tokenOut || !req.amountIn) {
        throw APIError.invalidArgument("Missing required parameters");
      }

      // Find the pool for this token pair
      const pool = await blockchainDB.queryRow<{
        id: number;
        reserve_a: string;
        reserve_b: string;
        fee_rate: number;
      }>`
        SELECT id, reserve_a, reserve_b, fee_rate
        FROM liquidity_pools 
        WHERE (token_a = ${req.tokenIn} AND token_b = ${req.tokenOut})
           OR (token_a = ${req.tokenOut} AND token_b = ${req.tokenIn})
      `;

      if (!pool) {
        throw APIError.notFound("No liquidity pool found for this token pair");
      }

      const amountIn = BigInt(req.amountIn);
      const reserveIn = BigInt(pool.reserve_a);
      const reserveOut = BigInt(pool.reserve_b);
      const feeRate = BigInt(Math.floor(pool.fee_rate * 10000)); // Convert to basis points

      // Calculate output amount using constant product formula
      // amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
      const amountInWithFee = amountIn * (BigInt(10000) - feeRate) / BigInt(10000);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn + amountInWithFee;
      const amountOut = numerator / denominator;

      // Calculate price impact
      const priceImpact = Number((amountIn * BigInt(100)) / reserveIn) / 100;
      
      // Calculate fee
      const fee = (amountIn * feeRate / BigInt(10000)).toString();
      
      // Calculate minimum output with 0.5% slippage
      const minimumOutput = (amountOut * BigInt(995) / BigInt(1000)).toString();

      return {
        inputAmount: req.amountIn,
        outputAmount: amountOut.toString(),
        priceImpact,
        fee,
        minimumOutput,
        route: [req.tokenIn, req.tokenOut]
      };
    });
  }
);

// Add liquidity to pool
export const addLiquidity = api<AddLiquidityRequest, { 
  poolId: number; 
  liquidityTokens: string; 
  txHash: string; 
}>(
  { expose: true, method: "POST", path: "/amm/add-liquidity" },
  async (req) => {
    return withPerformanceMonitoring("/amm/add-liquidity", "POST", async () => {
      if (!req.userId || !req.tokenA || !req.tokenB || !req.amountA || !req.amountB) {
        throw APIError.invalidArgument("Missing required parameters");
      }

      await using tx = await blockchainDB.begin();
      
      try {
        // Check if pool exists
        let pool = await tx.queryRow<{
          id: number;
          reserve_a: string;
          reserve_b: string;
          total_liquidity: string;
        }>`
          SELECT id, reserve_a, reserve_b, total_liquidity
          FROM liquidity_pools 
          WHERE (token_a = ${req.tokenA} AND token_b = ${req.tokenB})
             OR (token_a = ${req.tokenB} AND token_b = ${req.tokenA})
        `;

        let poolId: number;
        let liquidityTokens: string;

        if (!pool) {
          // Create new pool
          const newPool = await tx.queryRow<{ id: number }>`
            INSERT INTO liquidity_pools (token_a, token_b, reserve_a, reserve_b, total_liquidity, fee_rate)
            VALUES (${req.tokenA}, ${req.tokenB}, ${req.amountA}, ${req.amountB}, 
                    ${Math.sqrt(Number(req.amountA) * Number(req.amountB)).toString()}, 0.003)
            RETURNING id
          `;
          
          poolId = newPool!.id;
          liquidityTokens = Math.sqrt(Number(req.amountA) * Number(req.amountB)).toString();
        } else {
          // Add to existing pool
          const reserveA = BigInt(pool.reserve_a);
          const reserveB = BigInt(pool.reserve_b);
          const totalLiquidity = BigInt(pool.total_liquidity);
          
          const amountA = BigInt(req.amountA);
          const amountB = BigInt(req.amountB);
          
          // Calculate liquidity tokens to mint
          const liquidityA = (amountA * totalLiquidity) / reserveA;
          const liquidityB = (amountB * totalLiquidity) / reserveB;
          const liquidityToMint = liquidityA < liquidityB ? liquidityA : liquidityB;
          
          // Update pool reserves
          await tx.exec`
            UPDATE liquidity_pools 
            SET reserve_a = reserve_a + ${req.amountA},
                reserve_b = reserve_b + ${req.amountB},
                total_liquidity = total_liquidity + ${liquidityToMint.toString()},
                last_updated = NOW()
            WHERE id = ${pool.id}
          `;
          
          poolId = pool.id;
          liquidityTokens = liquidityToMint.toString();
        }

        // Record user's liquidity position
        await tx.exec`
          INSERT INTO liquidity_positions (user_id, pool_id, liquidity_tokens, share_percentage)
          VALUES (${req.userId}, ${poolId}, ${liquidityTokens}, 
                  ${liquidityTokens}::numeric / (SELECT total_liquidity FROM liquidity_pools WHERE id = ${poolId})::numeric * 100)
          ON CONFLICT (user_id, pool_id) 
          DO UPDATE SET 
            liquidity_tokens = liquidity_positions.liquidity_tokens + ${liquidityTokens},
            last_updated = NOW()
        `;

        // Update user balances
        await tx.exec`
          UPDATE user_balances 
          SET balance = balance - ${req.amountA}
          WHERE user_id = ${req.userId} AND currency = ${req.tokenA}
        `;

        await tx.exec`
          UPDATE user_balances 
          SET balance = balance - ${req.amountB}
          WHERE user_id = ${req.userId} AND currency = ${req.tokenB}
        `;

        await tx.commit();

        const txHash = "0x" + crypto.randomBytes(32).toString('hex');

        await publishTransactionConfirmation({
          userId: req.userId,
          type: 'liquidity_add',
          status: 'completed',
          message: `Successfully added liquidity to pool ${poolId}.`,
          details: {
            poolId,
            tokenA: req.tokenA,
            tokenB: req.tokenB,
            amountA: req.amountA,
            amountB: req.amountB,
            txHash,
          },
        });

        return {
          poolId,
          liquidityTokens,
          txHash
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

// Execute swap
export const executeSwap = api<SwapRequest, { 
  amountOut: string; 
  txHash: string; 
  priceImpact: number; 
}>(
  { expose: true, method: "POST", path: "/amm/swap" },
  async (req) => {
    return withPerformanceMonitoring("/amm/swap", "POST", async () => {
      if (!req.userId || !req.tokenIn || !req.tokenOut || !req.amountIn) {
        throw APIError.invalidArgument("Missing required parameters");
      }

      await using tx = await blockchainDB.begin();
      
      try {
        // Find the pool
        const pool = await tx.queryRow<{
          id: number;
          token_a: string;
          token_b: string;
          reserve_a: string;
          reserve_b: string;
          fee_rate: number;
        }>`
          SELECT id, token_a, token_b, reserve_a, reserve_b, fee_rate
          FROM liquidity_pools 
          WHERE (token_a = ${req.tokenIn} AND token_b = ${req.tokenOut})
             OR (token_a = ${req.tokenOut} AND token_b = ${req.tokenIn})
        `;

        if (!pool) {
          throw APIError.notFound("No liquidity pool found for this token pair");
        }

        // Determine which token is which in the pool
        const isTokenAInput = pool.token_a === req.tokenIn;
        const reserveIn = BigInt(isTokenAInput ? pool.reserve_a : pool.reserve_b);
        const reserveOut = BigInt(isTokenAInput ? pool.reserve_b : pool.reserve_a);

        const amountIn = BigInt(req.amountIn);
        const feeRate = BigInt(Math.floor(pool.fee_rate * 10000));

        // Calculate output amount
        const amountInWithFee = amountIn * (BigInt(10000) - feeRate) / BigInt(10000);
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn + amountInWithFee;
        const amountOut = numerator / denominator;

        // Check slippage
        if (amountOut < BigInt(req.minimumAmountOut)) {
          throw APIError.failedPrecondition("Slippage tolerance exceeded");
        }

        // Calculate price impact
        const priceImpact = Number((amountIn * BigInt(100)) / reserveIn) / 100;

        // Update pool reserves
        if (isTokenAInput) {
          await tx.exec`
            UPDATE liquidity_pools 
            SET reserve_a = reserve_a + ${req.amountIn},
                reserve_b = reserve_b - ${amountOut.toString()},
                last_updated = NOW()
            WHERE id = ${pool.id}
          `;
        } else {
          await tx.exec`
            UPDATE liquidity_pools 
            SET reserve_a = reserve_a - ${amountOut.toString()},
                reserve_b = reserve_b + ${req.amountIn},
                last_updated = NOW()
            WHERE id = ${pool.id}
          `;
        }

        // Update user balances
        await tx.exec`
          UPDATE user_balances 
          SET balance = balance - ${req.amountIn}
          WHERE user_id = ${req.userId} AND currency = ${req.tokenIn}
        `;

        await tx.exec`
          UPDATE user_balances 
          SET balance = balance + ${amountOut.toString()}
          WHERE user_id = ${req.userId} AND currency = ${req.tokenOut}
        `;

        // Record the swap transaction
        await tx.exec`
          INSERT INTO currency_transactions (
            user_id, transaction_type, from_currency, to_currency,
            from_amount, to_amount, exchange_rate, fee_amount, status
          )
          VALUES (
            ${req.userId}, 'swap', ${req.tokenIn}, ${req.tokenOut},
            ${req.amountIn}, ${amountOut.toString()}, 
            ${Number(amountOut) / Number(req.amountIn)}, 
            ${Number(amountIn - amountInWithFee)}, 'completed'
          )
        `;

        await tx.commit();

        const txHash = "0x" + crypto.randomBytes(32).toString('hex');

        await publishTransactionConfirmation({
          userId: req.userId,
          type: 'swap',
          status: 'completed',
          message: `Successfully swapped ${req.amountIn} ${req.tokenIn} for ${amountOut.toString()} ${req.tokenOut}.`,
          details: {
            tokenIn: req.tokenIn,
            tokenOut: req.tokenOut,
            amountIn: req.amountIn,
            amountOut: amountOut.toString(),
            txHash,
          },
        });

        return {
          amountOut: amountOut.toString(),
          txHash,
          priceImpact
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

// Get yield farming pools
export const getYieldFarms = api<void, { farms: YieldFarmingPool[] }>(
  { expose: true, method: "GET", path: "/amm/farms" },
  async () => {
    return withPerformanceMonitoring("/amm/farms", "GET", async () => {
      const rows = await blockchainDB.queryAll<{
        id: number;
        pool_id: number;
        reward_token: string;
        reward_rate: string;
        total_staked: string;
        start_time: Date;
        end_time: Date;
        is_active: boolean;
        lock_period_days: number;
      }>`
        SELECT id, pool_id, reward_token, reward_rate, total_staked, start_time, end_time, is_active, lock_period_days
        FROM yield_farming_pools 
        WHERE is_active = true
        ORDER BY reward_rate DESC
      `;

      const farms = rows.map(row => ({
        id: row.id,
        poolId: row.pool_id,
        rewardToken: row.reward_token,
        rewardRate: row.reward_rate,
        totalStaked: row.total_staked,
        startTime: row.start_time,
        endTime: row.end_time,
        isActive: row.is_active,
        lockPeriodDays: row.lock_period_days,
      }));

      return { farms };
    });
  }
);

// Get user's liquidity positions
export const getUserLiquidityPositions = api<{ userId: string }, { positions: LiquidityPosition[] }>(
  { expose: true, method: "GET", path: "/amm/positions/:userId" },
  async (req) => {
    return withPerformanceMonitoring("/amm/positions", "GET", async () => {
      const rows = await blockchainDB.queryAll<{
        id: number;
        user_id: string;
        pool_id: number;
        liquidity_tokens: string;
        share_percentage: number;
        created_at: Date;
        last_updated: Date;
      }>`
        SELECT * FROM liquidity_positions 
        WHERE user_id = ${req.userId}
        ORDER BY last_updated DESC
      `;

      const positions = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        poolId: row.pool_id,
        liquidityTokens: row.liquidity_tokens,
        sharePercentage: row.share_percentage,
        createdAt: row.created_at,
        lastUpdated: row.last_updated,
      }));

      return { positions };
    });
  }
);

// Get user's staking positions
export const getUserStakingPositions = api<{ userId: string }, { positions: StakingPosition[] }>(
  { expose: true, method: "GET", path: "/amm/staking-positions/:userId" },
  async (req) => {
    return withPerformanceMonitoring("/amm/staking-positions", "GET", async () => {
      const positions = await blockchainDB.queryAll<{
        id: number;
        user_id: string;
        farm_id: number;
        staked_amount: string;
        reward_debt: string;
        pending_rewards: string;
        created_at: Date;
        last_updated: Date;
        locked_until: Date | null;
      }>`
        SELECT * FROM staking_positions 
        WHERE user_id = ${req.userId}
        ORDER BY last_updated DESC
      `;

      const result: StakingPosition[] = [];
      for (const pos of positions) {
        const farm = await blockchainDB.queryRow<{ acc_reward_per_share: string }>`
          SELECT acc_reward_per_share FROM yield_farming_pools WHERE id = ${pos.farm_id}
        `;

        if (!farm) continue;

        const precision = 10n ** 18n;
        const accRewardPerShare = BigInt(farm.acc_reward_per_share);
        const stakedAmount = BigInt(pos.staked_amount);
        const rewardDebt = BigInt(pos.reward_debt);

        const currentRewards = (stakedAmount * accRewardPerShare / precision) - rewardDebt;
        const totalPendingRewards = BigInt(pos.pending_rewards) + currentRewards;

        result.push({
          id: pos.id,
          userId: pos.user_id,
          farmId: pos.farm_id,
          stakedAmount: pos.staked_amount,
          rewardDebt: pos.reward_debt,
          pendingRewards: totalPendingRewards.toString(),
          createdAt: pos.created_at,
          lastUpdated: pos.last_updated,
          lockedUntil: pos.locked_until || undefined,
        });
      }

      return { positions: result };
    });
  }
);

// Stake LP tokens into a yield farm
export const stakeLPTokens = api<StakeRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/amm/stake" },
  async (req) => {
    return withPerformanceMonitoring("/amm/stake", "POST", async () => {
      const { userId, farmId, amount } = req;
      const stakeAmount = BigInt(amount);

      if (stakeAmount <= 0n) {
        throw APIError.invalidArgument("Stake amount must be positive");
      }

      await using tx = await blockchainDB.begin();
      try {
        const farm = await tx.queryRow<{ id: number; pool_id: number; lock_period_days: number; acc_reward_per_share: string; }>`
          SELECT id, pool_id, lock_period_days, acc_reward_per_share FROM yield_farming_pools WHERE id = ${farmId}
        `;
        if (!farm) throw APIError.notFound("Farm not found");

        const lpPosition = await tx.queryRow<{ id: number; liquidity_tokens: string }>`
          SELECT id, liquidity_tokens FROM liquidity_positions WHERE user_id = ${userId} AND pool_id = ${farm.pool_id}
        `;
        if (!lpPosition || BigInt(lpPosition.liquidity_tokens) < stakeAmount) {
          throw APIError.failedPrecondition("Insufficient LP tokens");
        }

        await updateYieldFarmRewards(farmId, tx);
        const updatedFarm = await tx.queryRow<{ acc_reward_per_share: string }>`
          SELECT acc_reward_per_share FROM yield_farming_pools WHERE id = ${farmId}
        `;
        const accRewardPerShare = BigInt(updatedFarm!.acc_reward_per_share);
        const precision = 10n ** 18n;

        const stakingPos = await tx.queryRow<{ id: number; staked_amount: string; reward_debt: string; pending_rewards: string }>`
          SELECT id, staked_amount, reward_debt, pending_rewards FROM staking_positions WHERE user_id = ${userId} AND farm_id = ${farmId}
        `;

        if (stakingPos) {
          const oldStakedAmount = BigInt(stakingPos.staked_amount);
          const rewardDebt = BigInt(stakingPos.reward_debt);
          const pendingRewards = BigInt(stakingPos.pending_rewards);
          const newPending = pendingRewards + (oldStakedAmount * accRewardPerShare / precision) - rewardDebt;
          
          const newStakedAmount = oldStakedAmount + stakeAmount;
          const newRewardDebt = newStakedAmount * accRewardPerShare / precision;

          await tx.exec`
            UPDATE staking_positions
            SET staked_amount = ${newStakedAmount.toString()},
                reward_debt = ${newRewardDebt.toString()},
                pending_rewards = ${newPending.toString()},
                last_updated = NOW()
            WHERE id = ${stakingPos.id}
          `;
        } else {
          const rewardDebt = stakeAmount * accRewardPerShare / precision;
          const lockedUntil = farm.lock_period_days > 0 
            ? new Date(Date.now() + farm.lock_period_days * 24 * 60 * 60 * 1000) 
            : null;
          
          await tx.exec`
            INSERT INTO staking_positions (user_id, farm_id, staked_amount, reward_debt, locked_until)
            VALUES (${userId}, ${farmId}, ${amount}, ${rewardDebt.toString()}, ${lockedUntil})
          `;
        }

        await tx.exec`
          UPDATE liquidity_positions SET liquidity_tokens = liquidity_tokens - ${amount} WHERE id = ${lpPosition.id}
        `;
        await tx.exec`
          UPDATE yield_farming_pools SET total_staked = total_staked + ${amount} WHERE id = ${farmId}
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

// Unstake LP tokens from a yield farm
export const unstakeLPTokens = api<UnstakeRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/amm/unstake" },
  async (req) => {
    return withPerformanceMonitoring("/amm/unstake", "POST", async () => {
      const { userId, stakingPositionId, amount } = req;
      const unstakeAmount = BigInt(amount);

      if (unstakeAmount <= 0n) {
        throw APIError.invalidArgument("Unstake amount must be positive");
      }

      await using tx = await blockchainDB.begin();
      try {
        const stakingPos = await tx.queryRow<{ id: number; user_id: string; farm_id: number; staked_amount: string; reward_debt: string; pending_rewards: string; locked_until: Date | null }>`
          SELECT * FROM staking_positions WHERE id = ${stakingPositionId} AND user_id = ${userId}
        `;
        if (!stakingPos) throw APIError.notFound("Staking position not found");
        if (BigInt(stakingPos.staked_amount) < unstakeAmount) throw APIError.failedPrecondition("Insufficient staked amount");
        if (stakingPos.locked_until && new Date() < new Date(stakingPos.locked_until)) throw APIError.failedPrecondition("Stake is time-locked");

        await updateYieldFarmRewards(stakingPos.farm_id, tx);
        const farm = await tx.queryRow<{ pool_id: number; reward_token: string; acc_reward_per_share: string }>`
          SELECT pool_id, reward_token, acc_reward_per_share FROM yield_farming_pools WHERE id = ${stakingPos.farm_id}
        `;
        const accRewardPerShare = BigInt(farm!.acc_reward_per_share);
        const precision = 10n ** 18n;

        const oldStakedAmount = BigInt(stakingPos.staked_amount);
        const rewardDebt = BigInt(stakingPos.reward_debt);
        const pendingRewards = BigInt(stakingPos.pending_rewards);
        const rewardsToClaim = pendingRewards + (oldStakedAmount * accRewardPerShare / precision) - rewardDebt;

        if (rewardsToClaim > 0n) {
          await tx.exec`
            UPDATE user_balances SET balance = balance + ${rewardsToClaim.toString()}
            WHERE user_id = ${userId} AND currency = ${farm!.reward_token}
          `;
        }

        const newStakedAmount = oldStakedAmount - unstakeAmount;
        if (newStakedAmount === 0n) {
          await tx.exec`DELETE FROM staking_positions WHERE id = ${stakingPositionId}`;
        } else {
          const newRewardDebt = newStakedAmount * accRewardPerShare / precision;
          await tx.exec`
            UPDATE staking_positions
            SET staked_amount = ${newStakedAmount.toString()},
                reward_debt = ${newRewardDebt.toString()},
                pending_rewards = '0',
                last_updated = NOW()
            WHERE id = ${stakingPositionId}
          `;
        }

        await tx.exec`
          UPDATE liquidity_positions SET liquidity_tokens = liquidity_tokens + ${amount}
          WHERE user_id = ${userId} AND pool_id = ${farm!.pool_id}
        `;
        await tx.exec`
          UPDATE yield_farming_pools SET total_staked = total_staked - ${amount} WHERE id = ${stakingPos.farm_id}
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

// Claim farming rewards
export const claimRewards = api<ClaimRewardsRequest, { success: boolean; claimedAmount: string }>(
  { expose: true, method: "POST", path: "/amm/claim-rewards" },
  async (req) => {
    return withPerformanceMonitoring("/amm/claim-rewards", "POST", async () => {
      const { userId, stakingPositionId } = req;

      await using tx = await blockchainDB.begin();
      try {
        const stakingPos = await tx.queryRow<{ id: number; user_id: string; farm_id: number; staked_amount: string; reward_debt: string; pending_rewards: string }>`
          SELECT * FROM staking_positions WHERE id = ${stakingPositionId} AND user_id = ${userId}
        `;
        if (!stakingPos) throw APIError.notFound("Staking position not found");

        await updateYieldFarmRewards(stakingPos.farm_id, tx);
        const farm = await tx.queryRow<{ reward_token: string; acc_reward_per_share: string }>`
          SELECT reward_token, acc_reward_per_share FROM yield_farming_pools WHERE id = ${stakingPos.farm_id}
        `;
        const accRewardPerShare = BigInt(farm!.acc_reward_per_share);
        const precision = 10n ** 18n;

        const stakedAmount = BigInt(stakingPos.staked_amount);
        const rewardDebt = BigInt(stakingPos.reward_debt);
        const pendingRewards = BigInt(stakingPos.pending_rewards);
        const rewardsToClaim = pendingRewards + (stakedAmount * accRewardPerShare / precision) - rewardDebt;

        if (rewardsToClaim <= 0n) {
          throw APIError.failedPrecondition("No rewards to claim");
        }

        await tx.exec`
          UPDATE user_balances SET balance = balance + ${rewardsToClaim.toString()}
          WHERE user_id = ${userId} AND currency = ${farm!.reward_token}
        `;

        const newRewardDebt = stakedAmount * accRewardPerShare / precision;
        await tx.exec`
          UPDATE staking_positions
          SET reward_debt = ${newRewardDebt.toString()},
              pending_rewards = '0',
              last_updated = NOW()
          WHERE id = ${stakingPositionId}
        `;

        await tx.commit();
        return { success: true, claimedAmount: rewardsToClaim.toString() };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

// Allows users to take out a flash loan for arbitrage.
export const executeFlashLoan = api<FlashLoanRequest, FlashLoanResponse>(
  { expose: true, method: "POST", path: "/amm/flash-loan" },
  async (req) => {
    return withPerformanceMonitoring("/amm/flash-loan", "POST", async () => {
      const { userId, loanToken, loanAmount, payload } = req;
      const loanAmountBigInt = BigInt(loanAmount);
      const FLASH_LOAN_FEE_BPS = 5;
      const MAX_FLASH_LOAN_AMOUNT = 10000000n;
      const REENTRANCY_GUARD_KEY = `flash_loan_${userId}`;

      if (loanAmountBigInt > MAX_FLASH_LOAN_AMOUNT) {
        throw APIError.invalidArgument(`Flash loan amount exceeds maximum of ${MAX_FLASH_LOAN_AMOUNT}`);
      }

      const fee = (loanAmountBigInt * BigInt(FLASH_LOAN_FEE_BPS)) / 10000n;
      const amountToRepay = loanAmountBigInt + fee;

      await using tx = await blockchainDB.begin();
      try {
        const existingLock = await tx.queryRow<{ user_id: string }>`
          SELECT user_id FROM flash_loan_locks WHERE user_id = ${userId} AND expires_at > NOW()
        `;
        if (existingLock) {
          throw APIError.failedPrecondition("Reentrancy attack detected - flash loan already in progress");
        }

        await tx.exec`
          INSERT INTO flash_loan_locks (user_id, expires_at) 
          VALUES (${userId}, NOW() + INTERVAL '1 minute')
          ON CONFLICT (user_id) DO UPDATE SET expires_at = NOW() + INTERVAL '1 minute'
        `;

        const pool = await tx.queryRow<{ reserve_a: string, reserve_b: string, token_a: string }>`
          SELECT reserve_a, reserve_b, token_a FROM liquidity_pools 
          WHERE (token_a = ${loanToken} AND token_b = 'USD') OR (token_a = 'USD' AND token_b = ${loanToken})
        `;
        if (!pool) throw APIError.failedPrecondition(`No USD liquidity pool for ${loanToken}`);

        const reserve = pool.token_a === loanToken ? BigInt(pool.reserve_a) : BigInt(pool.reserve_b);
        if (reserve < loanAmountBigInt) {
          throw APIError.failedPrecondition("Insufficient liquidity for flash loan");
        }

        // 2. Get user's initial balance
        const initialBalanceRow = await tx.queryRow<{ balance: string }>`
          SELECT balance FROM user_balances WHERE user_id = ${userId} AND currency = ${loanToken}
        `;
        const initialBalance = BigInt(initialBalanceRow?.balance || '0');

        // 3. Execute payload (arbitrage swaps)
        let currentBalances: Record<string, bigint> = { [loanToken]: initialBalance + loanAmountBigInt };

        for (const action of payload) {
          if (action.type === 'swap') {
            const amountIn = BigInt(action.amountIn);
            if ((currentBalances[action.tokenIn] || 0n) < amountIn) {
              throw new Error(`Payload tried to spend more ${action.tokenIn} than available`);
            }
            
            const swapPool = await tx.queryRow<{ id: number, token_a: string, token_b: string, reserve_a: string, reserve_b: string, fee_rate: number }>`
              SELECT id, token_a, token_b, reserve_a, reserve_b, fee_rate FROM liquidity_pools 
              WHERE (token_a = ${action.tokenIn} AND token_b = ${action.tokenOut})
                 OR (token_a = ${action.tokenOut} AND token_b = ${action.tokenIn})
            `;
            if (!swapPool) throw new Error(`Swap pool not found for ${action.tokenIn}/${action.tokenOut}`);

            const isTokenAInput = swapPool.token_a === action.tokenIn;
            const reserveIn = BigInt(isTokenAInput ? swapPool.reserve_a : swapPool.reserve_b);
            const reserveOut = BigInt(isTokenAInput ? swapPool.reserve_b : swapPool.reserve_a);
            const feeRate = BigInt(Math.floor(swapPool.fee_rate * 10000));
            const amountInWithFee = amountIn * (10000n - feeRate) / 10000n;
            const amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);

            // Update virtual balances
            currentBalances[action.tokenIn] = (currentBalances[action.tokenIn] || 0n) - amountIn;
            currentBalances[action.tokenOut] = (currentBalances[action.tokenOut] || 0n) + amountOut;

            // Update pool reserves for the swap
            if (isTokenAInput) {
              await tx.exec`
                UPDATE liquidity_pools SET 
                  reserve_a = (reserve_a::numeric + ${action.amountIn})::text,
                  reserve_b = (reserve_b::numeric - ${amountOut.toString()})::text
                WHERE id = ${swapPool.id}
              `;
            } else {
              await tx.exec`
                UPDATE liquidity_pools SET 
                  reserve_b = (reserve_b::numeric + ${action.amountIn})::text,
                  reserve_a = (reserve_a::numeric - ${amountOut.toString()})::text
                WHERE id = ${swapPool.id}
              `;
            }
          }
        }

        // 4. Check for repayment
        const finalLoanTokenBalance = currentBalances[loanToken] || 0n;
        if (finalLoanTokenBalance < initialBalance + amountToRepay) {
          throw APIError.failedPrecondition(`Flash loan not repaid. Required: ${amountToRepay}, but only ${finalLoanTokenBalance - initialBalance} was returned.`);
        }

        // 5. Finalize transaction
        const profit = finalLoanTokenBalance - initialBalance - amountToRepay;
        
        // Update all affected user balances
        for (const token in currentBalances) {
          const finalBalance = currentBalances[token];
          const originalBalanceRow = await tx.queryRow<{ balance: string }>`
            SELECT balance FROM user_balances WHERE user_id = ${userId} AND currency = ${token}
          `;
          const originalBalance = BigInt(originalBalanceRow?.balance || '0');
          const diff = finalBalance - originalBalance;

          if (token === loanToken) continue; // Handled separately

          if (diff !== 0n) {
            await tx.exec`
              UPDATE user_balances SET balance = balance + ${diff.toString()}
              WHERE user_id = ${userId} AND currency = ${token}
            `;
          }
        }
        
        // Update loan token balance with profit
        await tx.exec`
          UPDATE user_balances SET balance = balance + ${profit.toString()}
          WHERE user_id = ${userId} AND currency = ${loanToken}
        `;

        // Record flash loan
        const txHash = "0x" + crypto.randomBytes(32).toString('hex');
        await tx.exec`
          INSERT INTO flash_loans (user_id, token, amount, fee, status, repaid_amount, tx_hash)
          VALUES (${userId}, ${loanToken}, ${loanAmount}, ${fee.toString()}, 'completed', ${amountToRepay.toString()}, ${txHash})
        `;

        await tx.exec`
          DELETE FROM flash_loan_locks WHERE user_id = ${userId}
        `;

        await tx.commit();

        return {
          success: true,
          txHash,
          profit: profit.toString(),
          feePaid: fee.toString(),
        };

      } catch (error) {
        await tx.exec`
          DELETE FROM flash_loan_locks WHERE user_id = ${userId}
        `;
        await tx.rollback();
        if (error instanceof APIError) throw error;
        throw APIError.internal("Flash loan execution failed", error as Error);
      }
    });
  }
);
