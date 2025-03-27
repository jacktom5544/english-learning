import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { safeLog, safeError } from './utils';

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
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