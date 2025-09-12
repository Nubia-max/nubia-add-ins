import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import ExcelJS from 'exceljs';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// File type detection
export const isImage = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  return imageExtensions.includes(path.extname(filename).toLowerCase());
};

export const isPDF = (filename: string): boolean => {
  return path.extname(filename).toLowerCase() === '.pdf';
};

export const isSpreadsheet = (filename: string): boolean => {
  const spreadsheetExtensions = ['.xlsx', '.xls', '.csv'];
  return spreadsheetExtensions.includes(path.extname(filename).toLowerCase());
};

// File size limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
export const MAX_FILES = 5;

// Multer configuration
export const fileUploadConfig = multer({
  dest: 'uploads/',
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  }
});

interface ProcessedFile {
  originalName: string;
  type: 'image' | 'pdf' | 'spreadsheet';
  content: string;
  extractedData?: any;
}

export class FileProcessingService {
  
  // Process image with GPT-4 Vision
  async processImage(filePath: string, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing image: ${originalName}`);
      
      // Read and optimize image
      const imageBuffer = await sharp(filePath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Convert to base64
      const base64Image = imageBuffer.toString('base64');

      // Call GPT-4 Vision API
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-2024-11-20',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this accounting document (receipt, invoice, bank statement, etc.) and extract all financial information in a structured format. Include:
                - Transaction amounts and currencies
                - Dates
                - Vendor/customer names
                - Item descriptions
                - Categories (expense/income type)
                - Account classifications
                - Any other relevant accounting data
                
                Format the response as structured JSON with clear fields for easy processing.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const extractedContent = response.choices[0]?.message?.content || 'No content extracted';
      
      // Try to parse as JSON for structured data
      let extractedData;
      try {
        extractedData = JSON.parse(extractedContent);
      } catch (e) {
        // If not JSON, use as text
        extractedData = { rawText: extractedContent };
      }

      logger.info(`Image processed successfully: ${originalName}`);
      
      return {
        originalName,
        type: 'image',
        content: extractedContent,
        extractedData
      };
      
    } catch (error) {
      logger.error(`Error processing image ${originalName}:`, error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  // Process PDF
  async processPDF(filePath: string, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing PDF: ${originalName}`);
      
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      const extractedText = pdfData.text;
      
      logger.info(`PDF processed successfully: ${originalName}, extracted ${extractedText.length} characters`);
      
      return {
        originalName,
        type: 'pdf',
        content: extractedText,
        extractedData: {
          text: extractedText,
          pages: pdfData.numpages,
          info: pdfData.info
        }
      };
      
    } catch (error) {
      logger.error(`Error processing PDF ${originalName}:`, error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  // Process spreadsheet (Excel/CSV)
  async processSpreadsheet(filePath: string, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing spreadsheet: ${originalName}`);
      
      const extension = path.extname(originalName).toLowerCase();
      let extractedData;
      let content: string;

      if (extension === '.csv') {
        // Handle CSV files
        const csvContent = await fs.readFile(filePath, 'utf-8');
        const rows = csvContent.split('\n').map(row => row.split(','));
        
        extractedData = {
          type: 'csv',
          rows,
          rowCount: rows.length,
          columnCount: rows[0]?.length || 0
        };
        
        content = `CSV file with ${rows.length} rows and ${rows[0]?.length || 0} columns`;
        
      } else {
        // Handle Excel files
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const worksheetsData: any[] = [];
        let totalRows = 0;
        
        workbook.eachSheet((worksheet, sheetId) => {
          const sheetData: any[] = [];
          let rowCount = 0;
          
          worksheet.eachRow((row, rowNumber) => {
            const rowData: any[] = [];
            row.eachCell((cell, colNumber) => {
              rowData.push(cell.value);
            });
            sheetData.push(rowData);
            rowCount++;
          });
          
          worksheetsData.push({
            name: worksheet.name,
            data: sheetData,
            rowCount,
            columnCount: sheetData[0]?.length || 0
          });
          
          totalRows += rowCount;
        });
        
        extractedData = {
          type: 'excel',
          worksheets: worksheetsData,
          totalRows
        };
        
        content = `Excel file with ${worksheetsData.length} worksheet(s) and ${totalRows} total rows`;
      }
      
      logger.info(`Spreadsheet processed successfully: ${originalName}`);
      
      return {
        originalName,
        type: 'spreadsheet',
        content,
        extractedData
      };
      
    } catch (error) {
      logger.error(`Error processing spreadsheet ${originalName}:`, error);
      throw new Error(`Failed to process spreadsheet: ${error.message}`);
    }
  }

  // Main processing function
  async processUploadedFiles(files: Express.Multer.File[]): Promise<ProcessedFile[]> {
    const processedFiles: ProcessedFile[] = [];
    
    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error(`Total file size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit of ${MAX_TOTAL_SIZE / 1024 / 1024}MB`);
    }

    try {
      for (const file of files) {
        let processedFile: ProcessedFile;
        
        if (isImage(file.originalname)) {
          processedFile = await this.processImage(file.path, file.originalname);
        } else if (isPDF(file.originalname)) {
          processedFile = await this.processPDF(file.path, file.originalname);
        } else if (isSpreadsheet(file.originalname)) {
          processedFile = await this.processSpreadsheet(file.path, file.originalname);
        } else {
          throw new Error(`Unsupported file type: ${file.originalname}`);
        }
        
        processedFiles.push(processedFile);
        
        // Clean up uploaded file
        await fs.unlink(file.path).catch(err => 
          logger.warn(`Failed to delete temp file ${file.path}:`, err)
        );
      }
      
      return processedFiles;
      
    } catch (error) {
      // Clean up all uploaded files on error
      for (const file of files) {
        await fs.unlink(file.path).catch(err => 
          logger.warn(`Failed to delete temp file ${file.path}:`, err)
        );
      }
      throw error;
    }
  }

  // Generate enhanced prompt with file content
  generateEnhancedPrompt(userMessage: string, processedFiles: ProcessedFile[]): string {
    let enhancedPrompt = userMessage;
    
    if (processedFiles.length > 0) {
      enhancedPrompt += '\n\n--- UPLOADED FILES ---\n';
      
      for (const file of processedFiles) {
        enhancedPrompt += `\n[FILE: ${file.originalName}]\n`;
        
        switch (file.type) {
          case 'image':
            enhancedPrompt += `IMAGE ANALYSIS: The user has uploaded an image containing the following accounting information:\n${file.content}\n`;
            break;
            
          case 'pdf':
            enhancedPrompt += `PDF CONTENT: The user has uploaded a PDF document containing:\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '...' : ''}\n`;
            break;
            
          case 'spreadsheet':
            enhancedPrompt += `SPREADSHEET DATA: The user has uploaded a spreadsheet (${file.originalName}) with the following structure:\n${file.content}\n`;
            if (file.extractedData?.worksheets) {
              for (const sheet of file.extractedData.worksheets.slice(0, 2)) { // Only show first 2 sheets
                enhancedPrompt += `\nSheet "${sheet.name}" preview (first 5 rows):\n`;
                for (let i = 0; i < Math.min(5, sheet.data.length); i++) {
                  enhancedPrompt += `${sheet.data[i].join(', ')}\n`;
                }
              }
            }
            break;
        }
      }
      
      enhancedPrompt += '\n--- END FILES ---\n\n';
      enhancedPrompt += 'Please process the uploaded file content along with the user\'s message. Extract all accounting information, create appropriate ledger entries, and generate professional Excel outputs as needed.';
    }
    
    return enhancedPrompt;
  }
}

export default FileProcessingService;