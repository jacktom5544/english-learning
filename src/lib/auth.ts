import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import User, { IUser } from '@/models/User';
import { safeLog, safeError } from './utils';
import { NEXTAUTH_SECRET } from './env';
import { Model } from 'mongoose';

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

// Cast the User model to the correct type
const UserModel = User as Model<IUser>;

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

        try {
          await connectToDatabase();
          
          const user = await UserModel.findOne({ email: credentials.email });
          
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      try {
        // Initial sign in
        if (account && user) {
          safeLog('JWT callback - Initial sign in');
          
          token.id = user.id;
          token.role = user.role;
          token.points = user.points;
          token.subscriptionStatus = user.subscriptionStatus;
          
          // If points or subscription status are missing, try to fetch them from the database
          if (token.points === undefined || token.subscriptionStatus === undefined) {
            try {
              await connectToDatabase();
              const dbUser = await UserModel.findById(user.id);
              if (dbUser) {
                token.points = dbUser.points;
                token.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
                safeLog('User data fetched from database for token');
              }
            } catch (error) {
              safeError('Error fetching user data for token', error);
            }
          }
        }
        
        return token;
      } catch (error) {
        safeError('Error in jwt callback', error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.points = token.points as number;
          session.user.subscriptionStatus = token.subscriptionStatus;
          
          // If points or subscription status are missing, try to fetch them from the database
          if (session.user.points === undefined || session.user.subscriptionStatus === undefined) {
            try {
              await connectToDatabase();
              const dbUser = await UserModel.findById(session.user.id);
              if (dbUser) {
                session.user.points = dbUser.points;
                session.user.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
                safeLog('User data fetched from database for session');
              }
            } catch (error) {
              safeError('Error fetching user data for session', error);
            }
          }
        }
        
        return session;
      } catch (error) {
        safeError('Error in session callback', error);
        return session;
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, ...message) {
      safeError(`NextAuth Error [${code}]`, ...message);
    },
    warn(code, ...message) {
      safeError(`NextAuth Warning [${code}]`, ...message);
    },
    debug(code, ...message) {
      // Disable debug logs in production
      if (process.env.NODE_ENV !== 'production') {
        safeLog(`NextAuth Debug [${code}]`, ...message);
      }
    },
  },
}; 