import { MongoClient, Db, MongoClientOptions } from 'mongodb';
import { safeLog, safeError } from './utils';

// MongoDB URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

safeLog(`[db.ts] Retrieved MONGODB_URI: ${MONGODB_URI ? 'found' : 'NOT FOUND'}`);

if (!MONGODB_URI) {
  safeError('[db.ts] MONGODB_URI environment variable is not defined or empty!');
  throw new Error('Please define the MONGODB_URI environment variable properly.');
}

// Cached connection
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Connection retry settings
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
let isConnecting = false;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Check cache first
  if (cachedClient && cachedDb) {
    safeLog('[db.ts] Found cached client/db object.');
    try {
      // Check if the connection is still alive with a ping
      safeLog('[db.ts] Pinging cached connection...');
      const startTime = Date.now();
      await cachedDb.command({ ping: 1 });
      safeLog(`[db.ts] Ping successful (${Date.now() - startTime}ms). Using cached database connection.`);
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      safeError('[db.ts] Ping on cached database connection failed, will reconnect', error);
      // Connection died, clear cache
      cachedClient = null;
      cachedDb = null;
    }
  }

  // Prevent pile-up if multiple requests trigger connection during backoff/initial connect
  if (isConnecting) {
    safeLog('[db.ts] Connection attempt already in progress, waiting briefly...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s and retry getting connection
    return connectToDatabase(); // Recursive call might try cache again or wait more
  }

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  const opts: MongoClientOptions = {
    connectTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 1,
  };

  try {
    // Set flag to indicate connection attempt is starting
    isConnecting = true;
    safeLog(`[db.ts] (Attempt ${connectionAttempts + 1}/${maxConnectionAttempts}) No valid cache, attempting NEW MongoDB connection...`);
    const client = await MongoClient.connect(MONGODB_URI, opts);
    const db = client.db();

    // Reset connection attempts on success
    connectionAttempts = 0;

    // Update cache
    cachedClient = client;
    cachedDb = db;

    safeLog('[db.ts] New MongoDB connection successful. Caching client and db.');
    isConnecting = false; // Clear flag
    return { client, db };
  } catch (error) {
    connectionAttempts++;
    safeError(`[db.ts] MongoDB connection attempt ${connectionAttempts} FAILED`, error);
    
    if (connectionAttempts >= maxConnectionAttempts) {
      safeError(`[db.ts] Failed to connect to MongoDB after ${maxConnectionAttempts} attempts. Giving up for this request cycle.`, error);
      connectionAttempts = 0; // Reset for future request cycles
      isConnecting = false; // Clear flag
      throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Calculate exponential backoff delay
    const backoffDelay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
    safeLog(`[db.ts] Retrying connection in ${backoffDelay}ms...`);
    isConnecting = false; // Allow retry after delay
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    return connectToDatabase(); // Retry connection
  }
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 