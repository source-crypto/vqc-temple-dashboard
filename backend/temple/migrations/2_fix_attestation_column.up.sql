-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attestation_verification_status ON attestation_records(verification_status);
CREATE INDEX IF NOT EXISTS idx_attestation_canonical_hash ON attestation_records(canonical_hash);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_active ON activation_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_expires ON activation_tokens(expires_at);
