-- Fix column name inconsistency in attestation_records table
-- Change tmp_quote to tmp_quote to match TypeScript interface

-- First, check if the column exists with the old name
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attestation_records' 
        AND column_name = 'tmp_quote'
    ) THEN
        -- Column already has correct name, do nothing
        RAISE NOTICE 'Column tmp_quote already exists with correct name';
    ELSE
        -- Check if column exists with wrong name and rename it
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'attestation_records' 
            AND column_name = 'tpm_quote'
        ) THEN
            ALTER TABLE attestation_records RENAME COLUMN tpm_quote TO tmp_quote;
            RAISE NOTICE 'Renamed column tpm_quote to tmp_quote';
        ELSE
            RAISE NOTICE 'Neither tpm_quote nor tmp_quote column found';
        END IF;
    END IF;
END
$$;

-- Ensure all other column names are consistent
-- Add any other column name fixes here if needed

-- Update indexes if they exist
DROP INDEX IF EXISTS idx_attestation_tpm_quote;
CREATE INDEX IF NOT EXISTS idx_attestation_tmp_quote ON attestation_records(tmp_quote);
