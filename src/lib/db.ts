import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/english-learning';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
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
    console.log('Using existing mongoose connection');
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    const opts = {
      bufferCommands: false,
    };

    console.log('Connecting to MongoDB...', MONGODB_URI.substring(0, 20) + '...');

    try {
      cached.mongoose.promise = mongoose.connect(MONGODB_URI, opts);
    } catch (error) {
      console.error('Error during mongoose.connect:', error);
      cached.mongoose.promise = null;
      throw error;
    }
  }

  try {
    console.log('Awaiting mongoose connection...');
    cached.mongoose.conn = await cached.mongoose.promise;
    console.log('MongoDB connection established successfully');
  } catch (error) {
    console.error('Error while awaiting mongoose connection:', error);
    cached.mongoose.promise = null;
    throw error;
  }

  return cached.mongoose.conn;
}

// Default export for easier imports
const connectDB = connectToDatabase;
export default connectDB; 