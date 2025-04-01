import { NextResponse } from 'next/server';
import * as envVars from '@/lib/env';
import { safeLog } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    safeLog('Testing environment variable helper');
    
    // Create a safely redacted version of environment variables
    const safeEnv = {
      // Authentication (redact secret)
      NEXTAUTH_SECRET: envVars.NEXTAUTH_SECRET ? 
        `Defined (length: ${envVars.NEXTAUTH_SECRET.length})` : 'Not defined',
      NEXTAUTH_URL: envVars.NEXTAUTH_URL,
      
      // Database (redact connection string)
      MONGODB_URI: envVars.MONGODB_URI ? 
        `Defined (starts with: ${envVars.MONGODB_URI.substring(0, 10)}...)` : 'Not defined',
      
      // Other variables (redact secrets)
      CLOUDINARY_API_SECRET: envVars.CLOUDINARY_API_SECRET ? 'Defined (redacted)' : 'Not defined',
      CLOUDINARY_API_KEY: envVars.CLOUDINARY_API_KEY ? 'Defined (redacted)' : 'Not defined',
      CLOUDINARY_CLOUD_NAME: envVars.CLOUDINARY_CLOUD_NAME,
      DEEPSEEK_API_KEY: envVars.DEEPSEEK_API_KEY ? 'Defined (redacted)' : 'Not defined',
      DEEPSEEK_BASE_URL: envVars.DEEPSEEK_BASE_URL,
      LOG_LEVEL: envVars.LOG_LEVEL,
      NODE_ENV: envVars.NODE_ENV,
    };
    
    // Also include raw process.env keys (without values) for comparison
    const processEnvKeys = Object.keys(process.env);
    
    return NextResponse.json({
      success: true,
      message: 'Environment variable helper test',
      environment: safeEnv,
      processEnvKeys,
      // Check if key environment variables are available
      hasNextAuthSecret: !!envVars.NEXTAUTH_SECRET,
      hasMongoDbUri: !!envVars.MONGODB_URI,
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 