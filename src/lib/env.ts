/**
 * Secure environment variable loader for AWS Amplify
 * 
 * This file provides secure access to environment variables without exposing
 * sensitive information in the codebase
 */

import { safeLog } from './utils';

// Helper function to log environment variable status (without exposing values)
export function logEnvironmentStatus(): void {
  safeLog('Environment Information:', {
    NODE_ENV: process.env.NODE_ENV,
    isAmplify: isAmplifyEnvironment(),
    AMPLIFY_APP_DOMAIN: process.env.AMPLIFY_APP_DOMAIN || 'not set',
    AWS_REGION: process.env.AWS_REGION || 'not set',
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'set' : 'not set',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set'
  });
}

// Safe environment variable accessor with proper type checking
export function getEnv(key: string, required = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    console.error(`Required environment variable ${key} is missing`);
  }
  return value;
}

// Check if we're running in AWS Amplify
export function isAWSAmplify(): boolean {
  return !!process.env.AWS_REGION;
}

// Check if we're in production mode
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Determine if running in Amplify environment
export function isAmplifyEnvironment(): boolean {
  return process.env.AMPLIFY_ENVIRONMENT === 'true' || 
         !!process.env.AWS_LAMBDA_FUNCTION_NAME || 
         !!process.env.AWS_REGION;
}

// Get the correct NextAuth URL based on environment
export function getNextAuthURL(): string {
  // Check for explicitly set NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // Check for Amplify custom domain
  if (process.env.AMPLIFY_APP_DOMAIN) {
    return `https://${process.env.AMPLIFY_APP_DOMAIN}`;
  }
  
  // Check for Amplify default domain pattern
  if (isAmplifyEnvironment() && process.env.AWS_AMPLIFY_APP_ID) {
    const branch = process.env.AWS_BRANCH || 'main';
    return `https://${branch}.${process.env.AWS_AMPLIFY_APP_ID}.amplifyapp.com`;
  }
  
  // Default to localhost
  return 'http://localhost:3000';
}

// Environment variable helper with secure fallbacks
export const ENV = {
  // Database connection - NO DEFAULT PROVIDED in production
  get MONGODB_URI(): string {
    const uri = process.env.MONGODB_URI;
    if (!uri && isProduction()) {
      console.error('MONGODB_URI not found in production environment');
      // Return empty string for production - app will properly show error
      return '';
    }
    // Return the actual URI if available, or empty for development
    return uri || '';
  },
  
  // NextAuth URL - determined dynamically but safely
  get NEXTAUTH_URL(): string {
    return getNextAuthURL();
  },
  
  // NextAuth Secret - NO DEFAULT PROVIDED in production
  get NEXTAUTH_SECRET(): string {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret && isProduction()) {
      console.error('NEXTAUTH_SECRET not found in production environment');
      return '';
    }
    // Return the actual secret if available, or mock for development
    return secret || 'dev-mode-secret-not-used-in-production';
  },
  
  // Environment checks
  isProduction,
  isAWSAmplify,
  
  // System helper to determine if environment is properly configured
  checkEnvironment(): boolean {
    // List all required environment variables for production
    const requiredForProduction = [
      'MONGODB_URI',
      'NEXTAUTH_SECRET',
      'CLOUDINARY_API_SECRET',
      'DEEPSEEK_API_KEY',
    ];
    
    if (isProduction()) {
      // Check all required variables exist in production
      const missingVars = requiredForProduction.filter(key => !process.env[key]);
      
      if (missingVars.length > 0) {
        console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        return false;
      }
    }
    
    return true;
  }
}; 