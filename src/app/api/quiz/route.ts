import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import Quiz from '@/models/Quiz';
import Vocabulary from '@/models/Vocabulary';
import connectDB from '@/lib/db';
import { generateEnglishQuiz } from '@/lib/ai';

// Generate a quiz for the user
export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/quiz: Generating quiz');
    const session = await getServerSession(authOptions);
    
    // Sanitize session log - don't log user details
    console.log('POST /api/quiz: Session authenticated:', !!session?.user?.id);
    
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
      const count = data.count || 10; // Default to 10 questions, but allow up to 20
      
      console.log(`Generating quiz for level: ${level}, job: ${job}, count: ${count}`);
      
      // Get previously seen vocabulary words for this user to avoid repetition
      const previousVocabularies = await Vocabulary.find({ userId: session.user.id }, 'word').lean();
      const previousWords = previousVocabularies.map(v => v.word.toLowerCase());
      
      console.log(`Found ${previousWords.length} previous vocabulary words for this user`);
      
      // Generate topic based on job and goal
      let topic = "一般的な英語";
      if (job) {
        topic = `${job}に関連する英語`;
      }
      if (goal) {
        topic += `（目標: ${goal}）`;
      }
      
      // Generate quiz using DeepSeek AI, including the list of words to exclude
      const quizContent = await generateEnglishQuiz(topic, level, count, previousWords) || '';
      
      console.log('Quiz content generated successfully');
      
      // Parse quiz content to extract questions
      let questions;
      try {
        // Try to parse the response directly as JSON first
        try {
          questions = JSON.parse(quizContent);
          console.log('Successfully parsed quiz content directly as JSON');
        } catch (directParseError) {
          // If direct parsing fails, try to extract JSON from the response
          console.log('Direct parsing failed, trying to extract JSON from text');
          const jsonMatch = quizContent.match(/\[\s*{[\s\S]*}\s*\]/);
          if (jsonMatch && jsonMatch[0]) {
            questions = JSON.parse(jsonMatch[0]);
            console.log('Successfully extracted and parsed JSON from quiz content');
          } else {
            // Try the older ```json format
            const codeBlockMatch = quizContent.match(/```json([\s\S]*?)```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
              questions = JSON.parse(codeBlockMatch[1].trim());
              console.log('Successfully parsed JSON from code block');
            } else {
              throw new Error('Could not extract JSON from quiz content');
            }
          }
        }
        
        // Validate the questions structure and ensure we have the right number
        if (!Array.isArray(questions)) {
          throw new Error('Quiz content is not an array');
        }
        
        // Filter out any questions using previously seen words
        const uniqueQuestions = questions.filter(q => 
          !previousWords.includes(q.question.toLowerCase())
        );
        
        console.log(`Filtered out ${questions.length - uniqueQuestions.length} previously seen words`);
        
        // If we have enough unique questions, use those
        if (uniqueQuestions.length >= count) {
          questions = uniqueQuestions.slice(0, count);
          console.log(`Using ${questions.length} unique questions`);
        } else {
          // If we don't have enough unique questions, use as many as we can
          // and supplement with some of the duplicates if needed
          console.log(`Not enough unique questions (${uniqueQuestions.length}), adding some previously seen words to reach ${count}`);
          
          const neededAdditional = count - uniqueQuestions.length;
          questions = [
            ...uniqueQuestions,
            ...questions
              .filter(q => !uniqueQuestions.includes(q))
              .slice(0, neededAdditional)
          ];
        }
        
        // Make sure we have enough questions by duplicating if necessary
        if (questions.length < count) {
          console.log(`Only ${questions.length} questions generated, duplicating to reach ${count}`);
          const originalQuestions = [...questions];
          while (questions.length < count) {
            // Add a copy of a question, but change it slightly to avoid exact duplicates
            const randomQuestion = originalQuestions[Math.floor(Math.random() * originalQuestions.length)];
            const questionCopy = {
              ...randomQuestion,
              explanation: `${randomQuestion.explanation} (復習問題)`
            };
            questions.push(questionCopy);
          }
        }
        
        // Final validation of each question
        questions.forEach((q, index) => {
          if (!q.question || !Array.isArray(q.choices) || q.correctIndex === undefined || !q.explanation) {
            console.error(`Invalid question format at index ${index}:`, q);
            throw new Error(`質問フォーマットが無効です（インデックス: ${index}）`);
          }
          
          // Ensure we have exactly 5 choices
          while (q.choices.length < 5) {
            q.choices.push(`選択肢${q.choices.length + 1}`);
          }
          if (q.choices.length > 5) {
            q.choices = q.choices.slice(0, 5);
          }
          
          // Ensure correctIndex is valid
          if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) {
            console.warn(`Correcting invalid correctIndex ${q.correctIndex} for question: ${q.question}`);
            q.correctIndex = 0;
          }
        });
        
      } catch (parseError) {
        console.error('Failed to parse quiz content:', parseError);
        console.error('Quiz content was:', quizContent);
        
        // Fallback to simple questions - create the requested number of questions
        questions = [];
        const defaultQuestions = [
          {
            question: "Patient",
            choices: ["書類", "患者", "手術", "看護師", "医療"],
            correctIndex: 1,
            explanation: "患者さんは\"Patient\"と呼びます。病院でとてもよく使う単語です。",
            exampleSentence: "The patient needs to rest after the surgery."
          },
          {
            question: "Example",
            choices: ["例", "サンプル", "模範", "見本", "試し"],
            correctIndex: 0,
            explanation: "「Example」は「例」という意味です。",
            exampleSentence: "Can you give me an example of how to use this word?"
          },
          {
            question: "Implement",
            choices: ["実装する", "輸入する", "改善する", "増加する", "統合する"],
            correctIndex: 0,
            explanation: "「Implement」は「実装する」「実行する」という意味です。",
            exampleSentence: "We need to implement this new feature by next week."
          },
          {
            question: "Efficient",
            choices: ["効率的な", "効果的な", "十分な", "豊富な", "拡張可能な"],
            correctIndex: 0,
            explanation: "「Efficient」は「効率的な」という意味です。",
            exampleSentence: "This is a more efficient way to solve the problem."
          },
          {
            question: "Collaborate",
            choices: ["協力する", "競争する", "交渉する", "計画する", "比較する"],
            correctIndex: 0,
            explanation: "「Collaborate」は「協力する」「共同作業する」という意味です。",
            exampleSentence: "We need to collaborate with the marketing team on this project."
          }
        ];
        
        // Filter default questions against previous words
        const filteredDefault = defaultQuestions.filter(q => 
          !previousWords.includes(q.question.toLowerCase())
        );
        
        const uniqueDefaults = filteredDefault.length > 0 ? filteredDefault : defaultQuestions;
        
        // Create enough questions to match the requested count using the defaults in rotation
        for (let i = 0; i < Math.min(count, 20); i++) {
          const baseQuestion = uniqueDefaults[i % uniqueDefaults.length];
          questions.push({
            ...baseQuestion,
            question: `${baseQuestion.question}${i > 0 ? ` ${i + 1}` : ''}` // Add number suffix to make unique
          });
        }
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