import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { safeLog, safeError } from '@/lib/utils';
import mongoose from 'mongoose';

export async function GET() {
  try {
    safeLog('[test-mongodb] Testing MongoDB connection...');
    
    // Get environment info
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      mongoUriPrefix: process.env.MONGODB_URI ? 
        `${process.env.MONGODB_URI.substring(0, 15)}...` : 'not set',
      mongoUriLength: process.env.MONGODB_URI?.length || 0
    };
    
    safeLog('[test-mongodb] Environment info:', envInfo);
    
    // Test connection
    const conn = await connectDB();
    
    // Basic connection info
    const connectionInfo = {
      isConnected: !!conn,
      readyState: mongoose.connection.readyState,
      readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
    };
    
    // Try to get database info
    let dbInfo = {};
    
    if (conn && mongoose.connection.db) {
      try {
        // Test admin operations
        const pingResult = await mongoose.connection.db.admin().ping();
        
        // List databases if possible
        const dbList = await mongoose.connection.db.admin().listDatabases();
        
        // Get some database stats
        const dbStats = await mongoose.connection.db.stats();
        
        dbInfo = {
          pingSuccess: pingResult?.ok === 1,
          databaseName: mongoose.connection.db.databaseName,
          databaseCount: dbList?.databases?.length || 0,
          collectionCount: dbStats?.collections || 0
        };
      } catch (adminError) {
        safeError('[test-mongodb] Admin operations failed:', adminError);
        dbInfo = { 
          adminError: adminError instanceof Error ? adminError.message : 'Unknown error',
          note: 'This may be normal if the MongoDB user lacks admin privileges'
        };
      }
      
      // Try to list collections (works with lower privileges)
      try {
        if (mongoose.connection.db) {
          const collections = await mongoose.connection.db.listCollections().toArray();
          dbInfo = {
            ...dbInfo,
            collections: collections.map(c => c.name).slice(0, 5) // Show first 5 only
          };
        }
      } catch (collError) {
        safeError('[test-mongodb] Collection listing failed:', collError);
      }
    }
    
    // Return success
    return NextResponse.json({
      status: 'connected',
      message: 'MongoDB connection successful',
      timestamp: new Date().toISOString(),
      environment: envInfo,
      connection: connectionInfo,
      database: dbInfo
    });
  } catch (error) {
    safeError('[test-mongodb] Connection test failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'MongoDB connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasMongoUri: !!process.env.MONGODB_URI,
        mongoUriLength: process.env.MONGODB_URI?.length || 0
      }
    }, { status: 500 });
  }
} 