import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deployVQCInfrastructure, deployAssimilatorToken, listContracts, getContractDetails } from '../contracts';
import { blockchainDB } from '../db';

describe('Blockchain Contracts API', () => {
  beforeEach(async () => {
    // Clean up test data
    await blockchainDB.exec`DELETE FROM contracts WHERE contract_name LIKE 'TEST%'`;
  });

  afterEach(async () => {
    // Clean up test data
    await blockchainDB.exec`DELETE FROM contracts WHERE contract_name LIKE 'TEST%'`;
  });

  describe('deployVQCInfrastructure', () => {
    it('should deploy VQC infrastructure contract', async () => {
      const response = await deployVQCInfrastructure();

      expect(response.contract).toBeDefined();
      expect(response.transactionHash).toBeDefined();
      expect(response.contract.contractName).toBe('VQCTempleInfrastructure');
      expect(response.contract.contractType).toBe('infrastructure');
      expect(response.contract.verificationStatus).toBe('verified');
      expect(response.contract.abi).toBeDefined();
      expect(response.contract.bytecode).toBeDefined();
    });

    it('should include required VQC functions in ABI', async () => {
      const response = await deployVQCInfrastructure();

      const functionNames = response.contract.abi.functions.map((f: any) => f.name);
      expect(functionNames).toContain('createAttestation');
      expect(functionNames).toContain('verifyAttestation');
      expect(functionNames).toContain('createActivationToken');
      expect(functionNames).toContain('activateToken');
      expect(functionNames).toContain('generateCeremonialArtifact');
    });
  });

  describe('deployAssimilatorToken', () => {
    it('should deploy Assimilator token with 28 trillion supply', async () => {
      const response = await deployAssimilatorToken();

      expect(response.success).toBe(true);
      expect(response.totalSupply).toBe('28000000000000000000000000000000000');
      expect(response.contractAddress).toBeDefined();
      expect(response.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should create token balance for creator', async () => {
      const response = await deployAssimilatorToken();

      // Check that token balance was created
      const balance = await blockchainDB.queryRow<{ balance: string }>`
        SELECT balance FROM token_balances 
        WHERE token_contract = ${response.contractAddress}
      `;

      expect(balance).toBeDefined();
      expect(balance!.balance).toBe('28000000000000000000000000000000000');
    });
  });

  describe('listContracts', () => {
    it('should return empty list when no contracts exist', async () => {
      const response = await listContracts();

      expect(response.contracts).toBeDefined();
      expect(Array.isArray(response.contracts)).toBe(true);
      expect(response.total).toBe(response.contracts.length);
    });

    it('should return deployed contracts', async () => {
      // Deploy a contract first
      await deployVQCInfrastructure();

      const response = await listContracts();

      expect(response.contracts.length).toBeGreaterThan(0);
      expect(response.total).toBeGreaterThan(0);
      
      const vqcContract = response.contracts.find(c => c.contractName === 'VQCTempleInfrastructure');
      expect(vqcContract).toBeDefined();
    });
  });

  describe('getContractDetails', () => {
    it('should return contract details for valid address', async () => {
      // Deploy a contract first
      const deployResponse = await deployVQCInfrastructure();

      const response = await getContractDetails({
        address: deployResponse.contract.contractAddress
      });

      expect(response.contract).toBeDefined();
      expect(response.transactionCount).toBeGreaterThanOrEqual(0);
      expect(response.tokenTransfers).toBeGreaterThanOrEqual(0);
      expect(response.contract.contractAddress).toBe(deployResponse.contract.contractAddress);
    });

    it('should reject invalid contract address', async () => {
      const request = {
        address: 'invalid-address'
      };

      await expect(getContractDetails(request)).rejects.toThrow();
    });

    it('should return not found for non-existent contract', async () => {
      const request = {
        address: '0x1234567890123456789012345678901234567890'
      };

      await expect(getContractDetails(request)).rejects.toThrow();
    });
  });
});
