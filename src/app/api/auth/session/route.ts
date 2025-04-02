import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeError, safeLog } from '@/lib/utils';

// Direct implementation of the session endpoint
// This provides a reliable fallback when the [...nextauth] route fails
export async function GET(req: NextRequest) {
  try {
    safeLog('[Session Direct] Processing session request');
    
    // Get the session directly using getServerSession
    const session = await getServerSession(authOptions);
    
    safeLog('[Session Direct] Session result:', { 
      hasSession: !!session,
      user: session?.user?.id ? 'exists' : 'null' 
    });
    
    // Create a proper JSON response with session data
    const response = NextResponse.json(session || { user: null });
    
    // Set CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Content-Type', 'application/json');
    
    return response;
  } catch (error) {
    safeError('[Session Direct] Error handling session request:', error);
    
    // In case of error, return an empty session
    const emptySession = {
      user: null,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    };
    
    // Create error response with empty session
    const errorResponse = NextResponse.json(emptySession, { status: 200 });
    
    // Set CORS headers
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Content-Type', 'application/json');
    
    return errorResponse;
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  safeLog('[Session Direct] Handling OPTIONS request for CORS preflight');
  
  const res = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return res;
} 