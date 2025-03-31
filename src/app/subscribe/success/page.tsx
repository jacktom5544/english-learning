'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setIsVerifying(false);
      setError('セッションIDが見つかりません。');
      return;
    }
    
    // Verify the session with your backend
    const verifySession = async () => {
      try {
        const response = await fetch(`/api/subscription/verify?session_id=${sessionId}`, {
          method: 'GET',
        });
        
        if (!response.ok) {
          throw new Error('セッションの検証に失敗しました。');
        }
        
        setIsVerifying(false);
      } catch (error) {
        console.error('Error verifying session:', error);
        setIsVerifying(false);
        setError('サブスクリプションの検証中にエラーが発生しました。');
      }
    };
    
    verifySession();
  }, [searchParams]);
  
  if (isVerifying) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">サブスクリプションを確認中...</h1>
        <p className="text-gray-600 mb-6">お支払いを処理しています。このページを閉じないでください。</p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">エラーが発生しました</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link href="/subscribe" className="btn bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
          サブスクリプションページに戻る
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="mb-8">
        <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-4">サブスクリプションが完了しました！</h1>
      <p className="text-gray-600 mb-6">
        ご購入ありがとうございます。アカウントに5000ポイントが追加されました。
        30日ごとに自動的に更新され、毎回5000ポイントが追加されます。
      </p>
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 justify-center">
        <Link href="/dashboard" className="btn bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
          ダッシュボードに移動
        </Link>
        <Link href="/profile" className="btn bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg">
          プロフィールを表示
        </Link>
      </div>
    </div>
  );
} 