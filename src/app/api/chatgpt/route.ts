import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export async function POST(req: NextRequest) {
  // Redirect to the DeepSeek API endpoint
  const url = new URL(req.url);
  const redirectUrl = url.origin + '/api/deepseek';
  
  // Forward the request to the DeepSeek endpoint
  return NextResponse.redirect(redirectUrl, { status: 307 });
} 