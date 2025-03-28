'use client';

interface LoadingAnimationProps {
  message: string;
  subMessage?: string;
}

export default function LoadingAnimation({ message, subMessage }: LoadingAnimationProps) {
  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="animate-pulse flex space-x-4 mb-4">
        <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="h-12 w-12 bg-blue-500 rounded-full animate-bounce delay-100"></div>
        <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce delay-200"></div>
      </div>
      <p className="text-lg font-medium text-gray-700 mt-2">{message}</p>
      {subMessage && <p className="text-sm text-gray-500 mt-1">{subMessage}</p>}
    </div>
  );
} 