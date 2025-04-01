/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  // Use standalone output for Amplify deployment
  output: 'standalone',
  
  // Disable TypeScript checking (as a precaution)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Increase build timeout
  staticPageGenerationTimeout: 180,
  
  // Basic experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.amplifyapp.com"]
    },
  },
  
  // Simplified webpack config
  webpack: (config, { isServer }) => {
    // Add aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
    };

    // Set fallbacks for server modules in client builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    
    return config;
  },
};
module.exports = nextConfig; 