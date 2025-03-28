'use client';

import { format } from 'date-fns';
import { IConversation } from '@/models/Conversation';

interface ConversationListProps {
  conversations: IConversation[];
  activeConversationId: string | undefined;
  onSelectConversation: (conversation: IConversation) => void;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">No conversations yet</p>
        <p className="text-sm text-gray-400 mt-2">Start a new conversation to practice English</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <div
          key={String(conversation._id)}
          onClick={() => onSelectConversation(conversation)}
          className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
            activeConversationId === String(conversation._id) ? 'bg-gray-100' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              {conversation.teacher === 'michael' ? 'M' : 'E'}
            </div>
            <div className="ml-3 flex-1 overflow-hidden">
              <div className="flex justify-between">
                <h3 className="font-medium truncate">{conversation.title}</h3>
                <span className="text-xs text-gray-500">
                  {format(new Date(conversation.lastUpdated), 'MMM d')}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {conversation.messages.length > 0
                  ? conversation.messages[conversation.messages.length - 1].content.substring(0, 50) +
                    (conversation.messages[conversation.messages.length - 1].content.length > 50 ? '...' : '')
                  : 'No messages yet'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 