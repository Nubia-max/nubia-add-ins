const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DynamicExcelGenerator {
  constructor(openaiService) {
    this.openaiService = openaiService;
    // Cross-platform output directory
    this.outputDir = process.platform === 'win32' 
      ? path.join(process.env.USERPROFILE || '', 'Documents', 'Nubia')
      : path.join(process.env.HOME || `/Users/${process.env.USER}`, 'Documents', 'Nubia');
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // New method: Generate Excel from GPT's structured data
  async generateFromStructure(excelStructure, userInput, userId = 'default') {
    console.log('🎯 Generating Excel from GPT structure with populated data');
    
    try {
      const workbook = new ExcelJS.Workbook();
      const filename = `Nubia_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Build worksheets from GPT's structure (already contains populated data)
      await this.buildWorksheetsFromStructure(workbook, excelStructure);
      
      // Save workbook
      await workbook.xlsx.writeFile(filepath);
      
      // Open in Excel
      await this.openExcelFile(filepath);
      
      console.log('✅ Excel workbook generated from structure:', filename);
      
      const worksheetInfo = this.extractWorksheetInfoFromStructure(excelStructure);
      
      return {
        success: true,
        filename,
        filepath,
        structure: `Accounting workbook with ${worksheetInfo.length} worksheets created`,
        worksheets: worksheetInfo,
        gptStructure: excelStructure
      };
    } catch (error) {
      console.error('❌ Excel generation from structure failed:', error);
      throw error;
    }
  }

  async generateAccountingWorkbook(userInput, userId = 'default') {
    console.log('🎯 Starting GPT-powered Excel generation for:', userInput.substring(0, 100));
    
    try {
      // Get GPT's creative structure - no restrictions
      const gptStructure = await this.getCustomStructureFromGPT(userInput);
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const filename = `Nubia_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Build worksheets from whatever GPT created
      await this.buildWorksheetsFromGPT(workbook, gptStructure);
      
      // Save workbook
      await workbook.xlsx.writeFile(filepath);
      
      // Open in Excel
      await this.openExcelFile(filepath);
      
      console.log('✅ Excel workbook generated successfully:', filename);
      
      // Return flexible response based on what GPT created
      const worksheetInfo = this.extractWorksheetInfo(gptStructure);
      
      return {
        success: true,
        filename,
        filepath,
        structure: gptStructure.summary || gptStructure.description || 'Custom Excel structure created',
        worksheets: worksheetInfo,
        gptResponse: gptStructure // Include full GPT response for debugging
      };
      
    } catch (error) {
      console.error('❌ Excel generation failed:', error);
      throw error;
    }
  }

  async getCustomStructureFromGPT(userInput) {
    const gptPrompt = `You are Nubia, a professional accountant and Excel automation expert with UNLIMITED CREATIVE FREEDOM.

USER REQUEST:
"${userInput}"

Create the most comprehensive, professional accounting workbook possible:

• ANALYZE the transaction and create proper double-entry bookkeeping
• DESIGN multiple interconnected worksheets: General Journal, T-accounts for each account, Cash Book, Trial Balance, Income Statement, Balance Sheet, and any other relevant sheets
• POPULATE with REAL transaction data including actual dates, amounts, account names, descriptions (not placeholders like "Amount 1" - use realistic data)
• INCLUDE formulas for automatic calculations, running balances, and linked totals between sheets
• APPLY professional accounting principles and formatting
• CREATE whatever additional analysis sheets would be most helpful

Respond conversationally about what you're creating, then provide a comprehensive JSON structure. Use whatever format and organization makes the most accounting sense - you have complete creative freedom.`;

    try {
      const response = await this.openaiService.createCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { 
            role: 'system', 
            content: 'Create comprehensive Excel structures with complete freedom. Return valid JSON in whatever format you think is best.'
          },
          { 
            role: 'user', 
            content: gptPrompt 
          }
        ],
        temperature: 0.9, // Maximum creativity for rich accounting structures
        max_tokens: 4000  // Maximum allowed for gpt-4-turbo-preview
      });

      const gptResponseText = response.choices[0].message.content.trim();
      console.log('📊 GPT Response received');
      
      // Clean up response if wrapped in markdown
      let cleanedResponse = gptResponseText;
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.split('```json')[1].split('```')[0];
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.split('```')[1].split('```')[0];
      }
      
      // Parse whatever structure GPT returns
      const structure = JSON.parse(cleanedResponse);
      
      console.log('✅ GPT structure parsed successfully');
      console.log('🔍 DEBUG - Full GPT structure:', JSON.stringify(structure, null, 2));
      return structure;
      
    } catch (error) {
      console.error('❌ GPT parsing error:', error);
      throw new Error(`Failed to generate Excel structure: ${error.message}`);
    }
  }

  async buildWorksheetsFromGPT(workbook, structure) {
    // Accept ANY property name GPT uses for worksheets
    const worksheets = this.findWorksheets(structure);
    
    if (!worksheets || worksheets.length === 0) {
      // If no array found, treat the entire structure as a single worksheet
      await this.buildSingleWorksheet(workbook, structure);
      return;
    }
    
    for (const worksheetData of worksheets) {
      await this.buildSingleWorksheet(workbook, worksheetData);
    }
  }

  findWorksheets(structure) {
    console.log('🔍 DEBUG - Finding worksheets in structure with keys:', Object.keys(structure));
    
    // Handle nested structures like ExcelWorkbook.Worksheets
    if (structure.ExcelWorkbook && Array.isArray(structure.ExcelWorkbook.Worksheets)) {
      console.log('✅ Found nested ExcelWorkbook.Worksheets with', structure.ExcelWorkbook.Worksheets.length, 'worksheets');
      return structure.ExcelWorkbook.Worksheets;
    }
    
    // Look for any array that might contain worksheets
    const possibleKeys = [
      'worksheets', 'Worksheets', 'sheets', 'Sheets', 'tabs', 'pages', 'workbooks',
      'spreadsheets', 'documents', 'tables', 'data_sheets'
    ];
    
    for (const key of possibleKeys) {
      if (Array.isArray(structure[key])) {
        console.log(`✅ Found worksheets in property '${key}' with ${structure[key].length} items`);
        return structure[key];
      }
    }
    
    // Check if structure itself is an array
    if (Array.isArray(structure)) {
      console.log(`✅ Using entire structure as worksheet array with ${structure.length} items`);
      return structure;
    }
    
    console.log('⚠️ No worksheet array found');
    return null;
  }

  async buildSingleWorksheet(workbook, worksheetData) {
    // Flexible name extraction
    const sheetName = this.extractSheetName(worksheetData);
    console.log(`📋 Creating worksheet: ${sheetName}`);
    
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Handle columns flexibly
    const columns = this.extractColumns(worksheetData);
    if (columns && columns.length > 0) {
      worksheet.columns = columns.map((col, index) => ({
        header: this.extractColumnHeader(col),
        key: this.extractColumnKey(col, index),
        width: this.extractColumnWidth(col)
      }));
    }
    
    // Handle data flexibly
    const data = this.extractData(worksheetData);
    if (data && data.length > 0) {
      worksheet.addRows(data);
    }
    
    // Apply formulas if any
    this.applyFormulas(worksheet, worksheetData);
    
    // Apply formatting
    this.applyFormatting(worksheet, worksheetData);
    
    // Apply any custom features GPT included
    this.applyCustomFeatures(worksheet, worksheetData);
  }

  extractSheetName(worksheetData) {
    return worksheetData.Name ||      // GPT uses capital Name
           worksheetData.name || 
           worksheetData.title || 
           worksheetData.sheetName ||
           worksheetData.label ||
           worksheetData.worksheet_name ||
           worksheetData.tab_name ||
           'Sheet1';
  }

  extractColumns(worksheetData) {
    return worksheetData.Columns ||   // GPT uses capital Columns
           worksheetData.columns || 
           worksheetData.headers || 
           worksheetData.fields ||
           worksheetData.column_headers ||
           worksheetData.cols ||
           null;
  }

  extractColumnHeader(col) {
    if (typeof col === 'string') return col;
    return col.Name ||     // GPT uses capital Name
           col.header || 
           col.name || 
           col.title || 
           col.label || 
           'Column';
  }

  extractColumnKey(col, index) {
    if (typeof col === 'string') {
      return col.toLowerCase().replace(/\s+/g, '_');
    }
    return col.key || 
           col.id || 
           col.field || 
           col.property ||
           `col${index + 1}`;
  }

  extractColumnWidth(col) {
    if (typeof col === 'object') {
      return col.width || col.size || col.columnWidth || 15;
    }
    return 15;
  }

  extractData(worksheetData) {
    console.log('🔍 DEBUG - Extracting data from worksheet:', Object.keys(worksheetData));
    
    // Try comprehensive data property names that GPT might use for accounting data
    const dataProperties = [
      // Accounting-specific terms
      'transactions', 'entries', 'journal_entries', 'ledger_entries',
      'account_balances', 'trial_balance_data', 'financial_data',
      
      // Common GPT formats
      'Rows', 'Data', 'Entries', 'Records', 'Transactions',
      
      // Generic data terms
      'data', 'rows', 'records', 'entries', 'values', 'content', 
      'items', 'table_data', 'row_data', 'information', 'details',
      'accounts', 'balances', 'amounts', 'line_items'
    ];
    
    for (const prop of dataProperties) {
      if (worksheetData[prop] && Array.isArray(worksheetData[prop])) {
        console.log(`✅ Found data in property '${prop}' with ${worksheetData[prop].length} items`);
        return worksheetData[prop];
      }
    }
    
    // If no array found, check if the entire worksheetData is an array
    if (Array.isArray(worksheetData)) {
      console.log(`✅ Using entire worksheet as data array with ${worksheetData.length} items`);
      return worksheetData;
    }
    
    // Enhanced: look for any array property with accounting-like data
    for (const [key, value] of Object.entries(worksheetData)) {
      if (Array.isArray(value) && value.length > 0) {
        // Check if array contains objects (likely data rows)
        if (typeof value[0] === 'object' && value[0] !== null) {
          console.log(`✅ Found structured data in property '${key}' with ${value.length} items`);
          return value;
        }
      }
    }
    
    // Final attempt: Create sample data if GPT described the structure but didn't provide data
    if (worksheetData.columns || worksheetData.Columns) {
      console.log('⚠️ No data found but columns exist - creating sample row for structure');
      const columns = worksheetData.columns || worksheetData.Columns || [];
      const sampleRow = {};
      columns.forEach((col, index) => {
        const key = col.key || col.field || col.property || `col${index + 1}`;
        sampleRow[key] = col.sampleValue || `Sample ${col.header || col.Name || key}`;
      });
      return [sampleRow];
    }
    
    console.log('⚠️ No data array found, returning empty array');
    return [];
  }

  applyFormulas(worksheet, worksheetData) {
    // Look for formulas in various possible locations
    const formulas = worksheetData.formulas || 
                    worksheetData.calculations ||
                    worksheetData.computed_cells ||
                    [];
    
    if (Array.isArray(formulas)) {
      formulas.forEach(formula => {
        try {
          const cell = formula.cell || formula.position || formula.location;
          const formulaText = formula.formula || formula.expression || formula.calculation;
          if (cell && formulaText) {
            worksheet.getCell(cell).value = { formula: formulaText };
          }
        } catch (error) {
          console.warn(`⚠️ Formula error: ${error.message}`);
        }
      });
    }
  }

  applyFormatting(worksheet, worksheetData) {
    // Apply header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    headerRow.alignment = { horizontal: 'center' };
    
    // Look for formatting instructions from GPT
    const formatting = worksheetData.formatting || 
                      worksheetData.format ||
                      worksheetData.styles ||
                      {};
    
    // Apply currency formatting
    const currencyColumns = formatting.currencyColumns || 
                          formatting.currency ||
                          formatting.money_columns ||
                          [];
    this.applyCurrencyFormat(worksheet, currencyColumns);
    
    // Apply date formatting
    const dateColumns = formatting.dateColumns || 
                       formatting.dates ||
                       formatting.date_columns ||
                       [];
    this.applyDateFormat(worksheet, dateColumns);
    
    // Apply borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Freeze header
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  applyCurrencyFormat(worksheet, currencyColumns) {
    currencyColumns.forEach(columnKey => {
      const column = worksheet.columns.find(col => col.key === columnKey);
      if (column) {
        const columnIndex = worksheet.columns.indexOf(column) + 1;
        const columnLetter = this.getColumnLetter(columnIndex);
        worksheet.getColumn(columnLetter).numFmt = '$#,##0.00';
      }
    });
  }

  applyDateFormat(worksheet, dateColumns) {
    dateColumns.forEach(columnKey => {
      const column = worksheet.columns.find(col => col.key === columnKey);
      if (column) {
        const columnIndex = worksheet.columns.indexOf(column) + 1;
        const columnLetter = this.getColumnLetter(columnIndex);
        worksheet.getColumn(columnLetter).numFmt = 'mm/dd/yyyy';
      }
    });
  }

  applyCustomFeatures(worksheet, worksheetData) {
    // Apply any other features GPT might have included
    
    // Conditional formatting
    if (worksheetData.conditional_formatting) {
      // Apply conditional formatting rules
    }
    
    // Data validation
    if (worksheetData.validation || worksheetData.data_validation) {
      // Apply data validation rules
    }
    
    // Charts (if GPT specified any)
    if (worksheetData.charts || worksheetData.graphs) {
      // Note: ExcelJS has limited chart support
      console.log('📊 Charts specified but not fully supported in ExcelJS');
    }
    
    // Pivot tables (if GPT specified any)
    if (worksheetData.pivot_tables || worksheetData.pivots) {
      console.log('📊 Pivot tables specified but not fully supported in ExcelJS');
    }
  }

  extractWorksheetInfo(structure) {
    const worksheets = this.findWorksheets(structure);
    
    if (!worksheets) {
      return [{
        name: this.extractSheetName(structure),
        rowCount: this.extractData(structure).length,
        columnCount: this.extractColumns(structure)?.length || 0
      }];
    }
    
    return worksheets.map(ws => ({
      name: this.extractSheetName(ws),
      rowCount: this.extractData(ws).length,
      columnCount: this.extractColumns(ws)?.length || 0
    }));
  }

  getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber > 0) {
      columnNumber--;
      letter = String.fromCharCode(65 + (columnNumber % 26)) + letter;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return letter;
  }

  // New methods for structure-based generation
  async buildWorksheetsFromStructure(workbook, structure) {
    if (!structure.worksheets || !Array.isArray(structure.worksheets)) {
      throw new Error('Invalid structure: worksheets array required');
    }
    
    for (const worksheetData of structure.worksheets) {
      await this.buildSingleWorksheetFromStructure(workbook, worksheetData);
    }
  }

  async buildSingleWorksheetFromStructure(workbook, worksheetData) {
    const sheetName = worksheetData.name || 'Sheet1';
    console.log(`📋 Creating populated worksheet: ${sheetName}`);
    
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Set up columns
    if (worksheetData.columns && Array.isArray(worksheetData.columns)) {
      worksheet.columns = worksheetData.columns.map(col => ({
        header: col.header || col.name || 'Column',
        key: col.key || col.field || col.header?.toLowerCase().replace(/\s+/g, '_') || 'column',
        width: col.width || 15
      }));
    }
    
    // Add data rows (this is where the populated data comes in)
    if (worksheetData.data && Array.isArray(worksheetData.data)) {
      console.log(`✅ Adding ${worksheetData.data.length} populated data rows to ${sheetName}`);
      
      // Ensure data matches column structure
      const processedData = worksheetData.data.map(row => {
        if (typeof row === 'object' && row !== null) {
          return row;
        }
        // Convert non-object rows to objects if needed
        return { value: row };
      });
      
      worksheet.addRows(processedData);
    }
    
    // Apply formulas
    if (worksheetData.formulas && Array.isArray(worksheetData.formulas)) {
      worksheetData.formulas.forEach(formula => {
        try {
          const cell = formula.cell || formula.position;
          const formulaText = formula.formula || formula.expression;
          if (cell && formulaText) {
            worksheet.getCell(cell).value = { formula: formulaText };
            console.log(`📝 Added formula to ${cell}: ${formulaText}`);
          }
        } catch (error) {
          console.warn(`⚠️ Formula error in ${sheetName}:`, error.message);
        }
      });
    }
    
    // Apply professional formatting
    this.applyProfessionalFormatting(worksheet, worksheetData);
  }

  applyProfessionalFormatting(worksheet, worksheetData) {
    // Header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    headerRow.alignment = { horizontal: 'center' };
    
    // Apply borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Apply number formatting based on column types
    if (worksheetData.columns) {
      worksheetData.columns.forEach((col, index) => {
        const columnLetter = this.getColumnLetter(index + 1);
        const column = worksheet.getColumn(columnLetter);
        
        if (col.type === 'currency' || col.header?.toLowerCase().includes('amount') || col.header?.toLowerCase().includes('balance')) {
          column.numFmt = '$#,##0.00';
        } else if (col.type === 'date' || col.header?.toLowerCase().includes('date')) {
          column.numFmt = 'mm/dd/yyyy';
        } else if (col.type === 'number') {
          column.numFmt = '#,##0';
        }
      });
    }
    
    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  extractWorksheetInfoFromStructure(structure) {
    if (!structure.worksheets) return [];
    
    return structure.worksheets.map(ws => ({
      name: ws.name || 'Sheet',
      rowCount: ws.data?.length || 0,
      columnCount: ws.columns?.length || 0
    }));
  }

  async openExcelFile(filepath) {
    console.log('🚀 Opening Excel file:', filepath);
    
    return new Promise((resolve) => {
      let command;
      
      if (process.platform === 'darwin') {
        command = `open -a "Microsoft Excel" "${filepath}"`;
      } else if (process.platform === 'win32') {
        command = `start excel "${filepath}"`;
      } else {
        command = `xdg-open "${filepath}"`;
      }
      
      exec(command, (error) => {
        if (error) {
          console.warn('⚠️ Could not auto-open Excel file:', error.message);
          resolve({ opened: false, error: error.message });
        } else {
          console.log('✅ Excel file opened successfully');
          resolve({ opened: true });
        }
      });
    });
  }
}

module.exports = DynamicExcelGenerator;