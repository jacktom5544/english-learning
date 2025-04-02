import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/utils';
import { getNextAuthURL, isProduction, isAWSAmplify } from '@/lib/env';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * API route to check authentication status
 * This is a debug endpoint for testing auth issues
 */
export async function GET(req: NextRequest) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    // Try to get the session using getServerSession
    let session = null;
    let sessionError = null;
    
    try {
      session = await getServerSession(authOptions);
    } catch (err) {
      sessionError = err instanceof Error ? err.message : String(err);
    }
    
    // Try to get the token using getToken
    let token = null;
    let tokenError = null;
    
    try {
      token = await getToken({ 
        req,
        secret: process.env.NEXTAUTH_SECRET || 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg='
      });
    } catch (err) {
      tokenError = err instanceof Error ? err.message : String(err);
    }
    
    // Get cookies for debugging
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim());
    
    // Check if there's a next-auth session token
    const hasNextAuthCookie = cookies.some(c => c.startsWith('next-auth.session-token='));
    
    return NextResponse.json({
      authenticated: !!session?.user,
      session: session ? {
        user: {
          id: session.user?.id || null,
          name: session.user?.name || null,
          email: session.user?.email ? session.user.email.slice(0, 5) + '...' : null,
          role: session.user?.role || null,
          hasPoints: session.user?.points !== undefined,
          points: session.user?.points || null,
          subscriptionStatus: session.user?.subscriptionStatus || null
        }
      } : null,
      token: token ? {
        id: token.id || null,
        name: token.name || null,
        email: token.email ? token.email.slice(0, 5) + '...' : null,
        role: token.role || null,
        hasPoints: token.points !== undefined,
        points: token.points || null,
        subscriptionStatus: token.subscriptionStatus || null
      } : null,
      cookies: {
        count: cookies.length,
        names: cookies.map(c => c.split('=')[0]),
        hasNextAuthSessionToken: hasNextAuthCookie
      },
      errors: {
        session: sessionError,
        token: tokenError
      },
      environment: {
        nextAuthUrl: getNextAuthURL(),
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nodeEnv: process.env.NODE_ENV,
        isProduction: isProduction(),
        isAmplify: isAWSAmplify()
      },
      headers: {
        host: req.headers.get('host'),
        userAgent: req.headers.get('user-agent'),
        origin: req.headers.get('origin'),
        referer: req.headers.get('referer')
      }
    }, { headers });
  } catch (error) {
    safeError('Global error in auth status check:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Auth status check failed',
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