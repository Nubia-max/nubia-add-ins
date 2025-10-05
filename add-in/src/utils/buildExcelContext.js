/**
 * SMART EXCEL CONTEXT BUILDER - Powered by Smart Range Resolver (SRR)
 *
 * Simple, powerful context building that gives AI complete workbook awareness
 * without manual selection dependencies.
 */

import { SRR } from './SmartRangeResolver.js';

/**
 * Build SRR-powered Excel context for AI processing
 * @returns {Promise<Object>} Simple, comprehensive Excel context
 */
export async function buildExcelContext() {
  return await Excel.run(async (context) => {
    try {
      console.log('🧠 Building SRR-powered Excel context...');

      // Get workbook overview from SRR
      const workbookSummary = await SRR.getWorkbookSummary(context);

      // Get current active sheet info (but don't depend on it for actions)
      const activeSheet = context.workbook.worksheets.getActiveWorksheet();
      activeSheet.load('name');

      // Get current selection (for reference only)
      const selection = context.workbook.getSelectedRange();
      selection.load(['address', 'rowCount', 'columnCount']);

      await context.sync();

      // Build clean, simple context
      const excelContext = {
        // Workbook structure
        workbook: {
          totalSheets: workbookSummary.totalSheets,
          sheetNames: workbookSummary.sheetNames,
          summary: workbookSummary.summary
        },

        // Current state (for reference, not dependency)
        currentState: {
          activeSheet: activeSheet.name,
          selection: {
            address: selection.address,
            rowCount: selection.rowCount,
            columnCount: selection.columnCount,
            isSingleCell: selection.rowCount === 1 && selection.columnCount === 1
          }
        },

        // SRR capabilities
        capabilities: {
          canResolveAnyRange: true,
          supportsMultiSheet: true,
          supportsSemanticRanges: true,
          examples: [
            'Sheet2!A1:B10',
            'entire sheet',
            'used range',
            'all cells',
            'last used cell'
          ]
        },

        // Metadata
        timestamp: new Date().toISOString(),
        contextType: 'srr-powered'
      };

      console.log('✅ SRR Context built:', {
        sheets: excelContext.workbook.sheetNames,
        activeSheet: excelContext.currentState.activeSheet,
        selection: excelContext.currentState.selection.address
      });

      return excelContext;

    } catch (error) {
      console.warn('SRR context failed, using minimal fallback:', error);
      return buildMinimalContext(error);
    }
  });
}

/**
 * Build range-specific context for verification
 * @param {string} rangeReference - Range to analyze (e.g., "Sheet2!A1:B10", "entire sheet")
 * @param {string} userIntent - What the user wants to do
 * @returns {Promise<Object>} Context with formatting and range details
 */
export async function buildRangeContext(rangeReference, userIntent = '') {
  return await Excel.run(async (context) => {
    try {
      console.log(`🎯 Building range context for: "${rangeReference}"`);

      // Use SRR to resolve the range
      const mooseRange = await SRR.resolve(rangeReference, context, userIntent);

      // Get detailed formatting information
      const rangeDetails = await mooseRange.getWithFormatting(context);

      return {
        range: {
          reference: rangeReference,
          resolvedTo: mooseRange.toString(),
          address: rangeDetails.address,
          sheetName: mooseRange.sheetName,
          cellCount: rangeDetails.cellCount,
          rowCount: rangeDetails.rowCount,
          columnCount: rangeDetails.columnCount
        },
        formatting: {
          fillColor: rangeDetails.fillColor,
          hasData: rangeDetails.values.some(row =>
            Array.isArray(row) ? row.some(cell => cell !== null && cell !== '') : row !== null && row !== ''
          ),
          hasFormulas: rangeDetails.formulas.some(row =>
            Array.isArray(row) ? row.some(cell => cell && cell.toString().startsWith('=')) :
            rangeDetails.formulas && rangeDetails.formulas.toString().startsWith('=')
          )
        },
        intent: userIntent,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Range context failed:', error);
      return {
        range: { reference: rangeReference, error: error.message },
        formatting: {},
        intent: userIntent,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  });
}

/**
 * Minimal fallback context
 */
function buildMinimalContext(error) {
  return {
    workbook: {
      totalSheets: 0,
      sheetNames: [],
      summary: 'Workbook unavailable'
    },
    currentState: {
      activeSheet: 'Unknown',
      selection: { address: 'Unknown' }
    },
    capabilities: {
      canResolveAnyRange: false,
      supportsMultiSheet: false,
      error: error.message
    },
    timestamp: new Date().toISOString(),
    contextType: 'minimal-fallback'
  };
}

// Legacy export for compatibility
export { buildExcelContext as buildQuickExcelContext };