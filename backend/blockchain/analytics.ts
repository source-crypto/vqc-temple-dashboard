import { api } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";

export interface ProtocolAnalytics {
  protocolName: string;
  totalTransactions: number;
  totalVolume: string;
  uniqueUsers: number;
  avgTransactionSize: string;
  last24hVolume: string;
  last24hTransactions: number;
}

export interface FlashLoanAnalytics {
  totalLoans: number;
  totalVolume: string;
  totalFees: string;
  totalProfit: string;
  avgLoanSize: string;
  successRate: number;
  topUsers: Array<{ userId: string; loanCount: number; totalVolume: string }>;
}

export interface BridgeAnalytics {
  totalTransfers: number;
  totalVolume: string;
  totalFees: string;
  pendingCount: number;
  completedCount: number;
  avgTransferTime: number;
  topNetworks: Array<{ network: string; transferCount: number }>;
}

export interface SystemHealthMetrics {
  totalUsers: number;
  totalProtocols: number;
  activatedProtocols: number;
  totalTransactions: number;
  systemUptime: number;
  avgResponseTime: number;
}

export const getProtocolAnalytics = api<{ protocolName?: string }, { analytics: ProtocolAnalytics[] }>(
  { expose: true, method: "GET", path: "/analytics/protocols" },
  async (req) => {
    return withPerformanceMonitoring("/analytics/protocols", "GET", async () => {
      const whereClause = req.protocolName ? `WHERE ps.protocol_name = '${req.protocolName}'` : '';

      const analytics = await blockchainDB.rawQueryAll<{
        protocol_name: string;
        total_entities: number;
        activated_entities: number;
      }>(`
        SELECT protocol_name, total_entities, activated_entities
        FROM protocol_status
        ${whereClause}
      `);

      const result: ProtocolAnalytics[] = [];

      for (const proto of analytics) {
        const txStats = await blockchainDB.rawQueryRow<{
          total_transactions: number;
          total_volume: string;
          unique_users: number;
          avg_transaction_size: string;
        }>(`
          SELECT 
            COUNT(*) as total_transactions,
            COALESCE(SUM(from_amount::numeric), 0) as total_volume,
            COUNT(DISTINCT user_id) as unique_users,
            COALESCE(AVG(from_amount::numeric), 0) as avg_transaction_size
          FROM currency_transactions
          WHERE transaction_type LIKE '%${proto.protocol_name}%'
        `);

        const last24h = await blockchainDB.rawQueryRow<{
          volume: string;
          count: number;
        }>(`
          SELECT 
            COALESCE(SUM(from_amount::numeric), 0) as volume,
            COUNT(*) as count
          FROM currency_transactions
          WHERE transaction_type LIKE '%${proto.protocol_name}%'
            AND created_at > NOW() - INTERVAL '24 hours'
        `);

        result.push({
          protocolName: proto.protocol_name,
          totalTransactions: txStats?.total_transactions || 0,
          totalVolume: txStats?.total_volume || '0',
          uniqueUsers: txStats?.unique_users || 0,
          avgTransactionSize: txStats?.avg_transaction_size || '0',
          last24hVolume: last24h?.volume || '0',
          last24hTransactions: last24h?.count || 0,
        });
      }

      return { analytics: result };
    });
  }
);

export const getFlashLoanAnalytics = api<void, FlashLoanAnalytics>(
  { expose: true, method: "GET", path: "/analytics/flash-loans" },
  async () => {
    return withPerformanceMonitoring("/analytics/flash-loans", "GET", async () => {
      const stats = await blockchainDB.queryRow<{
        total_loans: number;
        total_volume: string;
        total_fees: string;
        total_profit: string;
        avg_loan_size: string;
        success_count: number;
      }>`
        SELECT 
          COUNT(*) as total_loans,
          COALESCE(SUM(amount::numeric), 0) as total_volume,
          COALESCE(SUM(fee::numeric), 0) as total_fees,
          COALESCE(SUM(profit::numeric), 0) as total_profit,
          COALESCE(AVG(amount::numeric), 0) as avg_loan_size,
          COUNT(*) FILTER (WHERE status = 'completed') as success_count
        FROM flash_loans
      `;

      const topUsers = await blockchainDB.queryAll<{
        user_id: string;
        loan_count: number;
        total_volume: string;
      }>`
        SELECT 
          user_id,
          COUNT(*) as loan_count,
          SUM(amount::numeric) as total_volume
        FROM flash_loans
        WHERE status = 'completed'
        GROUP BY user_id
        ORDER BY total_volume DESC
        LIMIT 10
      `;

      return {
        totalLoans: stats?.total_loans || 0,
        totalVolume: stats?.total_volume || '0',
        totalFees: stats?.total_fees || '0',
        totalProfit: stats?.total_profit || '0',
        avgLoanSize: stats?.avg_loan_size || '0',
        successRate: stats && stats.total_loans > 0 
          ? (stats.success_count / stats.total_loans) * 100 
          : 0,
        topUsers: topUsers.map(u => ({
          userId: u.user_id,
          loanCount: u.loan_count,
          totalVolume: u.total_volume,
        })),
      };
    });
  }
);

export const getBridgeAnalytics = api<void, BridgeAnalytics>(
  { expose: true, method: "GET", path: "/analytics/bridge" },
  async () => {
    return withPerformanceMonitoring("/analytics/bridge", "GET", async () => {
      const stats = await blockchainDB.queryRow<{
        total_transfers: number;
        total_volume: string;
        total_fees: string;
        pending_count: number;
        completed_count: number;
      }>`
        SELECT 
          COUNT(*) as total_transfers,
          COALESCE(SUM(amount::numeric), 0) as total_volume,
          COALESCE(SUM(fee::numeric), 0) as total_fees,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count
        FROM bridge_transfers
      `;

      const avgTime = await blockchainDB.queryRow<{ avg_seconds: number }>`
        SELECT 
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))), 0) as avg_seconds
        FROM bridge_transfers
        WHERE status = 'completed' AND completed_at IS NOT NULL
      `;

      const topNetworks = await blockchainDB.queryAll<{
        network: string;
        transfer_count: number;
      }>`
        SELECT 
          from_network as network,
          COUNT(*) as transfer_count
        FROM bridge_transfers
        GROUP BY from_network
        ORDER BY transfer_count DESC
        LIMIT 5
      `;

      return {
        totalTransfers: stats?.total_transfers || 0,
        totalVolume: stats?.total_volume || '0',
        totalFees: stats?.total_fees || '0',
        pendingCount: stats?.pending_count || 0,
        completedCount: stats?.completed_count || 0,
        avgTransferTime: avgTime?.avg_seconds || 0,
        topNetworks: topNetworks.map(n => ({
          network: n.network,
          transferCount: n.transfer_count,
        })),
      };
    });
  }
);

export const getSystemHealthMetrics = api<void, SystemHealthMetrics>(
  { expose: true, method: "GET", path: "/analytics/health" },
  async () => {
    return withPerformanceMonitoring("/analytics/health", "GET", async () => {
      const users = await blockchainDB.queryRow<{ count: number }>`
        SELECT COUNT(DISTINCT user_id) as count FROM user_balances
      `;

      const protocols = await blockchainDB.queryRow<{
        total: number;
        active: number;
      }>`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM protocol_status
      `;

      const transactions = await blockchainDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM currency_transactions
      `;

      return {
        totalUsers: users?.count || 0,
        totalProtocols: protocols?.total || 0,
        activatedProtocols: protocols?.active || 0,
        totalTransactions: transactions?.count || 0,
        systemUptime: 99.9,
        avgResponseTime: 150,
      };
    });
  }
);
