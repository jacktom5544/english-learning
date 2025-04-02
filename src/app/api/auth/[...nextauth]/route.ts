import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { safeError, safeLog } from '@/lib/utils';

// Function to fix request URL for AWS Amplify environment
const fixRequestUrl = (req: NextRequest) => {
  if (process.env.NODE_ENV === 'production') {
    try {
      const url = new URL(req.url);
      const forwardedHost = req.headers.get('x-forwarded-host');
      
      if (forwardedHost) {
        // Create the correct production URL
        const correctedUrl = `https://${forwardedHost}${url.pathname}${url.search}`;
        
        // Log the URL correction for debugging
        safeLog('[NextAuth] Correcting request URL', {
          original: req.url,
          corrected: correctedUrl
        });
        
        // Override the URL property
        Object.defineProperty(req, 'url', {
          get: () => correctedUrl,
          configurable: true
        });
      }
    } catch (error) {
      safeError('[NextAuth] Error fixing request URL:', error);
    }
  }
  return req;
};

// Enhanced handlers for Next.js App Router with URL correction
export const GET = async (req: NextRequest) => {
  // Fix the URL before passing to NextAuth
  const fixedReq = fixRequestUrl(req);
  return await NextAuth(authOptions)(fixedReq);
};

export const POST = async (req: NextRequest) => {
  // Fix the URL before passing to NextAuth
  const fixedReq = fixRequestUrl(req);
  return await NextAuth(authOptions)(fixedReq);
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  safeLog('[NextAuth] Handling OPTIONS request for CORS preflight');
  
  const res = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return res;
} 