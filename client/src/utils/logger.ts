/**
 * Secure Logger Utility
 * Sanitizes all logs to prevent data leakage of PII and sensitive information
 * Enforces tag-based logging for better debugging
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const SENSITIVE_KEYS = [
  'user_id',
  'expense_id',
  'workspace_identifier',
  'device_id',
  'email',
  'id',
  'password',
  'auth_token',
  'access_token',
  'secret',
  'api_key',
];

/**
 * Sanitize object by redacting sensitive keys
 */
function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item));
  }

  const sanitized = { ...data };
  SENSITIVE_KEYS.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Format log message with tag
 */
function formatMessage(tag: string, message: string): string {
  return `[${tag}] ${message}`;
}

/**
 * Main logger object with methods for different log levels
 */
export const logger = {
  /**
   * Log error (always shown, sanitized in production)
   */
  error: (tag: string, message: string, data?: any): void => {
    const formattedMsg = formatMessage(tag, message);
    if (isDevelopment) {
      console.error(formattedMsg, data || '');
    } else {
      console.error(formattedMsg, data ? sanitizeForLog(data) : '');
    }
  },

  /**
   * Log warning (always shown, sanitized in production)
   */
  warn: (tag: string, message: string, data?: any): void => {
    const formattedMsg = formatMessage(tag, message);
    if (isDevelopment) {
      console.warn(formattedMsg, data || '');
    } else {
      console.warn(formattedMsg, data ? sanitizeForLog(data) : '');
    }
  },

  /**
   * Log info (only shown in development)
   */
  info: (tag: string, message: string, data?: any): void => {
    if (isDevelopment) {
      const formattedMsg = formatMessage(tag, message);
      console.log(formattedMsg, data || '');
    }
  },

  /**
   * Log debug (only shown in development)
   */
  debug: (tag: string, message: string, data?: any): void => {
    if (isDevelopment) {
      const formattedMsg = formatMessage(tag, message);
      console.log(formattedMsg, data || '');
    }
  },
};

/**
 * Type-safe error logging
 */
export function logError(tag: string, message: string, error?: any): void {
  if (!error) {
    logger.error(tag, message);
    return;
  }

  const errorData = {
    message: error?.message || 'Unknown error',
    code: error?.code || 'UNKNOWN',
    ...(isDevelopment && { stack: error?.stack }),
  };

  logger.error(tag, message, errorData);
}

/**
 * Batch logging for multiple operations
 */
export class BatchLogger {
  private tag: string;
  private logs: Array<{ level: 'error' | 'warn' | 'info'; message: string; data?: any }> = [];

  constructor(tag: string) {
    this.tag = tag;
  }

  error(message: string, data?: any): void {
    this.logs.push({ level: 'error', message, data });
  }

  warn(message: string, data?: any): void {
    this.logs.push({ level: 'warn', message, data });
  }

  info(message: string, data?: any): void {
    this.logs.push({ level: 'info', message, data });
  }

  flush(): void {
    this.logs.forEach(log => {
      switch (log.level) {
        case 'error':
          logger.error(this.tag, log.message, log.data);
          break;
        case 'warn':
          logger.warn(this.tag, log.message, log.data);
          break;
        case 'info':
          logger.info(this.tag, log.message, log.data);
          break;
      }
    });
    this.logs = [];
  }

  clear(): void {
    this.logs = [];
  }

  hasErrors(): boolean {
    return this.logs.some(log => log.level === 'error');
  }
}

/**
 * Export sanitizeForLog for manual use
 */
export { sanitizeForLog };
