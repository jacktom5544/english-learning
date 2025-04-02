import mongoose from 'mongoose';
import { safeLog, safeError } from './utils';
import { ENV } from './env';

// Define a hardcoded MongoDB URI as fallback for AWS Amplify
const FALLBACK_MONGODB_URI = 'mongodb+srv://blogAdmin:BzvJciCcQ8A4i1DM@cluster0.zp8ls.mongodb.net/english-learning?retryWrites=true&w=majority&appName=Cluster0';

// Get MongoDB URI from environment or use fallback
function getMongoDBURI() {
  // First check if it's available from ENV
  const envURI = ENV.MONGODB_URI;
  if (envURI && envURI.length > 20) {
    safeLog('[db.ts] Using MongoDB URI from environment variables');
    return envURI;
  }
  
  // Then check direct process.env
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.length > 20) {
    safeLog('[db.ts] Using MongoDB URI from process.env');
    return process.env.MONGODB_URI;
  }
  
  // Last resort, use fallback in production
  if (ENV.isProduction()) {
    safeLog('[db.ts] Using fallback MongoDB URI in production');
    return FALLBACK_MONGODB_URI;
  }
  
  // Nothing worked
  safeError('[db.ts] No valid MongoDB URI found');
  return '';
}

// Get the MongoDB connection string
const MONGODB_URI = getMongoDBURI();

if (!MONGODB_URI) {
  safeError('[db.ts] MONGODB_URI is not defined - check your environment variables');
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global as any;

if (!cached.mongoose) {
  cached.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  // Always log the state at the beginning
  safeLog('[db.ts] Connection request, current state:', {
    hasCachedConn: !!cached.mongoose.conn,
    hasCachedPromise: !!cached.mongoose.promise,
    mongoUriExists: !!MONGODB_URI,
    mongoUriLength: MONGODB_URI ? MONGODB_URI.length : 0,
    env: process.env.NODE_ENV
  });

  if (cached.mongoose.conn) {
    // Verify the connection is still alive
    try {
      // Use a command that requires auth to better check connection state
      await cached.mongoose.conn.db.command({ ping: 1 });
      safeLog('[db.ts] Using existing and verified mongoose connection');
      return cached.mongoose.conn;
    } catch (pingError) {
      safeError('[db.ts] Existing connection ping failed, likely disconnected. Will reconnect.', pingError);
      cached.mongoose.conn = null;
      cached.mongoose.promise = null;
    }
  }

  if (!cached.mongoose.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable buffering - recommended for serverless
      serverSelectionTimeoutMS: 10000, // Double timeout to 10 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: ENV.isProduction() ? 10 : 5, // Increase pool size in production
      minPoolSize: 1, // Keep at least one connection open
      // Don't use directConnection in serverless - can cause issues
      directConnection: false,
      // Heartbeat helps keep connection alive, adjust intervals if needed
      heartbeatFrequencyMS: 10000, // Send heartbeat every 10 seconds
    };

    safeLog('[db.ts] Creating new MongoDB connection promise...', { 
      uri_prefix: MONGODB_URI.substring(0, 20) + '...', 
      options: opts 
    });

    try {
      // Log detailed connection information
      safeLog('[db.ts] MongoDB connection details:', {
        uri_exists: !!MONGODB_URI,
        uri_length: MONGODB_URI.length,
        uri_prefix: MONGODB_URI.substring(0, 15) + '...',
        is_production: ENV.isProduction(),
        is_amplify: ENV.isAWSAmplify()
      });
      
      // Clear any existing promise to ensure we get a fresh connection attempt
      cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts);
      safeLog('[db.ts] Mongoose connect promise created');
    } catch (error) {
      safeError('[db.ts] Error during mongoose.connect promise creation:', error);
      cached.mongoose.promise = null;
      // Throw a specific error for connection issues
      throw new Error(`データベース接続エラーが発生しました。`);
    }
  }

  try {
    safeLog('[db.ts] Awaiting mongoose connection promise...');
    // Add a timeout for the connection promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('[db.ts] MongoDB connection timeout - took longer than 15 seconds'));
      }, 15000); // Increased timeout to 15 seconds
    });
    
    // Race between connection and timeout
    cached.mongoose.conn = await Promise.race([
      cached.mongoose.promise,
      timeoutPromise
    ]);
    
    safeLog('[db.ts] MongoDB connection established successfully');
  } catch (error) {
    safeError('[db.ts] Error while awaiting mongoose connection promise:', error);
    cached.mongoose.promise = null;
    // Throw a specific error for connection issues
    throw new Error(`データベース接続エラーが発生しました。`);
  }

  return cached.mongoose.conn;
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 