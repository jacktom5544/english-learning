import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Define paths that require authentication
  const protectedPaths = [
    '/dashboard',
    '/profile',
    '/quiz',
    '/vocabulary',
    '/writing',
  ];
  
  // Define paths that are only accessible to logged out users
  const authRoutes = ['/login', '/register'];
  
  // Check if the current path requires authentication
  const isProtectedPath = protectedPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // Check if the current path is for authentication
  const isAuthRoute = authRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Get the token
  const token = await getToken({ req: request });
  
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
    '/login',
    '/register',
  ],
}; 