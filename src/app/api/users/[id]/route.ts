import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import getClient, { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }
    
    const token = await getToken({ req: request });
    
    if (!token || token.id !== id) {
      return NextResponse.json(
        { error: '認証エラー' },
        { status: 401 }
      );
    }

    const client = await getClient();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }
    
    // Ensure _id is serialized as a string
    user._id = user._id.toString();

    // Return user data directly (matching frontend expectation)
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }
    
    const token = await getToken({ req: request });
    
    if (!token || token.id !== id) {
      return NextResponse.json(
        { error: '認証エラー' },
        { status: 401 }
      );
    }

    const requestBody = await request.json();
    const { name, englishLevel, job, goal, preferredTeacher, image, startReason, struggles } = requestBody;

    if (!name) {
      return NextResponse.json(
        { error: 'ニックネームは必須です' },
        { status: 400 }
      );
    }

    const client = await getClient();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const updateData: { $set: Record<string, any> } = { $set: {} };
    if (name !== undefined) updateData.$set.name = name;
    if (englishLevel !== undefined) updateData.$set.englishLevel = englishLevel;
    if (job !== undefined) updateData.$set.job = job;
    if (goal !== undefined) updateData.$set.goal = goal;
    if (preferredTeacher !== undefined) updateData.$set.preferredTeacher = preferredTeacher;
    if (image !== undefined) updateData.$set.image = image;
    if (startReason !== undefined) updateData.$set.startReason = startReason;
    if (struggles !== undefined) updateData.$set.struggles = struggles;

    if (Object.keys(updateData.$set).length === 0) {
        return NextResponse.json(
            { error: 'No update fields provided beyond the required name' },
            { status: 400 }
        );
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      updateData
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    const updatedUser = await usersCollection.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0 } }
    );

    if (!updatedUser) { 
        console.error(`Failed to fetch user ${id} after update, despite matchedCount=1.`);
        return NextResponse.json({ error: '更新後のユーザーデータの取得に失敗しました' }, { status: 500 });
    }

    const message = result.modifiedCount > 0 ? 'プロフィールが更新されました' : 'プロフィールは既に最新です';
    
    // Ensure _id is serialized as a string
    updatedUser._id = updatedUser._id.toString();

    return NextResponse.json({
      message: message,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error && error.name === 'MongoServerError') {
         console.error('MongoDB Server Error during user update:', error);
         return NextResponse.json({ error: 'データベースの更新中にエラーが発生しました' }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}