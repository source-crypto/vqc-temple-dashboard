import { describe, it, expect } from 'vitest';
import { handleError, withErrorHandling, generateRequestId, sanitizeInput, detectSuspiciousActivity } from '../middleware';
import { APIError } from 'encore.dev/api';

describe('Error Handling and Middleware', () => {
  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('handleError', () => {
    it('should return APIError as-is', () => {
      const originalError = APIError.invalidArgument('Test error');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: originalError
      };

      const result = handleError(context);
      expect(result).toBe(originalError);
    });

    it('should convert database errors to unavailable', () => {
      const dbError = new Error('database connection failed');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: dbError
      };

      const result = handleError(context);
      expect(result.code).toBe('unavailable');
      expect(result.message).toContain('Database temporarily unavailable');
    });

    it('should convert validation errors to invalid argument', () => {
      const validationError = new Error('validation failed: invalid input');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: validationError
      };

      const result = handleError(context);
      expect(result.code).toBe('invalid_argument');
    });

    it('should convert permission errors to permission denied', () => {
      const permissionError = new Error('permission denied: insufficient access');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: permissionError
      };

      const result = handleError(context);
      expect(result.code).toBe('permission_denied');
    });

    it('should convert rate limit errors to resource exhausted', () => {
      const rateLimitError = new Error('rate limit exceeded');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: rateLimitError
      };

      const result = handleError(context);
      expect(result.code).toBe('resource_exhausted');
    });

    it('should default to internal error for unknown errors', () => {
      const unknownError = new Error('something went wrong');
      const context = {
        requestId: 'test-123',
        operation: 'test-operation',
        error: unknownError
      };

      const result = handleError(context);
      expect(result.code).toBe('internal');
    });
  });

  describe('withErrorHandling', () => {
    it('should execute function successfully', async () => {
      const testFunction = async () => {
        return 'success';
      };

      const result = await withErrorHandling(
        'test-operation',
        'test-123',
        testFunction
      );

      expect(result).toBe('success');
    });

    it('should handle thrown errors', async () => {
      const testFunction = async () => {
        throw new Error('test error');
      };

      await expect(
        withErrorHandling('test-operation', 'test-123', testFunction)
      ).rejects.toThrow();
    });

    it('should handle APIErrors properly', async () => {
      const testFunction = async () => {
        throw APIError.notFound('Resource not found');
      };

      await expect(
        withErrorHandling('test-operation', 'test-123', testFunction)
      ).rejects.toThrow('Resource not found');
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string input', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello scriptalert(xss)/script World');
    });

    it('should sanitize object input', () => {
      const input = {
        name: 'John <script>',
        email: 'john@example.com',
        nested: {
          value: 'test & value'
        }
      };

      const result = sanitizeInput(input);
      expect(result.name).toBe('John script');
      expect(result.email).toBe('john@example.com');
      expect(result.nested.value).toBe('test  value');
    });

    it('should sanitize array input', () => {
      const input = ['<script>', 'normal text', 'test & value'];
      const result = sanitizeInput(input);
      
      expect(result[0]).toBe('script');
      expect(result[1]).toBe('normal text');
      expect(result[2]).toBe('test  value');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
      expect(sanitizeInput(123)).toBe(123);
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect SQL injection patterns', () => {
      const context = {
        requestId: 'test-123',
        timestamp: new Date(),
        method: 'POST',
        path: '/test'
      };

      const suspiciousData = {
        query: "'; DROP TABLE users; --"
      };

      const result = detectSuspiciousActivity(context, suspiciousData);
      expect(result).toBe(true);
    });

    it('should detect script injection patterns', () => {
      const context = {
        requestId: 'test-123',
        timestamp: new Date(),
        method: 'POST',
        path: '/test'
      };

      const suspiciousData = {
        content: '<script>alert("xss")</script>'
      };

      const result = detectSuspiciousActivity(context, suspiciousData);
      expect(result).toBe(true);
    });

    it('should not flag normal data', () => {
      const context = {
        requestId: 'test-123',
        timestamp: new Date(),
        method: 'POST',
        path: '/test'
      };

      const normalData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello world!'
      };

      const result = detectSuspiciousActivity(context, normalData);
      expect(result).toBe(false);
    });

    it('should detect suspicious patterns in path', () => {
      const context = {
        requestId: 'test-123',
        timestamp: new Date(),
        method: 'GET',
        path: '/api/users?id=1 UNION SELECT * FROM passwords'
      };

      const result = detectSuspiciousActivity(context);
      expect(result).toBe(true);
    });
  });
});
