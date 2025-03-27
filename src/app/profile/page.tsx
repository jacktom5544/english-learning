'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const englishLevelOptions = [
  { value: 'super_beginner', label: '超初心者' },
  { value: 'beginner', label: '初心者' },
  { value: 'intermediate', label: '中級者' },
  { value: 'upper_intermediate', label: '中上級者' },
  { value: 'advanced', label: '上級者' },
];

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({
    name: '',
    englishLevel: 'beginner',
    job: '',
    goal: '',
    image: '',
  });

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile();
    }
  }, [session?.user?.id]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${session?.user?.id}`);
      if (response.ok) {
        const userData = await response.json();
        setProfile({
          name: userData.name || '',
          englishLevel: userData.englishLevel || 'beginner',
          job: userData.job || '',
          goal: userData.goal || '',
          image: userData.image || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        setMessage('プロフィールが更新されました');
      } else {
        const data = await response.json();
        setMessage(data.error || 'プロフィールの更新に失敗しました');
      }
    } catch (error) {
      setMessage('エラーが発生しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロフィール設定</h1>

      {message && (
        <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              ニックネーム
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={profile.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="englishLevel" className="block text-sm font-medium text-gray-700">
              英語レベル
            </label>
            <select
              id="englishLevel"
              name="englishLevel"
              value={profile.englishLevel}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              required
            >
              {englishLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="job" className="block text-sm font-medium text-gray-700">
              職業・業種
            </label>
            <textarea
              id="job"
              name="job"
              rows={3}
              value={profile.job}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="例: 看護師、IT企業SEなど"
            />
          </div>

          <div>
            <label htmlFor="goal" className="block text-sm font-medium text-gray-700">
              英語学習の目標
            </label>
            <textarea
              id="goal"
              name="goal"
              rows={3}
              value={profile.goal}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="例: 海外の病院で働きたい、海外の取引先と商談できるようになりたいなど"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : 'プロフィールを保存'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}