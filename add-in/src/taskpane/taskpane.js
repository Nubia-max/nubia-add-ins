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

// Send message to AI and handle response
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
        updateStatus('Processing your request...', 'loading');

        // Add user message to chat
        addMessage('user', message);
        chatInput.value = '';

        // Check if user has enough credits
        const creditCheck = await makeAPICall('/credits/estimate', {
            method: 'POST',
            body: JSON.stringify({ command: message })
        });

        const estimatedCredits = creditCheck.data.estimatedCredits;

        if (userCredits < estimatedCredits) {
            if (currentUser.isAnonymous) {
                addSystemMessage(`Need ${estimatedCredits} credits. You have ${userCredits}. Purchase credits to continue.`, 'warning');
                updateStatus(`Insufficient credits. Need ${estimatedCredits}, have ${userCredits}`, 'error');
                showPaymentModal();
            } else {
                addSystemMessage(`Need ${estimatedCredits} credits. You have ${userCredits}. Purchase more credits?`, 'warning');
                updateStatus(`Insufficient credits. Need ${estimatedCredits}, have ${userCredits}`, 'error');
                showPaymentModal();
            }
            return;
        }

        // Show loading indicator in chat
        const loadingMessageId = addLoadingMessage();

        // Send request to AI
        const response = await makeAPICall('/chat', {
            method: 'POST',
            body: JSON.stringify({
                userCommand: message,
                model: 'deepseek-chat'
            })
        });

        // Remove loading indicator
        removeMessage(loadingMessageId);

        if (response.success) {
            // Handle the AI response
            await handleResponse(response.data);

            // Update credits after successful command
            await loadUserCredits();
            updateStatus('Ready - Anonymous Mode', 'success');
        } else {
            addSystemMessage('Command failed: ' + (response.message || 'Unknown error'), 'error');
            updateStatus('Command failed', 'error');
        }

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