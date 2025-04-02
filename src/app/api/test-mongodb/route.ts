import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { safeLog, safeError } from '@/lib/utils';

// This endpoint is for diagnostic purposes only
export async function GET() {
  try {
    // Get MongoDB connection details
    const mongoUri = process.env.MONGODB_URI || 'not set';
    const maskedUri = mongoUri.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:***@');
    
    // Test connection
    safeLog('Testing MongoDB connection...');
    const startTime = Date.now();
    
    const { db, client } = await connectToDatabase();
    const connectionTime = Date.now() - startTime;
    
    // Check if connection is alive
    const pingResult = await db.command({ ping: 1 });
    const pingSuccess = pingResult?.ok === 1;
    
    // Fetch a sample user (without password) to verify data access
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    const sampleUser = userCount > 0 
      ? await usersCollection.findOne({}, { projection: { password: 0 } })
      : null;
    
    // Get server information
    const serverInfo = await db.command({ buildInfo: 1 });
    const serverVersion = serverInfo?.version || 'unknown';
    
    return NextResponse.json({
      status: 'success',
      message: 'MongoDB connection test successful',
      connection: {
        uri: maskedUri,
        connectionTimeMs: connectionTime,
        pingSuccess,
        serverVersion,
      },
      database: {
        userCount,
        sampleUser: sampleUser ? {
          id: sampleUser._id,
          email: sampleUser.email,
          // Include other non-sensitive fields
        } : null,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      }
    });
    
  } catch (error) {
    safeError('MongoDB connection test failed', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 