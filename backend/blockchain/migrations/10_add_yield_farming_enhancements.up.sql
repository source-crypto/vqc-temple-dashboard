-- Add time-lock features to yield farming
ALTER TABLE yield_farming_pools ADD COLUMN IF NOT EXISTS lock_period_days INTEGER DEFAULT 0;
COMMENT ON COLUMN yield_farming_pools.lock_period_days IS 'Staking lock period in days. 0 means no lock.';

ALTER TABLE staking_positions ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN staking_positions.locked_until IS 'Timestamp until which the staked amount is locked.';

-- Add accumulated rewards per share to farming pools for efficient reward calculation
ALTER TABLE yield_farming_pools ADD COLUMN IF NOT EXISTS acc_reward_per_share DECIMAL(78, 0) NOT NULL DEFAULT 0;
COMMENT ON COLUMN yield_farming_pools.acc_reward_per_share IS 'Accumulated rewards per share, used for calculating user rewards.';

-- Update existing yield farming pools with default lock period
UPDATE yield_farming_pools SET lock_period_days = 0 WHERE lock_period_days IS NULL;

-- Add comments for clarity
COMMENT ON TABLE yield_farming_pools IS 'Yield farming reward pools with staking capabilities.';
COMMENT ON TABLE staking_positions IS 'User staking positions in yield farms, including lock details.';
