import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }
    
    // Create a checkout session
    const { sessionId, url } = await createCheckoutSession({
      userId: session.user.id,
      email: session.user.email as string,
    });
    
    return NextResponse.json({ sessionId, url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'チェックアウトセッション作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 