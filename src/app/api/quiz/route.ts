import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import Quiz from '@/models/Quiz';
import connectDB from '@/lib/db';
import { generateEnglishQuiz } from '@/lib/ai';

// Generate a quiz for the user
export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/quiz: Generating quiz');
    const session = await getServerSession(authOptions);
    
    console.log('POST /api/quiz: Session data:', session);
    
    if (!session?.user?.id) {
      console.log('POST /api/quiz: No session user ID');
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }
    
    console.log('POST /api/quiz: Connecting to database');
    await connectDB();
    
    // Get user's profile to customize the quiz
    const user = await User.findById(session.user.id);
    
    if (!user) {
      console.log('POST /api/quiz: User not found');
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    console.log('POST /api/quiz: User found, generating questions');
    
    try {
      // Get request data if any
      const data = await req.json().catch(() => ({}));
      
      // Get user info
      const level = data.englishLevel || user.englishLevel || 'intermediate';
      const job = data.job || user.job || '';
      const goal = data.goal || user.goal || '';
      
      console.log(`Generating quiz for level: ${level}, job: ${job}`);
      
      // Generate topic based on job and goal
      let topic = "一般的な英語";
      if (job) {
        topic = `${job}に関連する英語`;
      }
      if (goal) {
        topic += `（目標: ${goal}）`;
      }
      
      // Generate quiz using DeepSeek AI
      const quizContent = await generateEnglishQuiz(topic, level) || '';
      
      console.log('Quiz content generated successfully');
      
      // Parse quiz content to extract questions
      // This is a simple parser - you might need to adjust based on AI output
      let questions;
      try {
        // Attempt to extract JSON if the AI outputs JSON
        const jsonMatch = quizContent.match(/```json([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          questions = JSON.parse(jsonMatch[1].trim());
        } else {
          // Simple parsing logic - extract question-answer pairs
          // This is just a placeholder - implement proper parsing based on actual output
          questions = extractQuestionsFromText(quizContent);
        }
        
        if (!questions || !Array.isArray(questions)) {
          throw new Error('Invalid quiz format');
        }
      } catch (parseError) {
        console.error('Failed to parse quiz content:', parseError);
        // Fallback to simple questions
        questions = [
          {
            question: "Patient",
            choices: ["書類", "患者", "手術", "看護師"],
            correctIndex: 1,
            explanation: "患者さんは\"Patient\"と呼びます。病院でとてもよく使う単語です。"
          }
        ];
      }
      
      // Create quiz record in database
      const quiz = new Quiz({
        userId: session.user.id,
        questions,
        level,
        createdAt: new Date(),
        completed: false,
        score: 0,
      });
      
      await quiz.save();
      console.log('Quiz saved to database with ID:', quiz._id);
      
      // Return the created quiz with its ID
      return NextResponse.json({
        _id: quiz._id,
        questions: quiz.questions,
        level: quiz.level,
      });
      
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      return NextResponse.json(
        { error: `クイズの生成に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in quiz generation:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// Simple function to extract questions from text
function extractQuestionsFromText(text: string) {
  // This is a placeholder - implement proper parsing
  // For now, returning a simple default question
  return [
    {
      question: "Example",
      choices: ["例", "サンプル", "模範", "見本"],
      correctIndex: 0,
      explanation: "「Example」は「例」という意味です。"
    }
  ];
}

// Get all quizzes for the current user
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
    
    // Get the user's quizzes, newest first
    const quizzes = await Quiz.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(20); // Get last 20 quizzes
    
    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return NextResponse.json(
      { error: 'クイズの取得に失敗しました' },
      { status: 500 }
    );
  }
} 