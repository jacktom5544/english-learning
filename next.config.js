/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Basic configuration
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3001", "localhost:3002", "localhost:3003", "localhost:3004", "localhost:3005", 
        // Add Amplify domains
        "*.amplifyapp.com"]
    },
  },
  // Increase build timeout
  staticPageGenerationTimeout: 180,
  
  // Add image domain configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        // Optionally add port and pathname if needed, but usually not for Cloudinary
        // port: '', 
        // pathname: '/your-account/**', // Example if images are path-specific
      },
      // Add other domains if needed, e.g., for default user images
      // {
      //   protocol: 'https',
      //   hostname: 'example.com', 
      // },
    ],
    // Optional: configure device sizes, image sizes, etc.
    // deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Only add webpack config for handling server-only modules 
  webpack: (config, { isServer }) => {
    // Add proper path aliases for Amplify environment
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
    };

    // For client-side builds, specify fallbacks for Node.js modules
    if (!isServer) {
      // Handle problematic HTML file
      config.resolve.alias['@mapbox/node-pre-gyp/lib/util/nw-pre-gyp/index.html'] = false;
      config.resolve.alias['@tailwindcss/postcss'] = false;
      
      // Then handle all the server-only modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        readline: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        util: false,
        assert: false,
        buffer: false,
        'mock-aws-s3': false,
        nock: false,
        bcrypt: false,
        mongoose: false,
        'mongodb-client-encryption': false,
        aws4: false,
        snappy: false,
        kerberos: false,
        '@mapbox/node-pre-gyp': false
      };
    }
    return config;
  },

  // Disable TypeScript checking for production builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint for production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Add output configuration for standalone mode
  output: 'standalone',
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Ensure middleware works correctly with AWS CloudFront
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig; 