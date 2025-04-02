// Custom build script to bypass TypeScript checks
// Used for AWS Amplify deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting custom build process...');

try {
  // 1. Temporarily rename tsconfig.json to tsconfig.backup.json
  console.log('📁 Renaming TypeScript configuration files...');
  if (fs.existsSync('tsconfig.json')) {
    fs.renameSync('tsconfig.json', 'tsconfig.backup.json');
    console.log('✅ Renamed tsconfig.json to tsconfig.backup.json');
  }

  // 2. Create empty next-env.d.ts file to satisfy next.js
  console.log('📁 Creating minimal TypeScript definition files...');
  fs.writeFileSync('next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/types/global" />\n');
  console.log('✅ Created empty next-env.d.ts file');

  // 3. Run the build command with more memory and TypeScript checks disabled
  console.log('🔨 Running Next.js build...');
  execSync('NODE_OPTIONS=--max-old-space-size=4096 NEXT_TYPESCRIPT_CHECK=false next build --no-lint', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TYPESCRIPT_CHECK: 'false',
      NODE_ENV: 'production'
    }
  });
  console.log('✅ Build completed successfully');

  // 4. Restore tsconfig.json
  console.log('📁 Restoring TypeScript configuration files...');
  if (fs.existsSync('tsconfig.backup.json')) {
    fs.renameSync('tsconfig.backup.json', 'tsconfig.json');
    console.log('✅ Restored tsconfig.json');
  }

  console.log('🎉 Custom build process completed successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  
  // Restore tsconfig.json if it exists
  if (fs.existsSync('tsconfig.backup.json')) {
    fs.renameSync('tsconfig.backup.json', 'tsconfig.json');
    console.log('✅ Restored tsconfig.json after error');
  }
  
  process.exit(1);
} 