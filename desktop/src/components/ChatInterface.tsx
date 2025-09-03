import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { VoiceRecorder } from './VoiceRecorder';
import { EnhancedSettingsPanel } from './EnhancedSettingsPanel';
import { ConnectionStatus } from './ConnectionStatus';
import { AutomationModeToggle } from './AutomationModeToggle';
import AutomationStatus from './AutomationStatus';
import ExcelShortcuts from './ExcelShortcuts';
import ExcelFileManager from './ExcelFileManager';
import DemoModePanel from './DemoModePanel';
import ErrorPanel from './ErrorPanel';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { Message } from '../types';
import { llmService } from '../services/llm';
import { storageService } from '../services/storage';
import { automationService, AutomationProgress } from '../services/automation';
import type { ExcelTask } from '../services/excelParser';
import { excelFileHandler, FileOperationResult, ExcelFile } from '../services/excelFileHandler';
import { demoModeService, DemoScenario } from '../services/demoMode';
import { errorHandler, ErrorInfo } from '../services/errorHandler';

interface ChatInterfaceProps {
  onMinimize: () => void;
}

const NubiaIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    className={className}
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="headerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.7)" />
      </linearGradient>
    </defs>
    <path 
      d="M8 6h3l8 12V6h3v20h-3l-8-12v12H8V6z" 
      fill="url(#headerLogoGradient)"
    />
    <circle 
      cx="25" 
      cy="9" 
      r="2" 
      fill="rgba(255,255,255,0.8)"
    />
  </svg>
);

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onMinimize }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [automationMode, setAutomationMode] = useState<'visual' | 'background'>('visual');
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [activeExcelTask, setActiveExcelTask] = useState<ExcelTask | null>(null);
  const [automationProgress, setAutomationProgress] = useState<AutomationProgress | null>(null);
  const [showAutomationStatus, setShowAutomationStatus] = useState(false);
  const [showExcelShortcuts, setShowExcelShortcuts] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Monitor error count
    const updateErrorCount = () => {
      const stats = errorHandler.getErrorStats();
      setErrorCount(stats.unresolved);
    };

    // Set up error listener
    const handleNewError = (error: ErrorInfo) => {
      updateErrorCount();
      
      // Add error notification to chat if user exists
      if (user && error.severity === 'critical') {
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: `🚨 **Critical Error:** ${error.message}\n\n${error.details ? error.details : 'Check the error panel for more details and recovery options.'}`,
          sender: 'assistant',
          timestamp: new Date(),
          userId: user.id
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    };

    errorHandler.addErrorListener(handleNewError);
    updateErrorCount();

    // Update error count periodically
    const interval = setInterval(updateErrorCount, 5000);

    return () => {
      errorHandler.removeErrorListener(handleNewError);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    // Load chat history on component mount
    const loadChatHistory = async () => {
      try {
        const chatHistory = await storageService.getChatHistory();
        if (chatHistory.length > 0) {
          // Load the most recent chat
          const latestChat = chatHistory[0];
          const historyMessages: Message[] = latestChat.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: new Date(msg.timestamp),
            userId: user?.id
          }));
          setMessages(historyMessages);
        } else {
          // Add welcome message for new users
          const welcomeMessage: Message = {
            id: 'welcome',
            content: `👋 Hello! I'm Nubia, your AI assistant specialized in Excel automation and accounting.

I can help you with:
• **Data entry and manipulation** - Automating repetitive data tasks
• **Formula creation** - Building complex calculations and logic  
• **Charts and visualizations** - Creating professional dashboards
• **Financial analysis** - Accounting and business intelligence
• **Macro development** - Advanced automation scripts

What Excel task can I help you with today?`,
            sender: 'assistant',
            timestamp: new Date(),
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    if (user) {
      loadChatHistory();
    }
  }, [user]);

  const handleSendMessage = async (content: string) => {
    if (!user || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Convert messages to chat history format
      const chatMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        timestamp: msg.timestamp
      }));

      // Add current user message
      chatMessages.push({
        id: userMessage.id,
        content: userMessage.content,
        role: 'user' as const,
        timestamp: userMessage.timestamp
      });

      // Get LLM response
      const response = await llmService.sendMessage(content, chatMessages);

      // Create assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        sender: 'assistant',
        timestamp: new Date(),
        userId: user.id
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to storage
      const updatedChatMessages = [...chatMessages, {
        id: assistantMessage.id,
        content: assistantMessage.content,
        role: 'assistant' as const,
        timestamp: assistantMessage.timestamp
      }];

      await storageService.saveChatHistory({
        id: 'current-chat',
        messages: updatedChatMessages,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Handle Excel tasks
      if (response.excelTask) {
        setActiveExcelTask(response.excelTask);
        setShowAutomationStatus(true);
        
        // Task will be displayed in automation status
        
        // Add status message for Excel automation
        const automationMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: `🔧 **Nubia is working on Excel...** \n\n📋 **Task:** ${response.excelTask?.description || 'Excel task'}\n⚙️ **Mode:** ${response.excelTask?.mode || 'visual'}\n📊 **Complexity:** ${response.excelTask?.complexity || 'simple'}`,
          sender: 'assistant',
          timestamp: new Date(),
          userId: user.id
        };
        
        setMessages(prev => [...prev, automationMessage]);
        
        // Execute the Excel task with progress tracking
        try {
          const result = await automationService.executeTask(response.excelTask, (progress: AutomationProgress) => {
            setAutomationProgress(progress);
            setCurrentTask(progress.currentStep || response.excelTask?.description || 'Processing...');
            setTaskProgress(progress.progress);
          });

          if (result.success) {
            // Add completion message
            const completionMessage: Message = {
              id: (Date.now() + 3).toString(),
              content: `✅ **Excel task completed successfully!**\n\n${response.excelTask?.description || 'Excel task'}\n\nThe task was executed in ${response.excelTask?.mode || 'visual'} mode and took approximately ${result.estimatedDuration || 'a few'} seconds.`,
              sender: 'assistant',
              timestamp: new Date(),
              userId: user.id
            };
            setMessages(prev => [...prev, completionMessage]);
          } else {
            // Add failure message
            const failureMessage: Message = {
              id: (Date.now() + 3).toString(),
              content: `❌ **Excel task failed**\n\nI encountered an issue while trying to complete: ${response.excelTask?.description || 'Excel task'}\n\nError: ${result.message}`,
              sender: 'assistant',
              timestamp: new Date(),
              userId: user.id
            };
            setMessages(prev => [...prev, failureMessage]);
          }
        } catch (error) {
          console.error('Automation execution error:', error);
          const errorMessage: Message = {
            id: (Date.now() + 3).toString(),
            content: `⚠️ **Automation Error**\n\nI couldn't complete the Excel task due to a technical error. Please check that the automation service is running and try again.`,
            sender: 'assistant',
            timestamp: new Date(),
            userId: user.id
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          // Clean up automation state
          setTimeout(() => {
            setActiveExcelTask(null);
            setAutomationProgress(null);
            setCurrentTask(null);
            setTaskProgress(0);
            setShowAutomationStatus(false);
          }, 3000);
        }
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error while processing your message. Please try again.',
        sender: 'assistant',
        timestamp: new Date(),
        userId: user.id
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceMessage = (transcript: string) => {
    if (transcript.trim()) {
      handleSendMessage(transcript);
    }
  };

  const handleExcelShortcut = async (task: ExcelTask) => {
    if (!user) return;

    // Add user message for the shortcut action
    const shortcutMessage: Message = {
      id: Date.now().toString(),
      content: `📋 **Excel Shortcut:** ${task.description}`,
      sender: 'user',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, shortcutMessage]);

    // Set up automation state
    setActiveExcelTask(task);
    setShowAutomationStatus(true);
    
    // Task will be displayed in automation status
    
    // Add status message for Excel automation
    const automationMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: `🔧 **Nubia is working on Excel...** \n\n📋 **Task:** ${task.description}\n⚙️ **Mode:** ${task.mode}\n📊 **Complexity:** ${task.complexity}`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };
    
    setMessages(prev => [...prev, automationMessage]);
    
    // Execute the Excel task with progress tracking
    try {
      const result = await automationService.executeTask(task, (progress: AutomationProgress) => {
        setAutomationProgress(progress);
        setCurrentTask(progress.currentStep || task.description);
        setTaskProgress(progress.progress);
      });

      if (result.success) {
        // Add completion message
        const completionMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: `✅ **Excel task completed successfully!**\n\n${task.description}\n\nThe task was executed in ${task.mode} mode and took approximately ${result.estimatedDuration || 'a few'} seconds.`,
          sender: 'assistant',
          timestamp: new Date(),
          userId: user.id
        };
        setMessages(prev => [...prev, completionMessage]);
      } else {
        // Add failure message
        const failureMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: `❌ **Excel task failed**\n\nI encountered an issue while trying to complete: ${task.description}\n\nError: ${result.message}`,
          sender: 'assistant',
          timestamp: new Date(),
          userId: user.id
        };
        setMessages(prev => [...prev, failureMessage]);
      }
    } catch (error) {
      console.error('Automation execution error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `⚠️ **Automation Error**\n\nI couldn't complete the Excel task due to a technical error. Please check that the automation service is running and try again.`,
        sender: 'assistant',
        timestamp: new Date(),
        userId: user.id
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      // Clean up automation state
      setTimeout(() => {
        setActiveExcelTask(null);
        setAutomationProgress(null);
        setCurrentTask(null);
        setTaskProgress(0);
        setShowAutomationStatus(false);
      }, 3000);
    }
  };

  const handleFileOperation = (result: FileOperationResult) => {
    if (!user) return;

    // Add message about file operation result
    const operationMessage: Message = {
      id: Date.now().toString(),
      content: result.success 
        ? `✅ **File Operation:** ${result.message}`
        : `❌ **File Operation Failed:** ${result.message}${result.error ? `\n\nError: ${result.error}` : ''}`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, operationMessage]);
  };

  const handleFileSelect = (file: ExcelFile) => {
    if (!user) return;

    // Add message about file selection
    const selectMessage: Message = {
      id: Date.now().toString(),
      content: `📂 **File Selected:** ${file.name}\n\n📊 ${file.sheets.length} sheet${file.sheets.length !== 1 ? 's' : ''} • ${file.type.toUpperCase()} format`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, selectMessage]);
  };

  const handleDemoStart = (scenario: DemoScenario) => {
    if (!user) return;

    // Add message about demo start
    const demoMessage: Message = {
      id: Date.now().toString(),
      content: `🎬 **Demo Started:** ${scenario.name}\n\n📝 **Description:** ${scenario.description}\n⏱️ **Estimated Duration:** ${Math.floor(scenario.estimatedDuration / 60)}m ${scenario.estimatedDuration % 60}s\n\n🚀 Watch as Nubia demonstrates Excel automation capabilities!`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, demoMessage]);
  };

  const handleDemoProgress = (progress: AutomationProgress) => {
    // Update automation progress state for UI updates
    setAutomationProgress(progress);
    setCurrentTask(progress.currentStep || 'Running demo...');
    setTaskProgress(progress.progress);
    setShowAutomationStatus(true);
  };

  const handleDemoComplete = () => {
    if (!user) return;

    // Add completion message
    const completionMessage: Message = {
      id: Date.now().toString(),
      content: `✅ **Demo Complete!**\n\n🎉 The Excel automation demo has finished successfully. All simulated tasks were completed.\n\n💡 **Next Steps:**\n• Try the Excel shortcuts for quick tasks\n• Connect your Python automation service for real Excel control\n• Explore the file manager to work with Excel files`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, completionMessage]);

    // Clean up demo state
    setTimeout(() => {
      setAutomationProgress(null);
      setCurrentTask(null);
      setTaskProgress(0);
      setShowAutomationStatus(false);
    }, 3000);
  };

  const handleErrorResolved = (errorId: string) => {
    if (!user) return;

    // Add message about error resolution
    const resolvedMessage: Message = {
      id: Date.now().toString(),
      content: `✅ **Error Resolved**\n\nA system error has been successfully resolved through automatic recovery.`,
      sender: 'assistant',
      timestamp: new Date(),
      userId: user.id
    };

    setMessages(prev => [...prev, resolvedMessage]);
  };

  const handleClearChat = async () => {
    setMessages([]);
    try {
      await storageService.clearChatHistory();
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const handleExportChat = () => {
    const chatData = {
      messages,
      exportedAt: new Date().toISOString(),
      user: user?.email
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `nubia-chat-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div 
      className={`
        w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in
        ${theme === 'dark' 
          ? 'bg-surface-900/95 backdrop-blur-xl border border-surface-700/50' 
          : 'bg-white/95 backdrop-blur-xl border border-surface-200/50'
        }
      `}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Enhanced Header */}
      <div 
        className="relative overflow-hidden"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-nubia">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-50" />
        </div>

        <div className="relative flex items-center justify-between p-4 z-10">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                <NubiaIcon className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                <ConnectionStatus isConnected={isConnected} />
              </div>
              {errorCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {errorCount > 9 ? '9+' : errorCount}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">Nubia AI</h1>
              <p className="text-white/80 text-sm font-medium">Excel Automation Assistant</p>
            </div>
          </div>
          
          <div 
            className="flex items-center space-x-2"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Automation Mode Toggle */}
            <AutomationModeToggle
              mode={automationMode}
              onChange={setAutomationMode}
            />
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            {/* Excel Shortcuts Button */}
            <button
              onClick={() => setShowExcelShortcuts(!showExcelShortcuts)}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title="Excel Quick Actions"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            
            {/* File Manager Button */}
            <button
              onClick={() => setShowFileManager(!showFileManager)}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title="Excel File Manager"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
              </svg>
            </button>
            
            {/* Demo Mode Button */}
            <button
              onClick={() => setShowDemoPanel(!showDemoPanel)}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title="Demo Mode"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V7a3 3 0 11-6 0V4a3 3 0 116 0v3M5 18v3h3m12 0v-3h-3M5 6V3h3m12 0v3h-3" />
              </svg>
            </button>
            
            {/* Error Panel Button */}
            <button
              onClick={() => setShowErrorPanel(!showErrorPanel)}
              className={`p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20 relative ${
                errorCount > 0 ? 'animate-pulse' : ''
              }`}
              title={errorCount > 0 ? `${errorCount} system errors` : 'Error Management'}
            >
              <svg className={`w-5 h-5 ${errorCount > 0 ? 'text-red-300' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {errorCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {errorCount > 9 ? '9+' : errorCount}
                </div>
              )}
            </button>
            
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="settings-button p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title="Settings"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            {/* Minimize Button */}
            <button
              onClick={onMinimize}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              title="Minimize to bubble"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar for active tasks */}
        {currentTask && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Task Status Bar */}
      {currentTask && (
        <div className={`px-4 py-2 border-b text-sm ${
          theme === 'dark' 
            ? 'bg-surface-800 border-surface-700 text-surface-300' 
            : 'bg-surface-50 border-surface-200 text-surface-600'
        }`}>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span className="font-medium">Running task:</span>
            <span className="truncate">{currentTask}</span>
            <span className="ml-auto text-xs">{taskProgress}%</span>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <EnhancedSettingsPanel 
          onClose={() => setShowSettings(false)}
          onClearChat={handleClearChat}
          onExportChat={handleExportChat}
        />
      )}

      {/* Automation Status Panel */}
      {showAutomationStatus && activeExcelTask && (
        <div className="px-4 pt-4">
          <AutomationStatus
            theme={theme}
            onModeSwitch={(newMode) => {
              if (activeExcelTask) {
                setAutomationMode(newMode);
                // Optionally restart task with new mode
              }
            }}
            onAbort={(taskId) => {
              setActiveExcelTask(null);
              setAutomationProgress(null);
              setShowAutomationStatus(false);
              setCurrentTask(null);
            }}
          />
        </div>
      )}

      {/* Excel Shortcuts Panel */}
      {showExcelShortcuts && (
        <div className={`border-b ${ 
          theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
        }`}>
          <ExcelShortcuts
            theme={theme}
            onShortcutClick={handleExcelShortcut}
            disabled={isLoading || !isConnected}
          />
        </div>
      )}

      {/* File Manager Panel */}
      {showFileManager && (
        <div className={`border-b ${ 
          theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
        }`}>
          <ExcelFileManager
            theme={theme}
            onFileOperation={handleFileOperation}
            onFileSelect={handleFileSelect}
          />
        </div>
      )}

      {/* Demo Mode Panel */}
      {showDemoPanel && (
        <div className={`border-b ${ 
          theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
        }`}>
          <DemoModePanel
            theme={theme}
            onDemoStart={handleDemoStart}
            onDemoProgress={handleDemoProgress}
            onDemoComplete={handleDemoComplete}
          />
        </div>
      )}

      {/* Error Panel */}
      {showErrorPanel && (
        <div className={`border-b ${ 
          theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
        }`}>
          <ErrorPanel
            theme={theme}
            onErrorResolved={handleErrorResolved}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          messagesEndRef={messagesEndRef}
          theme={theme}
        />
      </div>

      {/* Input Area */}
      <div className={`border-t p-4 ${
        theme === 'dark' 
          ? 'border-surface-700 bg-surface-800/50' 
          : 'border-surface-200 bg-surface-50/50'
      } backdrop-blur-sm`}>
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <MessageInput 
              onSend={handleSendMessage} 
              disabled={isLoading || !isConnected}
              theme={theme}
            />
          </div>
          <VoiceRecorder 
            onTranscript={handleVoiceMessage} 
            disabled={isLoading || !isConnected}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
};