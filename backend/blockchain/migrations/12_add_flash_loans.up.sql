-- Add flash loan capabilities
CREATE TABLE flash_loans (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    amount DECIMAL(78, 0) NOT NULL,
    fee DECIMAL(78, 0) NOT NULL,
    status TEXT NOT NULL, -- 'completed', 'failed'
    repaid_amount DECIMAL(78, 0),
    tx_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE flash_loans IS 'Records of flash loans taken by users.';
CREATE INDEX idx_flash_loans_user_id ON flash_loans(user_id);
CREATE INDEX idx_flash_loans_token ON flash_loans(token);
