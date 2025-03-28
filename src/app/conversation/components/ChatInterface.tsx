'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { IConversation } from '@/models/Conversation';
import { format } from 'date-fns';
import { TEACHER_PROFILES } from '@/lib/teachers';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceProps {
  conversation: IConversation;
  onConversationUpdate: () => void;
}

type Message = {
  sender: 'user' | 'teacher';
  content: string;
  correctedContent?: string;
  timestamp: Date;
};

export default function ChatInterface({ conversation, onConversationUpdate }: ChatInterfaceProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isGrammarCorrectionEnabled, setIsGrammarCorrectionEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTeacherTyping, setIsTeacherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef(conversation);
  const onUpdateRef = useRef(onConversationUpdate);
  const teacherProfile = TEACHER_PROFILES[conversation.teacher];
  
  // Keep refs updated with latest props
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);
  
  useEffect(() => {
    onUpdateRef.current = onConversationUpdate;
  }, [onConversationUpdate]);

  // Initial load of messages
  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation?._id]); // Only reload messages when conversation ID changes

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTeacherTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Memoize handleSendMessage to prevent recreations
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    const userMessageContent = newMessage.trim();
    setIsLoading(true);
    
    try {
      const userMessage = {
        sender: 'user' as const,
        content: userMessageContent,
        timestamp: new Date(),
      };
      
      // Add user message to UI immediately
      setMessages((prev) => [...prev, userMessage]);
      setNewMessage('');
      
      // Show typing indicator after a short delay
      setTimeout(() => {
        setIsTeacherTyping(true);
      }, 500);

      // Send message to API
      const response = await fetch(`/api/conversations/${conversationRef.current._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessageContent,
          grammarCorrection: isGrammarCorrectionEnabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Hide typing indicator before showing the response
        setIsTeacherTyping(false);
        
        // Slight delay before showing teacher's response for more natural flow
        setTimeout(() => {
          // Update local messages state instead of refreshing the entire conversation
          setMessages(data.messages);
          
          // Update the parent component silently in the background
          // This ensures the conversation list is up-to-date but doesn't refresh the interface
          setTimeout(() => {
            onUpdateRef.current();
          }, 1000);
        }, 300);
      } else {
        setIsTeacherTyping(false);
        console.error('Failed to send message');
      }
    } catch (error) {
      setIsTeacherTyping(false);
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [newMessage, isLoading, isGrammarCorrectionEnabled]);

  const renderTeacherInfo = useCallback(() => {
    return (
      <div className="flex items-center p-4 border-b">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
          {teacherProfile.name[0]}
        </div>
        <div className="ml-3">
          <h3 className="font-medium">{teacherProfile.name}</h3>
          <p className="text-sm text-gray-500">
            {teacherProfile.origin}, {teacherProfile.age} • {teacherProfile.teachingStyle}
          </p>
        </div>
      </div>
    );
  }, [teacherProfile]);

  return (
    <div className="flex flex-col h-full rounded-lg border bg-white overflow-hidden">
      {renderTeacherInfo()}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'teacher' && (
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-2">
                {teacherProfile.name[0]}
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-lg p-3 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p>{message.content}</p>
              {message.correctedContent && isGrammarCorrectionEnabled && (
                <div className="mt-2 p-2 bg-green-100 text-green-800 rounded text-sm">
                  <p className="font-medium mb-1">Grammar correction:</p>
                  <p>{message.correctedContent}</p>
                </div>
              )}
              <div
                className={`text-xs mt-1 ${
                  message.sender === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}
              >
                {format(new Date(message.timestamp), 'h:mm a')}
              </div>
            </div>
            {message.sender === 'user' && session?.user?.image && (
              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center ml-2 overflow-hidden">
                <img src={session.user.image} alt="User" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        ))}
        
        {isTeacherTyping && (
          <TypingIndicator teacher={conversation.teacher} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isGrammarCorrectionEnabled}
              onChange={() => setIsGrammarCorrectionEnabled(!isGrammarCorrectionEnabled)}
              className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            Enable grammar correction
          </label>
        </div>
        <form onSubmit={handleSendMessage} className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-4 py-2 bg-blue-600 text-white rounded-r-lg ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
} 