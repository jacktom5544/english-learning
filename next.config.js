/** @type {import('next').NextConfig} */
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
  
  // Only add webpack config for handling server-only modules 
  webpack: (config, { isServer }) => {
    // For client-side builds, specify fallbacks for Node.js modules
    if (!isServer) {
      // First, create an alias for the HTML file that's causing problems
      config.resolve.alias = {
        ...config.resolve.alias,
        '@mapbox/node-pre-gyp/lib/util/nw-pre-gyp/index.html': false,
        // Add aliases for missing modules
        '@/lib/teachers': require.resolve('./src/lib/emptyModule.js'),
        '@/lib/pointSystem': require.resolve('./src/lib/emptyModule.js'),
        '@tailwindcss/postcss': false
      };
      
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

  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  
  // Add output configuration for standalone mode
  output: 'standalone',
}

module.exports = nextConfig; 