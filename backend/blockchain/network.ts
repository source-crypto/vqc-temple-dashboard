import { api } from "encore.dev/api";
import { blockchainDB } from "./db";
import crypto from "crypto";

export interface NetworkNode {
  id: string;
  address: string;
  port: number;
  nodeType: 'validator' | 'full' | 'light';
  status: 'active' | 'inactive' | 'syncing';
  lastSeen: Date;
  blockHeight: number;
  peerCount: number;
  version: string;
}

export interface NetworkHealth {
  totalNodes: number;
  activeNodes: number;
  consensusHealth: number;
  networkLatency: number;
  syncStatus: string;
  forkCount: number;
}

export interface MiningStats {
  hashRate: number;
  difficulty: number;
  blockTime: number;
  pendingTransactions: number;
  mempoolSize: number;
}

export interface NetworkStatusResponse {
  health: NetworkHealth;
  mining: MiningStats;
  nodes: NetworkNode[];
}

// Retrieves comprehensive VQC network status and health metrics.
export const getNetworkStatus = api<void, NetworkStatusResponse>(
  { expose: true, method: "GET", path: "/network/status" },
  async () => {
    // Generate mock network data
    const nodes: NetworkNode[] = [];
    const nodeCount = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: crypto.randomBytes(16).toString('hex'),
        address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        port: 8545 + Math.floor(Math.random() * 100),
        nodeType: ['validator', 'full', 'light'][Math.floor(Math.random() * 3)] as 'validator' | 'full' | 'light',
        status: ['active', 'inactive', 'syncing'][Math.floor(Math.random() * 3)] as 'active' | 'inactive' | 'syncing',
        lastSeen: new Date(Date.now() - Math.random() * 3600000), // Within last hour
        blockHeight: Math.floor(Math.random() * 1000) + 1000000,
        peerCount: Math.floor(Math.random() * 50) + 5,
        version: `v1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`
      });
    }

    const activeNodes = nodes.filter(n => n.status === 'active').length;
    const consensusHealth = activeNodes / nodeCount;

    const health: NetworkHealth = {
      totalNodes: nodeCount,
      activeNodes: activeNodes,
      consensusHealth: consensusHealth,
      networkLatency: Math.random() * 100 + 50, // 50-150ms
      syncStatus: consensusHealth > 0.8 ? 'healthy' : consensusHealth > 0.6 ? 'degraded' : 'critical',
      forkCount: Math.floor(Math.random() * 3)
    };

    const mining: MiningStats = {
      hashRate: Math.random() * 1000000 + 500000, // 500K-1.5M H/s
      difficulty: Math.random() * 1000000 + 1000000,
      blockTime: Math.random() * 5 + 12, // 12-17 seconds
      pendingTransactions: Math.floor(Math.random() * 1000) + 100,
      mempoolSize: Math.floor(Math.random() * 50) + 10 // MB
    };

    return {
      health,
      mining,
      nodes: nodes.slice(0, 10) // Return top 10 nodes
    };
  }
);

export interface ValidatorInfo {
  address: string;
  stake: string;
  commission: number;
  uptime: number;
  blocksProduced: number;
  lastActive: Date;
  status: 'active' | 'jailed' | 'unbonding';
}

export interface ValidatorListResponse {
  validators: ValidatorInfo[];
  totalStake: string;
  averageUptime: number;
}

// Retrieves information about network validators.
export const getValidators = api<void, ValidatorListResponse>(
  { expose: true, method: "GET", path: "/network/validators" },
  async () => {
    const validators: ValidatorInfo[] = [];
    const validatorCount = Math.floor(Math.random() * 50) + 20;
    let totalStake = BigInt(0);
    let totalUptime = 0;

    for (let i = 0; i < validatorCount; i++) {
      const stake = BigInt(Math.floor(Math.random() * 1000000) + 100000) * BigInt(10 ** 18);
      const uptime = Math.random() * 0.2 + 0.8; // 80-100%
      
      totalStake += stake;
      totalUptime += uptime;

      validators.push({
        address: "0x" + crypto.randomBytes(20).toString('hex'),
        stake: stake.toString(),
        commission: Math.random() * 0.1 + 0.05, // 5-15%
        uptime: uptime,
        blocksProduced: Math.floor(Math.random() * 10000) + 1000,
        lastActive: new Date(Date.now() - Math.random() * 3600000),
        status: ['active', 'jailed', 'unbonding'][Math.floor(Math.random() * 3)] as 'active' | 'jailed' | 'unbonding'
      });
    }

    return {
      validators: validators.sort((a, b) => BigInt(b.stake) > BigInt(a.stake) ? 1 : -1),
      totalStake: totalStake.toString(),
      averageUptime: totalUptime / validatorCount
    };
  }
);

export interface PeerInfo {
  id: string;
  address: string;
  direction: 'inbound' | 'outbound';
  protocol: string;
  latency: number;
  bytesReceived: number;
  bytesSent: number;
  connectedSince: Date;
}

export interface PeerListResponse {
  peers: PeerInfo[];
  totalConnections: number;
  inboundCount: number;
  outboundCount: number;
}

// Retrieves information about network peers.
export const getPeers = api<void, PeerListResponse>(
  { expose: true, method: "GET", path: "/network/peers" },
  async () => {
    const peers: PeerInfo[] = [];
    const peerCount = Math.floor(Math.random() * 30) + 10;
    let inboundCount = 0;
    let outboundCount = 0;

    for (let i = 0; i < peerCount; i++) {
      const direction = Math.random() > 0.5 ? 'inbound' : 'outbound';
      if (direction === 'inbound') inboundCount++;
      else outboundCount++;

      peers.push({
        id: crypto.randomBytes(16).toString('hex'),
        address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}:${8545 + Math.floor(Math.random() * 100)}`,
        direction: direction,
        protocol: 'vqc/1.0',
        latency: Math.random() * 200 + 10, // 10-210ms
        bytesReceived: Math.floor(Math.random() * 1000000) + 10000,
        bytesSent: Math.floor(Math.random() * 1000000) + 10000,
        connectedSince: new Date(Date.now() - Math.random() * 86400000) // Within last day
      });
    }

    return {
      peers,
      totalConnections: peerCount,
      inboundCount,
      outboundCount
    };
  }
);

export interface ChainInfo {
  chainId: number;
  networkName: string;
  consensusAlgorithm: string;
  blockTime: number;
  finalityTime: number;
  maxBlockSize: number;
  gasLimit: number;
  baseFee: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Retrieves VQC blockchain configuration and parameters.
export const getChainInfo = api<void, ChainInfo>(
  { expose: true, method: "GET", path: "/network/chain-info" },
  async () => {
    return {
      chainId: 2024,
      networkName: "VQC Mainnet",
      consensusAlgorithm: "Quantum Proof of Stake",
      blockTime: 15, // seconds
      finalityTime: 75, // seconds (5 blocks)
      maxBlockSize: 2000000, // bytes
      gasLimit: 8000000,
      baseFee: 20000000000, // 20 gwei
      nativeCurrency: {
        name: "Assimilator",
        symbol: "ASM",
        decimals: 18
      }
    };
  }
);
