import { APIError } from "encore.dev/api";
import crypto from "crypto";

export interface RequestContext {
  requestId: string;
  timestamp: Date;
  method: string;
  path: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

export interface ErrorContext {
  requestId: string;
  operation: string;
  error: Error;
  context?: any;
}

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log request details
export function logRequest(context: RequestContext): void {
  console.log(`[${context.requestId}] ${context.method} ${context.path}`, {
    timestamp: context.timestamp.toISOString(),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    userId: context.userId,
  });
}

// Log response details
export function logResponse(requestId: string, statusCode: number, duration: number): void {
  console.log(`[${requestId}] Response ${statusCode} (${duration}ms)`);
}

// Centralized error handler
export function handleError(context: ErrorContext): APIError {
  const { requestId, operation, error, context: errorContext } = context;
  
  console.error(`[${requestId}] Error in ${operation}:`, {
    error: error.message,
    stack: error.stack,
    context: errorContext,
    timestamp: new Date().toISOString(),
  });

  // Return appropriate API error based on error type
  if (error instanceof APIError) {
    return error;
  }

  // Database errors
  if (error.message.includes('database') || error.message.includes('connection')) {
    return APIError.unavailable("Database temporarily unavailable");
  }

  // Validation errors
  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return APIError.invalidArgument(error.message);
  }

  // Permission errors
  if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    return APIError.permissionDenied("Insufficient permissions");
  }

  // Rate limiting errors
  if (error.message.includes('rate limit') || error.message.includes('too many')) {
    return APIError.resourceExhausted("Rate limit exceeded");
  }

  // Default to internal error
  return APIError.internal("An internal error occurred");
}

// Wrap database operations with error handling
export async function withErrorHandling<T>(
  operation: string,
  requestId: string,
  fn: () => Promise<T>,
  context?: any
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw handleError({
      requestId,
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
      context,
    });
  }
}

// Validate and sanitize input data
export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    // Remove potentially dangerous characters
    return data.replace(/[<>\"'&]/g, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Check for suspicious patterns in requests
export function detectSuspiciousActivity(context: RequestContext, data?: any): boolean {
  // Check for SQL injection patterns
  const sqlPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /insert\s+into/i,
    /update\s+set/i,
    /exec\s*\(/i,
    /script\s*>/i,
  ];

  const dataString = JSON.stringify(data || {});
  const pathString = context.path;

  for (const pattern of sqlPatterns) {
    if (pattern.test(dataString) || pattern.test(pathString)) {
      console.warn(`[${context.requestId}] Suspicious activity detected:`, {
        pattern: pattern.source,
        path: context.path,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return true;
    }
  }

  return false;
}

// Rate limiting with IP-based tracking
const ipRateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();

export function checkIPRateLimit(ipAddress: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = ipAddress;
  const record = ipRateLimits.get(key);

  if (!record || now > record.resetTime) {
    ipRateLimits.set(key, { count: 1, resetTime: now + windowMs, blocked: false });
    return true;
  }

  if (record.blocked) {
    return false;
  }

  if (record.count >= limit) {
    record.blocked = true;
    console.warn(`IP ${ipAddress} blocked for rate limit violation`);
    return false;
  }

  record.count++;
  return true;
}

// CSRF token validation (for state-changing operations)
export function validateCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (token.length !== expectedToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  
  return result === 0;
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
