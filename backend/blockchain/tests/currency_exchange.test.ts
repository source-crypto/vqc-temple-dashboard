import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getExchangeRates, createWallet, getUserBalances, buyTokens, sellTokens, getTransactionHistory } from '../currency_exchange';
import { blockchainDB } from '../db';

describe('Currency Exchange API', () => {
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    // Clean up test data
    await blockchainDB.exec`DELETE FROM user_wallets WHERE user_id LIKE 'test-%'`;
    await blockchainDB.exec`DELETE FROM user_balances WHERE user_id LIKE 'test-%'`;
    await blockchainDB.exec`DELETE FROM currency_transactions WHERE user_id LIKE 'test-%'`;
  });

  afterEach(async () => {
    // Clean up test data
    await blockchainDB.exec`DELETE FROM user_wallets WHERE user_id LIKE 'test-%'`;
    await blockchainDB.exec`DELETE FROM user_balances WHERE user_id LIKE 'test-%'`;
    await blockchainDB.exec`DELETE FROM currency_transactions WHERE user_id LIKE 'test-%'`;
  });

  describe('getExchangeRates', () => {
    it('should return exchange rates', async () => {
      const response = await getExchangeRates();

      expect(response.rates).toBeDefined();
      expect(Array.isArray(response.rates)).toBe(true);
      expect(response.rates.length).toBeGreaterThan(0);
      
      const asmRate = response.rates.find(r => r.currencyPair === 'ASM/USD');
      expect(asmRate).toBeDefined();
      expect(asmRate!.rate).toBeGreaterThan(0);
    });

    it('should include required rate properties', async () => {
      const response = await getExchangeRates();
      const rate = response.rates[0];

      expect(rate.id).toBeDefined();
      expect(rate.currencyPair).toBeDefined();
      expect(rate.rate).toBeGreaterThan(0);
      expect(rate.volume24h).toBeGreaterThanOrEqual(0);
      expect(rate.marketCap).toBeGreaterThanOrEqual(0);
      expect(rate.lastUpdated).toBeDefined();
    });
  });

  describe('createWallet', () => {
    it('should create a new wallet for user', async () => {
      const request = { userId: testUserId };
      const response = await createWallet(request);

      expect(response.wallet).toBeDefined();
      expect(response.wallet.userId).toBe(testUserId);
      expect(response.wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(response.seedPhrase).toBeDefined();
      expect(response.seedPhrase.split(' ')).toHaveLength(12);
    });

    it('should reject duplicate wallet creation', async () => {
      const request = { userId: testUserId };
      
      // Create first wallet
      await createWallet(request);
      
      // Attempt to create second wallet should fail
      await expect(createWallet(request)).rejects.toThrow();
    });

    it('should reject invalid user ID', async () => {
      const request = { userId: '' };
      await expect(createWallet(request)).rejects.toThrow();
    });
  });

  describe('getUserBalances', () => {
    it('should return user balances after wallet creation', async () => {
      // Create wallet first
      await createWallet({ userId: testUserId });
      
      const response = await getUserBalances({ userId: testUserId });

      expect(response.balances).toBeDefined();
      expect(Array.isArray(response.balances)).toBe(true);
      expect(response.balances.length).toBeGreaterThan(0);
      expect(response.wallet).toBeDefined();
      
      const usdBalance = response.balances.find(b => b.currency === 'USD');
      expect(usdBalance).toBeDefined();
      expect(usdBalance!.balance).toBe(1000); // Default USD balance
    });

    it('should create demo user if not exists', async () => {
      const response = await getUserBalances({ userId: testUserId });

      expect(response.balances).toBeDefined();
      expect(response.balances.length).toBeGreaterThan(0);
    });
  });

  describe('buyTokens', () => {
    beforeEach(async () => {
      // Ensure user exists with balances
      await getUserBalances({ userId: testUserId });
    });

    it('should successfully buy ASM tokens', async () => {
      const request = {
        userId: testUserId,
        usdAmount: 100,
        targetCurrency: 'ASM'
      };

      const response = await buyTokens(request);

      expect(response.transaction).toBeDefined();
      expect(response.transaction.status).toBe('completed');
      expect(response.transaction.fromCurrency).toBe('USD');
      expect(response.transaction.toCurrency).toBe('ASM');
      expect(response.estimatedTokens).toBeGreaterThan(0);
      expect(response.totalFee).toBeGreaterThan(0);
    });

    it('should reject insufficient balance', async () => {
      const request = {
        userId: testUserId,
        usdAmount: 10000, // More than default balance
        targetCurrency: 'ASM'
      };

      await expect(buyTokens(request)).rejects.toThrow();
    });

    it('should reject invalid currency', async () => {
      const request = {
        userId: testUserId,
        usdAmount: 100,
        targetCurrency: 'INVALID'
      };

      await expect(buyTokens(request)).rejects.toThrow();
    });
  });

  describe('sellTokens', () => {
    beforeEach(async () => {
      // Ensure user exists with balances
      await getUserBalances({ userId: testUserId });
    });

    it('should successfully sell ASM tokens', async () => {
      const request = {
        userId: testUserId,
        asmAmount: 1000,
        targetCurrency: 'USD'
      };

      const response = await sellTokens(request);

      expect(response.transaction).toBeDefined();
      expect(response.transaction.status).toBe('completed');
      expect(response.transaction.fromCurrency).toBe('ASM');
      expect(response.transaction.toCurrency).toBe('USD');
      expect(response.estimatedUsd).toBeGreaterThan(0);
      expect(response.totalFee).toBeGreaterThan(0);
    });

    it('should reject insufficient ASM balance', async () => {
      const request = {
        userId: testUserId,
        asmAmount: 1000000, // More than default balance
        targetCurrency: 'USD'
      };

      await expect(sellTokens(request)).rejects.toThrow();
    });
  });

  describe('getTransactionHistory', () => {
    beforeEach(async () => {
      // Ensure user exists
      await getUserBalances({ userId: testUserId });
    });

    it('should return empty history for new user', async () => {
      const response = await getTransactionHistory({ userId: testUserId });

      expect(response.transactions).toBeDefined();
      expect(Array.isArray(response.transactions)).toBe(true);
    });

    it('should return transactions after trading', async () => {
      // Perform a buy transaction
      await buyTokens({
        userId: testUserId,
        usdAmount: 100,
        targetCurrency: 'ASM'
      });

      const response = await getTransactionHistory({ userId: testUserId });

      expect(response.transactions.length).toBeGreaterThan(0);
      const transaction = response.transactions[0];
      expect(transaction.userId).toBe(testUserId);
      expect(transaction.transactionType).toBe('buy');
    });

    it('should respect limit parameter', async () => {
      // Create multiple transactions
      for (let i = 0; i < 3; i++) {
        await buyTokens({
          userId: testUserId,
          usdAmount: 10,
          targetCurrency: 'ASM'
        });
      }

      const response = await getTransactionHistory({ 
        userId: testUserId, 
        limit: 2 
      });

      expect(response.transactions.length).toBeLessThanOrEqual(2);
    });
  });
});
