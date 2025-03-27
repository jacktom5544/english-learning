import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    
    // Verify the request contains a valid token
    const token = await getToken({ req: request });
    
    if (!token || token.id !== id) {
      return NextResponse.json(
        { error: '認証エラー' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    
    // Verify the request contains a valid token
    const token = await getToken({ req: request });
    
    if (!token || token.id !== id) {
      return NextResponse.json(
        { error: '認証エラー' },
        { status: 401 }
      );
    }

    const { name, englishLevel, job, goal } = await request.json();

    // Validate inputs
    if (!name) {
      return NextResponse.json(
        { error: 'ニックネームは必須です' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    
    const user = await User.findById(id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }
    
    // Update user fields
    user.name = name;
    if (englishLevel) user.englishLevel = englishLevel;
    if (job !== undefined) user.job = job;
    if (goal !== undefined) user.goal = goal;
    
    await user.save();
    
    return NextResponse.json({
      message: 'プロフィールが更新されました',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        englishLevel: user.englishLevel,
        job: user.job,
        goal: user.goal,
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}