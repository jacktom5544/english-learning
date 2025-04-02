import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { safeError, safeLog } from '@/lib/utils';

// Basic handler for Next.js App Router
export const GET = NextAuth(authOptions);
export const POST = NextAuth(authOptions);

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