import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';
import { getNextAuthURL, isProduction, isAWSAmplify } from '@/lib/env';

/**
 * API route to test MongoDB connection and NextAuth configuration
 * This is for debugging purposes
 */
export async function GET() {
  const startTime = Date.now();
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    // First try to get the current session
    let session = null;
    let sessionError = null;
    
    try {
      session = await getServerSession(authOptions);
    } catch (err) {
      sessionError = err instanceof Error ? err.message : String(err);
      safeError('Error getting session in connection test:', err);
    }
    
    // Test DB connection
    let dbConnection = null;
    let dbError = null;
    let userCount = 0;
    let sampleUser = null;
    const connectionStartTime = Date.now();
    
    try {
      const { db } = await connectToDatabase();
      
      // Verify connection with ping
      await db.command({ ping: 1 });
      dbConnection = true;
      
      // Try to get users count
      userCount = await db.collection('users').countDocuments();
      
      // Get a sample user (without password)
      if (userCount > 0) {
        sampleUser = await db.collection('users').findOne(
          {}, 
          { projection: { password: 0, email: 1, _id: 1 } }
        );
      }
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
      dbConnection = false;
      safeError('Error connecting to DB in connection test:', err);
    }
    
    const connectionTimeMs = Date.now() - connectionStartTime;
    
    return NextResponse.json({
      status: dbConnection ? 'success' : 'error',
      message: dbConnection ? 'MongoDB connection test successful' : 'MongoDB connection test failed',
      connection: {
        uri: process.env.MONGODB_URI ? `mongodb+srv://blogAdmin:***@cluster0.zp8ls.mongodb.net/english-learning?retryWrites=true&w=majority&appName=Cluster0` : 'Not configured',
        connectionTimeMs,
        pingSuccess: dbConnection,
        error: dbError,
        serverVersion: dbConnection ? '8.0.6' : null
      },
      database: dbConnection ? {
        userCount,
        sampleUser: sampleUser ? {
          id: sampleUser._id.toString(),
          email: sampleUser.email
        } : null
      } : null,
      auth: {
        sessionLoaded: session !== null,
        sessionError,
        userId: session?.user?.id || null,
        userRole: session?.user?.role || null,
        isAuthenticated: !!session?.user
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextAuthUrl: getNextAuthURL(),
        isProduction: isProduction(),
        isAmplify: isAWSAmplify(),
        requestTime: `${Date.now() - startTime}ms`
      }
    }, { headers });
  } catch (error) {
    safeError('Global error in connection test:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500, headers }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new NextResponse(null, { 
    status: 200,
    headers
  });
} 