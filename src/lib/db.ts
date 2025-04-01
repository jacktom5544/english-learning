import mongoose from 'mongoose';
import { safeLog, safeError } from './utils';
import { MONGODB_URI } from './env';

if (!MONGODB_URI) {
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
    safeLog('Using existing mongoose connection');
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      // Add connection options to improve reliability
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
    };

    safeLog('Connecting to MongoDB...', MONGODB_URI.substring(0, 20) + '...');

    try {
      // Clear any existing promise to ensure we get a fresh connection attempt
      cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts);
    } catch (error) {
      safeError('Error during mongoose.connect:', error);
      cached.mongoose.promise = null;
      throw error;
    }
  }

  try {
    safeLog('Awaiting mongoose connection...');
    // Add a timeout for the connection promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('MongoDB connection timeout - took longer than 10 seconds'));
      }, 10000);
    });
    
    // Race between connection and timeout
    cached.mongoose.conn = await Promise.race([
      cached.mongoose.promise,
      timeoutPromise
    ]);
    
    safeLog('MongoDB connection established successfully');
  } catch (error) {
    safeError('Error while awaiting mongoose connection:', error);
    cached.mongoose.promise = null;
    throw error;
  }

  return cached.mongoose.conn;
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 