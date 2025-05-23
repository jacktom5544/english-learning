'use client';

import { TEACHER_PROFILES } from '@/lib/teachers';
import Image from 'next/image';

interface TypingIndicatorProps {
  teacher: string;
}

export default function TypingIndicator({ teacher }: TypingIndicatorProps) {
  const teacherProfile = TEACHER_PROFILES[teacher as keyof typeof TEACHER_PROFILES];
  
  return (
    <div className="flex justify-start mb-4">
      <div className="h-8 w-8 relative rounded-full overflow-hidden mr-2">
        <Image
          src={`/images/teachers/${teacher}.png`}
          alt={teacherProfile.name}
          fill
          className="object-cover"
        />
      </div>
      <div className="bg-gray-100 text-gray-800 rounded-lg p-3 flex items-center">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
        </div>
        <span className="ml-2 text-sm text-gray-500">typing...</span>
      </div>
    </div>
  );
} 