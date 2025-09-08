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

  async generateAccountingWorkbook(userInput, userId = 'default') {
    console.log('🎯 Starting GPT-powered Excel generation for:', userInput.substring(0, 100));
    
    try {
      // Get GPT's creative structure
      const gptStructure = await this.getCustomStructureFromGPT(userInput);
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const filename = `Nubia_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Build worksheets from GPT's structure
      await this.buildWorksheetsFromGPT(workbook, gptStructure);
      
      // Save and open
      await workbook.xlsx.writeFile(filepath);
      await this.openExcelFile(filepath);
      
      console.log('✅ Excel workbook generated successfully:', filename);
      
      const worksheetInfo = this.extractWorksheetInfo(gptStructure);
      
      return {
        success: true,
        filename,
        filepath,
        structure: gptStructure.summary || gptStructure.description || 'Accounting workbook created',
        worksheets: worksheetInfo
      };
      
    } catch (error) {
      console.error('❌ Excel generation failed:', error);
      throw error;
    }
  }

  async getCustomStructureFromGPT(userInput) {
    const gptPrompt = `You are Nubia, a professional accountant creating Excel workbooks.

USER REQUEST: "${userInput}"

Create comprehensive accounting workbooks with COMPLETE FREEDOM. Return JSON in ANY structure you want.
Include populated data with actual transactions, not empty arrays or placeholders.`;

    try {
      const response = await this.openaiService.createCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { 
            role: 'system', 
            content: 'Create Excel structures with complete freedom. Return JSON in any format that makes sense.'
          },
          { 
            role: 'user', 
            content: gptPrompt 
          }
        ],
        temperature: 0.9,
        max_tokens: 4000
      });

      const gptResponseText = response.choices[0].message.content.trim();
      
      // Clean markdown if present
      let cleanedResponse = gptResponseText;
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.split('```json')[1].split('```')[0];
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.split('```')[1].split('```')[0];
      }
      
      const structure = JSON.parse(cleanedResponse);
      console.log('✅ GPT structure parsed successfully');
      return structure;
      
    } catch (error) {
      console.error('❌ GPT parsing error:', error);
      throw new Error(`Failed to generate Excel structure: ${error.message}`);
    }
  }

  async buildWorksheetsFromGPT(workbook, structure) {
  const worksheets = this.findWorksheets(structure);
  
  if (worksheets && worksheets.length > 0) {
    // Process array of worksheets
    for (const worksheetData of worksheets) {
      await this.buildSingleWorksheet(workbook, worksheetData);
    }
  } else {
    // GPT returned object with sheet names as keys
    console.log('📊 Processing sheets from object structure');
    
    // Common accounting sheet names (including variations)
    const accountingPatterns = [
      'journal', 'account', 'balance', 'income', 'statement', 
      'cash', 'flow', 'equity', 'ledger', 'trial'
    ];
    
    for (const [sheetName, sheetData] of Object.entries(structure)) {
      // Check if this looks like a worksheet (not metadata)
      const isWorksheet = accountingPatterns.some(pattern => 
        sheetName.toLowerCase().includes(pattern)
      ) || (
        typeof sheetData === 'object' && 
        (Array.isArray(sheetData) || sheetData.data || sheetData.rows)
      );
      
      if (isWorksheet) {
        console.log(`📋 Processing sheet: ${sheetName}`);
        
        const worksheetData = {
          name: sheetName.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to spaces
          data: Array.isArray(sheetData) ? sheetData : 
                sheetData.data || sheetData.rows || [sheetData]
        };
        
        await this.buildFlexibleWorksheet(workbook, worksheetData);
      }
    }
  }
}

  findWorksheets(structure) {
    console.log('🔍 Finding worksheets in structure');
    
    // Standard worksheet array properties
    const arrayProps = ['worksheets', 'Worksheets', 'sheets', 'Sheets', 'tabs'];
    
    for (const prop of arrayProps) {
      if (Array.isArray(structure[prop])) {
        console.log(`✅ Found ${structure[prop].length} worksheets in '${prop}'`);
        return structure[prop];
      }
    }
    
    // Check for nested structures
    if (structure.ExcelWorkbook?.Worksheets) {
      return structure.ExcelWorkbook.Worksheets;
    }
    
    if (Array.isArray(structure)) {
      return structure;
    }
    
    return null;
  }

  async buildSingleWorksheet(workbook, worksheetData) {
    const sheetName = this.extractSheetName(worksheetData);
    console.log(`📋 Creating worksheet: ${sheetName}`);
    
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Extract and set columns
    const columns = this.extractColumns(worksheetData);
    if (columns && columns.length > 0) {
      worksheet.columns = columns.map((col, index) => ({
        header: this.extractColumnHeader(col),
        key: this.extractColumnKey(col, index),
        width: this.extractColumnWidth(col)
      }));
    }
    
    // Extract and add data
    const data = this.extractData(worksheetData);
    if (data && data.length > 0) {
      console.log(`✅ Adding ${data.length} rows of data`);
      worksheet.addRows(data);
    } else {
      console.warn('⚠️ No data found for worksheet');
    }
    
    // Apply formatting
    this.applyProfessionalFormatting(worksheet);
  }

  async buildFlexibleWorksheet(workbook, worksheetData) {
  const sheetName = worksheetData.name || 'Sheet';
  console.log(`📋 Creating flexible worksheet: ${sheetName}`);
  
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Handle data that's directly an array of values
  if (Array.isArray(worksheetData.data) && worksheetData.data.length > 0) {
    const firstItem = worksheetData.data[0];
    
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Data is array of objects - extract columns from first object
      const columns = Object.keys(firstItem).map(key => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        key: key,
        width: 20
      }));
      
      worksheet.columns = columns;
      worksheet.addRows(worksheetData.data);
    }
  } else if (typeof worksheetData.data === 'string') {
    // Data came as stringified JSON - parse it first
    try {
      const parsedData = JSON.parse(worksheetData.data);
      if (Array.isArray(parsedData)) {
        // Now process as normal array
        const columns = Object.keys(parsedData[0]).map(key => ({
          header: key,
          key: key.toLowerCase(),
          width: 20
        }));
        worksheet.columns = columns;
        worksheet.addRows(parsedData);
      }
    } catch (e) {
      console.error('Failed to parse stringified data:', e);
    }
  }
  
  this.applyProfessionalFormatting(worksheet);
}

  extractSheetName(worksheetData) {
    return worksheetData.Name || 
           worksheetData.name || 
           worksheetData.title || 
           worksheetData.SheetName ||
           'Sheet1';
  }

  extractColumns(worksheetData) {
    // Check all possible column properties
    const columnProps = ['Columns', 'columns', 'headers', 'Headers', 'fields'];
    
    for (const prop of columnProps) {
      if (worksheetData[prop]) {
        return worksheetData[prop];
      }
    }
    
    // If data exists but no columns defined, generate from data
    const data = this.extractData(worksheetData);
    if (data && data.length > 0 && typeof data[0] === 'object') {
      return Object.keys(data[0]).map(key => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        key: key,
        width: 20
      }));
    }
    
    return null;
  }

  extractColumnHeader(col) {
    if (typeof col === 'string') return col;
    return col.Name || col.header || col.name || col.title || 'Column';
  }

  extractColumnKey(col, index) {
    if (typeof col === 'string') {
      return col.toLowerCase().replace(/\s+/g, '_');
    }
    return col.key || col.field || col.id || `col${index + 1}`;
  }

  extractColumnWidth(col) {
    if (typeof col === 'object') {
      return col.Width || col.width || 20;
    }
    return 20;
  }

  extractData(worksheetData) {
    // Check all possible data properties
    const dataProps = [
      'Data', 'data', 'Rows', 'rows', 'Records', 'records',
      'Entries', 'entries', 'transactions', 'Transactions',
      'items', 'values', 'content'
    ];
    
    for (const prop of dataProps) {
      if (worksheetData[prop] && Array.isArray(worksheetData[prop])) {
        console.log(`✅ Found ${worksheetData[prop].length} data rows in '${prop}'`);
        return worksheetData[prop];
      }
    }
    
    // Check if worksheet itself is an array (data only)
    if (Array.isArray(worksheetData)) {
      return worksheetData;
    }
    
    // Look for any array property that might be data
    for (const [key, value] of Object.entries(worksheetData)) {
      if (Array.isArray(value) && value.length > 0) {
        if (typeof value[0] === 'object' || typeof value[0] === 'number' || typeof value[0] === 'string') {
          console.log(`✅ Found data in property '${key}'`);
          return value;
        }
      }
    }
    
    return [];
  }

  extractWorksheetInfo(structure) {
    const worksheets = this.findWorksheets(structure);
    
    if (worksheets) {
      return worksheets.map(ws => ({
        name: this.extractSheetName(ws),
        rowCount: this.extractData(ws).length,
        columnCount: this.extractColumns(ws)?.length || 0
      }));
    }
    
    // Structure has sheets as object properties
    const info = [];
    const accountingSheets = ['General Journal', 'Cash Book', 'Bank Book', 'Trial Balance', 
                             'T-Accounts', 'Income Statement', 'Balance Sheet'];
    
    for (const sheetName of Object.keys(structure)) {
      if (accountingSheets.some(name => sheetName.includes(name))) {
        const data = Array.isArray(structure[sheetName]) ? structure[sheetName] : [];
        info.push({
          name: sheetName,
          rowCount: data.length,
          columnCount: data.length > 0 && typeof data[0] === 'object' ? Object.keys(data[0]).length : 0
        });
      }
    }
    
    return info.length > 0 ? info : [{
      name: 'Sheet1',
      rowCount: 0,
      columnCount: 0
    }];
  }

  applyProfessionalFormatting(worksheet) {
    // Header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Auto-fit columns and apply borders
    worksheet.columns.forEach(column => {
      column.alignment = { vertical: 'middle' };
    });
    
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Format numbers and currency
        if (typeof cell.value === 'number') {
          if (cell.value >= 1000) {
            cell.numFmt = '#,##0.00';
          }
        }
      });
      
      if (rowNumber > 1) {
        row.height = 20;
      }
    });
    
    // Freeze header
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
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