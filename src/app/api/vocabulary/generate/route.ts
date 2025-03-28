import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import { generateVocabularyPractice } from '@/lib/ai';

// Generate vocabulary using DeepSeek AI
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    const data = await req.json();
    const { topic, count = 10 } = data;
    
    if (!topic) {
      return NextResponse.json(
        { error: 'トピックは必須です' },
        { status: 400 }
      );
    }
    
    try {
      // Generate vocabulary list using DeepSeek
      const vocabularyContent = await generateVocabularyPractice(topic, count) || '';
      
      // Parse the generated content to extract vocabulary items
      // This is a simple implementation - you may need to adjust based on actual output format
      const vocabularyItems = parseVocabularyContent(vocabularyContent);
      
      return NextResponse.json({ 
        success: true,
        vocabulary: vocabularyItems
      });
    } catch (error) {
      console.error('Error generating vocabulary:', error);
      return NextResponse.json(
        { error: 'ボキャブラリーの生成に失敗しました' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in vocabulary generation API:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// Helper function to parse vocabulary content
function parseVocabularyContent(content: string) {
  // This is a simple placeholder implementation
  // In a production app, you'd implement a more robust parser
  
  // Try to extract vocabulary items by looking for patterns
  const items = [];
  
  // Split by numbered items, assuming the AI gives a numbered list
  const sections = content.split(/\d+\.\s+/).filter(Boolean);
  
  for (const section of sections) {
    const lines = section.split('\n').filter(line => line.trim());
    
    if (lines.length >= 2) {
      // Assume first line is the word
      const word = lines[0].trim();
      
      // Assume second line has the translation
      let translation = '';
      let explanation = '';
      let exampleSentence = '';
      
      // Extract translation, explanation, and example sentence
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(part => part.trim());
          
          if (key.includes('日本語') || key.includes('意味')) {
            translation = value;
          } else if (!explanation && (key.includes('説明') || key.includes('explanation'))) {
            explanation = value;
          } else if (key.includes('例文') || key.includes('example')) {
            exampleSentence = value;
          }
        } else if (!translation) {
          // If no specific format, assume the second line is translation
          translation = line;
        } else if (!explanation) {
          // And third line might be explanation
          explanation = line;
        }
      }
      
      // Add to vocabulary items if we have at least a word and translation
      if (word && translation) {
        items.push({
          word,
          translation,
          explanation: explanation || '',
          exampleSentence: exampleSentence || '',
          isRemembered: false
        });
      }
    }
  }
  
  // If parsing failed or returned no items, create a dummy item
  if (items.length === 0) {
    items.push({
      word: "Example",
      translation: "例",
      explanation: "This is an example vocabulary item",
      exampleSentence: "Can you give me an example of how to use this word?",
      isRemembered: false
    });
  }
  
  return items;
} 