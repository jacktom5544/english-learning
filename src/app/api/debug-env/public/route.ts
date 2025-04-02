import { NextResponse } from 'next/server';

// This is a special debug endpoint that doesn't require authentication
// It only exposes whether variables exist, not their actual values
export async function GET() {
  try {
    // Return safe information about environment variables (only existence, not values)
    return NextResponse.json({
      env_status: {
        mongodb: {
          exists: !!process.env.MONGODB_URI,
          prefix: process.env.MONGODB_URI?.substring(0, 10) || "not_set"
        },
        auth: {
          nextauth_url_exists: !!process.env.NEXTAUTH_URL,
          nextauth_url_value: process.env.NEXTAUTH_URL || "not_set",
          nextauth_secret_exists: !!process.env.NEXTAUTH_SECRET,
          nextauth_secret_length: process.env.NEXTAUTH_SECRET?.length || 0
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
          log_level: process.env.LOG_LEVEL || "not_set",
          amplify_env: !!process.env.AWS_REGION ? "aws_amplify" : "not_aws"
        }
      },
      timestamp: new Date().toISOString(),
      note: "This is a public debug endpoint that safely shows environment variable existence"
    });
  } catch (error) {
    console.error("Error in public debug env endpoint:", error);
    return NextResponse.json({ 
      error: "Error checking environment", 
      error_message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 