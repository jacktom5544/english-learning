import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user doesn't exist for security
      return NextResponse.json({
        success: true,
        message: 'パスワードリセット用のメールを送信しました（実際にアカウントが存在する場合）'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token before saving to database
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save to user document with expiration time (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    // In a real application, you would send an email with the reset link
    // For this demo, we'll just return the reset token
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/${resetToken}`;
    console.log('Password reset URL:', resetUrl);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'パスワードリセット用のメールを送信しました',
      // Only include resetUrl in development
      ...(process.env.NODE_ENV !== 'production' && { resetUrl })
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json(
      { error: 'パスワードリセットの処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 