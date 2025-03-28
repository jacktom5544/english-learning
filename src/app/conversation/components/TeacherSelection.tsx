'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TEACHER_PROFILES, TeacherType } from '@/lib/teachers';

interface TeacherSelectionProps {
  onSelectTeacher: (teacher: TeacherType) => void;
}

export default function TeacherSelection({ onSelectTeacher }: TeacherSelectionProps) {
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherType | null>(null);

  const handleSelectTeacher = (teacherId: TeacherType) => {
    setSelectedTeacher(teacherId);
  };

  const handleStartConversation = () => {
    if (selectedTeacher) {
      onSelectTeacher(selectedTeacher);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-center">Choose Your Teacher</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {Object.entries(TEACHER_PROFILES).map(([id, teacher]) => (
          <div
            key={id}
            className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
              selectedTeacher === id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleSelectTeacher(id as TeacherType)}
          >
            <div className="p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="w-24 h-24 relative">
                {/* Fallback image until real images are available */}
                <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xl">
                  {teacher.name[0]}
                </div>
                {/* Uncomment when images are available */}
                {/* <Image
                  src={teacher.imageUrl}
                  alt={teacher.name}
                  fill
                  className="object-cover rounded-full"
                /> */}
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
          disabled={!selectedTeacher}
          className={`px-6 py-3 rounded-lg text-white font-medium transition-colors ${
            selectedTeacher
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Start Conversation
        </button>
      </div>
    </div>
  );
} 