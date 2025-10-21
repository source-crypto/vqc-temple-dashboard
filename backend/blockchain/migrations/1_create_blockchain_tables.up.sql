CREATE TABLE blocks (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT UNIQUE NOT NULL,
  block_hash TEXT UNIQUE NOT NULL,
  parent_hash TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  miner_address TEXT NOT NULL,
  difficulty BIGINT NOT NULL,
  gas_limit BIGINT NOT NULL,
  gas_used BIGINT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL,
  nonce TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  state_root TEXT NOT NULL,
  receipts_root TEXT NOT NULL
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_index INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  value DECIMAL(78, 0) NOT NULL DEFAULT 0,
  gas_price BIGINT NOT NULL,
  gas_limit BIGINT NOT NULL,
  gas_used BIGINT,
  input_data TEXT,
  nonce BIGINT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contract_address TEXT,
  logs_bloom TEXT,
  FOREIGN KEY (block_number) REFERENCES blocks(block_number)
);

CREATE TABLE contracts (
  id BIGSERIAL PRIMARY KEY,
  contract_address TEXT UNIQUE NOT NULL,
  creator_address TEXT NOT NULL,
  creation_tx_hash TEXT NOT NULL,
  creation_block_number BIGINT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  bytecode TEXT NOT NULL,
  abi JSONB NOT NULL,
  source_code TEXT,
  compiler_version TEXT,
  optimization_enabled BOOLEAN DEFAULT true,
  verification_status TEXT DEFAULT 'unverified',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (creation_block_number) REFERENCES blocks(block_number)
);

CREATE TABLE token_balances (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  token_contract TEXT NOT NULL,
  balance DECIMAL(78, 0) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(address, token_contract)
);

CREATE TABLE token_transfers (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  token_contract TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  value DECIMAL(78, 0) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number)
);

CREATE TABLE network_stats (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_blocks BIGINT NOT NULL,
  total_transactions BIGINT NOT NULL,
  total_addresses BIGINT NOT NULL,
  total_contracts BIGINT NOT NULL,
  hash_rate DECIMAL(20, 2),
  difficulty BIGINT NOT NULL,
  block_time_avg DECIMAL(10, 2),
  gas_price_avg BIGINT,
  market_cap DECIMAL(20, 2),
  circulating_supply DECIMAL(78, 0)
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  operation_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  user_context JSONB,
  operation_details JSONB NOT NULL,
  outcome TEXT NOT NULL,
  error_details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT
);

CREATE INDEX idx_blocks_number ON blocks(block_number);
CREATE INDEX idx_blocks_hash ON blocks(block_hash);
CREATE INDEX idx_blocks_timestamp ON blocks(timestamp);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_block ON transactions(block_number);
CREATE INDEX idx_transactions_from ON transactions(from_address);
CREATE INDEX idx_transactions_to ON transactions(to_address);
CREATE INDEX idx_contracts_address ON contracts(contract_address);
CREATE INDEX idx_token_balances_address ON token_balances(address);
CREATE INDEX idx_token_transfers_contract ON token_transfers(token_contract);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_operation ON audit_logs(operation_type);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type);
