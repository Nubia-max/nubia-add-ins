import React, { useState, useEffect, useRef } from 'react';
import './ChatView.css';
import cloudApi from '../services/cloudApi';
import FileUpload from './FileUpload';
import FileUploadService, { SelectedFile } from '../services/fileUploadService';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  automationStatus?: 'pending' | 'running' | 'completed' | 'failed';
  automationProgress?: number;
  filesProcessed?: number;
}

interface ChatViewProps {
  user?: any;
  subscription?: any;
  canUseAutomation?: boolean;
  usageStatus?: any;
  onShowSubscription?: () => void;
  onShowAuth?: () => void;
  onRefreshSubscription?: () => Promise<any>;
}

const ChatView: React.FC<ChatViewProps> = ({
  user,
  subscription,
  canUseAutomation,
  usageStatus,
  onShowSubscription,
  onShowAuth,
  onRefreshSubscription
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm Nubia, your Excel automation assistant. Tell me what you'd like me to do in Excel, and I'll handle it for you!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [automationProgress, setAutomationProgress] = useState<{
    status: string;
    progress: number;
    message: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isResettingConversation, setIsResettingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribeProgress = window.electronAPI.onAutomationProgress((progress) => {
        setAutomationProgress(progress);
      });

      const unsubscribeComplete = window.electronAPI.onAutomationComplete((result) => {
        setAutomationProgress(null);
        setIsProcessing(false);
        
        const completionMessage: Message = {
          id: `system_${Date.now()}`,
          type: 'system',
          content: result.success 
            ? `✅ ${result.message || 'Task completed successfully!'}` 
            : `❌ ${result.error || 'Task failed'}`,
          timestamp: new Date(),
          automationStatus: result.success ? 'completed' : 'failed'
        };
        
        setMessages(prev => [...prev, completionMessage]);
      });

      return () => {
        unsubscribeProgress();
        unsubscribeComplete();
      };
    }
  }, []);

  const handleFilesSelected = (files: SelectedFile[]) => {
    setSelectedFiles(files);
  };

  const handleFileRemove = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || isProcessing) return;

    const hasFiles = selectedFiles.length > 0;
    const messageContent = inputValue.trim() || (hasFiles ? '[Files uploaded]' : '');
    
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: messageContent + (hasFiles ? ` (${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''})` : ''),
      timestamp: new Date(),
      filesProcessed: hasFiles ? selectedFiles.length : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const command = inputValue.trim();
    const filesToSend = [...selectedFiles];
    
    setInputValue('');
    setSelectedFiles([]);
    setIsProcessing(true);
    setUploadProgress(0);

    // Check usage limits for Excel creation
    if (!canUseAutomation) {
      // Show upgrade prompt instead of executing task
      const upgradeMessage: Message = {
        id: `system_${Date.now() + 1}`,
        type: 'system',
        content: `You've used all ${usageStatus?.limit || 10} free automations. Upgrade to continue:`,
        timestamp: new Date(),
        automationStatus: 'failed'
      };
      
      setMessages(prev => [...prev, upgradeMessage]);
      setIsProcessing(false);
      onShowSubscription?.();
      return;
    }

    // Send everything to chat - GPT decides what to do
    try {
      console.log('💬 Sending message to GPT:', command);
      if (filesToSend.length > 0) {
        console.log(`📎 Uploading ${filesToSend.length} file(s):`, filesToSend.map(f => `${f.file.name} (${(f.file.size / 1024).toFixed(1)}KB)`));
      }
      
      if (!cloudApi.isAuthenticated()) {
        console.error('❌ User not authenticated!');
        throw new Error('Authentication required. Please log in to chat.');
      }
      
      let result;
      if (filesToSend.length > 0) {
        // Send with files
        setUploadProgress(25);
        result = await FileUploadService.sendMessageWithFiles(command, filesToSend);
        setUploadProgress(100);
      } else {
        // Send text only
        result = await cloudApi.sendChatMessage(command);
      }
      
      console.log('✅ GPT response received:', result);
      
      // Always show the conversational message first
      const responseMessage: Message = {
        id: `assistant_${Date.now() + 1}`,
        type: 'assistant',
        content: result.message,
        timestamp: new Date(),
        filesProcessed: result.filesProcessed
      };
      
      setMessages(prev => [...prev, responseMessage]);
      
      // If Excel data exists, create file in background and show success message
      if (result.type === 'excel' && result.excelData) {
        console.log('🎯 Excel data detected - creating file:', result.excelData);

        // Show Excel success message (file was already created by backend)
        const successMessage: Message = {
          id: `system_${Date.now() + 2}`,
          type: 'system',
          content: `✅ Excel file created: ${result.excelData.filename}`,
          timestamp: new Date(),
          automationStatus: 'completed'
        };

        setMessages(prev => [...prev, successMessage]);

        // Refresh subscription data to update usage count
        if (onRefreshSubscription) {
          try {
            await onRefreshSubscription();
            console.log('✅ Subscription data refreshed after automation');
          } catch (error) {
            console.error('❌ Failed to refresh subscription:', error);
          }
        }
      }
      
      setIsProcessing(false);
      setUploadProgress(0);
      
    } catch (error) {
      console.error('❌ Message failed:', error);
      setIsProcessing(false);
      setUploadProgress(0);
      
      const errorMessage: Message = {
        id: `system_${Date.now() + 1}`,
        type: 'system',
        content: `❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeChat();
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeToTray();
    }
  };

  const handleNewConversation = async () => {
    try {
      setIsResettingConversation(true);
      
      // Clear conversation history on backend
      await cloudApi.clearConversationHistory();
      
      // Reset local messages to initial state
      setMessages([
        {
          id: '1',
          type: 'assistant',
          content: "Hi! I'm Nubia, your Excel automation assistant. I've started a fresh conversation. Tell me what you'd like me to do in Excel, and I'll handle it for you!",
          timestamp: new Date()
        }
      ]);
      
      // Close settings panel
      setShowSettings(false);
      
      // Show success feedback
      setTimeout(() => {
        const successMessage: Message = {
          id: `system_${Date.now()}`,
          type: 'system',
          content: '✅ Started new conversation. Previous context cleared.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to clear conversation:', error);
      
      const errorMessage: Message = {
        id: `system_${Date.now()}`,
        type: 'system',
        content: '❌ Failed to clear conversation. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsResettingConversation(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-logo">
            <svg
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 2L4 8V16C4 23.5 8.5 26.74 16 28C23.5 26.74 28 23.5 28 16V8L16 2Z"
                fill="url(#headerGradient)"
                stroke="white"
                strokeWidth="1"
              />
              <defs>
                <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333ea" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="chat-title">Nubia</span>
          {isProcessing && <span className="status-indicator">Processing...</span>}
        </div>
        <div className="chat-header-actions">
          <button className="header-btn" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10.5 3.5L14 3L15 7L11.5 8.5L10.5 12.5L8 15L5.5 12.5L4.5 8.5L1 7L2 3L5.5 3.5L8 1Z" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button className="header-btn" onClick={handleClose} title="Close chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message message-${message.type}`}
            data-status={message.automationStatus}
          >
            <div className="message-content">
              {message.content}
              {message.filesProcessed && message.filesProcessed > 0 && (
                <div className="files-processed-indicator">
                  📎 {message.filesProcessed} file{message.filesProcessed !== 1 ? 's' : ''} processed
                </div>
              )}
              {message.automationStatus === 'running' && (
                <div className="automation-indicator">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        
        {automationProgress && (
          <div className="automation-progress">
            <div className="progress-header">
              <span className="progress-status">{automationProgress.status}</span>
              <span className="progress-percentage">{automationProgress.progress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${automationProgress.progress}%` }}
              />
            </div>
            <div className="progress-message">{automationProgress.message}</div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        {/* File Upload Section - Above Input */}
        <FileUpload
          selectedFiles={selectedFiles}
          onFilesSelected={handleFilesSelected}
          onFileRemove={handleFileRemove}
          disabled={isProcessing}
        />

        {/* Upload progress indicator */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress-container">
            <div className="upload-progress-bar">
              <div 
                className="upload-progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="upload-progress-text">
              Uploading files... {uploadProgress}%
            </div>
          </div>
        )}

        {/* Main Input Row */}
        <div className="main-input-row">
          <div className="input-wrapper">
            <button
              className={`attach-button-inline ${isProcessing ? 'disabled' : ''}`}
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                fileInput?.click();
              }}
              disabled={isProcessing}
              title="Attach files (images, PDFs, spreadsheets)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
              </svg>
            </button>
            
            <textarea
              ref={inputRef}
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to process accounting documents or create Excel files..."
              disabled={isProcessing}
              rows={1}
            />
            
            <button 
              className="send-button" 
              onClick={handleSend}
              disabled={(!inputValue.trim() && selectedFiles.length === 0) || isProcessing}
            >
              {isProcessing ? (
                <div className="send-loading">
                  <div className="spinner"></div>
                </div>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path 
                    d="M2 10L17 2L13 18L11 11L2 10Z" 
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {showSettings && (
        <div className="settings-panel-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Settings</h3>
              <button className="close-settings-btn" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="settings-content">
              <div className="conversation-management">
                <h4>Conversation</h4>
                <div className="conversation-actions">
                  <button 
                    className={`new-conversation-btn ${isResettingConversation ? 'loading' : ''}`}
                    onClick={handleNewConversation}
                    disabled={isResettingConversation}
                  >
                    {isResettingConversation ? (
                      <>
                        <div className="spinner-small"></div>
                        Clearing...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        New Conversation
                      </>
                    )}
                  </button>
                  <p className="conversation-help-text">
                    Start fresh and clear all previous context. Nubia won't remember previous Excel files or conversation history.
                  </p>
                </div>
              </div>
              
              <div className="usage-stats">
                <h4>Usage Statistics</h4>
                <div className="stat-item">
                  <span className="stat-label">Automations used:</span>
                  <span className="stat-value">{usageStatus?.used || 0}/{usageStatus?.limit || 10}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Current plan:</span>
                  <span className="stat-value">{subscription?.plan || 'Free Trial'}</span>
                </div>
                {!canUseAutomation && (
                  <div className="upgrade-notice">
                    <p>You've used all {usageStatus?.limit || 10} free automations.</p>
                    <div className="upgrade-actions">
                      <button className="upgrade-btn" onClick={() => { setShowSettings(false); onShowSubscription?.(); }}>
                        Upgrade to continue
                      </button>
                      <button
                        className="refresh-btn"
                        onClick={async () => {
                          if (onRefreshSubscription) {
                            try {
                              await onRefreshSubscription();
                              console.log('✅ Subscription manually refreshed');
                            } catch (error) {
                              console.error('❌ Manual refresh failed:', error);
                            }
                          }
                        }}
                      >
                        Refresh Usage
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;