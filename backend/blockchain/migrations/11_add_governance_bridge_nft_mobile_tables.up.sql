-- Decentralized Governance
CREATE TABLE governance_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active, succeeded, defeated, executed
    for_votes DECIMAL(78, 0) NOT NULL DEFAULT 0,
    against_votes DECIMAL(78, 0) NOT NULL DEFAULT 0,
    abstain_votes DECIMAL(78, 0) NOT NULL DEFAULT 0,
    execution_tx_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE governance_votes (
    id BIGSERIAL PRIMARY KEY,
    proposal_id BIGINT NOT NULL REFERENCES governance_proposals(id),
    voter_id TEXT NOT NULL,
    vote_option TEXT NOT NULL, -- 'for', 'against', 'abstain'
    voting_weight DECIMAL(78, 0) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, voter_id)
);

-- Cross-Chain Bridge
CREATE TABLE bridge_transfers (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_network TEXT NOT NULL,
    to_network TEXT NOT NULL,
    token_address TEXT NOT NULL,
    amount DECIMAL(78, 0) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, failed
    initiation_tx_hash TEXT UNIQUE NOT NULL,
    completion_tx_hash TEXT,
    fee DECIMAL(78, 0) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    unlock_time TIMESTAMP WITH TIME ZONE -- For time-locked large transfers
);

CREATE TABLE multi_sig_transactions (
    id BIGSERIAL PRIMARY KEY,
    bridge_transfer_id BIGINT NOT NULL REFERENCES bridge_transfers(id),
    required_signatures INTEGER NOT NULL,
    signed_by JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' -- pending, approved, rejected
);

-- NFT Marketplace
CREATE TABLE nfts (
    id BIGSERIAL PRIMARY KEY,
    artifact_id BIGINT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    token_uri TEXT NOT NULL,
    mint_tx_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nft_listings (
    id BIGSERIAL PRIMARY KEY,
    nft_id BIGINT NOT NULL REFERENCES nfts(id),
    seller_id TEXT NOT NULL,
    price DECIMAL(78, 0) NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, sold, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Mobile Wallet Integration
CREATE TABLE push_notification_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_token TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL, -- 'ios', 'android'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX idx_governance_votes_voter ON governance_votes(voter_id);
CREATE INDEX idx_bridge_transfers_user ON bridge_transfers(user_id);
CREATE INDEX idx_bridge_transfers_status ON bridge_transfers(status);
CREATE INDEX idx_nfts_owner ON nfts(owner_id);
CREATE INDEX idx_nft_listings_status ON nft_listings(status);
CREATE INDEX idx_push_subscriptions_user ON push_notification_subscriptions(user_id);
