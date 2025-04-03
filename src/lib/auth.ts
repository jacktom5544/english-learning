import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import bcrypt from 'bcrypt';
import { safeLog, safeError, safeWarn } from '@/lib/utils';
import { getNextAuthURL, logEnvironmentStatus, isAmplifyEnvironment } from './env';

// Define subscription status type to match what's used in stripe.ts
type SubscriptionStatus = 'active' | 'cancelled' | 'inactive';

// Log environment variables on module load
if (typeof window === 'undefined') {
  logEnvironmentStatus();
  const url = getNextAuthURL();
  safeLog('[auth.ts] Auth module loaded with NEXTAUTH_URL:', url);
  // Explicitly log the secret status *before* using it
  safeLog('[auth.ts] Checking NEXTAUTH_SECRET status:', process.env.NEXTAUTH_SECRET ? 'Defined' : '*** MISSING ***');
}

// Extend the built-in session types
declare module "next-auth" {
  // Define the shared properties with the same modifiers for User, Session.user, and JWT
  interface BaseUserInfo {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    points?: number;
    subscriptionStatus?: SubscriptionStatus;
  }

  interface User extends BaseUserInfo {
    // Any additional User-specific properties can go here
  }
  
  interface Session {
    user: BaseUserInfo & {
      // Any additional session user-specific properties can go here
    }
  }
}

// Extend JWT type
declare module "next-auth/jwt" {
  // Define JWT interface with consistent properties
  interface JWT {
    id: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    role?: string;
    points?: number;
    subscriptionStatus?: 'active' | 'cancelled' | 'inactive';
  }
}

// Define the shape of the User object
interface UserData {
  id: string;
  name: string;
  email: string;
  role?: string;
  points?: number;
  subscriptionStatus?: string;
}

// Type casting helper to ensure correct type
function ensureSubscriptionStatus(status: string | undefined): SubscriptionStatus {
  if (status === 'active' || status === 'cancelled' || status === 'inactive') {
    return status;
  }
  return 'inactive'; // Default fallback
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          safeLog('[authorize] Missing credentials');
          throw new Error('メールアドレスとパスワードを入力してください');
        }

        try {
          // Use the updated MongoDB connection method
          const { db } = await connectToDatabase();
          const usersCollection = db.collection('users');
          
          // Find user
          const user = await usersCollection.findOne({ email: credentials.email });
          
          if (!user) {
            safeLog('[authorize] User not found');
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }

          // Check password
          const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
          
          if (!isPasswordCorrect) {
            safeLog('[authorize] Invalid password');
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }

          safeLog('[authorize] User authenticated successfully', {
            id: user._id.toString(),
            email: user.email,
            role: user.role || 'user'
          });
          
          return {
            id: user._id.toString(),
            name: user.username || user.name || 'User',
            email: user.email,
            role: user.role || 'user',
            points: user.points || 0,
            subscriptionStatus: user.subscriptionStatus || 'inactive'
          };
        } catch (error) {
          safeError('[authorize] Authentication error', error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('認証中にエラーが発生しました');
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        safeLog('[jwt callback] Updating token with user data', {
          id: user.id,
          role: user.role
        });
        
        token.id = user.id;
        token.role = user.role as string;
        token.points = user.points as number;
        token.subscriptionStatus = ensureSubscriptionStatus(user.subscriptionStatus as string);
      }
      
      // Update token when session is updated
      if (trigger === 'update' && session) {
        safeLog('[jwt callback] Updating token from session update', {
          points: session.points,
          role: session.role
        });
        
        if (session.points !== undefined) {
          token.points = session.points as number;
        }
        if (session.role) {
          token.role = session.role as string;
        }
        if (session.subscriptionStatus) {
          token.subscriptionStatus = ensureSubscriptionStatus(session.subscriptionStatus as string);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        safeLog('[session callback] Setting session user data from token', {
          id: token.id,
          role: token.role
        });
        
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.points = token.points as number;
        session.user.subscriptionStatus = token.subscriptionStatus as SubscriptionStatus;
      }
      return session;
    },
  },
  // Read the secret DIRECTLY here and perform check
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      // Log error specifically when the option is being constructed
      safeError('[authOptions] CRITICAL ERROR: process.env.NEXTAUTH_SECRET is missing when authOptions is constructed!');
      if (process.env.NODE_ENV === 'production') {
        // Return empty string to let NextAuth handle the error
        return ''; 
      } else {
        // Fallback for non-production (should ideally still be set via .env)
        safeWarn('[authOptions] NEXTAUTH_SECRET missing in non-production, using default.');
        return 'development-secret'; // Provide a default for local dev if needed
      }
    }
    // Log success if secret is found here (optional)
    // safeLog('[authOptions] NEXTAUTH_SECRET found and used.');
    return secret;
  })(), // Immediately invoke the function to get the secret

  debug: process.env.NODE_ENV !== 'production',

  // Restore recommended cookie settings, try sameSite: 'none'
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: { 
        httpOnly: true,       
        sameSite: 'none',
        path: '/',            
        secure: true,
        // domain: Optional
      }
    },
    // You might need to configure other cookies if defaults cause issues, but start with sessionToken
    // callbackUrl: { name: `next-auth.callback-url`, options: { sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' }},
    // csrfToken: { name: `next-auth.csrf-token`, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' }},
  },

  logger: {
    error(code, metadata) {
      safeError(`[NextAuth] Error: ${code}`, metadata);
    },
    warn(code) {
      safeLog(`[NextAuth] Warning: ${code}`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== 'production') {
        safeLog(`[NextAuth] Debug: ${code}`, metadata);
      }
    },
  },
}; 