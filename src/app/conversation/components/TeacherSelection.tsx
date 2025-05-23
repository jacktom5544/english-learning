'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TEACHER_PROFILES, TeacherType } from '@/lib/teachers';
import LoadingAnimation from './LoadingAnimation';

interface TeacherSelectionProps {
  onSelectTeacher: (teacher: TeacherType) => void;
  userPoints: number;
  requiredPoints: number;
}

export default function TeacherSelection({ onSelectTeacher, userPoints, requiredPoints }: TeacherSelectionProps) {
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasEnoughPoints = userPoints >= requiredPoints;

  const handleSelectTeacher = (teacherId: TeacherType) => {
    setSelectedTeacher(teacherId);
  };

  const handleStartConversation = async () => {
    if (selectedTeacher && hasEnoughPoints) {
      setIsLoading(true);
      try {
        await onSelectTeacher(selectedTeacher);
      } catch (error) {
        setIsLoading(false);
        console.error('Error starting conversation:', error);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-center">Choose Your Teacher</h1>
      
      <div className="text-center mb-4">
        <div className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full">
          現在のポイント: <span className="font-semibold">{userPoints}</span>
        </div>
      </div>
      
      {!hasEnoughPoints && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6 text-center">
          ポイントが不足しています。必要なポイント: {requiredPoints}, 現在のポイント: {userPoints}
        </div>
      )}
      
      {isLoading ? (
        <LoadingAnimation 
          message="先生があなたとの会話を準備中です..." 
          subMessage="少々お待ちください" 
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {Object.entries(TEACHER_PROFILES).map(([id, teacher]) => (
              <div
                key={id}
                className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  selectedTeacher === id ? 'ring-2 ring-blue-500' : ''
                } ${!hasEnoughPoints ? 'opacity-70' : ''}`}
                onClick={() => hasEnoughPoints && handleSelectTeacher(id as TeacherType)}
              >
                <div className="p-4 flex flex-col md:flex-row items-center gap-4">
                  <div className="w-24 h-24 relative rounded-full overflow-hidden">
                    <Image
                      src={`/images/teachers/${id}.png`}
                      alt={`${teacher.name} photo`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{teacher.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {teacher.origin} • {teacher.age}
                    </p>
                    <p className="text-sm mb-2">{teacher.background}</p>
                    <div className="flex flex-wrap gap-1">
                      {teacher.hobbies.slice(0, 3).map((interest) => (
                        <span
                          key={interest}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleStartConversation}
              disabled={!selectedTeacher || !hasEnoughPoints}
              className={`px-6 py-3 rounded-lg text-white font-medium transition-colors ${
                selectedTeacher && hasEnoughPoints
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Start Conversation
            </button>
          </div>
        </>
      )}
    </div>
  );
} 