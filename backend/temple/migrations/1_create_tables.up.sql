CREATE TABLE vqc_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cycle_count BIGINT NOT NULL,
  entropy_level DOUBLE PRECISION NOT NULL,
  system_health DOUBLE PRECISION NOT NULL,
  quantum_coherence DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  power_consumption DOUBLE PRECISION NOT NULL
);

CREATE TABLE attestation_records (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pcr_values JSONB NOT NULL,
  tmp_quote TEXT NOT NULL,
  signature TEXT NOT NULL,
  canonical_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  blockchain_tx_hash TEXT
);

CREATE TABLE ceremonial_artifacts (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  artifact_type TEXT NOT NULL,
  content TEXT NOT NULL,
  entropy_seed TEXT NOT NULL,
  encryption_key TEXT NOT NULL,
  sealed_data TEXT NOT NULL
);

CREATE TABLE activation_tokens (
  id BIGSERIAL PRIMARY KEY,
  token_id TEXT UNIQUE NOT NULL,
  yubikey_serial TEXT NOT NULL,
  shamir_shares JSONB,
  threshold INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE system_harmonics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cpu_frequency DOUBLE PRECISION NOT NULL,
  network_activity DOUBLE PRECISION NOT NULL,
  db_stats JSONB NOT NULL,
  musical_pattern JSONB NOT NULL,
  laser_sync_data JSONB NOT NULL
);

CREATE INDEX idx_vqc_metrics_timestamp ON vqc_metrics(timestamp);
CREATE INDEX idx_attestation_timestamp ON attestation_records(timestamp);
CREATE INDEX idx_harmonics_timestamp ON system_harmonics(timestamp);
