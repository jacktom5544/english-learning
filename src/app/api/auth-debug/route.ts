import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog } from '@/lib/utils';
import { isAmplifyEnvironment } from '@/lib/env';

// Simple health check for authentication system
export async function GET(request: NextRequest) {
  try {
    // Get auth token directly
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'dev-only-secret',
    });

    // Get server session
    const session = await getServerSession(authOptions);

    // Basic auth diagnostic
    const cookieHeader = request.headers.get('cookie') || '';
    const hasAuthCookie = cookieHeader.includes('next-auth.session-token');
    
    // Check environment variables
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'set' : 'not set',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'set' : 'not set',
      MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'not set',
      AMPLIFY_APP_DOMAIN: process.env.AMPLIFY_APP_DOMAIN || 'not set',
      isAmplify: isAmplifyEnvironment(),
    };

    // Log diagnostic info 
    safeLog('Auth debug endpoint called', {
      hasToken: !!token,
      hasSession: !!session,
      hasAuthCookie,
      cookieExists: hasAuthCookie,
    });

    // Send basic auth status (safe for public viewing)
    return NextResponse.json({
      status: 'ok',
      authenticated: !!token,
      sessionExists: !!session,
      cookieExists: hasAuthCookie,
      environment: envInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Return error info but without sensitive details
    return NextResponse.json({
      status: 'error',
      message: 'Authentication diagnostic failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 