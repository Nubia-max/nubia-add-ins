/**
 * Smart Range Resolver (SRR) - Moose's Multi-Sheet Intelligence System
 *
 * Gives Moose the ability to understand and resolve ANY range reference
 * across the entire workbook without manual selection dependencies.
 */

class MooseRange {
    constructor(sheetName, address, description = '') {
        this.sheetName = sheetName;
        this.address = address;
        this.description = description;
        this.isValid = true;
        this.error = null;
    }

    /**
     * Get the actual Office.js Range object
     */
    async get(context) {
        try {
            const worksheet = context.workbook.worksheets.getItem(this.sheetName);
            const range = worksheet.getRange(this.address);
            range.load(['address', 'values', 'formulas', 'format']);
            await context.sync();
            return range;
        } catch (error) {
            this.isValid = false;
            this.error = error.message;
            throw new Error(`Cannot access ${this.sheetName}!${this.address}: ${error.message}`);
        }
    }

    /**
     * Get range with formatting information for verification
     */
    async getWithFormatting(context) {
        try {
            const worksheet = context.workbook.worksheets.getItem(this.sheetName);
            const range = worksheet.getRange(this.address);
            range.load(['address', 'values', 'formulas', 'format/fill/color', 'rowCount', 'columnCount']);
            await context.sync();

            return {
                range: range,
                address: range.address,
                values: range.values,
                formulas: range.formulas,
                fillColor: range.format.fill.color,
                rowCount: range.rowCount,
                columnCount: range.columnCount,
                cellCount: range.rowCount * range.columnCount
            };
        } catch (error) {
            this.isValid = false;
            this.error = error.message;
            throw new Error(`Cannot access formatted range ${this.sheetName}!${this.address}: ${error.message}`);
        }
    }

    toString() {
        return `${this.sheetName}!${this.address}${this.description ? ` (${this.description})` : ''}`;
    }
}

class SmartRangeResolver {
    constructor() {
        this.workbookCache = {
            sheets: [],
            namedRanges: [],
            tables: [],
            lastUpdated: null
        };
    }

    /**
     * Main resolution method - THE BRAIN OF MOOSE RANGE INTELLIGENCE
     */
    async resolve(reference, context, userIntent = '') {
        console.log(`🧠 SRR: Resolving "${reference}" with intent: "${userIntent}"`);

        // Update workbook cache
        await this.updateWorkbookCache(context);

        // Parse the reference
        const parseResult = this.parseReference(reference);
        console.log(`🔍 SRR: Parse result:`, parseResult);

        if (parseResult.type === 'direct') {
            // Direct sheet!range reference (e.g., "Sheet2!A1:B10")
            return await this.resolveDirect(parseResult, context);
        }
        else if (parseResult.type === 'semantic') {
            // Semantic reference (e.g., "entire sheet", "all cells", "last used cell")
            return await this.resolveSemantic(parseResult, context, userIntent);
        }
        else if (parseResult.type === 'search') {
            // Search-based reference (e.g., "cells containing 'Tax'")
            return await this.resolveSearch(parseResult, context);
        }
        else {
            throw new Error(`SRR: Cannot resolve reference "${reference}"`);
        }
    }

    /**
     * Parse any reference into structured format
     */
    parseReference(reference) {
        const ref = reference.trim();

        // Direct sheet!range patterns
        const directPatterns = [
            /^(.+?)!([A-Z]+\d+(?::[A-Z]+\d+)?)$/i,  // Sheet1!A1 or Sheet1!A1:B10
            /^(.+?)!(.+)$/                           // Sheet1!NamedRange
        ];

        for (const pattern of directPatterns) {
            const match = ref.match(pattern);
            if (match) {
                return {
                    type: 'direct',
                    sheetName: match[1].replace(/'/g, ''), // Remove quotes
                    range: match[2],
                    original: reference
                };
            }
        }

        // Semantic patterns for natural language
        const semanticPatterns = [
            { pattern: /entire\s+sheet|whole\s+sheet|all\s+cells/i, semantic: 'entire_sheet' },
            { pattern: /used\s+range|data\s+range/i, semantic: 'used_range' },
            { pattern: /last\s+used\s+cell/i, semantic: 'last_cell' },
            { pattern: /selected\s+range|current\s+selection/i, semantic: 'selection' },
            { pattern: /active\s+sheet|current\s+sheet/i, semantic: 'active_sheet' }
        ];

        for (const { pattern, semantic } of semanticPatterns) {
            if (pattern.test(ref)) {
                return {
                    type: 'semantic',
                    semantic: semantic,
                    original: reference
                };
            }
        }

        // Search patterns
        const searchPatterns = [
            { pattern: /cells?\s+containing\s+['"](.*?)['"]|cells?\s+with\s+['"](.*?)['"]/i, type: 'contains' },
            { pattern: /empty\s+cells?/i, type: 'empty' },
            { pattern: /formula\s+cells?/i, type: 'formulas' }
        ];

        for (const { pattern, type } of searchPatterns) {
            const match = ref.match(pattern);
            if (match) {
                return {
                    type: 'search',
                    searchType: type,
                    searchValue: match[1] || match[2] || '',
                    original: reference
                };
            }
        }

        // Fallback: treat as simple range on active sheet
        return {
            type: 'direct',
            sheetName: null, // Will use active sheet
            range: reference,
            original: reference
        };
    }

    /**
     * Resolve direct sheet!range references
     */
    async resolveDirect(parseResult, context) {
        let sheetName = parseResult.sheetName;

        // If no sheet specified, find the active sheet
        if (!sheetName) {
            const activeSheet = context.workbook.worksheets.getActiveWorksheet();
            activeSheet.load('name');
            await context.sync();
            sheetName = activeSheet.name;
        }

        // Validate sheet exists
        if (!this.workbookCache.sheets.includes(sheetName)) {
            // Try to find similar sheet names
            const suggestions = this.findSimilarSheetNames(sheetName);
            if (suggestions.length > 0) {
                throw new Error(`Sheet "${sheetName}" not found. Did you mean: ${suggestions.join(', ')}?`);
            } else {
                throw new Error(`Sheet "${sheetName}" does not exist. Available sheets: ${this.workbookCache.sheets.join(', ')}`);
            }
        }

        return new MooseRange(sheetName, parseResult.range, parseResult.original);
    }

    /**
     * Resolve semantic references like "entire sheet", "used range"
     */
    async resolveSemantic(parseResult, context, userIntent) {
        const activeSheet = context.workbook.worksheets.getActiveWorksheet();
        activeSheet.load('name');
        await context.sync();
        const sheetName = activeSheet.name;

        switch (parseResult.semantic) {
            case 'entire_sheet':
                // For "paint entire sheet" requests, we want ALL cells
                return new MooseRange(sheetName, 'A1:XFD1048576', 'entire sheet');

            case 'used_range':
                try {
                    const usedRange = activeSheet.getUsedRange();
                    usedRange.load('address');
                    await context.sync();
                    const address = usedRange.address.split('!')[1]; // Remove sheet prefix
                    return new MooseRange(sheetName, address, 'used range');
                } catch (error) {
                    // If no used range, fall back to A1
                    return new MooseRange(sheetName, 'A1', 'empty sheet - defaulting to A1');
                }

            case 'last_cell':
                try {
                    const usedRange = activeSheet.getUsedRange();
                    usedRange.load(['address', 'rowCount', 'columnCount']);
                    await context.sync();

                    const lastRow = usedRange.rowCount;
                    const lastCol = usedRange.columnCount;
                    const lastCellAddress = this.columnNumberToLetter(lastCol) + lastRow;

                    return new MooseRange(sheetName, lastCellAddress, 'last used cell');
                } catch (error) {
                    return new MooseRange(sheetName, 'A1', 'no data - defaulting to A1');
                }

            case 'selection':
                const selection = context.workbook.getSelectedRange();
                selection.load('address');
                await context.sync();
                const selectionAddress = selection.address.split('!')[1];
                return new MooseRange(sheetName, selectionAddress, 'current selection');

            case 'active_sheet':
                return new MooseRange(sheetName, 'A1:XFD1048576', 'active sheet - all cells');

            default:
                throw new Error(`Unknown semantic reference: ${parseResult.semantic}`);
        }
    }

    /**
     * Resolve search-based references
     */
    async resolveSearch(parseResult, context) {
        // This would implement searching across sheets for specific content
        // For now, return a placeholder
        throw new Error(`Search-based resolution not yet implemented: ${parseResult.original}`);
    }

    /**
     * Update internal cache of workbook structure
     */
    async updateWorkbookCache(context) {
        try {
            const worksheets = context.workbook.worksheets;
            worksheets.load('items/name');
            await context.sync();

            this.workbookCache.sheets = worksheets.items.map(sheet => sheet.name);
            this.workbookCache.lastUpdated = new Date();

            console.log(`📊 SRR: Workbook cache updated. Sheets: ${this.workbookCache.sheets.join(', ')}`);
        } catch (error) {
            console.error('SRR: Failed to update workbook cache:', error);
        }
    }

    /**
     * Find sheet names similar to the requested one
     */
    findSimilarSheetNames(targetName) {
        return this.workbookCache.sheets.filter(sheetName =>
            sheetName.toLowerCase().includes(targetName.toLowerCase()) ||
            targetName.toLowerCase().includes(sheetName.toLowerCase())
        );
    }

    /**
     * Convert column number to letter (1 = A, 26 = Z, 27 = AA)
     */
    columnNumberToLetter(columnNumber) {
        let columnName = '';
        while (columnNumber > 0) {
            const remainder = (columnNumber - 1) % 26;
            columnName = String.fromCharCode(65 + remainder) + columnName;
            columnNumber = Math.floor((columnNumber - 1) / 26);
        }
        return columnName;
    }

    /**
     * Get comprehensive workbook summary for AI context
     */
    async getWorkbookSummary(context) {
        await this.updateWorkbookCache(context);

        return {
            totalSheets: this.workbookCache.sheets.length,
            sheetNames: this.workbookCache.sheets,
            lastUpdated: this.workbookCache.lastUpdated,
            summary: `Workbook contains ${this.workbookCache.sheets.length} sheets: ${this.workbookCache.sheets.join(', ')}`
        };
    }
}

// Export the classes
export { SmartRangeResolver, MooseRange };

// Global instance for easy access
export const SRR = new SmartRangeResolver();