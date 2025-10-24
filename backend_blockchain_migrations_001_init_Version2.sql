-- Simple migration for the network service cache table (Postgres)
-- Run this if you prefer to manage migrations externally instead of allowing the adapter to create tables.

CREATE TABLE IF NOT EXISTS network_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- You can add additional tables (validators, peers) here if you want to normalize the schema.