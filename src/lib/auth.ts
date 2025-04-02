import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import bcrypt from 'bcrypt';
import { safeLog, safeError } from '@/lib/utils';
import { getNextAuthURL, logEnvironmentStatus, isAmplifyEnvironment } from './env';

// Define subscription status type to match what's used in stripe.ts
type SubscriptionStatus = 'active' | 'cancelled' | 'inactive';

// Log environment variables on module load
if (typeof window === 'undefined') {
  logEnvironmentStatus();
  const url = getNextAuthURL();
  safeLog('[auth.ts] Auth module loaded with NEXTAUTH_URL:', url);
}

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

// Get the NextAuth secret safely
function getNextAuthSecret(): string {
  // First try the hardcoded value for Amplify builds
  const hardcodedSecret = 'WJP6m49zmV7Yo1ZNhQmSDctrZHC2WoayEFe9gGzcAAg=';
  
  // Then check for environment variable
  const secret = process.env.NEXTAUTH_SECRET;
  
  if (!secret && process.env.NODE_ENV === 'production') {
    safeError('[auth.ts] NEXTAUTH_SECRET is missing in environment, using hardcoded value');
    return hardcodedSecret;
  }
  
  return secret || hardcodedSecret;
}

// Get the domain for cookies
function getCookieDomain(): string | undefined {
  safeLog('[auth.ts] Determining cookie domain...');
  
  // In Amplify environment, use custom domain if available
  if (isAmplifyEnvironment()) {
    safeLog('[auth.ts] Amplify environment detected for cookie domain');
    if (process.env.AMPLIFY_APP_DOMAIN) {
      safeLog('[auth.ts] Amplify custom domain found:', process.env.AMPLIFY_APP_DOMAIN);
      // Use root domain for cookies (strip subdomains)
      const domainParts = process.env.AMPLIFY_APP_DOMAIN.split('.');
      
      // If there are at least 2 parts and not an IP address
      if (domainParts.length >= 2 && isNaN(Number(domainParts[domainParts.length - 1]))) {
        // Get the top two levels of the domain (e.g., example.com from www.example.com)
        const rootDomain = domainParts.slice(-2).join('.');
        safeLog('[auth.ts] Calculated root domain:', rootDomain);
        return rootDomain;
      }
      
      // Fallback to the whole domain
      safeLog('[auth.ts] Falling back to full custom domain:', process.env.AMPLIFY_APP_DOMAIN);
      return process.env.AMPLIFY_APP_DOMAIN;
    }
    
    // Default Amplify domain (don't set domain)
    safeLog('[auth.ts] No custom domain found, using default Amplify domain (undefined)');
    return undefined;
  }
  
  // For localhost, don't set a domain
  safeLog('[auth.ts] Not in Amplify env, using localhost domain (undefined)');
  return undefined;
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

          safeLog('[authorize] User authenticated successfully');
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
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.points = user.points;
        token.subscriptionStatus = user.subscriptionStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.points = token.points as number;
        session.user.subscriptionStatus = token.subscriptionStatus as any;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}; 