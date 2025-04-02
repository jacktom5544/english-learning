/**
 * Secure environment variable loader for AWS Amplify
 * 
 * This file provides secure access to environment variables without exposing
 * sensitive information in the codebase
 */

// Helper function to log environment variable status (without exposing values)
export function logEnvironmentStatus() {
  console.log('Environment check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- MongoDB URI exists:', !!process.env.MONGODB_URI);
  console.log('- NEXTAUTH_URL exists:', !!process.env.NEXTAUTH_URL);
  console.log('- NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
  console.log('- Environment detected:', isAWSAmplify() ? 'AWS Amplify' : (isProduction() ? 'Production' : 'Development'));
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

// Determine proper NextAuth URL based on environment
export function getNextAuthURL(): string {
  // Try to get from env first (preferred)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // In AWS Amplify, construct from domain name if available
  if (isAWSAmplify() && process.env.AMPLIFY_APP_DOMAIN) {
    return `https://${process.env.AMPLIFY_APP_DOMAIN}`;
  }
  
  // Last resort fallback for AWS Amplify (using hardcoded domain)
  if (isAWSAmplify()) {
    console.warn('NEXTAUTH_URL not found, using derived URL for AWS Amplify');
    return 'https://main.d2gwwh0jouqtnx.amplifyapp.com';
  }
  
  // Return localhost for development (non-sensitive)
  if (!isProduction()) {
    return 'http://localhost:3000';
  }
  
  // Log an error in production if we can't determine the URL
  console.error('NEXTAUTH_URL is not set in production environment');
  return '';
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