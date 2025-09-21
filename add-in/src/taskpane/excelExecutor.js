/**
 * Universal Excel Executor
 * Can execute ANY Excel operation based on API specifications from OpenAI
 */

/**
 * Execute Excel API operations dynamically
 * @param {object} action - The action object from OpenAI
 * @returns {Promise<void>}
 */
async function executeExcelOperation(action) {
    return Excel.run(async (context) => {
        try {
            const { code } = action;

            // Get the active worksheet
            const worksheet = context.workbook.worksheets.getActiveWorksheet();

            switch (code.method) {
                case 'getRange':
                    await executeRangeOperation(worksheet, code);
                    break;

                case 'addChart':
                    await executeChartOperation(worksheet, code);
                    break;

                case 'addTable':
                    await executeTableOperation(worksheet, code);
                    break;

                case 'conditionalFormats.add':
                    await executeConditionalFormat(worksheet, code);
                    break;

                case 'protection':
                    await executeProtection(worksheet, code);
                    break;

                case 'insertRowsAbove':
                case 'insertRowsBelow':
                case 'insertColumnsLeft':
                case 'insertColumnsRight':
                    await executeStructuralChange(worksheet, code);
                    break;

                default:
                    // For any other Excel API method, try to execute it dynamically
                    await executeDynamicOperation(worksheet, code);
            }

            await context.sync();
            return { success: true };

        } catch (error) {
            console.error('Excel operation error:', error);
            throw error;
        }
    });
}

/**
 * Execute range-based operations (formatting, formulas, values)
 */
async function executeRangeOperation(worksheet, code) {
    const range = worksheet.getRange(code.target);

    // Apply all properties dynamically
    for (const [key, value] of Object.entries(code.properties || {})) {
        try {
            // Handle nested properties like format.fill.color
            const keys = key.split('.');
            let target = range;

            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }

            target[keys[keys.length - 1]] = value;

        } catch (error) {
            console.warn(`Could not set property ${key}:`, error);
        }
    }

    return range;
}

/**
 * Execute chart operations
 */
async function executeChartOperation(worksheet, code) {
    const charts = worksheet.charts;

    const chart = charts.add(
        code.chartType || Excel.ChartType.columnClustered,
        worksheet.getRange(code.sourceData),
        code.seriesBy || Excel.ChartSeriesBy.auto
    );

    // Position the chart
    if (code.position) {
        chart.top = code.position.top || 100;
        chart.left = code.position.left || 100;
        chart.width = code.position.width || 400;
        chart.height = code.position.height || 300;
    }

    // Set title if provided
    if (code.title) {
        chart.title.text = code.title;
    }

    return chart;
}

/**
 * Execute table operations
 */
async function executeTableOperation(worksheet, code) {
    const tables = worksheet.tables;

    const table = tables.add(
        worksheet.getRange(code.target),
        code.hasHeaders !== false // Default to true
    );

    if (code.name) {
        table.name = code.name;
    }

    if (code.style) {
        table.style = code.style;
    }

    return table;
}

/**
 * Execute conditional formatting
 */
async function executeConditionalFormat(worksheet, code) {
    const range = worksheet.getRange(code.target);
    const conditionalFormat = range.conditionalFormats.add(code.type);

    // Apply the rule
    if (code.rule) {
        Object.assign(conditionalFormat.rule, code.rule);
    }

    // Apply the format
    if (code.format) {
        for (const [key, value] of Object.entries(code.format)) {
            const keys = key.split('.');
            let target = conditionalFormat;

            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }

            target[keys[keys.length - 1]] = value;
        }
    }

    return conditionalFormat;
}

/**
 * Execute protection operations
 */
async function executeProtection(worksheet, code) {
    const protection = worksheet.protection;

    if (code.protect) {
        protection.protect(code.options || {});
    } else {
        protection.unprotect();
    }

    return protection;
}

/**
 * Execute structural changes (insert/delete rows/columns)
 */
async function executeStructuralChange(worksheet, code) {
    const range = worksheet.getRange(code.target);

    switch (code.method) {
        case 'insertRowsAbove':
            range.getEntireRow().insert(Excel.InsertShiftDirection.down);
            break;
        case 'insertRowsBelow':
            range.getEntireRow().insert(Excel.InsertShiftDirection.down);
            break;
        case 'insertColumnsLeft':
            range.getEntireColumn().insert(Excel.InsertShiftDirection.right);
            break;
        case 'insertColumnsRight':
            range.getEntireColumn().insert(Excel.InsertShiftDirection.right);
            break;
        case 'deleteRows':
            range.getEntireRow().delete(Excel.DeleteShiftDirection.up);
            break;
        case 'deleteColumns':
            range.getEntireColumn().delete(Excel.DeleteShiftDirection.left);
            break;
    }
}

/**
 * Execute any other Excel operation dynamically
 */
async function executeDynamicOperation(worksheet, code) {
    // This is a catch-all for any Excel API operation
    // It attempts to execute the operation based on the method and properties

    try {
        // Parse the method path (e.g., "range.format.fill")
        const methodPath = code.method.split('.');
        let target = worksheet;

        // Navigate to the target object
        if (code.target) {
            target = worksheet.getRange(code.target);
        }

        // Apply any additional navigation
        for (const key of methodPath) {
            if (typeof target[key] === 'function') {
                target = target[key]();
            } else {
                target = target[key];
            }
        }

        // Apply properties if any
        if (code.properties) {
            Object.assign(target, code.properties);
        }

        // Execute method if specified
        if (code.execute) {
            if (typeof target[code.execute] === 'function') {
                target[code.execute](...(code.arguments || []));
            }
        }

        return target;

    } catch (error) {
        console.error('Dynamic operation failed:', error);
        throw new Error(`Could not execute ${code.method}: ${error.message}`);
    }
}

// Export for use in taskpane.js
window.executeExcelOperation = executeExcelOperation;