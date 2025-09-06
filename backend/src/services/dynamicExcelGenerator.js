const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DynamicExcelGenerator {
  constructor(openaiService) {
    this.openaiService = openaiService;
    this.outputDir = `/Users/${process.env.USER}/Documents/Nubia`;
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
      // Step 1: Get GPT analysis and structure
      const gptStructure = await this.getCustomStructureFromGPT(userInput);
      
      // Step 2: Create Excel workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const filename = `Accounting_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Step 3: Build worksheets from GPT structure
      await this.buildWorksheetsFromGPT(workbook, gptStructure);
      
      // Step 4: Save workbook
      await workbook.xlsx.writeFile(filepath);
      
      // Step 5: Open in Excel
      await this.openExcelFile(filepath);
      
      console.log('✅ Excel workbook generated successfully:', filename);
      
      return {
        success: true,
        filename,
        filepath,
        structure: gptStructure.summary || 'GPT created a custom structure',
        worksheets: (gptStructure.worksheets || gptStructure.sheets || [gptStructure]).map(ws => ({
          name: ws.name || ws.title || 'Unnamed Sheet',
          rowCount: (ws.data || ws.rows || []).length,
          columnCount: (ws.columns || ws.headers || []).length
        }))
      };
      
    } catch (error) {
      console.error('❌ Excel generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCustomStructureFromGPT(userInput) {
    const gptPrompt = `You are Nubia, a friendly and brilliant AI assistant who helps people organize their data into Excel spreadsheets. You have COMPLETE CREATIVE FREEDOM to design whatever makes most sense for each request.

USER REQUEST:
${userInput}

Feel free to be conversational and creative! You can:
- Create ANY type of spreadsheet that helps the user
- Use whatever column names and structure make sense
- Include helpful formulas, calculations, or charts
- Add personality and explanations to your responses
- Ask clarifying questions if helpful
- Create multiple worksheets if beneficial
- Design custom formats, colors, or styling
- Include sample data that's relevant and useful

You are NOT limited to financial/accounting formats. Create what's truly best for the user's needs - whether it's tracking movies, planning events, organizing recipes, managing projects, or anything else.

If it's helpful, you can include both conversational text AND a JSON structure. Be creative, helpful, and personable!

Here's a flexible JSON format you can use (but modify freely):
{
  "conversation": "Hi! I'd love to help you with that. Here's what I'm thinking...",
  "summary": "Description of what I created and why it's perfect for you",
  "worksheets": [
    {
      "name": "Whatever name fits your needs",
      "columns": [
        { "header": "Perfect column name", "key": "logical_key", "width": 20, "type": "text|number|currency|date|percentage" }
      ],
      "data": [
        { "logical_key": "Relevant sample data" }
      ],
      "formulas": [
        { "cell": "A10", "formula": "=SUM(A2:A9)", "description": "Helpful calculation" }
      ]
    }
  ]
}

Be creative, conversational, and design exactly what the user needs!`;

    try {
      const response = await this.openaiService.createCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: gptPrompt }],
        temperature: 0.8,
        max_tokens: 40000
      });

      const gptResponseText = response.choices[0].message.content.trim();
      console.log('📊 GPT Response received, parsing JSON...');
      console.log('🔍 RAW GPT RESPONSE:', JSON.stringify(gptResponseText));
      
      // Clean up response to ensure it's valid JSON
      let cleanedResponse = gptResponseText;
      
      // Handle markdown code blocks
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.split('```json')[1].split('```')[0];
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.split('```')[1].split('```')[0];
      }
      
      // Handle cases where GPT adds extra text after JSON
      // Look for the JSON object boundaries
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const structure = JSON.parse(cleanedResponse.trim());
      console.log('🔍 PARSED GPT RESPONSE:', JSON.stringify(structure, null, 2));
      
      // Accept whatever structure GPT provides - no validation restrictions
      console.log('✅ GPT structure parsed successfully:', structure.summary || 'GPT created a custom structure');
      return structure;
      
    } catch (error) {
      console.error('❌ GPT parsing error:', error);
      // Fallback to basic structure
      return this.getFallbackStructure(userInput);
    }
  }

  getFallbackStructure(userInput) {
    console.log('🔄 Using fallback accounting structure');
    
    const today = new Date().toISOString().split('T')[0];
    
    return {
      summary: "Basic accounting journal with transactions from user input",
      worksheets: [
        {
          name: "General Journal",
          columns: [
            { header: "Date", key: "date", width: 12 },
            { header: "Account", key: "account", width: 25 },
            { header: "Description", key: "description", width: 35 },
            { header: "Ref", key: "ref", width: 8 },
            { header: "Debit", key: "debit", width: 15 },
            { header: "Credit", key: "credit", width: 15 }
          ],
          data: [
            { date: today, account: "Transaction", description: userInput.substring(0, 100), ref: "1", debit: "", credit: "" }
          ]
        }
      ]
    };
  }

  async buildWorksheetsFromGPT(workbook, structure) {
    // Handle any structure GPT provides - complete flexibility
    const worksheets = structure.worksheets || structure.sheets || structure.tabs || [structure];
    
    for (const worksheetData of worksheets) {
      const sheetName = worksheetData.name || worksheetData.title || `Sheet${worksheets.indexOf(worksheetData) + 1}`;
      console.log(`📋 Creating worksheet: ${sheetName}`);
      
      const worksheet = workbook.addWorksheet(sheetName);
      
      // Set up columns - accept any column format GPT provides
      if (worksheetData.columns) {
        worksheet.columns = worksheetData.columns;
      } else if (worksheetData.headers) {
        // Alternative column format
        worksheet.columns = worksheetData.headers.map((header, index) => ({
          header: header,
          key: `col${index + 1}`,
          width: 15
        }));
      }
      
      // Add data - accept any data format
      if (worksheetData.data && worksheetData.data.length > 0) {
        worksheet.addRows(worksheetData.data);
      } else if (worksheetData.rows) {
        worksheet.addRows(worksheetData.rows);
      }
      
      // Apply formulas if provided
      if (worksheetData.formulas && Array.isArray(worksheetData.formulas)) {
        worksheetData.formulas.forEach(formula => {
          try {
            worksheet.getCell(formula.cell).value = { formula: formula.formula };
          } catch (error) {
            console.warn(`⚠️ Formula error: ${error.message}`);
          }
        });
      }
      
      // Apply any formatting GPT specified
      this.applyDynamicFormattingFromGPT(worksheet, worksheetData);
    }
  }

  applyAdvancedFormatting(worksheet, worksheetData) {
    // Header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    };
    headerRow.alignment = { horizontal: 'center' };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.width) {
        column.width = column.width;
      }
    });
    
    // Format number columns (Debit/Credit/Amount)
    const numberColumns = ['debit', 'credit', 'amount'];
    worksheet.columns.forEach((column, index) => {
      if (numberColumns.some(nc => column.key && column.key.toLowerCase().includes(nc))) {
        const columnLetter = String.fromCharCode(65 + index);
        worksheet.getColumn(columnLetter).numFmt = '#,##0.00';
      }
    });
    
    // Add borders
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
    
    // Freeze header row
    worksheet.views = [{
      state: 'frozen',
      ySplit: 1
    }];
  }

  applyDynamicFormattingFromGPT(worksheet, worksheetData) {
    // Accept any formatting structure GPT provides - no restrictions
    const formatting = worksheetData.formatting || worksheetData.format || worksheetData.styles || {};
    
    // Apply header formatting if specified
    if (formatting.headerStyle || formatting.header) {
      const headerStyle = formatting.headerStyle || formatting.header;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        if (headerStyle.font) cell.font = headerStyle.font;
        if (headerStyle.fill) cell.fill = headerStyle.fill;
        if (headerStyle.alignment) cell.alignment = headerStyle.alignment;
        if (headerStyle.border) cell.border = headerStyle.border;
        if (headerStyle.backgroundColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: headerStyle.backgroundColor.replace('#', '') }
          };
        }
        if (headerStyle.fontColor) {
          cell.font = { ...cell.font, color: { argb: headerStyle.fontColor.replace('#', '') } };
        }
      });
    } else {
      // Default header formatting if none specified
      this.applyAdvancedFormatting(worksheet, worksheetData);
      return;
    }

    // Apply column-specific formatting
    if (formatting.currencyColumns || formatting.currency) {
      const currencyColumns = formatting.currencyColumns || formatting.currency || [];
      currencyColumns.forEach(columnKey => {
        const columnIndex = worksheetData.columns?.findIndex(col => col.key === columnKey);
        if (columnIndex !== -1) {
          const columnLetter = String.fromCharCode(65 + columnIndex);
          worksheet.getColumn(columnLetter).numFmt = '$#,##0.00';
        }
      });
    }

    if (formatting.dateColumns || formatting.dates) {
      const dateColumns = formatting.dateColumns || formatting.dates || [];
      dateColumns.forEach(columnKey => {
        const columnIndex = worksheetData.columns?.findIndex(col => col.key === columnKey);
        if (columnIndex !== -1) {
          const columnLetter = String.fromCharCode(65 + columnIndex);
          worksheet.getColumn(columnLetter).numFmt = 'mm/dd/yyyy';
        }
      });
    }

    if (formatting.numberColumns || formatting.numbers) {
      const numberColumns = formatting.numberColumns || formatting.numbers || [];
      numberColumns.forEach(columnKey => {
        const columnIndex = worksheetData.columns?.findIndex(col => col.key === columnKey);
        if (columnIndex !== -1) {
          const columnLetter = String.fromCharCode(65 + columnIndex);
          worksheet.getColumn(columnLetter).numFmt = '#,##0.00';
        }
      });
    }

    // Apply any custom cell formatting
    if (formatting.customStyles || formatting.cells) {
      const customStyles = formatting.customStyles || formatting.cells || {};
      Object.entries(customStyles).forEach(([cellRange, style]) => {
        try {
          const cell = worksheet.getCell(cellRange);
          Object.assign(cell, style);
        } catch (error) {
          console.warn(`⚠️ Custom style error for ${cellRange}:`, error.message);
        }
      });
    }

    // Add borders to all cells by default
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (!cell.border) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });
    });
  }

  async createExcelFromGPT(gptStructure, options = {}) {
    console.log('📊 Creating dynamic Excel file from GPT structure...');
    
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook properties
      workbook.creator = 'Nubia AI';
      workbook.lastModifiedBy = 'Nubia AI';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      // Process each worksheet with complete freedom
      if (gptStructure.worksheets && Array.isArray(gptStructure.worksheets)) {
        for (const sheetData of gptStructure.worksheets) {
          await this.createDynamicWorksheet(workbook, sheetData);
        }
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = options.filename || `nubia-financial-${timestamp}.xlsx`;
      const filepath = path.join(this.outputDir, filename);

      // Save the file
      await workbook.xlsx.writeFile(filepath);
      console.log('✅ Excel file created:', filepath);

      // Open the file if requested
      if (options.autoOpen !== false) {
        await this.openExcelFile(filepath);
      }

      return {
        success: true,
        filepath,
        filename,
        worksheetCount: gptStructure.worksheets?.length || 0,
        message: `Successfully created ${gptStructure.worksheets?.length || 0} worksheets`
      };

    } catch (error) {
      console.error('❌ Excel generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createDynamicWorksheet(workbook, sheetData) {
    console.log(`📋 Creating worksheet: ${sheetData.name}`);
    
    const worksheet = workbook.addWorksheet(sheetData.name);

    // Set up columns based on GPT's decision
    if (sheetData.columns && Array.isArray(sheetData.columns)) {
      const columns = sheetData.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
        style: this.getColumnStyle(col.type)
      }));
      worksheet.columns = columns;

      // Apply header formatting
      this.formatHeaders(worksheet, sheetData.formatting?.headerStyle);
    }

    // Add data rows
    if (sheetData.data && Array.isArray(sheetData.data)) {
      sheetData.data.forEach(row => {
        worksheet.addRow(row);
      });
    }

    // Apply formulas
    if (sheetData.formulas && Array.isArray(sheetData.formulas)) {
      sheetData.formulas.forEach(formula => {
        try {
          worksheet.getCell(formula.cell).value = { formula: formula.formula };
          if (formula.description) {
            worksheet.getCell(formula.cell).note = formula.description;
          }
        } catch (formulaError) {
          console.warn(`⚠️ Formula error in ${formula.cell}:`, formulaError.message);
        }
      });
    }

    // Apply formatting
    if (sheetData.formatting) {
      await this.applyDynamicFormatting(worksheet, sheetData.formatting, sheetData.columns);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const length = cell.value ? cell.value.toString().length : 10;
          if (length > maxLength) {
            maxLength = length;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });

    return worksheet;
  }

  getColumnStyle(type) {
    switch (type) {
      case 'currency':
        return { numFmt: '$#,##0.00' };
      case 'date':
        return { numFmt: 'mm/dd/yyyy' };
      case 'number':
        return { numFmt: '#,##0.00' };
      case 'percentage':
        return { numFmt: '0.00%' };
      default:
        return {};
    }
  }

  formatHeaders(worksheet, headerStyle) {
    if (!headerStyle) {
      // Default header formatting
      headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
        alignment: { horizontal: 'center' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });
  }

  async applyDynamicFormatting(worksheet, formatting, columns) {
    // Format currency columns
    if (formatting.currencyColumns && Array.isArray(formatting.currencyColumns)) {
      formatting.currencyColumns.forEach(columnKey => {
        const column = columns.find(col => col.key === columnKey);
        if (column) {
          const columnLetter = this.getColumnLetter(columns.indexOf(column) + 1);
          worksheet.getColumn(columnLetter).numFmt = '$#,##0.00';
        }
      });
    }

    // Format date columns
    if (formatting.dateColumns && Array.isArray(formatting.dateColumns)) {
      formatting.dateColumns.forEach(columnKey => {
        const column = columns.find(col => col.key === columnKey);
        if (column) {
          const columnLetter = this.getColumnLetter(columns.indexOf(column) + 1);
          worksheet.getColumn(columnLetter).numFmt = 'mm/dd/yyyy';
        }
      });
    }

    // Apply conditional formatting if specified
    if (formatting.conditionalFormatting) {
      formatting.conditionalFormatting.forEach(rule => {
        try {
          worksheet.addConditionalFormatting(rule);
        } catch (error) {
          console.warn('⚠️ Conditional formatting error:', error.message);
        }
      });
    }

    // Apply custom cell styles
    if (formatting.customStyles) {
      Object.entries(formatting.customStyles).forEach(([cellRange, style]) => {
        try {
          worksheet.getCell(cellRange).style = style;
        } catch (error) {
          console.warn(`⚠️ Custom style error for ${cellRange}:`, error.message);
        }
      });
    }
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
    
    return new Promise((resolve, reject) => {
      let command;
      
      if (process.platform === 'darwin') {
        // macOS
        command = `open -a "Microsoft Excel" "${filepath}"`;
      } else if (process.platform === 'win32') {
        // Windows
        command = `start excel "${filepath}"`;
      } else {
        // Linux - try common spreadsheet applications
        command = `xdg-open "${filepath}"`;
      }

      exec(command, (error, stdout, stderr) => {
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

  // Advanced features for complex documents
  async addChartsAndPivots(worksheet, sheetData) {
    if (sheetData.charts && Array.isArray(sheetData.charts)) {
      sheetData.charts.forEach(chartData => {
        try {
          // Create chart based on GPT specifications
          const chart = worksheet.addChart(chartData.type, {
            name: chartData.name,
            title: chartData.title,
            categories: chartData.categories,
            values: chartData.values
          });
          
          chart.setPosition(chartData.position?.row || 1, chartData.position?.col || 6);
          chart.setSize(chartData.size?.width || 400, chartData.size?.height || 300);
        } catch (chartError) {
          console.warn('⚠️ Chart creation error:', chartError.message);
        }
      });
    }
  }

  // Generate multiple file formats
  async exportToMultipleFormats(gptStructure, baseFilename) {
    const formats = ['xlsx', 'csv', 'pdf'];
    const results = {};

    for (const format of formats) {
      try {
        switch (format) {
          case 'xlsx':
            results[format] = await this.createExcelFromGPT(gptStructure, { 
              filename: `${baseFilename}.xlsx`,
              autoOpen: false 
            });
            break;
          case 'csv':
            results[format] = await this.exportToCSV(gptStructure, `${baseFilename}.csv`);
            break;
          case 'pdf':
            // PDF export would require additional libraries
            results[format] = { success: false, message: 'PDF export not implemented yet' };
            break;
        }
      } catch (error) {
        results[format] = { success: false, error: error.message };
      }
    }

    return results;
  }

  async exportToCSV(gptStructure, filename) {
    // Simple CSV export for first worksheet
    if (!gptStructure.worksheets || gptStructure.worksheets.length === 0) {
      return { success: false, error: 'No worksheets to export' };
    }

    const firstSheet = gptStructure.worksheets[0];
    const csvPath = path.join(this.outputDir, filename);
    
    let csvContent = '';
    
    // Headers
    if (firstSheet.columns) {
      csvContent += firstSheet.columns.map(col => `"${col.header}"`).join(',') + '\n';
    }
    
    // Data rows
    if (firstSheet.data) {
      firstSheet.data.forEach(row => {
        const values = firstSheet.columns.map(col => {
          const value = row[col.key] || '';
          return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csvContent += values.join(',') + '\n';
      });
    }

    fs.writeFileSync(csvPath, csvContent);
    
    return {
      success: true,
      filepath: csvPath,
      message: 'CSV exported successfully'
    };
  }
}

module.exports = DynamicExcelGenerator;