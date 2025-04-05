'use client';

import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';
import Image from 'next/image';

interface TypingIndicatorProps {
  teacherKey: JapaneseTeacherKey;
}

export default function TypingIndicator({ teacherKey }: TypingIndicatorProps) {
  const teacherProfile = JAPANESE_TEACHER_PROFILES[teacherKey];

  return (
    <div className="flex items-start my-4">
      <div className="w-8 h-8 relative rounded-full overflow-hidden mr-2 flex-shrink-0">
        {teacherProfile?.image && (
          <Image src={teacherProfile.image} alt={teacherProfile.name} width={32} height={32} className="object-cover" />
        )}
      </div>
      <div className="bg-white rounded-2xl px-4 py-2 border border-gray-200 rounded-bl-none shadow-sm">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
} 