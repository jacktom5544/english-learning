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

// Safe logging function
export function safeLog(message: string, ...args: any[]): void {
  console.log(
    message,
    ...args.map(arg => 
      typeof arg === 'object' && arg !== null 
        ? sanitizeObject(arg) 
        : arg
    )
  );
}

export function safeError(message: string, ...args: any[]): void {
  console.error(
    message,
    ...args.map(arg => 
      typeof arg === 'object' && arg !== null 
        ? sanitizeObject(arg) 
        : arg
    )
  );
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
