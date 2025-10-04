/**
 * Unified Live Feedback System
 *
 * Provides real-time visual feedback for AI actions throughout the Excel add-in
 * Shows status like "🧠 Thinking...", "✅ Done", "⚠️ Error", "⚡ Streaming tokens..."
 * Just like Claude Code's glowing thinking indicator
 */

export const FeedbackSystem = (() => {
  let statusBar = null;
  let currentTimeout = null;
  let isInitialized = false;

  /**
   * Initialize the feedback system
   * Creates the status bar and injects styles
   */
  function initialize() {
    if (isInitialized) return;

    console.log('🎯 Initializing AI Feedback System...');

    // Create status bar element
    statusBar = document.createElement('div');
    statusBar.className = 'ai-status-bar hidden';
    statusBar.id = 'ai-feedback-bar';

    // Insert into body or taskpane container
    const container = document.body || document.documentElement;
    container.appendChild(statusBar);

    // Inject CSS styles
    injectStyles();

    isInitialized = true;
    console.log('✅ AI Feedback System initialized');
  }

  /**
   * Inject CSS styles for the feedback system
   */
  function injectStyles() {
    const styleId = 'ai-feedback-styles';

    // Don't inject styles twice
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      /* AI Status Bar Styles */
      .ai-status-bar {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #111;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.3s ease;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 120px;
        text-align: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .ai-status-bar.hidden {
        opacity: 0;
        transform: translateY(20px);
        pointer-events: none;
      }

      .ai-status-bar.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* Status Type Styles */
      .ai-status-bar.loading {
        background: linear-gradient(45deg, #444, #666);
        animation: pulse 2s infinite;
      }

      .ai-status-bar.thinking {
        background: linear-gradient(45deg, #8B4513, #A0522D);
        animation: glow 2s infinite;
      }

      .ai-status-bar.stream {
        background: linear-gradient(45deg, #0052cc, #0066ff);
        animation: stream 1.5s infinite;
      }

      .ai-status-bar.success {
        background: linear-gradient(45deg, #0f9d58, #2ecc71);
      }

      .ai-status-bar.error {
        background: linear-gradient(45deg, #c62828, #e74c3c);
        animation: shake 0.5s ease-in-out;
      }

      .ai-status-bar.warning {
        background: linear-gradient(45deg, #ff9800, #ffc107);
      }

      .ai-status-bar.info {
        background: linear-gradient(45deg, #2196f3, #03a9f4);
      }

      /* Animations */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      @keyframes glow {
        0%, 100% { box-shadow: 0 4px 12px rgba(139, 69, 19, 0.3); }
        50% { box-shadow: 0 4px 20px rgba(139, 69, 19, 0.6); }
      }

      @keyframes stream {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .ai-status-bar {
          bottom: 10px;
          right: 10px;
          font-size: 11px;
          padding: 6px 10px;
          min-width: 100px;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .ai-status-bar {
          border: 2px solid white;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .ai-status-bar {
          animation: none !important;
          transition: opacity 0.2s ease;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Set status with message and type
   * @param {string} message - Status message to display
   * @param {string} type - Status type (loading, thinking, stream, success, error, warning, info)
   * @param {number} duration - Auto-hide duration in ms (0 = don't auto-hide)
   */
  function setStatus(message, type = 'info', duration = 0) {
    if (!isInitialized) initialize();

    console.log(`📊 Status: ${message} (${type})`);

    // Clear any existing timeout
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      currentTimeout = null;
    }

    // Update status bar
    statusBar.textContent = message;
    statusBar.className = `ai-status-bar visible ${type}`;

    // Auto-hide after duration if specified
    if (duration > 0) {
      currentTimeout = setTimeout(() => {
        hide();
      }, duration);
    }
  }

  /**
   * Hide the status bar
   */
  function hide() {
    if (!statusBar) return;

    statusBar.className = 'ai-status-bar hidden';

    if (currentTimeout) {
      clearTimeout(currentTimeout);
      currentTimeout = null;
    }
  }

  /**
   * Show the status bar (if hidden)
   */
  function show() {
    if (!statusBar) return;

    statusBar.classList.remove('hidden');
    statusBar.classList.add('visible');
  }

  /**
   * Quick status methods for common operations
   */
  function startThinking(message = '🧠 AI is thinking...') {
    setStatus(message, 'thinking');
  }

  function startLoading(message = '⏳ Loading...') {
    setStatus(message, 'loading');
  }

  function streaming(message = '⚡ Streaming live response...') {
    setStatus(message, 'stream');
  }

  function streamingTokens(tokenCount = 0) {
    setStatus(`⚡ Streaming... ${tokenCount} tokens`, 'stream');
  }

  function success(message = '✅ Done', duration = 3000) {
    setStatus(message, 'success', duration);
  }

  function error(err, duration = 5000) {
    const message = typeof err === 'string' ? err : (err?.message || 'Unknown error');
    setStatus(`⚠️ Error: ${message}`, 'error', duration);
  }

  function warning(message, duration = 4000) {
    setStatus(`⚠️ ${message}`, 'warning', duration);
  }

  function info(message, duration = 3000) {
    setStatus(`ℹ️ ${message}`, 'info', duration);
  }

  /**
   * Context-aware status updates
   */
  function contextBuilding() {
    setStatus('📊 Analyzing Excel context...', 'thinking');
  }

  function aiGenerating() {
    setStatus('🤖 AI generating response...', 'thinking');
  }

  function executingCode() {
    setStatus('⚡ Executing Excel code...', 'loading');
  }

  function awaitingApproval() {
    setStatus('👤 Awaiting user approval...', 'warning');
  }

  function creditsDeducted(credits) {
    setStatus(`💳 ${credits} credits used`, 'info', 2000);
  }

  /**
   * Progress tracking
   */
  function progress(message, percentage) {
    if (percentage !== undefined) {
      setStatus(`${message} (${Math.round(percentage)}%)`, 'loading');
    } else {
      setStatus(message, 'loading');
    }
  }

  /**
   * Clear all status
   */
  function clear() {
    hide();
  }

  /**
   * Get current status
   */
  function getCurrentStatus() {
    return statusBar ? {
      message: statusBar.textContent,
      type: statusBar.className.split(' ').pop(),
      visible: statusBar.classList.contains('visible')
    } : null;
  }

  // Public API
  return {
    initialize,
    setStatus,
    hide,
    show,
    clear,
    getCurrentStatus,

    // Quick methods
    startThinking,
    startLoading,
    streaming,
    streamingTokens,
    success,
    error,
    warning,
    info,
    progress,

    // Context-aware methods
    contextBuilding,
    aiGenerating,
    executingCode,
    awaitingApproval,
    creditsDeducted
  };
})();

// Auto-initialize when module loads
document.addEventListener('DOMContentLoaded', () => {
  FeedbackSystem.initialize();
});

// Also initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    FeedbackSystem.initialize();
  });
} else {
  FeedbackSystem.initialize();
}

// Export for global access
window.FeedbackSystem = FeedbackSystem;

export default FeedbackSystem;