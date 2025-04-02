import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    safeLog('[Debug Session] Processing session debug request');
    
    // Get all request cookies for debugging
    const requestCookies = req.headers.get('cookie') || '';
    
    // Get the token directly using next-auth/jwt with our hardcoded secret for testing
    const token = await getToken({ 
      req,
      secret: process.env.NEXTAUTH_SECRET || 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg='
    });
    
    // Also get the session using getServerSession for comparison
    const session = await getServerSession(authOptions);
    
    // Build detailed response
    const responseData = {
      requestCookies: requestCookies,
      hasSessionCookie: requestCookies.includes('next-auth.session-token'),
      token: token,
      session: session,
      auth: {
        nextAuthUrl: process.env.NEXTAUTH_URL,
        secretConfigured: !!process.env.NEXTAUTH_SECRET,
        nodeEnv: process.env.NODE_ENV
      }
    };
    
    safeLog('[Debug Session] Debug data prepared successfully');
    
    // Create response with CORS headers
    const response = NextResponse.json(responseData);
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    return response;
  } catch (error) {
    safeError('[Debug Session] Error getting debug session info:', error);
    
    // Create error response with CORS headers
    const errorResponse = NextResponse.json(
      { error: 'Failed to get session information', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    
    // Add CORS headers
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    errorResponse.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    return errorResponse;
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return response;
} 