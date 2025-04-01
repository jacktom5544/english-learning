#!/usr/bin/env node
/**
 * This script prepares the Next.js app for AWS Amplify deployment
 * It creates the necessary files and directory structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Next.js app for AWS Amplify deployment...');

// Create necessary directories
const directories = [
  '.next',
  '.next/standalone',
  '.next/standalone/.next',
  '.next/standalone/.next/static',
  '.next/standalone/.next/server',
  '.next/standalone/public'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Copy files if they exist
const copyIfExists = (src, dest) => {
  if (fs.existsSync(src)) {
    const isDirectory = fs.lstatSync(src).isDirectory();
    
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      fs.readdirSync(src).forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        copyIfExists(srcPath, destPath);
      });
    } else {
      fs.copyFileSync(src, dest);
      console.log(`Copied: ${src} -> ${dest}`);
    }
  }
};

// Copy static files to the standalone directory
copyIfExists('.next/static', '.next/standalone/.next/static');
copyIfExists('public', '.next/standalone/public');
copyIfExists('next.config.js', '.next/standalone/next.config.js');

// Copy server files if they exist
if (fs.existsSync('.next/server')) {
  copyIfExists('.next/server', '.next/standalone/.next/server');
}

// Create a basic server.js file
const serverJs = `const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(\`Ready on http://\${hostname}:\${port}\`);
  });
});`;

fs.writeFileSync('.next/standalone/server.js', serverJs);
console.log('Created server.js file');

// Create the required-server-files.json
const requiredServerFiles = {
  version: 1,
  config: {
    configFile: true,
    experimental: {
      appDir: true,
      serverActions: true
    },
    compress: true,
    poweredByHeader: true,
    output: 'standalone'
  },
  appDir: true,
  files: [
    'server.js',
    'next.config.js'
  ],
  ignore: [
    'node_modules'
  ]
};

fs.writeFileSync('.next/standalone/required-server-files.json', JSON.stringify(requiredServerFiles, null, 2));
fs.writeFileSync('.next/required-server-files.json', JSON.stringify(requiredServerFiles, null, 2));
console.log('Created required-server-files.json');

// Verify the output
console.log('\n📦 Deployment files prepared:');

try {
  const files = fs.readdirSync('.next/standalone');
  console.log('.next/standalone contents:', files);
  
  if (fs.existsSync('.next/standalone/required-server-files.json')) {
    console.log('✅ required-server-files.json exists');
  } else {
    console.log('❌ required-server-files.json is missing!');
  }
  
  if (fs.existsSync('.next/standalone/server.js')) {
    console.log('✅ server.js exists');
  } else {
    console.log('❌ server.js is missing!');
  }
  
} catch (error) {
  console.error('Error verifying output:', error.message);
}

console.log('\n🎉 Ready for AWS Amplify deployment!');

// Verify the current directory structure
console.log('\nDirectory structure:');
try {
  execSync('find .next/standalone -type d | sort', { stdio: 'inherit' });
} catch (error) {
  console.error('Error listing directories:', error.message);
} 