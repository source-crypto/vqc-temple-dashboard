import { describe, it, expect } from 'vitest';
import { getVQCNetworkStatus, connectVQCNode, initializeQuantumState, synchronizeVQCNetwork } from '../vqc_network';

describe('VQC Network API', () => {
  describe('getVQCNetworkStatus', () => {
    it('should return network status with nodes', async () => {
      const response = await getVQCNetworkStatus();

      expect(response.status).toBeDefined();
      expect(response.nodes).toBeDefined();
      expect(response.lastUpdate).toBeDefined();
      expect(Array.isArray(response.nodes)).toBe(true);
      expect(response.status.totalNodes).toBeGreaterThan(0);
      expect(response.status.networkHealth).toBeGreaterThanOrEqual(0);
      expect(response.status.networkHealth).toBeLessThanOrEqual(1);
    });

    it('should include quantum nodes in the response', async () => {
      const response = await getVQCNetworkStatus();

      expect(response.status.quantumNodes).toBeGreaterThanOrEqual(0);
      expect(response.status.averageEntropy).toBeGreaterThan(0);
      expect(response.status.averageCoherence).toBeGreaterThan(0);
    });
  });

  describe('connectVQCNode', () => {
    it('should connect a quantum node successfully', async () => {
      const request = {
        address: 'vqc-test-node.quantum.network',
        port: 8545,
        nodeType: 'quantum' as const
      };

      const response = await connectVQCNode(request);

      expect(response.success).toBeDefined();
      expect(response.nodeId).toBeDefined();
      expect(response.message).toBeDefined();
      expect(typeof response.nodeId).toBe('string');
    });

    it('should reject invalid port numbers', async () => {
      const request = {
        address: 'vqc-test-node.quantum.network',
        port: -1,
        nodeType: 'quantum' as const
      };

      await expect(connectVQCNode(request)).rejects.toThrow();
    });

    it('should reject invalid node types', async () => {
      const request = {
        address: 'vqc-test-node.quantum.network',
        port: 8545,
        nodeType: 'invalid' as any
      };

      await expect(connectVQCNode(request)).rejects.toThrow();
    });
  });

  describe('initializeQuantumState', () => {
    it('should initialize quantum state successfully', async () => {
      const request = {
        nodeId: 'test-node-id-12345',
        initialEntropy: 0.8,
        coherenceTarget: 50.0
      };

      const response = await initializeQuantumState(request);

      expect(response.success).toBe(true);
      expect(response.quantumState).toBeDefined();
      expect(response.entropyLevel).toBeGreaterThan(0);
      expect(response.entropyLevel).toBeLessThanOrEqual(1);
      expect(response.coherenceTime).toBeGreaterThan(0);
    });

    it('should reject invalid entropy values', async () => {
      const request = {
        nodeId: 'test-node-id-12345',
        initialEntropy: 1.5, // Invalid: > 1
        coherenceTarget: 50.0
      };

      await expect(initializeQuantumState(request)).rejects.toThrow();
    });

    it('should reject negative coherence targets', async () => {
      const request = {
        nodeId: 'test-node-id-12345',
        initialEntropy: 0.8,
        coherenceTarget: -10.0 // Invalid: negative
      };

      await expect(initializeQuantumState(request)).rejects.toThrow();
    });
  });

  describe('synchronizeVQCNetwork', () => {
    it('should synchronize network successfully', async () => {
      const request = {
        forceSync: false
      };

      const response = await synchronizeVQCNetwork(request);

      expect(response.success).toBeDefined();
      expect(response.syncedNodes).toBeGreaterThanOrEqual(0);
      expect(response.failedNodes).toBeGreaterThanOrEqual(0);
      expect(response.networkHealth).toBeGreaterThanOrEqual(0);
      expect(response.networkHealth).toBeLessThanOrEqual(1);
      expect(response.message).toBeDefined();
    });

    it('should handle force sync option', async () => {
      const request = {
        forceSync: true
      };

      const response = await synchronizeVQCNetwork(request);

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });
  });
});
