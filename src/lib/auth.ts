import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { safeLog, safeError } from './utils';

// Define subscription status type to match what's used in stripe.ts
type SubscriptionStatus = 'active' | 'cancelled' | 'inactive';

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    points: number;
    subscriptionStatus: SubscriptionStatus;
  }
  
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      points: number;
      subscriptionStatus: SubscriptionStatus;
    }
  }
}

// Extend JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    points: number;
    subscriptionStatus: SubscriptionStatus;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          safeError('Login attempt with missing credentials');
          throw new Error('メールアドレスとパスワードを入力してください');
        }

        await connectToDatabase();
        
        try {
          const user = await User.findOne({ email: credentials.email });
          
          if (!user) {
            safeLog('Login attempt with non-existent email', { email: credentials.email });
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }
          
          const isPasswordValid = await user.comparePassword(credentials.password);
          
          if (!isPasswordValid) {
            safeLog('Failed login attempt (invalid password)', { userId: user._id.toString() });
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }
          
          safeLog('User logged in successfully', { userId: user._id.toString() });
          
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            points: user.points,
            subscriptionStatus: user.subscriptionStatus as SubscriptionStatus
          };
        } catch (error) {
          safeError('Error in authorize function', error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        console.log('JWT callback - Initial sign in', { user });
        
        token.id = user.id;
        token.role = user.role;
        token.points = user.points;
        token.subscriptionStatus = user.subscriptionStatus;
        
        // If points or subscription status are missing, try to fetch them from the database
        if (token.points === undefined || token.subscriptionStatus === undefined) {
          try {
            await connectToDatabase();
            const dbUser = await User.findById(user.id);
            if (dbUser) {
              token.points = dbUser.points;
              token.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
              console.log('User data fetched from database for token', { 
                points: dbUser.points,
                subscriptionStatus: dbUser.subscriptionStatus 
              });
            }
          } catch (error) {
            console.error('Error fetching user data for token', error);
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.points = token.points as number;
        session.user.subscriptionStatus = token.subscriptionStatus;
        
        // If points or subscription status are missing, try to fetch them from the database
        if (session.user.points === undefined || session.user.subscriptionStatus === undefined) {
          try {
            await connectToDatabase();
            const dbUser = await User.findById(session.user.id);
            if (dbUser) {
              session.user.points = dbUser.points;
              session.user.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
              console.log('User data fetched from database for session', { 
                points: dbUser.points,
                subscriptionStatus: dbUser.subscriptionStatus 
              });
            }
          } catch (error) {
            console.error('Error fetching user data for session', error);
          }
        }
      }
      
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    error(code, ...message) {
      safeError(code, ...message);
    },
    warn(code, ...message) {
      safeError(code, ...message);
    },
    debug(code, ...message) {
      // Disable debug logs in production
      if (process.env.NODE_ENV !== 'production') {
        safeLog(code, ...message);
      }
    },
  },
}; 