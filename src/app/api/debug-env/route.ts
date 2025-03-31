import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Return masked environment variables for debugging
    return NextResponse.json({
      env_vars: {
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? `${process.env.DEEPSEEK_API_KEY.substring(0, 3)}...${process.env.DEEPSEEK_API_KEY.substring(process.env.DEEPSEEK_API_KEY.length - 3)}` : null,
        DEEPSEEK_API_BASE: process.env.DEEPSEEK_API_BASE || null,
        NODE_ENV: process.env.NODE_ENV,
        API_KEYS_EXIST: {
          DEEPSEEK: !!process.env.DEEPSEEK_API_KEY,
          NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
          DATABASE_URL: !!process.env.DATABASE_URL,
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in debug env endpoint:", error);
    return NextResponse.json({ error: "Error checking environment" }, { status: 500 });
  }
} 