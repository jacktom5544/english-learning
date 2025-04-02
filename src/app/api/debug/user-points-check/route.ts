import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User, { IUser } from '@/models/User';
import { safeLog, safeError } from '@/lib/utils';
import { isAmplifyEnvironment, isAWSAmplify } from '@/lib/env';
import { getCurrentUserWithPoints } from '@/lib/serverUtils';
import { findOneDocument } from '@/models/mongoose-utils';

/**
 * Debug endpoint to test user points and session status
 */
export async function GET(req: NextRequest) {
  // Add CORS headers for API debugging
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    // Connect to database
    await connectToDatabase();
    
    // Get session
    let sessionData = null;
    let sessionError = null;
    
    try {
      const session = await getServerSession(authOptions);
      sessionData = {
        exists: !!session,
        hasUser: !!session?.user,
        email: session?.user?.email || null,
        name: session?.user?.name || null,
        role: session?.user?.role || null,
        sessionPoints: session?.user?.points || null,
        id: session?.user?.id || null
      };
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
      safeError('Error getting session in debug endpoint', error);
    }
    
    // Try to get user with getCurrentUserWithPoints
    let serverUserData = null;
    let serverUserError = null;
    
    try {
      const user = await getCurrentUserWithPoints();
      if (user) {
        serverUserData = {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          points: user.points,
          pointsUsedThisMonth: user.pointsUsedThisMonth,
          pointsLastUpdated: user.pointsLastUpdated
        };
      }
    } catch (error) {
      serverUserError = error instanceof Error ? error.message : String(error);
      safeError('Error getting user with getCurrentUserWithPoints', error);
    }
    
    // Try direct database lookup if session has email
    let dbUserData = null;
    let dbUserError = null;
    
    if (sessionData?.email) {
      try {
        const dbUser = await findOneDocument<IUser>(User, { email: sessionData.email });
        if (dbUser) {
          dbUserData = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            points: dbUser.points,
            pointsUsedThisMonth: dbUser.pointsUsedThisMonth,
            pointsLastUpdated: dbUser.pointsLastUpdated
          };
        }
      } catch (error) {
        dbUserError = error instanceof Error ? error.message : String(error);
        safeError('Error getting user directly from database', error);
      }
    }
    
    // Environment information
    const envInfo = {
      isAmplifyEnvironment: isAmplifyEnvironment(),
      isAWSAmplify: isAWSAmplify(),
      nodeEnv: process.env.NODE_ENV,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      amplifyEnvVar: process.env.AMPLIFY_ENVIRONMENT
    };
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session: sessionData,
      sessionError,
      serverUser: serverUserData,
      serverUserError,
      dbUser: dbUserData, 
      dbUserError,
      environment: envInfo
    }, { headers });
  } catch (error) {
    safeError('Error in debug user points endpoint', error);
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers });
  }
}

// Handle OPTIONS requests
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