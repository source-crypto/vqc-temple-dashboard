-- Enhanced indexing for query optimization

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_block_status ON transactions(block_number, status);
CREATE INDEX IF NOT EXISTS idx_transactions_from_to ON transactions(from_address, to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_value_desc ON transactions(value DESC) WHERE value > 0;
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp_desc ON transactions(timestamp DESC);

-- Covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_explorer_covering ON transactions(timestamp DESC) 
INCLUDE (tx_hash, from_address, to_address, value, status);

CREATE INDEX IF NOT EXISTS idx_blocks_explorer_covering ON blocks(block_number DESC) 
INCLUDE (block_hash, timestamp, miner_address, transaction_count, gas_used, gas_limit);

-- Token transfer optimization
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_timestamp ON token_transfers(token_contract, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_transfers_address_timestamp ON token_transfers(from_address, timestamp DESC);

-- Exchange rate optimization
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_timestamp ON currency_exchange_rates(currency_pair, last_updated DESC);

-- User balance optimization
CREATE INDEX IF NOT EXISTS idx_user_balances_user_currency ON user_balances(user_id, currency);

-- Transaction history optimization
CREATE INDEX IF NOT EXISTS idx_currency_transactions_user_timestamp ON currency_transactions(user_id, created_at DESC);

-- Add table statistics for query planner
ANALYZE blocks;
ANALYZE transactions;
ANALYZE contracts;
ANALYZE token_transfers;
ANALYZE currency_exchange_rates;
ANALYZE user_balances;
ANALYZE currency_transactions;

-- Create materialized view for network statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS network_stats_mv AS
SELECT 
  COUNT(*) as total_blocks,
  MAX(block_number) as latest_block,
  COUNT(DISTINCT miner_address) as unique_miners,
  AVG(gas_used::numeric / gas_limit::numeric) as avg_gas_utilization,
  SUM(transaction_count) as total_transactions
FROM blocks
WHERE timestamp > NOW() - INTERVAL '24 hours';

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_stats_mv ON network_stats_mv (total_blocks);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_network_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY network_stats_mv;
END;
$$ LANGUAGE plpgsql;
