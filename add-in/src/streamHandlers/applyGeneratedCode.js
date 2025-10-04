/**
 * Apply Generated Code Utility
 *
 * Safely executes AI-generated Office.js code in Excel
 * Provides error handling, validation, and execution feedback
 */

/**
 * Apply AI-generated Excel code with safety checks
 * @param {Object} aiResponse - AI response containing code and metadata
 * @returns {Promise<Object>} Execution result with success/error details
 */
export async function applyGeneratedCode(aiResponse) {
    console.log('⚡ Applying AI-generated Excel code...');

    const { code, understanding, message, confidence } = aiResponse;

    try {
        // Validate the code before execution
        const validation = validateCode(code);
        if (!validation.isValid) {
            return {
                success: false,
                message: `Code validation failed: ${validation.error}`,
                type: 'validation_error'
            };
        }

        // Log execution attempt
        console.log('📝 Executing Office.js code:', {
            codeLength: code.length,
            confidence: confidence,
            description: understanding || message
        });

        // Execute the code using the existing unlimited executor
        const result = await executeOfficeJSCode(code, understanding || message || 'AI-generated operation');

        if (result.success) {
            console.log('✅ AI code executed successfully');
            return {
                success: true,
                message: 'Excel operation completed successfully',
                result: result.data,
                executionTime: result.executionTime,
                type: 'success'
            };
        } else {
            console.warn('⚠️ AI code execution completed with warnings');
            return {
                success: false,
                message: result.message || 'Execution completed with warnings',
                error: result.error,
                type: 'execution_warning'
            };
        }

    } catch (error) {
        console.error('❌ AI code execution failed:', error);
        return {
            success: false,
            message: `Execution failed: ${error.message}`,
            error: error,
            type: 'execution_error'
        };
    }
}

/**
 * Validate Office.js code for safety and correctness
 * @param {string} code - Code to validate
 * @returns {Object} Validation result
 */
function validateCode(code) {
    if (!code || typeof code !== 'string') {
        return {
            isValid: false,
            error: 'No code provided'
        };
    }

    // Remove comments and whitespace for analysis
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();

    if (!cleanCode) {
        return {
            isValid: false,
            error: 'Code is empty after removing comments'
        };
    }

    // Check for required Office.js patterns
    const requiredPatterns = ['Excel.run'];
    const hasRequiredPattern = requiredPatterns.some(pattern =>
        cleanCode.includes(pattern)
    );

    if (!hasRequiredPattern) {
        return {
            isValid: false,
            error: 'Code does not contain required Office.js patterns (Excel.run)'
        };
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
        'eval(',
        'Function(',
        'setTimeout(',
        'setInterval(',
        'XMLHttpRequest',
        'fetch(',
        'import(',
        'require(',
        'process.',
        'window.location',
        'document.cookie'
    ];

    for (const pattern of dangerousPatterns) {
        if (cleanCode.includes(pattern)) {
            return {
                isValid: false,
                error: `Code contains potentially dangerous pattern: ${pattern}`
            };
        }
    }

    // Check for proper async/await structure
    if (cleanCode.includes('Excel.run') && !cleanCode.includes('await')) {
        return {
            isValid: false,
            error: 'Excel.run should be used with await'
        };
    }

    // Check for context.sync() calls
    if (cleanCode.includes('context.') && !cleanCode.includes('context.sync')) {
        return {
            isValid: false,
            error: 'Code uses context but missing context.sync() calls'
        };
    }

    return {
        isValid: true,
        warnings: []
    };
}

/**
 * Execute Office.js code using the existing unlimited executor
 * @param {string} code - Office.js code to execute
 * @param {string} description - Description of the operation
 * @returns {Promise<Object>} Execution result
 */
async function executeOfficeJSCode(code, description) {
    try {
        // Check if unlimited executor is available
        if (typeof executeUnlimitedExcelCode !== 'function') {
            throw new Error('Excel executor not available. Please refresh the page.');
        }

        // Use the existing unlimited executor function
        const startTime = performance.now();
        const result = await executeUnlimitedExcelCode(code, description);
        const endTime = performance.now();

        return {
            success: result.success,
            message: result.message,
            data: result.data,
            error: result.error,
            executionTime: Math.round(endTime - startTime)
        };

    } catch (error) {
        console.error('Office.js execution error:', error);
        throw error;
    }
}

/**
 * Apply code with progress tracking
 * @param {Object} aiResponse - AI response with code
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Execution result
 */
export async function applyGeneratedCodeWithProgress(aiResponse, onProgress = null) {
    try {
        if (onProgress) onProgress('Validating code...', 10);

        // Validation step
        const validation = validateCode(aiResponse.code);
        if (!validation.isValid) {
            if (onProgress) onProgress('Validation failed', 0);
            return {
                success: false,
                message: `Validation failed: ${validation.error}`,
                type: 'validation_error'
            };
        }

        if (onProgress) onProgress('Executing Excel operation...', 50);

        // Execution step
        const result = await applyGeneratedCode(aiResponse);

        if (onProgress) {
            const progressMessage = result.success ? 'Operation completed' : 'Operation failed';
            onProgress(progressMessage, 100);
        }

        return result;

    } catch (error) {
        if (onProgress) onProgress('Execution error', 0);
        throw error;
    }
}

/**
 * Dry run code execution - validate without applying
 * @param {string} code - Code to validate
 * @returns {Promise<Object>} Validation result with detailed analysis
 */
export async function dryRunCode(code) {
    console.log('🧪 Performing dry run of AI-generated code...');

    try {
        // Basic validation
        const validation = validateCode(code);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.error,
                type: 'validation_error'
            };
        }

        // Analyze code structure
        const analysis = analyzeCodeStructure(code);

        return {
            success: true,
            message: 'Code passed validation',
            analysis: analysis,
            type: 'dry_run_success'
        };

    } catch (error) {
        return {
            success: false,
            message: `Dry run failed: ${error.message}`,
            error: error,
            type: 'dry_run_error'
        };
    }
}

/**
 * Analyze code structure for better understanding
 * @param {string} code - Code to analyze
 * @returns {Object} Code analysis
 */
function analyzeCodeStructure(code) {
    const analysis = {
        linesOfCode: code.split('\n').length,
        usesWorkbook: code.includes('workbook'),
        usesWorksheet: code.includes('worksheet') || code.includes('getWorksheet'),
        usesRange: code.includes('getRange') || code.includes('Range'),
        setsValues: code.includes('setValue') || code.includes('setFormula'),
        readsValues: code.includes('getValue') || code.includes('values'),
        usesFormatting: code.includes('format') || code.includes('Format'),
        usesCharts: code.includes('chart') || code.includes('Chart'),
        syncCalls: (code.match(/context\.sync/g) || []).length,
        complexity: 'low'
    };

    // Determine complexity
    if (analysis.linesOfCode > 50 || analysis.syncCalls > 3) {
        analysis.complexity = 'high';
    } else if (analysis.linesOfCode > 20 || analysis.syncCalls > 1) {
        analysis.complexity = 'medium';
    }

    return analysis;
}

/**
 * Batch apply multiple code snippets
 * @param {Array} aiResponses - Array of AI responses with code
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Array of execution results
 */
export async function applyBatchCode(aiResponses, onProgress = null) {
    console.log(`⚡ Applying batch of ${aiResponses.length} AI-generated operations...`);

    const results = [];

    for (let i = 0; i < aiResponses.length; i++) {
        const response = aiResponses[i];

        if (onProgress) {
            const progress = Math.round(((i + 1) / aiResponses.length) * 100);
            onProgress(`Executing operation ${i + 1} of ${aiResponses.length}...`, progress);
        }

        try {
            const result = await applyGeneratedCode(response);
            results.push({
                index: i,
                success: result.success,
                result: result
            });

            // Stop on first failure if critical
            if (!result.success && response.critical) {
                console.warn(`Stopping batch execution due to critical failure at operation ${i + 1}`);
                break;
            }

        } catch (error) {
            results.push({
                index: i,
                success: false,
                error: error.message
            });

            // Stop on error
            if (response.critical) {
                break;
            }
        }
    }

    return results;
}

// Export all functions
export {
    applyGeneratedCodeWithProgress,
    dryRunCode,
    applyBatchCode,
    validateCode
};