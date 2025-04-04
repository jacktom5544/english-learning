'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { IConversation } from '@/models/Conversation';
import { format } from 'date-fns';
import { TEACHER_PROFILES, TeacherType } from '@/lib/teachers';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { useUserPoints } from '@/components/providers/UserPointsProvider';
import TypingIndicator from './TypingIndicator';
import Image from 'next/image';

interface ChatInterfaceProps {
  conversation: IConversation;
  onConversationUpdate: () => void;
}

type Message = {
  _id?: string;
  sender: 'user' | 'teacher';
  content: string;
  correctedText?: string | null;
  correctionExplanation?: string | null;
  timestamp: Date | string;
};

export default function ChatInterface({ conversation, onConversationUpdate }: ChatInterfaceProps) {
  const { data: session } = useSession();
  const { consumePoints } = useUserPoints();
  const [messages, setMessages] = useState<Message[]>(conversation.messages.map(msg => ({...msg, timestamp: new Date(msg.timestamp)})) || []);
  const [newMessage, setNewMessage] = useState('');
  const [isGrammarCorrectionEnabled, setIsGrammarCorrectionEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTeacherTyping, setIsTeacherTyping] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [inputError, setInputError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef(conversation);
  const onUpdateRef = useRef(onConversationUpdate);
  const teacherProfile = TEACHER_PROFILES[conversation.teacher as TeacherType];
  
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);
  
  useEffect(() => {
    onUpdateRef.current = onConversationUpdate;
  }, [onConversationUpdate]);

  useEffect(() => {
    setMessages(conversation.messages.map(msg => ({...msg, timestamp: new Date(msg.timestamp)})) || []);
  }, [conversation._id, conversation.messages]);

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
    setInputError(count > 200 ? 'Please limit your message to 200 words' : '');
  };

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || isLoading || wordCount > 200) {
      if (wordCount > 200) setInputError('Please limit your message to 200 words');
      return;
    }

    setInputError('');
    const userMessageContent = sanitizeInput(trimmedMessage);
    setIsLoading(true);

    const optimisticUserMessage: Message = {
      sender: 'user' as const,
      content: userMessageContent,
      timestamp: new Date(),
      correctedText: null,
      correctionExplanation: null
    };
    
    const optimisticTimestamp = (optimisticUserMessage.timestamp as Date).toISOString();

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setNewMessage('');
    setWordCount(0);

    setTimeout(() => setIsTeacherTyping(true), 300);

    try {
      const pointsConsumed = await consumePoints(POINT_CONSUMPTION.CONVERSATION_CHAT);
      if (!pointsConsumed) throw new Error('Not enough points');

      const response = await fetch(`/api/conversations/${conversationRef.current._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessageContent,
          skipPointsConsumption: true,
        }),
      });

      setIsTeacherTyping(false);

      if (response.ok) {
        const data = await response.json();

        if (data && data.userMessage && data.teacherMessage) {
          const backendUserMessage: Message = { ...data.userMessage, timestamp: new Date(data.userMessage.timestamp) };
          const backendTeacherMessage: Message = { ...data.teacherMessage, timestamp: new Date(data.teacherMessage.timestamp) };

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
        ? "Not enough points. Please check your profile."
        : (error instanceof Error ? error.message : "An error occurred.");

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
          {teacherProfile?.imageUrl && <Image src={teacherProfile.imageUrl} alt={teacherProfile.name} fill className="object-cover" />}
        </div>
        <div className="ml-3">
          <h3 className="font-semibold text-gray-800">{teacherProfile?.name || 'Teacher'}</h3>
          {teacherProfile && <p className="text-xs text-gray-500">{teacherProfile.origin}, {teacherProfile.age} • {teacherProfile.teachingStyle}</p>}
        </div>
      </div>
    );
  }, [teacherProfile]);

  const formatTimestamp = (timestamp: Date | string): string => {
    try { return format(new Date(timestamp), 'p'); } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-gray-100">
      {renderTeacherInfo()}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={message._id || `msg-${index}`} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.sender === 'teacher' && teacherProfile?.imageUrl && (
              <div className="w-8 h-8 relative rounded-full overflow-hidden mr-2 self-end flex-shrink-0">
                <Image src={teacherProfile.imageUrl} alt={teacherProfile.name} fill className="object-cover" />
              </div>
            )}
            <div className={`rounded-2xl px-4 py-2 max-w-[75%] shadow-sm ${ message.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none' }`}>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
              
              {message.sender === 'user' && message.correctionExplanation && (
                <div className={`mt-2 p-3 rounded-lg border text-xs transition-opacity duration-300 ${ isGrammarCorrectionEnabled ? 'opacity-100 bg-green-50 border-green-200 text-green-800' : 'opacity-0 hidden' }`}>
                  <p className="font-semibold mb-1">Grammar correction:</p>
                  {message.correctedText && (
                    <p className="mb-1 font-medium">"{message.correctedText}"</p>
                  )}
                  <p className="text-green-700">{message.correctionExplanation}</p>
                </div>
              )}
              <span className={`text-xs block text-right mt-1.5 ${message.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            {message.sender === 'user' && session?.user?.image && (
              <div className="w-8 h-8 rounded-full bg-gray-300 ml-2 overflow-hidden self-end flex-shrink-0">
                <img src={session.user.image} alt="User" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        ))}
        {isTeacherTyping && <TypingIndicator teacher={conversation.teacher as TeacherType} />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="grammar-check" className="flex items-center text-sm font-medium text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              id="grammar-check"
              checked={isGrammarCorrectionEnabled}
              onChange={(e) => setIsGrammarCorrectionEnabled(e.target.checked)}
              className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            Show grammar check
          </label>
          <p className={`text-xs ${wordCount > 200 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
            {wordCount}/200
          </p>
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className={`flex-1 px-4 py-2 border rounded-lg shadow-sm ${inputError ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out text-sm`}
            disabled={isLoading}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={isLoading || !newMessage.trim() || !!inputError}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Send'}
          </button>
        </form>
        <div className="h-4 mt-1">
          {inputError && <p className="text-xs text-red-500">{inputError}</p>}
        </div>
      </div>
    </div>
  );
} 