import mongoose from 'mongoose';
import { safeLog, safeError } from './utils';
import { ENV } from './env';

// Use our ENV helper to ensure we have the MongoDB URI
const MONGODB_URI = ENV.MONGODB_URI;

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
  if (cached.mongoose.conn) {
    // Verify the connection is still alive
    try {
      await cached.mongoose.conn.db.admin().ping();
      safeLog('[db.ts] Using existing and verified mongoose connection');
      return cached.mongoose.conn;
    } catch (pingError) {
      safeError('[db.ts] Existing connection ping failed, will reconnect', pingError);
      cached.mongoose.conn = null;
      cached.mongoose.promise = null;
    }
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
      // Use `directConnection` for serverless environments like Amplify
      directConnection: ENV.isAWSAmplify() || ENV.isProduction(),
    };

    safeLog('[db.ts] Creating new MongoDB connection promise...', { 
      uri_prefix: MONGODB_URI.substring(0, 20) + '...', 
      options: opts 
    });

    try {
      // Log detailed connection information
      safeLog('[db.ts] MongoDB connection details:', {
        uri_exists: !!MONGODB_URI,
        uri_prefix: MONGODB_URI.substring(0, 15) + '...',
        is_production: ENV.isProduction(),
        is_amplify: ENV.isAWSAmplify(),
      });
      
      // Clear any existing promise to ensure we get a fresh connection attempt
      cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts);
      safeLog('[db.ts] Mongoose connect promise created');
    } catch (error) {
      safeError('[db.ts] Error during mongoose.connect promise creation:', error);
      cached.mongoose.promise = null;
      throw error;
    }
  }

  try {
    safeLog('[db.ts] Awaiting mongoose connection promise...');
    // Add a timeout for the connection promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('[db.ts] MongoDB connection timeout - took longer than 10 seconds'));
      }, 10000); // 10 seconds timeout
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
    throw error;
  }

  return cached.mongoose.conn;
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 