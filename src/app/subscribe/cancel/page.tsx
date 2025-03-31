'use client';

import Link from 'next/link';

export default function SubscriptionCancelPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">サブスクリプションがキャンセルされました</h1>
      <p className="text-gray-600 mb-6">
        サブスクリプションの処理がキャンセルされました。<br />
        後でまたお試しいただくか、何か問題がありましたらサポートまでお問い合わせください。
      </p>
      <Link href="/subscribe" className="btn bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
        サブスクリプションページに戻る
      </Link>
    </div>
  );
} 