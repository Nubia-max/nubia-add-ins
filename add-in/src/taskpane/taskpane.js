/**
 * Nubia Excel Add-in - Taskpane
 * Enhanced chat interface with Excel action execution
 */

// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3001/api',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

// Application state
let isInitialized = false;
let isProcessing = false;

// DOM elements
let chatMessages, chatInput, sendButton, statusText;

/**
 * Initialize the add-in when Office is ready
 */
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        initializeTaskpane();
    }
});

/**
 * Initialize the taskpane interface
 */
function initializeTaskpane() {
    // Get DOM elements
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendButton = document.getElementById('sendButton');
    statusText = document.getElementById('statusText');

    // Set up event listeners
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Test backend connection
    testBackendConnection();

    isInitialized = true;
    updateStatus('Ready - Connected to Nubia backend', 'connected');
}

/**
 * Test connection to backend
 */
async function testBackendConnection() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
        if (response.ok) {
            updateStatus('Connected to Nubia backend', 'connected');
        } else {
            updateStatus('Backend connection issues', 'error');
        }
    } catch (error) {
        console.error('Backend connection test failed:', error);
        updateStatus('Cannot connect to backend', 'error');
    }
}

/**
 * Handle sending a message - Enhanced with action execution
 */
async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message || isProcessing) return;

    // Add user message to chat
    addMessage('user', message);
    chatInput.value = '';
    setProcessing(true);

    try {
        // Get Excel context
        const excelContext = await getExcelContext();

        // Send to backend
        const response = await sendToBackend(message, excelContext);

        // Process backend response
        await processBackendResponse(response);

    } catch (error) {
        console.error('Error processing message:', error);
        addMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.');
        updateStatus('Error processing request', 'error');
    } finally {
        setProcessing(false);
    }
}

/**
 * Process backend response - handles both chat and action types
 */
async function processBackendResponse(response) {
    console.log('Processing backend response:', response);

    // Handle different response formats
    if (response.type === 'chat') {
        // Standard chat response
        addMessage('assistant', response.message || 'No message provided.');

    } else if (response.type === 'action') {
        // Single action response
        await executeExcelAction(response.action, response.args);

    } else if (response.actions && Array.isArray(response.actions)) {
        // Multiple actions in array format
        for (const actionItem of response.actions) {
            if (actionItem.type === 'chat') {
                addMessage('assistant', actionItem.message);
            } else if (actionItem.type === 'action') {
                await executeExcelAction(actionItem.action, actionItem.args);
            }
        }

    } else if (response.message) {
        // Fallback: treat as chat message
        addMessage('assistant', response.message);

        // Also check for legacy excelActions format
        if (response.excelActions && response.excelActions.length > 0) {
            await executeLegacyExcelActions(response.excelActions);
        }
    } else {
        // Unknown response format
        console.warn('Unknown response format:', response);
        addMessage('assistant', 'Received response but couldn\'t process it properly.');
    }
}

/**
 * Execute a single Excel action
 * @param {string} action - Action type (writeToCell, formatRange, insertChart, etc.)
 * @param {object} args - Action arguments
 */
async function executeExcelAction(action, args) {
    try {
        console.log(`Executing Excel action: ${action}`, args);

        await Excel.run(async (context) => {
            const worksheet = context.workbook.worksheets.getActiveWorksheet();

            switch (action) {
                case 'writeToCell':
                    await writeToCell(worksheet, args);
                    break;

                case 'formatRange':
                    await formatRange(worksheet, args);
                    break;

                case 'insertChart':
                    await insertChart(worksheet, args);
                    break;

                case 'insertFormula':
                    await insertFormula(worksheet, args);
                    break;

                case 'insertData':
                    await insertData(worksheet, args);
                    break;

                case 'clearRange':
                    await clearRange(worksheet, args);
                    break;

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            await context.sync();
        });

        // Show success message
        const successMessage = getActionSuccessMessage(action, args);
        addSystemMessage(successMessage);

    } catch (error) {
        console.error(`Error executing ${action}:`, error);
        addSystemMessage(`❌ Failed to execute ${action}: ${error.message}`, 'error');
    }
}

/**
 * Write value to a specific cell (supports multi-sheet)
 */
async function writeToCell(currentWorksheet, args) {
    const { address, value, sheet } = args;
    if (!address || value === undefined) {
        throw new Error('writeToCell requires address and value');
    }

    // Get target worksheet (current or specified)
    let targetWorksheet = currentWorksheet;
    if (sheet && sheet !== currentWorksheet.name) {
        const workbook = currentWorksheet.context.workbook;
        targetWorksheet = workbook.worksheets.getItem(sheet);
    }

    const range = targetWorksheet.getRange(address);

    // Handle different value types
    if (typeof value === 'string' && value.startsWith('=')) {
        // It's a formula
        range.formulas = [[value]];
    } else {
        // It's a value
        range.values = [[value]];
    }
}

/**
 * Format a range of cells (supports multi-sheet)
 */
async function formatRange(currentWorksheet, args) {
    const { range, style, sheet } = args;
    if (!range || !style) {
        throw new Error('formatRange requires range and style');
    }

    // Get target worksheet (current or specified)
    let targetWorksheet = currentWorksheet;
    if (sheet && sheet !== currentWorksheet.name) {
        const workbook = currentWorksheet.context.workbook;
        targetWorksheet = workbook.worksheets.getItem(sheet);
    }

    const targetRange = targetWorksheet.getRange(range);

    // Apply formatting
    if (style.fillColor) {
        targetRange.format.fill.color = style.fillColor;
    }
    if (style.fontColor) {
        targetRange.format.font.color = style.fontColor;
    }
    if (style.bold !== undefined) {
        targetRange.format.font.bold = style.bold;
    }
    if (style.italic !== undefined) {
        targetRange.format.font.italic = style.italic;
    }
    if (style.fontSize) {
        targetRange.format.font.size = style.fontSize;
    }
    if (style.numberFormat) {
        targetRange.numberFormat = style.numberFormat;
    }
    if (style.borders) {
        // Apply border formatting
        const borders = targetRange.format.borders;
        if (style.borders.all) {
            borders.getItem('EdgeTop').style = 'Continuous';
            borders.getItem('EdgeBottom').style = 'Continuous';
            borders.getItem('EdgeLeft').style = 'Continuous';
            borders.getItem('EdgeRight').style = 'Continuous';
        }
    }
}

/**
 * Insert a chart
 */
async function insertChart(worksheet, args) {
    const { range, type = 'ColumnClustered', title } = args;
    if (!range) {
        throw new Error('insertChart requires range');
    }

    const dataRange = worksheet.getRange(range);
    const chart = worksheet.charts.add(type, dataRange);

    if (title) {
        chart.title.text = title;
    }

    // Position chart nicely
    chart.height = 300;
    chart.width = 500;
}

/**
 * Insert formula into cell
 */
async function insertFormula(worksheet, args) {
    const { address, formula } = args;
    if (!address || !formula) {
        throw new Error('insertFormula requires address and formula');
    }

    const range = worksheet.getRange(address);
    // Ensure formula starts with =
    const cleanFormula = formula.startsWith('=') ? formula : `=${formula}`;
    range.formulas = [[cleanFormula]];
}

/**
 * Insert data array into range
 */
async function insertData(worksheet, args) {
    const { startAddress, data } = args;
    if (!startAddress || !data || !Array.isArray(data)) {
        throw new Error('insertData requires startAddress and data array');
    }

    // Calculate range size
    const rowCount = data.length;
    const colCount = data[0] ? data[0].length : 0;

    if (rowCount === 0 || colCount === 0) {
        throw new Error('Data array is empty');
    }

    // Create range
    const startCell = startAddress.match(/([A-Z]+)(\d+)/);
    if (!startCell) {
        throw new Error('Invalid start address format');
    }

    const startCol = startCell[1];
    const startRow = parseInt(startCell[2]);

    // Calculate end address (simplified - works for single letters)
    const endCol = String.fromCharCode(startCol.charCodeAt(0) + colCount - 1);
    const endRow = startRow + rowCount - 1;
    const endAddress = `${endCol}${endRow}`;

    const range = worksheet.getRange(`${startAddress}:${endAddress}`);
    range.values = data;
}

/**
 * Clear a range
 */
async function clearRange(worksheet, args) {
    const { range, clearType = 'All' } = args;
    if (!range) {
        throw new Error('clearRange requires range');
    }

    const targetRange = worksheet.getRange(range);

    switch (clearType) {
        case 'Contents':
            targetRange.clear('Contents');
            break;
        case 'Formats':
            targetRange.clear('Formats');
            break;
        case 'All':
        default:
            targetRange.clear('All');
            break;
    }
}

/**
 * Generate success message for action
 */
function getActionSuccessMessage(action, args) {
    switch (action) {
        case 'writeToCell':
            const cellDesc = args.sheet ? `${args.sheet}!${args.address}` : args.address;
            return `✅ Updated ${cellDesc} to "${args.value}"`;
        case 'formatRange':
            const styleDesc = Object.keys(args.style).join(', ');
            const rangeDesc = args.sheet ? `${args.sheet}!${args.range}` : args.range;
            return `✅ Applied formatting (${styleDesc}) to ${rangeDesc}`;
        case 'insertChart':
            const chartDesc = args.sheet ? `${args.sheet}!${args.range}` : args.range;
            return `✅ Created ${args.type || 'column'} chart from ${chartDesc}`;
        case 'insertFormula':
            const formulaDesc = args.sheet ? `${args.sheet}!${args.address}` : args.address;
            return `✅ Added formula to ${formulaDesc}: ${args.formula}`;
        case 'insertData':
            const dataDesc = args.sheet ? `${args.sheet}!${args.startAddress}` : args.startAddress;
            return `✅ Inserted data starting at ${dataDesc}`;
        case 'clearRange':
            const clearDesc = args.sheet ? `${args.sheet}!${args.range}` : args.range;
            return `✅ Cleared ${clearDesc}`;
        default:
            return `✅ Executed ${action}`;
    }
}

/**
 * Add system message (for action feedback)
 */
function addSystemMessage(content, type = 'success') {
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
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Send message to backend with retry logic
 */
async function sendToBackend(message, context, retryCount = 0) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
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

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        updateStatus('Message processed successfully', 'connected');
        return data;

    } catch (error) {
        if (retryCount < CONFIG.MAX_RETRIES) {
            console.log(`Retrying request (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return sendToBackend(message, context, retryCount + 1);
        }
        throw error;
    }
}

/**
 * Get comprehensive Excel context with rich data preview
 */
async function getExcelContext() {
    return new Promise((resolve) => {
        Excel.run(async (context) => {
            try {
                const workbook = context.workbook;
                const worksheet = workbook.worksheets.getActiveWorksheet();
                const selectedRange = workbook.getSelectedRange();

                // Load worksheet info
                worksheet.load('name, position');
                selectedRange.load('address, values, formulas, rowCount, columnCount');

                // Get all worksheet names for multi-sheet context
                const worksheets = workbook.worksheets;
                worksheets.load('items/name');

                // Try to get used range for full sheet context
                let usedRange = null;
                try {
                    usedRange = worksheet.getUsedRange();
                    usedRange.load('address, values, rowCount, columnCount');
                } catch (e) {
                    // No used range - empty worksheet
                }

                // Get surrounding data context (up to 20x20 around selection)
                let surroundingData = null;
                try {
                    surroundingData = await getSurroundingDataContext(worksheet, selectedRange);
                } catch (e) {
                    console.warn('Could not get surrounding data:', e);
                }

                await context.sync();

                // Build comprehensive context
                const excelContext = {
                    // Workbook metadata
                    workbook: {
                        sheetNames: worksheets.items.map(sheet => sheet.name),
                        activeSheet: worksheet.name,
                        activeSheetIndex: worksheet.position
                    },

                    // Current sheet info
                    sheetName: worksheet.name,

                    // Selection details
                    selectedRange: selectedRange.address,
                    selection: {
                        address: selectedRange.address,
                        values: selectedRange.values,
                        formulas: selectedRange.formulas,
                        rowCount: selectedRange.rowCount,
                        columnCount: selectedRange.columnCount
                    },

                    // Data preview from selection
                    dataPreview: selectedRange.values,

                    // Surrounding context data (20x20 max)
                    surroundingContext: surroundingData,

                    // Full sheet used range
                    usedRange: usedRange ? {
                        address: usedRange.address,
                        rowCount: usedRange.rowCount,
                        columnCount: usedRange.columnCount,
                        // Include sample data from used range (first 10 rows)
                        sampleData: usedRange.values ? usedRange.values.slice(0, 10) : null
                    } : null,

                    // Context metadata
                    timestamp: new Date().toISOString(),
                    source: 'excel-addin'
                };

                resolve(excelContext);

            } catch (error) {
                console.error('Error getting Excel context:', error);
                resolve({
                    sheetName: 'Unknown',
                    selectedRange: 'Unknown',
                    selection: null,
                    dataPreview: null,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    source: 'excel-addin'
                });
            }
        });
    });
}

/**
 * Get surrounding data context around the selection (up to 20x20)
 */
async function getSurroundingDataContext(worksheet, selectedRange) {
    // Parse the selected range to get boundaries
    const rangeInfo = parseRangeAddress(selectedRange.address);
    if (!rangeInfo) return null;

    // Calculate surrounding area (20x20 max, centered on selection)
    const padding = 10; // 10 cells in each direction
    const startRow = Math.max(1, rangeInfo.startRow - padding);
    const endRow = rangeInfo.endRow + padding;
    const startCol = Math.max(1, rangeInfo.startCol - padding);
    const endCol = rangeInfo.endCol + padding;

    // Limit to 20x20 total
    const maxRows = Math.min(endRow - startRow + 1, 20);
    const maxCols = Math.min(endCol - startCol + 1, 20);

    const surroundingAddress = buildRangeAddress(
        startRow,
        startCol,
        startRow + maxRows - 1,
        startCol + maxCols - 1
    );

    try {
        const surroundingRange = worksheet.getRange(surroundingAddress);
        surroundingRange.load('address, values');
        await worksheet.context.sync();

        return {
            address: surroundingRange.address,
            values: surroundingRange.values,
            selectionOffset: {
                rowOffset: rangeInfo.startRow - startRow,
                colOffset: rangeInfo.startCol - startCol
            }
        };
    } catch (error) {
        console.warn('Could not load surrounding data:', error);
        return null;
    }
}

/**
 * Parse Excel range address (e.g., "B2:D5" -> {startRow: 2, startCol: 2, endRow: 5, endCol: 4})
 */
function parseRangeAddress(address) {
    // Handle single cell (e.g., "B2") or range (e.g., "B2:D5")
    const rangeParts = address.split(':');
    const startCell = rangeParts[0];
    const endCell = rangeParts[1] || startCell;

    const startMatch = startCell.match(/([A-Z]+)(\d+)/);
    const endMatch = endCell.match(/([A-Z]+)(\d+)/);

    if (!startMatch || !endMatch) return null;

    return {
        startRow: parseInt(startMatch[2]),
        startCol: columnLetterToNumber(startMatch[1]),
        endRow: parseInt(endMatch[2]),
        endCol: columnLetterToNumber(endMatch[1])
    };
}

/**
 * Build Excel range address from row/col numbers
 */
function buildRangeAddress(startRow, startCol, endRow, endCol) {
    const startCell = columnNumberToLetter(startCol) + startRow;
    const endCell = columnNumberToLetter(endCol) + endRow;
    return startCell === endCell ? startCell : `${startCell}:${endCell}`;
}

/**
 * Convert column letter to number (A=1, B=2, etc.)
 */
function columnLetterToNumber(letter) {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result;
}

/**
 * Convert column number to letter (1=A, 2=B, etc.)
 */
function columnNumberToLetter(number) {
    let result = '';
    while (number > 0) {
        number--;
        result = String.fromCharCode('A'.charCodeAt(0) + (number % 26)) + result;
        number = Math.floor(number / 26);
    }
    return result;
}

/**
 * Legacy support: Execute Excel actions in old format
 */
async function executeLegacyExcelActions(actions) {
    for (const action of actions) {
        try {
            await Excel.run(async (context) => {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();

                switch (action.type) {
                    case 'setValue':
                        const range = worksheet.getRange(action.address);
                        range.values = [[action.value]];
                        addSystemMessage(`✅ Set ${action.address} to "${action.value}"`);
                        break;

                    case 'setFormula':
                        const formulaRange = worksheet.getRange(action.address);
                        formulaRange.formulas = [[action.formula]];
                        addSystemMessage(`✅ Added formula to ${action.address}`);
                        break;

                    case 'formatCells':
                        const formatRange = worksheet.getRange(action.address);
                        if (action.format.bold) formatRange.format.font.bold = true;
                        if (action.format.italic) formatRange.format.font.italic = true;
                        if (action.format.color) formatRange.format.font.color = action.format.color;
                        if (action.format.backgroundColor) formatRange.format.fill.color = action.format.backgroundColor;
                        addSystemMessage(`✅ Applied formatting to ${action.address}`);
                        break;

                    case 'insertChart':
                        const dataRange = worksheet.getRange(action.dataRange);
                        const chart = worksheet.charts.add(action.chartType || 'ColumnClustered', dataRange);
                        if (action.title) chart.title.text = action.title;
                        addSystemMessage(`✅ Created chart from ${action.dataRange}`);
                        break;

                    default:
                        console.warn('Unknown legacy action type:', action.type);
                }

                await context.sync();
            });

        } catch (error) {
            console.error('Error executing legacy action:', error);
            addSystemMessage(`❌ Failed to execute: ${action.type} - ${error.message}`, 'error');
        }
    }
}

/**
 * Add a message to the chat
 */
function addMessage(sender, content) {
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
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Set processing state
 */
function setProcessing(processing) {
    isProcessing = processing;
    sendButton.disabled = processing;

    if (processing) {
        updateStatus('Processing your request...', 'connected');
        addLoadingMessage();
    } else {
        updateStatus('Ready', 'connected');
        removeLoadingMessage();
    }
}

/**
 * Add loading message
 */
function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loadingMessage';

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = 'Nubia';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-indicator';
    contentDiv.innerHTML = `
        Thinking
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    loadingDiv.appendChild(senderDiv);
    loadingDiv.appendChild(contentDiv);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Remove loading message
 */
function removeLoadingMessage() {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

/**
 * Update status bar
 */
function updateStatus(message, type = '') {
    statusText.textContent = message;
    statusText.className = type ? `status-${type}` : '';
}

// Export functions for global access
window.NubiaTaskpane = {
    addMessage,
    addSystemMessage,
    getExcelContext,
    executeExcelAction,
    processBackendResponse,
    updateStatus
};