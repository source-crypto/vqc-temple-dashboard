import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";

export interface AdvancedSearchRequest {
  query?: string;
  filters?: {
    transactionType?: 'all' | 'transfer' | 'contract_call' | 'contract_creation';
    dateRange?: {
      from: Date;
      to: Date;
    };
    valueRange?: {
      min: string;
      max: string;
    };
    addresses?: string[];
    contracts?: string[];
    status?: 'all' | 'success' | 'failed';
  };
  sort?: {
    field: 'timestamp' | 'value' | 'gas_used' | 'block_number';
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface AdvancedSearchResponse {
  results: any[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
  searchHistory?: Array<{
    query: string;
    timestamp: Date;
    resultCount: number;
  }>;
}

export interface AutocompleteRequest {
  query: string;
  type: 'address' | 'contract' | 'transaction' | 'block';
}

export interface AutocompleteResponse {
  suggestions: Array<{
    value: string;
    label: string;
    type: string;
    description?: string;
  }>;
}

export interface SearchHistoryResponse {
  history: Array<{
    query: string;
    timestamp: Date;
    resultCount: number;
  }>;
}

// Advanced search with filtering and pagination
export const advancedSearch = api<AdvancedSearchRequest, AdvancedSearchResponse>(
  { expose: true, method: "POST", path: "/explorer/search/advanced" },
  async (req): Promise<AdvancedSearchResponse> => {
    return withPerformanceMonitoring("/explorer/search/advanced", "POST", async () => {
      const page = req.pagination?.page || 1;
      const limit = Math.min(req.pagination?.limit || 20, 100); // Max 100 results per page
      const offset = (page - 1) * limit;

      let baseQuery = '';
      let countQuery = '';
      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      // Determine search type based on query and filters
      if (req.query) {
        // Check if it's a specific hash or address
        if (/^0x[a-fA-F0-9]{64}$/.test(req.query)) {
          // Transaction or block hash
          baseQuery = `
            SELECT 'transaction' as type, tx_hash as id, from_address, to_address, value, 
                   timestamp, block_number, status
            FROM transactions 
            WHERE tx_hash = $${paramIndex}
            UNION ALL
            SELECT 'block' as type, block_hash as id, miner_address as from_address, 
                   NULL as to_address, NULL as value, timestamp, block_number, 1 as status
            FROM blocks 
            WHERE block_hash = $${paramIndex}
          `;
          countQuery = `
            SELECT COUNT(*) as total FROM (
              SELECT tx_hash FROM transactions WHERE tx_hash = $${paramIndex}
              UNION ALL
              SELECT block_hash FROM blocks WHERE block_hash = $${paramIndex}
            ) combined
          `;
          params.push(req.query);
          paramIndex++;
        } else if (/^0x[a-fA-F0-9]{40}$/.test(req.query)) {
          // Address
          baseQuery = `
            SELECT 'transaction' as type, tx_hash as id, from_address, to_address, value, 
                   timestamp, block_number, status
            FROM transactions 
            WHERE from_address = $${paramIndex} OR to_address = $${paramIndex}
          `;
          countQuery = `
            SELECT COUNT(*) as total FROM transactions 
            WHERE from_address = $${paramIndex} OR to_address = $${paramIndex}
          `;
          params.push(req.query);
          paramIndex++;
        } else if (/^\d+$/.test(req.query)) {
          // Block number
          baseQuery = `
            SELECT 'block' as type, block_hash as id, miner_address as from_address, 
                   NULL as to_address, NULL as value, timestamp, block_number, 1 as status
            FROM blocks 
            WHERE block_number = $${paramIndex}
          `;
          countQuery = `
            SELECT COUNT(*) as total FROM blocks WHERE block_number = $${paramIndex}
          `;
          params.push(parseInt(req.query));
          paramIndex++;
        } else {
          // Text search in contract names
          baseQuery = `
            SELECT 'contract' as type, contract_address as id, creator_address as from_address, 
                   NULL as to_address, NULL as value, created_at as timestamp, 
                   creation_block_number as block_number, 1 as status
            FROM contracts 
            WHERE contract_name ILIKE $${paramIndex}
          `;
          countQuery = `
            SELECT COUNT(*) as total FROM contracts WHERE contract_name ILIKE $${paramIndex}
          `;
          params.push(`%${req.query}%`);
          paramIndex++;
        }
      } else {
        // Filter-based search
        baseQuery = `
          SELECT 'transaction' as type, tx_hash as id, from_address, to_address, value, 
                 timestamp, block_number, status
          FROM transactions
        `;
        countQuery = `SELECT COUNT(*) as total FROM transactions`;
      }

      // Apply filters
      if (req.filters) {
        if (req.filters.dateRange) {
          whereConditions.push(`timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          params.push(req.filters.dateRange.from, req.filters.dateRange.to);
          paramIndex += 2;
        }

        if (req.filters.valueRange) {
          whereConditions.push(`value BETWEEN $${paramIndex}::numeric AND $${paramIndex + 1}::numeric`);
          params.push(req.filters.valueRange.min, req.filters.valueRange.max);
          paramIndex += 2;
        }

        if (req.filters.addresses && req.filters.addresses.length > 0) {
          whereConditions.push(`(from_address = ANY($${paramIndex}) OR to_address = ANY($${paramIndex}))`);
          params.push(req.filters.addresses);
          paramIndex++;
        }

        if (req.filters.status && req.filters.status !== 'all') {
          const statusValue = req.filters.status === 'success' ? 1 : 0;
          whereConditions.push(`status = $${paramIndex}`);
          params.push(statusValue);
          paramIndex++;
        }

        if (req.filters.transactionType && req.filters.transactionType !== 'all') {
          switch (req.filters.transactionType) {
            case 'contract_creation':
              whereConditions.push(`to_address IS NULL`);
              break;
            case 'contract_call':
              whereConditions.push(`to_address IN (SELECT contract_address FROM contracts)`);
              break;
            case 'transfer':
              whereConditions.push(`to_address IS NOT NULL AND to_address NOT IN (SELECT contract_address FROM contracts)`);
              break;
          }
        }
      }

      // Add WHERE clause if conditions exist
      if (whereConditions.length > 0) {
        const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
        baseQuery += whereClause;
        countQuery += whereClause;
      }

      // Add sorting
      if (req.sort) {
        baseQuery += ` ORDER BY ${req.sort.field} ${req.sort.direction.toUpperCase()}`;
      } else {
        baseQuery += ` ORDER BY timestamp DESC`;
      }

      // Add pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      // Execute queries
      const [results, countResult] = await Promise.all([
        blockchainDB.rawQueryAll(baseQuery, ...params),
        blockchainDB.rawQueryRow(countQuery, ...params.slice(0, -2)) // Remove limit and offset for count
      ]);

      const total = (countResult as any)?.total || 0;
      const totalPages = Math.ceil(total / limit);

      // Store search in history (simplified - in production, you'd want user-specific storage)
      if (req.query) {
        await storeSearchHistory(req.query, total);
      }

      return {
        results,
        total,
        page,
        totalPages,
        suggestions: await generateSearchSuggestions(req.query),
        searchHistory: await getRecentSearchHistory()
      };
    });
  }
);

// Autocomplete suggestions
export const getAutocompleteSuggestions = api<AutocompleteRequest, AutocompleteResponse>(
  { expose: true, method: "GET", path: "/explorer/autocomplete" },
  async (req) => {
    return withPerformanceMonitoring("/explorer/autocomplete", "GET", async () => {
      const suggestions: Array<{
        value: string;
        label: string;
        type: string;
        description?: string;
      }> = [];

      if (req.query.length < 2) {
        return { suggestions };
      }

      const query = req.query.toLowerCase();

      // Search addresses
      if (req.type === 'address' || req.type === 'transaction') {
        const addresses = await blockchainDB.queryAll<{
          address: string;
          tx_count: number;
        }>`
          SELECT DISTINCT from_address as address, COUNT(*) as tx_count
          FROM transactions 
          WHERE LOWER(from_address) LIKE ${'%' + query + '%'}
          GROUP BY from_address
          ORDER BY tx_count DESC
          LIMIT 5
        `;

        addresses.forEach(addr => {
          suggestions.push({
            value: addr.address,
            label: `${addr.address.substring(0, 10)}...${addr.address.substring(addr.address.length - 8)}`,
            type: 'address',
            description: `${addr.tx_count} transactions`
          });
        });
      }

      // Search contracts
      if (req.type === 'contract') {
        const contracts = await blockchainDB.queryAll<{
          contract_address: string;
          contract_name: string;
          contract_type: string;
        }>`
          SELECT contract_address, contract_name, contract_type
          FROM contracts 
          WHERE LOWER(contract_name) LIKE ${'%' + query + '%'}
             OR LOWER(contract_address) LIKE ${'%' + query + '%'}
          ORDER BY contract_name
          LIMIT 5
        `;

        contracts.forEach(contract => {
          suggestions.push({
            value: contract.contract_address,
            label: contract.contract_name,
            type: 'contract',
            description: `${contract.contract_type} contract`
          });
        });
      }

      // Search recent transactions
      if (req.type === 'transaction') {
        const transactions = await blockchainDB.queryAll<{
          tx_hash: string;
          value: string;
          timestamp: Date;
        }>`
          SELECT tx_hash, value, timestamp
          FROM transactions 
          WHERE LOWER(tx_hash) LIKE ${'%' + query + '%'}
          ORDER BY timestamp DESC
          LIMIT 3
        `;

        transactions.forEach(tx => {
          suggestions.push({
            value: tx.tx_hash,
            label: `${tx.tx_hash.substring(0, 10)}...${tx.tx_hash.substring(tx.tx_hash.length - 8)}`,
            type: 'transaction',
            description: `${parseFloat(tx.value) / 1e18} ASM`
          });
        });
      }

      return { suggestions };
    });
  }
);

// Get search history
export const getSearchHistory = api<void, SearchHistoryResponse>(
  { expose: true, method: "GET", path: "/explorer/search/history" },
  async () => {
    return withPerformanceMonitoring("/explorer/search/history", "GET", async () => {
      const history = await getRecentSearchHistory();
      return { history };
    });
  }
);

// Transaction analytics
export const getTransactionAnalytics = api<{
  timeRange: '1h' | '24h' | '7d' | '30d';
}, {
  totalTransactions: number;
  totalValue: string;
  averageGasPrice: number;
  topAddresses: Array<{
    address: string;
    transactionCount: number;
    totalValue: string;
  }>;
  hourlyStats: Array<{
    hour: Date;
    transactionCount: number;
    totalValue: string;
  }>;
}>(
  { expose: true, method: "GET", path: "/explorer/analytics/transactions" },
  async (req): Promise<{
    totalTransactions: number;
    totalValue: string;
    averageGasPrice: number;
    topAddresses: Array<{
      address: string;
      transactionCount: number;
      totalValue: string;
    }>;
    hourlyStats: Array<{
      hour: Date;
      transactionCount: number;
      totalValue: string;
    }>;
  }> => {
    return withPerformanceMonitoring("/explorer/analytics/transactions", "GET", async () => {
      const timeRanges = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const timeRange = timeRanges[req.timeRange];

      // Get total stats
      const totalStats = await blockchainDB.queryRow<{
        total_transactions: number;
        total_value: string;
        avg_gas_price: number;
      }>`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(value) as total_value,
          AVG(gas_price) as avg_gas_price
        FROM transactions 
        WHERE timestamp > NOW() - INTERVAL '${timeRange}'
      `;

      // Get top addresses
      const topAddresses = await blockchainDB.queryAll<{
        address: string;
        transaction_count: number;
        total_value: string;
      }>`
        SELECT 
          from_address as address,
          COUNT(*) as transaction_count,
          SUM(value) as total_value
        FROM transactions 
        WHERE timestamp > NOW() - INTERVAL '${timeRange}'
        GROUP BY from_address
        ORDER BY transaction_count DESC
        LIMIT 10
      `;

      // Get hourly stats
      const hourlyStats = await blockchainDB.queryAll<{
        hour: Date;
        transaction_count: number;
        total_value: string;
      }>`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as transaction_count,
          SUM(value) as total_value
        FROM transactions 
        WHERE timestamp > NOW() - INTERVAL '${timeRange}'
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour DESC
      `;

      return {
        totalTransactions: totalStats?.total_transactions || 0,
        totalValue: totalStats?.total_value || '0',
        averageGasPrice: totalStats?.avg_gas_price || 0,
        topAddresses: topAddresses.map(a => ({
          address: a.address,
          transactionCount: a.transaction_count,
          totalValue: a.total_value
        })),
        hourlyStats: hourlyStats.map(h => ({
          hour: h.hour,
          transactionCount: h.transaction_count,
          totalValue: h.total_value
        }))
      };
    });
  }
);

// Helper functions
async function storeSearchHistory(query: string, resultCount: number): Promise<void> {
  try {
    await blockchainDB.exec`
      INSERT INTO search_history (query, result_count, timestamp)
      VALUES (${query}, ${resultCount}, NOW())
      ON CONFLICT (query) 
      DO UPDATE SET 
        result_count = ${resultCount},
        timestamp = NOW(),
        search_count = search_history.search_count + 1
    `;
  } catch (error) {
    console.error('Failed to store search history:', error);
  }
}

async function getRecentSearchHistory(): Promise<Array<{
  query: string;
  timestamp: Date;
  resultCount: number;
}>> {
  try {
    const history = await blockchainDB.queryAll<{
      query: string;
      timestamp: Date;
      result_count: number;
    }>`
      SELECT query, timestamp, result_count
      FROM search_history
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    return history.map(h => ({
      query: h.query,
      timestamp: h.timestamp,
      resultCount: h.result_count
    }));
  } catch (error) {
    console.error('Failed to get search history:', error);
    return [];
  }
}

async function generateSearchSuggestions(query?: string): Promise<string[]> {
  if (!query || query.length < 3) return [];

  try {
    const suggestions = await blockchainDB.queryAll<{ suggestion: string }>`
      SELECT DISTINCT contract_name as suggestion
      FROM contracts
      WHERE LOWER(contract_name) LIKE ${'%' + query.toLowerCase() + '%'}
      LIMIT 5
    `;

    return suggestions.map(s => s.suggestion);
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    return [];
  }
}
