/**
 * Universal Excel Executor - Complete Excel Object Model Support
 * Can execute ANY Excel operation on the entire Excel object model:
 * - Workbook operations (create, save, protect, properties)
 * - Worksheet operations (add, delete, rename, copy, move)
 * - Range operations (format, formulas, values, charts)
 * - Table operations (create, format, filter, sort)
 * - Chart operations (create, modify, style)
 * - PivotTable operations (create, refresh, format)
 * - Comments, shapes, images, and all other Excel features
 *
 * NO HARDCODED LIMITATIONS - Executes any AI-generated Excel API call
 */

/**
 * Execute Excel API operations dynamically
 * @param {object} action - The action object from AI
 * @returns {Promise<void>}
 */
async function executeExcelOperation(action) {
    return Excel.run(async (context) => {
        try {
            const { code } = action;

            // Get the active worksheet
            const worksheet = context.workbook.worksheets.getActiveWorksheet();

            // Execute ALL operations dynamically - no hardcoded cases
            const result = await executeDynamicOperation(worksheet, code);

            // Always sync after operations, especially for structural changes
            await context.sync();

            // If we created a new worksheet, activate it
            if (code.method === 'add' && code.target && code.target.includes('worksheets') && result) {
                try {
                    if (typeof result.activate === 'function') {
                        result.activate();
                        await context.sync();
                        console.log('✅ New worksheet activated successfully');
                    }
                } catch (activateError) {
                    console.warn('Could not activate new worksheet:', activateError);
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Excel operation error:', error);
            throw error;
        }
    });
}

/**
 * Execute ANY Excel operation dynamically based on AI-generated code
 */
async function executeDynamicOperation(worksheet, code) {
    try {
        console.log('Executing dynamic operation:', code);

        // Start with appropriate target
        let target = worksheet;

        // Handle ANY Excel object model target
        if (code.target) {
            if (code.target.match(/^[A-Z]+\d+(:[A-Z]+\d+)?$/)) {
                // Cell/range reference like "A1" or "A1:B10"
                target = worksheet.getRange(code.target);
            } else {
                // Navigate to any Excel object dynamically
                const targetPath = code.target.split('.');
                let current = worksheet.context;

                for (const part of targetPath) {
                    if (current && current[part] !== undefined) {
                        current = current[part];
                    } else {
                        console.warn(`Cannot navigate to target: ${part} in ${code.target}`);
                        current = null;
                        break;
                    }
                }

                if (current) {
                    target = current;
                } else {
                    // Fallback: try from workbook level
                    current = worksheet.context.workbook;
                    for (const part of targetPath) {
                        if (current && current[part] !== undefined) {
                            current = current[part];
                        } else {
                            console.warn(`Cannot navigate to workbook target: ${part} in ${code.target}`);
                            break;
                        }
                    }
                    if (current) target = current;
                }
            }
        }

        // Handle method execution
        if (code.method) {
            const methodPath = code.method.split('.');
            let current = target;

            // Navigate to the method, but execute the last part
            for (let i = 0; i < methodPath.length; i++) {
                const methodPart = methodPath[i];

                if (i === methodPath.length - 1) {
                    // Last part - execute it if it's a function
                    if (current && typeof current[methodPart] === 'function') {
                        console.log(`Executing method: ${methodPart}`, code.arguments);
                        current = current[methodPart](...(code.arguments || []));
                    } else if (current && current[methodPart] !== undefined) {
                        current = current[methodPart];
                    }
                } else {
                    // Navigate deeper
                    if (current && current[methodPart] !== undefined) {
                        current = current[methodPart];
                    } else {
                        console.warn(`Cannot navigate to ${methodPart} in method path`);
                        break;
                    }
                }
            }

            // Update target to the result of method execution
            if (current) {
                target = current;
            }
        }

        // Apply properties safely
        if (code.properties && target) {
            Object.keys(code.properties).forEach(key => {
                try {
                    if (key.includes('.')) {
                        // Handle nested properties like "format.fill.color"
                        const keyParts = key.split('.');
                        let nestedTarget = target;

                        // Navigate to the nested property
                        for (let i = 0; i < keyParts.length - 1; i++) {
                            if (!nestedTarget[keyParts[i]]) {
                                nestedTarget[keyParts[i]] = {};
                            }
                            nestedTarget = nestedTarget[keyParts[i]];
                        }

                        // Set the final property
                        nestedTarget[keyParts[keyParts.length - 1]] = code.properties[key];
                    } else {
                        // Direct property assignment
                        target[key] = code.properties[key];
                    }
                } catch (propError) {
                    console.warn(`Failed to set property ${key}:`, propError);
                }
            });
        }

        // Handle special Excel operations
        if (code.formulas && target.formulas !== undefined) {
            target.formulas = code.formulas;
        }

        if (code.values && target.values !== undefined) {
            target.values = code.values;
        }

        // Don't try to access worksheet properties here - handle activation in main function

        return target;

    } catch (error) {
        console.error('Dynamic operation failed:', error);
        throw new Error(`Could not execute operation: ${error.message}`);
    }
}

// Export for use in taskpane.js
window.executeExcelOperation = executeExcelOperation;