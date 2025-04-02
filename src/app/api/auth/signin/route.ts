import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { safeError, safeLog } from '@/lib/utils';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import jwt from 'jsonwebtoken';

// Custom route for handling sign-in requests
// This provides a direct path for login that doesn't rely on catch-all routes
export async function POST(req: NextRequest) {
  try {
    safeLog('[Signin Direct] Processing signin request');
    
    // Parse the request body
    const body = await req.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      );
    }
    
    try {
      safeLog('[Signin Direct] Connecting to database');
      await connectToDatabase();
      
      safeLog('[Signin Direct] Finding user');
      const user = await User.findOne({ email });
      
      if (!user) {
        safeError('[Signin Direct] Login attempt with non-existent email', { email });
        return NextResponse.json(
          { error: 'メールアドレスまたはパスワードが間違っています' },
          { status: 401 }
        );
      }
      
      safeLog('[Signin Direct] Comparing password');
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        safeError('[Signin Direct] Invalid password for user', { userId: user._id.toString() });
        return NextResponse.json(
          { error: 'メールアドレスまたはパスワードが間違っています' },
          { status: 401 }
        );
      }
      
      // At this point, credentials are valid
      safeLog('[Signin Direct] Login successful, creating session for user:', user._id.toString());
      
      // Create a token that mimics NextAuth's session token
      const secret = process.env.NEXTAUTH_SECRET || 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg=';
      const expiresIn = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // Create session token that matches NextAuth's format
      const token = jwt.sign(
        {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points || 0,
          subscriptionStatus: user.subscriptionStatus || 'inactive',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + expiresIn,
        },
        secret
      );
      
      // Create the response
      const response = NextResponse.json({ 
        success: true,
        redirectUrl: '/dashboard',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points || 0,
          subscriptionStatus: user.subscriptionStatus || 'inactive'
        },
        // Include the session token in the response so the client can set it
        sessionToken: token
      });
      
      // Set cookies directly on the response
      const secure = process.env.NODE_ENV === 'production';
      const cookieDomain = process.env.NODE_ENV === 'production' ? '.d2gwwh0jouqtnx.amplifyapp.com' : undefined;
      
      // Set the security options for cookies
      const cookieOptions = {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        path: '/',
        maxAge: expiresIn,
        domain: cookieDomain
      };
      
      // Convert to string for cookie header
      const cookieString = Object.entries(cookieOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      // Set the full cookie as a header
      response.headers.set(
        'Set-Cookie', 
        `next-auth.session-token=${token}; ${cookieString}`
      );
      
      return response;
    } catch (error) {
      safeError('[Signin Direct] Error during authentication', error);
      
      // Check if it's a DB connection error
      if (error instanceof Error && error.message.includes('connect')) {
        return NextResponse.json(
          { error: 'データベース接続エラーが発生しました。' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: '認証中にエラーが発生しました。' },
        { status: 500 }
      );
    }
  } catch (error) {
    safeError('[Signin Direct] Error handling request', error);
    
    return NextResponse.json(
      { error: 'リクエスト処理中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  safeLog('[Signin Direct] Handling OPTIONS request');
  
  const res = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  return res;
} 