-- Enhanced flash loan security measures

-- Reentrancy protection table
CREATE TABLE IF NOT EXISTS flash_loan_locks (
  user_id TEXT PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flash loan rate limiting
CREATE TABLE IF NOT EXISTS flash_loan_rate_limits (
  user_id TEXT PRIMARY KEY,
  loan_count INTEGER DEFAULT 0,
  total_volume DECIMAL(78, 0) DEFAULT 0,
  last_loan_at TIMESTAMP WITH TIME ZONE,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flash loan audit trail
ALTER TABLE flash_loans ADD COLUMN IF NOT EXISTS profit DECIMAL(78, 0);
ALTER TABLE flash_loans ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE flash_loans ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_flash_loan_locks_expires ON flash_loan_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_flash_loan_rate_limits_window ON flash_loan_rate_limits(window_start);

COMMENT ON TABLE flash_loan_locks IS 'Prevents reentrancy attacks on flash loans';
COMMENT ON TABLE flash_loan_rate_limits IS 'Rate limiting for flash loan requests per user';
