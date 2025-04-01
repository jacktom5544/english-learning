/** @type {import('next').NextConfig} */
module.exports = {
  // Disable TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Use standalone output
  output: 'standalone',
  
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
  
  // Simplify webpack config
  webpack: (config, { isServer }) => {
    // Add aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, './src'),
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