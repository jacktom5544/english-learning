import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { safeLog, safeError } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    safeLog('Testing MongoDB connection...');
    
    // Try to connect to the database
    const start = Date.now();
    await connectToDatabase();
    const elapsed = Date.now() - start;
    
    return NextResponse.json({ 
      success: true, 
      message: `MongoDB connection successful (${elapsed}ms)`,
      mongodbUri: process.env.MONGODB_URI ? 
        `${process.env.MONGODB_URI.substring(0, 20)}...` : 
        'Not defined',
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 
        'Defined (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : 
        'Not defined',
      nodeEnv: process.env.NODE_ENV || 'Not defined',
    }, { status: 200 });
  } catch (error) {
    safeError('Error testing MongoDB connection', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      mongodbUri: process.env.MONGODB_URI ? 
        `${process.env.MONGODB_URI.substring(0, 20)}...` : 
        'Not defined', 
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 
        'Defined (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : 
        'Not defined',
      nodeEnv: process.env.NODE_ENV || 'Not defined',
    }, { status: 500 });
  }
} 