import { monitoredBlockchainDB as blockchainDB } from "./db";
import { api } from "encore.dev/api";
import crypto from "crypto";

async function seedBlocksAndTransactions(): Promise<void> {
  const existingBlockCount = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM blocks
  `;

  if (existingBlockCount && existingBlockCount.count > 0) {
    console.log('Blockchain blocks and transactions already exist, skipping...');
    return;
  }

  console.log('Seeding blockchain blocks and transactions...');
  
  for (let i = 1; i <= 20; i++) {
    const blockHash = "0x" + crypto.randomBytes(32).toString('hex');
    const parentHash = i === 1 ? "0x" + "0".repeat(64) : "0x" + crypto.randomBytes(32).toString('hex');
    const minerAddress = "0x" + crypto.randomBytes(20).toString('hex');
    const nonce = crypto.randomBytes(8).toString('hex');
    const merkleRoot = "0x" + crypto.randomBytes(32).toString('hex');
    const stateRoot = "0x" + crypto.randomBytes(32).toString('hex');
    const receiptsRoot = "0x" + crypto.randomBytes(32).toString('hex');
    const timestamp = new Date(Date.now() - ((20 - i) * 15000)); // 15 seconds per block
    
    await blockchainDB.exec`
      INSERT INTO blocks (
        block_number, block_hash, parent_hash, timestamp, miner_address, difficulty,
        gas_limit, gas_used, transaction_count, size_bytes, nonce,
        merkle_root, state_root, receipts_root
      )
      VALUES (
        ${i}, ${blockHash}, ${parentHash}, ${timestamp}, ${minerAddress}, ${1000000 + i * 1000},
        ${8000000}, ${Math.floor(Math.random() * 7000000) + 1000000}, ${Math.floor(Math.random() * 50) + 1},
        ${Math.floor(Math.random() * 50000) + 10000}, ${nonce},
        ${merkleRoot}, ${stateRoot}, ${receiptsRoot}
      )
    `;
    
    const txCount = Math.floor(Math.random() * 10) + 1;
    for (let j = 0; j < txCount; j++) {
      const txHash = "0x" + crypto.randomBytes(32).toString('hex');
      const fromAddress = "0x" + crypto.randomBytes(20).toString('hex');
      const toAddress = "0x" + crypto.randomBytes(20).toString('hex');
      const value = Math.floor(Math.random() * 1000000000000000000).toString();
      
      await blockchainDB.exec`
        INSERT INTO transactions (
          tx_hash, block_number, transaction_index, from_address, to_address,
          value, gas_price, gas_limit, gas_used, nonce, status, timestamp
        )
        VALUES (
          ${txHash}, ${i}, ${j}, ${fromAddress}, ${toAddress},
          ${value}, ${20000000000}, ${21000}, ${21000}, ${j}, 1, ${timestamp}
        )
      `;
    }
  }
}

async function seedContracts(): Promise<void> {
  const existingContractCount = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM contracts
  `;

  if (existingContractCount && existingContractCount.count > 0) {
    console.log('Blockchain contracts already exist, skipping...');
    return;
  }

  console.log('Seeding blockchain contracts...');
  
  const contractTypes = ['infrastructure', 'token', 'utility'];
  const contractNames = ['VQCTempleInfrastructure', 'Assimilator', 'QuantumOracle'];
  
  const latestBlock = await blockchainDB.queryRow<{ block_number: number }>`
    SELECT block_number FROM blocks ORDER BY block_number DESC LIMIT 1
  `;
  const maxBlockNumber = latestBlock?.block_number || 1;

  for (let i = 0; i < 3; i++) {
    const contractAddress = "0x" + crypto.randomBytes(20).toString('hex');
    const creatorAddress = "0x" + crypto.randomBytes(20).toString('hex');
    const txHash = "0x" + crypto.randomBytes(32).toString('hex');
    const blockNumber = Math.floor(Math.random() * maxBlockNumber) + 1;
    const bytecode = "0x608060405234801561001057600080fd5b50" + crypto.randomBytes(500).toString('hex');
    
    const abi = {
      name: contractNames[i],
      functions: [
        {
          name: "transfer",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ name: "success", type: "bool" }]
        }
      ]
    };
    
    const sourceCode = `pragma solidity ^0.8.0; contract ${contractNames[i]} { }`;
    
    await blockchainDB.exec`
      INSERT INTO contracts (
        contract_address, creator_address, creation_tx_hash, creation_block_number,
        contract_name, contract_type, bytecode, abi, source_code, compiler_version,
        optimization_enabled, verification_status
      )
      VALUES (
        ${contractAddress}, ${creatorAddress}, ${txHash}, ${blockNumber},
        ${contractNames[i]}, ${contractTypes[i]}, ${bytecode}, ${JSON.stringify(abi)},
        ${sourceCode}, '0.8.19', true, 'verified'
      )
    `;
  }
}

async function seedExchangeRates(): Promise<void> {
  const existingRates = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM currency_exchange_rates
  `;

  if (existingRates && existingRates.count > 0) {
    console.log('Exchange rates already exist, skipping...');
    return;
  }

  console.log('Seeding exchange rates...');
  
  await blockchainDB.exec`
    INSERT INTO currency_exchange_rates (currency_pair, rate, volume_24h, change_24h, market_cap) VALUES
    ('ASM/USD', 0.0000125, 1500000.00, 5.25, 350000000.00),
    ('ASM/ETH', 0.000000005, 750000.00, -2.15, 350000000.00),
    ('ASM/BTC', 0.0000000003, 250000.00, 1.85, 350000000.00)
  `;
}

async function seedUserWalletAndBalances(): Promise<void> {
  const userId = 'demo-user-123';
  const existingWallet = await blockchainDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM user_wallets WHERE user_id = ${userId}
  `;

  if (existingWallet && existingWallet.count > 0) {
    console.log('Demo user wallet already exists, skipping...');
    return;
  }

  console.log('Seeding demo user wallet and balances...');

  const address = "0x" + crypto.randomBytes(20).toString('hex');
  const privateKey = crypto.randomBytes(32).toString('hex');
  const encryptedPrivateKey = crypto.createHash('sha256').update(privateKey + userId).digest('hex');
  
  await blockchainDB.exec`
    INSERT INTO user_wallets (user_id, address, private_key_encrypted)
    VALUES (${userId}, ${address}, ${encryptedPrivateKey})
  `;

  await blockchainDB.exec`
    INSERT INTO user_balances (user_id, currency, balance)
    VALUES 
      (${userId}, 'USD', 1000.00),
      (${userId}, 'ASM', 500000.00),
      (${userId}, 'ETH', 1.5),
      (${userId}, 'BTC', 0.05)
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = EXCLUDED.balance;
  `;
}

export const seedBlockchainData = api<void, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/admin/seed-blockchain" },
  async () => {
    try {
      await seedExchangeRates();
      await seedBlocksAndTransactions();
      await seedContracts();
      await seedUserWalletAndBalances();
      return {
        success: true,
        message: "Blockchain data seeded successfully"
      };
    } catch (error) {
      console.error('Failed to seed blockchain data:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to seed blockchain data"
      };
    }
  }
);
