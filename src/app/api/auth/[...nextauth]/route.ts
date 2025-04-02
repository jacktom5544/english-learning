import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { safeError, safeLog } from '@/lib/utils';

// More robust handler with CORS headers and explicit error handling
async function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  try {
    safeLog('[NextAuth Route] Processing request for path:', context.params.nextauth.join('/'));
    
    // Add CORS headers to ensure the request works across domains
    const response = await NextAuth(authOptions)(req, {
      params: { nextauth: context.params.nextauth }
    });
    
    // Add CORS headers to the response
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    safeLog('[NextAuth Route] Response prepared successfully');
    return response;
  } catch (error) {
    safeError('[NextAuth Route] Error processing authentication request:', error);
    
    // Return a JSON error response
    const errorResponse = NextResponse.json(
      { error: 'Internal authentication error', message: 'Failed to process authentication request' },
      { status: 500 }
    );
    
    // Add CORS headers to the error response
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    errorResponse.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    return errorResponse;
  }
}

// Handle all HTTP methods that NextAuth can process
export { handler as GET, handler as POST };

// Handle OPTIONS method for CORS preflight requests
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return response;
} 