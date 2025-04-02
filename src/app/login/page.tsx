'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams.get('error');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Check for URL error parameter on mount
  useEffect(() => {
    if (errorParam) {
      if (errorParam === 'CredentialsSignin') {
        setError('メールアドレスまたはパスワードが間違っています');
      } else if (errorParam === 'AuthenticationError') {
        setError('認証エラーが発生しました。再度お試しください');
      } else {
        setError(`ログイン中にエラーが発生しました: ${errorParam}`);
      }
    }
  }, [errorParam]);

  // In production, fetch auth debug info
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      async function checkAuthStatus() {
        try {
          const response = await fetch('/api/auth-debug');
          if (response.ok) {
            const data = await response.json();
            setDebugInfo(data);
            
            // If there are existing cookies but authentication still fails,
            // this indicates a potential cookie configuration issue
            if (data.cookieExists && !data.authenticated) {
              console.warn('Cookie exists but authentication failed - possible cookie configuration issue');
            }
          }
        } catch (error) {
          console.error('Error checking auth status:', error);
        }
      }
      
      checkAuthStatus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // In production, use our direct signin endpoint
      if (process.env.NODE_ENV === 'production') {
        console.log('Using direct signin endpoint in production');
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important for cookies
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'ログイン中にエラーが発生しました。');
          setIsLoading(false);
          return;
        }

        // Successful login with direct endpoint
        if (data.success) {
          console.log('Login successful, redirecting to:', callbackUrl);
          
          // Force a page refresh to reload session context
          window.location.href = callbackUrl;
          return;
        }
      } else {
        // In development, use normal NextAuth
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (result?.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }
      }

      // Redirect to dashboard or callback URL
      router.push(callbackUrl);
    } catch (error: any) {
      console.error('Login error:', error);
      setError('ログイン中にエラーが発生しました。');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold">English Learning</h1>
          <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
            ログイン
          </h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="example@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="********"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                アカウントをお持ちでない方はこちら
              </Link>
            </div>
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                パスワードをお忘れですか？
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 