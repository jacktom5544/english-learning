import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { error: 'トークンとパスワードが必要です' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上にしてください' },
        { status: 400 }
      );
    }

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Connect to database
    await connectToDatabase();

    // Find user with this token and check if token is still valid
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'トークンが無効か有効期限が切れています' },
        { status: 400 }
      );
    }

    // Update password
    user.password = password;
    
    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'パスワードが正常にリセットされました'
    });
  } catch (error) {
    console.error('Error in reset password:', error);
    return NextResponse.json(
      { error: 'パスワードのリセット中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 