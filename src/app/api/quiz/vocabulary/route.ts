import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import { safeLog, safeError } from '@/lib/utils';

// Add a vocabulary from the quiz
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      safeLog('Vocabulary API: Unauthorized access attempt');
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { word, translation, explanation, exampleSentence, isRemembered } = body;
    
    if (!word || !translation) {
      safeLog('Vocabulary API: Missing required fields', { word: !!word, translation: !!translation });
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
      safeLog('Vocabulary API: Updating existing vocabulary', { 
        vocabularyId: existingVocabulary._id.toString(),
        word,
        isRemembered 
      });
      
      existingVocabulary.isRemembered = isRemembered;
      // Update example sentence if it doesn't already exist
      if (exampleSentence && !existingVocabulary.exampleSentence) {
        existingVocabulary.exampleSentence = exampleSentence;
      }
      await existingVocabulary.save();
      return NextResponse.json(existingVocabulary);
    }
    
    // Create a new vocabulary
    safeLog('Vocabulary API: Creating new vocabulary', {
      word,
      isRemembered: isRemembered || false
    });
    
    const newVocabulary = await Vocabulary.create({
      userId: session.user.id,
      word,
      translation,
      explanation: explanation || '',
      exampleSentence: exampleSentence || '',
      isRemembered: isRemembered || false,
    });
    
    return NextResponse.json(newVocabulary);
  } catch (error) {
    safeError('Error adding vocabulary from quiz:', error);
    return NextResponse.json(
      { error: '単語の追加に失敗しました' },
      { status: 500 }
    );
  }
} 