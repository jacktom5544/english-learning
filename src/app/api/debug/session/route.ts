import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Get the token directly using next-auth/jwt
    const token = await getToken({ req });
    
    // Also get the session using getServerSession for comparison
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      token: token,
      session: session,
    });
  } catch (error) {
    console.error('Error getting debug session info:', error);
    return NextResponse.json(
      { error: 'Failed to get session information' },
      { status: 500 }
    );
  }
} 