-- Factability activation system for all protocols and data entities

-- Add factability flag to existing tables
ALTER TABLE liquidity_pools ADD COLUMN IF NOT EXISTS factability BOOLEAN DEFAULT false;
ALTER TABLE yield_farming_pools ADD COLUMN IF NOT EXISTS factability BOOLEAN DEFAULT false;
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS factability BOOLEAN DEFAULT false;
ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS factability BOOLEAN DEFAULT false;
ALTER TABLE flash_loans ADD COLUMN IF NOT EXISTS factability BOOLEAN DEFAULT false;

-- Create protocol activation tracking table
CREATE TABLE IF NOT EXISTS protocol_activations (
  id BIGSERIAL PRIMARY KEY,
  protocol_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  factability_status BOOLEAN DEFAULT false,
  activation_data JSONB,
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(protocol_name, entity_type, entity_id)
);

-- Create master activation log
CREATE TABLE IF NOT EXISTS activation_logs (
  id BIGSERIAL PRIMARY KEY,
  activation_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create protocol status tracking
CREATE TABLE IF NOT EXISTS protocol_status (
  id BIGSERIAL PRIMARY KEY,
  protocol_name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  total_entities INTEGER DEFAULT 0,
  activated_entities INTEGER DEFAULT 0,
  activation_percentage NUMERIC(5,2) DEFAULT 0.00,
  last_activation TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_protocol_activations_entity ON protocol_activations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_protocol_activations_status ON protocol_activations(factability_status);
CREATE INDEX IF NOT EXISTS idx_activation_logs_type ON activation_logs(activation_type, entity_type);
CREATE INDEX IF NOT EXISTS idx_protocol_status_active ON protocol_status(is_active);

-- Insert initial protocol records
INSERT INTO protocol_status (protocol_name, metadata) VALUES
  ('amm_pools', '{"description": "Automated Market Maker liquidity pools"}'::jsonb),
  ('yield_farming', '{"description": "Yield farming and staking pools"}'::jsonb),
  ('flash_loans', '{"description": "Flash loan system"}'::jsonb),
  ('bridge_transfers', '{"description": "Cross-chain bridge transfers"}'::jsonb),
  ('mobile_wallet', '{"description": "Mobile wallet integration"}'::jsonb),
  ('user_balances', '{"description": "User balance tracking"}'::jsonb)
ON CONFLICT (protocol_name) DO NOTHING;

COMMENT ON TABLE protocol_activations IS 'Tracks activation status for all protocol entities';
COMMENT ON TABLE activation_logs IS 'Audit trail for all activation events';
COMMENT ON TABLE protocol_status IS 'Overall status and metrics for each protocol';
