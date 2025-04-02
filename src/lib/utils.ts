import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sanitized console logging
const sensitiveFields = ['email', 'name', 'password', 'firstName', 'lastName', 'phone', 'address', 'user'];

// Helper to check if a key or value might contain sensitive information
function isSensitiveKey(key: string): boolean {
  return sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()));
}

// Helper to sanitize an object recursively
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      if (typeof value === 'string') {
        // Mask most of the string but leave a hint of what it is
        sanitized[key] = value.length > 0 
          ? `${value.substring(0, 1)}***${value.substring(value.length - 1)}`
          : '***';
      } else if (value === null || value === undefined) {
        sanitized[key] = value;
      } else {
        sanitized[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Safe logging function that works in all environments
 * Avoids exposing sensitive data in production logs
 */
export function safeLog(message: string, ...args: any[]): void {
  try {
    // In production, we might want to limit some logging
    if (process.env.NODE_ENV === 'production') {
      // Filter out potentially sensitive information
      const safeArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          // Clone the object to avoid modifying the original
          const safeCopy = { ...arg };
          
          // Mask potentially sensitive fields
          const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
          Object.keys(safeCopy).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
              safeCopy[key] = '[REDACTED]';
            }
          });
          
          return safeCopy;
        }
        return arg;
      });
      
      console.log(`[INFO] ${message}`, ...safeArgs);
    } else {
      // In development, log everything
      console.log(`[INFO] ${message}`, ...args);
    }
  } catch (error) {
    console.error('Error in safeLog:', error);
  }
}

/**
 * Safe error logging function
 */
export function safeError(message: string, ...args: any[]): void {
  try {
    // For errors, we generally want to log in all environments
    console.error(`[ERROR] ${message}`, ...args);
  } catch (error) {
    console.error('Error in safeError:', error);
  }
}

export function safeWarn(message: string, ...args: any[]): void {
  console.warn(
    message,
    ...args.map(arg => 
      typeof arg === 'object' && arg !== null 
        ? sanitizeObject(arg) 
        : arg
    )
  );
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    safeError('Error parsing JSON', error);
    return fallback;
  }
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | number): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    safeError('Error formatting date', error);
    return String(date);
  }
}

/**
 * Format a datetime for display
 */
export function formatDateTime(date: Date | string | number): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    safeError('Error formatting datetime', error);
    return String(date);
  }
}
