-- Add currency exchange tables for native token trading
CREATE TABLE currency_exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  currency_pair TEXT NOT NULL, -- e.g., 'ASM/USD', 'ASM/ETH'
  rate DECIMAL(20, 8) NOT NULL,
  volume_24h DECIMAL(20, 2) DEFAULT 0,
  change_24h DECIMAL(10, 4) DEFAULT 0,
  market_cap DECIMAL(20, 2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT UNIQUE NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE currency_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'buy', 'sell', 'transfer'
  from_currency TEXT NOT NULL, -- 'USD', 'ASM', 'ETH'
  to_currency TEXT NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  to_amount DECIMAL(20, 8) NOT NULL,
  exchange_rate DECIMAL(20, 8) NOT NULL,
  fee_amount DECIMAL(20, 8) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  blockchain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_balances (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL, -- 'USD', 'ASM', 'ETH'
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  locked_balance DECIMAL(20, 8) NOT NULL DEFAULT 0, -- For pending transactions
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

-- Indexes for better performance
CREATE INDEX idx_exchange_rates_pair ON currency_exchange_rates(currency_pair);
CREATE INDEX idx_exchange_rates_timestamp ON currency_exchange_rates(timestamp);
CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_currency_transactions_user_id ON currency_transactions(user_id);
CREATE INDEX idx_currency_transactions_status ON currency_transactions(status);
CREATE INDEX idx_user_balances_user_id ON user_balances(user_id);

-- Insert initial exchange rates
INSERT INTO currency_exchange_rates (currency_pair, rate, volume_24h, change_24h, market_cap) VALUES
('ASM/USD', 0.0000125, 1500000.00, 5.25, 350000000.00),
('ASM/ETH', 0.000000005, 750000.00, -2.15, 350000000.00),
('ASM/BTC', 0.0000000003, 250000.00, 1.85, 350000000.00);
