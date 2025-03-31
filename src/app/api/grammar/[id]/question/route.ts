import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import Grammar from '@/models/Grammar';
import User from '@/models/User';
import deepseek from '@/lib/deepseek';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, conversation } = await req.json();
    
    await connectToDB();
    
    // Get user profile for preferred teacher
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.GRAMMAR_CHECK) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }

    // Find the grammar entry
    const grammarEntry = await Grammar.findById(params.id);
    if (!grammarEntry) {
      return NextResponse.json({ error: 'Grammar entry not found' }, { status: 404 });
    }

    // Get teacher's response based on preferred teacher
    const teacherResponse = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: `You are an English teacher named ${user.preferredTeacher || 'taro'}.
                   The student is asking a question about grammar concepts after you provided feedback on their writing. 
                   
                   Teacher personalities:
                   - taro: Polite, formal Japanese teacher who uses です/ます style
                   - hiroshi: Casual Kansai dialect teacher who uses だ/や style
                   - reiko: Very polite, formal female teacher who uses です/ます and わ/わよ endings
                   - iwao: Rough, direct teacher who uses command form and masculine speech
                   
                   Use the appropriate speaking style for the character.
                   
                   Previous conversation: ${JSON.stringify(conversation)}` 
        },
        { 
          role: 'user', 
          content: question
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const response = teacherResponse.choices[0].message.content || '';
    
    // Update the grammar entry with the new conversation
    grammarEntry.conversation.push({
      sender: 'user',
      content: question,
      timestamp: new Date()
    });
    
    grammarEntry.conversation.push({
      sender: 'teacher',
      content: response,
      timestamp: new Date()
    });
    
    await grammarEntry.save();
    
    // Deduct points
    user.points -= POINT_CONSUMPTION.GRAMMAR_CHECK;
    await user.save();

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error processing grammar question:', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
} 