/**
 * Moose Excel Functions
 * Core Excel integration functions for reading/writing data
 */

/**
 * Read values from the active worksheet
 * @param {string} address - Cell/range address (e.g., "A1", "A1:C5")
 * @returns {Promise<any>} - Cell values
 */
async function readWorksheetValues(address) {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                const range = worksheet.getRange(address);

                range.load('values, formulas, address');
                await context.sync();

                resolve({
                    address: range.address,
                    values: range.values,
                    formulas: range.formulas
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Write a value to a specified cell
 * @param {string} address - Cell address (e.g., "A4")
 * @param {any} value - Value to write (number, string, formula)
 * @returns {Promise<void>}
 */
async function writeToCell(address, value) {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                const range = worksheet.getRange(address);

                // Determine if it's a formula or value
                if (typeof value === 'string' && value.startsWith('=')) {
                    range.formulas = [[value]];
                } else {
                    range.values = [[value]];
                }

                await context.sync();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Get the current selection information
 * @returns {Promise<object>} - Selection details
 */
async function getCurrentSelection() {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const selectedRange = context.workbook.getSelectedRange();
                selectedRange.load('address, values, formulas, rowCount, columnCount');

                await context.sync();

                resolve({
                    address: selectedRange.address,
                    values: selectedRange.values,
                    formulas: selectedRange.formulas,
                    rowCount: selectedRange.rowCount,
                    columnCount: selectedRange.columnCount
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Get worksheet information
 * @returns {Promise<object>} - Worksheet details
 */
async function getWorksheetInfo() {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                worksheet.load('name');

                // Try to get used range
                let usedRangeInfo = null;
                try {
                    const usedRange = worksheet.getUsedRange();
                    usedRange.load('address, rowCount, columnCount');
                    await context.sync();

                    usedRangeInfo = {
                        address: usedRange.address,
                        rowCount: usedRange.rowCount,
                        columnCount: usedRange.columnCount
                    };
                } catch (e) {
                    // No used range (empty worksheet)
                    await context.sync();
                }

                resolve({
                    name: worksheet.name,
                    usedRange: usedRangeInfo
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Insert data into a range
 * @param {string} startAddress - Starting cell (e.g., "A1")
 * @param {Array<Array>} data - 2D array of data
 * @returns {Promise<void>}
 */
async function insertDataRange(startAddress, data) {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                const startRange = worksheet.getRange(startAddress);

                // Calculate the range size based on data dimensions
                const rowCount = data.length;
                const colCount = data[0] ? data[0].length : 0;

                if (rowCount === 0 || colCount === 0) {
                    throw new Error('Data array is empty');
                }

                // Create range from start cell
                const endAddress = `${String.fromCharCode(startAddress.charCodeAt(0) + colCount - 1)}${parseInt(startAddress.slice(1)) + rowCount - 1}`;
                const dataRange = worksheet.getRange(`${startAddress}:${endAddress}`);

                dataRange.values = data;
                await context.sync();

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Format a range of cells
 * @param {string} address - Cell/range address
 * @param {object} format - Format options
 * @returns {Promise<void>}
 */
async function formatRange(address, format) {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                const range = worksheet.getRange(address);

                if (format.bold !== undefined) {
                    range.format.font.bold = format.bold;
                }
                if (format.italic !== undefined) {
                    range.format.font.italic = format.italic;
                }
                if (format.fontSize !== undefined) {
                    range.format.font.size = format.fontSize;
                }
                if (format.fontColor !== undefined) {
                    range.format.font.color = format.fontColor;
                }
                if (format.backgroundColor !== undefined) {
                    range.format.fill.color = format.backgroundColor;
                }
                if (format.numberFormat !== undefined) {
                    range.numberFormat = format.numberFormat;
                }

                await context.sync();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Create a simple chart
 * @param {string} dataRange - Data range for chart
 * @param {string} chartType - Chart type (e.g., "ColumnClustered")
 * @param {string} title - Chart title
 * @returns {Promise<void>}
 */
async function createChart(dataRange, chartType = 'ColumnClustered', title = '') {
    return new Promise((resolve, reject) => {
        Excel.run(async (context) => {
            try {
                const worksheet = context.workbook.worksheets.getActiveWorksheet();
                const range = worksheet.getRange(dataRange);

                const chart = worksheet.charts.add(chartType, range);
                if (title) {
                    chart.title.text = title;
                }

                await context.sync();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Sample function to demonstrate Excel integration
 * Sets cell A4 to value 500 as requested
 */
async function setSampleValue() {
    try {
        await writeToCell('A4', 500);
        console.log('Successfully set A4 to 500');
        return { success: true, message: 'Set A4 to 500' };
    } catch (error) {
        console.error('Error setting sample value:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Demo function to read and display current selection
 */
async function demonstrateReadFunction() {
    try {
        const selection = await getCurrentSelection();
        console.log('Current selection:', selection);
        return {
            success: true,
            data: selection,
            message: `Read ${selection.rowCount}x${selection.columnCount} cells from ${selection.address}`
        };
    } catch (error) {
        console.error('Error reading selection:', error);
        return { success: false, error: error.message };
    }
}

// Export functions for use by other modules
window.MooseExcelFunctions = {
    readWorksheetValues,
    writeToCell,
    getCurrentSelection,
    getWorksheetInfo,
    insertDataRange,
    formatRange,
    createChart,
    setSampleValue,
    demonstrateReadFunction
};

// Example usage for testing
if (typeof Office !== 'undefined') {
    Office.onReady(() => {
        console.log('Moose Excel Functions loaded and ready');
    });
}