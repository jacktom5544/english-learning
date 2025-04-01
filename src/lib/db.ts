import mongoose from 'mongoose';
import { safeLog, safeError } from './utils';
import { MONGODB_URI } from './env';

// Don't throw immediately if MONGODB_URI is not defined
// Instead, log an error and provide a more graceful fallback

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
  // Check for missing MongoDB URI
  if (!MONGODB_URI) {
    safeError('MONGODB_URI environment variable is not defined');
    
    if (process.env.NODE_ENV === 'production') {
      safeError('Production environment - missing MONGODB_URI but continuing with mock connection');
      // Return a mock connection that won't crash the app
      return { 
        models: {}, 
        model: () => ({ findOne: async () => null, find: async () => [] }),
        isConnected: false 
      } as any;
    } else {
      throw new Error('MONGODB_URI environment variable is required in development');
    }
  }

  if (cached.mongoose.conn) {
    safeLog('Using existing mongoose connection');
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      // Add connection options to improve reliability
      serverSelectionTimeoutMS: 10000, // Increase timeout to 10 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
    };

    safeLog('Connecting to MongoDB...', MONGODB_URI.substring(0, 20) + '...');

    try {
      cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts);
    } catch (error) {
      safeError('Error during mongoose.connect:', error);
      cached.mongoose.promise = null;
      
      if (process.env.NODE_ENV === 'production') {
        safeError('Production environment - connection error but continuing with mock connection');
        // Return a mock connection that won't crash the app
        return { 
          models: {}, 
          model: () => ({ findOne: async () => null, find: async () => [] }),
          isConnected: false 
        } as any;
      }
      
      throw error;
    }
  }

  try {
    safeLog('Awaiting mongoose connection...');
    
    // Add a timeout for the connection promise
    const connectionPromise = cached.mongoose.promise;
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('MongoDB connection timeout - took longer than 15 seconds'));
      }, 15000); // Increased timeout to 15 seconds
    });
    
    // Race between connection and timeout
    cached.mongoose.conn = await Promise.race([
      connectionPromise,
      timeoutPromise
    ]);
    
    safeLog('MongoDB connection established successfully');
  } catch (error) {
    safeError('Error while awaiting mongoose connection:', error);
    
    // Clear the promise so we can retry
    cached.mongoose.promise = null;
    
    // In production, log error but don't throw to prevent app crashes
    if (process.env.NODE_ENV === 'production') {
      safeError('Production environment - logging error but not crashing:', error);
      // Return a mock connection that won't crash the app
      return { 
        models: {}, 
        model: () => ({ findOne: async () => null, find: async () => [] }),
        isConnected: false 
      } as any;
    }
    
    throw error;
  }

  return cached.mongoose.conn;
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 