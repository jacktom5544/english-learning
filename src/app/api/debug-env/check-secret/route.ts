import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Check if NEXTAUTH_SECRET is defined
  const secretDefined = !!process.env.NEXTAUTH_SECRET;

  // Get the first/last character if it exists (for verification without exposing the secret)
  const secretHint = process.env.NEXTAUTH_SECRET ? 
    `${process.env.NEXTAUTH_SECRET.substring(0, 1)}...${process.env.NEXTAUTH_SECRET.substring(process.env.NEXTAUTH_SECRET.length - 1)}` : 
    'undefined';
  
  // Check if our fallback would be used
  const fallbackUsed = !secretDefined;
  
  // Return status - no detailed error info to avoid security issues
  return NextResponse.json({
    success: true,
    secretDefined,
    secretHint,
    fallbackUsed,
    // This should match the hardcoded value we're using as fallback
    fallbackValue: '291b0018d2327b4ba9cb49f24ce42ea4',
    // Using built-in Amplify env variables to confirm the deployment environment
    amplifyVerifyTarget: process.env.AWS_EXECUTION_ENV || 'Not defined',
    appId: process.env.APP_ID || 'Not defined',
    branchName: process.env.BRANCH || 'Not defined',
  });
} 