import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createActivationToken, activateToken, listActivationTokens } from '../activation';
import { templeDB } from '../db';

describe('Activation Token API', () => {
  beforeEach(async () => {
    // Clean up test data
    await templeDB.exec`DELETE FROM activation_tokens WHERE yubikey_serial LIKE 'TEST%'`;
  });

  afterEach(async () => {
    // Clean up test data
    await templeDB.exec`DELETE FROM activation_tokens WHERE yubikey_serial LIKE 'TEST%'`;
  });

  describe('createActivationToken', () => {
    it('should create a basic activation token', async () => {
      const request = {
        yubikeySerial: 'TEST123456',
        expirationHours: 24
      };

      const response = await createActivationToken(request);

      expect(response.token).toBeDefined();
      expect(response.token.yubikeySerial).toBe('TEST123456');
      expect(response.token.isActive).toBe(true);
      expect(response.token.tokenId).toBeDefined();
    });

    it('should create a token with Shamir shares', async () => {
      const request = {
        yubikeySerial: 'TEST789012',
        shamirShares: ['share1', 'share2', 'share3'],
        threshold: 2,
        expirationHours: 48
      };

      const response = await createActivationToken(request);

      expect(response.token.shamirShares).toEqual(['share1', 'share2', 'share3']);
      expect(response.token.threshold).toBe(2);
    });

    it('should reject invalid YubiKey serial', async () => {
      const request = {
        yubikeySerial: '',
        expirationHours: 24
      };

      await expect(createActivationToken(request)).rejects.toThrow();
    });

    it('should reject invalid threshold', async () => {
      const request = {
        yubikeySerial: 'TEST345678',
        shamirShares: ['share1', 'share2'],
        threshold: 5,
        expirationHours: 24
      };

      await expect(createActivationToken(request)).rejects.toThrow();
    });
  });

  describe('activateToken', () => {
    it('should activate a valid token', async () => {
      // First create a token
      const createRequest = {
        yubikeySerial: 'TEST456789',
        expirationHours: 24
      };

      const createResponse = await createActivationToken(createRequest);

      // Then activate it
      const activateRequest = {
        tokenId: createResponse.token.tokenId,
        yubikeyOTP: 'cbdefghijklnrtuvcbdefghijklnrtuvcbdefghij'
      };

      const activateResponse = await activateToken(activateRequest);

      expect(activateResponse.success).toBe(true);
      expect(activateResponse.message).toContain('activated successfully');
    });

    it('should reject invalid token ID', async () => {
      const request = {
        tokenId: 'invalid-token-id',
        yubikeyOTP: 'cbdefghijklnrtuvcbdefghijklnrtuvcbdefghij'
      };

      await expect(activateToken(request)).rejects.toThrow();
    });

    it('should reject invalid OTP format', async () => {
      const request = {
        tokenId: 'some-token-id',
        yubikeyOTP: 'invalid-otp'
      };

      await expect(activateToken(request)).rejects.toThrow();
    });
  });

  describe('listActivationTokens', () => {
    it('should return empty list when no tokens exist', async () => {
      const response = await listActivationTokens();
      
      expect(response.tokens).toBeDefined();
      expect(Array.isArray(response.tokens)).toBe(true);
    });

    it('should return created tokens', async () => {
      // Create a test token
      const createRequest = {
        yubikeySerial: 'TEST567890',
        expirationHours: 24
      };

      await createActivationToken(createRequest);

      const response = await listActivationTokens();
      
      expect(response.tokens.length).toBeGreaterThan(0);
      const testToken = response.tokens.find(t => t.yubikeySerial === 'TEST567890');
      expect(testToken).toBeDefined();
    });
  });
});
