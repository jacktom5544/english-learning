import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }
    
    // Get the session ID from the query parameters
    const sessionId = req.nextUrl.searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'セッションIDが提供されていません' },
        { status: 400 }
      );
    }
    
    // Retrieve the Stripe session to verify it exists and is complete
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!stripeSession || stripeSession.status !== 'complete') {
      return NextResponse.json(
        { error: 'サブスクリプションセッションが完了していません' },
        { status: 400 }
      );
    }
    
    // Verify that the user ID in the session metadata matches the current user
    if (stripeSession.metadata?.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'セッションはこのユーザーに紐付けられていません' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying subscription session:', error);
    return NextResponse.json(
      { error: 'サブスクリプションセッションの検証中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 