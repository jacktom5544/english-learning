/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Use standalone output for Amplify deployment
  output: 'standalone',
  
  // Relax type checking during build to allow deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Increase timeout for static generation
  staticPageGenerationTimeout: 180,
  
  // Explicitly list packages to transpile instead of using a wildcard
  transpilePackages: [
    'lucide-react',
    'date-fns',
    'recharts',
    'react-icons',
    '@stripe/stripe-js'
  ],
  
  // Basic experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.amplifyapp.com"]
    },
  },
  
  // Configure webpack
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
    };
    
    // Add fallbacks for node modules
    if (!config.resolve.fallback) {
      config.resolve.fallback = {};
    }
    
    Object.assign(config.resolve.fallback, {
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      os: false,
      path: false,
      stream: false,
    });
    
    return config;
  },
};

module.exports = nextConfig; 