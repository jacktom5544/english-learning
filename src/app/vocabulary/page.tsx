'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface VocabularyItem {
  _id: string;
  word: string;
  translation: string;
  explanation: string;
  exampleSentence?: string;
  isRemembered: boolean;
  createdAt: string;
}

export default function VocabularyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'remembered' | 'not-remembered'>('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchVocabularies();
    } else {
      router.push('/login');
    }
  }, [session, router]);

  const fetchVocabularies = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      let url = '/api/vocabulary';
      if (filter !== 'all') {
        url += `?filter=${filter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vocabularies');
      }
      
      const data = await response.json();
      setVocabularies(data);
    } catch (error) {
      console.error('Failed to fetch vocabularies:', error);
      setMessage('単語データの取得に失敗しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchVocabularies();
    }
  }, [filter, session?.user?.id]);

  const toggleVocabularyStatus = async (id: string, currentStatus: boolean) => {
    try {
      // Update UI immediately for better user experience
      const updatedVocabularies = vocabularies.map(vocab => {
        if (vocab._id === id) {
          return { ...vocab, isRemembered: !currentStatus };
        }
        return vocab;
      });

      setVocabularies(updatedVocabularies);

      // Then update in the database
      const response = await fetch(`/api/vocabulary/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isRemembered: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update vocabulary status');
      }
      
      // We could refresh the data from the server here if needed
      // fetchVocabularies();
    } catch (error) {
      console.error('Failed to toggle vocabulary status:', error);
      setMessage('ステータスの更新に失敗しました。しばらくしてからもう一度お試しください。');
      
      // Revert the UI change if the API call failed
      fetchVocabularies();
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">単語帳</h1>

        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて ({vocabularies.length})
          </button>
          <button
            onClick={() => setFilter('remembered')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'remembered'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            覚えた ({vocabularies.filter(v => v.isRemembered).length})
          </button>
          <button
            onClick={() => setFilter('not-remembered')}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              filter === 'not-remembered'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すぐに忘れそう ({vocabularies.filter(v => !v.isRemembered).length})
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-amber-50 border border-amber-400 text-amber-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      {vocabularies.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          単語データがありません。クイズに参加して単語を追加しましょう。
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  英単語
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日本語
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  解説
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  例文
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vocabularies.map((vocabulary) => (
                <tr key={vocabulary._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {vocabulary.word}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vocabulary.translation}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vocabulary.explanation}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vocabulary.exampleSentence ? (
                      <p className="italic">{vocabulary.exampleSentence}</p>
                    ) : (
                      <p className="text-gray-400">例文なし</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        vocabulary.isRemembered
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {vocabulary.isRemembered ? '覚えた' : 'すぐに忘れそう'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleVocabularyStatus(vocabulary._id, vocabulary.isRemembered)}
                      className={`px-3 py-1 rounded text-xs ${
                        vocabulary.isRemembered
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {vocabulary.isRemembered ? 'すぐに忘れそうにする' : '覚えたとマーク'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 