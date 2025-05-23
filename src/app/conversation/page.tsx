'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IConversation } from '@/models/Conversation';
import { TeacherType } from '@/lib/teachers';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';

// Dynamic imports without type annotations to avoid TypeScript conflicts
// @ts-ignore
const ConversationList = dynamic(() => import('./components/ConversationList'), { ssr: false });
// @ts-ignore
const ChatInterface = dynamic(() => import('./components/ChatInterface'), { ssr: false });
// @ts-ignore
const TeacherSelection = dynamic(() => import('./components/TeacherSelection'), { ssr: false });

export default function ConversationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { points, pointsUsedThisMonth, isLoading: isPointsLoading, consumePoints, refreshPoints } = useUserPoints();
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<IConversation | null>(null);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a ref to track active conversation to avoid dependency cycle
  const activeConversationRef = useRef<IConversation | null>(null);
  
  // Update ref when activeConversation changes
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Use callback to avoid recreation of function on each render
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        
        setConversations(data);
        
        // If active conversation exists, update it with fresh data
        if (activeConversationRef.current) {
          const updatedActiveConversation = data.find(
            (conv: IConversation) => conv._id?.toString() === activeConversationRef.current?._id?.toString()
          );
          
          if (updatedActiveConversation) {
            setActiveConversation(updatedActiveConversation);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []); // No dependencies to avoid circular updates

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Fetch user's conversations
    if (status === 'authenticated') {
      fetchConversations();
    }
  }, [status, router, fetchConversations]);

  const handleSelectConversation = (conversation: IConversation) => {
    setActiveConversation(conversation);
    setIsNewConversation(false);
  };

  const handleStartNewConversation = () => {
    setActiveConversation(null);
    setIsNewConversation(true);
  };

  const handleTeacherSelect = async (teacher: TeacherType) => {
    try {
      // Ensure points are not null before proceeding
      if (points === null) {
        throw new Error('Points information not available');
      }
      
      // Check and consume points first
      const success = await consumePoints(POINT_CONSUMPTION.CONVERSATION_CHAT);
      if (!success) {
        throw new Error('Not enough points');
      }
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacher }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        setConversations([newConversation, ...conversations]);
        setActiveConversation(newConversation);
        setIsNewConversation(false);
        return newConversation;
      } else {
        // If API call fails, refresh points to get accurate count
        refreshPoints();
        throw new Error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error; // Re-throw so the TeacherSelection component can catch it
    }
  };
  
  // Handle silent conversation updates - this won't trigger a rerender of the ChatInterface
  const handleConversationUpdate = useCallback(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Left sidebar - Conversation list */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">Conversations</h1>
          <div className="flex items-center gap-3">
            <div className="text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full">
              ポイント: <span className="font-semibold">{isPointsLoading || points === null ? "..." : points}</span>
            </div>
            <button
              onClick={handleStartNewConversation}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              disabled={isPointsLoading || points === null || points < POINT_CONSUMPTION.CONVERSATION_CHAT}
            >
              New Chat
            </button>
          </div>
        </div>
        {/* @ts-ignore */}
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversation?._id?.toString()}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Right side - Chat interface */}
      <div className="flex-1 flex flex-col p-4 h-full overflow-hidden">
        {isNewConversation ? (
          /* @ts-ignore */
          <TeacherSelection 
            onSelectTeacher={handleTeacherSelect} 
            userPoints={points}
            requiredPoints={POINT_CONSUMPTION.CONVERSATION_CHAT}
          />
        ) : activeConversation && activeConversation._id ? (
          /* @ts-ignore */
          <ChatInterface 
            key={activeConversation._id.toString()} 
            conversation={activeConversation} 
            onConversationUpdate={handleConversationUpdate} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <h2 className="text-xl font-semibold mb-4">Start a new conversation</h2>
            <p className="text-gray-600 mb-4">Chat with our AI teachers to practice your English skills</p>
            {(isPointsLoading || points === null) ? null : points < POINT_CONSUMPTION.CONVERSATION_CHAT && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
                ポイントが不足しています。必要なポイント: {POINT_CONSUMPTION.CONVERSATION_CHAT}, 現在のポイント: {points}
              </div>
            )}
            <button
              onClick={handleStartNewConversation}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg disabled:opacity-50"
              disabled={isPointsLoading || points === null || points < POINT_CONSUMPTION.CONVERSATION_CHAT}
            >
              Start New Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 