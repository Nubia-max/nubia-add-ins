import React from 'react';
import { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  theme: 'light' | 'dark';
}

const UserAvatar: React.FC = () => (
  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-sm">
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </div>
);

const AIAvatar: React.FC = () => (
  <div className="w-8 h-8 bg-gradient-nubia rounded-full flex items-center justify-center shadow-sm">
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  </div>
);

const TypingIndicator: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => (
  <div className="flex justify-start animate-slide-up">
    <div className="flex items-end space-x-2">
      <AIAvatar />
      <div className={`
        px-4 py-3 rounded-2xl rounded-bl-lg shadow-sm
        ${theme === 'dark' 
          ? 'bg-surface-800 border border-surface-700' 
          : 'bg-white border border-surface-200'
        }
      `}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full animate-typing ${
                theme === 'dark' ? 'bg-surface-400' : 'bg-surface-500'
              }`}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  messagesEndRef,
  theme 
}) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-full ${
          theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
        }`}>
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-nubia rounded-full flex items-center justify-center shadow-lg animate-float">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            {/* Ambient particles */}
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-primary-400/40 rounded-full animate-float"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 2) * 40}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: '4s'
                }}
              />
            ))}
          </div>
          <div className="text-center max-w-sm">
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              Welcome to Nubia AI! 👋
            </h3>
            <p className="text-sm leading-relaxed">
              I'm your Excel automation assistant. I can help you with:
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[
                '📊 Create charts & graphs',
                '📋 Build pivot tables',
                '🔢 Write formulas',
                '🎨 Format spreadsheets'
              ].map((item, i) => (
                <div 
                  key={i} 
                  className={`p-2 rounded-lg ${
                    theme === 'dark' ? 'bg-surface-800/50' : 'bg-surface-100/50'
                  } animate-fade-in`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${
              message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              {/* Avatar */}
              {message.sender === 'user' ? <UserAvatar /> : <AIAvatar />}
              
              {/* Message bubble */}
              <div
                className={`px-4 py-3 rounded-2xl shadow-sm backdrop-blur-sm transition-colors duration-200 ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-lg'
                    : theme === 'dark'
                      ? 'bg-surface-800 border border-surface-700 text-surface-100 rounded-bl-lg'
                      : 'bg-white border border-surface-200 text-surface-800 rounded-bl-lg'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' 
                    ? 'text-primary-100' 
                    : theme === 'dark' 
                      ? 'text-surface-400' 
                      : 'text-surface-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
      
      {/* Enhanced typing indicator */}
      {isLoading && <TypingIndicator theme={theme} />}
      
      <div ref={messagesEndRef} />
    </div>
  );
};