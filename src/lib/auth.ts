import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { safeLog, safeError } from './utils';
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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        safeLog('[auth.ts] Authorize function started');
        if (!credentials?.email || !credentials?.password) {
          safeError('[auth.ts] Login attempt with missing credentials');
          throw new Error('メールアドレスとパスワードを入力してください');
        }
        safeLog('[auth.ts] Credentials received:', { email: credentials.email }); // Log email for debugging

        try {
          safeLog('[auth.ts] Attempting to connect to database...');
          await connectToDatabase();
          safeLog('[auth.ts] Database connection successful');
          
          safeLog('[auth.ts] Finding user by email:', credentials.email);
          const user = await User.findOne({ email: credentials.email });
          safeLog('[auth.ts] User find result:', { userExists: !!user });
          
          if (!user) {
            safeError('[auth.ts] Login attempt with non-existent email', { email: credentials.email });
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }
          
          safeLog('[auth.ts] Comparing password for user:', user._id.toString());
          const isPasswordValid = await user.comparePassword(credentials.password);
          safeLog('[auth.ts] Password comparison result:', { isValid: isPasswordValid });
          
          if (!isPasswordValid) {
            safeError('[auth.ts] Failed login attempt (invalid password)', { userId: user._id.toString() });
            throw new Error('メールアドレスまたはパスワードが間違っています');
          }
          
          safeLog('[auth.ts] User logged in successfully, returning user object', { userId: user._id.toString() });
          
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            points: user.points,
            subscriptionStatus: user.subscriptionStatus as SubscriptionStatus
          };
        } catch (error: any) {
          safeError('[auth.ts] Error in authorize function', error);
          // Check if it's a DB connection error
          if (error.message && error.message.includes('connect')) {
             throw new Error('データベース接続エラーが発生しました。');
          }
          // Rethrow other errors (like invalid credentials)
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
      safeLog('[auth.ts] JWT callback started');
      try {
        // Initial sign in
        if (account && user) {
          safeLog('[auth.ts] JWT callback - Initial sign in', { userId: user.id });
          
          token.id = user.id;
          token.role = user.role;
          token.points = user.points;
          token.subscriptionStatus = user.subscriptionStatus;
          
          // If points or subscription status are missing, try to fetch them from the database
          if (token.points === undefined || token.subscriptionStatus === undefined) {
            safeLog('[auth.ts] JWT callback - Missing points/subscription, fetching from DB');
            try {
              await connectToDatabase();
              const dbUser = await User.findById(user.id);
              if (dbUser) {
                token.points = dbUser.points;
                token.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
                safeLog('[auth.ts] JWT callback - User data fetched from DB');
              } else {
                 safeError('[auth.ts] JWT callback - User not found in DB during fetch');
              }
            } catch (error) {
              safeError('[auth.ts] JWT callback - Error fetching user data for token', error);
            }
          }
        }
        safeLog('[auth.ts] JWT callback finished, returning token');
        return token;
      } catch (error) {
        safeError('[auth.ts] Error in jwt callback', error);
        return token; // Return existing token on error
      }
    },
    async session({ session, token }) {
      safeLog('[auth.ts] Session callback started');
      try {
        if (token && session.user) {
          safeLog('[auth.ts] Session callback - Populating session from token', { tokenId: token.id });
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.points = token.points as number;
          session.user.subscriptionStatus = token.subscriptionStatus;
          
          // If points or subscription status are missing, try to fetch them from the database
          if (session.user.points === undefined || session.user.subscriptionStatus === undefined) {
            safeLog('[auth.ts] Session callback - Missing points/subscription, fetching from DB');
            try {
              await connectToDatabase();
              const dbUser = await User.findById(session.user.id);
              if (dbUser) {
                session.user.points = dbUser.points;
                session.user.subscriptionStatus = dbUser.subscriptionStatus as SubscriptionStatus;
                safeLog('[auth.ts] Session callback - User data fetched from DB');
              } else {
                 safeError('[auth.ts] Session callback - User not found in DB during fetch');
              }
            } catch (error) {
              safeError('[auth.ts] Session callback - Error fetching user data for session', error);
            }
          }
        }
        safeLog('[auth.ts] Session callback finished, returning session');
        return session;
      } catch (error) {
        safeError('[auth.ts] Error in session callback', error);
        return session; // Return existing session on error
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  // Use secure NextAuth secret
  secret: getNextAuthSecret(),
  // Enable debug only in development
  debug: process.env.NODE_ENV !== 'production',
  // Configure cookie options to work properly in production
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
        // Don't set domain for Amplify
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
        // Don't set domain for Amplify
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
        // Don't set domain for Amplify
      },
    },
  },
  // Enable logging
  logger: {
    error(code, ...message) {
      safeError(`[auth.ts] NextAuth Error [${code}]`, ...message);
    },
    warn(code, ...message) {
      safeError(`[auth.ts] NextAuth Warning [${code}]`, ...message);
    },
    debug(code, ...message) {
      if (process.env.NODE_ENV !== 'production') {
        safeLog(`[auth.ts] NextAuth Debug [${code}]`, ...message);
      }
    },
  },
}; 