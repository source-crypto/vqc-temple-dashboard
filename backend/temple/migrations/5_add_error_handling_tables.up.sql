-- Add tables for enhanced error handling and monitoring

CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  user_context JSONB,
  request_data JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  memory_usage_mb DOUBLE PRECISION,
  cpu_usage_percent DOUBLE PRECISION,
  database_queries INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  status_code INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_id TEXT,
  endpoint TEXT NOT NULL,
  limit_type TEXT NOT NULL,
  violation_count INTEGER DEFAULT 1,
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_operation ON error_logs(operation_type);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_request_id ON error_logs(request_id);

CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX idx_performance_metrics_operation ON performance_metrics(operation_type);
CREATE INDEX idx_performance_metrics_duration ON performance_metrics(duration_ms);

CREATE INDEX idx_rate_limit_violations_timestamp ON rate_limit_violations(timestamp);
CREATE INDEX idx_rate_limit_violations_ip ON rate_limit_violations(ip_address);
CREATE INDEX idx_rate_limit_violations_endpoint ON rate_limit_violations(endpoint);

-- Add table comments
COMMENT ON TABLE error_logs IS 'Centralized error logging for debugging and monitoring';
COMMENT ON TABLE performance_metrics IS 'Performance metrics for API endpoints and operations';
COMMENT ON TABLE rate_limit_violations IS 'Rate limiting violations for security monitoring';
