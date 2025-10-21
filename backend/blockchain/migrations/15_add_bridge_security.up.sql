-- Enhanced bridge transfer security

-- Add replay protection and validation columns
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS nonce BIGINT;
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS replay_protection_hash TEXT UNIQUE;

-- Bridge transfer confirmations table
CREATE TABLE IF NOT EXISTS bridge_confirmations (
  id BIGSERIAL PRIMARY KEY,
  bridge_transfer_id BIGINT REFERENCES bridge_transfers(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  confirmation_count INTEGER DEFAULT 0,
  required_confirmations INTEGER DEFAULT 12,
  block_number BIGINT,
  is_finalized BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bridge validator registry
CREATE TABLE IF NOT EXISTS bridge_validators (
  id BIGSERIAL PRIMARY KEY,
  validator_address TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  network TEXT NOT NULL,
  reputation_score INTEGER DEFAULT 100,
  total_validations BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_confirmations_transfer ON bridge_confirmations(bridge_transfer_id);
CREATE INDEX IF NOT EXISTS idx_bridge_confirmations_finalized ON bridge_confirmations(is_finalized);
CREATE INDEX IF NOT EXISTS idx_bridge_validators_active ON bridge_validators(is_active, network);
CREATE INDEX IF NOT EXISTS idx_bridge_transfers_replay ON bridge_transfers(replay_protection_hash);

COMMENT ON TABLE bridge_confirmations IS 'Tracks blockchain confirmations for bridge transfers';
COMMENT ON TABLE bridge_validators IS 'Registry of approved validators for bridge operations';
