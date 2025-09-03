import { ExcelTask } from './excelParser';
import { automationService } from './automation';

export interface ExcelFile {
  id: string;
  name: string;
  path: string;
  type: 'xlsx' | 'xls' | 'csv';
  size: number;
  lastModified: Date;
  sheets: ExcelSheet[];
  isActive: boolean;
}

export interface ExcelSheet {
  id: string;
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
  hasData: boolean;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  file?: ExcelFile;
  error?: string;
}

export interface ExcelRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  sheetName: string;
}

class ExcelFileHandler {
  private openFiles: Map<string, ExcelFile> = new Map();
  private activeFileId: string | null = null;

  // File Management
  async openFile(filePath: string): Promise<FileOperationResult> {
    try {
      // Check if file is already open
      const existingFile = Array.from(this.openFiles.values())
        .find(file => file.path === filePath);
      
      if (existingFile) {
        this.setActiveFile(existingFile.id);
        return {
          success: true,
          message: 'File is already open',
          file: existingFile
        };
      }

      // Create file info (in real implementation, this would read the actual file)
      const fileInfo = await this.getFileInfo(filePath);
      const newFile: ExcelFile = {
        id: `file_${Date.now()}`,
        name: this.getFileName(filePath),
        path: filePath,
        type: this.getFileType(filePath),
        size: fileInfo.size || 0,
        lastModified: fileInfo.lastModified || new Date(),
        sheets: await this.getFileSheets(filePath),
        isActive: false
      };

      this.openFiles.set(newFile.id, newFile);
      this.setActiveFile(newFile.id);

      return {
        success: true,
        message: `Successfully opened ${newFile.name}`,
        file: newFile
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to open Excel file',
        error: error.message
      };
    }
  }

  async createNewFile(name: string = 'Workbook1.xlsx'): Promise<FileOperationResult> {
    try {
      const newFile: ExcelFile = {
        id: `new_file_${Date.now()}`,
        name,
        path: '', // No path until saved
        type: 'xlsx',
        size: 0,
        lastModified: new Date(),
        sheets: [
          {
            id: 'sheet1',
            name: 'Sheet1',
            index: 0,
            rowCount: 1000,
            columnCount: 26,
            hasData: false
          }
        ],
        isActive: false
      };

      this.openFiles.set(newFile.id, newFile);
      this.setActiveFile(newFile.id);

      // Create the file via automation service
      const createTask: ExcelTask = {
        id: `create_file_${Date.now()}`,
        type: 'create_workbook',
        description: `Create new Excel workbook: ${name}`,
        complexity: 'simple',
        estimatedActions: 2,
        parameters: { fileName: name },
        mode: 'background',
        priority: 1,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'create_workbook',
            description: 'Create new Excel workbook',
            parameters: { fileName: name },
            order: 1,
            estimatedTime: 5
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 5
        }
      };

      await automationService.executeTask(createTask);

      return {
        success: true,
        message: `Created new workbook: ${name}`,
        file: newFile
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to create new Excel file',
        error: error.message
      };
    }
  }

  async saveFile(fileId: string, newPath?: string): Promise<FileOperationResult> {
    try {
      const file = this.openFiles.get(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File ID not found in open files'
        };
      }

      const savePath = newPath || file.path;
      if (!savePath) {
        return {
          success: false,
          message: 'No save path specified',
          error: 'File has no path and no new path provided'
        };
      }

      // Create save task
      const saveTask: ExcelTask = {
        id: `save_file_${Date.now()}`,
        type: 'save_workbook',
        description: `Save Excel file to: ${savePath}`,
        complexity: 'simple',
        estimatedActions: 1,
        parameters: { filePath: savePath },
        mode: 'background',
        priority: 1,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'save_workbook',
            description: 'Save Excel workbook',
            parameters: { filePath: savePath },
            order: 1,
            estimatedTime: 3
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 3
        }
      };

      await automationService.executeTask(saveTask);

      // Update file info
      const updatedFile = {
        ...file,
        path: savePath,
        lastModified: new Date()
      };
      this.openFiles.set(fileId, updatedFile);

      return {
        success: true,
        message: `Saved ${file.name} to ${savePath}`,
        file: updatedFile
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to save Excel file',
        error: error.message
      };
    }
  }

  async closeFile(fileId: string): Promise<FileOperationResult> {
    try {
      const file = this.openFiles.get(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File ID not found in open files'
        };
      }

      this.openFiles.delete(fileId);

      // If this was the active file, switch to another or clear active
      if (this.activeFileId === fileId) {
        const remainingFiles = Array.from(this.openFiles.keys());
        this.activeFileId = remainingFiles.length > 0 ? remainingFiles[0] : null;
        if (this.activeFileId) {
          this.setActiveFile(this.activeFileId);
        }
      }

      return {
        success: true,
        message: `Closed ${file.name}`
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to close Excel file',
        error: error.message
      };
    }
  }

  // File Selection and Navigation
  setActiveFile(fileId: string): boolean {
    const file = this.openFiles.get(fileId);
    if (!file) return false;

    // Deactivate current active file
    if (this.activeFileId && this.openFiles.has(this.activeFileId)) {
      const currentFile = this.openFiles.get(this.activeFileId)!;
      this.openFiles.set(this.activeFileId, { ...currentFile, isActive: false });
    }

    // Activate new file
    this.activeFileId = fileId;
    this.openFiles.set(fileId, { ...file, isActive: true });
    
    return true;
  }

  getActiveFile(): ExcelFile | null {
    if (!this.activeFileId) return null;
    return this.openFiles.get(this.activeFileId) || null;
  }

  getOpenFiles(): ExcelFile[] {
    return Array.from(this.openFiles.values());
  }

  // Sheet Operations
  async addSheet(fileId: string, sheetName: string): Promise<FileOperationResult> {
    try {
      const file = this.openFiles.get(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File ID not found in open files'
        };
      }

      const newSheet: ExcelSheet = {
        id: `sheet_${Date.now()}`,
        name: sheetName,
        index: file.sheets.length,
        rowCount: 1000,
        columnCount: 26,
        hasData: false
      };

      const updatedFile = {
        ...file,
        sheets: [...file.sheets, newSheet]
      };
      this.openFiles.set(fileId, updatedFile);

      // Create automation task
      const addSheetTask: ExcelTask = {
        id: `add_sheet_${Date.now()}`,
        type: 'add_sheet',
        description: `Add sheet "${sheetName}" to ${file.name}`,
        complexity: 'simple',
        estimatedActions: 1,
        parameters: { sheetName, fileId },
        mode: 'background',
        priority: 1,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'add_sheet',
            description: 'Add new sheet',
            parameters: { sheetName },
            order: 1,
            estimatedTime: 3
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 3
        }
      };

      await automationService.executeTask(addSheetTask);

      return {
        success: true,
        message: `Added sheet "${sheetName}" to ${file.name}`,
        file: updatedFile
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to add sheet',
        error: error.message
      };
    }
  }

  // Range Operations
  async selectRange(fileId: string, range: ExcelRange): Promise<FileOperationResult> {
    try {
      const file = this.openFiles.get(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File ID not found in open files'
        };
      }

      // Create automation task to select range
      const selectTask: ExcelTask = {
        id: `select_range_${Date.now()}`,
        type: 'select_range',
        description: `Select range ${this.formatRange(range)} in ${file.name}`,
        complexity: 'simple',
        estimatedActions: 1,
        parameters: { range, fileId },
        mode: 'visual',
        priority: 1,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'select_range',
            description: 'Select Excel range',
            parameters: { range: this.formatRange(range) },
            order: 1,
            estimatedTime: 2
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 2
        }
      };

      await automationService.executeTask(selectTask);

      return {
        success: true,
        message: `Selected range ${this.formatRange(range)}`
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to select range',
        error: error.message
      };
    }
  }

  // Helper Methods
  private async getFileInfo(filePath: string): Promise<{ size: number; lastModified: Date }> {
    // In a real implementation, this would use file system APIs
    // For now, return mock data
    return {
      size: Math.floor(Math.random() * 1000000),
      lastModified: new Date()
    };
  }

  private async getFileSheets(filePath: string): Promise<ExcelSheet[]> {
    // In a real implementation, this would parse the Excel file
    // For now, return default sheets
    return [
      {
        id: 'sheet1',
        name: 'Sheet1',
        index: 0,
        rowCount: 1000,
        columnCount: 26,
        hasData: true
      }
    ];
  }

  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || 'Unknown';
  }

  private getFileType(filePath: string): 'xlsx' | 'xls' | 'csv' {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === 'xlsx') return 'xlsx';
    if (extension === 'xls') return 'xls';
    if (extension === 'csv') return 'csv';
    return 'xlsx';
  }

  private formatRange(range: ExcelRange): string {
    const startCol = this.columnNumberToLetter(range.startColumn);
    const endCol = this.columnNumberToLetter(range.endColumn);
    return `${range.sheetName}!${startCol}${range.startRow}:${endCol}${range.endRow}`;
  }

  private columnNumberToLetter(colNum: number): string {
    let result = '';
    while (colNum > 0) {
      colNum--;
      result = String.fromCharCode(65 + (colNum % 26)) + result;
      colNum = Math.floor(colNum / 26);
    }
    return result;
  }

  // Quick Actions
  async openRecentFile(): Promise<FileOperationResult> {
    // In a real implementation, this would load from recent files list
    const recentFiles = [
      'C:/Users/user/Documents/Budget_2024.xlsx',
      'C:/Users/user/Documents/Sales_Report.xlsx',
      'C:/Users/user/Documents/Inventory.xlsx'
    ];

    const randomFile = recentFiles[Math.floor(Math.random() * recentFiles.length)];
    return this.openFile(randomFile);
  }

  async importCSV(csvPath: string, targetFileId?: string): Promise<FileOperationResult> {
    try {
      let targetFile: ExcelFile;
      
      if (targetFileId) {
        const file = this.openFiles.get(targetFileId);
        if (!file) {
          return {
            success: false,
            message: 'Target file not found',
            error: 'Target file ID not found in open files'
          };
        }
        targetFile = file;
      } else {
        // Create new workbook for CSV import
        const result = await this.createNewFile('Imported_Data.xlsx');
        if (!result.success || !result.file) {
          return result;
        }
        targetFile = result.file;
      }

      // Create import task
      const importTask: ExcelTask = {
        id: `import_csv_${Date.now()}`,
        type: 'import_data',
        description: `Import CSV data from ${csvPath}`,
        complexity: 'complex',
        estimatedActions: 10,
        parameters: { csvPath, targetFileId: targetFile.id },
        mode: 'background',
        priority: 2,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'read_file',
            description: 'Read CSV file',
            parameters: { filePath: csvPath },
            order: 1,
            estimatedTime: 5
          },
          {
            id: '2',
            action: 'parse_data',
            description: 'Parse CSV data',
            parameters: {},
            order: 2,
            estimatedTime: 8
          },
          {
            id: '3',
            action: 'insert_data',
            description: 'Insert data into Excel',
            parameters: { targetFile: targetFile.name },
            order: 3,
            estimatedTime: 7
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 20
        }
      };

      await automationService.executeTask(importTask);

      return {
        success: true,
        message: `Importing CSV data to ${targetFile.name}`,
        file: targetFile
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to import CSV',
        error: error.message
      };
    }
  }

  // Status and Info
  getFileStats(): { openFiles: number; activeFile: string | null; totalSheets: number } {
    const files = this.getOpenFiles();
    const totalSheets = files.reduce((sum, file) => sum + file.sheets.length, 0);
    const activeFile = this.getActiveFile();

    return {
      openFiles: files.length,
      activeFile: activeFile?.name || null,
      totalSheets
    };
  }

  // Cleanup
  closeAllFiles(): void {
    this.openFiles.clear();
    this.activeFileId = null;
  }
}

export const excelFileHandler = new ExcelFileHandler();