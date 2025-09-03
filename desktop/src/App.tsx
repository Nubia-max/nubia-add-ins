import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import { callOpenAI, hasApiKey, getStoredApiKey, setStoredApiKey } from './api';
import { analyzeExcelCommand, simulateExcelAutomation, ExcelTask } from './excel';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isMarkdown?: boolean;
  excelTask?: ExcelTask;
  automationProgress?: {
    currentStep: number;
    totalSteps: number;
    stepText: string;
  };
}

const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! I'm Nubia, your AI-powered Excel automation assistant. How can I help you today?", isUser: false, timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(getStoredApiKey());
  const [automationMode, setAutomationMode] = useState<'visual' | 'background'>('visual');
  const [showAbout, setShowAbout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (inputText.trim()) {
      const userMessage = inputText.trim();
      const newMessage: Message = {
        id: Date.now(),
        text: userMessage,
        isUser: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      setIsThinking(true);
      
      // Check for Excel automation
      const excelTask = analyzeExcelCommand(userMessage);
      
      if (excelTask) {
        // Show automation detection
        const automationMessage: Message = {
          id: Date.now() + 1,
          text: `🤖 Excel automation detected! Task: ${excelTask.type.toUpperCase()}\n\nI'll ${automationMode === 'visual' ? 'visually demonstrate' : 'run in background'} the following steps:`,
          isUser: false,
          timestamp: new Date(),
          excelTask
        };
        setMessages(prev => [...prev, automationMessage]);
        setIsThinking(false);
        
        // Start automation simulation
        try {
          await simulateExcelAutomation(excelTask, (step, stepText) => {
            setMessages(prev => prev.map(msg => 
              msg.id === automationMessage.id 
                ? {
                    ...msg,
                    automationProgress: {
                      currentStep: step,
                      totalSteps: excelTask.steps.length,
                      stepText
                    }
                  }
                : msg
            ));
          });
          
          // Show completion
          const completionMessage: Message = {
            id: Date.now() + 2,
            text: `✅ Excel automation completed successfully!\n\nWhat would you like me to help you with next?`,
            isUser: false,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, completionMessage]);
        } catch (error) {
          const errorMessage: Message = {
            id: Date.now() + 2,
            text: "❌ Excel automation encountered an error. Please try again.",
            isUser: false,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Regular AI response
        try {
          const aiResponse = await callOpenAI(userMessage);
          const botResponse: Message = {
            id: Date.now() + 1,
            text: aiResponse,
            isUser: false,
            timestamp: new Date(),
            isMarkdown: true
          };
          setMessages(prev => [...prev, botResponse]);
        } catch (error) {
          const errorResponse: Message = {
            id: Date.now() + 1,
            text: "Sorry, I encountered an error. Please try again.",
            isUser: false,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorResponse]);
        } finally {
          setIsThinking(false);
        }
      }
    }
  };

  const handleSaveApiKey = () => {
    setStoredApiKey(tempApiKey);
    setShowSettings(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const deleteMessage = (id: number) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const exportChatHistory = () => {
    const chatText = messages.map(msg => 
      `${msg.isUser ? 'You' : 'Nubia'} (${msg.timestamp.toLocaleString()}): ${msg.text}`
    ).join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nubia-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredMessages = messages.filter(msg => 
    searchQuery === '' || 
    msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && isOpen) {
        handleSendMessage();
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inputText]);

  return (
    <div className="app">
      {!isOpen && (
        <div 
          className="floating-bubble"
          onClick={() => setIsOpen(true)}
        >
          <div className="bubble-content">💬</div>
        </div>
      )}
      
      {isOpen && (
        <div className="chat-container" ref={chatContainerRef}>
          <div className="chat-header">
            <h3>Nubia Chat</h3>
            <div className="header-controls">
              <div className="automation-mode">
                <label>Mode:</label>
                <select 
                  value={automationMode} 
                  onChange={(e) => setAutomationMode(e.target.value as 'visual' | 'background')}
                  className="mode-select"
                >
                  <option value="visual">Visual</option>
                  <option value="background">Background</option>
                </select>
              </div>
              <div className="search-container">
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            <div className="header-buttons">
              <button 
                className="action-button"
                onClick={exportChatHistory}
                title="Export Chat History"
              >
                📥
              </button>
              <button 
                className="action-button"
                onClick={() => setShowAbout(true)}
                title="About Nubia"
              >
                ℹ️
              </button>
              <button 
                className="settings-button"
                onClick={() => setShowSettings(true)}
                title={hasApiKey() ? "API Key Set" : "Set API Key"}
              >
                ⚙️ {hasApiKey() ? "✓" : "!"}
              </button>
              <button 
                className="close-button"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </div>
          
          <div className="messages-container">
            {filteredMessages.map(message => (
              <div 
                key={message.id}
                className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
              >
                <div className="message-bubble">
                  <div className="message-content">
                    {message.isMarkdown ? (
                      <div dangerouslySetInnerHTML={{ 
                        __html: message.text.replace(/\n/g, '<br>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/`(.*?)`/g, '<code>$1</code>')
                      }} />
                    ) : (
                      message.text
                    )}
                    
                    {message.excelTask && (
                      <div className="excel-task-info">
                        <div className="task-type">
                          📊 {message.excelTask.type.toUpperCase()} - {message.excelTask.complexity}
                        </div>
                        <div className="automation-steps">
                          {message.excelTask.steps.map((step, index) => (
                            <div 
                              key={index}
                              className={`step ${
                                message.automationProgress && index <= message.automationProgress.currentStep 
                                  ? 'completed' : 'pending'
                              } ${
                                message.automationProgress && index === message.automationProgress.currentStep 
                                  ? 'active' : ''
                              }`}
                            >
                              {message.automationProgress && index === message.automationProgress.currentStep && (
                                <span className="step-indicator">⚡</span>
                              )}
                              {message.automationProgress && index < message.automationProgress.currentStep && (
                                <span className="step-indicator">✅</span>
                              )}
                              {step}
                            </div>
                          ))}
                        </div>
                        {message.automationProgress && (
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{
                                width: `${(message.automationProgress.currentStep / message.automationProgress.totalSteps) * 100}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="message-actions">
                    <button 
                      className="action-btn"
                      onClick={() => copyMessage(message.text)}
                      title="Copy message"
                    >
                      📋
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => deleteMessage(message.id)}
                      title="Delete message"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            
            {isThinking && (
              <div className="message bot-message">
                <div className="message-content thinking">
                  <span className="thinking-dots">Thinking...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="input-container">
            <div className="input-wrapper">
              <button 
                className="file-upload-btn"
                title="Upload Excel file (Coming soon)"
              >
                📎
              </button>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message... (Ctrl+Enter to send, Shift+Enter for new line)"
                className="message-input"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '40px',
                  maxHeight: '120px',
                  resize: 'none'
                }}
              />
              <button 
                onClick={handleSendMessage}
                className="send-button"
                disabled={!inputText.trim()}
              >
                ▶️
              </button>
            </div>
            <div className="input-hints">
              <span className="hint">💡 Try: "Create a chart", "Calculate totals", "Format cells"</span>
            </div>
          </div>
        </div>
      )}
      
      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-modal">
            <div className="settings-header">
              <h3>⚙️ Settings</h3>
              <button 
                className="close-button"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="setting-group">
                <label htmlFor="api-key">OpenAI API Key:</label>
                <input
                  id="api-key"
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="api-key-input"
                />
                <p className="help-text">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Dashboard</a>
                </p>
              </div>
              
              <div className="setting-group">
                <label>Default Automation Mode:</label>
                <select 
                  value={automationMode} 
                  onChange={(e) => setAutomationMode(e.target.value as 'visual' | 'background')}
                  className="mode-select"
                >
                  <option value="visual">Visual - Show Excel automation steps</option>
                  <option value="background">Background - Run silently</option>
                </select>
              </div>
              
              <div className="settings-buttons">
                <button onClick={() => setShowSettings(false)} className="cancel-button">
                  Cancel
                </button>
                <button onClick={handleSaveApiKey} className="save-button">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showAbout && (
        <div className="settings-overlay">
          <div className="settings-modal about-modal">
            <div className="settings-header">
              <h3>ℹ️ About Nubia</h3>
              <button 
                className="close-button"
                onClick={() => setShowAbout(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="about-info">
                <div className="app-logo">🤖</div>
                <h2>Nubia</h2>
                <p className="version">Version 1.0.0</p>
                <p className="description">
                  AI-powered Excel automation assistant that helps you automate spreadsheet tasks with natural language commands.
                </p>
                
                <div className="feature-list">
                  <h4>Features:</h4>
                  <ul>
                    <li>✅ AI-powered chat interface</li>
                    <li>✅ Excel automation detection & simulation</li>
                    <li>✅ Visual and background automation modes</li>
                    <li>✅ Professional message management</li>
                    <li>✅ Export chat history</li>
                    <li>✅ Keyboard shortcuts</li>
                  </ul>
                </div>
                
                <div className="shortcuts-info">
                  <h4>Keyboard Shortcuts:</h4>
                  <div className="shortcuts">
                    <div><kbd>Ctrl</kbd> + <kbd>Enter</kbd> - Send message</div>
                    <div><kbd>Esc</kbd> - Close chat</div>
                    <div><kbd>Shift</kbd> + <kbd>Enter</kbd> - New line</div>
                  </div>
                </div>
                
                <p className="footer">Built with ❤️ for productivity enthusiasts</p>
              </div>
              
              <div className="settings-buttons">
                <button onClick={() => setShowAbout(false)} className="save-button">
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;