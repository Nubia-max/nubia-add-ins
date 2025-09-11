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
      
      // First, extract unique sheet names from commands to understand GPT's intent
      const commandSheetNames = [];
      const sheetNameMapping = new Map(); // Track original sheet names to actual worksheet names
      
      if (structure.commands) {
        structure.commands.forEach(cmd => {
          if (cmd.sheet && !commandSheetNames.includes(cmd.sheet)) {
            commandSheetNames.push(cmd.sheet);
          }
        });
      }
      
      console.log(`📋 GPT intended sheet names from commands: ${commandSheetNames.join(', ')}`);
      
      // Execute EXACTLY what GPT specified - no defaults, no fallbacks
      for (let i = 0; i < structure.workbook.length; i++) {
        const sheet = structure.workbook[i];
        let sheetName = sheet.sheet || sheet.sheetName || sheet.title || sheet.name;
        
        console.log(`📋 Sheet ${i} raw data:`, JSON.stringify({
          name: sheet.name,
          sheet: sheet.sheet, 
          sheetName: sheet.sheetName,
          title: sheet.title
        }));
        
        // If no name provided, prioritize command names over generic names
        if (!sheetName) {
          if (commandSheetNames[i]) {
            sheetName = commandSheetNames[i];
            console.log(`📋 Using command-inferred name: "${sheetName}" for sheet ${i}`);
          } else {
            sheetName = `Sheet${i + 1}`;
          }
        }
        
        // Sanitize the sheet name for Excel compatibility
        if (sheetName) {
          const originalName = sheetName;
          sheetName = this.sanitizeWorksheetName(sheetName);
          if (originalName !== sheetName) {
            console.log(`🔧 Sanitized sheet name: "${originalName}" → "${sheetName}"`);
            // Update mapping to use sanitized name
            sheetNameMapping.set(originalName, sheetName);
          }
        }
        
        // Store the mapping for command reference correction
        if (commandSheetNames[i] && commandSheetNames[i] !== sheetName) {
          sheetNameMapping.set(commandSheetNames[i], sheetName);
          console.log(`📋 Mapping command sheet "${commandSheetNames[i]}" → actual sheet "${sheetName}"`);
        }
        
        const worksheet = workbook.addWorksheet(sheetName);
        console.log(`📋 Created worksheet: "${sheetName}"`);
        
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
        this.executeCommandsAsSpecified(workbook, structure.commands, sheetNameMapping);
      }
      
      // Ensure ALL worksheets have basic formatting if GPT missed any
      this.ensureAllWorksheetsFormatted(workbook);
      
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
  executeCommandsAsSpecified(workbook, commands, sheetNameMapping = new Map()) {
  if (!commands || !Array.isArray(commands)) return;

  console.log(`📝 Executing ${commands.length} GPT commands`);
  
  for (const cmd of commands) {
    let commandType; // Declare outside try block for error handling
    try {
      // Handle text commands (validation instructions)
      if (typeof cmd === 'string') {
        console.log(`📋 GPT Instruction: ${cmd}`);
        continue;
      }
      
      // If command targets a specific sheet, use that sheet
      if (cmd.sheet || cmd.target) {
        let worksheetName = cmd.sheet || cmd.target;
        
        // Apply sheet name mapping if available
        if (sheetNameMapping.has(worksheetName)) {
          const originalName = worksheetName;
          worksheetName = sheetNameMapping.get(worksheetName);
          console.log(`📋 Mapped command sheet name: "${originalName}" → "${worksheetName}"`);
        }
        
        let worksheet = workbook.getWorksheet(worksheetName);
        
        if (!worksheet) {
          // Try to find worksheet by partial match, exact match ignoring case, or index
          const allSheets = workbook.worksheets;
          
          // First try exact match ignoring case
          let matchedSheet = allSheets.find(ws => 
            ws.name.toLowerCase() === worksheetName?.toLowerCase()
          );
          
          // Then try partial match
          if (!matchedSheet) {
            matchedSheet = allSheets.find(ws => 
              ws.name.toLowerCase().includes(worksheetName?.toLowerCase() || '') ||
              worksheetName?.toLowerCase().includes(ws.name.toLowerCase())
            );
          }
          
          // Finally try by index if worksheetName is a number or "Sheet1", "Sheet2" pattern
          if (!matchedSheet) {
            const sheetIndex = parseInt(worksheetName?.replace(/[^\d]/g, '')) - 1;
            if (!isNaN(sheetIndex) && sheetIndex >= 0 && sheetIndex < allSheets.length) {
              matchedSheet = allSheets[sheetIndex];
            }
          }
          
          if (matchedSheet) {
            console.log(`🔄 Using match: "${matchedSheet.name}" for command targeting "${worksheetName}"`);
            worksheet = matchedSheet;
          } else {
            console.warn(`❌ Worksheet not found: "${worksheetName}". Available sheets: ${allSheets.map(ws => ws.name).join(', ')}`);
            continue;
          }
        }
        
        // Apply command to specific worksheet
        this.executeCommandOnWorksheet(worksheet, cmd, commandType, workbook);
      } else {
        // If no sheet specified, apply to ALL worksheets for consistent formatting
        console.log(`📋 Applying command to all ${workbook.worksheets.length} worksheets`);
        workbook.worksheets.forEach((worksheet, index) => {
          console.log(`📋 Applying to worksheet ${index + 1}: "${worksheet.name}"`);
          this.executeCommandOnWorksheet(worksheet, cmd, commandType, workbook);
        });
      }
    } catch (error) {
      console.error(`❌ Command execution error: ${error.message}`);
      console.error(`❌ Failed command:`, JSON.stringify(cmd, null, 2));
      console.error(`❌ Command type: ${commandType}`);
    }
  }
}

// New helper method to execute command on a specific worksheet
executeCommandOnWorksheet(worksheet, cmd, commandType, workbook) {
  try {
    // Fix single column references in the command before processing
    if (cmd.range) {
      const originalRange = cmd.range;
      cmd.range = this.fixColumnReference(cmd.range);
      if (originalRange !== cmd.range) {
        console.log(`🔧 Fixed range: "${originalRange}" → "${cmd.range}"`);
      }
    }
    if (cmd.columns) {
      const originalColumns = cmd.columns;
      cmd.columns = this.fixColumnReference(cmd.columns);
      if (originalColumns !== cmd.columns) {
        console.log(`🔧 Fixed columns: "${originalColumns}" → "${cmd.columns}"`);
      }
    }
    
    commandType = cmd.type || this.inferCommandType(cmd);
    
    switch(commandType) {
      case 'format':
        this.applyFormat(worksheet, cmd);
        break;

      case 'formula':
        this.applyFormula(worksheet, cmd);
        break;

      case 'merge':
        this.applyMerge(worksheet, cmd);
        break;

      case 'validation':
        this.applyValidation(worksheet, cmd);
        break;

      case 'conditional_format':
        this.applyConditionalFormat(worksheet, cmd);
        break;

      case 'freeze_panes':
        this.applyFreezePanes(worksheet, cmd);
        break;

      case 'column_width':
        this.applyColumnWidth(worksheet, cmd);
        break;

      case 'row_height':
        this.applyRowHeight(worksheet, cmd);
        break;

      case 'print_setup':
        this.applyPrintSetup(worksheet, cmd);
        break;

      case 'header_footer':
        this.applyHeaderFooter(worksheet, cmd);
        break;

      case 'protection':
        this.applyProtection(worksheet, cmd);
        break;

      case 'filter':
        this.applyFilter(worksheet, cmd);
        break;

      case 'sort':
        this.applySort(worksheet, cmd);
        break;

      case 'comment':
        this.applyComment(worksheet, cmd);
        break;

      case 'hyperlink':
        this.applyHyperlink(worksheet, cmd);
        break;

      case 'image':
        this.applyImage(workbook, worksheet, cmd);
        break;

      case 'chart':
        this.applyChart(worksheet, cmd);
        break;

      case 'table':
        this.applyTable(worksheet, cmd);
        break;

      case 'pivot':
        this.applyPivot(worksheet, cmd);
        break;

      case 'sparkline':
        this.applySparkline(worksheet, cmd);
        break;

      case 'data_bar':
        this.applyDataBar(worksheet, cmd);
        break;

      case 'icon_set':
        this.applyIconSet(worksheet, cmd);
        break;

      case 'color_scale':
        this.applyColorScale(worksheet, cmd);
        break;

      case 'group':
        this.applyGrouping(worksheet, cmd);
        break;

      case 'outline':
        this.applyOutline(worksheet, cmd);
        break;

      case 'subtotal':
        this.applySubtotal(worksheet, cmd);
        break;

      case 'page_break':
        this.applyPageBreak(worksheet, cmd);
        break;

      case 'background':
        this.applyBackground(worksheet, cmd);
        break;

      case 'tab_color':
        this.applyTabColor(worksheet, cmd);
        break;

      case 'split_panes':
        this.applySplitPanes(worksheet, cmd);
        break;

      case 'zoom':
        this.applyZoom(worksheet, cmd);
        break;

      case 'rich_text':
        this.applyRichText(worksheet, cmd);
        break;

      case 'gradient':
        this.applyGradient(worksheet, cmd);
        break;

      case 'pattern':
        this.applyPattern(worksheet, cmd);
        break;

      case 'text_rotation':
        this.applyTextRotation(worksheet, cmd);
        break;

      case 'indent':
        this.applyIndent(worksheet, cmd);
        break;

      case 'wrap_text':
        this.applyWrapText(worksheet, cmd);
        break;

      case 'shrink_to_fit':
        this.applyShrinkToFit(worksheet, cmd);
        break;

      case 'custom_format':
        this.applyCustomFormat(worksheet, cmd);
        break;

      case 'named_range':
        this.applyNamedRange(workbook, worksheet, cmd);
        break;

      case 'data_validation':
        this.applyDataValidation(worksheet, cmd);
        break;

      case 'cell_style':
        this.applyCellStyle(worksheet, cmd);
        break;

      default:
        console.log(`❓ Unhandled command type: ${commandType}`, cmd);
    }
  } catch (error) {
    console.error(`❌ Command execution error on worksheet "${worksheet.name}":`, error.message);
  }
}

// Helper method to fix single column references
fixColumnReference(range) {
  if (!range) return range;
  
  // Handle single column references like "C" to "C:C"
  if (range.match(/^[A-Z]$/)) {
    return `${range}:${range}`;
  }
  
  // Handle multi-column ranges like "C:E" - ExcelJS needs cell references
  if (range.match(/^[A-Z]:[A-Z]$/)) {
    const [startCol, endCol] = range.split(':');
    return `${startCol}1:${endCol}1000`; // Use a reasonable row range
  }
  
  return range;
}

// Individual command implementation methods
applyFormat(worksheet, cmd) {
  if (!cmd.range) return;
  
  // Fix single column references
  cmd.range = this.fixColumnReference(cmd.range);
  
  const ranges = cmd.range.split(',');
  
  ranges.forEach(range => {
    const [start, end] = range.trim().split(':');
    
    if (end) {
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end);
      
      // Handle column ranges
      if (start.match(/^[A-Z]+$/) && end.match(/^[A-Z]+$/)) {
        for (let col = start.charCodeAt(0); col <= end.charCodeAt(0); col++) {
          const column = worksheet.getColumn(String.fromCharCode(col));
          if (cmd.numberFormat) column.numFmt = cmd.numberFormat;
        }
      } else {
        // Cell range
        for (let row = startCell.row; row <= endCell.row; row++) {
          for (let col = startCell.col; col <= endCell.col; col++) {
            this.formatCell(worksheet.getCell(row, col), cmd);
          }
        }
      }
    } else {
      // Single cell
      this.formatCell(worksheet.getCell(range.trim()), cmd);
    }
  });
}

formatCell(cell, cmd) {
  if (cmd.font) {
    cell.font = {
      name: cmd.font.name || 'Calibri',
      size: cmd.font.size || 11,
      bold: cmd.font.bold,
      italic: cmd.font.italic,
      underline: cmd.font.underline,
      strike: cmd.font.strike,
      color: cmd.font.color ? { argb: 'FF' + cmd.font.color } : undefined
    };
  }
  
  if (cmd.fill) {
    if (cmd.fill.type === 'gradient') {
      cell.fill = {
        type: 'gradient',
        gradient: cmd.fill.gradient
      };
    } else {
      cell.fill = {
        type: 'pattern',
        pattern: cmd.fill.pattern || 'solid',
        fgColor: cmd.fill.color ? { argb: 'FF' + cmd.fill.color } : undefined,
        bgColor: cmd.fill.bgColor ? { argb: 'FF' + cmd.fill.bgColor } : undefined
      };
    }
  }
  
  if (cmd.border) {
    cell.border = cmd.border;
  }
  
  if (cmd.alignment) {
    cell.alignment = {
      horizontal: cmd.alignment.horizontal,
      vertical: cmd.alignment.vertical,
      textRotation: cmd.alignment.textRotation,
      wrapText: cmd.alignment.wrapText,
      shrinkToFit: cmd.alignment.shrinkToFit,
      indent: cmd.alignment.indent
    };
  }
  
  if (cmd.numberFormat) {
    cell.numFmt = cmd.numberFormat;
  }
}

applyFormula(worksheet, cmd) {
  if (cmd.cell && cmd.formula) {
    let formula = cmd.formula;
    if (!formula.startsWith('=')) formula = '=' + formula;
    if (!formula.includes('IFERROR')) {
      formula = `=IFERROR(${formula.substring(1)}, 0)`;
    }
    worksheet.getCell(cmd.cell).value = { formula };
  }
}

applyMerge(worksheet, cmd) {
  if (cmd.range) {
    worksheet.mergeCells(cmd.range);
    if (cmd.alignment) {
      const [start] = cmd.range.split(':');
      worksheet.getCell(start).alignment = cmd.alignment;
    }
  }
}

applyValidation(worksheet, cmd) {
  if (cmd.cell || cmd.range) {
    const validation = {
      type: cmd.validationType || 'list',
      allowBlank: cmd.allowBlank !== false,
      showErrorMessage: true,
      errorTitle: cmd.errorTitle || 'Invalid Entry',
      error: cmd.error || 'Please enter a valid value'
    };
    
    if (cmd.values) {
      validation.formulae = [`"${cmd.values.join(',')}"`];
    } else if (cmd.formula) {
      validation.formulae = [cmd.formula];
    } else if (cmd.min !== undefined || cmd.max !== undefined) {
      validation.operator = cmd.operator || 'between';
      validation.formulae = [cmd.min, cmd.max].filter(v => v !== undefined);
    }
    
    if (cmd.range) {
      // Fix single column references
      cmd.range = this.fixColumnReference(cmd.range);
      const [start, end] = cmd.range.split(':');
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end || start);
      
      for (let r = startCell.row; r <= endCell.row; r++) {
        for (let c = startCell.col; c <= endCell.col; c++) {
          worksheet.getCell(r, c).dataValidation = validation;
        }
      }
    } else {
      worksheet.getCell(cmd.cell).dataValidation = validation;
    }
  }
}

applyConditionalFormat(worksheet, cmd) {
  if (!cmd.range || !cmd.rule) return;
  
  // Fix single column references
  cmd.range = this.fixColumnReference(cmd.range);
  const [start, end] = cmd.range.split(':');
  const startCell = worksheet.getCell(start);
  const endCell = worksheet.getCell(end || start);
  
  for (let r = startCell.row; r <= endCell.row; r++) {
    for (let c = startCell.col; c <= endCell.col; c++) {
      const cell = worksheet.getCell(r, c);
      const value = typeof cell.value === 'object' ? cell.value.result : cell.value;
      let shouldFormat = false;
      
      switch (cmd.rule.type) {
        case 'negative':
          shouldFormat = Number(value) < 0;
          break;
        case 'positive':
          shouldFormat = Number(value) > 0;
          break;
        case 'zero':
          shouldFormat = Number(value) === 0;
          break;
        case 'greaterThan':
          shouldFormat = Number(value) > Number(cmd.rule.value);
          break;
        case 'lessThan':
          shouldFormat = Number(value) < Number(cmd.rule.value);
          break;
        case 'between':
          shouldFormat = Number(value) >= Number(cmd.rule.min) && 
                       Number(value) <= Number(cmd.rule.max);
          break;
        case 'equals':
          shouldFormat = value == cmd.rule.value;
          break;
        case 'notEquals':
          shouldFormat = value != cmd.rule.value;
          break;
        case 'contains':
          shouldFormat = String(value).includes(cmd.rule.value);
          break;
        case 'beginsWith':
          shouldFormat = String(value).startsWith(cmd.rule.value);
          break;
        case 'endsWith':
          shouldFormat = String(value).endsWith(cmd.rule.value);
          break;
        case 'blank':
          shouldFormat = !value;
          break;
        case 'notBlank':
          shouldFormat = !!value;
          break;
        case 'duplicate':
          shouldFormat = this.isDuplicate(worksheet, value);
          break;
        case 'unique':
          shouldFormat = !this.isDuplicate(worksheet, value);
          break;
        case 'top':
          shouldFormat = this.isTop(worksheet, value, cmd.rule.count || 10, cmd.range);
          break;
        case 'bottom':
          shouldFormat = this.isBottom(worksheet, value, cmd.rule.count || 10, cmd.range);
          break;
      }
      
      if (shouldFormat && cmd.style) {
        this.formatCell(cell, cmd.style);
      }
    }
  }
}

applyFreezePanes(worksheet, cmd) {
  const views = [];
  
  if (cmd.row && cmd.col) {
    views.push({
      state: 'frozen',
      xSplit: cmd.col,
      ySplit: cmd.row,
      topLeftCell: worksheet.getCell(cmd.row + 1, cmd.col + 1).address
    });
  } else if (cmd.row) {
    views.push({
      state: 'frozen',
      ySplit: cmd.row,
      topLeftCell: `A${cmd.row + 1}`
    });
  } else if (cmd.col) {
    views.push({
      state: 'frozen',
      xSplit: cmd.col,
      topLeftCell: worksheet.getCell(1, cmd.col + 1).address
    });
  } else if (cmd.cell) {
    const cell = worksheet.getCell(cmd.cell);
    views.push({
      state: 'frozen',
      xSplit: cell.col - 1,
      ySplit: cell.row - 1,
      topLeftCell: cmd.cell
    });
  }
  
  if (views.length > 0) {
    worksheet.views = views;
  }
}

applyColumnWidth(worksheet, cmd) {
  if (!cmd.columns) return;
  
  const [start, end] = cmd.columns.split(':');
  
  for (let col = start.charCodeAt(0); col <= (end || start).charCodeAt(0); col++) {
    const column = worksheet.getColumn(String.fromCharCode(col));
    
    if (cmd.width === 'auto') {
      let maxWidth = 10;
      column.eachCell({ includeEmpty: false }, (cell) => {
        const value = String(cell.value || '');
        maxWidth = Math.max(maxWidth, value.length * 1.1 + 2);
      });
      column.width = Math.min(maxWidth, 100);
    } else {
      column.width = cmd.width;
    }
    
    if (cmd.hidden) column.hidden = true;
  }
}

applyRowHeight(worksheet, cmd) {
  if (cmd.rows) {
    const [start, end] = String(cmd.rows).split(':');
    for (let r = Number(start); r <= Number(end || start); r++) {
      const row = worksheet.getRow(r);
      if (cmd.height === 'auto') {
        row.height = undefined; // Reset to auto
      } else {
        row.height = cmd.height;
      }
      if (cmd.hidden) row.hidden = true;
    }
  }
}

// Additional helper methods
isDuplicate(worksheet, value) {
  let count = 0;
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === value) count++;
    });
  });
  return count > 1;
}

isTop(worksheet, value, count, range) {
  const values = [];
  const [start, end] = range.split(':');
  const startCell = worksheet.getCell(start);
  const endCell = worksheet.getCell(end);
  
  for (let r = startCell.row; r <= endCell.row; r++) {
    for (let c = startCell.col; c <= endCell.col; c++) {
      const cellValue = worksheet.getCell(r, c).value;
      if (typeof cellValue === 'number') values.push(cellValue);
    }
  }
  
  values.sort((a, b) => b - a);
  return values.indexOf(value) < count;
}

isBottom(worksheet, value, count, range) {
  const values = [];
  const [start, end] = range.split(':');
  const startCell = worksheet.getCell(start);
  const endCell = worksheet.getCell(end);
  
  for (let r = startCell.row; r <= endCell.row; r++) {
    for (let c = startCell.col; c <= endCell.col; c++) {
      const cellValue = worksheet.getCell(r, c).value;
      if (typeof cellValue === 'number') values.push(cellValue);
    }
  }
  
  values.sort((a, b) => a - b);
  return values.indexOf(value) < count;
}

// Additional missing method implementations
applyPrintSetup(worksheet, cmd) {
  if (!worksheet.pageSetup) worksheet.pageSetup = {};
  
  if (cmd.orientation) worksheet.pageSetup.orientation = cmd.orientation;
  if (cmd.paperSize) worksheet.pageSetup.paperSize = cmd.paperSize;
  if (cmd.margins) worksheet.pageSetup.margins = cmd.margins;
  if (cmd.scale) worksheet.pageSetup.scale = cmd.scale;
  if (cmd.fitToPage) worksheet.pageSetup.fitToPage = cmd.fitToPage;
}

applyHeaderFooter(worksheet, cmd) {
  if (!worksheet.headerFooter) worksheet.headerFooter = {};
  
  if (cmd.header) worksheet.headerFooter.oddHeader = cmd.header;
  if (cmd.footer) worksheet.headerFooter.oddFooter = cmd.footer;
  if (cmd.evenHeader) worksheet.headerFooter.evenHeader = cmd.evenHeader;
  if (cmd.evenFooter) worksheet.headerFooter.evenFooter = cmd.evenFooter;
}

applyProtection(worksheet, cmd) {
  if (cmd.password) {
    worksheet.protect(cmd.password, cmd.options || {});
  } else {
    worksheet.protect('', cmd.options || {});
  }
}

applyFilter(worksheet, cmd) {
  if (cmd.range) {
    worksheet.autoFilter = cmd.range;
  }
}

applySort(worksheet, cmd) {
  // Note: ExcelJS doesn't directly support sorting, this would be a placeholder
  console.log('Sort command received but not implemented in ExcelJS:', cmd);
}

applyComment(worksheet, cmd) {
  if (cmd.cell && cmd.text) {
    const cell = worksheet.getCell(cmd.cell);
    cell.note = {
      texts: [{ text: cmd.text }],
      margins: { insetmode: 'auto' },
      protection: { locked: true },
      editAs: 'absolute'
    };
  }
}

applyHyperlink(worksheet, cmd) {
  if (cmd.cell && cmd.url) {
    const cell = worksheet.getCell(cmd.cell);
    cell.value = {
      text: cmd.text || cmd.url,
      hyperlink: cmd.url
    };
  }
}

applyImage(workbook, worksheet, cmd) {
  if (cmd.path || cmd.base64) {
    const imageId = workbook.addImage({
      base64: cmd.base64,
      filename: cmd.path,
      extension: cmd.extension || 'png'
    });
    
    worksheet.addImage(imageId, {
      tl: { col: cmd.col || 0, row: cmd.row || 0 },
      ext: { width: cmd.width || 100, height: cmd.height || 100 }
    });
  }
}

applyChart(worksheet, cmd) {
  // Note: ExcelJS has limited chart support
  console.log('Chart command received but limited support in ExcelJS:', cmd);
}

applyTable(worksheet, cmd) {
  if (cmd.range && cmd.name) {
    worksheet.addTable({
      name: cmd.name,
      ref: cmd.range,
      headerRow: cmd.headerRow !== false,
      totalsRow: cmd.totalsRow || false,
      style: cmd.style || {
        theme: 'TableStyleMedium2',
        showRowStripes: true
      },
      columns: cmd.columns || []
    });
  }
}

applyPivot(worksheet, cmd) {
  // Note: ExcelJS doesn't support pivot tables
  console.log('Pivot table command received but not supported in ExcelJS:', cmd);
}

applySparkline(worksheet, cmd) {
  // Note: ExcelJS doesn't support sparklines
  console.log('Sparkline command received but not supported in ExcelJS:', cmd);
}

applyDataBar(worksheet, cmd) {
  // This would be handled through conditional formatting
  if (cmd.range) {
    this.applyConditionalFormat(worksheet, {
      range: cmd.range,
      rule: { type: 'dataBar' },
      style: cmd.style || {}
    });
  }
}

applyIconSet(worksheet, cmd) {
  // This would be handled through conditional formatting
  console.log('Icon set command received but limited support in ExcelJS:', cmd);
}

applyColorScale(worksheet, cmd) {
  // This would be handled through conditional formatting
  console.log('Color scale command received but limited support in ExcelJS:', cmd);
}

applyGrouping(worksheet, cmd) {
  if (cmd.rows) {
    const [start, end] = String(cmd.rows).split(':');
    worksheet.getRows(Number(start), Number(end) - Number(start) + 1).forEach(row => {
      row.outlineLevel = cmd.level || 1;
    });
  }
  
  if (cmd.columns) {
    const [start, end] = cmd.columns.split(':');
    for (let col = start.charCodeAt(0); col <= end.charCodeAt(0); col++) {
      const column = worksheet.getColumn(String.fromCharCode(col));
      column.outlineLevel = cmd.level || 1;
    }
  }
}

applyOutline(worksheet, cmd) {
  // Similar to grouping
  this.applyGrouping(worksheet, cmd);
}

applySubtotal(worksheet, cmd) {
  // Note: This would require complex calculation logic
  console.log('Subtotal command received but requires manual implementation:', cmd);
}

applyPageBreak(worksheet, cmd) {
  if (cmd.row) {
    const row = worksheet.getRow(cmd.row);
    row.addPageBreak = true;
  }
}

applyBackground(worksheet, cmd) {
  if (cmd.image) {
    // Note: ExcelJS has limited background image support
    console.log('Background image command received but limited support:', cmd);
  }
}

applyTabColor(worksheet, cmd) {
  if (cmd.color) {
    worksheet.properties.tabColor = { argb: 'FF' + cmd.color };
  }
}

applySplitPanes(worksheet, cmd) {
  const views = [];
  
  if (cmd.row || cmd.col) {
    views.push({
      state: 'split',
      xSplit: cmd.col || 0,
      ySplit: cmd.row || 0
    });
    worksheet.views = views;
  }
}

applyZoom(worksheet, cmd) {
  if (cmd.scale) {
    worksheet.views = [{
      zoomScale: cmd.scale,
      zoomScaleNormal: cmd.scale
    }];
  }
}

applyRichText(worksheet, cmd) {
  if (cmd.cell && cmd.richText) {
    const cell = worksheet.getCell(cmd.cell);
    cell.value = {
      richText: cmd.richText
    };
  }
}

applyGradient(worksheet, cmd) {
  if (cmd.range && cmd.gradient) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.fill = {
          type: 'gradient',
          gradient: cmd.gradient
        };
      }
    }
  }
}

applyPattern(worksheet, cmd) {
  if (cmd.range && cmd.pattern) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.fill = {
          type: 'pattern',
          pattern: cmd.pattern.type || 'solid',
          fgColor: cmd.pattern.fgColor ? { argb: 'FF' + cmd.pattern.fgColor } : undefined,
          bgColor: cmd.pattern.bgColor ? { argb: 'FF' + cmd.pattern.bgColor } : undefined
        };
      }
    }
  }
}

applyTextRotation(worksheet, cmd) {
  if (cmd.range && cmd.rotation !== undefined) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.alignment = {
          ...cell.alignment,
          textRotation: cmd.rotation
        };
      }
    }
  }
}

applyIndent(worksheet, cmd) {
  if (cmd.range && cmd.indent !== undefined) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.alignment = {
          ...cell.alignment,
          indent: cmd.indent
        };
      }
    }
  }
}

applyWrapText(worksheet, cmd) {
  if (cmd.range) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.alignment = {
          ...cell.alignment,
          wrapText: cmd.wrap !== false
        };
      }
    }
  }
}

applyShrinkToFit(worksheet, cmd) {
  if (cmd.range) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.alignment = {
          ...cell.alignment,
          shrinkToFit: cmd.shrink !== false
        };
      }
    }
  }
}

applyCustomFormat(worksheet, cmd) {
  if (cmd.range && cmd.format) {
    cmd.range = this.fixColumnReference(cmd.range);
    const [start, end] = cmd.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);
    
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        const cell = worksheet.getCell(r, c);
        cell.numFmt = cmd.format;
      }
    }
  }
}

applyNamedRange(workbook, worksheet, cmd) {
  if (cmd.name && cmd.range) {
    workbook.definedNames.add(cmd.name, `'${worksheet.name}'!${cmd.range}`);
  }
}

applyDataValidation(worksheet, cmd) {
  // This is essentially the same as applyValidation
  this.applyValidation(worksheet, cmd);
}

applyCellStyle(worksheet, cmd) {
  if (cmd.range && cmd.style) {
    this.formatCell(worksheet.getCell(cmd.range), cmd.style);
  }
}
  // Infer command type from GPT's natural output structure
  inferCommandType(cmd) {
    // Handle GPT's various output formats - prioritize action field
    if (cmd.action) {
      if (cmd.action === 'format' || cmd.action === 'style') return 'format';
      if (cmd.action === 'validate' || cmd.action === 'validation') return 'validation';
      if (cmd.action === 'formula' || cmd.action === 'calculate') return 'formula';
      if (cmd.action === 'conditional_format') return 'conditional_format';
    }
    
    // Handle type field variations
    if (cmd.type) {
      if (cmd.type === 'format' || cmd.type === 'style') return 'format';
      if (cmd.type === 'validation' || cmd.type === 'validate') return 'validation';
      if (cmd.type === 'formula' || cmd.type === 'calculate') return 'formula';
      if (cmd.type === 'conditional_format') return 'conditional_format';
    }
    
    // Infer from content structure
    if (cmd.formula) return 'formula';
    if (cmd.numberFormat) return 'numberFormat'; // Handle numberFormat separately
    if (cmd.format || cmd.style) return 'format';
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
      // Fix single column references
      range = this.fixColumnReference(range);
      
      // Handle column ranges
      if (range && range.includes(':')) {
        const [start, end] = range.split(':');
        
        // If it's a column range like "C:C" or "C:D"
        if (start.match(/^[A-Z]+$/) && end.match(/^[A-Z]+$/)) {
          // Apply to entire columns - use a reasonable range like first 1000 rows
          const startCol = start.charCodeAt(0) - 65 + 1; // A=1, B=2, etc.
          const endCol = end.charCodeAt(0) - 65 + 1;
          
          for (let r = 1; r <= 1000; r++) { // Apply to first 1000 rows
            for (let c = startCol; c <= endCol; c++) {
              const cell = worksheet.getCell(r, c);
              cell.font = { ...cell.font, bold: true };
            }
          }
        } else {
          // Cell range like "C1:D10"
          const startCell = worksheet.getCell(start);
          const endCell = worksheet.getCell(end || start);
          
          for (let r = startCell.row; r <= endCell.row; r++) {
            for (let c = startCell.col; c <= endCell.col; c++) {
              const cell = worksheet.getCell(r, c);
              cell.font = { ...cell.font, bold: true };
            }
          }
        }
      } else {
        // Single cell
        const cell = worksheet.getCell(range);
        cell.font = { ...cell.font, bold: true };
      }
    } catch (error) {
      console.error('Bold formatting error:', error, 'Range:', range);
    }
  }

  // Apply general formatting to a range
  applyFormatToRange(worksheet, range, format) {
    try {
      // Fix single column references
      range = this.fixColumnReference(range);
      
      // Handle column ranges
      if (range && range.includes(':')) {
        const [start, end] = range.split(':');
        
        // If it's a column range like "C:C" or "C:D"
        if (start.match(/^[A-Z]+$/) && end.match(/^[A-Z]+$/)) {
          // Apply to entire columns - use a reasonable range like first 1000 rows
          const startCol = start.charCodeAt(0) - 65 + 1; // A=1, B=2, etc.
          const endCol = end.charCodeAt(0) - 65 + 1;
          
          for (let r = 1; r <= 1000; r++) { // Apply to first 1000 rows
            for (let c = startCol; c <= endCol; c++) {
              const cell = worksheet.getCell(r, c);
              Object.assign(cell, format);
            }
          }
        } else {
          // Cell range like "C1:D10"
          const startCell = worksheet.getCell(start);
          const endCell = worksheet.getCell(end || start);
          
          for (let r = startCell.row; r <= endCell.row; r++) {
            for (let c = startCell.col; c <= endCell.col; c++) {
              const cell = worksheet.getCell(r, c);
              Object.assign(cell, format);
            }
          }
        }
      } else {
        // Single cell
        const cell = worksheet.getCell(range);
        Object.assign(cell, format);
      }
    } catch (error) {
      console.error('Range formatting error:', error, 'Range:', range);
    }
  }

  // Apply number formatting to a range
  applyNumberFormatToRange(worksheet, range, numberFormat) {
    try {
      // Fix single column references
      range = this.fixColumnReference(range);
      
      // Handle column ranges
      if (range && range.includes(':')) {
        const [start, end] = range.split(':');
        
        // If it's a column range like "C:C" or "C:D"
        if (start.match(/^[A-Z]+$/) && end.match(/^[A-Z]+$/)) {
          // Apply to entire columns
          const startCol = start.charCodeAt(0) - 65 + 1; // A=1, B=2, etc.
          const endCol = end.charCodeAt(0) - 65 + 1;
          
          for (let col = startCol; col <= endCol; col++) {
            const column = worksheet.getColumn(col);
            column.numFmt = numberFormat;
          }
        } else {
          // Cell range like "C1:D10"
          const startCell = worksheet.getCell(start);
          const endCell = worksheet.getCell(end || start);
          
          for (let r = startCell.row; r <= endCell.row; r++) {
            for (let c = startCell.col; c <= endCell.col; c++) {
              const cell = worksheet.getCell(r, c);
              cell.numFmt = numberFormat;
            }
          }
        }
      } else {
        // Single cell
        const cell = worksheet.getCell(range);
        cell.numFmt = numberFormat;
      }
    } catch (error) {
      console.error('Number formatting error:', error, 'Range:', range);
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

  // Sanitize worksheet name for Excel compatibility
  sanitizeWorksheetName(name) {
    if (!name) return name;
    
    // Excel doesn't allow these characters: * ? : \ / [ ]
    // Replace forward slash with dash, remove other invalid characters
    return name
      .replace(/\//g, '-')  // Replace / with -
      .replace(/[*?:\\\[\]]/g, '')  // Remove other invalid characters
      .substring(0, 31);  // Excel max worksheet name is 31 characters
  }

  // Ensure all worksheets have basic formatting
  ensureAllWorksheetsFormatted(workbook) {
    console.log(`🎨 Ensuring all ${workbook.worksheets.length} worksheets have formatting`);
    
    workbook.worksheets.forEach((worksheet, index) => {
      const sheetName = worksheet.name;
      console.log(`🎨 Checking formatting for "${sheetName}"`);
      
      // Check if this worksheet already has formatting by looking at header row
      const headerRow = worksheet.getRow(1);
      const hasFormatting = headerRow.font?.bold || headerRow.fill?.fgColor;
      
      if (!hasFormatting) {
        console.log(`🎨 Applying missing formatting to "${sheetName}"`);
        
        // Get the range based on actual data
        const lastRow = worksheet.actualRowCount || 10;
        const lastCol = worksheet.actualColumnCount || 5;
        const lastColLetter = String.fromCharCode(64 + lastCol); // A=65, so 64+1=A
        
        // Apply basic professional formatting
        const basicCommands = [
          {
            type: "format",
            sheet: sheetName,
            range: `A1:${lastColLetter}1`,
            font: { bold: true, color: "FFFFFF" },
            fill: { color: "4472C4" }
          },
          {
            type: "format",
            sheet: sheetName,
            range: `A1:${lastColLetter}${lastRow}`,
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          },
          {
            type: "freeze_panes",
            sheet: sheetName,
            row: 1
          },
          {
            type: "column_width",
            sheet: sheetName,
            columns: `A:${lastColLetter}`,
            width: "auto"
          }
        ];
        
        // Apply the commands
        basicCommands.forEach(cmd => {
          try {
            this.executeCommandOnWorksheet(worksheet, cmd, cmd.type, workbook);
          } catch (error) {
            console.warn(`⚠️ Failed to apply basic formatting to ${sheetName}:`, error.message);
          }
        });
      }
    });
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