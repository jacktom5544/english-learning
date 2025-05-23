import Stripe from 'stripe';

// Initialize Stripe with the secret key from environment variables
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia', // Use the latest stable API version
  typescript: true,
});

// Product ID for the monthly subscription plan
export const MONTHLY_SUBSCRIPTION_PRODUCT_ID = 'prod_S2iTfkHeuKItG2';

// Function to create a checkout session for subscription
export async function createCheckoutSession({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    client_reference_id: userId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product: MONTHLY_SUBSCRIPTION_PRODUCT_ID,
          recurring: {
            interval: 'month',
          },
          unit_amount: 2000, // ¥2,000
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXTAUTH_URL}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/subscribe/cancel`,
    metadata: {
      userId,
    },
  });

  return { sessionId: session.id, url: session.url };
}

// Function to handle successful subscription
export async function handleSuccessfulSubscription(
  event: Stripe.Event
): Promise<{ userId: string; subscriptionId: string }> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const subscriptionId = session.subscription as string;

  if (!userId || !subscriptionId) {
    throw new Error('Missing userId or subscriptionId in webhook event');
  }

  return { userId, subscriptionId };
}

// Function to handle subscription updates
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<{ 
  userId: string; 
  subscriptionId: string;
  status: 'active' | 'cancelled' | 'inactive';
}> {
  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;
  
  // Find the checkout session that created this subscription to get the userId
  const sessions = await stripe.checkout.sessions.list({
    limit: 100,
    subscription: subscriptionId,
  });
  
  const session = sessions.data.find(s => s.subscription === subscriptionId);
  
  if (!session || !session.metadata?.userId) {
    throw new Error('Could not find userId for subscription');
  }
  
  // Determine subscription status
  let status: 'active' | 'cancelled' | 'inactive' = 'inactive';
  
  if (subscription.status === 'active') {
    status = 'active';
  } else if (subscription.status === 'canceled') {
    status = 'cancelled';
  }
  
  return { 
    userId: session.metadata.userId,
    subscriptionId,
    status,
  };
} 