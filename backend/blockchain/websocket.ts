import { api, StreamOut } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import log from "encore.dev/log";

export interface BlockchainEvent {
  type: 'new_block' | 'new_transaction' | 'contract_deployment' | 'token_transfer' | 'swap' | 'liquidity_change' | 'system';
  timestamp: Date;
  data: any;
  blockNumber?: number;
  txHash?: string;
}

export interface MonitoringHandshake {
  clientId: string;
  subscriptions: string[];
  filters?: {
    addresses?: string[];
    contracts?: string[];
    minValue?: string;
  };
}

const connectedStreams = new Map<StreamOut<BlockchainEvent>, MonitoringHandshake>();
const monitoringInterval = 5000; // 5 seconds
let monitoringLoop: NodeJS.Timeout | null = null;

// Track last processed items to avoid duplicates
let lastProcessedBlock = 0;
let lastProcessedTransaction = 0;
let lastProcessedContract = 0;
let lastProcessedTokenTransfer = 0;
let lastProcessedSwap = 0;
let lastProcessedLiquidityChange = 0;

function getSubscriptionType(eventType: BlockchainEvent['type']): string {
  switch (eventType) {
    case 'new_block': return 'blocks';
    case 'new_transaction': return 'transactions';
    case 'contract_deployment': return 'contracts';
    case 'token_transfer': return 'token_transfers';
    case 'swap': return 'swaps';
    case 'liquidity_change': return 'liquidity';
    case 'system': return 'system';
    default: return '';
  }
}

// Helper to broadcast events to relevant clients
async function broadcastEvent(event: BlockchainEvent) {
  const disconnectedStreams: StreamOut<BlockchainEvent>[] = [];
  
  for (const [stream, handshake] of connectedStreams.entries()) {
    try {
      // Check subscriptions
      const subscriptionType = getSubscriptionType(event.type);
      if (subscriptionType !== 'system' && !handshake.subscriptions.includes(subscriptionType)) {
        continue;
      }

      // Apply filters
      if (handshake.filters) {
        if (event.type === 'new_transaction') {
          const txData = event.data;
          if (handshake.filters.addresses && handshake.filters.addresses.length > 0) {
            if (!handshake.filters.addresses.includes(txData.fromAddress) && !handshake.filters.addresses.includes(txData.toAddress)) {
              continue;
            }
          }
          if (handshake.filters.minValue) {
            if (BigInt(txData.value) < BigInt(handshake.filters.minValue)) {
              continue;
            }
          }
        }
        if (event.type === 'token_transfer') {
          const transferData = event.data;
          if (handshake.filters.contracts && handshake.filters.contracts.length > 0) {
            if (!handshake.filters.contracts.includes(transferData.tokenContract)) {
              continue;
            }
          }
        }
      }

      await stream.send(event);
    } catch (err) {
      log.error("Error broadcasting to stream:", err);
      disconnectedStreams.push(stream);
    }
  }
  
  // Clean up disconnected streams
  for (const stream of disconnectedStreams) {
    connectedStreams.delete(stream);
  }
}

// Polling functions
async function checkForNewBlocks() {
  const newBlocks = await blockchainDB.queryAll<{
    block_number: number;
    block_hash: string;
    timestamp: Date;
    miner_address: string;
    transaction_count: number;
    gas_used: number;
    gas_limit: number;
  }>`
    SELECT block_number, block_hash, timestamp, miner_address, transaction_count, gas_used, gas_limit
    FROM blocks 
    WHERE block_number > ${lastProcessedBlock}
    ORDER BY block_number ASC
    LIMIT 10
  `;

  for (const block of newBlocks) {
    await broadcastEvent({
      type: 'new_block',
      timestamp: new Date(),
      blockNumber: block.block_number,
      data: {
        blockNumber: block.block_number,
        blockHash: block.block_hash,
        timestamp: block.timestamp,
        minerAddress: block.miner_address,
        transactionCount: block.transaction_count,
        gasUsed: block.gas_used,
        gasLimit: block.gas_limit,
        gasUtilization: (block.gas_used / block.gas_limit) * 100
      }
    });
    lastProcessedBlock = Math.max(lastProcessedBlock, block.block_number);
  }
}

async function checkForNewTransactions() {
  const newTransactions = await blockchainDB.queryAll<{
    id: number;
    tx_hash: string;
    block_number: number;
    from_address: string;
    to_address: string | null;
    value: string;
    gas_price: number;
    status: number;
    timestamp: Date;
  }>`
    SELECT id, tx_hash, block_number, from_address, to_address, value, gas_price, status, timestamp
    FROM transactions 
    WHERE id > ${lastProcessedTransaction}
    ORDER BY id ASC LIMIT 20
  `;

  for (const tx of newTransactions) {
    await broadcastEvent({
      type: 'new_transaction',
      timestamp: new Date(),
      blockNumber: tx.block_number,
      txHash: tx.tx_hash,
      data: {
        txHash: tx.tx_hash,
        blockNumber: tx.block_number,
        fromAddress: tx.from_address,
        toAddress: tx.to_address,
        value: tx.value,
        gasPrice: tx.gas_price,
        status: tx.status === 1 ? 'success' : 'failed',
        timestamp: tx.timestamp
      }
    });
    lastProcessedTransaction = Math.max(lastProcessedTransaction, tx.id);
  }
}

async function checkForContractDeployments() {
  const newContracts = await blockchainDB.queryAll<{
    id: number;
    contract_address: string;
    creator_address: string;
    creation_tx_hash: string;
    creation_block_number: number;
    contract_name: string;
    contract_type: string;
    verification_status: string;
    created_at: Date;
  }>`
    SELECT id, contract_address, creator_address, creation_tx_hash, creation_block_number,
           contract_name, contract_type, verification_status, created_at
    FROM contracts 
    WHERE id > ${lastProcessedContract}
    ORDER BY id ASC
    LIMIT 10
  `;

  for (const contract of newContracts) {
    await broadcastEvent({
      type: 'contract_deployment',
      timestamp: new Date(),
      blockNumber: contract.creation_block_number,
      txHash: contract.creation_tx_hash,
      data: {
        contractAddress: contract.contract_address,
        creatorAddress: contract.creator_address,
        creationTxHash: contract.creation_tx_hash,
        blockNumber: contract.creation_block_number,
        contractName: contract.contract_name,
        contractType: contract.contract_type,
        verificationStatus: contract.verification_status,
        createdAt: contract.created_at
      }
    });
    lastProcessedContract = Math.max(lastProcessedContract, contract.id);
  }
}

async function checkForTokenTransfers() {
  const transfers = await blockchainDB.queryAll<{
    id: number;
    tx_hash: string;
    block_number: number;
    token_contract: string;
    from_address: string;
    to_address: string;
    value: string;
    timestamp: Date;
  }>`
    SELECT id, tx_hash, block_number, token_contract, from_address, to_address, value, timestamp
    FROM token_transfers 
    WHERE id > ${lastProcessedTokenTransfer}
    ORDER BY id ASC
    LIMIT 20
  `;

  for (const transfer of transfers) {
    await broadcastEvent({
      type: 'token_transfer',
      timestamp: new Date(),
      blockNumber: transfer.block_number,
      txHash: transfer.tx_hash,
      data: {
        tokenContract: transfer.token_contract,
        fromAddress: transfer.from_address,
        toAddress: transfer.to_address,
        value: transfer.value,
        txHash: transfer.tx_hash,
        blockNumber: transfer.block_number,
        timestamp: transfer.timestamp
      }
    });
    lastProcessedTokenTransfer = Math.max(lastProcessedTokenTransfer, transfer.id);
  }
}

async function checkForSwaps() {
  const swaps = await blockchainDB.queryAll<{
    id: number;
    user_id: string;
    from_currency: string;
    to_currency: string;
    from_amount: number;
    to_amount: number;
    exchange_rate: number;
    fee_amount: number;
    created_at: Date;
  }>`
    SELECT id, user_id, from_currency, to_currency, from_amount, to_amount, 
           exchange_rate, fee_amount, created_at
    FROM currency_transactions 
    WHERE transaction_type = 'swap' 
      AND id > ${lastProcessedSwap}
    ORDER BY id ASC
    LIMIT 20
  `;

  for (const swap of swaps) {
    await broadcastEvent({
      type: 'swap',
      timestamp: new Date(),
      data: {
        userId: swap.user_id,
        fromCurrency: swap.from_currency,
        toCurrency: swap.to_currency,
        fromAmount: swap.from_amount,
        toAmount: swap.to_amount,
        exchangeRate: swap.exchange_rate,
        feeAmount: swap.fee_amount,
        timestamp: swap.created_at
      }
    });
    lastProcessedSwap = Math.max(lastProcessedSwap, swap.id);
  }
}

async function checkForLiquidityChanges() {
  const positions = await blockchainDB.queryAll<{
    id: number;
    user_id: string;
    pool_id: number;
    liquidity_tokens: string;
    share_percentage: number;
    last_updated: Date;
  }>`
    SELECT id, user_id, pool_id, liquidity_tokens, share_percentage, last_updated
    FROM liquidity_positions
    WHERE id > ${lastProcessedLiquidityChange}
    ORDER BY id ASC
    LIMIT 20
  `;

  for (const pos of positions) {
    await broadcastEvent({
      type: 'liquidity_change',
      timestamp: new Date(),
      data: {
        positionId: pos.id,
        userId: pos.user_id,
        poolId: pos.pool_id,
        liquidityTokens: pos.liquidity_tokens,
        sharePercentage: pos.share_percentage,
        timestamp: pos.last_updated,
      }
    });
    lastProcessedLiquidityChange = Math.max(lastProcessedLiquidityChange, pos.id);
  }
}

async function pollAndBroadcast() {
  if (connectedStreams.size === 0) return;

  try {
    await Promise.all([
      checkForNewBlocks(),
      checkForNewTransactions(),
      checkForContractDeployments(),
      checkForTokenTransfers(),
      checkForSwaps(),
      checkForLiquidityChanges(),
    ]);
  } catch (err) {
    log.error("Error in blockchain monitoring loop:", err);
  }
}

function startMonitoring() {
  if (monitoringLoop) return;
  log.info("Starting blockchain monitoring loop...");
  monitoringLoop = setInterval(pollAndBroadcast, monitoringInterval);
}

function stopMonitoring() {
  if (monitoringLoop) {
    clearInterval(monitoringLoop);
    monitoringLoop = null;
    log.info("Blockchain monitoring loop stopped.");
  }
}

// Real-time blockchain monitoring stream
export const blockchainMonitorStream = api.streamOut<MonitoringHandshake, BlockchainEvent>(
  { expose: true, path: "/blockchain/monitor" },
  async (handshake, stream) => {
    log.info(`Blockchain monitor client ${handshake.clientId} connected`);
    connectedStreams.set(stream, handshake);
    startMonitoring();

    try {
      // Send initial connection confirmation
      await stream.send({
        type: 'system',
        timestamp: new Date(),
        data: {
          status: 'connected',
          subscriptions: handshake.subscriptions,
          clientId: handshake.clientId
        }
      });

      // Keep the stream alive
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          connectedStreams.delete(stream);
          if (connectedStreams.size === 0) {
            stopMonitoring();
          }
          log.info(`Blockchain monitor client ${handshake.clientId} disconnected`);
          resolve();
        };
      });
    } catch (error) {
      log.error(`Stream error for client ${handshake.clientId}:`, error);
      connectedStreams.delete(stream);
      if (connectedStreams.size === 0) {
        stopMonitoring();
      }
    }
  }
);

// Get connected clients count
export const getConnectedClients = api<void, { count: number; clients: string[] }>(
  { expose: true, method: "GET", path: "/blockchain/monitor/status" },
  async () => {
    return {
      count: connectedStreams.size,
      clients: Array.from(connectedStreams.values()).map(h => h.clientId)
    };
  }
);
