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

  // LEGENDARY NUBIA: Pure GPT executor with complete freedom
  async generateWithCompleteFreedom(structure, userId = 'default') {
    if (!structure || !structure.workbook) {
      throw new Error('No structure provided by GPT - GPT must provide complete workbook structure');
    }
    
    console.log('🎯 Executing GPT structure with complete freedom');
    
    try {
      const workbook = new ExcelJS.Workbook();
      const filename = `Nubia_${userId}_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);
      
      // Execute EXACTLY what GPT specified - no defaults, no fallbacks
      for (const sheet of structure.workbook) {
        const sheetName = sheet.name || sheet.sheetName || sheet.title || 'Sheet';
        const worksheet = workbook.addWorksheet(sheetName);
        
        // Add data exactly as GPT provided - support multiple data formats
        const sheetData = sheet.data || sheet.rows || sheet.content || sheet.entries;
        if (sheetData) {
          this.addDataAsProvided(worksheet, sheetData, sheet.headers);
        }
        
        // Apply formatting exactly as GPT specified
        if (sheet.formatting) {
          this.applyFormattingAsSpecified(worksheet, sheet.formatting);
        }
      }
      
      // Execute commands exactly as GPT specified
      if (structure.commands) {
        this.executeCommandsAsSpecified(workbook, structure.commands);
      }
      
      // Save and open
      await workbook.xlsx.writeFile(filepath);
      await this.openExcelFile(filepath);
      
      console.log('✅ GPT structure executed successfully:', filename);
      
      return {
        success: true,
        filename,
        filepath,
        worksheets: structure.workbook.length
      };
      
    } catch (error) {
      console.error('❌ GPT structure execution failed:', error);
      throw error;
    }
  }

  // Backward compatibility - redirects to pure executor
  async generateFromStructure(structure, userId = 'default') {
    return this.generateWithCompleteFreedom(structure, userId);
  }

  // Add data exactly as GPT provided - FIXED cell writing mechanism
  addDataAsProvided(worksheet, data, headers = null) {
    if (!data || !Array.isArray(data)) {
      return;
    }

    // Handle different data formats GPT might provide
    if (data.length > 0) {
      const firstRow = data[0];
      
      if (Array.isArray(firstRow)) {
        // 2D array format - use provided headers or first row as headers
        const headerRow = headers || firstRow;
        const dataRows = headers ? data : data.slice(1);
        
        // Set columns from headers
        worksheet.columns = headerRow.map(header => ({
          header: header,
          key: String(header).toLowerCase().replace(/[^a-z0-9]/g, '_'),
          width: this.getBasicWidth(String(header))
        }));
        
        // FIXED: Write data rows directly to cells to ensure proper values
        dataRows.forEach((row, rowIndex) => {
          if (Array.isArray(row)) {
            // Write each cell value directly by position
            row.forEach((value, colIndex) => {
              const cell = worksheet.getCell(rowIndex + 2, colIndex + 1); // +2 because row 1 is header
              // Handle different value types properly
              if (value === null || value === undefined || value === '') {
                cell.value = null;
              } else if (typeof value === 'number') {
                cell.value = value;
              } else if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
                // Convert numeric strings to numbers for Excel calculations
                cell.value = parseFloat(value);
              } else {
                cell.value = value;
              }
            });
          } else {
            // Fallback: convert to row object for ExcelJS
            const rowData = {};
            headerRow.forEach((header, index) => {
              const key = String(header).toLowerCase().replace(/[^a-z0-9]/g, '_');
              rowData[key] = row[index];
            });
            worksheet.addRow(rowData);
          }
        });
        
      } else if (typeof firstRow === 'object') {
        // Object array format - use keys as headers
        const headers = Object.keys(firstRow);
        
        worksheet.columns = headers.map(header => ({
          header: header,
          key: header,
          width: this.getBasicWidth(header)
        }));
        
        // FIXED: Properly handle object data with type conversion
        data.forEach(rowObj => {
          const convertedRow = {};
          Object.entries(rowObj).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              convertedRow[key] = null;
            } else if (typeof value === 'number') {
              convertedRow[key] = value;
            } else if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
              convertedRow[key] = parseFloat(value);
            } else {
              convertedRow[key] = value;
            }
          });
          worksheet.addRow(convertedRow);
        });
      }
    }
  }

  // Apply formatting exactly as GPT specified - no defaults
  applyFormattingAsSpecified(worksheet, formatting) {
    if (!formatting) return;

    // Apply header formatting if GPT specified it
    if (formatting.header) {
      const headerRow = worksheet.getRow(1);
      if (formatting.header.font) {
        headerRow.font = formatting.header.font;
      }
      if (formatting.header.fill) {
        headerRow.fill = formatting.header.fill;
      }
      if (formatting.header.alignment) {
        headerRow.alignment = formatting.header.alignment;
      }
      if (formatting.header.height) {
        headerRow.height = formatting.header.height;
      }
    }

    // Apply column formatting if GPT specified it
    if (formatting.columns) {
      formatting.columns.forEach((colFormat, index) => {
        const column = worksheet.getColumn(index + 1);
        if (colFormat.numFmt) {
          column.numFmt = colFormat.numFmt;
        }
        if (colFormat.width) {
          column.width = colFormat.width;
        }
        if (colFormat.alignment) {
          column.alignment = colFormat.alignment;
        }
      });
    }

    // Apply cell-specific formatting if GPT specified it
    if (formatting.cells) {
      formatting.cells.forEach(cellFormat => {
        const cell = worksheet.getCell(cellFormat.address);
        if (cellFormat.font) cell.font = cellFormat.font;
        if (cellFormat.fill) cell.fill = cellFormat.fill;
        if (cellFormat.border) cell.border = cellFormat.border;
        if (cellFormat.alignment) cell.alignment = cellFormat.alignment;
        if (cellFormat.numFmt) cell.numFmt = cellFormat.numFmt;
      });
    }

    // Apply borders if GPT specified them
    if (formatting.borders) {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= (formatting.borders.applyToRows || Infinity)) {
          row.eachCell((cell) => {
            cell.border = formatting.borders.style;
          });
        }
      });
    }

    // Apply freeze panes if GPT specified them
    if (formatting.freezePanes) {
      worksheet.views = [formatting.freezePanes];
    }
  }

  // Execute commands exactly as GPT specified
  executeCommandsAsSpecified(workbook, commands) {
    if (!commands || !Array.isArray(commands)) return;

    console.log(`📝 Executing ${commands.length} GPT commands`);
    
    for (const cmd of commands) {
      try {
        // Handle text commands (validation instructions)
        if (typeof cmd === 'string') {
          console.log(`📋 GPT Validation Instruction: ${cmd}`);
          // These are validation reminders, not executable commands
          continue;
        }
        
        const worksheet = cmd.sheet ? 
          workbook.getWorksheet(cmd.sheet) : 
          workbook.worksheets[0];
        
        if (!worksheet) {
          console.warn(`Worksheet not found: ${cmd.sheet}`);
          continue;
        }
        
        // GPT might not always provide a 'type' field - infer from command structure
        const commandType = cmd.type || this.inferCommandType(cmd);
        
        switch(commandType) {
          case 'formula':
            if (cmd.cell && cmd.formula) {
              // Wrap in IFERROR to prevent errors - only mechanical protection
              const formula = cmd.formula.startsWith('=IFERROR') ? 
                cmd.formula : 
                `=IFERROR(${cmd.formula}, 0)`;
              worksheet.getCell(cmd.cell).value = { formula };
            }
            break;
            
          case 'validation':
            if (cmd.cell && cmd.values) {
              worksheet.getCell(cmd.cell).dataValidation = {
                type: 'list',
                allowBlank: cmd.allowBlank || false,
                formulae: [`"${cmd.values.join(',')}"`],
                showErrorMessage: true,
                errorTitle: cmd.errorTitle || 'Invalid Selection',
                error: cmd.error || 'Please select from the list'
              };
            } else if (cmd.range && cmd.type === 'numeric') {
              // Handle numeric validation for ranges
              const [start, end] = cmd.range.split(':');
              const worksheet_target = cmd.target ? 
                workbook.getWorksheet(cmd.target) : worksheet;
              
              if (worksheet_target) {
                // Apply numeric validation to range
                this.applyNumericValidationToRange(worksheet_target, cmd.range);
              }
            }
            break;
            
          case 'format':
            if (cmd.range && cmd.format) {
              const range = worksheet.getCell(cmd.range);
              Object.assign(range, cmd.format);
            } else if (cmd.range && cmd.style === 'bold') {
              // Handle GPT's bold formatting
              const worksheet_target = cmd.target ? 
                workbook.getWorksheet(cmd.target) : worksheet;
              
              if (worksheet_target) {
                this.applyBoldFormatting(worksheet_target, cmd.range);
              }
            }
            break;

          case 'conditional_format':
            this.applyConditionalFormat(worksheet, cmd);
            break;
            
          default:
            console.log(`Unrecognized command structure:`, cmd);
            // Log but don't fail - GPT knows what it's doing
        }
      } catch (error) {
        console.error(`Command execution error: ${error.message}`);
      }
    }
  }

  // Infer command type from GPT's natural output structure
  inferCommandType(cmd) {
    // Handle GPT's actual output format with 'action' field
    if (cmd.action === 'format') return 'format';
    if (cmd.action === 'validate') return 'validation';
    if (cmd.action === 'formula') return 'formula';
    
    // Handle traditional format
    if (cmd.formula) return 'formula';
    if (cmd.format || cmd.numberFormat) return 'format';
    if (cmd.validation || cmd.values) return 'validation';
    if (cmd.rule && cmd.range) return 'conditional_format';
    
    // Don't default - return undefined if unclear
    return undefined;
  }

  // Apply numeric validation to a range
  applyNumericValidationToRange(worksheet, range) {
    try {
      const [start, end] = range.split(':');
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end || start);
      
      for (let r = startCell.row; r <= endCell.row; r++) {
        for (let c = startCell.col; c <= endCell.col; c++) {
          const cell = worksheet.getCell(r, c);
          cell.dataValidation = {
            type: 'decimal',
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: 'Invalid Number',
            error: 'Please enter a valid number'
          };
        }
      }
    } catch (error) {
      console.error('Numeric validation error:', error);
    }
  }

  // Apply bold formatting to a range
  applyBoldFormatting(worksheet, range) {
    try {
      const [start, end] = range.split(':');
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end || start);
      
      for (let r = startCell.row; r <= endCell.row; r++) {
        for (let c = startCell.col; c <= endCell.col; c++) {
          const cell = worksheet.getCell(r, c);
          cell.font = { ...cell.font, bold: true };
        }
      }
    } catch (error) {
      console.error('Bold formatting error:', error);
    }
  }

  // Apply conditional formatting as GPT specified
  applyConditionalFormat(worksheet, cmd) {
    try {
      const { range, rule } = cmd;
      if (!range || !rule) return;
      
      const [start, end] = range.split(':');
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end || start);
      const startRow = startCell.row, startCol = startCell.col;
      const endRow = endCell.row, endCol = endCell.col;
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = worksheet.getCell(r, c);
          const value = cell.value;
          let shouldFormat = false;
          
          switch (rule.type) {
            case 'greaterThan':
              shouldFormat = Number(value) > Number(rule.value);
              break;
            case 'lessThan':
              shouldFormat = Number(value) < Number(rule.value);
              break;
            case 'between':
              shouldFormat = Number(value) >= Number(rule.min) && Number(value) <= Number(rule.max);
              break;
            case 'negative':
              shouldFormat = Number(value) < 0;
              break;
            case 'equals':
              shouldFormat = value == rule.value;
              break;
          }
          
          if (shouldFormat && rule.style) {
            if (rule.style.fill) {
              cell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: rule.style.fill } 
              };
            }
            if (rule.style.font) {
              cell.font = { ...cell.font, ...rule.style.font };
            }
            if (rule.style.border) {
              cell.border = rule.style.border;
            }
          }
        }
      }
    } catch (error) {
      console.error('Conditional formatting error:', error);
    }
  }

  // Basic width calculation - no intelligence, just mechanical
  getBasicWidth(header) {
    const length = String(header).length;
    return Math.max(10, Math.min(50, length + 5));
  }

  // Mechanical file opening - no changes needed
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
          console.warn('⚠️ Could not auto-open Excel:', error.message);
          resolve({ opened: false, error: error.message });
        } else {
          console.log('✅ Excel opened successfully');
          resolve({ opened: true });
        }
      });
    });
  }
}

module.exports = DynamicExcelGenerator;

/*
LEGENDARY NUBIA: Pure GPT Executor
✅ No hardcoded templates or structures
✅ No default sheets or fallbacks  
✅ No decision-making or intelligence
✅ Executes ONLY what GPT provides
✅ Mechanical data placement
✅ Mechanical formatting application
✅ Mechanical command execution
✅ IFERROR wrapping for formula protection
✅ File opening functionality

GPT HAS COMPLETE FREEDOM - The generator just executes
*/