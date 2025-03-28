import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import { generateAIResponse } from '@/lib/ai';

// Get all vocabularies for the user
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
    
    // Get status filter from URL if present
    const url = new URL(req.url);
    const filterParam = url.searchParams.get('filter');
    
    let filter: any = { userId: session.user.id };
    
    if (filterParam === 'remembered') {
      filter.isRemembered = true;
    } else if (filterParam === 'not-remembered') {
      filter.isRemembered = false;
    }
    
    const vocabularies = await Vocabulary.find(filter).sort({ createdAt: -1 });
    
    return NextResponse.json(vocabularies);
  } catch (error) {
    console.error('Error fetching vocabularies:', error);
    return NextResponse.json(
      { error: '単語の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// Add a new vocabulary
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
    const { word, translation, explanation, exampleSentence, isRemembered } = body;
    
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
      // Update the existing vocabulary
      existingVocabulary.translation = translation;
      existingVocabulary.explanation = explanation || existingVocabulary.explanation;
      existingVocabulary.exampleSentence = exampleSentence || existingVocabulary.exampleSentence;
      existingVocabulary.isRemembered = isRemembered !== undefined ? isRemembered : existingVocabulary.isRemembered;
      
      await existingVocabulary.save();
      return NextResponse.json(existingVocabulary);
    }
    
    // Generate an example sentence if one wasn't provided
    let finalExampleSentence = exampleSentence || '';
    
    if (!finalExampleSentence) {
      try {
        // Generate an example sentence using the AI
        const prompt = `
          Create a simple, everyday example sentence in English using the word "${word}".
          The sentence should be appropriate for English learners and demonstrate how to use the word correctly.
          Reply with only the example sentence, nothing else.
        `;
        
        const generatedSentence = await generateAIResponse([{ role: 'user', content: prompt }], {
          maxTokens: 100,
          temperature: 0.7,
        });
        
        finalExampleSentence = generatedSentence.trim();
      } catch (error) {
        console.error('Error generating example sentence:', error);
        // Continue even if generation fails
      }
    }
    
    // Create a new vocabulary
    const newVocabulary = await Vocabulary.create({
      userId: session.user.id,
      word,
      translation,
      explanation: explanation || '',
      exampleSentence: finalExampleSentence,
      isRemembered: isRemembered || false,
    });
    
    return NextResponse.json(newVocabulary);
  } catch (error) {
    console.error('Error adding vocabulary:', error);
    return NextResponse.json(
      { error: '単語の追加に失敗しました' },
      { status: 500 }
    );
  }
} 