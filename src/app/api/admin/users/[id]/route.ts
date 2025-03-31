import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Get request body
    const { points } = await req.json();
    
    // Validate input
    if (points === undefined || points < 0) {
      return NextResponse.json(
        { error: '無効なポイント値です' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      params.id,
      { 
        points,
        pointsLastUpdated: new Date()
      },
      { new: true, select: { password: 0 } }
    );
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'ユーザーのポイントを更新しました',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'ユーザーの更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 