'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(10);

  // Check if user is authenticated and is admin
  if (!session || !session.user) {
    router.push('/login');
    return null;
  }

  const updateExampleSentences = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/vocabulary/update-examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '例文の更新に失敗しました');
      }

      setMessage(data.message || `${data.updated}個のボキャブラリーを更新しました`);
    } catch (error: any) {
      console.error('Error updating example sentences:', error);
      setMessage(`エラーが発生しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理ページ</h1>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">ボキャブラリー例文の更新</h2>
          <p className="text-gray-600 mb-4">
            例文が登録されていないボキャブラリーに対して、AIを使って自動的に例文を生成します。
          </p>

          <div className="flex items-end gap-4">
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
                更新する件数
              </label>
              <input
                type="number"
                id="limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                min="1"
                max="50"
                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={updateExampleSentences}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? '更新中...' : '例文を更新する'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-md">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 