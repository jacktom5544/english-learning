import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import Writing from '@/models/Writing';
import connectDB from '@/lib/db';
import { generateAIResponse, provideWritingFeedback } from '@/lib/ai';
import { consumePoints } from '@/lib/serverUtils';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

// Use predefined fake responses when API is not available
const FAKE_TOPIC = '今週末に行った活動について英語で説明してください。';
const FAKE_FEEDBACK = {
  feedback: "申し訳ございませんが、AIサービスが現在応答できません。後ほど再度お試しください。",
  score: 50
};

// Generate a topic using DeepSeek AI
async function generateTopic(level: string, job: string, goal: string): Promise<string> {
  console.log(`Generating topic for level: ${level}, job: ${job || '不明'}`);
  
  const prompt = `
    英語学習者に適した英作文のトピックを1つ作成してください。

    学習者のプロフィール:
    - 英語レベル: ${level}
    - 職業: ${job || '不明'}
    - 学習目標: ${goal || '英語力向上'}
    
    以下の条件を満たすトピックを生成してください:
    - 学習者のレベルに適している
    - 可能であれば職業や目標に関連している
    - シンプルで明確（1〜2文程度）
    - 英語レベルが"超初心者"と"初心者"の場合は日本語で記述
    - 英語レベルが"中級者"と"中上級者"と"上級者"の場合は英語で記述
    - 毎回トピックを変えてください
    トピックのみを返してください。追加の説明、番号付け、引用符は不要です。
  `;

  // Define fallback topics based on English level
  const fallbackTopics: Record<string, string[]> = {
    beginner: [
      '自己紹介を英語で書いてください。',
      '好きな食べ物について英語で説明してください。',
      '休日の過ごし方について英語で書いてください。'
    ],
    intermediate: [
      '今週末に行った活動について英語で説明してください。',
      'あなたの趣味とその理由について英語で説明してください。',
      '最近見た映画や読んだ本について英語で感想を書いてください。'
    ],
    advanced: [
      'グローバル化の利点と課題について英語でエッセイを書いてください。',
      'テクノロジーが教育に与える影響について英語で議論してください。',
      'あなたの職業分野における最新のトレンドについて英語で分析してください。'
    ]
  };

  // Get appropriate fallback topics based on level or use intermediate as default
  const levelFallbacks = fallbackTopics[level.toLowerCase()] || fallbackTopics.intermediate;
  // Select a random fallback topic
  const randomFallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];

  try {
    // Make sure to call AI API in a try/catch block
    const topicText = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 150,
      temperature: 0.7,
      systemPrompt: 'あなたは日本人の英語学習者向けに英作文トピックを生成する英語教師です。学習者のレベルとニーズに合った適切なトピックを日本語で提供してください。'
    });
    
    // Validate and clean the topic
    const cleanedTopic = topicText ? topicText.trim() : '';
    
    if (cleanedTopic.length < 5) {
      console.warn("Generated topic too short, using fallback");
      return randomFallback;
    }
    
    console.log(`Generated topic: ${cleanedTopic.substring(0, 30)}...`);
    return cleanedTopic;
  } catch (error) {
    console.error("Error in generateTopic:", error);
    return randomFallback;
  }
}

// Generate feedback for English writing using DeepSeek AI
async function generateFeedback(
  level: string, 
  topic: string, 
  content: string,
  teacher: string = 'taro'
): Promise<{feedback: string, score: number}> {
  try {
    console.log(`Generating feedback for level: ${level}, teacher: ${teacher}`);
    console.log(`Content length: ${content.length} chars`);
    
    if (!content || content.trim().length < 10) {
      return {
        feedback: "テキストが短すぎるため、フィードバックを生成できません。もう少し長い文章を入力してください。",
        score: 0
      };
    }

    try {
      const feedbackText = await provideWritingFeedback(content, "comprehensive", teacher) || '';
      
      // Extract score from feedback (assuming the AI includes a score in the feedback)
      let score = 70; // Default score
      const scoreMatch = feedbackText.match(/(\d{1,3})\s*点/);
      if (scoreMatch && scoreMatch[1]) {
        const parsedScore = parseInt(scoreMatch[1], 10);
        if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
          score = parsedScore;
        }
      }
      
      return {
        feedback: feedbackText,
        score: score
      };
    } catch (aiError) {
      console.error("AI error in generateFeedback:", aiError);
      return FAKE_FEEDBACK;
    }
  } catch (error) {
    console.error("Error generating feedback:", error);
    return FAKE_FEEDBACK;
  }
}

// Get saved writings or get a new topic
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    if (action === 'topic') {
      try {
        // Get user info to personalize topic
        await connectDB();
        const user = await User.findById(session.user.id);
        
        if (!user) {
          return NextResponse.json(
            { error: 'ユーザーが見つかりません' },
            { status: 404 }
          );
        }
        
        // Check if user has enough points
        if (user.points < POINT_CONSUMPTION.WRITING_ESSAY) {
          return NextResponse.json(
            { 
              error: 'ポイントが不足しています',
              details: `必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}, 現在のポイント: ${user.points}`
            },
            { status: 403 }
          );
        }
        
        // Generate a writing topic
        const topic = await generateTopic(
          user.englishLevel || 'intermediate',
          user.job || '',
          user.goal || ''
        );
        
        if (!topic || topic.trim().length === 0) {
          return NextResponse.json(
            { 
              topic: '今週末に行った活動について英語で説明してください。',
              generated: false,
              message: 'フォールバックトピックを使用しました'
            }
          );
        }
        
        return NextResponse.json({ 
          topic,
          generated: true
        });
      } catch (topicError) {
        console.error("Error in topic generation route:", topicError);
        // Return a fallback topic with a flag indicating it's a fallback
        return NextResponse.json({ 
          topic: '今週末に行った活動について英語で説明してください。',
          generated: false,
          error: 'トピック生成中にエラーが発生しました'
        });
      }
    } else {
      // Get the user's saved writings
      await connectDB();
      const writings = await Writing.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .select('_id topic content feedback score preferredTeacher createdAt')
        .limit(20);
      
      return NextResponse.json(writings);
    }
  } catch (error) {
    console.error('Error in writing GET route:', error);
    let errorMessage = 'リクエストの処理に失敗しました';
    let errorDetails = undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = (error as any).details || undefined;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

// Submit a writing for feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    const { topic, content, preferredTeacher } = await req.json();
    
    if (!topic || !content) {
      return NextResponse.json(
        { error: 'トピックと文章が必要です' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Get user's English level and preferred teacher
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }
    
    // Check and consume points
    const updatedUser = await consumePoints(user._id, POINT_CONSUMPTION.WRITING_ESSAY);
    
    if (!updatedUser) {
      return NextResponse.json(
        { 
          error: 'ポイントが不足しています',
          details: `必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}, 現在のポイント: ${user.points}`
        },
        { status: 403 }
      );
    }
    
    // Get the teacher from request or from user profile
    const teacherToUse = preferredTeacher || user.preferredTeacher || 'taro';
    console.log('Using teacher for feedback:', teacherToUse);
    
    // Generate feedback using the appropriate teacher character
    const { feedback: feedbackText, score } = await generateFeedback(
      user.englishLevel || 'intermediate', 
      topic, 
      content,
      teacherToUse
    );
    
    // Create a new writing entry
    const writingEntry = new Writing({
      userId: session.user.id,
      topic,
      content,
      feedback: feedbackText,
      score,
      preferredTeacher: teacherToUse
    });
    
    await writingEntry.save();
    
    return NextResponse.json({
      _id: writingEntry._id,
      feedback: feedbackText,
      score,
      preferredTeacher: teacherToUse
    });
  } catch (error) {
    console.error('Error in writing POST route:', error);
    let errorMessage = 'リクエストの処理に失敗しました';
    let errorDetails = undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = (error as any).details || undefined;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}