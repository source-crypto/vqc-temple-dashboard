import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import crypto from "crypto";
import { getCache, setCache } from "../shared/cache";

export interface Block {
  id: number;
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  timestamp: Date;
  minerAddress: string;
  difficulty: number;
  gasLimit: number;
  gasUsed: number;
  transactionCount: number;
  sizeBytes: number;
  nonce: string;
  merkleRoot: string;
  stateRoot: string;
  receiptsRoot: string;
}

export interface Transaction {
  id: number;
  txHash: string;
  blockNumber: number;
  transactionIndex: number;
  fromAddress: string;
  toAddress?: string;
  value: string;
  gasPrice: number;
  gasLimit: number;
  gasUsed?: number;
  inputData?: string;
  nonce: number;
  status: number;
  timestamp: Date;
  contractAddress?: string;
  logsBloom?: string;
}

export interface NetworkStats {
  totalBlocks: number;
  totalTransactions: number;
  totalAddresses: number;
  totalContracts: number;
  hashRate?: number;
  difficulty: number;
  blockTimeAvg?: number;
  gasPriceAvg?: number;
  marketCap?: number;
  circulatingSupply?: string;
}

export interface BlockListResponse {
  blocks: Block[];
  total: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
}

export interface SearchRequest {
  query: string;
}

export interface SearchResponse {
  type: 'block' | 'transaction' | 'address' | 'contract' | 'not_found';
  result?: any;
}

// Retrieves the latest blocks from the VQC blockchain.
export const getLatestBlocks = api<void, BlockListResponse>(
  { expose: true, method: "GET", path: "/explorer/blocks" },
  async () => {
    // Generate some mock blocks if none exist
    await ensureMockData();

    const rows = await blockchainDB.queryAll<{
      id: number;
      block_number: number;
      block_hash: string;
      parent_hash: string;
      timestamp: Date;
      miner_address: string;
      difficulty: number;
      gas_limit: number;
      gas_used: number;
      transaction_count: number;
      size_bytes: number;
      nonce: string;
      merkle_root: string;
      state_root: string;
      receipts_root: string;
    }>`
      SELECT * FROM blocks 
      ORDER BY block_number DESC 
      LIMIT 20
    `;

    const blocks = rows.map(row => ({
      id: row.id,
      blockNumber: row.block_number,
      blockHash: row.block_hash,
      parentHash: row.parent_hash,
      timestamp: row.timestamp,
      minerAddress: row.miner_address,
      difficulty: row.difficulty,
      gasLimit: row.gas_limit,
      gasUsed: row.gas_used,
      transactionCount: row.transaction_count,
      sizeBytes: row.size_bytes,
      nonce: row.nonce,
      merkleRoot: row.merkle_root,
      stateRoot: row.state_root,
      receiptsRoot: row.receipts_root,
    }));

    return {
      blocks,
      total: blocks.length
    };
  }
);

// Retrieves the latest transactions from the VQC blockchain.
export const getLatestTransactions = api<void, TransactionListResponse>(
  { expose: true, method: "GET", path: "/explorer/transactions" },
  async () => {
    const rows = await blockchainDB.queryAll<{
      id: number;
      tx_hash: string;
      block_number: number;
      transaction_index: number;
      from_address: string;
      to_address: string | null;
      value: string;
      gas_price: number;
      gas_limit: number;
      gas_used: number | null;
      input_data: string | null;
      nonce: number;
      status: number;
      timestamp: Date;
      contract_address: string | null;
      logs_bloom: string | null;
    }>`
      SELECT * FROM transactions 
      ORDER BY timestamp DESC 
      LIMIT 20
    `;

    const transactions = rows.map(row => ({
      id: row.id,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      transactionIndex: row.transaction_index,
      fromAddress: row.from_address,
      toAddress: row.to_address || undefined,
      value: row.value,
      gasPrice: row.gas_price,
      gasLimit: row.gas_limit,
      gasUsed: row.gas_used || undefined,
      inputData: row.input_data || undefined,
      nonce: row.nonce,
      status: row.status,
      timestamp: row.timestamp,
      contractAddress: row.contract_address || undefined,
      logsBloom: row.logs_bloom || undefined,
    }));

    return {
      transactions,
      total: transactions.length
    };
  }
);

// Retrieves network statistics for the VQC blockchain.
export const getNetworkStats = api<void, NetworkStats>(
  { expose: true, method: "GET", path: "/explorer/stats" },
  async () => {
    const cacheKey = 'network-stats';
    const cachedData = getCache<NetworkStats>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const blockCount = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM blocks
    `;

    const txCount = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM transactions
    `;

    const contractCount = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM contracts
    `;

    const addressCount = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT from_address) as count FROM transactions
    `;

    const latestBlock = await blockchainDB.queryRow<{
      difficulty: number;
      timestamp: Date;
    }>`
      SELECT difficulty, timestamp FROM blocks 
      ORDER BY block_number DESC 
      LIMIT 1
    `;

    const avgGasPrice = await blockchainDB.queryRow<{ avg: number }>`
      SELECT AVG(gas_price) as avg FROM transactions 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;

    // Calculate average block time
    const blockTimes = await blockchainDB.queryAll<{ diff: number }>`
      SELECT EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY block_number))) as diff
      FROM blocks 
      ORDER BY block_number DESC 
      LIMIT 100
    `;

    const avgBlockTime = blockTimes.length > 0 
      ? blockTimes.reduce((sum, b) => sum + (b.diff || 0), 0) / blockTimes.length 
      : 15;

    const response = {
      totalBlocks: blockCount?.count || 0,
      totalTransactions: txCount?.count || 0,
      totalAddresses: addressCount?.count || 0,
      totalContracts: contractCount?.count || 0,
      hashRate: Math.random() * 1000000 + 500000, // Mock hash rate
      difficulty: latestBlock?.difficulty || 1000000,
      blockTimeAvg: avgBlockTime,
      gasPriceAvg: avgGasPrice?.avg || 20000000000,
      marketCap: Math.random() * 1000000000 + 500000000, // Mock market cap
      circulatingSupply: "28000000000000000000000000000000000" // 28 trillion
    };

    setCache(cacheKey, response, 15000); // Cache for 15 seconds
    return response;
  }
);

export interface BlockDetailsRequest {
  blockNumber: string;
}

export interface BlockDetailsResponse {
  block: Block;
  transactions: Transaction[];
}

// Retrieves detailed information about a specific block.
export const getBlockDetails = api<BlockDetailsRequest, BlockDetailsResponse>(
  { expose: true, method: "GET", path: "/explorer/block/:blockNumber" },
  async (req) => {
    const blockNum = parseInt(req.blockNumber);
    if (isNaN(blockNum)) {
      throw APIError.invalidArgument("Invalid block number");
    }

    const block = await blockchainDB.queryRow<{
      id: number;
      block_number: number;
      block_hash: string;
      parent_hash: string;
      timestamp: Date;
      miner_address: string;
      difficulty: number;
      gas_limit: number;
      gas_used: number;
      transaction_count: number;
      size_bytes: number;
      nonce: string;
      merkle_root: string;
      state_root: string;
      receipts_root: string;
    }>`
      SELECT * FROM blocks 
      WHERE block_number = ${blockNum}
    `;

    if (!block) {
      throw APIError.notFound("Block not found");
    }

    const transactions = await blockchainDB.queryAll<{
      id: number;
      tx_hash: string;
      block_number: number;
      transaction_index: number;
      from_address: string;
      to_address: string | null;
      value: string;
      gas_price: number;
      gas_limit: number;
      gas_used: number | null;
      input_data: string | null;
      nonce: number;
      status: number;
      timestamp: Date;
      contract_address: string | null;
      logs_bloom: string | null;
    }>`
      SELECT * FROM transactions 
      WHERE block_number = ${blockNum}
      ORDER BY transaction_index
    `;

    return {
      block: {
        id: block.id,
        blockNumber: block.block_number,
        blockHash: block.block_hash,
        parentHash: block.parent_hash,
        timestamp: block.timestamp,
        minerAddress: block.miner_address,
        difficulty: block.difficulty,
        gasLimit: block.gas_limit,
        gasUsed: block.gas_used,
        transactionCount: block.transaction_count,
        sizeBytes: block.size_bytes,
        nonce: block.nonce,
        merkleRoot: block.merkle_root,
        stateRoot: block.state_root,
        receiptsRoot: block.receipts_root,
      },
      transactions: transactions.map(tx => ({
        id: tx.id,
        txHash: tx.tx_hash,
        blockNumber: tx.block_number,
        transactionIndex: tx.transaction_index,
        fromAddress: tx.from_address,
        toAddress: tx.to_address || undefined,
        value: tx.value,
        gasPrice: tx.gas_price,
        gasLimit: tx.gas_limit,
        gasUsed: tx.gas_used || undefined,
        inputData: tx.input_data || undefined,
        nonce: tx.nonce,
        status: tx.status,
        timestamp: tx.timestamp,
        contractAddress: tx.contract_address || undefined,
        logsBloom: tx.logs_bloom || undefined,
      }))
    };
  }
);

// Searches the blockchain for blocks, transactions, addresses, or contracts.
export const search = api<SearchRequest, SearchResponse>(
  { expose: true, method: "GET", path: "/explorer/search" },
  async (req) => {
    if (!req.query || req.query.trim().length === 0) {
      throw APIError.invalidArgument("Search query is required");
    }

    const query = req.query.trim();

    // Check if it's a block number
    if (/^\d+$/.test(query)) {
      const blockNum = parseInt(query);
      const block = await blockchainDB.queryRow`
        SELECT * FROM blocks WHERE block_number = ${blockNum}
      `;
      if (block) {
        return { type: 'block', result: block };
      }
    }

    // Check if it's a transaction hash
    if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      const tx = await blockchainDB.queryRow`
        SELECT * FROM transactions WHERE tx_hash = ${query}
      `;
      if (tx) {
        return { type: 'transaction', result: tx };
      }
    }

    // Check if it's a block hash
    if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      const block = await blockchainDB.queryRow`
        SELECT * FROM blocks WHERE block_hash = ${query}
      `;
      if (block) {
        return { type: 'block', result: block };
      }
    }

    // Check if it's an address
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      const contract = await blockchainDB.queryRow`
        SELECT * FROM contracts WHERE contract_address = ${query}
      `;
      if (contract) {
        return { type: 'contract', result: contract };
      }

      // Check if it's a regular address with transactions
      const txCount = await blockchainDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM transactions 
        WHERE from_address = ${query} OR to_address = ${query}
      `;
      if (txCount && txCount.count > 0) {
        return { type: 'address', result: { address: query, transactionCount: txCount.count } };
      }
    }

    return { type: 'not_found' };
  }
);

async function ensureMockData() {
  const blockCount = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM blocks
  `;

  if (blockCount && blockCount.count === 0) {
    // Generate some mock blocks and transactions
    for (let i = 1; i <= 10; i++) {
      const blockHash = "0x" + crypto.randomBytes(32).toString('hex');
      const parentHash = i === 1 ? "0x" + "0".repeat(64) : "0x" + crypto.randomBytes(32).toString('hex');
      const minerAddress = "0x" + crypto.randomBytes(20).toString('hex');
      const nonce = crypto.randomBytes(8).toString('hex');
      const merkleRoot = "0x" + crypto.randomBytes(32).toString('hex');
      const stateRoot = "0x" + crypto.randomBytes(32).toString('hex');
      const receiptsRoot = "0x" + crypto.randomBytes(32).toString('hex');

      await blockchainDB.exec`
        INSERT INTO blocks (
          block_number, block_hash, parent_hash, miner_address, difficulty,
          gas_limit, gas_used, transaction_count, size_bytes, nonce,
          merkle_root, state_root, receipts_root
        )
        VALUES (
          ${i}, ${blockHash}, ${parentHash}, ${minerAddress}, ${1000000 + i * 1000},
          ${8000000}, ${Math.floor(Math.random() * 7000000) + 1000000}, ${Math.floor(Math.random() * 50) + 1},
          ${Math.floor(Math.random() * 50000) + 10000}, ${nonce},
          ${merkleRoot}, ${stateRoot}, ${receiptsRoot}
        )
      `;

      // Generate some transactions for each block
      const txCount = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < txCount; j++) {
        const txHash = "0x" + crypto.randomBytes(32).toString('hex');
        const fromAddress = "0x" + crypto.randomBytes(20).toString('hex');
        const toAddress = "0x" + crypto.randomBytes(20).toString('hex');
        const value = Math.floor(Math.random() * 1000000000000000000).toString();

        await blockchainDB.exec`
          INSERT INTO transactions (
            tx_hash, block_number, transaction_index, from_address, to_address,
            value, gas_price, gas_limit, gas_used, nonce, status
          )
          VALUES (
            ${txHash}, ${i}, ${j}, ${fromAddress}, ${toAddress},
            ${value}, ${20000000000}, ${21000}, ${21000}, ${j}, 1
          )
        `;
      }
    }
  }
}
