// Helper module for loading environment variables consistently across environments

// Helper function to get environment variables with fallbacks
export const getEnvVar = (key: string, defaultValue?: string): string => {
  // Check process.env first (standard Node.js environment)
  const envValue = process.env[key];
  
  if (envValue !== undefined) {
    return envValue;
  }
  
  // Return default if provided
  if (defaultValue !== undefined) {
    console.warn(`Using default value for ${key}: ${defaultValue}`);
    return defaultValue;
  }
  
  // If no default and not found, warn and return empty string
  console.warn(`Environment variable ${key} not found and no default provided`);
  return '';
};

// Centralized environment variables
export const ENV = {
  // Authentication
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'https://main.d2gwwh0jouqtnx.amplifyapp.com'),
  
  // Database
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  
  // Cloudinary
  CLOUDINARY_API_SECRET: getEnvVar('CLOUDINARY_API_SECRET'),
  CLOUDINARY_API_KEY: getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY'),
  CLOUDINARY_CLOUD_NAME: getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
  
  // DeepSeek
  DEEPSEEK_API_KEY: getEnvVar('DEEPSEEK_API_KEY'),
  DEEPSEEK_BASE_URL: getEnvVar('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
  
  // Stripe
  STRIPE_PUBLISHABLE_KEY: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  
  // Logging
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
  
  // Node environment
  NODE_ENV: getEnvVar('NODE_ENV', 'production'),
};

// Export individual variables for convenience
export const {
  NEXTAUTH_SECRET,
  NEXTAUTH_URL,
  MONGODB_URI,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  STRIPE_PUBLISHABLE_KEY,
  LOG_LEVEL,
  NODE_ENV,
} = ENV; 