-- Ensure consistent column naming throughout the database
-- This migration ensures all references use 'tmp_quote' consistently

-- Check if any columns still use the old 'tpm_quote' naming
DO $$
BEGIN
    -- Rename any remaining tpm_quote columns to tmp_quote
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attestation_records' 
        AND column_name = 'tpm_quote'
    ) THEN
        ALTER TABLE attestation_records RENAME COLUMN tmp_quote TO tmp_quote;
        RAISE NOTICE 'Renamed tpm_quote column to tmp_quote';
    END IF;
END
$$;

-- Update any indexes that might reference the old column name
DROP INDEX IF EXISTS idx_attestation_tpm_quote;
CREATE INDEX IF NOT EXISTS idx_attestation_tmp_quote ON attestation_records(tmp_quote);

-- Add additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attestation_records_composite ON attestation_records(verification_status, timestamp);
CREATE INDEX IF NOT EXISTS idx_attestation_records_blockchain_tx ON attestation_records(blockchain_tx_hash) WHERE blockchain_tx_hash IS NOT NULL;

-- Ensure all foreign key constraints are properly named and consistent
-- Add any missing constraints for data integrity

-- Update table comments for documentation
COMMENT ON TABLE attestation_records IS 'TPM attestation records for VQC verification';
COMMENT ON COLUMN attestation_records.tmp_quote IS 'TPM quote data for attestation verification';
COMMENT ON COLUMN attestation_records.pcr_values IS 'Platform Configuration Register values as JSON';
COMMENT ON COLUMN attestation_records.canonical_hash IS 'SHA256 hash of canonical PCR values';
COMMENT ON COLUMN attestation_records.verification_status IS 'Verification status: pending, verified, or failed';
