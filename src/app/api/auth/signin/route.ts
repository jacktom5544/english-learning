import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { safeError, safeLog } from '@/lib/utils';
import { signIn } from 'next-auth/react';

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
      safeLog('[Signin Direct] Login successful');
      
      return NextResponse.json({ 
        success: true,
        redirectUrl: '/dashboard',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
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