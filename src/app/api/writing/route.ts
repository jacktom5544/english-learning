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

// Define the status type for writing entries
type WritingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Use predefined fake responses when API is not available
const FAKE_TOPIC = 'The importance of time management in modern life.';
const FAKE_FEEDBACK = {
  feedback: "申し訳ありません。現在フィードバック生成システムにアクセスできません。後ほど再度お試しください。"
};

// Restore generateTopic function definition
async function generateTopic(level: string, job: string, goal: string): Promise<string> {
  try {
    // Basic prompt to generate a topic
    const userContext = `
      - 学習者の英語レベル: ${level || '中級'}
      - 学習者の職業: ${job || '（未指定）'}
      - 学習者の学習目標: ${goal || '日常英会話の上達'}
    `;
    
    const prompt = `
      あなたは英語学習者向けの個別英作文トピックを作成する専門家です。
      以下の情報を持つ日本人英語学習者に合った英作文のトピックを1つだけ提案してください。
      
      ${userContext}
      
      条件:
      - 自然で現実的な場面を想像しやすいものにする
      - 学習者の英語レベルと関心に合わせる
      - 200〜400単語の短い英作文で十分な内容
      - 一般的すぎない、面白いトピックを選ぶ
      - トピックはシンプルな英文1〜2文程度で表現する
      - 箇条書きや詳細な説明は不要、トピックだけを簡潔に返す
      - 複数の選択肢を出さず、最適なトピック1つだけを返す
    `;
    
    // Call the AI service to generate a topic
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
        maxTokens: 100,
        temperature: 0.7,
        systemPrompt: 'You are a helpful assistant specialized in creating appropriate English writing topics for Japanese learners.'
    });
    
    // Clean up the response - remove any markdown formatting, quotation marks, or extra text
    let cleanedTopic = response.replace(/^[\s"'`]*|[\s"'`]*$/g, '');  // Remove quotes and whitespace at start/end
    cleanedTopic = cleanedTopic.split('\n')[0]; // Just take the first line to avoid explanations
    
    // Ensure topic doesn't exceed reasonable length
    if (cleanedTopic.length > 300) {
        cleanedTopic = cleanedTopic.substring(0, 300);
    }
    
    return cleanedTopic;
  } catch (error) {
    console.error("Error generating topic:", error);
    return FAKE_TOPIC;
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
    feedback: string | null; // Feedback can be null initially
    status: WritingStatus;   // Add status field
    preferredTeacher: string;
    createdAt: Date;
    updatedAt: Date; 
}>;

interface NewWritingData {
    userId: ObjectId;
    topic: string;
    content: string;
    feedback: string | null; // Feedback can be null initially
    status: WritingStatus;   // Add status field
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
                .project({ _id: 1, topic: 1, content: 1, feedback: 1, preferredTeacher: 1, createdAt: 1, status: 1 })
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
        const userId = new ObjectId(session.user.id); 

        // Remove skipPointsConsumption from destructured body
        const { topic, content, preferredTeacher } = await req.json();

        if (!topic || !content) {
            return NextResponse.json({ error: 'トピックと内容は必須です' }, { status: 400 });
        }
        if (content.length > 5000) { 
             return NextResponse.json({ error: 'Content is too long (max 5000 chars).' }, { status: 400 });
        }

        // Get DB client and cast to Db
        const { db: _db } = await getClient();
        const db = _db as Db;
        const usersCollection = db.collection<UserDoc>('users');
        const writingsCollection = db.collection<WritingDoc>('writings');

        // Fetch user BEFORE consuming points to get current points for potential error message
        const user = await usersCollection.findOne({ _id: userId });
        if (!user) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
        }
        const currentPointsBeforeConsumption = user.points ?? 0;

        // --- Consume points --- 
        // Always attempt to consume points for feedback generation
        try {
            const updatedUserMongooseDoc = await consumePoints(session.user.id, POINT_CONSUMPTION.WRITING_ESSAY);
            if (!updatedUserMongooseDoc) {
                // If consumePoints returns null, it means insufficient points
                return NextResponse.json({ error: 'ポイントが不足しています', currentPoints: currentPointsBeforeConsumption }, { status: 403 });
            }
        } catch (pointError: any) {
             console.error('Error consuming points:', pointError);
             // Return a specific error for point consumption failure
             return NextResponse.json({ error: 'ポイントの消費処理中にエラーが発生しました。' }, { status: 500 });
        }
        // ----------------------

        // Determine teacher key to use, default to 'taro'
        const teacherKeyToUse = (preferredTeacher || user.preferredTeacher || 'taro') as JapaneseTeacherKey;

        // Get Persona Prompt
        const teacherProfile = JAPANESE_TEACHER_PROFILES[teacherKeyToUse];
        const personaPrompt = teacherProfile?.writingFeedbackPersonaPrompt || 
                              JAPANESE_TEACHER_PROFILES.taro.writingFeedbackPersonaPrompt; 
        if (!teacherProfile) {
            console.warn(`Teacher profile not found for key: ${teacherKeyToUse}, falling back to taro's persona.`);
        }

        // Create Initial Writing Entry with PENDING status
        const newWritingData: NewWritingData = {
            userId: userId, 
            topic: topic,
            content: content,
            feedback: null,  // Initialize with null
            status: 'pending', // Set initial status
            preferredTeacher: teacherKeyToUse, 
            createdAt: new Date(),
            updatedAt: new Date() 
        };

        // Insert the initial entry
        const insertResult = await writingsCollection.insertOne(newWritingData as OptionalUnlessRequiredId<WritingDoc>);

        if (!insertResult.insertedId) {
            console.error("Failed to insert writing document for user:", userId);
            // Attempt to refund points if insertion fails? Complex, maybe handle later.
            return NextResponse.json({ error: 'ライティング履歴の保存に失敗しました' }, { status: 500 });
        }

        const writingId = insertResult.insertedId.toString();

        // Return 202 Accepted immediately
        // For production, this would trigger a background task
        // But for MVP/simplicity, we'll continue processing in this request
        // Just returning early to the client to avoid timeout
        const responseJson = { 
            message: "Feedback request accepted and is being processed.",
            writingId: writingId,
            status: 'pending' 
        };
        
        // Send immediate response (this is key to avoiding timeout)
        const response = NextResponse.json(responseJson, { status: 202 });

        // IMPORTANT: We continue processing after sending the response
        // This is a simplified approach - for production, this should be moved to a separate worker

        // Start feedback generation process in background (after response sent)
        try {
            console.log(`Starting feedback generation for writing ID: ${writingId}`);
            
            // Update status to 'processing'
            await writingsCollection.updateOne(
                { _id: insertResult.insertedId },
                { $set: { status: 'processing', updatedAt: new Date() } }
            );
            
            // Get teacher persona
            const teacherProfile = JAPANESE_TEACHER_PROFILES[teacherKeyToUse];
            const personaPrompt = teacherProfile?.writingFeedbackPersonaPrompt || 
                                JAPANESE_TEACHER_PROFILES.taro.writingFeedbackPersonaPrompt;
            
            // Generate feedback
            const feedbackText = await generateFeedback(
                user.englishLevel || 'intermediate',
                topic,
                content,
                teacherKeyToUse,
                personaPrompt
            );
            
            // Update document with feedback and set status to 'completed'
            await writingsCollection.updateOne(
                { _id: insertResult.insertedId },
                { 
                    $set: { 
                        feedback: feedbackText,
                        status: 'completed',
                        updatedAt: new Date() 
                    } 
                }
            );
            
            console.log(`Completed feedback generation for writing ID: ${writingId}`);
        } catch (feedbackError) {
            console.error(`Error generating feedback for writing ID: ${writingId}:`, feedbackError);
            
            // Set status to 'failed' if feedback generation fails
            try {
                await writingsCollection.updateOne(
                    { _id: insertResult.insertedId },
                    { $set: { status: 'failed', updatedAt: new Date() } }
                );
            } catch (updateError) {
                console.error(`Failed to update status to 'failed' for writing ID: ${writingId}:`, updateError);
            }
        }

        // Return the initial response
        return response;

    } catch (error) {
        console.error('Error in writing POST route:', error);
        let errorMessage = 'リクエストの処理に失敗しました';
        if (error instanceof Error) errorMessage = error.message;
         if (error instanceof Error && error.name === 'MongoTimeoutError') {
             errorMessage = 'Database operation timed out processing writing data.';
             return NextResponse.json({ error: errorMessage }, { status: 504 });
         }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}