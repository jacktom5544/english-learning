'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const englishLevelOptions = [
  { value: 'super_beginner', label: '超初心者' },
  { value: 'beginner', label: '初心者' },
  { value: 'intermediate', label: '中級者' },
  { value: 'upper_intermediate', label: '中上級者' },
  { value: 'advanced', label: '上級者' },
];

const teacherOptions = [
  { 
    value: 'hiroshi', 
    label: 'ひろし先生', 
    description: '関西弁で漫才風の明るいキャラクター。初心者あるあるの文法ぐちゃぐちゃの英文でも気さくにチェックしてアドバイスしてくれる優しい英語の先生。口調はちょっとトゲがあるかもだけど心根はすごく良い人です。',
    introduction: '「英語学習は何よりも楽しくがモットーやねん。最初は誰でもなかなか上手く行かへん。でもな、そこで諦めへんかったら道は開けるんやで！」',
    image: '/hiroshi.png'
  },
  { 
    value: 'reiko', 
    label: '玲子先生', 
    description: 'とある財閥の令嬢ながら英語の先生になったという珍しい先生。「ですわ」口調がトレードマーク。頭脳明晰、容姿端麗で一見接しにくいように感じるけど生徒想いの優しい先生。ただ酒癖があまり良くなく一緒に飲み会に行った同僚は「もう二度と玲子先生とは飲み会に行きたくない」って言ったとか言ってないとか・・・',
    introduction: '「分かりやすく丁寧に教えるのが私のモットーですわ。特に初心者の方は文法で躓きやすいもの。わたくしが手取り足取り教えて差し上げますわ。」',
    image: '/reiko.png'
  },
  { 
    value: 'iwao', 
    label: '巌男先生', 
    description: 'コンプライアンスが厳しい令和の時代にも関わらず未だに昭和のスタイルを貫く古き男。生徒を泣かせたことも何回もあるが何故かそれでも一定の人気を保つ不思議な魅力を持つ。暴言も飛び交うがそれでも生徒想いがとても強い先生。',
    introduction: '「英語が話せない？生意気な事言ってんじゃねーぞ、テメー！話せるようになるまで何回でもやるんだよ！お前の根性を見せてみろ！」',
    image: '/iwao.png'
  },
  { 
    value: 'taro', 
    label: '太郎先生', 
    description: '標準語で理詰めで丁寧に教えてくれる若手の先生。欠点らしい欠点も無く、どんなタイプの生徒でも上手く対応するのに定評がある。',
    introduction: '「初心者から上級者まで幅広く対応出来ます。文法の事で分からない事があれば気軽に聞いてくださいね。」',
    image: '/taro.png'
  },
];

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userPoints, setUserPoints] = useState({ points: 0, pointsUsedThisMonth: 0, pointsLastUpdated: new Date() });
  const [profile, setProfile] = useState({
    name: '',
    englishLevel: 'beginner',
    job: '',
    goal: '',
    image: '',
    preferredTeacher: 'taro',
    startReason: '',
    struggles: '',
  });

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile();
      fetchUserPoints();
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
          preferredTeacher: userData.preferredTeacher || 'taro',
          startReason: userData.startReason || '',
          struggles: userData.struggles || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPoints = async () => {
    try {
      const response = await fetch('/api/users/points');
      if (response.ok) {
        const data = await response.json();
        setUserPoints({
          points: data.points,
          pointsUsedThisMonth: data.pointsUsedThisMonth,
          pointsLastUpdated: new Date(data.pointsLastUpdated)
        });
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setMessage('画像サイズは5MB以下にしてください');
      return;
    }

    try {
      setIsUploading(true);
      
      // Convert file to base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Upload to Cloudinary via API route
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64String }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'アップロードに失敗しました');
      }
      
      const data = await response.json();
      
      // Update profile with the Cloudinary URL
      setProfile(prev => ({ ...prev, image: data.url }));
      setMessage('画像がアップロードされました');
    } catch (error: any) {
      console.error('Image upload error:', error);
      setMessage(error.message || 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
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
        body: JSON.stringify({
          ...profile,
          // Ensure these fields are explicitly sent even if empty
          startReason: profile.startReason || '',
          struggles: profile.struggles || ''
        }),
      });

      if (response.ok) {
        setMessage('プロフィールが更新されました');
        
        // Re-fetch user profile to ensure data is up-to-date
        fetchUserProfile();
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

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-xl font-semibold mb-4">ポイント情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 font-medium">今月の残りのポイント</p>
            <p className="text-2xl font-bold text-blue-600">{userPoints.points}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 font-medium">今月の消費ポイント</p>
            <p className="text-2xl font-bold text-green-600">{userPoints.pointsUsedThisMonth}</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>次回のポイント更新: {new Date(userPoints.pointsLastUpdated.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP')}</p>
          <p className="mt-1">※毎月5000ポイントを追加（最大20000ポイントまで）</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="space-y-6">
          <div className="mb-6">
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
              プロフィール画像
            </label>
            <div className="flex items-center space-x-6">
              <div 
                className="w-24 h-24 relative border border-gray-300 rounded-full overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleImageClick}
              >
                {profile.image ? (
                  <Image 
                    src={profile.image} 
                    alt="プロフィール画像" 
                    fill 
                    style={{ objectFit: 'cover' }} 
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-3xl text-gray-400">
                    👤
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-medium">変更</span>
                </div>
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="imageUpload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleImageClick}
                  disabled={isUploading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isUploading ? '画像をアップロード中...' : '画像をアップロード'}
                </button>
                <p className="mt-1 text-sm text-gray-500">
                  JPG、PNG、GIF形式。最大5MB。推奨サイズ: 200 x 200 px
                </p>
              </div>
            </div>
          </div>

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
            <label htmlFor="startReason" className="block text-sm font-medium text-gray-700">
              何故英語学習を始めようと思ったのか？
            </label>
            <textarea
              id="startReason"
              name="startReason"
              rows={3}
              value={profile.startReason}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="例: 海外の友人と会話がしたい、仕事で必要になったなど"
            />
          </div>

          <div>
            <label htmlFor="struggles" className="block text-sm font-medium text-gray-700">
              英語学習での悩み事
            </label>
            <textarea
              id="struggles"
              name="struggles"
              rows={3}
              value={profile.struggles}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="例: 文法が覚えられない、リスニングが苦手など"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              お好みの先生を選んでください
            </label>
            <p className="text-sm text-gray-500 mb-4">
              選んだ先生がライティングで添削を行います。それぞれの先生は独自の教え方と個性を持っています。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacherOptions.map((teacher) => (
                <div 
                  key={teacher.value}
                  className={`border p-4 rounded-lg cursor-pointer transition-all ${
                    profile.preferredTeacher === teacher.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setProfile(prev => ({ ...prev, preferredTeacher: teacher.value }))}
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="flex-shrink-0 w-24 h-24 bg-gray-200 rounded-full overflow-hidden relative">
                      {/* Image placeholder - replace with actual images when available */}
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        {teacher.image ? (
                          <Image src={teacher.image} alt={teacher.label} fill style={{ objectFit: 'cover' }} />
                        ) : (
                          <span className="text-3xl">👨‍🏫</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id={`teacher-${teacher.value}`}
                          name="preferredTeacher"
                          value={teacher.value}
                          checked={profile.preferredTeacher === teacher.value}
                          onChange={handleChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`teacher-${teacher.value}`} className="ml-2 text-lg font-medium text-gray-700">
                          {teacher.label}
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{teacher.description}</p>
                      <p className="mt-2 text-sm italic text-gray-700">{teacher.introduction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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