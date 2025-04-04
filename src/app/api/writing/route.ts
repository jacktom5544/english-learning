import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// Remove Mongoose models
// import User from '@/models/User';
// import Writing from '@/models/Writing';
// Import MongoDB client and types
import getClient from '@/lib/db'; 
// Import Db type from mongodb
import { ObjectId, WithId, Db, OptionalUnlessRequiredId, Document } from 'mongodb';
import { IUser } from '@/models/User'; // Keep IUser interface
// Keep IWriting for reference if needed, but don't use for native insert object type
// import { IWriting } from '@/models/Writing'; 
// AI and utils imports remain
import { generateAIResponse, provideWritingFeedback } from '@/lib/ai'; 
import { consumePoints } from '@/lib/serverUtils'; // Keep consumePoints for now
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
// Remove unused TeacherType import
// import { TeacherType } from '@/lib/teachers'; 
// Use JapaneseTeacherKey from japanese-teachers
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';

// Use predefined fake responses when API is not available
const FAKE_TOPIC = '今週末に行った活動について英語で説明してください。';
const FAKE_FEEDBACK = {
  feedback: "申し訳ございませんが、AIサービスが現在応答できません。後ほど再度お試しください。",
  score: 50
};

// Restore generateTopic function definition
async function generateTopic(level: string, job: string, goal: string): Promise<string> {
  console.log(`Generating topic for level: ${level}`);
  
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

  const levelFallbacks = fallbackTopics[level.toLowerCase()] || fallbackTopics.intermediate;
  const randomFallback = levelFallbacks[Math.floor(Math.random() * levelFallbacks.length)];

  try {
    const topicText = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 150,
      temperature: 0.7,
      systemPrompt: 'あなたは日本人の英語学習者向けに英作文トピックを生成する英語教師です。学習者のレベルとニーズに合った適切なトピックを日本語で提供してください。'
    });
    
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

// Modify generateFeedback wrapper function to accept personaPrompt
async function generateFeedback(
  level: string, 
  topic: string, 
  content: string,
  teacherKey: JapaneseTeacherKey, // Use JapaneseTeacherKey type
  personaPrompt: string // Add personaPrompt parameter
): Promise<string> { 
  try {
    console.log(`Requesting feedback generation for topic: ${topic.substring(0, 30)}... as teacher: ${teacherKey}`);
    // Pass personaPrompt to the underlying AI function
    const feedbackText = await provideWritingFeedback(topic, content, teacherKey, personaPrompt); 
    return feedbackText;
  } catch (error) {
    console.error("Error generating feedback in wrapper:", error);
    return FAKE_FEEDBACK.feedback; 
  }
}

// Define types for DB documents - Remove score
type UserDoc = WithId<Document> & Partial<IUser>;
type WritingDoc = WithId<{ 
    userId: ObjectId;
    topic: string;
    content: string;
    feedback: string;
    // score: number; // Removed score
    preferredTeacher: string;
    createdAt: Date;
    updatedAt: Date; 
}>;

interface NewWritingData {
    userId: ObjectId;
    topic: string;
    content: string;
    feedback: string;
    // score: number; // Removed score
    preferredTeacher: string;
    createdAt: Date; 
    updatedAt: Date; 
}

// GET handler - Refactored
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
        }

        const userId = new ObjectId(session.user.id); // Convert ID upfront

        const url = new URL(req.url);
        const action = url.searchParams.get('action');

        // Get DB client and cast to Db
        const { db: _db } = await getClient(); 
        const db = _db as Db;

        if (action === 'topic') {
            try {
                const skipPointsConsumption = url.searchParams.get('skipPointsConsumption') === 'true';

                // Fetch user using native driver
                const usersCollection = db.collection<UserDoc>('users');
                const user = await usersCollection.findOne({ _id: userId });

                if (!user) {
                    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
                }

                // Check points (use user.points directly)
                if (!skipPointsConsumption && (user.points ?? 0) < POINT_CONSUMPTION.WRITING_ESSAY) {
                    return NextResponse.json(
                        { error: 'ポイントが不足しています', details: `必要なポイント: ${POINT_CONSUMPTION.WRITING_ESSAY}, 現在のポイント: ${user.points ?? 0}` },
                        { status: 403 }
                    );
                }

                // Generate topic (logic remains same)
                const topic = await generateTopic(
                    user.englishLevel || 'intermediate',
                    user.job || '',
                    user.goal || ''
                );

                if (!topic || topic.trim().length === 0) {
                    return NextResponse.json({ topic: FAKE_TOPIC, generated: false, message: 'フォールバックトピックを使用しました' });
                }
                return NextResponse.json({ topic, generated: true });

            } catch (topicError) {
                console.error("Error in topic generation route:", topicError);
                return NextResponse.json({ topic: FAKE_TOPIC, generated: false, error: 'トピック生成中にエラーが発生しました' });
            }
        } else {
            // Get writing history using native driver
            const writingsCollection = db.collection<WritingDoc>('writings'); // Assuming collection name is 'writings'
            const writings = await writingsCollection
                .find({ userId: userId }) // Use ObjectId
                .sort({ createdAt: -1 })
                // Remove score from projection
                .project({ _id: 1, topic: 1, content: 1, feedback: 1, preferredTeacher: 1, createdAt: 1 })
                .limit(20)
                .toArray(); // Convert cursor to array

             // Convert _id to string for each document before sending response
             const writingsWithStringIds = writings.map(w => ({
                 ...w,
                 _id: w._id.toString(),
                 userId: w.userId?.toString() // Also convert userId if present and needed
             }));

            return NextResponse.json(writingsWithStringIds);
        }
    } catch (error) {
        console.error('Error in writing GET route:', error);
        let errorMessage = 'リクエストの処理に失敗しました';
        if (error instanceof Error) errorMessage = error.message;
        // Handle specific errors like timeouts if needed
         if (error instanceof Error && error.name === 'MongoTimeoutError') {
             errorMessage = 'Database operation timed out fetching writing data.';
             return NextResponse.json({ error: errorMessage }, { status: 504 }); // Gateway Timeout
         }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// POST handler - Refactored
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
        }
        const userId = new ObjectId(session.user.id); // Convert ID upfront

        const { topic, content, preferredTeacher, skipPointsConsumption } = await req.json();

        if (!topic || !content) {
            return NextResponse.json({ error: 'トピックと内容は必須です' }, { status: 400 });
        }
        if (content.length > 5000) { // Example length limit
             return NextResponse.json({ error: 'Content is too long (max 5000 chars).' }, { status: 400 });
        }

        // Get DB client and cast to Db
        const { db: _db } = await getClient();
        const db = _db as Db;
        const usersCollection = db.collection<UserDoc>('users');
        // Use WritingDoc type for the collection definition
        const writingsCollection = db.collection<WritingDoc>('writings');

        // Fetch user using native driver to get level and check points
        const user = await usersCollection.findOne({ _id: userId });
        if (!user) {
            // This handles the 'users.findOne() buffering timed out' error source
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
        }

        // Consume points - Use correct key
         if (!skipPointsConsumption) {
             // Use WRITING_ESSAY key
             const updatedUserMongooseDoc = await consumePoints(session.user.id, POINT_CONSUMPTION.WRITING_ESSAY);
             if (!updatedUserMongooseDoc) {
                 return NextResponse.json({ error: 'ポイントが不足しています', currentPoints: user.points ?? 0 }, { status: 403 });
             }
             // Optionally update local user points representation if needed, but not strictly necessary here
         }

        // Determine teacher key to use, default to 'taro'
        const teacherKeyToUse = (preferredTeacher || user.preferredTeacher || 'taro') as JapaneseTeacherKey;

        // --- Get Persona Prompt --- 
        // Retrieve the persona prompt for the selected teacher
        const teacherProfile = JAPANESE_TEACHER_PROFILES[teacherKeyToUse];
        const personaPrompt = teacherProfile?.writingFeedbackPersonaPrompt || 
                              JAPANESE_TEACHER_PROFILES.taro.writingFeedbackPersonaPrompt; // Fallback to taro's prompt
        
        if (!teacherProfile) {
            console.warn(`Teacher profile not found for key: ${teacherKeyToUse}, falling back to taro's persona.`);
        }
        // ------------------------- 

        // Generate feedback - Pass personaPrompt
        const feedbackText = await generateFeedback( 
            user.englishLevel || 'intermediate', 
            topic,
            content,
            teacherKeyToUse,
            personaPrompt // Pass the retrieved persona prompt
        );

        // Create new writing entry
        const newWritingData: NewWritingData = {
            userId: userId, 
            topic: topic,
            content: content,
            feedback: feedbackText, 
            preferredTeacher: teacherKeyToUse, 
            createdAt: new Date(),
            updatedAt: new Date() 
        };

        // Insert the writing entry
        const insertResult = await writingsCollection.insertOne(newWritingData as OptionalUnlessRequiredId<WritingDoc>); 

        if (!insertResult.insertedId) {
            console.error("Failed to insert new writing document for user:", userId);
            return NextResponse.json({ error: 'ライティング履歴の保存に失敗しました' }, { status: 500 });
        }

        // Fetch the newly created document to return it
         const createdWritingDoc = await writingsCollection.findOne({ _id: insertResult.insertedId });

         if (!createdWritingDoc) {
             console.error("Could not retrieve created writing document with ID:", insertResult.insertedId);
             return NextResponse.json({ error: '作成されたライティングエントリの取得に失敗しました' }, { status: 500 });
         }

         // Return the created document, converting _id to string
         return NextResponse.json({
             ...createdWritingDoc,
             _id: createdWritingDoc._id.toString(),
             userId: createdWritingDoc.userId?.toString()
         });

    } catch (error) {
        console.error('Error in writing POST route:', error);
        let errorMessage = 'リクエストの処理に失敗しました';
        if (error instanceof Error) errorMessage = error.message;
        // Handle specific errors
         if (error instanceof Error && error.name === 'MongoTimeoutError') {
             errorMessage = 'Database operation timed out saving writing data.';
             return NextResponse.json({ error: errorMessage }, { status: 504 });
         }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}