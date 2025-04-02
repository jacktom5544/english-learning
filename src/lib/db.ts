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

// Cache the MongoDB connection to improve performance
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    safeLog('Using cached database instance');
    return { client: cachedClient, db: cachedDb };
  }

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  const opts: MongoClientOptions = {
    // Removed directConnection option, which can cause issues
    connectTimeoutMS: 10000, // Add a 10-second connection timeout
    socketTimeoutMS: 45000, // Add a 45-second socket timeout
  };

  try {
    safeLog(`Connecting to MongoDB...`);
    const client = await MongoClient.connect(MONGODB_URI, opts);
    const db = client.db();

    cachedClient = client;
    cachedDb = db;

    safeLog('Connected to MongoDB successfully');
    return { client, db };
  } catch (error) {
    safeError('Failed to connect to MongoDB', error);
    // Throw a more descriptive error for debugging
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 