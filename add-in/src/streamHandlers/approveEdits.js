/**
 * AI Edit Approval System
 *
 * Provides human-in-the-loop approval for AI-generated Excel code
 * Enables safe AI-driven editing with user review - like Claude Code
 */

import { applyGeneratedCode } from './applyGeneratedCode.js';

/**
 * Show approval prompt for AI-generated Excel code
 * @param {Object} aiResponse - AI response containing code and description
 * @param {Function} onApprove - Callback when user approves
 * @param {Function} onReject - Callback when user rejects
 */
export function approveEditPrompt(aiResponse, onApprove = null, onReject = null) {
    console.log('📋 Showing edit approval prompt for AI response');

    const { code, understanding, message, confidence } = aiResponse;

    // Create approval container
    const approvalContainer = document.createElement('div');
    approvalContainer.className = 'ai-approval-container';
    approvalContainer.id = `approval-${Date.now()}`;

    // Determine confidence level styling
    const confidenceClass = getConfidenceClass(confidence);
    const confidenceText = confidence ? `${Math.round(confidence * 100)}%` : 'Unknown';

    approvalContainer.innerHTML = `
        <div class="ai-edit-card">
            <div class="ai-edit-header">
                <div class="ai-edit-title">
                    <span class="ai-icon">🤖</span>
                    <span>AI wants to edit your Excel sheet</span>
                    <span class="confidence-badge ${confidenceClass}">${confidenceText}</span>
                </div>
                <div class="ai-edit-description">
                    ${escapeHtml(understanding || message || 'Excel operation')}
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
                <button id="approveBtn-${approvalContainer.id}" class="approve-btn">
                    <span class="btn-icon">✅</span>
                    <span>Apply Changes</span>
                </button>
                <button id="rejectBtn-${approvalContainer.id}" class="reject-btn">
                    <span class="btn-icon">❌</span>
                    <span>Reject</span>
                </button>
                <button id="copyBtn-${approvalContainer.id}" class="copy-btn">
                    <span class="btn-icon">📋</span>
                    <span>Copy Code</span>
                </button>
            </div>

            <div class="ai-edit-warning">
                <span class="warning-icon">⚠️</span>
                <span>Review the code carefully before applying. Changes will modify your Excel workbook.</span>
            </div>
        </div>
    `;

    // Insert into chat messages area
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.appendChild(approvalContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Setup event handlers
    setupApprovalHandlers(approvalContainer.id, aiResponse, onApprove, onReject);

    return approvalContainer;
}

/**
 * Setup event handlers for approval buttons
 */
function setupApprovalHandlers(containerId, aiResponse, onApprove, onReject) {
    const approveBtn = document.getElementById(`approveBtn-${containerId}`);
    const rejectBtn = document.getElementById(`rejectBtn-${containerId}`);
    const copyBtn = document.getElementById(`copyBtn-${containerId}`);
    const container = document.getElementById(containerId);

    if (approveBtn) {
        approveBtn.onclick = async () => {
            console.log('✅ User approved AI edit');

            // Disable buttons during execution
            setButtonsLoading(containerId, true);

            try {
                // Apply the generated code
                const result = await applyGeneratedCode(aiResponse);

                if (result.success) {
                    // Show success feedback
                    showApprovalFeedback(container, 'success', '✅ Changes applied successfully!');

                    // Call onApprove callback
                    if (onApprove) onApprove(result);

                } else {
                    // Show error feedback
                    showApprovalFeedback(container, 'error', `❌ Failed to apply changes: ${result.message}`);
                }

            } catch (error) {
                console.error('Error applying AI edit:', error);
                showApprovalFeedback(container, 'error', `❌ Execution error: ${error.message}`);
            }

            // Remove approval after 3 seconds
            setTimeout(() => {
                if (container && container.parentNode) {
                    container.remove();
                }
            }, 3000);
        };
    }

    if (rejectBtn) {
        rejectBtn.onclick = () => {
            console.log('❌ User rejected AI edit');

            // Show rejection feedback
            showApprovalFeedback(container, 'info', '❌ Changes rejected by user');

            // Call onReject callback
            if (onReject) onReject();

            // Remove approval after 1 second
            setTimeout(() => {
                if (container && container.parentNode) {
                    container.remove();
                }
            }, 1000);
        };
    }

    if (copyBtn) {
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(aiResponse.code);

                // Show copy feedback
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="btn-icon">✅</span><span>Copied!</span>';

                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);

            } catch (error) {
                console.error('Failed to copy code:', error);
                // Fallback for older browsers
                fallbackCopyToClipboard(aiResponse.code);
            }
        };
    }
}

/**
 * Set loading state for approval buttons
 */
function setButtonsLoading(containerId, isLoading) {
    const approveBtn = document.getElementById(`approveBtn-${containerId}`);
    const rejectBtn = document.getElementById(`rejectBtn-${containerId}`);

    if (approveBtn) {
        approveBtn.disabled = isLoading;
        if (isLoading) {
            approveBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Applying...</span>';
        }
    }

    if (rejectBtn) {
        rejectBtn.disabled = isLoading;
    }
}

/**
 * Show feedback after approval/rejection
 */
function showApprovalFeedback(container, type, message) {
    const actionsDiv = container.querySelector('.ai-edit-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <div class="approval-feedback ${type}">
                <span>${message}</span>
            </div>
        `;
    }
}

/**
 * Get CSS class for confidence level
 */
function getConfidenceClass(confidence) {
    if (!confidence) return 'confidence-unknown';
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
}

/**
 * Fallback copy to clipboard for older browsers
 */
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        console.log('Code copied using fallback method');
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }

    document.body.removeChild(textArea);
}

/**
 * Quick approval for high-confidence responses
 * Bypasses UI for responses with >95% confidence
 */
export function quickApproveIfHighConfidence(aiResponse, onApprove = null) {
    const { confidence, code } = aiResponse;

    // Only auto-approve simple, high-confidence operations
    if (confidence && confidence > 0.95 && code && code.length < 500) {
        console.log('🚀 Auto-approving high-confidence AI edit');

        // Apply immediately without UI
        return applyGeneratedCode(aiResponse)
            .then(result => {
                if (onApprove) onApprove(result);
                return result;
            })
            .catch(error => {
                console.error('Auto-approval failed:', error);
                // Fall back to manual approval on error
                return approveEditPrompt(aiResponse, onApprove);
            });
    }

    // Show manual approval for everything else
    return approveEditPrompt(aiResponse, onApprove);
}

/**
 * Batch approval for multiple edits
 * Useful when AI suggests multiple related changes
 */
export function approveBatchEdits(aiResponses, onComplete = null) {
    console.log(`📋 Showing batch approval for ${aiResponses.length} AI edits`);

    let currentIndex = 0;

    function processNext() {
        if (currentIndex >= aiResponses.length) {
            if (onComplete) onComplete();
            return;
        }

        const response = aiResponses[currentIndex];
        currentIndex++;

        approveEditPrompt(response,
            () => processNext(), // On approve, move to next
            () => processNext()  // On reject, also move to next
        );
    }

    processNext();
}

/**
 * Check if response contains executable code
 */
export function containsExecutableCode(aiResponse) {
    const { code, message } = aiResponse;

    // Check if there's actual Office.js code
    if (!code || typeof code !== 'string') return false;

    // Look for Office.js patterns
    const officePatterns = [
        'Excel.run',
        'context.workbook',
        'worksheet',
        'getRange',
        'setValue',
        'context.sync'
    ];

    return officePatterns.some(pattern =>
        code.toLowerCase().includes(pattern.toLowerCase())
    );
}

/**
 * Escape HTML for security
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Export all functions
export {
    quickApproveIfHighConfidence,
    approveBatchEdits,
    containsExecutableCode
};