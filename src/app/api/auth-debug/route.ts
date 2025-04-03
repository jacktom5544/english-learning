import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';
import { isAmplifyEnvironment, getNextAuthURL } from '@/lib/env';
import { jwtVerify } from 'jose';

// Simple health check for authentication system
export async function GET(request: NextRequest) {
  safeLog('[auth-debug] Received request');
  let token = null;
  let session = null;
  let envInfo: any = {};
  let cookieHeader = '';
  let hasAuthCookie = false;
  
  try {
    safeLog('[auth-debug] Checking environment variables...');
    envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL_CONFIGURED: process.env.NEXTAUTH_URL || 'not set',
      NEXTAUTH_URL_DERIVED: getNextAuthURL(),
      NEXTAUTH_SECRET_SET: process.env.NEXTAUTH_SECRET ? 'set' : 'not set',
      MONGODB_URI_SET: process.env.MONGODB_URI ? 'set' : 'not set',
      AMPLIFY_APP_DOMAIN: process.env.AMPLIFY_APP_DOMAIN || 'not set',
      isAmplify: isAmplifyEnvironment(),
    };
    safeLog('[auth-debug] Environment variables check done', envInfo);

    try {
      safeLog('[auth-debug] Attempting to get token...');
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET || 'dev-only-secret',
      });
      safeLog('[auth-debug] getToken result:', { hasToken: !!token });
    } catch (tokenError: any) {
      safeError('[auth-debug] Error during getToken', tokenError);
      // Continue execution to gather more info if possible
    }

    try {
      safeLog('[auth-debug] Attempting to get session...');
      session = await getServerSession(authOptions);
      safeLog('[auth-debug] getServerSession result:', { hasSession: !!session });
    } catch (sessionError: any) {
      safeError('[auth-debug] Error during getServerSession', sessionError);
      // Continue execution
    }

    safeLog('[auth-debug] Checking cookies...');
    cookieHeader = request.headers.get('cookie') || '';
    hasAuthCookie = cookieHeader.includes('next-auth.session-token');
    safeLog('[auth-debug] Cookie check done', { hasAuthCookie });
    
    safeLog('[auth-debug] Preparing final response', {
      hasToken: !!token,
      hasSession: !!session,
      hasAuthCookie,
      cookieExists: hasAuthCookie,
    });

    // Try to decode the token
    let decodedToken = null;
    if (token) {
      try {
        // Use ONLY the environment variable secret
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
           throw new Error('NEXTAUTH_SECRET not set for token decoding');
        }
        decodedToken = await jwtVerify(token, new TextEncoder().encode(secret));
      } catch (e) {
        decodedToken = { error: 'Failed to decode JWT', message: e instanceof Error ? e.message : String(e) };
      }
    }

    // If we reached here without a major crash, return gathered info
    return NextResponse.json({
      status: 'ok',
      authenticated: !!token, // Based on getToken result
      sessionExists: !!session, // Based on getServerSession result
      cookieExists: hasAuthCookie,
      environment: envInfo,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    // Catch any unexpected errors not caught by inner try/catch blocks
    safeError('[auth-debug] Uncaught error in handler', error);
    return NextResponse.json({
      status: 'error',
      message: 'Authentication diagnostic failed unexpectedly',
      errorName: error.name || 'UnknownError',
      errorMessage: error.message || 'No message',
      // Include potentially available info even on error
      partialEnvironment: envInfo,
      partialCookieExists: hasAuthCookie,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 