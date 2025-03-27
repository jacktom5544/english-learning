import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Quiz from '@/models/Quiz';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

// Update quiz completion status and score
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Properly await the params object
    const id = params.id;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      );
    }
    
    // Get request body
    const body = await req.json();
    const { completed, score, results } = body;
    
    if (completed === undefined) {
      return NextResponse.json(
        { error: '完了ステータスが必要です' },
        { status: 400 }
      );
    }
    
    if (score === undefined || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'スコアが必要で、数値である必要があります' },
        { status: 400 }
      );
    }
    
    // Create update object
    const updateData: any = { completed, score };
    
    // Add results if provided
    if (results && Array.isArray(results)) {
      updateData.results = results;
    }
    
    // Find and update the quiz
    const quiz = await Quiz.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      updateData,
      { new: true }
    );
    
    if (!quiz) {
      return NextResponse.json(
        { error: 'クイズが見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(quiz);
  } catch (error: any) {
    console.error('Error updating quiz:', error);
    return NextResponse.json(
      { error: 'クイズの更新に失敗しました', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete a quiz
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const { id } = params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      );
    }
    
    // Find and delete the quiz
    const quiz = await Quiz.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });
    
    if (!quiz) {
      return NextResponse.json(
        { error: 'クイズが見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json(
      { error: 'クイズの削除に失敗しました', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 