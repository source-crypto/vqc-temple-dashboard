import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withErrorHandling, generateRequestId, logRequest, logResponse } from "../temple/middleware";
import crypto from "crypto";
import { publishTransactionConfirmation } from "./notifications";
import { getCache, setCache, invalidateCache } from "../shared/cache";

export interface ExchangeRate {
  id: number;
  timestamp: Date;
  currencyPair: string;
  rate: number;
  volume24h: number;
  change24h: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface UserWallet {
  id: number;
  userId: string;
  address: string;
  createdAt: Date;
  lastAccessed: Date;
}

export interface CurrencyTransaction {
  id: number;
  userId: string;
  transactionType: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  feeAmount: number;
  status: string;
  blockchainTxHash?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface UserBalance {
  id: number;
  userId: string;
  currency: string;
  balance: number;
  lockedBalance: number;
  lastUpdated: Date;
}

export interface ExchangeRatesResponse {
  rates: ExchangeRate[];
}

export interface BuyTokenRequest {
  userId: string;
  usdAmount: number;
  targetCurrency: string; // 'ASM'
}

export interface BuyTokenResponse {
  transaction: CurrencyTransaction;
  estimatedTokens: number;
  totalFee: number;
}

export interface SellTokenRequest {
  userId: string;
  asmAmount: number;
  targetCurrency: string; // 'USD'
}

export interface SellTokenResponse {
  transaction: CurrencyTransaction;
  estimatedUsd: number;
  totalFee: number;
}

export interface UserBalancesRequest {
  userId: string;
}

export interface UserBalancesResponse {
  balances: UserBalance[];
  wallet?: UserWallet;
}

export interface CreateWalletRequest {
  userId: string;
}

export interface CreateWalletResponse {
  wallet: UserWallet;
  seedPhrase: string;
}

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

function validateRequestSize(data: any, maxSizeKB: number = 100): void {
  const size = JSON.stringify(data).length;
  if (size > maxSizeKB * 1024) {
    throw APIError.invalidArgument(`Request size exceeds ${maxSizeKB}KB limit`);
  }
}

// Initialize exchange rates and database on startup
async function initializeExchangeDatabase(): Promise<void> {
  try {
    await ensureExchangeRatesExist();
    console.log('Exchange database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize exchange database:', error);
    throw error;
  }
}

// Call initialization on module load
initializeExchangeDatabase().catch(console.error);

// Retrieves current exchange rates for all supported currency pairs.
export const getExchangeRates = api<void, ExchangeRatesResponse>(
  { expose: true, method: "GET", path: "/exchange/rates" },
  async () => {
    const cacheKey = 'exchange-rates';
    const cachedData = getCache<ExchangeRatesResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'GET',
        path: '/exchange/rates'
      });

      // Rate limiting: 60 requests per minute
      if (!checkRateLimit('exchange-rates', 60, 60000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for exchange rates");
      }

      const rates = await withErrorHandling(
        'get-exchange-rates',
        requestId,
        async () => {
          // Ensure exchange rates exist
          await ensureExchangeRatesExist();
          
          // Update rates with some randomness to simulate market movement
          await updateExchangeRates();

          const rows = await blockchainDB.queryAll<{
            id: number;
            timestamp: Date;
            currency_pair: string;
            rate: number;
            volume_24h: number;
            change_24h: number;
            market_cap: number;
            last_updated: Date;
          }>`
            SELECT * FROM currency_exchange_rates 
            ORDER BY currency_pair
          `;

          return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            currencyPair: row.currency_pair,
            rate: row.rate,
            volume24h: row.volume_24h,
            change24h: row.change_24h,
            marketCap: row.market_cap,
            lastUpdated: row.last_updated,
          }));
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      const response = { rates };
      setCache(cacheKey, response, 30000); // Cache for 30 seconds
      return response;
    } catch (error) {
      console.error(`[${requestId}] Failed to get exchange rates:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve exchange rates");
    }
  }
);

// Creates a new wallet for a user.
export const createWallet = api<CreateWalletRequest, CreateWalletResponse>(
  { expose: true, method: "POST", path: "/exchange/wallet" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'POST',
        path: '/exchange/wallet'
      });

      // Rate limiting: 5 wallets per hour per user
      if (!checkRateLimit(`wallet-${req.userId}`, 5, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for wallet creation");
      }

      validateRequestSize(req, 10);

      if (!req.userId || typeof req.userId !== 'string') {
        throw APIError.invalidArgument("User ID is required");
      }

      const result = await withErrorHandling(
        'create-wallet',
        requestId,
        async () => {
          // Check if user already has a wallet
          const existingWallet = await blockchainDB.queryRow<{
            id: number;
            user_id: string;
            address: string;
            created_at: Date;
            last_accessed: Date;
          }>`
            SELECT id, user_id, address, created_at, last_accessed 
            FROM user_wallets 
            WHERE user_id = ${req.userId}
          `;

          if (existingWallet) {
            throw APIError.alreadyExists("User already has a wallet");
          }

          // Generate new wallet
          const address = "0x" + crypto.randomBytes(20).toString('hex');
          const privateKey = crypto.randomBytes(32).toString('hex');
          const encryptedPrivateKey = crypto.createHash('sha256').update(privateKey + req.userId).digest('hex');
          const seedPhrase = generateSeedPhrase();

          const row = await blockchainDB.queryRow<{
            id: number;
            user_id: string;
            address: string;
            created_at: Date;
            last_accessed: Date;
          }>`
            INSERT INTO user_wallets (user_id, address, private_key_encrypted)
            VALUES (${req.userId}, ${address}, ${encryptedPrivateKey})
            RETURNING id, user_id, address, created_at, last_accessed
          `;

          if (!row) {
            throw new Error("Failed to create wallet");
          }

          // Initialize user balances with default values
          await initializeUserBalances(req.userId);

          return {
            wallet: {
              id: row.id,
              userId: row.user_id,
              address: row.address,
              createdAt: row.created_at,
              lastAccessed: row.last_accessed,
            },
            seedPhrase
          };
        }
      );

      logResponse(requestId, 201, Date.now() - startTime);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Failed to create wallet:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create wallet");
    }
  }
);

// Retrieves user balances for all currencies.
export const getUserBalances = api<UserBalancesRequest, UserBalancesResponse>(
  { expose: true, method: "GET", path: "/exchange/balances/:userId" },
  async (req) => {
    const cacheKey = `user-balances:${req.userId}`;
    const cachedData = getCache<UserBalancesResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'GET',
        path: `/exchange/balances/${req.userId}`
      });

      // Rate limiting: 120 requests per minute per user
      if (!checkRateLimit(`balances-${req.userId}`, 120, 60000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for balance requests");
      }

      if (!req.userId || typeof req.userId !== 'string') {
        throw APIError.invalidArgument("User ID is required");
      }

      const result = await withErrorHandling(
        'get-user-balances',
        requestId,
        async () => {
          // Ensure demo user data exists
          await ensureDemoUserExists(req.userId);

          const balanceRows = await blockchainDB.queryAll<{
            id: number;
            user_id: string;
            currency: string;
            balance: number;
            locked_balance: number;
            last_updated: Date;
          }>`
            SELECT * FROM user_balances 
            WHERE user_id = ${req.userId}
            ORDER BY currency
          `;

          const walletRow = await blockchainDB.queryRow<{
            id: number;
            user_id: string;
            address: string;
            created_at: Date;
            last_accessed: Date;
          }>`
            SELECT id, user_id, address, created_at, last_accessed 
            FROM user_wallets 
            WHERE user_id = ${req.userId}
          `;

          const balances = balanceRows.map(row => ({
            id: row.id,
            userId: row.user_id,
            currency: row.currency,
            balance: row.balance,
            lockedBalance: row.locked_balance,
            lastUpdated: row.last_updated,
          }));

          const wallet = walletRow ? {
            id: walletRow.id,
            userId: walletRow.user_id,
            address: walletRow.address,
            createdAt: walletRow.created_at,
            lastAccessed: walletRow.last_accessed,
          } : undefined;

          const response = { balances, wallet };
          setCache(cacheKey, response, 60000); // Cache for 60 seconds
          return response;
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Failed to get user balances:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve user balances");
    }
  }
);

// Allows users to buy ASM tokens with USD.
export const buyTokens = api<BuyTokenRequest, BuyTokenResponse>(
  { expose: true, method: "POST", path: "/exchange/buy" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'POST',
        path: '/exchange/buy'
      });

      // Rate limiting: 10 purchases per hour per user
      if (!checkRateLimit(`buy-${req.userId}`, 10, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for token purchases");
      }

      validateRequestSize(req, 10);

      if (!req.userId || typeof req.userId !== 'string') {
        throw APIError.invalidArgument("User ID is required");
      }

      if (!req.usdAmount || req.usdAmount <= 0) {
        throw APIError.invalidArgument("USD amount must be positive");
      }

      if (req.targetCurrency !== 'ASM') {
        throw APIError.invalidArgument("Only ASM token purchases are supported");
      }

      const result = await withErrorHandling(
        'buy-tokens',
        requestId,
        async () => {
          // Ensure demo user exists
          await ensureDemoUserExists(req.userId);

          // Get current exchange rate
          const rateRow = await blockchainDB.queryRow<{ rate: number }>`
            SELECT rate FROM currency_exchange_rates 
            WHERE currency_pair = 'ASM/USD'
            ORDER BY last_updated DESC 
            LIMIT 1
          `;

          if (!rateRow) {
            throw APIError.internal("Exchange rate not available");
          }

          const asmPerUsd = 1 / rateRow.rate; // Convert USD rate to ASM rate
          const feePercentage = 0.025; // 2.5% fee
          const feeAmount = req.usdAmount * feePercentage;
          const netUsdAmount = req.usdAmount - feeAmount;
          const estimatedTokens = netUsdAmount * asmPerUsd;

          // Check user USD balance
          const balanceRow = await blockchainDB.queryRow<{ balance: number }>`
            SELECT balance FROM user_balances 
            WHERE user_id = ${req.userId} AND currency = 'USD'
          `;

          if (!balanceRow || balanceRow.balance < req.usdAmount) {
            throw APIError.failedPrecondition("Insufficient USD balance");
          }

          // Create transaction record
          const txRow = await blockchainDB.queryRow<{
            id: number;
            user_id: string;
            transaction_type: string;
            from_currency: string;
            to_currency: string;
            from_amount: number;
            to_amount: number;
            exchange_rate: number;
            fee_amount: number;
            status: string;
            created_at: Date;
          }>`
            INSERT INTO currency_transactions (
              user_id, transaction_type, from_currency, to_currency,
              from_amount, to_amount, exchange_rate, fee_amount, status
            )
            VALUES (
              ${req.userId}, 'buy', 'USD', ${req.targetCurrency},
              ${req.usdAmount}, ${estimatedTokens}, ${rateRow.rate}, ${feeAmount}, 'pending'
            )
            RETURNING *
          `;

          if (!txRow) {
            throw new Error("Failed to create transaction");
          }

          // Update balances (simulate instant execution for demo)
          await blockchainDB.exec`
            UPDATE user_balances 
            SET balance = balance - ${req.usdAmount}, last_updated = NOW()
            WHERE user_id = ${req.userId} AND currency = 'USD'
          `;

          await blockchainDB.exec`
            UPDATE user_balances 
            SET balance = balance + ${estimatedTokens}, last_updated = NOW()
            WHERE user_id = ${req.userId} AND currency = ${req.targetCurrency}
          `;

          // Mark transaction as completed
          await blockchainDB.exec`
            UPDATE currency_transactions 
            SET status = 'completed', completed_at = NOW()
            WHERE id = ${txRow.id}
          `;

          const response = {
            transaction: {
              id: txRow.id,
              userId: txRow.user_id,
              transactionType: txRow.transaction_type,
              fromCurrency: txRow.from_currency,
              toCurrency: txRow.to_currency,
              fromAmount: txRow.from_amount,
              toAmount: txRow.to_amount,
              exchangeRate: txRow.exchange_rate,
              feeAmount: txRow.fee_amount,
              status: 'completed',
              createdAt: txRow.created_at,
              completedAt: new Date(),
            },
            estimatedTokens,
            totalFee: feeAmount,
          };

          await publishTransactionConfirmation({
            userId: req.userId,
            type: 'buy',
            status: 'completed',
            message: `Successfully purchased ${response.estimatedTokens.toFixed(2)} ${req.targetCurrency}.`,
            details: response.transaction,
          });

          invalidateCache(`user-balances:${req.userId}`);
          return response;
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Failed to buy tokens:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to process token purchase");
    }
  }
);

// Allows users to sell ASM tokens for USD.
export const sellTokens = api<SellTokenRequest, SellTokenResponse>(
  { expose: true, method: "POST", path: "/exchange/sell" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'POST',
        path: '/exchange/sell'
      });

      // Rate limiting: 10 sales per hour per user
      if (!checkRateLimit(`sell-${req.userId}`, 10, 3600000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for token sales");
      }

      validateRequestSize(req, 10);

      if (!req.userId || typeof req.userId !== 'string') {
        throw APIError.invalidArgument("User ID is required");
      }

      if (!req.asmAmount || req.asmAmount <= 0) {
        throw APIError.invalidArgument("ASM amount must be positive");
      }

      if (req.targetCurrency !== 'USD') {
        throw APIError.invalidArgument("Only selling for USD is supported");
      }

      const result = await withErrorHandling(
        'sell-tokens',
        requestId,
        async () => {
          // Ensure demo user exists
          await ensureDemoUserExists(req.userId);

          // Get current exchange rate
          const rateRow = await blockchainDB.queryRow<{ rate: number }>`
            SELECT rate FROM currency_exchange_rates 
            WHERE currency_pair = 'ASM/USD'
            ORDER BY last_updated DESC 
            LIMIT 1
          `;

          if (!rateRow) {
            throw APIError.internal("Exchange rate not available");
          }

          const feePercentage = 0.025; // 2.5% fee
          const estimatedUsd = req.asmAmount * rateRow.rate;
          const feeAmount = estimatedUsd * feePercentage;
          const netUsdAmount = estimatedUsd - feeAmount;

          // Check user ASM balance
          const balanceRow = await blockchainDB.queryRow<{ balance: number }>`
            SELECT balance FROM user_balances 
            WHERE user_id = ${req.userId} AND currency = 'ASM'
          `;

          if (!balanceRow || balanceRow.balance < req.asmAmount) {
            throw APIError.failedPrecondition("Insufficient ASM balance");
          }

          // Create transaction record
          const txRow = await blockchainDB.queryRow<{
            id: number;
            user_id: string;
            transaction_type: string;
            from_currency: string;
            to_currency: string;
            from_amount: number;
            to_amount: number;
            exchange_rate: number;
            fee_amount: number;
            status: string;
            created_at: Date;
          }>`
            INSERT INTO currency_transactions (
              user_id, transaction_type, from_currency, to_currency,
              from_amount, to_amount, exchange_rate, fee_amount, status
            )
            VALUES (
              ${req.userId}, 'sell', 'ASM', ${req.targetCurrency},
              ${req.asmAmount}, ${netUsdAmount}, ${rateRow.rate}, ${feeAmount}, 'pending'
            )
            RETURNING *
          `;

          if (!txRow) {
            throw new Error("Failed to create transaction");
          }

          // Update balances (simulate instant execution for demo)
          await blockchainDB.exec`
            UPDATE user_balances 
            SET balance = balance - ${req.asmAmount}, last_updated = NOW()
            WHERE user_id = ${req.userId} AND currency = 'ASM'
          `;

          await blockchainDB.exec`
            UPDATE user_balances 
            SET balance = balance + ${netUsdAmount}, last_updated = NOW()
            WHERE user_id = ${req.userId} AND currency = ${req.targetCurrency}
          `;

          // Mark transaction as completed
          await blockchainDB.exec`
            UPDATE currency_transactions 
            SET status = 'completed', completed_at = NOW()
            WHERE id = ${txRow.id}
          `;

          const response = {
            transaction: {
              id: txRow.id,
              userId: txRow.user_id,
              transactionType: txRow.transaction_type,
              fromCurrency: txRow.from_currency,
              toCurrency: txRow.to_currency,
              fromAmount: txRow.from_amount,
              toAmount: txRow.to_amount,
              exchangeRate: txRow.exchange_rate,
              feeAmount: txRow.fee_amount,
              status: 'completed',
              createdAt: txRow.created_at,
              completedAt: new Date(),
            },
            estimatedUsd: netUsdAmount,
            totalFee: feeAmount,
          };

          await publishTransactionConfirmation({
            userId: req.userId,
            type: 'sell',
            status: 'completed',
            message: `Successfully sold ${req.asmAmount} ASM for $${response.estimatedUsd.toFixed(2)}.`,
            details: response.transaction,
          });

          invalidateCache(`user-balances:${req.userId}`);
          return response;
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Failed to sell tokens:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to process token sale");
    }
  }
);

export interface TransactionHistoryRequest {
  userId: string;
  limit?: number;
}

export interface TransactionHistoryResponse {
  transactions: CurrencyTransaction[];
}

// Retrieves transaction history for a user.
export const getTransactionHistory = api<TransactionHistoryRequest, TransactionHistoryResponse>(
  { expose: true, method: "GET", path: "/exchange/history/:userId" },
  async (req) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      logRequest({
        requestId,
        timestamp: new Date(),
        method: 'GET',
        path: `/exchange/history/${req.userId}`
      });

      // Rate limiting: 60 requests per minute per user
      if (!checkRateLimit(`history-${req.userId}`, 60, 60000)) {
        throw APIError.resourceExhausted("Rate limit exceeded for transaction history");
      }

      if (!req.userId || typeof req.userId !== 'string') {
        throw APIError.invalidArgument("User ID is required");
      }

      const transactions = await withErrorHandling(
        'get-transaction-history',
        requestId,
        async () => {
          const limit = req.limit || 50;

          const rows = await blockchainDB.queryAll<{
            id: number;
            user_id: string;
            transaction_type: string;
            from_currency: string;
            to_currency: string;
            from_amount: number;
            to_amount: number;
            exchange_rate: number;
            fee_amount: number;
            status: string;
            blockchain_tx_hash: string | null;
            created_at: Date;
            completed_at: Date | null;
          }>`
            SELECT * FROM currency_transactions 
            WHERE user_id = ${req.userId}
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;

          return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            transactionType: row.transaction_type,
            fromCurrency: row.from_currency,
            toCurrency: row.to_currency,
            fromAmount: row.from_amount,
            toAmount: row.to_amount,
            exchangeRate: row.exchange_rate,
            feeAmount: row.fee_amount,
            status: row.status,
            blockchainTxHash: row.blockchain_tx_hash || undefined,
            createdAt: row.created_at,
            completedAt: row.completed_at || undefined,
          }));
        }
      );

      logResponse(requestId, 200, Date.now() - startTime);
      return { transactions };
    } catch (error) {
      console.error(`[${requestId}] Failed to get transaction history:`, error);
      logResponse(requestId, error instanceof APIError ? 400 : 500, Date.now() - startTime);
      
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve transaction history");
    }
  }
);

async function ensureExchangeRatesExist(): Promise<void> {
  try {
    const existingRates = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM currency_exchange_rates
    `;

    if (!existingRates || existingRates.count === 0) {
      console.log('Seeding initial exchange rates...');
      
      // Insert initial exchange rates
      await blockchainDB.exec`
        INSERT INTO currency_exchange_rates (currency_pair, rate, volume_24h, change_24h, market_cap) VALUES
        ('ASM/USD', 0.0000125, 1500000.00, 5.25, 350000000.00),
        ('ASM/ETH', 0.000000005, 750000.00, -2.15, 350000000.00),
        ('ASM/BTC', 0.0000000003, 250000.00, 1.85, 350000000.00)
      `;
      
      console.log('Exchange rates seeded successfully');
    }
  } catch (error) {
    console.error('Failed to ensure exchange rates exist:', error);
    throw error;
  }
}

async function initializeUserBalances(userId: string): Promise<void> {
  try {
    const currencies = ['USD', 'ASM', 'ETH', 'BTC'];
    const defaultBalances = {
      'USD': 1000.00,
      'ASM': 0.00,
      'ETH': 0.00,
      'BTC': 0.00
    };

    for (const currency of currencies) {
      await blockchainDB.exec`
        INSERT INTO user_balances (user_id, currency, balance)
        VALUES (${userId}, ${currency}, ${defaultBalances[currency as keyof typeof defaultBalances]})
        ON CONFLICT (user_id, currency) DO NOTHING
      `;
    }
  } catch (error) {
    console.error(`Failed to initialize user balances for ${userId}:`, error);
    throw error;
  }
}

async function ensureDemoUserExists(userId: string): Promise<void> {
  try {
    // Check if user wallet exists
    const existingWallet = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM user_wallets WHERE user_id = ${userId}
    `;

    if (!existingWallet || existingWallet.count === 0) {
      console.log(`Creating demo user wallet for ${userId}...`);
      
      // Create wallet
      const address = "0x" + crypto.randomBytes(20).toString('hex');
      const privateKey = crypto.randomBytes(32).toString('hex');
      const encryptedPrivateKey = crypto.createHash('sha256').update(privateKey + userId).digest('hex');
      
      await blockchainDB.exec`
        INSERT INTO user_wallets (user_id, address, private_key_encrypted)
        VALUES (${userId}, ${address}, ${encryptedPrivateKey})
      `;

      console.log(`Demo user wallet created for ${userId}`);
    }

    // Check if balances exist
    const existingBalances = await blockchainDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM user_balances WHERE user_id = ${userId}
    `;

    if (!existingBalances || existingBalances.count === 0) {
      console.log(`Creating demo user balances for ${userId}...`);
      
      // Initialize balances with default values
      await blockchainDB.exec`
        INSERT INTO user_balances (user_id, currency, balance)
        VALUES 
          (${userId}, 'USD', 1000.00),
          (${userId}, 'ASM', 500000.00),
          (${userId}, 'ETH', 1.5),
          (${userId}, 'BTC', 0.05)
        ON CONFLICT (user_id, currency) DO UPDATE
        SET balance = EXCLUDED.balance, last_updated = NOW()
      `;
      
      console.log(`Demo user balances created for ${userId}`);
    }
  } catch (error) {
    console.error(`Failed to ensure demo user ${userId} exists:`, error);
    throw error;
  }
}

async function updateExchangeRates(): Promise<void> {
  try {
    // Simulate market movement with small random changes
    const pairs = ['ASM/USD', 'ASM/ETH', 'ASM/BTC'];
    
    for (const pair of pairs) {
      const currentRate = await blockchainDB.queryRow<{ rate: number; change_24h: number }>`
        SELECT rate, change_24h FROM currency_exchange_rates 
        WHERE currency_pair = ${pair}
        ORDER BY last_updated DESC 
        LIMIT 1
      `;

      if (currentRate) {
        // Random change between -5% and +5%
        const changePercent = (Math.random() - 0.5) * 0.1;
        const newRate = currentRate.rate * (1 + changePercent);
        const newChange24h = currentRate.change_24h + (changePercent * 100);
        const newVolume = Math.random() * 2000000 + 500000;

        await blockchainDB.exec`
          UPDATE currency_exchange_rates 
          SET rate = ${newRate}, 
              change_24h = ${newChange24h},
              volume_24h = ${newVolume},
              last_updated = NOW()
          WHERE currency_pair = ${pair}
        `;
      }
    }
  } catch (error) {
    console.error('Failed to update exchange rates:', error);
    // Don't throw here as this is a background operation
  }
}

function generateSeedPhrase(): string {
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual'
  ];
  
  const phrase = [];
  for (let i = 0; i < 12; i++) {
    phrase.push(words[Math.floor(Math.random() * words.length)]);
  }
  
  return phrase.join(' ');
}
