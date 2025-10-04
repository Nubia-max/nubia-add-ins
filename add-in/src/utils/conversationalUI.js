/**
 * Conversational UI Helper Functions
 * Handles Claude Code-like thinking display and approval dialogs
 */

// Add thinking message to chat (like Claude Code's thinking indicator)
function addThinkingMessage(thinking) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message thinking-message';

    messageDiv.innerHTML = `
        <div class="message-avatar thinking-avatar">🤔</div>
        <div class="message-content thinking-content">
            <div class="thinking-header">Thinking...</div>
            <div class="thinking-text">${escapeHtml(thinking)}</div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show approval dialog for code execution
function showApprovalDialog(code, description) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const approvalContainer = document.createElement('div');
    approvalContainer.className = 'ai-approval-container';
    const containerId = `approval-${Date.now()}`;
    approvalContainer.id = containerId;

    approvalContainer.innerHTML = `
        <div class="ai-edit-card approval-dialog">
            <div class="ai-edit-header">
                <div class="ai-edit-title">
                    <span class="ai-icon">🤖</span>
                    <span>Moose wants to modify your Excel sheet</span>
                </div>
                <div class="ai-edit-description">
                    ${escapeHtml(description)}
                </div>
            </div>

            <div class="ai-edit-preview">
                <div class="preview-header">
                    <span class="code-icon">⚡</span>
                    <span>Code to execute:</span>
                </div>
                <pre class="code-block"><code class="language-javascript">${escapeHtml(code)}</code></pre>
            </div>

            <div class="ai-edit-actions">
                <button id="approveBtn-${containerId}" class="approve-btn">
                    <span class="btn-icon">✅</span>
                    <span>Apply Changes</span>
                </button>
                <button id="rejectBtn-${containerId}" class="reject-btn">
                    <span class="btn-icon">❌</span>
                    <span>Reject</span>
                </button>
            </div>
        </div>
    `;

    chatMessages.appendChild(approvalContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add event listeners
    document.getElementById(`approveBtn-${containerId}`).addEventListener('click', async () => {
        approvalContainer.remove();
        window.FeedbackSystem.executingCode();

        try {
            await executeStreamedCode(code);
            addSystemMessage('✅ Code executed successfully', 'success');
            window.FeedbackSystem.success('✅ Done');
        } catch (error) {
            console.error('Code execution failed:', error);
            addSystemMessage('❌ Code execution failed: ' + error.message, 'error');
            window.FeedbackSystem.error(error);
        }
    });

    document.getElementById(`rejectBtn-${containerId}`).addEventListener('click', () => {
        approvalContainer.remove();
        addSystemMessage('❌ Code execution rejected by user', 'info');
        window.FeedbackSystem.setStatus('Code execution rejected', 'info', 3000);
    });
}

// Add CSS for thinking messages and approval dialogs
function injectConversationalStyles() {
    const styleId = 'conversational-ui-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        /* Thinking message styles */
        .thinking-message {
            background: #f8f9fa;
            border-left: 4px solid #8B4513;
            margin: 10px 0;
            padding: 12px;
            border-radius: 8px;
            opacity: 0.9;
        }

        .thinking-avatar {
            background: #8B4513 !important;
            color: white !important;
        }

        .thinking-content {
            font-style: italic;
        }

        .thinking-header {
            font-weight: bold;
            color: #8B4513;
            margin-bottom: 6px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .thinking-text {
            color: #666;
            line-height: 1.4;
        }

        /* Approval dialog styles */
        .approval-dialog {
            border: 2px solid #ff9800 !important;
            background: #fff8f0 !important;
            animation: pulse-border 2s infinite;
        }

        @keyframes pulse-border {
            0%, 100% { border-color: #ff9800; }
            50% { border-color: #ffc107; }
        }

        .ai-edit-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 15px;
        }

        .approve-btn, .reject-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .approve-btn {
            background: #4CAF50;
            color: white;
        }

        .approve-btn:hover {
            background: #45a049;
            transform: translateY(-1px);
        }

        .reject-btn {
            background: #f44336;
            color: white;
        }

        .reject-btn:hover {
            background: #da190b;
            transform: translateY(-1px);
        }

        .btn-icon {
            font-size: 14px;
        }
    `;
    document.head.appendChild(styles);
}

// Auto-inject styles when this module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectConversationalStyles);
} else {
    injectConversationalStyles();
}

// Export functions for global access
window.addThinkingMessage = addThinkingMessage;
window.showApprovalDialog = showApprovalDialog;

export { addThinkingMessage, showApprovalDialog };