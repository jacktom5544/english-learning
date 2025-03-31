'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Use useEffect to handle redirects based on session status
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">ログイン状態を確認中...</p>
      </div>
    );
  }
  
  // Return null during initial load or if not authenticated
  if (status !== 'authenticated' || !session?.user) {
    return null;
  }
  
  const handleSubscribe = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('サブスクリプションの作成に失敗しました。もう一度お試しください。');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('サブスクリプションの作成中にエラーが発生しました', error);
      alert('サブスクリプションの作成中にエラーが発生しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };
  
  const isSubscribed = session.user.subscriptionStatus === 'active';
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">サブスクリプションプラン</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">マンスリープラン（30日間更新）</h2>
          <p className="text-lg font-medium text-blue-600">月額：2000円（税込）</p>
        </div>
        
        <div className="space-y-6 mb-8">
          <div>
            <h3 className="text-xl font-medium mb-4">プランの特典</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>毎月更新時に5000ポイントが追加されます</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>AIを活用した英語学習コンテンツが使い放題</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>いつでも解約可能</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-xl font-medium mb-4">サブスクリプションの流れ</h3>
            <ol className="space-y-3 text-gray-600 list-decimal pl-5">
              <li>「購読する」ボタンをクリックしてStripeの決済ページに進みます</li>
              <li>クレジットカード情報を入力して購読を完了させます</li>
              <li>購読完了後、あなたのアカウントに自動的に5000ポイントが追加されます</li>
              <li>30日ごとに自動的に更新され、毎回5000ポイントが追加されます</li>
            </ol>
          </div>
        </div>
        
        {isSubscribed ? (
          <div className="text-center p-4 bg-green-50 rounded-lg mb-6">
            <p className="text-green-800 font-medium">
              現在、マンスリープランに加入中です。プロフィールページから解約できます。
            </p>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="btn bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg shadow-md font-medium text-lg disabled:bg-gray-400"
            >
              {isLoading ? '処理中...' : '購読する'}
            </button>
          </div>
        )}
      </div>
      
      <div className="text-center text-gray-600 text-sm">
        <p>ご不明な点がございましたら、サポートまでお問い合わせください。</p>
        <p>解約はプロフィールページからいつでも可能です。</p>
      </div>
    </div>
  );
} 