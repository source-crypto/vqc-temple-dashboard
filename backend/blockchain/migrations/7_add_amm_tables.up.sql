-- AMM (Automated Market Maker) tables

CREATE TABLE liquidity_pools (
  id BIGSERIAL PRIMARY KEY,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  reserve_a DECIMAL(78, 0) NOT NULL DEFAULT 0,
  reserve_b DECIMAL(78, 0) NOT NULL DEFAULT 0,
  total_liquidity DECIMAL(78, 0) NOT NULL DEFAULT 0,
  fee_rate DECIMAL(10, 6) NOT NULL DEFAULT 0.003, -- 0.3% default fee
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token_a, token_b)
);

CREATE TABLE liquidity_positions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  pool_id BIGINT NOT NULL REFERENCES liquidity_pools(id),
  liquidity_tokens DECIMAL(78, 0) NOT NULL DEFAULT 0,
  share_percentage DECIMAL(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pool_id)
);

CREATE TABLE yield_farming_pools (
  id BIGSERIAL PRIMARY KEY,
  pool_id BIGINT NOT NULL REFERENCES liquidity_pools(id),
  reward_token TEXT NOT NULL,
  reward_rate DECIMAL(78, 0) NOT NULL DEFAULT 0, -- Rewards per second
  total_staked DECIMAL(78, 0) NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE staking_positions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  farm_id BIGINT NOT NULL REFERENCES yield_farming_pools(id),
  staked_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  reward_debt DECIMAL(78, 0) NOT NULL DEFAULT 0,
  pending_rewards DECIMAL(78, 0) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, farm_id)
);

-- Indexes for AMM tables
CREATE INDEX idx_liquidity_pools_tokens ON liquidity_pools(token_a, token_b);
CREATE INDEX idx_liquidity_pools_reserves ON liquidity_pools(reserve_a, reserve_b);
CREATE INDEX idx_liquidity_positions_user ON liquidity_positions(user_id);
CREATE INDEX idx_liquidity_positions_pool ON liquidity_positions(pool_id);
CREATE INDEX idx_yield_farming_active ON yield_farming_pools(is_active, end_time);
CREATE INDEX idx_staking_positions_user ON staking_positions(user_id);
CREATE INDEX idx_staking_positions_farm ON staking_positions(farm_id);

-- Insert initial liquidity pools
INSERT INTO liquidity_pools (token_a, token_b, reserve_a, reserve_b, total_liquidity, fee_rate) VALUES
('ASM', 'USD', '1000000000000000000000000', '12500000000000000000', '111803398874989484820', 0.003),
('ASM', 'ETH', '1000000000000000000000000', '5000000000000000', '70710678118654752440', 0.003),
('USD', 'ETH', '2500000000000000000', '1000000000000000', '50000000000000000', 0.003);

-- Insert initial yield farming pools
INSERT INTO yield_farming_pools (pool_id, reward_token, reward_rate, start_time, end_time, is_active) VALUES
(1, 'ASM', '1000000000000000000', NOW(), NOW() + INTERVAL '30 days', true),
(2, 'ASM', '500000000000000000', NOW(), NOW() + INTERVAL '30 days', true),
(3, 'ASM', '750000000000000000', NOW(), NOW() + INTERVAL '30 days', true);

-- Add constraints
ALTER TABLE liquidity_pools ADD CONSTRAINT check_positive_reserves 
  CHECK (reserve_a >= 0 AND reserve_b >= 0);

ALTER TABLE liquidity_pools ADD CONSTRAINT check_positive_liquidity 
  CHECK (total_liquidity >= 0);

ALTER TABLE liquidity_positions ADD CONSTRAINT check_positive_liquidity_tokens 
  CHECK (liquidity_tokens >= 0);

ALTER TABLE staking_positions ADD CONSTRAINT check_positive_staked_amount 
  CHECK (staked_amount >= 0);

-- Comments
COMMENT ON TABLE liquidity_pools IS 'AMM liquidity pools for token swapping';
COMMENT ON TABLE liquidity_positions IS 'User liquidity provider positions';
COMMENT ON TABLE yield_farming_pools IS 'Yield farming reward pools';
COMMENT ON TABLE staking_positions IS 'User staking positions in yield farms';
