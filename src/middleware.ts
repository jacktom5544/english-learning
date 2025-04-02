import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { isAWSAmplify } from '@/lib/env';

// Get the NextAuth secret in a secure way without exposing credentials
function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  // Return the secret if available, or a non-sensitive development fallback
  return secret || 'dev-mode-secret-not-used-in-production';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Define paths that require authentication
  const protectedPaths = [
    '/dashboard',
    '/profile',
    '/quiz',
    '/vocabulary',
    '/writing',
    '/subscribe',
  ];
  
  // Define paths that are only accessible to logged out users
  const authRoutes = ['/login', '/register'];

  // Define admin-only paths
  const adminPaths = ['/admin'];
  
  // Define debug paths that should bypass all checks
  const debugPaths = [
    '/debug-session',
    '/fix-admin-role',
    '/test-admin',
    '/api/debug-env',
    '/api/debug-env/public', // Our new public debug endpoint
  ];
  
  // Check if the current path is a debug path
  const isDebugPath = debugPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // Skip all checks for debug paths
  if (isDebugPath) {
    return NextResponse.next();
  }
  
  // Also, bypass auth requirements for API routes that aren't auth-dependent
  if (pathname.startsWith('/api/') && 
    !pathname.startsWith('/api/auth/') && 
    !pathname.startsWith('/api/users/') && 
    !pathname.startsWith('/api/subscriptions/')) {
    return NextResponse.next();
  }
  
  // Check if the current path requires authentication
  const isProtectedPath = protectedPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // Check if the current path is for authentication
  const isAuthRoute = authRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the current path is admin-only
  const isAdminPath = adminPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // Get the token with error handling
  let token;
  try {
    token = await getToken({ 
      req: request,
      // Use secure method to get NextAuth secret
      secret: getNextAuthSecret()
    });
  } catch (error) {
    console.error('Error in getToken middleware:', error);
    
    // If this is a protected path, redirect to login on error
    if (isProtectedPath || isAdminPath) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', encodeURI(pathname));
      return NextResponse.redirect(url);
    }
    
    // For other paths, just continue with no token
    token = null;
  }
  
  // Print minimal token details for debugging - no sensitive info
  if (process.env.NODE_ENV !== 'production') {
    console.log('Middleware access:', {
      path: pathname,
      tokenExists: !!token,
      tokenRole: token?.role || 'none',
      isAWSAmplify: isAWSAmplify(),
    });
  }
  
  // Redirect logic for protected paths
  if (isProtectedPath && !token) {
    // Redirect unauthenticated users to login
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(url);
  }
  
  // Redirect logic for auth routes
  if (isAuthRoute && token) {
    // Redirect authenticated users to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect logic for admin paths
  if (isAdminPath && (!token || token.role !== 'admin')) {
    // Redirect non-admin users to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

// Configure paths that trigger the middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/quiz/:path*',
    '/vocabulary/:path*',
    '/writing/:path*',
    '/admin/:path*',
    '/subscribe/:path*',
    '/login',
    '/register',
    '/debug-session',
    '/fix-admin-role',
    '/test-admin',
    '/api/:path*',
  ],
}; 