'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ICoachingSession } from '@/models/Coaching';
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from '@/lib/japanese-teachers';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import { format } from 'date-fns';
import Image from 'next/image';
import TypingIndicator from './TypingIndicator';

interface CoachingInterfaceProps {
  session: ICoachingSession;
  onSessionUpdate: () => void;
}

type Message = {
  _id?: string;
  sender: 'user' | 'teacher';
  content: string;
  timestamp: Date | string;
};

export default function CoachingInterface({ session, onSessionUpdate }: CoachingInterfaceProps) {
  const { data: sessionData } = useSession();
  const { consumePoints } = useUserPoints();
  const [messages, setMessages] = useState<Message[]>(
    session.messages.map(msg => ({
      ...msg,
      _id: msg._id ? msg._id.toString() : undefined,
      timestamp: new Date(msg.timestamp)
    })) || []
  );
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTeacherTyping, setIsTeacherTyping] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [inputError, setInputError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  const onUpdateRef = useRef(onSessionUpdate);
  const teacherKey = session.teacher as JapaneseTeacherKey;
  const teacherProfile = JAPANESE_TEACHER_PROFILES[teacherKey];
  
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  
  useEffect(() => {
    onUpdateRef.current = onSessionUpdate;
  }, [onSessionUpdate]);

  useEffect(() => {
    setMessages(
      session.messages.map(msg => ({
        ...msg,
        _id: msg._id ? msg._id.toString() : undefined,
        timestamp: new Date(msg.timestamp)
      })) || []
    );
  }, [session._id, session.messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTeacherTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sanitizeInput = (input: string): string => {
    return input.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const count = countWords(text);
    setNewMessage(text);
    setWordCount(count);
    setInputError(count > 200 ? '200単語までに制限してください' : '');
  };

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || isLoading || wordCount > 200) {
      if (wordCount > 200) setInputError('200単語までに制限してください');
      return;
    }

    setInputError('');
    const userMessageContent = sanitizeInput(trimmedMessage);
    setIsLoading(true);

    // Optimistic user message update
    const optimisticUserMessage: Message = {
      sender: 'user' as const,
      content: userMessageContent,
      timestamp: new Date(),
    };
    
    const optimisticTimestamp = (optimisticUserMessage.timestamp as Date).toISOString();

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setNewMessage('');
    setWordCount(0);

    setTimeout(() => setIsTeacherTyping(true), 300);

    try {
      const pointsConsumed = await consumePoints(POINT_CONSUMPTION.COACHING_MESSAGE);
      if (!pointsConsumed) throw new Error('Not enough points');

      const response = await fetch(`/api/coaching/${sessionRef.current._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessageContent,
        }),
      });

      setIsTeacherTyping(false);

      if (response.ok) {
        const data = await response.json();

        if (data && data.userMessage && data.teacherMessage) {
          const backendUserMessage: Message = { 
            ...data.userMessage, 
            _id: data.userMessage._id ? data.userMessage._id.toString() : undefined,
            timestamp: new Date(data.userMessage.timestamp) 
          };
          const backendTeacherMessage: Message = { 
            ...data.teacherMessage, 
            _id: data.teacherMessage._id ? data.teacherMessage._id.toString() : undefined,
            timestamp: new Date(data.teacherMessage.timestamp) 
          };

          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const indexToUpdate = updatedMessages.findIndex(
              m => m.sender === 'user' && m.timestamp instanceof Date && m.timestamp.toISOString() === optimisticTimestamp
            );

            if (indexToUpdate !== -1) {
              updatedMessages[indexToUpdate] = backendUserMessage;
            } else {
              console.warn("Could not find optimistic message to update by timestamp.");
              if (!updatedMessages.some(m => m._id === backendUserMessage._id)) {
                updatedMessages.push(backendUserMessage);
              }
            }
            if (!updatedMessages.some(m => m._id === backendTeacherMessage._id)) {
              updatedMessages.push(backendTeacherMessage);
            }
            return updatedMessages;
          });

          setTimeout(() => { onUpdateRef.current(); }, 1000);

        } else {
          console.error('Unexpected success response format:', data);
          throw new Error("Unexpected response from server.");
        }
      } else {
        let errorData = { error: "Unknown error" };
        try { errorData = await response.json(); } catch { /* ignore */ }
        
        setMessages(prev => prev.filter(m => !(m.sender === 'user' && m.timestamp instanceof Date && m.timestamp.toISOString() === optimisticTimestamp)));

        if (response.status === 403 && errorData.error === 'Not enough points') {
          throw new Error('Not enough points');
        } else {
          console.error('Failed to send message:', errorData);
          throw new Error("Message sending failed.");
        }
      }
    } catch (error) {
      setIsTeacherTyping(false);
      setIsLoading(false);
      console.error('Error in handleSendMessage:', error);

      setMessages(prev => prev.filter(m => !(m.sender === 'user' && m.timestamp instanceof Date && m.timestamp.toISOString() === optimisticTimestamp)));

      const errorMessage = (error instanceof Error && error.message === 'Not enough points')
        ? "ポイントが不足しています。プロフィールページをご確認ください。"
        : (error instanceof Error ? error.message : "エラーが発生しました。");

      const systemErrorMessage: Message = {
        sender: 'teacher' as const, content: `Error: ${errorMessage}`, timestamp: new Date()
      };
      setMessages((prev) => [...prev, systemErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [newMessage, isLoading, consumePoints, wordCount, messages]);

  const renderTeacherInfo = useCallback(() => {
    return (
      <div className="flex items-center p-4 border-b bg-white">
        <div className="w-10 h-10 relative rounded-full overflow-hidden flex-shrink-0">
          {teacherProfile?.image && <Image src={teacherProfile.image} alt={teacherProfile.name} width={40} height={40} className="object-cover" />}
        </div>
        <div className="ml-3">
          <h3 className="font-semibold text-gray-800">{teacherProfile?.name || '先生'}</h3>
          <p className="text-xs text-gray-500">コーチングセッション</p>
        </div>
      </div>
    );
  }, [teacherProfile]);

  const formatTimestamp = (timestamp: Date | string): string => {
    try { return format(new Date(timestamp), 'HH:mm'); } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-gray-100">
      {renderTeacherInfo()}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={message._id || `msg-${index}`} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.sender === 'teacher' && teacherProfile?.image && (
              <div className="w-8 h-8 relative rounded-full overflow-hidden mr-2 self-end flex-shrink-0">
                <Image src={teacherProfile.image} alt={teacherProfile.name} width={32} height={32} className="object-cover" />
              </div>
            )}
            <div className={`rounded-2xl px-4 py-2 max-w-[75%] shadow-sm ${ message.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none' }`}>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
              <span className={`text-xs block text-right mt-1.5 ${message.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            {message.sender === 'user' && sessionData?.user?.image && (
              <div className="w-8 h-8 rounded-full bg-gray-300 ml-2 overflow-hidden self-end flex-shrink-0">
                <img src={sessionData.user.image} alt="User" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        ))}
        {isTeacherTyping && <TypingIndicator teacherKey={teacherKey} />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-gray-50">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            disabled={isLoading}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50"
          >
            送信
          </button>
        </form>
        {inputError && <p className="mt-1 text-xs text-red-500">{inputError}</p>}
        <p className="mt-1 text-xs text-gray-500">
          {isLoading ? '送信中...' : `${wordCount}/200 words`}
        </p>
      </div>
    </div>
  );
} 