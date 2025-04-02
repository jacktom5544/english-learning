import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeError, safeLog } from '@/lib/utils';
import jwt from 'jsonwebtoken';
import User from '@/models/User';
import { connectToDatabase } from '@/lib/db';

// Direct implementation of the session endpoint
// This provides a reliable fallback when the [...nextauth] route fails
export async function GET(req: NextRequest) {
  try {
    safeLog('[Session Direct] Processing session request');
    
    // First try getServerSession
    const session = await getServerSession(authOptions);
    
    // If getServerSession works, return the session
    if (session) {
      safeLog('[Session Direct] Session found from getServerSession');
      return NextResponse.json(session);
    }
    
    // If no session from NextAuth, try manual verification of the token
    safeLog('[Session Direct] No session from getServerSession, trying manual verification');
    
    // Get the session token cookie
    const cookies = req.cookies;
    const sessionTokenCookie = cookies.get('next-auth.session-token');
    
    if (!sessionTokenCookie?.value) {
      safeLog('[Session Direct] No session token cookie found');
      return NextResponse.json({ user: null });
    }
    
    // Verify the token
    try {
      const secret = process.env.NEXTAUTH_SECRET || 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg=';
      const token = jwt.verify(sessionTokenCookie.value, secret) as jwt.JwtPayload;
      
      if (typeof token !== 'object' || !token.id) {
        safeError('[Session Direct] Invalid token structure', token);
        return NextResponse.json({ user: null });
      }
      
      // Get the user from the database to ensure they exist
      await connectToDatabase();
      const user = await User.findById(token.id);
      
      if (!user) {
        safeError('[Session Direct] User not found for token', { userId: token.id });
        return NextResponse.json({ user: null });
      }
      
      // Construct a session object matching NextAuth's format
      const manualSession = {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points || 0,
          subscriptionStatus: user.subscriptionStatus || 'inactive'
        },
        expires: new Date((token.exp || Math.floor(Date.now() / 1000) + 86400) * 1000).toISOString()
      };
      
      safeLog('[Session Direct] Manually constructed session for user', { userId: user._id.toString() });
      
      // Create a proper JSON response with session data
      const response = NextResponse.json(manualSession);
      
      // Set CORS headers
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Content-Type', 'application/json');
      
      return response;
    } catch (error) {
      safeError('[Session Direct] JWT verification error', error);
      return NextResponse.json({ user: null });
    }
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