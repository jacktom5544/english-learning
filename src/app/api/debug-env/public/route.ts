import { NextResponse } from 'next/server';
import { isProduction, isAWSAmplify } from '@/lib/env';

// This is a special debug endpoint that doesn't require authentication
// It provides minimal environment variable status without exposing sensitive values
export async function GET() {
  try {
    // Only return existence checks, not actual values
    return NextResponse.json({
      env_status: {
        mongodb: {
          exists: !!process.env.MONGODB_URI,
        },
        auth: {
          nextauth_url_exists: !!process.env.NEXTAUTH_URL,
          nextauth_secret_exists: !!process.env.NEXTAUTH_SECRET,
        },
        api_keys: {
          deepseek_api_key_exists: !!process.env.DEEPSEEK_API_KEY,
          deepseek_base_url_exists: !!process.env.DEEPSEEK_BASE_URL,
          cloudinary_api_key_exists: !!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
          cloudinary_cloud_name_exists: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          cloudinary_api_secret_exists: !!process.env.CLOUDINARY_API_SECRET,
        },
        misc: {
          node_env: process.env.NODE_ENV || "not_set",
          is_production: isProduction(),
          is_amplify: isAWSAmplify(),
        }
      },
      // Don't include any actual environment variable values or prefixes
      timestamp: new Date().toISOString(),
      note: "This is a public debug endpoint that safely shows environment variable existence"
    });
  } catch (error) {
    console.error("Error in public debug env endpoint:", error);
    return NextResponse.json({ 
      error: "Error checking environment"
    }, { status: 500 });
  }
} 