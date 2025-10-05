/**
 * Moose Excel Commands
 * Functions triggered by ribbon buttons
 */

// Configuration
const API_BASE_URL = 'https://aibun-ai.web.app/api';

/**
 * Quick Analysis function - triggered by ribbon button
 * Analyzes selected data and provides AI insights
 */
function quickAnalysis(event) {
    Excel.run(async (context) => {
        try {
            // Get the selected range
            const selectedRange = context.workbook.getSelectedRange();
            selectedRange.load('address, values, formulas, rowCount, columnCount');

            await context.sync();

            // Check if there's a meaningful selection
            if (selectedRange.rowCount === 1 && selectedRange.columnCount === 1) {
                showDialog('Quick Analysis', 'Please select a range of data (more than one cell) for analysis.');
                event.completed();
                return;
            }

            // Prepare data for analysis
            const analysisData = {
                address: selectedRange.address,
                values: selectedRange.values,
                formulas: selectedRange.formulas,
                rowCount: selectedRange.rowCount,
                columnCount: selectedRange.columnCount
            };

            // Send to backend for AI analysis using streaming endpoint
            const result = await callStreamingEndpoint({
                message: `Please analyze this Excel data and provide insights: ${selectedRange.address}`,
                context: {
                    selection: analysisData,
                    source: 'quick-analysis'
                }
            });

            if (result.success) {
                const analysis = result.content || 'Analysis completed.';

                showDialog('Quick Analysis Results', `
                    <strong>Analysis of ${selectedRange.address}:</strong><br><br>
                    ${analysis.replace(/\n/g, '<br>')}
                `);
            } else {
                showDialog('Analysis Error', result.error || 'Failed to analyze data. Please check your connection and try again.');
            }

        } catch (error) {
            console.error('Quick analysis error:', error);
            showDialog('Error', `Analysis failed: ${error.message}`);
        }

        event.completed();
    });
}

/**
 * Show a dialog with results
 */
function showDialog(title, content) {
    const dialogHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    margin: 0;
                    background: #f8f9fa;
                }
                .dialog-container {
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-width: 500px;
                    margin: 0 auto;
                }
                .dialog-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #007acc;
                    padding-bottom: 8px;
                }
                .dialog-content {
                    font-size: 14px;
                    line-height: 1.5;
                    color: #555;
                    margin-bottom: 20px;
                }
                .dialog-actions {
                    text-align: right;
                }
                .btn {
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                }
                .btn:hover {
                    background: #005a9e;
                }
            </style>
        </head>
        <body>
            <div class="dialog-container">
                <div class="dialog-title">${title}</div>
                <div class="dialog-content">${content}</div>
                <div class="dialog-actions">
                    <button class="btn" onclick="window.close()">Close</button>
                </div>
            </div>
        </body>
        </html>
    `;

    const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(dialogHtml);

    Office.context.ui.displayDialogAsync(dataUri, {
        height: 50,
        width: 60,
        displayInIframe: false
    }, (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
            console.error('Dialog failed to open:', result.error);
        }
    });
}

/**
 * Call the streaming endpoint and return the final result
 * @param {Object} requestData - The data to send to the streaming endpoint
 * @returns {Promise<Object>} - { success: boolean, content?: string, error?: string }
 */
async function callStreamingEndpoint(requestData) {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-anonymous-id': 'anonymous',
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return { success: true, content: fullContent };
                        }

                        // Try to parse as JSON first (structured data)
                        try {
                            const jsonData = JSON.parse(data);
                            if (jsonData.conversation) {
                                fullContent += jsonData.conversation;
                            } else if (jsonData.thinking) {
                                // Skip thinking content for quick analysis
                                continue;
                            } else if (jsonData.status) {
                                // Skip status updates
                                continue;
                            }
                        } catch (e) {
                            // If not JSON, treat as plain text content
                            fullContent += data;
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Stream reading error:', streamError);
            throw new Error('Failed to read streaming response');
        }

        return { success: true, content: fullContent };

    } catch (error) {
        console.error('Streaming endpoint error:', error);
        return {
            success: false,
            error: error.message || 'Failed to connect to streaming endpoint'
        };
    }
}

/**
 * Initialize commands when Office is ready
 */
Office.onReady(() => {
    console.log('Moose commands loaded and ready');
});

// Register functions globally so Office can call them
if (typeof Office !== 'undefined') {
    // Make functions available to Office
    Office.actions = Office.actions || {};
    Office.actions.quickAnalysis = quickAnalysis;
}

// Also register on global scope for Office.js
globalThis.quickAnalysis = quickAnalysis;