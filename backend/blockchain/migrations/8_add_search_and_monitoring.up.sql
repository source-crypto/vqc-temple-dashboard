-- Search history and monitoring tables

CREATE TABLE search_history (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  search_count INTEGER NOT NULL DEFAULT 1,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(query)
);

CREATE TABLE performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  status_code INTEGER NOT NULL,
  memory_usage BIGINT NOT NULL, -- bytes
  cpu_usage DOUBLE PRECISION NOT NULL, -- milliseconds
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  details JSONB,
  is_resolved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for search and monitoring
CREATE INDEX idx_search_history_query ON search_history(query);
CREATE INDEX idx_search_history_timestamp ON search_history(timestamp DESC);
CREATE INDEX idx_performance_metrics_endpoint ON performance_metrics(endpoint, timestamp DESC);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity, created_at DESC);
CREATE INDEX idx_system_alerts_unresolved ON system_alerts(is_resolved, created_at DESC);

-- Add full-text search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search indexes
CREATE INDEX idx_contracts_name_trgm ON contracts USING gin (contract_name gin_trgm_ops);
CREATE INDEX idx_transactions_addresses_trgm ON transactions USING gin ((from_address || ' ' || COALESCE(to_address, '')) gin_trgm_ops);

-- Materialized view for search optimization
CREATE MATERIALIZED VIEW search_index AS
SELECT 
  'transaction' as type,
  tx_hash as identifier,
  from_address || ' ' || COALESCE(to_address, '') as searchable_text,
  timestamp,
  block_number
FROM transactions
UNION ALL
SELECT 
  'block' as type,
  block_hash as identifier,
  miner_address as searchable_text,
  timestamp,
  block_number
FROM blocks
UNION ALL
SELECT 
  'contract' as type,
  contract_address as identifier,
  contract_name || ' ' || creator_address as searchable_text,
  created_at as timestamp,
  creation_block_number as block_number
FROM contracts;

CREATE INDEX idx_search_index_type ON search_index(type);
CREATE INDEX idx_search_index_text ON search_index USING gin (searchable_text gin_trgm_ops);
CREATE INDEX idx_search_index_timestamp ON search_index(timestamp DESC);

-- Function to refresh search index
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE search_history IS 'User search history for analytics and suggestions';
COMMENT ON TABLE performance_metrics IS 'API endpoint performance metrics';
COMMENT ON TABLE system_alerts IS 'System alerts and notifications';
COMMENT ON MATERIALIZED VIEW search_index IS 'Optimized search index for all searchable content';
