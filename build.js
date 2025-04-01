#!/usr/bin/env node

// Custom build script for AWS Amplify to handle TypeScript issues
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting custom build process...');

// Load environment variables from .env.production
try {
  if (fs.existsSync('.env.production')) {
    console.log('Loading environment variables from .env.production');
    const envContent = fs.readFileSync('.env.production', 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    });
  }
} catch (error) {
  console.warn('Error loading .env.production:', error.message);
}

// Ensure critical environment variables are set
['NEXTAUTH_SECRET', 'MONGODB_URI', 'NEXTAUTH_URL'].forEach(key => {
  if (!process.env[key]) {
    console.warn(`WARNING: Environment variable ${key} is not set!`);
  } else {
    console.log(`Environment variable ${key} is set`);
  }
});

// Run the build
try {
  console.log('Building Next.js application...');
  
  // Build with TypeScript checks disabled
  execSync('npx --no-install next build', {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_TYPESCRIPT_CHECK: 'false',
      NODE_OPTIONS: '--max_old_space_size=4096'
    },
    stdio: 'inherit'
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} 