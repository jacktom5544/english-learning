import mongoose from 'mongoose';
import { safeLog, safeError } from './utils';
import { ENV } from './env';
import { MongoClient, MongoClientOptions } from 'mongodb';

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
  
  // Use hardcoded value in .env.local file
  const envLocal = 'mongodb+srv://blogAdmin:BzvJciCcQ8A4i1DM@cluster0.zp8ls.mongodb.net/english-learning?retryWrites=true&w=majority&appName=Cluster0';
  safeLog('[db.ts] Using hardcoded MongoDB URI from .env.local');
  return envLocal;
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

// Cache the MongoDB connection to improve performance
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

// Track connection errors for exponential backoff
let connectionAttempts = 0;
const maxConnectionAttempts = 5;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    try {
      // Check if the connection is still alive with a ping
      await cachedDb.command({ ping: 1 });
      safeLog('[db.ts] Using cached database connection');
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      safeError('[db.ts] Cached database connection failed, will reconnect', error);
      // Connection died, clear cache
      cachedClient = null;
      cachedDb = null;
    }
  }

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  const opts: MongoClientOptions = {
    connectTimeoutMS: 15000, // 15-second connection timeout
    socketTimeoutMS: 45000,  // 45-second socket timeout
    serverSelectionTimeoutMS: 20000, // 20-second server selection timeout
    maxPoolSize: 10,         // Limit maximum connections
    minPoolSize: 1,          // Keep at least one connection open
  };

  try {
    safeLog(`[db.ts] Connecting to MongoDB (attempt ${connectionAttempts + 1}/${maxConnectionAttempts})...`);
    const client = await MongoClient.connect(MONGODB_URI, opts);
    const db = client.db();

    // Verify connection with a ping
    await db.command({ ping: 1 });
    
    // Reset connection attempts on success
    connectionAttempts = 0;

    cachedClient = client;
    cachedDb = db;

    safeLog('[db.ts] Connected to MongoDB successfully');
    return { client, db };
  } catch (error) {
    connectionAttempts++;
    
    if (connectionAttempts >= maxConnectionAttempts) {
      safeError(`[db.ts] Failed to connect to MongoDB after ${maxConnectionAttempts} attempts`, error);
      connectionAttempts = 0; // Reset for next time
      throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Calculate exponential backoff delay
    const backoffDelay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
    
    safeError(`[db.ts] MongoDB connection attempt ${connectionAttempts} failed, retrying in ${backoffDelay}ms`, error);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    // Retry connection
    return connectToDatabase();
  }
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 