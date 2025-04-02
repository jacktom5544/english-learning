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
        MONGODB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 10)}...` : null,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? `${process.env.DEEPSEEK_API_KEY.substring(0, 3)}...${process.env.DEEPSEEK_API_KEY.substring(process.env.DEEPSEEK_API_KEY.length - 3)}` : null,
        DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || null,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL.substring(0, 10)}...` : null,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Defined (masked)' : null,
        CLOUDINARY_CONFIG: {
          cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || null,
          api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ? 'Defined (masked)' : null,
          api_secret: process.env.CLOUDINARY_API_SECRET ? 'Defined (masked)' : null,
        },
        STRIPE_CONFIG: {
          secret_key: process.env.STRIPE_SECRET_KEY ? 'Defined (masked)' : null,
          publishable_key: process.env.STRIPE_PUBLISHABLE_KEY ? 'Defined (masked)' : null,
          webhook_secret: process.env.STRIPE_WEBHOOK_SECRET ? 'Defined (masked)' : null,
          public_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Defined (masked)' : null,
        },
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        AWS_REGION: process.env.AWS_REGION,
        AMPLIFY_ENV: process.env.AMPLIFY_ENV,
      },
      timestamp: new Date().toISOString(),
      host_info: {
        hostname: process.env.HOSTNAME || null,
        deployment: process.env.VERCEL ? 'Vercel' : (process.env.AWS_REGION ? 'AWS Amplify' : 'Other/Local')
      }
    });
  } catch (error) {
    console.error("Error in debug env endpoint:", error);
    return NextResponse.json({ error: "Error checking environment" }, { status: 500 });
  }
} 