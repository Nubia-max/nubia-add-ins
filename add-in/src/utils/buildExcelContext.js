/**
 * Excel Context Builder Utility
 *
 * Builds comprehensive JSON representation of Excel workbook for AI reasoning
 * Extracts worksheets, data samples, formulas, named ranges, and charts
 * Optimized for performance with data sampling (20 rows × 10 cols)
 */

/**
 * Build comprehensive Excel context for AI processing
 * @returns {Promise<Object>} Excel workbook context with all relevant data
 */
export async function buildExcelContext() {
  try {
    return await Excel.run(async (context) => {
      console.log('📊 Building Excel context...');

      const workbook = context.workbook;
      const worksheets = workbook.worksheets;
      const activeWorksheet = worksheets.getActiveWorksheet();
      const selection = context.workbook.getSelectedRange();

      // Load workbook-level properties
      workbook.load(['name', 'application']);
      worksheets.load('items');
      activeWorksheet.load(['name', 'position']);
      selection.load(['address', 'rowCount', 'columnCount']);

      await context.sync();

      console.log(`📖 Workbook: "${workbook.name}" with ${worksheets.items.length} sheets`);

      const sheetsData = [];

      // Process each worksheet with comprehensive data extraction
      for (let i = 0; i < worksheets.items.length; i++) {
        const sheet = worksheets.items[i];
        const sheetData = await extractSheetData(context, sheet);
        sheetsData.push(sheetData);
      }

      // Build final context object
      const excelContext = {
        workbookName: workbook.name || 'Untitled Workbook',
        activeSheet: activeWorksheet.name,
        selectedRange: selection.address,
        totalSheets: worksheets.items.length,
        worksheets: sheetsData,
        contextSummary: generateContextSummary(sheetsData, activeWorksheet.name),
        timestamp: new Date().toISOString()
      };

      console.log('✅ Excel context built successfully:', {
        workbook: excelContext.workbookName,
        sheets: excelContext.totalSheets,
        activeSheet: excelContext.activeSheet,
        selectedRange: excelContext.selectedRange
      });

      return excelContext;
    });

  } catch (error) {
    console.warn('Failed to build Excel context:', error);

    // Return minimal fallback context
    return {
      workbookName: 'Unknown Workbook',
      activeSheet: 'Unknown Sheet',
      selectedRange: null,
      totalSheets: 0,
      worksheets: [],
      contextSummary: 'Excel context unavailable - limited functionality',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Extract comprehensive data from a single worksheet
 * @param {Object} context - Excel context
 * @param {Object} sheet - Worksheet object
 * @returns {Promise<Object>} Sheet data with samples, formulas, etc.
 */
async function extractSheetData(context, sheet) {
  try {
    console.log(`📋 Processing sheet: "${sheet.name}"`);

    // Load basic sheet properties
    sheet.load(['name', 'position', 'visibility']);

    let sheetData = {
      name: sheet.name,
      position: null,
      visibility: null,
      activeRange: null,
      sampleData: [],
      namedRanges: [],
      formulas: [],
      charts: [],
      rowCount: 0,
      colCount: 0,
      hasData: false
    };

    await context.sync();

    sheetData.position = sheet.position;
    sheetData.visibility = sheet.visibility;

    // Try to get used range for data extraction
    try {
      const usedRange = sheet.getUsedRange();
      usedRange.load(['values', 'formulas', 'address', 'rowCount', 'columnCount']);

      await context.sync();

      if (usedRange.values && usedRange.values.length > 0) {
        sheetData.rowCount = usedRange.rowCount;
        sheetData.colCount = usedRange.columnCount;
        sheetData.activeRange = usedRange.address;

        // Extract sample data (first 20 rows × 10 columns for performance)
        const maxRows = Math.min(20, usedRange.values.length);
        const maxCols = 10;

        sheetData.sampleData = usedRange.values
          .slice(0, maxRows)
          .map(row => {
            if (Array.isArray(row)) {
              return row.slice(0, maxCols);
            }
            return [row]; // Single value
          });

        // Check if sheet has meaningful data
        sheetData.hasData = sheetData.sampleData.some(row =>
          row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );

        // Extract formulas from used range
        if (usedRange.formulas && usedRange.formulas.length > 0) {
          sheetData.formulas = extractFormulas(usedRange.formulas, usedRange.address);
        }

        console.log(`  📊 Data: ${sheetData.rowCount}×${sheetData.colCount}, Sample: ${sheetData.sampleData.length} rows`);
      }

    } catch (rangeError) {
      console.log(`  ⚠️ No used range found for sheet "${sheet.name}"`);
      // Sheet is empty or has no used range
    }

    // Extract named ranges for this sheet
    try {
      const namedItems = sheet.names;
      namedItems.load('items');
      await context.sync();

      sheetData.namedRanges = namedItems.items.map(namedItem => ({
        name: namedItem.name || '',
        range: namedItem.address || '',
        scope: 'Worksheet'
      }));

      if (sheetData.namedRanges.length > 0) {
        console.log(`  📍 Named ranges: ${sheetData.namedRanges.length}`);
      }

    } catch (namedRangeError) {
      console.log(`  ⚠️ Could not extract named ranges for sheet "${sheet.name}"`);
    }

    // Extract charts
    try {
      const charts = sheet.charts;
      charts.load('items');
      await context.sync();

      sheetData.charts = charts.items.map((chart, index) => ({
        name: chart.name || `Chart ${index + 1}`,
        type: chart.chartType || 'Unknown',
        dataRange: chart.series.items[0]?.points?.items?.[0]?.dataLabel?.range || '',
        position: `${chart.left},${chart.top}`
      }));

      if (sheetData.charts.length > 0) {
        console.log(`  📈 Charts: ${sheetData.charts.length}`);
      }

    } catch (chartError) {
      console.log(`  ⚠️ Could not extract charts for sheet "${sheet.name}"`);
    }

    return sheetData;

  } catch (error) {
    console.warn(`Error processing sheet "${sheet.name}":`, error);

    return {
      name: sheet.name || 'Error Sheet',
      position: null,
      activeRange: null,
      sampleData: [],
      namedRanges: [],
      formulas: [],
      charts: [],
      rowCount: 0,
      colCount: 0,
      hasData: false,
      error: error.message
    };
  }
}

/**
 * Extract formulas from range data
 * @param {Array} formulasArray - 2D array of formulas
 * @param {string} rangeAddress - Address of the range
 * @returns {Array} Array of formula objects
 */
function extractFormulas(formulasArray, rangeAddress) {
  const formulas = [];
  const startRow = parseInt(rangeAddress.match(/\d+/)[0]); // Extract starting row number

  formulasArray.forEach((row, rowIndex) => {
    if (Array.isArray(row)) {
      row.forEach((formula, colIndex) => {
        if (formula && typeof formula === 'string' && formula.startsWith('=')) {
          const cellAddress = `${columnIndexToLetter(colIndex)}${startRow + rowIndex}`;
          formulas.push({
            cell: cellAddress,
            formula: formula,
            result: null // We don't extract results for performance
          });
        }
      });
    }
  });

  return formulas.slice(0, 50); // Limit to first 50 formulas for performance
}

/**
 * Convert column index to Excel letter (0 -> A, 25 -> Z, 26 -> AA)
 * @param {number} index - Column index
 * @returns {string} Excel column letter
 */
function columnIndexToLetter(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Generate human-readable summary of Excel context
 * @param {Array} sheets - Array of sheet data
 * @param {string} activeSheet - Name of active sheet
 * @returns {string} Context summary for AI
 */
function generateContextSummary(sheets, activeSheet) {
  const parts = [];

  // Overall summary
  const totalSheets = sheets.length;
  const sheetsWithData = sheets.filter(s => s.hasData).length;

  parts.push(`Excel workbook with ${totalSheets} sheet(s), ${sheetsWithData} containing data`);

  if (activeSheet) {
    parts.push(`Currently active: "${activeSheet}"`);
  }

  // Sheet-by-sheet summary
  sheets.forEach(sheet => {
    const sheetParts = [];

    if (sheet.hasData) {
      sheetParts.push(`${sheet.rowCount}×${sheet.colCount} data`);
    } else {
      sheetParts.push('empty');
    }

    if (sheet.formulas.length > 0) {
      sheetParts.push(`${sheet.formulas.length} formulas`);
    }

    if (sheet.namedRanges.length > 0) {
      sheetParts.push(`${sheet.namedRanges.length} named ranges`);
    }

    if (sheet.charts.length > 0) {
      sheetParts.push(`${sheet.charts.length} charts`);
    }

    parts.push(`"${sheet.name}": ${sheetParts.join(', ')}`);
  });

  return parts.join('. ');
}

/**
 * Quick context builder for performance-critical scenarios
 * Only extracts basic workbook info without deep data analysis
 * @returns {Promise<Object>} Lightweight Excel context
 */
export async function buildQuickExcelContext() {
  try {
    return await Excel.run(async (context) => {
      const workbook = context.workbook;
      const activeWorksheet = workbook.worksheets.getActiveWorksheet();
      const selection = context.workbook.getSelectedRange();

      workbook.load('name');
      activeWorksheet.load('name');
      selection.load('address');

      await context.sync();

      return {
        workbookName: workbook.name,
        activeSheet: activeWorksheet.name,
        selectedRange: selection.address,
        timestamp: new Date().toISOString(),
        contextType: 'quick'
      };
    });

  } catch (error) {
    console.warn('Quick context build failed:', error);
    return {
      workbookName: 'Unknown',
      activeSheet: 'Unknown',
      selectedRange: null,
      timestamp: new Date().toISOString(),
      contextType: 'quick',
      error: error.message
    };
  }
}

// Export both functions
export { buildQuickExcelContext };