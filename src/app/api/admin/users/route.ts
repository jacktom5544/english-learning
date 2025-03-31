import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    // Check if the user is authenticated and is an admin
    if (!session || !session.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Get all users (exclude sensitive fields)
    const users = await User.find({}, {
      password: 0,
    }).sort({ createdAt: -1 });
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error getting users:', error);
    return NextResponse.json(
      { error: 'ユーザー情報の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 