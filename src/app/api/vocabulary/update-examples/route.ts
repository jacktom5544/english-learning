import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import { generateAIResponse } from '@/lib/ai';

// Only accessible to admins or in development environment
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    // Check if user is admin or in development environment
    const isAdmin = process.env.ADMIN_IDS?.split(',').includes(session.user.id);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isAdmin && !isDevelopment) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }
    
    await connectDB();
    
    // Get limit from request body, default to 10
    const { limit = 10 } = await req.json();
    
    // Find vocabularies without example sentences
    const vocabularies = await Vocabulary.find({
      $or: [
        { exampleSentence: { $exists: false } },
        { exampleSentence: null },
        { exampleSentence: "" }
      ]
    }).limit(limit);
    
    if (vocabularies.length === 0) {
      return NextResponse.json({
        message: '例文がないボキャブラリーはありません',
        updated: 0
      });
    }
    
    // Update each vocabulary with an example sentence
    let updatedCount = 0;
    
    for (const vocabulary of vocabularies) {
      try {
        const word = vocabulary.word;
        
        // Generate an example sentence using the AI
        const prompt = `
          Create a simple, everyday example sentence in English using the word "${word}".
          The sentence should be appropriate for English learners and demonstrate how to use the word correctly.
          Reply with only the example sentence, nothing else.
        `;
        
        const exampleSentence = await generateAIResponse([{ role: 'user', content: prompt }], {
          maxTokens: 100,
          temperature: 0.7,
        });
        
        // Update the vocabulary with the example sentence
        vocabulary.exampleSentence = exampleSentence.trim();
        await vocabulary.save();
        
        updatedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error updating vocabulary ${vocabulary.word}:`, error);
      }
    }
    
    return NextResponse.json({
      message: `${updatedCount}個のボキャブラリーを更新しました`,
      updated: updatedCount,
      total: vocabularies.length
    });
    
  } catch (error) {
    console.error('Error updating vocabulary examples:', error);
    return NextResponse.json(
      { error: '例文の更新に失敗しました' },
      { status: 500 }
    );
  }
} 