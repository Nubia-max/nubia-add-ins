import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  theme: 'light' | 'dark';
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled, theme }) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const placeholders = [
    "Create a pivot table for sales data...",
    "Format cells with conditional formatting...",
    "Add a chart showing quarterly trends...",
    "Calculate the sum of column A...",
    "Help me automate this Excel task..."
  ];

  const [placeholder] = useState(() => 
    placeholders[Math.floor(Math.random() * placeholders.length)]
  );

  return (
    <div className={`
      message-input relative rounded-2xl border transition-all duration-200
      ${isFocused 
        ? 'border-primary-500 shadow-lg ring-2 ring-primary-500/20' 
        : theme === 'dark'
          ? 'border-surface-600 hover:border-surface-500'
          : 'border-surface-300 hover:border-surface-400'
      }
      ${disabled ? 'opacity-60' : ''}
    `}>
      <div className="flex items-end space-x-3 p-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={`
              w-full resize-none border-none outline-none bg-transparent text-sm leading-relaxed
              max-h-32 min-h-[24px] scrollbar-thin
              ${theme === 'dark' 
                ? 'text-white placeholder-surface-500' 
                : 'text-surface-900 placeholder-surface-400'
              }
              disabled:cursor-not-allowed
            `}
            rows={1}
            style={{
              maxHeight: '128px',
              minHeight: '24px'
            }}
          />
          
          {/* Character counter */}
          <div className={`
            absolute bottom-1 right-2 text-xs transition-opacity duration-200
            ${message.length > 0 ? 'opacity-100' : 'opacity-0'}
            ${theme === 'dark' ? 'text-surface-500' : 'text-surface-400'}
          `}>
            {message.length}/1000
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center space-x-2">
          {/* Emoji button */}
          <button
            type="button"
            disabled={disabled}
            className={`
              p-2 rounded-lg transition-all duration-200 hover:scale-110
              ${theme === 'dark' 
                ? 'text-surface-400 hover:text-surface-200 hover:bg-surface-800' 
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title="Add emoji"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
            className={`
              group relative p-3 rounded-xl transition-all duration-200 transform
              ${!message.trim() || disabled
                ? theme === 'dark'
                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                  : 'bg-surface-200 text-surface-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 hover:scale-105 active:scale-95 shadow-lg hover:shadow-primary-500/25'
              }
            `}
          >
            {/* Send icon with animation */}
            <svg 
              className={`w-5 h-5 transition-transform duration-200 ${
                message.trim() && !disabled ? 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            
            {/* Ripple effect */}
            {message.trim() && !disabled && (
              <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
            )}
          </button>
        </div>
      </div>

      {/* Typing suggestions (when empty) */}
      {!message && !disabled && (
        <div className={`
          absolute -top-10 left-4 px-3 py-1 rounded-lg text-xs font-medium transition-opacity duration-200
          ${isFocused ? 'opacity-100' : 'opacity-0'}
          ${theme === 'dark' 
            ? 'bg-surface-800 text-surface-300 border border-surface-700' 
            : 'bg-white text-surface-600 border border-surface-200'
          }
          shadow-lg
        `}>
          💡 Try: "Create a sales chart" or "Format this table"
          <div className={`
            absolute top-full left-4 w-2 h-2 rotate-45
            ${theme === 'dark' ? 'bg-surface-800 border-r border-b border-surface-700' : 'bg-white border-r border-b border-surface-200'}
          `} />
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className={`
          absolute inset-0 rounded-2xl flex items-center justify-center
          ${theme === 'dark' ? 'bg-surface-900/80' : 'bg-white/80'}
          backdrop-blur-sm
        `}>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className={`text-sm ${theme === 'dark' ? 'text-surface-300' : 'text-surface-600'}`}>
              Processing...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};