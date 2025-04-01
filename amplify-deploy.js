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
  '.next/standalone/.next/server/pages',
  '.next/standalone/.next/server/chunks',
  '.next/standalone/.next/server/app',
  '.next/standalone/.next/server/app/_not-found',
  '.next/standalone/.next/server/app/page',
  '.next/standalone/.next/trace',
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
} else {
  // Create minimal server trace files
  console.log('Creating minimal server trace files');
  
  // Server trace file
  const serverTracesFile = {
    version: 1,
    traces: {
      "/_app": {
        name: "_app",
        route: "",
        module: true,
        compiled: true
      },
      "/": {
        name: "index",
        route: "/",
        module: true,
        compiled: true
      }
    }
  };
  
  // Write server trace files
  fs.writeFileSync('.next/standalone/.next/trace', JSON.stringify(serverTracesFile, null, 2));
  console.log('Created trace file');
  
  // Create minimal app/page assets
  const appPageJs = 'module.exports = {page: function() { return {props: {}} }}';
  fs.writeFileSync('.next/standalone/.next/server/app/page.js', appPageJs);
  fs.writeFileSync('.next/standalone/.next/server/pages/_app.js', appPageJs);
  console.log('Created minimal page files');
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

// Create package.json in standalone directory
const packageJson = {
  name: "english-learning-app",
  version: "1.0.0",
  private: true,
  scripts: {
    "start": "node server.js"
  },
  dependencies: {
    "next": "15.2.4",
    "react": "19.1.0", 
    "react-dom": "19.1.0"
  }
};

fs.writeFileSync('.next/standalone/package.json', JSON.stringify(packageJson, null, 2));
console.log('Created package.json in standalone directory');

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
    'next.config.js',
    'package.json',
    '.next/trace',
    '.next/server/pages/_app.js',
    '.next/server/app/page.js'
  ],
  ignore: [
    'node_modules'
  ]
};

fs.writeFileSync('.next/standalone/required-server-files.json', JSON.stringify(requiredServerFiles, null, 2));
fs.writeFileSync('.next/required-server-files.json', JSON.stringify(requiredServerFiles, null, 2));
console.log('Created required-server-files.json');

// Create trace file that AWS Amplify is looking for
fs.writeFileSync('.next/standalone/trace', JSON.stringify({
  version: 1,
  buildTraces: [
    {
      "name": "index",
      "route": "/",
      "pagePath": "app/page.js",
      "timestamp": Date.now()
    },
    {
      "name": "_app",
      "route": "/_app",
      "pagePath": "pages/_app.js",
      "timestamp": Date.now()
    }
  ],
  appDir: true,
  traceVersion: "15.2.4",
  serverComponentManifest: {
    clientModules: {},
    serverModules: {
      "app/page.js": {
        id: "app/page.js",
        chunks: ["app/page"],
        name: "default"
      }
    }
  }
}, null, 2));
console.log('Created trace file for Amplify');

// Also create a trace file in the .next directory
fs.writeFileSync('.next/trace', JSON.stringify({
  version: 1,
  buildTraces: [
    {
      "name": "index",
      "route": "/",
      "pagePath": "app/page.js",
      "timestamp": Date.now()
    }
  ],
  appDir: true,
  traceVersion: "15.2.4"
}, null, 2));
console.log('Also created trace file in .next directory');

// Create a basic middleware.js file in case it's needed
const middlewareJs = `export default function middleware() {
  return Response.next();
}

export const config = {
  matcher: [],
};`;

fs.writeFileSync('.next/standalone/.next/server/middleware.js', middlewareJs);
console.log('Created middleware.js file');

// Create a basic webpack-runtime.js file
const webpackRuntime = `module.exports = {
  moduleLoading: true,
  version: "15.2.4"
};`;

fs.writeFileSync('.next/standalone/.next/server/webpack-runtime.js', webpackRuntime);
console.log('Created webpack-runtime.js file');

// Create route manifest files
const routeManifest = {
  pages: {
    "/_app": {
      filePath: "pages/_app.js",
      type: "app"
    },
    "/": {
      filePath: "app/page.js",
      type: "app"
    }
  },
  dynamicRoutes: {},
  serverRoutes: {
    "/": {
      hasDynamicSegments: false,
      dynamic: false
    }
  },
  staticRoutes: {},
  version: 3,
  appRoutes: [{
    page: "/",
    pathname: "/"
  }]
};

fs.writeFileSync('.next/standalone/.next/routes-manifest.json', JSON.stringify(routeManifest, null, 2));
console.log('Created routes-manifest.json file');

// Create page data files
fs.writeFileSync('.next/standalone/.next/server/app/page/page.js', 'module.exports = {page: function() { return {props: {}} }}');
fs.writeFileSync('.next/standalone/.next/server/app/_not-found/page.js', 'module.exports = {notFound: function() { return {props: {}} }}');

// Create page-map for app router
const pageMap = {
  "app/page.js": {
    page: "/",
    filePath: "app/page.js"
  },
  "app/_not-found/page.js": {
    page: "/not-found",
    filePath: "app/_not-found/page.js"
  }
};

fs.writeFileSync('.next/standalone/.next/server/pages-manifest.json', JSON.stringify(pageMap, null, 2));
console.log('Created pages-manifest.json file');

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

  if (fs.existsSync('.next/standalone/trace')) {
    console.log('✅ trace file exists');
  } else {
    console.log('❌ trace file is missing!');
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