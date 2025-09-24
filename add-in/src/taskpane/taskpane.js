/*
 * Nubia Excel Add-in - Taskpane
 * Simplified for Excel GPT integration
 */

Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');

        // Auto-expand textarea
        function autoExpandTextarea() {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        }

        sendButton.addEventListener('click', sendMessage);

        chatInput.addEventListener('input', autoExpandTextarea);

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Initial setup
        autoExpandTextarea();
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

        console.log('Sending request to:', `${BACKEND_URL}/chat`);
        console.log('Request data:', { message, context, source: 'excel-addin' });

        // Send regular HTTP request
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
        console.log('🔍 Full backend response:', JSON.stringify(data, null, 2));

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