import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';

// Get vocabulary counts for all filter types
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Get filter counts by user
    const userId = session.user.id;
    
    // Get total count
    const allCount = await Vocabulary.countDocuments({ userId });
    
    // Get remembered count
    const rememberedCount = await Vocabulary.countDocuments({ 
      userId, 
      isRemembered: true 
    });
    
    // Get not-remembered count
    const notRememberedCount = await Vocabulary.countDocuments({ 
      userId, 
      isRemembered: false 
    });
    
    return NextResponse.json({
      all: allCount,
      remembered: rememberedCount,
      notRemembered: notRememberedCount
    });
  } catch (error) {
    console.error('Error fetching vocabulary counts:', error);
    return NextResponse.json(
      { error: '単語カウントの取得に失敗しました' },
      { status: 500 }
    );
  }
} 