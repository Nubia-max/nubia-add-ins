import React, { useState, useRef } from 'react';
import { cloudApi } from '../services/cloudApi';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}

interface FinancialResult {
  success: boolean;
  structure?: any;
  excel?: any;
  tokensUsed?: number;
  error?: string;
}

const FinancialGPT: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'system',
      content: '🎯 **Nubia GPT Financial Freedom Mode** 🎯\n\nI have COMPLETE FREEDOM to create ANY financial document you need!\n\nJust tell me what you want and I\'ll:\n✨ Decide what worksheets to create\n✨ Design the perfect column structure\n✨ Add formulas and calculations\n✨ Create multiple related documents\n✨ Format everything professionally\n\n**Examples to try:**\n• "Track my restaurant daily sales and calculate taxes"\n• "I bought Bitcoin for $50k, sold for $75k - handle the paperwork"\n• "Prepare loan application documents for my bakery"\n• "Create expense tracking for my consulting business"\n• "Set up inventory management for my online store"',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Call the new GPT-driven financial generation API
      const result = await cloudApi.generateFinancialDocument(
        userMessage.content,
        { 
          history: commandHistory,
          conversation: messages.slice(-5) // Last 5 messages for context
        },
        {
          autoOpen: true,
          filename: `nubia-${Date.now()}.xlsx`
        }
      );

      console.log('🎯 GPT Result:', result);

      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `✅ **Financial Documents Created Successfully!**\n\n${formatSuccessMessage(result.result)}`,
          timestamp: new Date(),
          metadata: result.result
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Update command history for better context
        setCommandHistory(prev => [...prev, {
          command: userMessage.content,
          timestamp: new Date(),
          success: true,
          result: result.result
        }]);

      } else {
        throw new Error(result.error || 'Failed to generate financial document');
      }

    } catch (error: any) {
      console.error('❌ Financial generation error:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: `❌ **Error:** ${error.message}\n\nPlease try rephrasing your request or contact support if the issue persists.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSuccessMessage = (result: any): string => {
    let message = '';
    
    if (result.structure?.worksheets) {
      const worksheetCount = result.structure.worksheets.length;
      message += `📊 **Created ${worksheetCount} worksheet${worksheetCount > 1 ? 's' : ''}:**\n\n`;
      
      result.structure.worksheets.forEach((sheet: any, index: number) => {
        message += `${index + 1}. **${sheet.name}**`;
        if (sheet.description) {
          message += ` - ${sheet.description}`;
        }
        message += '\n';
        
        if (sheet.columns) {
          message += `   📝 Columns: ${sheet.columns.map((col: any) => col.header).join(', ')}\n`;
        }
        
        if (sheet.formulas && sheet.formulas.length > 0) {
          message += `   🧮 Formulas: ${sheet.formulas.length} calculations added\n`;
        }
        
        message += '\n';
      });
    }

    if (result.excel?.filepath) {
      message += `📁 **File saved:** ${result.excel.filename}\n`;
      message += `🚀 **Status:** Excel file opened automatically\n\n`;
    }

    if (result.tokensUsed) {
      message += `🤖 **AI Processing:** ${result.tokensUsed} tokens used\n`;
    }

    if (result.structure?.suggestions) {
      message += `💡 **Next steps you might want:**\n`;
      result.structure.suggestions.forEach((suggestion: string) => {
        message += `• ${suggestion}\n`;
      });
    }

    return message;
  };

  const renderMessage = (message: ChatMessage) => {
    let className = 'mb-4 p-4 rounded-lg ';
    
    switch (message.type) {
      case 'user':
        className += 'bg-blue-50 border-l-4 border-blue-400 ml-8';
        break;
      case 'assistant':
        className += 'bg-green-50 border-l-4 border-green-400 mr-8';
        break;
      case 'system':
        className += 'bg-gray-50 border-l-4 border-gray-400';
        break;
    }

    return (
      <div key={message.id} className={className}>
        <div className="flex items-center mb-2">
          <div className="text-sm font-medium">
            {message.type === 'user' && '👤 You'}
            {message.type === 'assistant' && '🤖 Nubia GPT'}
            {message.type === 'system' && '🔔 System'}
          </div>
          <div className="text-xs text-gray-500 ml-auto">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        <div className="prose prose-sm max-w-none">
          {message.content.split('\n').map((line, index) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <div key={index} className="font-bold text-gray-800">{line.slice(2, -2)}</div>;
            }
            if (line.startsWith('•')) {
              return <div key={index} className="ml-4">{line}</div>;
            }
            if (line.startsWith('✨') || line.startsWith('📊') || line.startsWith('📝') || line.startsWith('🧮')) {
              return <div key={index} className="text-gray-700">{line}</div>;
            }
            return <div key={index}>{line || <br />}</div>;
          })}
        </div>
        
        {message.metadata?.structure && (
          <div className="mt-3 p-3 bg-white rounded border">
            <div className="text-sm text-gray-600">
              📋 Created {message.metadata.structure.worksheets?.length || 0} worksheets with complete GPT freedom
            </div>
          </div>
        )}
      </div>
    );
  };

  const quickExamples = [
    "Track my restaurant's daily sales and expenses",
    "I bought Bitcoin for $50k and sold for $75k",
    "Create expense tracking for my consulting business",
    "Prepare loan application financial documents",
    "Set up inventory management for my store"
  ];

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-4 rounded-lg mb-4">
        <h2 className="text-xl font-bold">🎯 Nubia Financial GPT - Complete Freedom Mode</h2>
        <p className="text-sm opacity-90 mt-1">
          Tell me ANY financial need and I'll create the perfect documents with complete creative freedom!
        </p>
      </div>

      {/* Quick Examples */}
      {messages.length <= 1 && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-medium text-gray-800 mb-2">🚀 Try these examples:</h3>
          <div className="space-y-2">
            {quickExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => setInputValue(example)}
                className="block w-full text-left text-sm text-gray-700 hover:text-blue-600 hover:bg-white p-2 rounded transition-colors"
              >
                • {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map(renderMessage)}
        {isProcessing && (
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-lg mr-8">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <div className="text-sm text-gray-600">
                GPT is analyzing your request and creating the perfect financial documents...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t pt-4">
        <div className="flex space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tell me what financial documents you need... (e.g., 'Track my restaurant sales and taxes')"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? '🧠 Thinking...' : '🚀 Generate'}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          💡 Pro tip: Be specific about your business type and what you want to track for best results!
        </div>
      </form>
    </div>
  );
};

export default FinancialGPT;