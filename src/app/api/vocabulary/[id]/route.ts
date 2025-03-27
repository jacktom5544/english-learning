import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

// Update vocabulary status
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
    
    const { id } = params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      );
    }
    
    // Get request body
    const body = await req.json();
    const { isRemembered } = body;
    
    // Find and update the vocabulary
    const vocabulary = await Vocabulary.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { isRemembered },
      { new: true }
    );
    
    if (!vocabulary) {
      return NextResponse.json(
        { error: '単語が見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(vocabulary);
  } catch (error) {
    console.error('Error updating vocabulary:', error);
    return NextResponse.json(
      { error: '単語の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// Delete vocabulary
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
    
    // Find and delete the vocabulary
    const vocabulary = await Vocabulary.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });
    
    if (!vocabulary) {
      return NextResponse.json(
        { error: '単語が見つかりません' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vocabulary:', error);
    return NextResponse.json(
      { error: '単語の削除に失敗しました' },
      { status: 500 }
    );
  }
} 