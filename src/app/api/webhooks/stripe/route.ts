import { NextRequest, NextResponse } from 'next/server';
import { stripe, handleSuccessfulSubscription, handleSubscriptionUpdated } from '@/lib/stripe';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { INITIAL_POINTS } from '@/lib/pointSystem';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    await connectToDatabase();

    switch (event.type) {
      // Handle checkout session completed event
      case 'checkout.session.completed':
        const checkoutData = await handleSuccessfulSubscription(event);
        
        // Update user subscription status to active and give them initial points
        const updatedUser = await User.findByIdAndUpdate(
          checkoutData.userId,
          {
            subscriptionStatus: 'active',
            $inc: { points: INITIAL_POINTS },
            pointsLastUpdated: new Date(),
          },
          { new: true }
        );

        console.log('User subscription activated:', {
          userId: checkoutData.userId,
          subscriptionId: checkoutData.subscriptionId,
          points: updatedUser?.points,
        });
        break;

      // Handle subscription updated event
      case 'customer.subscription.updated':
        const updateData = await handleSubscriptionUpdated(event);
        
        const user = await User.findByIdAndUpdate(
          updateData.userId,
          { subscriptionStatus: updateData.status },
          { new: true }
        );

        console.log('User subscription updated:', {
          userId: updateData.userId,
          status: updateData.status,
        });
        break;

      // Handle subscription deleted event
      case 'customer.subscription.deleted':
        const deleteData = await handleSubscriptionUpdated(event);
        
        await User.findByIdAndUpdate(
          deleteData.userId,
          { subscriptionStatus: 'cancelled' },
          { new: true }
        );

        console.log('User subscription cancelled:', {
          userId: deleteData.userId,
        });
        break;

      // Handle invoice payment succeeded event (recurring payments)
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as any;
        const invoiceSubscriptionId = invoice.subscription;
        
        if (invoiceSubscriptionId && invoice.billing_reason === 'subscription_cycle') {
          // This is a recurring payment
          // Find the checkout session to get the userId
          const sessions = await stripe.checkout.sessions.list({
            limit: 100,
            subscription: invoiceSubscriptionId,
          });
          
          const session = sessions.data.find(s => s.subscription === invoiceSubscriptionId);
          
          if (session && session.metadata?.userId) {
            // Add monthly points to the user
            await User.findByIdAndUpdate(
              session.metadata.userId,
              {
                subscriptionStatus: 'active',
                $inc: { points: INITIAL_POINTS },
                pointsLastUpdated: new Date(),
              },
              { new: true }
            );

            console.log('Monthly subscription renewed, points added:', {
              userId: session.metadata.userId,
              pointsAdded: INITIAL_POINTS,
            });
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
} 