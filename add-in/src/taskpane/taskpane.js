/*
 * Moose Excel Add-in - Taskpane
 * With Firebase Anonymous Authentication and Credit System
 */

console.log('🚀 Starting Moose Add-in with Anonymous Auth');

// Import unlimited executor functions
// This is a hack to include the unlimitedExecutor.js content inline
// since webpack isn't configured to handle it as a separate module

// Firebase Configuration for aibun-ai project
const firebaseConfig = {
    apiKey: "AIzaSyCWuOVIeEpK8XzSlk3hgVZho90kYH31P3c",
    authDomain: "aibun-ai.firebaseapp.com",
    projectId: "aibun-ai",
    storageBucket: "aibun-ai.firebasestorage.app",
    messagingSenderId: "966194603583",
    appId: "1:966194603583:web:07c4b19794ad441bc0fa8a"
};

// Global state
let currentUser = null;
let userCredits = 10;
let auth = null;

// Simple client-side cache with expiration
const cache = {
    data: new Map(),

    set(key, value, ttlMs = 300000) { // Default 5 minutes TTL
        const expiry = Date.now() + ttlMs;
        this.data.set(key, { value, expiry });
    },

    get(key) {
        const item = this.data.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }

        return item.value;
    },

    clear() {
        this.data.clear();
    }
};

// Initialize Firebase for anonymous auth
function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase not available, using offline mode');
            return null;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        return firebase.auth();
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        return null;
    }
}

// Set up Firebase anonymous authentication
async function setupAnonymousAuth() {
    console.log('🔐 Setting up Firebase anonymous authentication...');

    try {
        auth = initializeFirebase();

        if (!auth) {
            throw new Error('Firebase not available');
        }

        // Check if already signed in anonymously
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            currentUser = {
                uid: auth.currentUser.uid,
                isAnonymous: true,
                displayName: 'Anonymous User'
            };
            console.log('✅ Using existing Firebase anonymous user:', currentUser.uid);
            return;
        }

        // Sign in anonymously
        console.log('🔐 Signing in anonymously with Firebase...');
        const result = await auth.signInAnonymously();

        if (result.user && result.user.isAnonymous) {
            currentUser = {
                uid: result.user.uid,
                isAnonymous: true,
                displayName: 'Anonymous User'
            };
            console.log('✅ Firebase anonymous authentication successful:', currentUser.uid);
        } else {
            throw new Error('Firebase did not create anonymous user');
        }

    } catch (error) {
        console.error('Firebase anonymous authentication failed:', error);
        throw error;
    }
}

// Backend API calls
const BACKEND_URL = 'https://aibun-ai.web.app/api';

async function makeAPICall(endpoint, options = {}) {
    // Set default timeout of 3 minutes for AI operations
    const timeoutMs = options.timeout || 180000;

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
        'Content-Type': 'application/json',
        'x-anonymous-id': currentUser?.uid || 'anonymous',
        ...options.headers
    };

    // Add auth token if available
    if (auth?.currentUser) {
        try {
            const token = await auth.currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.warn('Failed to get auth token:', error);
        }
    }

    const config = {
        ...options,
        headers,
        signal: controller.signal
    };

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, config);
        clearTimeout(timeoutId); // Clear timeout on successful response

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();

    } catch (error) {
        clearTimeout(timeoutId); // Ensure timeout is cleared

        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. AI operations may take up to 3 minutes.`);
        }
        throw error;
    }
}

// Load user credits with caching
async function loadUserCredits(forceRefresh = false) {
    const cacheKey = `credits_${currentUser?.uid || 'anonymous'}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
        const cached = cache.get(cacheKey);
        if (cached) {
            userCredits = cached;
            updateCreditsDisplay();
            console.log('Credits loaded from cache:', userCredits);
            return;
        }
    }

    try {
        const response = await makeAPICall('/credits/balance');
        userCredits = response.data.credits;

        // Cache the result for 1 minute
        cache.set(cacheKey, userCredits, 60000);

        updateCreditsDisplay();
        console.log('Credits loaded from API:', userCredits);
    } catch (error) {
        console.error('Failed to load credits:', error);
        // Don't throw the error, just use default credits and update display
        userCredits = 10; // Default fallback
        updateCreditsDisplay();
    }
}

// Update credits display
function updateCreditsDisplay() {
    const creditsElement = document.getElementById('credits-display');
    if (creditsElement) {
        creditsElement.textContent = `${userCredits} credits`;

        // Add warning if credits are low
        if (userCredits <= 2) {
            creditsElement.classList.add('low-credits');
            creditsElement.title = 'Low credits! You may need to recharge soon.';
        } else {
            creditsElement.classList.remove('low-credits');
            creditsElement.title = '';
        }
    }
}

// Update status message
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
    console.log(`Status: ${message}`);
}

// Show payment modal for credit recharge
function showPaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Hide payment modal
function hidePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Handle credit purchase
async function purchaseCredits(amount) {
    if (!currentUser) {
        updateStatus('User not initialized yet, please try again', 'error');
        return;
    }

    try {
        updateStatus('Initializing payment...', 'loading');

        const response = await makeAPICall('/credits/purchase/init', {
            method: 'POST',
            body: JSON.stringify({
                amount: parseFloat(amount)
            })
        });

        if (response.success) {
            // Open Paystack payment page
            window.open(response.data.paymentUrl, '_blank');
            hidePaymentModal();
            updateStatus('Payment window opened', 'success');
        } else {
            updateStatus(response.message || 'Payment initialization failed', 'error');
        }
    } catch (error) {
        console.error('Payment error:', error);
        updateStatus('Payment failed: ' + error.message, 'error');
    }
}

// Utility functions for streaming
async function getAuthToken() {
    if (auth?.currentUser) {
        try {
            return await auth.currentUser.getIdToken();
        } catch (error) {
            console.warn('Failed to get auth token:', error);
        }
    }
    return null;
}

function getSessionId() {
    // Generate or retrieve session ID for this conversation
    let sessionId = sessionStorage.getItem('moose-session-id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('moose-session-id', sessionId);
    }
    return sessionId;
}

// Import the comprehensive Excel context builder
// Note: This will be handled by webpack bundling
async function buildExcelContext() {
    // Use the comprehensive context builder for full workbook analysis
    try {
        // This calls the dedicated utility function
        return await buildComprehensiveExcelContext();
    } catch (error) {
        console.warn('Comprehensive context failed, using fallback:', error);
        // Fallback to quick context if comprehensive fails
        return await buildQuickContext();
    }
}

// Comprehensive Excel context using the utility (will be imported via webpack)
async function buildComprehensiveExcelContext() {
    return await Excel.run(async (context) => {
        console.log('📊 Building comprehensive Excel context...');

        const workbook = context.workbook;
        const worksheets = workbook.worksheets;
        const activeWorksheet = worksheets.getActiveWorksheet();
        const selection = context.workbook.getSelectedRange();

        // Load workbook-level properties
        workbook.load(['name', 'application']);
        worksheets.load('items');
        activeWorksheet.load(['name', 'position']);
        selection.load(['address', 'rowCount', 'columnCount']);

        await context.sync();

        console.log(`📖 Workbook: "${workbook.name}" with ${worksheets.items.length} sheets`);

        const sheetsData = [];

        // Process each worksheet with comprehensive data extraction
        for (let i = 0; i < worksheets.items.length; i++) {
            const sheet = worksheets.items[i];
            const sheetData = await extractSheetData(context, sheet);
            sheetsData.push(sheetData);
        }

        // Build final context object
        const excelContext = {
            workbookName: workbook.name || 'Untitled Workbook',
            activeSheet: activeWorksheet.name,
            selectedRange: selection.address,
            totalSheets: worksheets.items.length,
            worksheets: sheetsData,
            contextSummary: generateContextSummary(sheetsData, activeWorksheet.name),
            timestamp: new Date().toISOString()
        };

        console.log('✅ Excel context built successfully:', {
            workbook: excelContext.workbookName,
            sheets: excelContext.totalSheets,
            activeSheet: excelContext.activeSheet,
            selectedRange: excelContext.selectedRange
        });

        return excelContext;
    });
}

// Extract comprehensive data from a single worksheet
async function extractSheetData(context, sheet) {
    try {
        console.log(`📋 Processing sheet: "${sheet.name}"`);

        sheet.load(['name', 'position', 'visibility']);

        let sheetData = {
            name: sheet.name,
            position: null,
            visibility: null,
            activeRange: null,
            sampleData: [],
            namedRanges: [],
            formulas: [],
            charts: [],
            rowCount: 0,
            colCount: 0,
            hasData: false
        };

        await context.sync();

        sheetData.position = sheet.position;
        sheetData.visibility = sheet.visibility;

        // Try to get used range for data extraction
        try {
            const usedRange = sheet.getUsedRange();
            usedRange.load(['values', 'formulas', 'address', 'rowCount', 'columnCount']);

            await context.sync();

            if (usedRange.values && usedRange.values.length > 0) {
                sheetData.rowCount = usedRange.rowCount;
                sheetData.colCount = usedRange.columnCount;
                sheetData.activeRange = usedRange.address;

                // Extract sample data (first 20 rows × 10 columns for performance)
                const maxRows = Math.min(20, usedRange.values.length);
                const maxCols = 10;

                sheetData.sampleData = usedRange.values
                    .slice(0, maxRows)
                    .map(row => {
                        if (Array.isArray(row)) {
                            return row.slice(0, maxCols);
                        }
                        return [row]; // Single value
                    });

                // Check if sheet has meaningful data
                sheetData.hasData = sheetData.sampleData.some(row =>
                    row.some(cell => cell !== null && cell !== undefined && cell !== '')
                );

                // Extract formulas from used range
                if (usedRange.formulas && usedRange.formulas.length > 0) {
                    sheetData.formulas = extractFormulas(usedRange.formulas, usedRange.address);
                }

                console.log(`  📊 Data: ${sheetData.rowCount}×${sheetData.colCount}, Sample: ${sheetData.sampleData.length} rows`);
            }

        } catch (rangeError) {
            console.log(`  ⚠️ No used range found for sheet "${sheet.name}"`);
        }

        return sheetData;

    } catch (error) {
        console.warn(`Error processing sheet "${sheet.name}":`, error);
        return {
            name: sheet.name || 'Error Sheet',
            position: null,
            activeRange: null,
            sampleData: [],
            namedRanges: [],
            formulas: [],
            charts: [],
            rowCount: 0,
            colCount: 0,
            hasData: false,
            error: error.message
        };
    }
}

// Extract formulas from range data
function extractFormulas(formulasArray, rangeAddress) {
    const formulas = [];
    const startRow = parseInt(rangeAddress.match(/\d+/)[0]);

    formulasArray.forEach((row, rowIndex) => {
        if (Array.isArray(row)) {
            row.forEach((formula, colIndex) => {
                if (formula && typeof formula === 'string' && formula.startsWith('=')) {
                    const cellAddress = `${columnIndexToLetter(colIndex)}${startRow + rowIndex}`;
                    formulas.push({
                        cell: cellAddress,
                        formula: formula,
                        result: null
                    });
                }
            });
        }
    });

    return formulas.slice(0, 50);
}

// Convert column index to Excel letter
function columnIndexToLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

// Generate context summary
function generateContextSummary(sheets, activeSheet) {
    const parts = [];
    const totalSheets = sheets.length;
    const sheetsWithData = sheets.filter(s => s.hasData).length;

    parts.push(`Excel workbook with ${totalSheets} sheet(s), ${sheetsWithData} containing data`);

    if (activeSheet) {
        parts.push(`Currently active: "${activeSheet}"`);
    }

    sheets.forEach(sheet => {
        const sheetParts = [];

        if (sheet.hasData) {
            sheetParts.push(`${sheet.rowCount}×${sheet.colCount} data`);
        } else {
            sheetParts.push('empty');
        }

        if (sheet.formulas && sheet.formulas.length > 0) {
            sheetParts.push(`${sheet.formulas.length} formulas`);
        }

        if (sheet.namedRanges && sheet.namedRanges.length > 0) {
            sheetParts.push(`${sheet.namedRanges.length} named ranges`);
        }

        if (sheet.charts && sheet.charts.length > 0) {
            sheetParts.push(`${sheet.charts.length} charts`);
        }

        parts.push(`"${sheet.name}": ${sheetParts.join(', ')}`);
    });

    return parts.join('. ');
}

// Quick fallback context builder
async function buildQuickContext() {
    try {
        return await Excel.run(async (context) => {
            const workbook = context.workbook;
            const activeWorksheet = workbook.worksheets.getActiveWorksheet();
            const selection = context.workbook.getSelectedRange();

            workbook.load('name');
            activeWorksheet.load('name');
            selection.load('address');

            await context.sync();

            return {
                workbookName: workbook.name,
                activeSheet: activeWorksheet.name,
                selectedRange: selection.address,
                worksheets: [{
                    name: activeWorksheet.name,
                    activeRange: selection.address,
                    cells: []
                }],
                contextSummary: `Quick context: Active sheet "${activeWorksheet.name}"`,
                timestamp: new Date().toISOString(),
                contextType: 'quick'
            };
        });
    } catch (error) {
        console.warn('Quick context build failed:', error);
        return {
            workbookName: 'Unknown Workbook',
            activeSheet: 'Unknown Sheet',
            selectedRange: null,
            worksheets: [],
            contextSummary: 'Excel context unavailable',
            timestamp: new Date().toISOString(),
            contextType: 'fallback'
        };
    }
}

function getConversationHistory() {
    // Get recent messages from chat for context
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return [];

    const messages = [];
    const messageElements = chatMessages.querySelectorAll('.message:not(.system-message)');

    // Get last 6 messages (3 exchanges) for context
    const recentMessages = Array.from(messageElements).slice(-6);

    recentMessages.forEach(msg => {
        const sender = msg.classList.contains('user') ? 'user' : 'assistant';
        const content = msg.querySelector('.message-content')?.textContent || '';
        if (content.trim()) {
            messages.push({ role: sender, content: content.trim() });
        }
    });

    return messages;
}

function getApiUrl() {
    return BACKEND_URL;
}

// Streaming UI functions
function addStreamingMessage() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return null;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.innerHTML = `
        <div class="message-sender">Moose</div>
        <div class="message-content">
            <div class="streaming-content"></div>
            <div class="streaming-cursor">▋</div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function appendStreamChunk(messageElement, chunk) {
    if (!messageElement) return;

    const streamingContent = messageElement.querySelector('.streaming-content');
    if (streamingContent) {
        streamingContent.textContent += chunk;

        // Auto-scroll to bottom
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

function finalizeStreaming(messageElement, finalContent, metadata = null) {
    if (!messageElement) return;

    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
        // Remove streaming indicators and replace with final content
        messageContent.innerHTML = `<div class="final-content">${escapeHtml(finalContent)}</div>`;

        // Remove streaming class
        messageElement.classList.remove('streaming');

        // Update credits if provided in metadata
        if (metadata?.creditsUsed && metadata?.remainingCredits !== undefined) {
            userCredits = metadata.remainingCredits;
            updateCreditsDisplay();

            // Show credit usage info
            addSystemMessage(`💳 Used ${metadata.creditsUsed} credits. Remaining: ${metadata.remainingCredits}`, 'info');
        }

        // Handle Excel code execution with approval system
        if (metadata?.code && metadata.code.trim()) {
            handleAICodeApproval({
                code: metadata.code,
                understanding: metadata.understanding || finalContent || 'Excel operation',
                message: finalContent,
                confidence: metadata.confidence || 0.8
            });
        }

        updateStatus('Response complete', 'success');
    }
}

// Execute generated Excel code with approval
async function executeGeneratedCodeWithApproval(aiResponse) {
    addSystemMessage('🔄 Executing Excel command...', 'info');

    try {
        const executionResult = await executeUnlimitedExcelCode(aiResponse.code, aiResponse.understanding || 'Excel operation');

        if (executionResult.success) {
            addSystemMessage('✅ Excel command executed successfully!', 'success');
            console.log('Excel execution result:', executionResult);
            return { success: true, result: executionResult };
        } else {
            addSystemMessage('⚠️ Excel command completed with warnings: ' + (executionResult.message || 'Check console for details'), 'warning');
            console.warn('Excel execution warning:', executionResult);
            return { success: false, message: executionResult.message };
        }
    } catch (error) {
        addSystemMessage('❌ Failed to execute Excel command: ' + error.message, 'error');
        console.error('Excel execution error:', error);
        return { success: false, message: error.message };
    }
}

// Handle AI code approval workflow
function handleAICodeApproval(aiResponse) {
    const { code, understanding, confidence } = aiResponse;

    // Check if this contains executable Excel code
    if (!containsExecutableExcelCode(code)) {
        console.log('ℹ️ AI response does not contain executable Excel code');
        return;
    }

    console.log('🤖 AI generated Excel code, showing approval prompt');

    // Auto-approve high-confidence simple operations
    if (confidence && confidence > 0.95 && code.length < 300) {
        console.log('🚀 Auto-approving high-confidence operation');

        addSystemMessage('🔄 Auto-executing high-confidence Excel operation...', 'info');
        executeGeneratedCodeWithApproval(aiResponse);
        return;
    }

    // Show approval UI for manual review
    showApprovalPrompt(aiResponse);
}

// Show approval prompt UI
function showApprovalPrompt(aiResponse) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

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

    chatMessages.appendChild(approvalContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Setup event handlers
    setupApprovalHandlers(approvalContainer.id, aiResponse);
}

// Setup approval button handlers
function setupApprovalHandlers(containerId, aiResponse) {
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
                const result = await executeGeneratedCodeWithApproval(aiResponse);

                if (result.success) {
                    showApprovalFeedback(container, 'success', '✅ Changes applied successfully!');
                } else {
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
            showApprovalFeedback(container, 'info', '❌ Changes rejected by user');

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
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="btn-icon">✅</span><span>Copied!</span>';

                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);

            } catch (error) {
                console.error('Failed to copy code:', error);
                fallbackCopyToClipboard(aiResponse.code);
            }
        };
    }
}

// Check if code contains executable Excel operations
function containsExecutableExcelCode(code) {
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

// Get confidence CSS class
function getConfidenceClass(confidence) {
    if (!confidence) return 'confidence-unknown';
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
}

// Set loading state for buttons
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

// Show approval feedback
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

// Fallback copy method
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

// Send message to AI with streaming response
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const message = chatInput.value.trim();

    if (!message) {
        updateStatus('Please enter a message', 'error');
        return;
    }

    try {
        // Disable input while processing
        sendButton.disabled = true;
        chatInput.disabled = true;
        updateStatus('Connecting to AI...', 'loading');

        // Add user message to chat
        addMessage('user', message);
        chatInput.value = '';

        // Start streaming AI response
        await sendMessageToAI(message);

    } catch (error) {
        console.error('Chat error:', error);
        addSystemMessage('Error: ' + error.message, 'error');
        updateStatus('Request failed', 'error');
    } finally {
        // Re-enable input
        sendButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

// Stream AI response using EventSource
async function sendMessageToAI(message) {
    const token = await getAuthToken();
    const sessionId = getSessionId();
    const context = await buildExcelContext();

    const body = JSON.stringify({
        message,
        context,
        source: 'intelligent-add-in',
        conversationHistory: getConversationHistory()
    });

    // Show streaming indicator
    const streamingMessageId = addStreamingMessage();
    updateStatus('🧠 Thinking...', 'loading');

    try {
        // EventSource doesn't support POST with body, so we need to use fetch with SSE
        const response = await fetch(`${getApiUrl()}/chat/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId,
                'x-anonymous-id': currentUser?.uid || 'anonymous',
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            },
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let streamingContent = '';
        let isComplete = false;
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            finalizeStreaming(streamingMessageId, streamingContent);
                            isComplete = true;
                            return;
                        }

                        // Append token to streaming content
                        streamingContent += data;
                        appendStreamChunk(streamingMessageId, data);

                    } else if (line.startsWith('event: progress')) {
                        // Next line should be the progress data
                        continue;
                    } else if (line.startsWith('event: complete')) {
                        // Next line should be the completion data
                        continue;
                    } else if (line.startsWith('event: error')) {
                        // Next line should be the error data
                        continue;
                    } else if (line.startsWith('event: done')) {
                        finalizeStreaming(streamingMessageId, streamingContent);
                        isComplete = true;
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('Stream reading error:', error);
            if (!isComplete) {
                removeMessage(streamingMessageId);
                addSystemMessage('Streaming error: ' + error.message, 'error');
                updateStatus('Streaming failed', 'error');
            }
        }

    } catch (error) {
        console.error('Streaming setup error:', error);
        removeMessage(streamingMessageId);
        addSystemMessage('Failed to start streaming: ' + error.message, 'error');
        updateStatus('Streaming failed', 'error');
    }
}

// Handle AI response and execute Excel commands
async function handleResponse(responseData) {
    const { understanding, code, message, confidence, tokensUsed, creditsUsed, remainingCredits } = responseData;

    // Show AI response (understanding + message)
    if (understanding || message) {
        const aiResponse = understanding || message;
        addMessage('assistant', aiResponse);
    }

    // Show credit usage information if available
    if (creditsUsed && remainingCredits !== undefined) {
        addSystemMessage(`💳 Used ${creditsUsed} credits. Remaining: ${remainingCredits}`, 'info');
    }

    // Show confidence level for AI response
    if (confidence && confidence < 0.8) {
        addSystemMessage(`⚠️ AI confidence: ${Math.round(confidence * 100)}% - Result may need verification`, 'warning');
    }

    // Execute Excel code if provided
    if (code && typeof executeUnlimitedExcelCode === 'function') {
        addSystemMessage('🔄 Executing Excel command...', 'info');

        try {
            const executionResult = await executeUnlimitedExcelCode(code, understanding || 'Excel operation');

            if (executionResult.success) {
                addSystemMessage('✅ Excel command executed successfully!', 'success');
                console.log('Excel execution result:', executionResult);
            } else {
                addSystemMessage('⚠️ Excel command completed with warnings: ' + (executionResult.message || 'Check console for details'), 'warning');
                console.warn('Excel execution warning:', executionResult);
            }
        } catch (error) {
            addSystemMessage('❌ Failed to execute Excel command: ' + error.message, 'error');
            console.error('Excel execution error:', error);
        }
    } else if (code) {
        addSystemMessage('⚠️ Excel executor not available. Please refresh the page.', 'warning');
    } else {
        addSystemMessage('ℹ️ No Excel code generated for this request.', 'info');
    }
}

// Add message to chat
function addMessage(sender, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-sender">${sender === 'user' ? 'You' : 'Moose'}</div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Add system message to chat
function addSystemMessage(content, type = 'info') {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message assistant system-message ${type}`;
    messageDiv.innerHTML = `
        <div class="message-sender">System</div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Add loading message
function addLoadingMessage() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return null;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-sender">Moose</div>
        <div class="message-content">
            <div class="loading-indicator">
                <span>Thinking</span>
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Remove a message from chat
function removeMessage(messageElement) {
    if (messageElement && messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
    }
}

// Escape HTML for security
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, '<br>');
}

// Setup event listeners
function setupEventListeners() {
    // Chat functionality
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-expand textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    // Payment modal
    const paymentModal = document.getElementById('payment-modal');
    const closeModal = document.getElementById('close-payment-modal');
    const purchaseBtn = document.getElementById('purchase-credits-btn');
    const amountSelect = document.getElementById('credit-amount');

    if (closeModal) {
        closeModal.addEventListener('click', hidePaymentModal);
    }

    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                hidePaymentModal();
            }
        });
    }

    if (purchaseBtn && amountSelect) {
        purchaseBtn.addEventListener('click', () => {
            const amount = amountSelect.value;
            if (amount) {
                purchaseCredits(amount);
            }
        });
    }

    // Recharge credits button
    const rechargeBtn = document.getElementById('recharge-credits');
    if (rechargeBtn) {
        rechargeBtn.addEventListener('click', () => {
            showPaymentModal();
        });
    }
}


// Force clear all authentication data (for testing)
async function clearAllAuthData() {
    console.log('🧹 Clearing ALL authentication data...');

    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Sign out from Firebase
    if (auth && auth.currentUser) {
        try {
            await auth.signOut();
            console.log('✅ Signed out from Firebase');
        } catch (error) {
            console.warn('Error signing out:', error);
        }
    }

    // Reset global state
    currentUser = null;

    console.log('✅ All authentication data cleared');
}

// Initialize the add-in
async function initializeTaskpane() {
    console.log('🚀 Initializing Moose Taskpane');

    try {
        // Setup Firebase anonymous authentication
        console.log('Setting up Firebase anonymous auth...');
        await setupAnonymousAuth();
        console.log('Firebase anonymous auth setup complete. CurrentUser:', currentUser);

        // Setup UI
        console.log('Setting up event listeners...');
        setupEventListeners();

        // Load initial data
        console.log('Loading user credits...');
        await loadUserCredits();

        updateStatus('Ready - Anonymous Mode', 'success');
        console.log('✅ Taskpane initialized successfully');

        // Make clearAllAuthData available globally for testing
        window.clearAllAuthData = clearAllAuthData;

    } catch (error) {
        console.error('Initialization failed:', error);
        updateStatus('Initialization failed: ' + error.message, 'error');
    }
}

// Test if Office.js is available
console.log('Checking Office.js availability...', typeof Office);

// Add immediate status update to see if script is loading
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Script is running!');
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = 'Script loaded, waiting for Office.js...';
        statusElement.className = 'status loading';
    }
});

// Office.js ready handler
if (typeof Office !== 'undefined') {
    Office.onReady((info) => {
        console.log('Office.js ready, host:', info.host);
        if (info.host === Office.HostType.Excel) {
            initializeTaskpane();
        } else {
            console.warn('Not running in Excel, host is:', info.host);
            // Still initialize for testing
            initializeTaskpane();
        }
    });
} else {
    console.error('Office.js not available!');
    // For testing outside of Office, initialize anyway after a delay
    setTimeout(() => {
        console.log('Initializing without Office.js for testing...');
        initializeTaskpane();
    }, 1000);
}