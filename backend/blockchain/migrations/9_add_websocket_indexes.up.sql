-- Indexes for WebSocket service query optimization

-- Index for efficient querying of swap transactions
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type_id ON currency_transactions(transaction_type, id);

-- Indexes for fetching latest records efficiently
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_id_desc ON liquidity_positions(id DESC);
CREATE INDEX IF NOT EXISTS idx_token_transfers_id_desc ON token_transfers(id DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_id_desc ON contracts(id DESC);
