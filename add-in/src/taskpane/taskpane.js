/*
 * Nubia Excel Add-in - Taskpane
 * Simplified for Excel GPT integration
 */

Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById('sendButton').addEventListener('click', sendMessage);
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        updateStatus('Ready');
    }
});

// Backend configuration - use relative URL for webpack proxy
const BACKEND_URL = '/api';

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

        // Add detailed logging for debugging
        console.log('Sending request to:', `${BACKEND_URL}/chat`);
        console.log('Request data:', { message, context, source: 'excel-addin' });

        // Send request to backend
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                context: context,
                source: 'excel-addin'
            })
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        // Remove loading indicator
        removeLoadingIndicator(loadingDiv);

        if (data.success) {
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

async function handleResponse(response) {
    // Handle Excel GPT response
    if (response.type === 'excel-gpt') {
        // Show understanding message
        if (response.understanding) {
            addMessage('assistant', response.understanding);
        }

        // Execute Excel API operations
        if (response.actions && Array.isArray(response.actions)) {
            for (const action of response.actions) {
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

async function getExcelContext() {
    try {
        return await Excel.run(async (context) => {
            const worksheet = context.workbook.worksheets.getActiveWorksheet();
            const workbook = context.workbook;
            const selectedRange = context.workbook.getSelectedRange();
            const usedRange = worksheet.getUsedRange();

            // Load basic properties
            worksheet.load(['name', 'tabColor']);
            workbook.load(['name']);
            selectedRange.load(['address', 'values', 'rowCount', 'columnCount']);

            // Try to load used range (might be null for empty sheets)
            try {
                usedRange.load(['address', 'rowCount', 'columnCount']);
            } catch (e) {
                // Ignore if no used range
            }

            await context.sync();

            // Build rich context
            const richContext = {
                // Basic info
                sheetName: worksheet.name,
                workbookName: workbook.name,
                timestamp: new Date().toISOString(),

                // Selection info
                selectedRange: selectedRange.address,
                selectedData: selectedRange.values,
                selectionSize: {
                    rows: selectedRange.rowCount,
                    columns: selectedRange.columnCount
                },

                // Sheet structure
                usedRange: usedRange ? usedRange.address : 'A1',
                dataSize: usedRange ? {
                    rows: usedRange.rowCount,
                    columns: usedRange.columnCount
                } : { rows: 0, columns: 0 },

                // Visual context
                tabColor: worksheet.tabColor || null
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
    contentDiv.innerHTML = 'Thinking<div class="loading-dots"><span></span><span></span><span></span></div>';

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