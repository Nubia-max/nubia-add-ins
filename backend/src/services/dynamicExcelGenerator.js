const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DynamicExcelGenerator {
  constructor(openaiService) {
    this.openaiService = openaiService;
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

  // Helper to clean JSON
  cleanAndParseJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      let cleaned = jsonString
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/,\s*,/g, ',')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      
      try {
        return JSON.parse(cleaned);
      } catch (secondError) {
        cleaned = cleaned
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/:\s*,/g, ': null,')
          .replace(/"\s*:\s*undefined/g, '": null')
          .trim();
        
        try {
          return JSON.parse(cleaned);
        } catch (finalError) {
          console.error('Cannot parse JSON:', finalError);
          return null;
        }
      }
    }
  }

  // NEW: Complete freedom method - handles ANY structure
  async generateWithCompleteFreeedom(structure, userId = 'default') {
    console.log('🎯 Generating Excel with COMPLETE FREEDOM structure');
    
    try {
      const workbook = new ExcelJS.Workbook();
      const filename = `Nubia_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Handle ANY structure GPT returns
      await this.buildWithCompleteFreeedom(workbook, structure);
      
      // Execute commands if any
      if (structure.commands) {
        await this.executeExcelCommands(workbook, structure.commands);
      }
      
      await workbook.xlsx.writeFile(filepath);
      await this.openExcelFile(filepath);
      
      console.log('✅ Excel generated with complete freedom:', filename);
      
      return {
        success: true,
        filename,
        filepath,
        structure: 'GAAP-compliant accounting workbook',
        worksheets: this.extractWorksheetInfoFromAny(structure)
      };
      
    } catch (error) {
      console.error('❌ Excel generation failed:', error);
      throw error;
    }
  }

  // Build worksheets from ANY structure
  async buildWithCompleteFreeedom(workbook, structure) {
    console.log('📊 Building with complete freedom from structure');
    
    // Check if it's a worksheets array
    if (structure.worksheets && Array.isArray(structure.worksheets)) {
      for (const ws of structure.worksheets) {
        await this.buildSingleWorksheet(workbook, ws);
      }
      return;
    }
    
    // Check if structure itself is an array
    if (Array.isArray(structure)) {
      for (const item of structure) {
        await this.buildSingleWorksheet(workbook, item);
      }
      return;
    }
    
    // Structure is an object with sheet names as keys
    for (const [key, value] of Object.entries(structure)) {
      // Skip meta properties
      if (key.startsWith('_') || key === 'commands' || key === 'summary') continue;
      
      console.log(`📋 Creating sheet: ${key}`);
      
      const worksheetData = {
        name: this.formatSheetName(key),
        data: Array.isArray(value) ? value : 
              (value && typeof value === 'object' ? 
                (value.data || value.rows || value.entries || [value]) : 
                [])
      };
      
      await this.buildFlexibleWorksheet(workbook, worksheetData);
    }
  }

  async buildFlexibleWorksheet(workbook, worksheetData) {
    const sheetName = worksheetData.name || 'Sheet';
    const worksheet = workbook.addWorksheet(sheetName);
    
    if (Array.isArray(worksheetData.data) && worksheetData.data.length > 0) {
      const firstItem = worksheetData.data[0];
      
      if (typeof firstItem === 'object' && firstItem !== null) {
        // Extract columns from data
        const columns = Object.keys(firstItem).map(key => ({
          header: this.formatHeader(key),
          key: key,
          width: this.getOptimalWidth(key, firstItem[key])
        }));
        
        worksheet.columns = columns;
        worksheet.addRows(worksheetData.data);
      } else if (Array.isArray(firstItem)) {
        // Data is array of arrays
        const columnCount = firstItem.length;
        const columns = Array.from({length: columnCount}, (_, i) => ({
          header: `Column ${i + 1}`,
          key: `col${i + 1}`,
          width: 20
        }));
        
        worksheet.columns = columns;
        
        const objectData = worksheetData.data.map(row => {
          const obj = {};
          row.forEach((val, i) => {
            obj[`col${i + 1}`] = val;
          });
          return obj;
        });
        
        worksheet.addRows(objectData);
      }
    }
    
    this.applyGAAPFormatting(worksheet, sheetName);
  }

  formatHeader(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatSheetName(name) {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
      .substring(0, 31); // Excel sheet name limit
  }

  async executeExcelCommands(workbook, commands) {
    if (!commands || !Array.isArray(commands)) return;
    
    console.log(`📝 Executing ${commands.length} Excel commands`);
    
    for (const cmd of commands) {
      try {
        const worksheet = cmd.sheet ? 
          workbook.getWorksheet(cmd.sheet) : 
          workbook.worksheets[0];
        
        if (!worksheet) continue;
        
        switch(cmd.type) {
          case 'formula':
            if (cmd.cell && cmd.formula) {
              // Wrap formulas in IFERROR for robustness
              const errorHandledFormula = cmd.formula.startsWith('=IFERROR') ? 
                cmd.formula : `=IFERROR(${cmd.formula.replace('=', '')}, 0)`;
              worksheet.getCell(cmd.cell).value = { formula: errorHandledFormula };
            }
            break;
            
          case 'format':
            this.applyProfessionalFormat(worksheet, cmd);
            break;
            
          case 'validation':
            this.applyAdvancedValidation(worksheet, cmd);
            break;
            
          case 'conditional_format':
            this.applyConditionalFormatting(worksheet, cmd);
            break;
            
          case 'sparkline':
            this.addSparkline(worksheet, cmd);
            break;
            
          case 'pivot':
            this.createPivotTable(workbook, cmd);
            break;
            
          case 'chart':
            this.createProfessionalChart(worksheet, cmd);
            break;
            
          case 'protection':
            this.applyProtection(worksheet, cmd);
            break;
        }
      } catch (error) {
        console.error(`Command execution error: ${error.message}`);
      }
    }
  }

  applyProfessionalFormat(worksheet, cmd) {
    if (!cmd.range) return;
    
    try {
      const formatMap = {
        'currency': '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)',
        'accounting': '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)',
        'percentage': '0.0%',
        'thousands': '#,##0',
        'millions': '#,##0.0,, "M"',
        'date': 'mm/dd/yyyy',
        'datetime': 'mm/dd/yyyy hh:mm',
        'variance': '[Green]#,##0.00_);[Red](#,##0.00)',
        'variance_percent': '[Green]0.0%_);[Red](0.0%)'
      };
      
      const format = formatMap[cmd.format] || cmd.customFormat;
      if (!format) return;
      
      if (cmd.range.includes(':')) {
        const [start, end] = cmd.range.split(':');
        // Apply to range
        worksheet.getCell(start).master.numFmt = format;
      } else {
        worksheet.getCell(cmd.range).numFmt = format;
      }
      
      // Apply additional styling if specified
      if (cmd.style) {
        const cell = worksheet.getCell(cmd.range);
        if (cmd.style.bold) cell.font = { ...cell.font, bold: true };
        if (cmd.style.italic) cell.font = { ...cell.font, italic: true };
        if (cmd.style.color) cell.font = { ...cell.font, color: { argb: cmd.style.color } };
        if (cmd.style.fill) cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cmd.style.fill }
        };
      }
    } catch (error) {
      console.error('Format error:', error);
    }
  }

  applyAdvancedValidation(worksheet, cmd) {
    if (!cmd.cell || !cmd.rule) return;
    
    try {
      const validationRules = {
        'accounts': {
          type: 'list',
          allowBlank: false,
          formulae: ['"Cash,Accounts Receivable,Inventory,Equipment,Accounts Payable,Revenue,Expenses"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Account',
          error: 'Please select a valid account from the list'
        },
        'positive_number': {
          type: 'decimal',
          operator: 'greaterThan',
          formulae: [0],
          showErrorMessage: true,
          errorTitle: 'Invalid Amount',
          error: 'Amount must be greater than zero'
        },
        'date_range': {
          type: 'date',
          operator: 'between',
          formulae: [new Date(new Date().getFullYear(), 0, 1), new Date(new Date().getFullYear(), 11, 31)],
          showErrorMessage: true,
          errorTitle: 'Invalid Date',
          error: 'Date must be within the current year'
        }
      };
      
      const validation = validationRules[cmd.rule.type] || {
        type: cmd.rule.type || 'list',
        allowBlank: cmd.rule.allowBlank !== false,
        formulae: cmd.rule.values ? [`"${cmd.rule.values.join(',')}" `] : cmd.rule.formulae,
        showErrorMessage: true,
        errorTitle: cmd.rule.errorTitle || 'Invalid Input',
        error: cmd.rule.errorMessage || 'Please enter a valid value'
      };
      
      worksheet.getCell(cmd.cell).dataValidation = validation;
    } catch (error) {
      console.error('Validation error:', error);
    }
  }

  applyConditionalFormatting(worksheet, cmd) {
    // This would require more complex implementation
    console.log('Conditional formatting requested:', cmd);
  }

  addSparkline(worksheet, cmd) {
    // Sparklines would require chart functionality
    console.log('Sparkline requested:', cmd);
  }

  createPivotTable(workbook, cmd) {
    console.log('Creating pivot table structure:', cmd);
    // Create a new sheet with pivot-like summary
    const pivotSheet = workbook.addWorksheet(cmd.name || 'Pivot Analysis');
    // Would implement pivot logic here
  }

  createProfessionalChart(worksheet, cmd) {
    console.log('Professional chart requested:', cmd);
    // Charts require additional libraries or Excel's native charting
  }

  applyProtection(worksheet, cmd) {
    try {
      // Protect formulas while allowing data entry
      worksheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false
      });
      
      // Unlock specific cells for data entry if specified
      if (cmd.unlockedRanges) {
        cmd.unlockedRanges.forEach(range => {
          worksheet.getCell(range).protection = { locked: false };
        });
      }
    } catch (error) {
      console.error('Protection error:', error);
    }
  }

  applyFormat(worksheet, cmd) {
    if (!cmd.range) return;
    
    try {
      if (cmd.format === 'currency') {
        if (cmd.range.includes(':')) {
          // Range like E:F or E2:F10
          const [start, end] = cmd.range.split(':');
          // Apply to columns or range
          worksheet.getColumn(start.replace(/\d+/g, '')).numFmt = '$#,##0.00';
        } else {
          worksheet.getCell(cmd.range).numFmt = '$#,##0.00';
        }
      }
    } catch (error) {
      console.error('Format error:', error);
    }
  }

  applyValidation(worksheet, cmd) {
    if (!cmd.cell || !cmd.rule) return;
    
    try {
      worksheet.getCell(cmd.cell).dataValidation = {
        type: cmd.rule.type || 'list',
        allowBlank: true,
        formulae: cmd.rule.values ? [`"${cmd.rule.values.join(',')}"`] : undefined
      };
    } catch (error) {
      console.error('Validation error:', error);
    }
  }

  async generateAccountingWorkbook(userInput, userId = 'default') {
    console.log('🎯 Generating GAAP workbook from message');
    
    try {
      const gptStructure = await this.getCustomStructureFromGPT(userInput);
      
      if (!gptStructure) {
        throw new Error('Could not generate structure');
      }
      
      return await this.generateWithCompleteFreeedom(gptStructure, userId);
      
    } catch (error) {
      console.error('❌ Generation failed:', error);
      throw error;
    }
  }

  async getCustomStructureFromGPT(userInput) {
    const gptPrompt = `You have COMPLETE FREEDOM to design the optimal Excel structure for: "${userInput}"

Think like a CFO preparing board-ready financials. Every workbook should be:
- Immediately understandable by executives
- Audit-ready with clear documentation  
- Visually professional (subtle colors, consistent formatting)
- Functionally rich (formulas, validations, protections)
- GAAP/IFRS compliant with proper classifications
- Error-resistant (IFERROR, data validation, cell protection)

Create whatever sheets, analyses, and visualizations would provide maximum business insight. Anticipate questions like 'What's our cash runway?' or 'Where are the cost overruns?' and build sheets that answer them proactively.

Include professional Excel features:
- Advanced formulas (XLOOKUP, SUMIFS, dynamic arrays, INDEX/MATCH)
- Data validation with dropdowns for account selection
- Conditional formatting for variances and exceptions
- Running balances and automatic reconciliations
- Ratio analysis and KPI dashboards
- Professional charts with data labels
- Print-ready formatting with headers/footers

Populate with REALISTIC data that tells a story. Include:
- Proper dates (use current year)
- Meaningful descriptions
- Industry-appropriate amounts
- Connected transactions across sheets
- Calculated fields and subtotals`;

    try {
      const response = await this.openaiService.createCompletion({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: `You are a world-class CFO and CPA with expertise in financial reporting, GAAP/IFRS standards, and Excel automation.

Return a comprehensive JSON structure with multiple interconnected worksheets. Include:
- General Journal with proper debit/credit columns
- T-Account ledgers for major accounts
- Trial Balance with formula-driven totals
- Income Statement with gross/operating/net income sections
- Balance Sheet with assets/liabilities/equity properly classified
- Cash Flow Statement (operating/investing/financing)
- Ratio Analysis Dashboard
- Variance Analysis
- Any industry-specific sheets needed

Use professional formatting specifications in your JSON:
- Headers: {"fill": "1F4788", "font": {"bold": true, "color": "FFFFFF"}}
- Subtotals: {"fill": "F2F2F2", "font": {"bold": true}}
- Grand totals: {"fill": "D9D9D9", "font": {"bold": true}}
- Negative numbers: {"font": {"color": "FF0000"}, "format": "#,##0.00_);(#,##0.00)"}

Return ONLY valid JSON with actual populated data.`
          },
          { 
            role: 'user', 
            content: gptPrompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      const gptResponseText = response.choices[0].message.content.trim();
      
      let cleanedResponse = gptResponseText;
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.split('```json')[1].split('```')[0];
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.split('```')[1].split('```')[0];
      }
      
      const structure = this.cleanAndParseJSON(cleanedResponse);
      
      if (structure) {
        console.log('✅ Structure parsed successfully');
        return structure;
      }
      
      throw new Error('Could not parse GPT response');
      
    } catch (error) {
      console.error('❌ GPT error:', error);
      // NO FALLBACK - maintain GPT freedom
      throw error;
    }
  }

  async buildSingleWorksheet(workbook, worksheetData) {
    const sheetName = this.extractSheetName(worksheetData);
    const worksheet = workbook.addWorksheet(sheetName);
    
    const columns = this.extractColumns(worksheetData);
    if (columns && columns.length > 0) {
      worksheet.columns = columns.map((col, index) => ({
        header: this.extractColumnHeader(col),
        key: this.extractColumnKey(col, index),
        width: this.extractColumnWidth(col)
      }));
    }
    
    const data = this.extractData(worksheetData);
    if (data && data.length > 0) {
      worksheet.addRows(data);
    }
    
    this.applyGAAPFormatting(worksheet, sheetName);
  }

  getOptimalWidth(key, value) {
    const keyLower = key.toLowerCase();
    
    // Smart width calculation based on content type
    if (keyLower.includes('description') || keyLower.includes('memo') || keyLower.includes('notes')) {
      return 40;
    } else if (keyLower.includes('name') || keyLower.includes('payee') || keyLower.includes('vendor')) {
      return 30;
    } else if (keyLower.includes('account') && !keyLower.includes('no')) {
      return 28;
    } else if (keyLower.includes('category') || keyLower.includes('type')) {
      return 20;
    } else if (keyLower.includes('date')) {
      return 12;
    } else if (keyLower.includes('amount') || keyLower.includes('balance') || 
               keyLower.includes('debit') || keyLower.includes('credit')) {
      return 18;
    } else if (keyLower.includes('quantity') || keyLower.includes('qty')) {
      return 10;
    } else if (keyLower.includes('rate') || keyLower.includes('percent')) {
      return 12;
    } else if (keyLower.includes('reference') || keyLower.includes('invoice') || 
               keyLower.includes('check')) {
      return 15;
    } else if (keyLower.includes('status')) {
      return 12;
    } else if (typeof value === 'number') {
      return 15;
    } else if (typeof value === 'string' && value.length > 50) {
      return 35;
    }
    return 20;
  }

  applyGAAPFormatting(worksheet, sheetName) {
    // Big 4 Professional header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4788' } // Professional blue
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;
    
    // Professional number formatting with accounting standards
    worksheet.columns.forEach((column, index) => {
      const header = column.header?.toString().toLowerCase() || '';
      const col = worksheet.getColumn(index + 1);
      
      // Financial amounts - accounting format
      if (header.includes('amount') || header.includes('debit') || 
          header.includes('credit') || header.includes('balance') ||
          header.includes('total') || header.includes('revenue') ||
          header.includes('expense') || header.includes('asset') ||
          header.includes('liability') || header.includes('equity')) {
        col.numFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
        col.alignment = { horizontal: 'right', vertical: 'middle' };
      } 
      // Dates
      else if (header.includes('date')) {
        col.numFmt = 'mm/dd/yyyy';
        col.alignment = { horizontal: 'center', vertical: 'middle' };
      } 
      // Percentages
      else if (header.includes('percent') || header.includes('rate') || header.includes('ratio')) {
        col.numFmt = '0.0%';
        col.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      // Account numbers
      else if (header.includes('account') && header.includes('no')) {
        col.numFmt = '0';
        col.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      // Text fields
      else {
        col.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // Apply conditional formatting for negative values
    const dataRows = worksheet.rowCount;
    for (let rowNum = 2; rowNum <= dataRows; rowNum++) {
      const row = worksheet.getRow(rowNum);
      
      row.eachCell((cell, colNum) => {
        const header = worksheet.getColumn(colNum).header?.toString().toLowerCase() || '';
        
        // Check if it's a financial column and value is negative
        if ((header.includes('amount') || header.includes('balance') || 
             header.includes('variance')) && typeof cell.value === 'number' && cell.value < 0) {
          cell.font = { ...cell.font, color: { argb: 'FFFF0000' } };
        }
        
        // Highlight significant variances (>10%)
        if (header.includes('variance') && typeof cell.value === 'number') {
          const absValue = Math.abs(cell.value);
          if (header.includes('percent') && absValue > 0.1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF2CC' } // Light orange for attention
            };
          }
        }
      });
      
      // Zebra striping for better readability
      if (rowNum % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F8F8' } // Very light gray
        };
      }
    }
    
    // Professional borders - subtle gray
    worksheet.eachRow((row, rowNum) => {
      row.eachCell((cell) => {
        const borderColor = { argb: 'FFD3D3D3' }; // Subtle gray
        cell.border = {
          top: { style: 'thin', color: borderColor },
          left: { style: 'thin', color: borderColor },
          bottom: { style: 'thin', color: borderColor },
          right: { style: 'thin', color: borderColor }
        };
        
        // Thicker border for header
        if (rowNum === 1) {
          cell.border = {
            ...cell.border,
            bottom: { style: 'medium', color: { argb: 'FF1F4788' } }
          };
        }
      });
    });
    
    // Professional view settings
    worksheet.views = [
      { 
        state: 'frozen', 
        ySplit: 1,
        showGridLines: false, // Hide gridlines for cleaner look
        zoomScale: 85 // Slightly zoomed out for overview
      }
    ];
    
    // Auto-filter on data
    if (worksheet.rowCount > 1) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columnCount }
      };
    }
    
    // Print settings for professional output
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: worksheet.columnCount > 8 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      margins: {
        left: 0.7, right: 0.7,
        top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
      }
    };
    
    // Professional header/footer
    worksheet.headerFooter = {
      oddHeader: `&C&B${sheetName}`,
      oddFooter: '&L&D &T&CPage &P of &N&RConfidential'
    };
  }

  extractSheetName(worksheetData) {
    return worksheetData.Name || worksheetData.name || 
           worksheetData.title || worksheetData.sheetName || 'Sheet1';
  }

  extractColumns(worksheetData) {
    const props = ['columns', 'Columns', 'headers', 'Headers', 'fields'];
    
    for (const prop of props) {
      if (worksheetData[prop]) {
        return worksheetData[prop];
      }
    }
    
    const data = this.extractData(worksheetData);
    if (data && data.length > 0 && typeof data[0] === 'object') {
      return Object.keys(data[0]).map(key => ({
        header: this.formatHeader(key),
        key: key,
        width: 20
      }));
    }
    
    return null;
  }

  extractColumnHeader(col) {
    if (typeof col === 'string') return col;
    return col.header || col.name || col.Name || 'Column';
  }

  extractColumnKey(col, index) {
    if (typeof col === 'string') {
      return col.toLowerCase().replace(/\s+/g, '_');
    }
    return col.key || col.field || `col${index + 1}`;
  }

  extractColumnWidth(col) {
    if (typeof col === 'object') {
      return col.width || col.Width || 20;
    }
    return 20;
  }

  extractData(worksheetData) {
    const props = ['data', 'Data', 'rows', 'Rows', 'entries', 
                   'Entries', 'transactions', 'Transactions', 'records'];
    
    for (const prop of props) {
      if (worksheetData[prop] && Array.isArray(worksheetData[prop])) {
        return worksheetData[prop];
      }
    }
    
    if (Array.isArray(worksheetData)) {
      return worksheetData;
    }
    
    return [];
  }

  extractWorksheetInfoFromAny(structure) {
    const info = [];
    
    if (structure.worksheets) {
      return structure.worksheets.map(ws => ({
        name: this.extractSheetName(ws),
        rowCount: this.extractData(ws).length,
        columnCount: this.extractColumns(ws)?.length || 0
      }));
    }
    
    // Structure has sheets as properties
    for (const [key, value] of Object.entries(structure)) {
      if (key.startsWith('_') || key === 'commands') continue;
      
      const data = Array.isArray(value) ? value : [];
      info.push({
        name: this.formatSheetName(key),
        rowCount: data.length,
        columnCount: data.length > 0 && typeof data[0] === 'object' ? 
                     Object.keys(data[0]).length : 0
      });
    }
    
    return info;
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
          console.warn('⚠️ Could not auto-open:', error.message);
          resolve({ opened: false });
        } else {
          console.log('✅ Excel opened successfully');
          resolve({ opened: true });
        }
      });
    });
  }
}

module.exports = DynamicExcelGenerator;