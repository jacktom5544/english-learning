// Helper module for loading environment variables consistently across environments

// Helper function to get environment variables with fallbacks
export const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // Check process.env first (standard Node.js environment)
  const envValue = process.env[key];
  
  if (envValue !== undefined) {
    return envValue;
  }
  
  // Return default if provided
  return defaultValue;
};

// Centralized environment variables
export const ENV = {
  // Authentication
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET', 'dev-secret-do-not-use-in-production'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'http://localhost:3000'),
  
  // Database - no default for sensitive connection strings
  MONGODB_URI: getEnvVar('MONGODB_URI', ''),
  
  // Cloudinary - no defaults for API secrets/keys
  CLOUDINARY_API_SECRET: getEnvVar('CLOUDINARY_API_SECRET', ''),
  CLOUDINARY_API_KEY: getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', ''),
  CLOUDINARY_CLOUD_NAME: getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', ''),
  
  // DeepSeek - no default for API key
  DEEPSEEK_API_KEY: getEnvVar('DEEPSEEK_API_KEY', ''),
  DEEPSEEK_BASE_URL: getEnvVar('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
  
  // Stripe - use placeholder naming for default values
  STRIPE_PUBLISHABLE_KEY: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder'),
  STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY', 'sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder'),
  
  // Logging
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
  
  // Node environment
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
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
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  LOG_LEVEL,
  NODE_ENV,
} = ENV; 