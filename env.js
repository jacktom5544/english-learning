// Simple JavaScript version of environment variable loader (no TypeScript)
// This helps eliminate TypeScript issues during build

// Helper function to get environment variables with fallbacks
const getEnvVar = (key, defaultValue) => {
  try {
    // Check process.env first
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
  } catch (error) {
    console.error(`Error accessing environment variable ${key}:`, error);
    return defaultValue || '';
  }
};

// Export environment variables
module.exports = {
  // Authentication
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET', ''),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'https://main.d2gwwh0jouqtnx.amplifyapp.com'),
  
  // Database
  MONGODB_URI: getEnvVar('MONGODB_URI', ''),
  
  // Other variables
  NODE_ENV: getEnvVar('NODE_ENV', 'production'),
}; 