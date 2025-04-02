/**
 * Environment variable loader for AWS Amplify
 * 
 * This file ensures environment variables are properly loaded, especially in AWS Amplify
 * which can sometimes have issues with Next.js environment variable loading.
 */

// Helper function to log environment variable status (without exposing values)
export function logEnvironmentStatus() {
  console.log('Environment check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- MongoDB URI exists:', !!process.env.MONGODB_URI);
  console.log('- NEXTAUTH_URL exists:', !!process.env.NEXTAUTH_URL);
  console.log('- NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
  console.log('- NEXT_PUBLIC vars present:', {
    cloudinary_name: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    cloudinary_key: !!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    stripe_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}

// Safe getter for environment variables with validation
export function getEnv(key: string, required = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    console.error(`Required environment variable ${key} is missing`);
  }
  return value;
}

// MongoDB connection string with fallback
export function getMongoDBURI(): string {
  return process.env.MONGODB_URI || 
    'mongodb+srv://blogAdmin:BzvJciCcQ8A4i1DM@cluster0.zp8ls.mongodb.net/english-learning?retryWrites=true&w=majority&appName=Cluster0';
}

// NextAuth URL with automatic detection
export function getNextAuthURL(): string {
  // Try to get from env first
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  
  // In Amplify, construct from available info
  if (process.env.AWS_REGION) {
    return 'https://main.d2gwwh0jouqtnx.amplifyapp.com';
  }
  
  // Fallback for local development
  return 'http://localhost:3000';
}

// Export all environment variables
export const ENV = {
  MONGODB_URI: getMongoDBURI(),
  NEXTAUTH_URL: getNextAuthURL(),
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '291b0018d2327b4ba9cb49f24ce42ea4', // Fallback is only for development
  CLOUDINARY: {
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsxej9fbv',
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '235165475833628',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'yRFsQBMZjysfzy9F7PHP231wNTs',
  },
  DEEPSEEK: {
    api_key: process.env.DEEPSEEK_API_KEY || '',
    base_url: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  },
  STRIPE: {
    secret_key: process.env.STRIPE_SECRET_KEY || '',
    publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  isProduction: process.env.NODE_ENV === 'production',
  isAWSAmplify: !!process.env.AWS_REGION,
}; 