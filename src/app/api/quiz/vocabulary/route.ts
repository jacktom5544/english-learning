import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

// Add a vocabulary from the quiz
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { word, translation, explanation, isRemembered } = body;
    
    if (!word || !translation) {
      return NextResponse.json(
        { error: '単語と翻訳は必須です' },
        { status: 400 }
      );
    }
    
    // First check if the vocabulary already exists for this user
    const existingVocabulary = await Vocabulary.findOne({
      userId: session.user.id,
      word: word,
    });
    
    if (existingVocabulary) {
      // Update the existing vocabulary's remembered status
      existingVocabulary.isRemembered = isRemembered;
      await existingVocabulary.save();
      return NextResponse.json(existingVocabulary);
    }
    
    // Create a new vocabulary
    const newVocabulary = await Vocabulary.create({
      userId: session.user.id,
      word,
      translation,
      explanation: explanation || '',
      isRemembered: isRemembered || false,
    });
    
    return NextResponse.json(newVocabulary);
  } catch (error) {
    console.error('Error adding vocabulary from quiz:', error);
    return NextResponse.json(
      { error: '単語の追加に失敗しました' },
      { status: 500 }
    );
  }
} 