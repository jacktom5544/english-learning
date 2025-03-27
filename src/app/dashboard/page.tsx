'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
      
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            ようこそ、{session?.user?.name}さん！
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              English Learning へようこそ。プロフィールを完成させて、英語学習を始めましょう。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">クイズに挑戦</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>英語レベルに合ったクイズで語彙力を高めましょう。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/quiz"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                クイズスタート
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">単語帳</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>学習した単語を管理して、効率的に復習しましょう。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/vocabulary"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                単語管理
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">ライティング練習</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>AIがフィードバックを提供し、ライティングスキルを向上させます。</p>
            </div>
            <div className="mt-5">
              <Link
                href="/writing"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ライティング練習
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">プロフィール設定</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              英語レベル、目標を設定して、あなたに最適な学習体験をカスタマイズしましょう。
            </p>
          </div>
          <div className="mt-5">
            <Link
              href="/profile"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              プロフィールを編集
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 