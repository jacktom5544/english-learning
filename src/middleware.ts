import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Function to determine if a request is going to a static asset
function isStaticAsset(pathname: string): boolean {
  return /\.(.*)$/.test(pathname) || // Files with extensions
    pathname.startsWith('/_next/') || // Next.js resources
    pathname.startsWith('/api/health'); // Health check endpoint
}

// Function to safely get NextAuth secret
function getNextAuthSecret(): string {
  return process.env.NEXTAUTH_SECRET || 'dev-only-secret';
}

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/quiz',
  '/vocabulary',
  '/writing',
  '/subscribe',
  '/admin'
];

// Middleware handler function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  try {
    // Skip processing for static assets and most API routes
    if (isStaticAsset(pathname) || 
        (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/'))) {
      return response;
    }
    
    // For AWS CloudFront compatibility, add specific headers
    if (process.env.NODE_ENV === 'production') {
      // Set Cache-Control header for edge compatibility
      response.headers.set('Cache-Control', 'no-store, max-age=0');
    }

    // Check if route requires authentication
    const requiresAuth = protectedRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`));
      
    if (!requiresAuth) {
      // Pass through for public routes
      return response;
    }

    // Get authentication token
    const token = await getToken({ 
      req: request,
      secret: getNextAuthSecret()
    });

    // If no token found, redirect to login
    if (!token) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', encodeURI(request.url));
      return NextResponse.redirect(url);
    }

    // User is authenticated, allow access
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect to login with error parameter
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'AuthenticationError');
    return NextResponse.redirect(url);
  }
}

// Configure which routes should use the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next/ (Next.js internals)
     * 2. /static (static files)
     * 3. /favicon.ico, /robots.txt (common static files)
     * 4. /api/health (health check endpoint)
     * 5. .*\..*$ (files with extensions, e.g. images)
     */
    '/((?!_next|static|favicon.ico|robots.txt|api/health|.*\\..*$).*)',
  ],
}; 