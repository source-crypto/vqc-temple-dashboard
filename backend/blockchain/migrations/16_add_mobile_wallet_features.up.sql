-- Mobile wallet integration features

CREATE TABLE IF NOT EXISTS mobile_wallet_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS mobile_qr_codes (
  id BIGSERIAL PRIMARY KEY,
  qr_code_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  used BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mobile_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  biometric_enabled BOOLEAN DEFAULT true,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_wallet_keys_user ON mobile_wallet_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_qr_codes_expires ON mobile_qr_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_mobile_qr_codes_used ON mobile_qr_codes(used);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_token ON mobile_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_user ON mobile_sessions(user_id);

COMMENT ON TABLE mobile_wallet_keys IS 'Secure storage for mobile wallet encryption keys';
COMMENT ON TABLE mobile_qr_codes IS 'QR code generation and validation for mobile transactions';
COMMENT ON TABLE mobile_sessions IS 'Mobile app session management';
