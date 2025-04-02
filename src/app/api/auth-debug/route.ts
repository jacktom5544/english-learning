import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';
import { isAmplifyEnvironment, getNextAuthURL } from '@/lib/env';

// Simple health check for authentication system
export async function GET(request: NextRequest) {
  safeLog('[auth-debug] Received request');
  
  try {
    safeLog('[auth-debug] Checking environment variables...');
    // Check critical environment variables at the start
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL_CONFIGURED: process.env.NEXTAUTH_URL || 'not set',
      NEXTAUTH_URL_DERIVED: getNextAuthURL(),
      NEXTAUTH_SECRET_SET: process.env.NEXTAUTH_SECRET ? 'set' : 'not set',
      MONGODB_URI_SET: process.env.MONGODB_URI ? 'set' : 'not set',
      AMPLIFY_APP_DOMAIN: process.env.AMPLIFY_APP_DOMAIN || 'not set',
      isAmplify: isAmplifyEnvironment(),
    };
    safeLog('[auth-debug] Environment variables check done', envInfo);

    safeLog('[auth-debug] Attempting to get token...');
    // Get auth token directly
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'dev-only-secret',
    });
    safeLog('[auth-debug] getToken result:', { hasToken: !!token });

    safeLog('[auth-debug] Attempting to get session...');
    // Get server session
    const session = await getServerSession(authOptions);
    safeLog('[auth-debug] getServerSession result:', { hasSession: !!session });

    // Basic auth diagnostic
    safeLog('[auth-debug] Checking cookies...');
    const cookieHeader = request.headers.get('cookie') || '';
    const hasAuthCookie = cookieHeader.includes('next-auth.session-token');
    safeLog('[auth-debug] Cookie check done', { hasAuthCookie });
    
    // Log diagnostic info 
    safeLog('[auth-debug] Preparing final response', {
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
    safeError('[auth-debug] Error caught in handler', error);
    // Return error info but without sensitive details
    return NextResponse.json({
      status: 'error',
      message: 'Authentication diagnostic failed',
      errorName: error.name || 'UnknownError',
      errorMessage: error.message || 'No message',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 