'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import React from 'react';

export default function ResetPassword() {
  // Use the useParams hook to get the route parameters
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token as string;
  
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate token exists
  useEffect(() => {
    if (!token) {
      setError('無効なリセットトークンです');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'パスワードのリセット中にエラーが発生しました');
        setIsLoading(false);
        return;
      }

      setSuccess(data.message);
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login page after short delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      setError('パスワードのリセット中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold">English Learning</h1>
          <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
            新しいパスワードを設定
          </h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
            <p className="mt-2 text-sm">ログインページにリダイレクトします...</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="********"
              />
              <p className="mt-1 text-sm text-gray-500">
                8文字以上の英数字を含むパスワードを設定してください
              </p>
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                パスワード (確認)
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="********"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !!success}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '処理中...' : 'パスワードを更新'}
            </button>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-sm">
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                ログインページに戻る
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 