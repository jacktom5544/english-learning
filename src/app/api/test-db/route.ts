import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    // Check if we have a valid session
    const session = await getServerSession(authOptions);
    console.log('Session:', session ? 'Valid' : 'Invalid', session?.user?.id ? 'Has user ID' : 'No user ID');
    
    await connectDB();

    // Get all user models properties
    const userSchema = User.schema;
    const userPaths = Object.keys(userSchema.paths);
    
    // If we get here, the connection was successful
    return NextResponse.json({ 
      status: 'success', 
      message: 'Database connection successful',
      mongoose_version: mongoose.version,
      connection_state: mongoose.connection.readyState,
      session_valid: !!session,
      user_id: session?.user?.id || null,
      user_model_fields: userPaths
    });
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 