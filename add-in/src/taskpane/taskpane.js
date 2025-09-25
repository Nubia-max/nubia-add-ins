/*
 * Nubia Excel Add-in - Taskpane
 * With Firebase Authentication and Credit System
 */

console.log('🚀 STEP 1: Starting taskpane.js execution');

console.log('🚀 STEP 2: Firebase should be available as global object from CDN');
// No imports needed - Firebase loaded via CDN in HTML
console.log('🚀 STEP 3: Firebase globals check:', typeof firebase);

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCWuOVIeEpK8XzSlk3hgVZho90kYH31P3c",
    authDomain: "aibun-ai.firebaseapp.com",
    projectId: "aibun-ai",
    storageBucket: "aibun-ai.firebasestorage.app",
    messagingSenderId: "966194603583",
    appId: "1:966194603583:web:07c4b19794ad441bc0fa8a"
};

console.log('🚀 STEP 4: Firebase config created');
console.log('🔥 STEP 5: Initializing Firebase...');
// Initialize Firebase with error handling
let auth = null;

// Check if Firebase is available as global object
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase not found as global object - check CDN loading in HTML');
    // Create a dummy auth object to prevent crashes
    auth = {
        getRedirectResult: () => Promise.resolve(null),
        onAuthStateChanged: (callback) => {
            console.log('Dummy auth onAuthStateChanged called');
            callback(null);
        },
        signOut: () => Promise.resolve(),
        currentUser: null
    };
} else {
    try {
        console.log('✅ Firebase global object found, apps:', firebase.apps ? firebase.apps.length : 'unknown');

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized successfully');
        } else {
            console.log('✅ Firebase already initialized');
        }

        // Initialize auth object
        auth = firebase.auth();
        console.log('✅ Firebase Auth initialized');

        // Set Firebase persistence with error handling - CRITICAL for cross-window auth
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                console.log('✅ Firebase persistence set to LOCAL - auth state will persist');
            })
            .catch((error) => {
                console.warn('⚠️ Firebase persistence setup failed:', error);
            });

    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        // Create a dummy auth object to prevent crashes
        auth = {
            getRedirectResult: () => Promise.resolve(null),
            onAuthStateChanged: (callback) => {
                console.log('Dummy auth onAuthStateChanged called');
                callback(null);
            },
            signOut: () => Promise.resolve(),
            currentUser: null
        };
    }
}

console.log('🚀 STEP 6: Firebase initialization completed');

// Global state
let currentUser = null;
let userCredits = 10;

console.log('🚀 STEP 7: Global state initialized');

console.log('🚀 STEP 8: Setting up Office.onReady...');
Office.onReady((info) => {
    console.log('🚀 STEP 9: Office.onReady triggered, host:', info.host);
    if (info.host === Office.HostType.Excel) {
        console.log('🚀 STEP 10: Excel host detected, calling initializeTaskpane');
        initializeTaskpane();
    } else {
        console.log('🚀 STEP 10: Non-Excel host detected:', info.host);
    }
});
console.log('🚀 STEP 8 COMPLETE: Office.onReady setup finished');

async function initializeTaskpane() {
    console.log('🚀 STEP 11: initializeTaskpane() called');

    console.log('🚀 STEP 12: Getting DOM elements...');
    const chatInput = document.getElementById('chatInput');
    console.log('🚀 chatInput element:', chatInput);
    const sendButton = document.getElementById('sendButton');
    const authButton = document.getElementById('authButton');
    const signOutButton = document.getElementById('signOutButton');
    const googleSignInButton = document.getElementById('googleSignInButton');
    const checkAuthButton = document.getElementById('checkAuthButton');

    // Auto-expand textarea
    function autoExpandTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('input', autoExpandTextarea);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    authButton.addEventListener('click', signInWithGoogle);
    signOutButton.addEventListener('click', signOut);
    googleSignInButton.addEventListener('click', signInWithGoogle);
    checkAuthButton.addEventListener('click', manualCheckAuth);

    // Wait for Firebase to be fully ready before checking auth state
    console.log('📋 Waiting for Firebase to be ready...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Give Firebase time to initialize

    // Check for redirect result first (with longer timeout)
    console.log('📋 Checking Firebase redirect result...');
    if (auth && typeof auth.getRedirectResult === 'function') {
        try {
            const result = await Promise.race([
                auth.getRedirectResult(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)) // Increased to 15 seconds
            ]);
            console.log('📋 Redirect result:', result);
            if (result && result.user) {
                console.log('✅ Found user from redirect result:', result.user.email);
                updateStatus('Signed in successfully!');
                hideLoginModal();
                currentUser = {
                    uid: result.user.uid,
                    displayName: result.user.displayName,
                    email: result.user.email,
                    photoURL: result.user.photoURL
                };
                updateUI();
                loadUserCredits();
                return; // Exit early if we found auth from redirect
            }
        } catch (error) {
            console.log('📋 No redirect result or timeout:', error.message);
        }
    } else {
        console.log('📋 Auth not available for redirect check');
    }

    // Firebase auth state listener (with defensive check)
    console.log('👂 Setting up Firebase auth state listener...');
    if (auth && typeof auth.onAuthStateChanged === 'function') {
        try {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                console.log('👂 Firebase auth state changed:', user ? 'User signed in' : 'User signed out');
                if (user) {
                    console.log('User details:', {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName
                    });

                    // Store user data
                    currentUser = {
                        uid: user.uid,
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL
                    };

                    // Save to localStorage as backup
                    localStorage.setItem('nubia_user_backup', JSON.stringify(currentUser));

                    updateStatus('✅ Firebase auth detected!');
                    hideCheckAuthButton();
                    hideLoginModal();
                    loadUserCredits();
                } else {
                    console.log('👂 No Firebase user found - checking localStorage backup');

                    // Check localStorage backup before clearing user
                    const backupUser = localStorage.getItem('nubia_user_backup');
                    if (backupUser && !currentUser) {
                        try {
                            currentUser = JSON.parse(backupUser);
                            console.log('✅ Restored user from localStorage backup:', currentUser.email);
                            updateStatus('✅ Restored authentication from backup');
                            hideCheckAuthButton();
                            hideLoginModal();
                            loadUserCredits();
                        } catch (e) {
                            console.warn('Failed to parse backup user data:', e);
                            currentUser = null;
                        }
                    } else {
                        currentUser = null;
                    }
                }
                updateUI();
            });

            // Store unsubscribe function for cleanup if needed
            window.authUnsubscribe = unsubscribe;
            console.log('✅ Auth state listener setup complete');
        } catch (error) {
            console.error('❌ Error setting up auth state listener:', error);
        }
    } else {
        console.log('⚠️ Auth not available for state listener - using localStorage fallback');
        // Fallback to localStorage check
        const savedUser = localStorage.getItem('nubia_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                updateUI();
                loadUserCredits();
            } catch (error) {
                console.error('Error parsing saved user:', error);
            }
        } else {
            updateUI();
        }
    }

    // Initial setup
    autoExpandTextarea();
    updateStatus('Ready');
    loadUserCredits();

    // Set up periodic auth state check every 30 seconds
    setInterval(async () => {
        // Only run if we don't have a current user
        if (!currentUser && auth && auth.currentUser) {
            console.log('🔄 Periodic auth check found Firebase user');
            const firebaseUser = auth.currentUser;
            currentUser = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL
            };
            localStorage.setItem('nubia_user_backup', JSON.stringify(currentUser));
            updateStatus('✅ Authentication restored!');
            hideCheckAuthButton();
            hideLoginModal();
            updateUI();
            loadUserCredits();
        }
    }, 30000); // Check every 30 seconds

    // Add a test button for Firebase debugging
    setTimeout(() => {
        console.log('=== FIREBASE DEBUG INFO ===');
        console.log('Firebase config:', firebaseConfig);
        console.log('Auth instance:', auth);
        console.log('Current user:', auth.currentUser);
        console.log('Auth state ready:', auth.authStateReady);

        // Check localStorage for any Firebase data
        console.log('=== LOCALSTORAGE DEBUG ===');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('firebase') || key.includes('nubia')) {
                console.log(`${key}:`, localStorage.getItem(key));
            }
        }
        console.log('===========================');
    }, 2000);
}

// Backend configuration - use relative URL for webpack proxy
const BACKEND_URL = '/api';

// Firebase Authentication Functions
async function signInWithGoogle() {
    try {
        updateStatus('Opening authentication window...');

        // Open the Firebase authentication page in a new window
        const authWindow = window.open('https://localhost:3000/auth/auth.html', 'authWindow', 'width=500,height=600,scrollbars=yes');

        // Listen for authentication success message
        const handleAuthMessage = (event) => {
            console.log('📨 TASKPANE: Received message from auth window');
            console.log('📨 TASKPANE: Event origin:', event.origin);
            console.log('📨 TASKPANE: Window origin:', window.location.origin);
            console.log('📨 TASKPANE: Message data:', event.data);

            // Accept messages from both port 3000 and 3001 (dev server ports)
            const allowedOrigins = ['https://localhost:3000', 'https://localhost:3001', window.location.origin];
            if (!allowedOrigins.includes(event.origin)) {
                console.warn('⚠️ TASKPANE: Ignoring message from different origin:', event.origin, 'Allowed:', allowedOrigins);
                return;
            }

            if (event.data.type === 'NUBIA_AUTH_SUCCESS') {
                console.log('✅ TASKPANE: Authentication success message received!');
                console.log('✅ TASKPANE: User data from message:', event.data.user);

                // Remove event listener and clear timeout
                window.removeEventListener('message', handleAuthMessage);
                clearTimeout(authTimeout);

                // Update user state
                currentUser = event.data.user;
                console.log('✅ TASKPANE: Current user updated:', currentUser);

                // Save to localStorage backup immediately
                localStorage.setItem('nubia_user_backup', JSON.stringify(currentUser));
                console.log('✅ TASKPANE: User data saved to localStorage backup');

                updateStatus('✅ Successfully signed in!');
                hideLoginModal();
                hideCheckAuthButton();
                updateUI();
                loadUserCredits();

                // Close auth window if still open
                if (authWindow && !authWindow.closed) {
                    console.log('🚪 TASKPANE: Closing auth window');
                    authWindow.close();
                }
            } else {
                console.log('📨 TASKPANE: Received non-auth message:', event.data.type);
            }
        };

        // Add message listener
        window.addEventListener('message', handleAuthMessage);

        // Add timeout with multiple retry checks
        const authTimeout = setTimeout(async () => {
            console.log('Auth timeout - performing comprehensive auth check');
            window.removeEventListener('message', handleAuthMessage);

            // Multiple fallback checks with delays
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`Auth check attempt ${attempt}/3`);

                // Check Firebase auth state directly
                const currentFirebaseUser = auth && auth.currentUser;
                if (currentFirebaseUser) {
                    console.log(`✅ Found Firebase user on attempt ${attempt}:`, currentFirebaseUser.email);
                    currentUser = {
                        uid: currentFirebaseUser.uid,
                        displayName: currentFirebaseUser.displayName,
                        email: currentFirebaseUser.email,
                        photoURL: currentFirebaseUser.photoURL
                    };
                    updateStatus('✅ Successfully signed in!');
                    hideLoginModal();
                    updateUI();
                    loadUserCredits();
                    return;
                }

                // Check localStorage backup
                const backupUser = localStorage.getItem('nubia_user_backup');
                const authSuccessFlag = localStorage.getItem('nubia_auth_success');
                if ((authSuccessFlag || backupUser) && !currentUser) {
                    console.log(`✅ Found backup auth data on attempt ${attempt}`);
                    try {
                        if (backupUser) {
                            currentUser = JSON.parse(backupUser);
                            updateStatus('✅ Successfully signed in!');
                            hideLoginModal();
                            updateUI();
                            loadUserCredits();
                        }
                        // Clean up localStorage flags
                        localStorage.removeItem('nubia_auth_success');
                        return;
                    } catch (e) {
                        console.warn('Failed to parse backup user:', e);
                    }
                }

                // Wait before next attempt (except last one)
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            // All attempts failed
            updateStatus('Authentication timed out. Please try signing in again.');
            showCheckAuthButton();
        }, 45000); // Increased to 45 second timeout

        // Fallback: Check for window closure and auth state
        const checkWindowClosed = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(checkWindowClosed);
                clearTimeout(authTimeout);
                window.removeEventListener('message', handleAuthMessage);

                console.log('🚪 TASKPANE: Auth window closed, checking all auth sources');
                console.log('🚪 TASKPANE: Current user before checks:', currentUser);

                // Priority 1: Check Firebase auth state directly
                const currentFirebaseUser = auth && auth.currentUser;
                console.log('🔍 TASKPANE: Firebase currentUser:', currentFirebaseUser);

                if (currentFirebaseUser && !currentUser) {
                    console.log('✅ TASKPANE: Found Firebase user after window close:', currentFirebaseUser.email);
                    currentUser = {
                        uid: currentFirebaseUser.uid,
                        displayName: currentFirebaseUser.displayName,
                        email: currentFirebaseUser.email,
                        photoURL: currentFirebaseUser.photoURL
                    };
                    updateStatus('✅ Successfully signed in!');
                    hideLoginModal();
                    updateUI();
                    loadUserCredits();
                    return;
                }

                // Priority 2: Check localStorage fallback
                if (localStorage.getItem('nubia_auth_success')) {
                    const userData = localStorage.getItem('nubia_user');
                    if (userData && !currentUser) {
                        console.log('Found localStorage user data');
                        currentUser = JSON.parse(userData);
                        updateStatus('✅ Successfully signed in!');
                        hideLoginModal();
                        updateUI();
                        loadUserCredits();
                    }
                    // Clean up localStorage
                    localStorage.removeItem('nubia_auth_success');
                    localStorage.removeItem('nubia_user');
                    return;
                }

                // Priority 3: Wait a moment for Firebase auth state to update
                console.log('No immediate auth found, waiting for Firebase auth state...');
                setTimeout(() => {
                    const delayedFirebaseUser = auth.currentUser;
                    if (delayedFirebaseUser && !currentUser) {
                        console.log('Found delayed Firebase user:', delayedFirebaseUser);
                        currentUser = {
                            uid: delayedFirebaseUser.uid,
                            displayName: delayedFirebaseUser.displayName,
                            email: delayedFirebaseUser.email,
                            photoURL: delayedFirebaseUser.photoURL
                        };
                        updateStatus('✅ Successfully signed in!');
                        hideLoginModal();
                        updateUI();
                        loadUserCredits();
                    } else if (!currentUser) {
                        updateStatus('Sign-in cancelled or failed. Try refreshing and signing in again.');
                        showCheckAuthButton();
                    }
                }, 2000); // Wait 2 seconds for Firebase auth state
            }
        }, 1000);

    } catch (error) {
        console.error('Sign-in error:', error);
        updateStatus('Sign-in failed: ' + error.message);
    }
}

async function signOut() {
    try {
        await auth.signOut();
        userCredits = 10; // Reset to anonymous credits
        updateUI();
        updateStatus('Signed out');
    } catch (error) {
        console.error('Sign-out error:', error);
    }
}

function updateUI() {
    const authButton = document.getElementById('authButton');
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');

    if (currentUser) {
        authButton.style.display = 'none';
        userProfile.style.display = 'flex';

        // Create avatar with first letter of user's name
        const userName = currentUser.displayName || currentUser.email || 'User';
        const firstLetter = userName.charAt(0).toUpperCase();
        const avatarColor = generateAvatarColor(userName);

        userAvatar.textContent = firstLetter;
        userAvatar.style.background = avatarColor;
        userAvatar.title = userName; // Tooltip with full name
    } else {
        authButton.style.display = 'block';
        userProfile.style.display = 'none';
    }

    updateCreditDisplay();
}

// Generate consistent color for user avatar based on name
function generateAvatarColor(name) {
    const colors = [
        'linear-gradient(135deg, #4285f4, #34a853)', // Google Blue/Green
        'linear-gradient(135deg, #ea4335, #fbbc05)', // Google Red/Yellow
        'linear-gradient(135deg, #9c27b0, #673ab7)', // Purple
        'linear-gradient(135deg, #ff5722, #ff9800)', // Orange
        'linear-gradient(135deg, #2196f3, #03a9f4)', // Light Blue
        'linear-gradient(135deg, #4caf50, #8bc34a)', // Green
        'linear-gradient(135deg, #f44336, #e91e63)', // Red/Pink
        'linear-gradient(135deg, #607d8b, #795548)'  // Gray/Brown
    ];

    // Use name hash to consistently pick same color for same name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

function updateCreditDisplay() {
    const creditDisplay = document.getElementById('creditDisplay');
    creditDisplay.textContent = `${userCredits} credits`;
}

async function loadUserCredits() {
    try {
        let token = null;

        // Try to get token from Firebase user if available
        if (currentUser && auth && auth.currentUser) {
            try {
                token = await auth.currentUser.getIdToken();
                console.log('✅ Got Firebase ID token');
            } catch (error) {
                console.warn('⚠️ Failed to get Firebase ID token:', error);
            }
        } else if (currentUser && currentUser.idToken) {
            // Use stored ID token from auth process
            token = currentUser.idToken;
            console.log('✅ Using stored ID token');
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${BACKEND_URL}/credits/balance`, {
            headers
        });

        if (response.ok) {
            const data = await response.json();
            userCredits = data.data.credits;
            updateCreditDisplay();
        }
    } catch (error) {
        console.error('Failed to load credits:', error);
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'flex';
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    // Clear input and add user message
    input.value = '';
    addMessage('user', message);

    // Show loading
    const loadingDiv = addLoadingIndicator();

    try {
        // Get Excel context
        const context = await getExcelContext();

        console.log('Sending request to:', `${BACKEND_URL}/chat`);
        console.log('Request data:', { message, context, source: 'excel-addin' });

        // Get Firebase ID token if user is logged in
        let token = null;
        if (currentUser && auth && auth.currentUser) {
            try {
                token = await auth.currentUser.getIdToken();
            } catch (error) {
                console.warn('⚠️ Failed to get Firebase ID token for sendMessage:', error);
            }
        } else if (currentUser && currentUser.idToken) {
            token = currentUser.idToken;
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Send regular HTTP request
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: message,
                context: context,
                source: 'excel-addin'
            })
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.log('Error response:', errorData);

            // Handle credit exhaustion specifically
            if (response.status === 402 && errorData.error === 'CREDITS_EXHAUSTED') {
                removeLoadingIndicator(loadingDiv);

                if (errorData.action === 'SHOW_LOGIN') {
                    showLoginModal();
                    return;
                } else {
                    addMessage('system', `${errorData.message} You need ${errorData.requiredCredits} credits but only have ${errorData.availableCredits}.`);
                    return;
                }
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('🔍 Full backend response:', JSON.stringify(data, null, 2));

        // Remove loading indicator
        removeLoadingIndicator(loadingDiv);

        if (data.success) {
            // Update credits if provided
            if (data.remainingCredits !== undefined) {
                userCredits = data.remainingCredits;
                updateCreditDisplay();
            }

            // Show usage info if available
            if (data.tokensUsed && data.creditsUsed) {
                addSystemMessage(`✅ Success! Used ${data.tokensUsed} tokens (${data.creditsUsed} credits). ${data.remainingCredits} credits remaining.`, 'success');
            }

            await handleResponse(data);
        } else {
            addSystemMessage(`❌ Error: ${data.error}`, 'error');
        }

    } catch (error) {
        console.error('Full error object:', error);
        console.error('Error stack:', error.stack);
        removeLoadingIndicator(loadingDiv);
        addSystemMessage(`❌ Connection error: ${error.message} (Check console for details)`, 'error');
        updateStatus('Connection error', 'error');
    }
}

async function sendStreamingMessage(message, context, loadingDiv) {
    return new Promise((resolve, reject) => {
        // Send POST request to initiate SSE stream
        fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                context: context,
                source: 'excel-addin'
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        removeLoadingIndicator(loadingDiv);
                        resolve();
                        return;
                    }

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    let currentEventType = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEventType = line.substring(7).trim();
                        } else if (line.startsWith('data: ')) {
                            const data = line.substring(6).trim();
                            try {
                                const parsedData = JSON.parse(data);
                                handleStreamEvent(currentEventType, parsedData, loadingDiv);
                            } catch (e) {
                                console.log('Non-JSON data:', data);
                            }
                        }
                    }

                    readStream();
                }).catch(reject);
            }

            readStream();
        })
        .catch(reject);
    });
}

function handleStreamEvent(eventType, data, loadingDiv) {
    if (eventType === 'progress') {
        // Update loading indicator with progress
        updateLoadingIndicator(loadingDiv, data.status, data.progress);
        updateStatus(data.status);
    } else if (eventType === 'complete') {
        // Handle final response
        removeLoadingIndicator(loadingDiv);
        handleResponse(data);
    } else if (eventType === 'error') {
        // Handle error
        removeLoadingIndicator(loadingDiv);
        addSystemMessage(`❌ Error: ${data.error}`, 'error');
        updateStatus('Error', 'error');
    }
}

async function handleResponse(response) {
    // Handle Direct Excel AI response (UNLIMITED POWER MODE)
    if (response.type === 'direct-excel') {
        // Show understanding message
        if (response.understanding) {
            addMessage('assistant', response.understanding);
        }

        // Execute raw AI-generated code directly
        if (response.code) {
            console.log('🚀 UNLIMITED POWER MODE: Executing direct AI code');

            try {
                addSystemMessage(`🚀 Executing: ${response.message}`, 'info');

                const result = await window.executeUnlimitedExcelCode(
                    response.code,
                    response.message
                );

                if (result.success) {
                    addSystemMessage(`✅ SUCCESS: ${response.message}`, 'success');
                } else {
                    addSystemMessage(`⚠️ PARTIAL: ${result.message || 'Operation completed with warnings'}`, 'warning');
                }

            } catch (error) {
                console.error('🚨 Direct execution failed:', error);
                addSystemMessage(`❌ FAILED: ${error.message}`, 'error');
            }
        }

        // Show final message
        if (response.message) {
            addMessage('assistant', response.message);
        }

    }
    // Legacy support for old Excel GPT response
    else if (response.type === 'excel-gpt') {
        // Show understanding message
        if (response.understanding) {
            addMessage('assistant', response.understanding);
        }

        // Execute Excel API operations (old system)
        const actions = response.actions || response.excelGPT?.actions || response.result?.operations || [];
        if (actions && Array.isArray(actions) && actions.length > 0) {
            for (const action of actions) {
                if (action.type === 'excel-api') {
                    try {
                        await window.executeExcelOperation(action);
                        addSystemMessage(`✅ ${action.description || 'Operation completed'}`, 'success');
                    } catch (error) {
                        addSystemMessage(`❌ ${error.message}`, 'error');
                    }
                }
            }
        }

        // Show final message
        if (response.message) {
            addMessage('assistant', response.message);
        }

    } else if (response.type === 'chat') {
        // Simple chat response
        addMessage('assistant', response.message);

    } else {
        // Default case - treat as direct message
        if (response.message) {
            addMessage('assistant', response.message);
        }
    }

    updateStatus('Ready');
}

// Manual authentication check function
async function manualCheckAuth() {
    console.log('Manual auth check triggered');
    updateStatus('Checking authentication status...');

    // Multiple comprehensive checks
    for (let attempt = 1; attempt <= 5; attempt++) {
        console.log(`Manual auth check attempt ${attempt}/5`);

        // Priority 1: Check Firebase auth state
        if (auth && auth.currentUser) {
            const currentFirebaseUser = auth.currentUser;
            console.log(`✅ Found Firebase user on attempt ${attempt}:`, currentFirebaseUser.email);
            currentUser = {
                uid: currentFirebaseUser.uid,
                displayName: currentFirebaseUser.displayName,
                email: currentFirebaseUser.email,
                photoURL: currentFirebaseUser.photoURL
            };
            updateStatus('✅ Authentication found via Firebase!');
            hideCheckAuthButton();
            hideLoginModal();
            updateUI();
            loadUserCredits();
            return;
        }

        // Priority 2: Check localStorage backup
        const backupUser = localStorage.getItem('nubia_user_backup');
        if (backupUser && !currentUser) {
            try {
                const userData = JSON.parse(backupUser);
                console.log(`✅ Found backup user on attempt ${attempt}:`, userData.email);
                currentUser = userData;
                updateStatus('✅ Authentication found via backup!');
                hideCheckAuthButton();
                hideLoginModal();
                updateUI();
                loadUserCredits();
                return;
            } catch (e) {
                console.warn(`Failed to parse backup user on attempt ${attempt}:`, e);
            }
        }

        // Priority 3: Check legacy localStorage
        const authSuccessFlag = localStorage.getItem('nubia_auth_success');
        const legacyUserData = localStorage.getItem('nubia_user');
        if (authSuccessFlag && legacyUserData) {
            try {
                const userData = JSON.parse(legacyUserData);
                console.log(`✅ Found legacy auth data on attempt ${attempt}:`, userData.email);
                currentUser = userData;
                updateStatus('✅ Authentication found via legacy data!');
                hideCheckAuthButton();
                hideLoginModal();
                updateUI();
                loadUserCredits();

                // Migrate to backup storage
                localStorage.setItem('nubia_user_backup', legacyUserData);
                localStorage.removeItem('nubia_auth_success');
                localStorage.removeItem('nubia_user');
                return;
            } catch (e) {
                console.warn(`Failed to parse legacy user on attempt ${attempt}:`, e);
            }
        }

        // Wait before next attempt (except last one)
        if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            updateStatus(`Checking authentication... (attempt ${attempt + 1}/5)`);
        }
    }

    // No authentication found after all attempts
    updateStatus('No authentication found. Please sign in again.');
    console.log('No authentication found during comprehensive manual check');
}

function showCheckAuthButton() {
    const checkAuthButton = document.getElementById('checkAuthButton');
    if (checkAuthButton) {
        checkAuthButton.style.display = 'inline-block';
    }
}

function hideCheckAuthButton() {
    const checkAuthButton = document.getElementById('checkAuthButton');
    if (checkAuthButton) {
        checkAuthButton.style.display = 'none';
    }
}

async function getExcelContext() {
    try {
        return await Excel.run(async (context) => {
            const workbook = context.workbook;
            const worksheets = workbook.worksheets;
            const activeWorksheet = workbook.worksheets.getActiveWorksheet();
            const selectedRange = workbook.getSelectedRange();

            // Load all worksheets
            worksheets.load(['items/name', 'items/tabColor']);
            workbook.load(['name']);
            activeWorksheet.load(['name']);
            selectedRange.load(['address', 'values', 'rowCount', 'columnCount']);

            await context.sync();

            // Get data from all worksheets
            const allWorksheetsData = [];
            for (const sheet of worksheets.items) {
                try {
                    const usedRange = sheet.getUsedRange();
                    usedRange.load(['address', 'values', 'rowCount', 'columnCount']);
                    await context.sync();

                    allWorksheetsData.push({
                        name: sheet.name,
                        tabColor: sheet.tabColor,
                        usedRange: usedRange.address,
                        rowCount: usedRange.rowCount,
                        columnCount: usedRange.columnCount,
                        sampleData: usedRange.values.slice(0, 5) // First 5 rows for context
                    });
                } catch (e) {
                    // Empty sheet - add basic info
                    allWorksheetsData.push({
                        name: sheet.name,
                        tabColor: sheet.tabColor,
                        usedRange: 'A1',
                        rowCount: 0,
                        columnCount: 0,
                        sampleData: []
                    });
                }
            }

            await context.sync();

            // Build rich context with ALL worksheets
            const richContext = {
                // Basic info
                activeSheetName: activeWorksheet.name,
                workbookName: workbook.name,
                timestamp: new Date().toISOString(),

                // All worksheets data - THIS IS THE KEY IMPROVEMENT
                worksheets: allWorksheetsData,
                totalWorksheets: allWorksheetsData.length,

                // Selection info (from active sheet)
                selectedRange: selectedRange.address,
                selectedData: selectedRange.values,
                selectionSize: {
                    rows: selectedRange.rowCount,
                    columns: selectedRange.columnCount
                }
            };

            // Add semantic hints based on selection
            if (selectedRange.rowCount === 1 && selectedRange.columnCount > 1) {
                richContext.selectionType = 'row';
                richContext.hint = 'User selected a horizontal range (row)';
            } else if (selectedRange.columnCount === 1 && selectedRange.rowCount > 1) {
                richContext.selectionType = 'column';
                richContext.hint = 'User selected a vertical range (column)';
            } else if (selectedRange.rowCount === 1 && selectedRange.columnCount === 1) {
                richContext.selectionType = 'cell';
                richContext.hint = 'User selected a single cell';
            } else {
                richContext.selectionType = 'range';
                richContext.hint = 'User selected a multi-cell range';
            }

            // Detect if selection looks like headers (first row)
            if (selectedRange.address.includes('1:1') || selectedRange.address.startsWith('A1:')) {
                richContext.maybeHeaders = true;
                richContext.hint += ', possibly headers';
            }

            return richContext;

        });
    } catch (error) {
        console.warn('Could not get Excel context:', error);
        return {
            sheetName: 'Unknown',
            workbookName: 'Unknown',
            selectedRange: 'A1',
            selectedData: [],
            selectionType: 'cell',
            hint: 'Basic context only',
            timestamp: new Date().toISOString()
        };
    }
}

function addMessage(sender, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = sender === 'user' ? 'You' : 'Nubia';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    messagesDiv.appendChild(messageDiv);

    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(content, type = 'info') {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message assistant system-message ${type}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = 'System';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    messagesDiv.appendChild(messageDiv);

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addLoadingIndicator() {
    const messagesDiv = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading-indicator';

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = 'Nubia';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-indicator';
    contentDiv.innerHTML = 'Mooseying<div class="loading-dots"><span></span><span></span><span></span></div>';

    loadingDiv.appendChild(senderDiv);
    loadingDiv.appendChild(contentDiv);
    messagesDiv.appendChild(loadingDiv);

    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    return loadingDiv;
}

function removeLoadingIndicator(loadingDiv) {
    if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
    }
}

function updateLoadingIndicator(loadingDiv, status, progress) {
    if (loadingDiv) {
        const contentDiv = loadingDiv.querySelector('.message-content');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="loading-indicator">
                    ${status}
                    ${progress ? `(${progress}%)` : ''}
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;
        }
    }
}

function updateStatus(message, type = 'connected') {
    const statusText = document.getElementById('statusText');
    const statusBar = document.getElementById('statusBar');

    statusText.textContent = message;

    // Remove existing status classes
    statusBar.classList.remove('status-connected', 'status-error');

    // Add appropriate class
    if (type === 'error') {
        statusBar.classList.add('status-error');
    } else {
        statusBar.classList.add('status-connected');
    }
}