import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLatestBlocks, getLatestTransactions, getNetworkStats, getBlockDetails, search } from '../explorer';
import { blockchainDB } from '../db';
import crypto from 'crypto';

describe('Blockchain Explorer API', () => {
  beforeEach(async () => {
    // Ensure mock data exists
    await ensureMockDataExists();
  });

  afterEach(async () => {
    // Clean up test data if needed
  });

  describe('getLatestBlocks', () => {
    it('should return latest blocks', async () => {
      const response = await getLatestBlocks();

      expect(response.blocks).toBeDefined();
      expect(Array.isArray(response.blocks)).toBe(true);
      expect(response.total).toBeDefined();
      
      if (response.blocks.length > 0) {
        const block = response.blocks[0];
        expect(block.id).toBeDefined();
        expect(block.blockNumber).toBeDefined();
        expect(block.blockHash).toBeDefined();
        expect(block.timestamp).toBeDefined();
        expect(block.minerAddress).toBeDefined();
      }
    });

    it('should return blocks in descending order', async () => {
      const response = await getLatestBlocks();

      if (response.blocks.length > 1) {
        for (let i = 1; i < response.blocks.length; i++) {
          expect(response.blocks[i - 1].blockNumber).toBeGreaterThanOrEqual(
            response.blocks[i].blockNumber
          );
        }
      }
    });
  });

  describe('getLatestTransactions', () => {
    it('should return latest transactions', async () => {
      const response = await getLatestTransactions();

      expect(response.transactions).toBeDefined();
      expect(Array.isArray(response.transactions)).toBe(true);
      expect(response.total).toBeDefined();
      
      if (response.transactions.length > 0) {
        const tx = response.transactions[0];
        expect(tx.id).toBeDefined();
        expect(tx.txHash).toBeDefined();
        expect(tx.blockNumber).toBeDefined();
        expect(tx.fromAddress).toBeDefined();
        expect(tx.value).toBeDefined();
      }
    });
  });

  describe('getNetworkStats', () => {
    it('should return comprehensive network statistics', async () => {
      const response = await getNetworkStats();

      expect(response.totalBlocks).toBeGreaterThanOrEqual(0);
      expect(response.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(response.totalAddresses).toBeGreaterThanOrEqual(0);
      expect(response.totalContracts).toBeGreaterThanOrEqual(0);
      expect(response.difficulty).toBeGreaterThan(0);
      expect(response.circulatingSupply).toBe('28000000000000000000000000000000000');
    });

    it('should include optional metrics', async () => {
      const response = await getNetworkStats();

      if (response.hashRate) {
        expect(response.hashRate).toBeGreaterThan(0);
      }
      
      if (response.blockTimeAvg) {
        expect(response.blockTimeAvg).toBeGreaterThan(0);
      }
      
      if (response.gasPriceAvg) {
        expect(response.gasPriceAvg).toBeGreaterThan(0);
      }
    });
  });

  describe('getBlockDetails', () => {
    it('should return block details for valid block number', async () => {
      // First get a block number that exists
      const blocksResponse = await getLatestBlocks();
      
      if (blocksResponse.blocks.length > 0) {
        const blockNumber = blocksResponse.blocks[0].blockNumber.toString();
        
        const response = await getBlockDetails({ blockNumber });

        expect(response.block).toBeDefined();
        expect(response.transactions).toBeDefined();
        expect(Array.isArray(response.transactions)).toBe(true);
        expect(response.block.blockNumber).toBe(parseInt(blockNumber));
      }
    });

    it('should reject invalid block number', async () => {
      const request = {
        blockNumber: 'invalid'
      };

      await expect(getBlockDetails(request)).rejects.toThrow();
    });

    it('should return not found for non-existent block', async () => {
      const request = {
        blockNumber: '999999999'
      };

      await expect(getBlockDetails(request)).rejects.toThrow();
    });
  });

  describe('search', () => {
    it('should find block by number', async () => {
      const blocksResponse = await getLatestBlocks();
      
      if (blocksResponse.blocks.length > 0) {
        const blockNumber = blocksResponse.blocks[0].blockNumber.toString();
        
        const response = await search({ query: blockNumber });

        expect(response.type).toBe('block');
        expect(response.result).toBeDefined();
      }
    });

    it('should find transaction by hash', async () => {
      const txResponse = await getLatestTransactions();
      
      if (txResponse.transactions.length > 0) {
        const txHash = txResponse.transactions[0].txHash;
        
        const response = await search({ query: txHash });

        expect(response.type).toBe('transaction');
        expect(response.result).toBeDefined();
      }
    });

    it('should return not found for invalid query', async () => {
      const response = await search({ query: 'nonexistent' });

      expect(response.type).toBe('not_found');
    });

    it('should reject empty query', async () => {
      const request = {
        query: ''
      };

      await expect(search(request)).rejects.toThrow();
    });
  });
});

async function ensureMockDataExists() {
  const blockCount = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM blocks
  `;

  if (blockCount && blockCount.count === 0) {
    // Create some test data
    const blockHash = "0x" + crypto.randomBytes(32).toString('hex');
    const parentHash = "0x" + "0".repeat(64);
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
        1, ${blockHash}, ${parentHash}, ${minerAddress}, 1000000,
        8000000, 1000000, 1, 10000, ${nonce},
        ${merkleRoot}, ${stateRoot}, ${receiptsRoot}
      )
    `;

    const txHash = "0x" + crypto.randomBytes(32).toString('hex');
    const fromAddress = "0x" + crypto.randomBytes(20).toString('hex');
    const toAddress = "0x" + crypto.randomBytes(20).toString('hex');

    await blockchainDB.exec`
      INSERT INTO transactions (
        tx_hash, block_number, transaction_index, from_address, to_address,
        value, gas_price, gas_limit, gas_used, nonce, status
      )
      VALUES (
        ${txHash}, 1, 0, ${fromAddress}, ${toAddress},
        '1000000000000000000', 20000000000, 21000, 21000, 0, 1
      )
    `;
  }
}
