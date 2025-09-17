import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import ExcelJS from 'exceljs';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

// DeepSeek client no longer needed since we use the locked LLM service

// OpenAI client for vision processing (DeepSeek doesn't support vision)
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

  // Helper method to create financial summary from structured data
  private createFinancialSummary(structuredData: any): string {
    let summary = '';

    if (structuredData.accounts?.length > 0) {
      summary += `Accounts found: ${structuredData.accounts.length}\n`;
      structuredData.accounts.forEach((account: any) => {
        summary += `- ${account.name}: ${account.amount} (${account.type})\n`;
      });
    }

    if (structuredData.totals?.length > 0) {
      summary += `\nTotals:\n`;
      structuredData.totals.forEach((total: any) => {
        summary += `- ${total.label}: ${total.amount}\n`;
      });
    }

    if (structuredData.metadata) {
      summary += `\nDocument info: ${JSON.stringify(structuredData.metadata, null, 2)}`;
    }

    return summary.trim();
  }

  // Process image with GPT-4 Vision (extraction only)
  async processImage(filePathOrBuffer: string | Buffer, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing image: ${originalName}`);

      // Read and optimize image - handle both file path and buffer
      const imageBuffer = await sharp(filePathOrBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Convert to base64
      const base64Image = imageBuffer.toString('base64');

      // Call OpenAI Vision API for data extraction only
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and extract the content appropriately based on what type of document it is:

                **For TEXT QUESTIONS/PROBLEMS** (like homework, exam questions, text-based accounting problems):
                - Extract the EXACT text as written, preserving all numbers and formatting
                - Return the complete question/text exactly as shown

                **For FINANCIAL DOCUMENTS** (like ledgers, bank statements, receipts, invoices):
                - Extract structured financial data with proper labeling
                - Include account names, amounts, dates, and categories
                - Organize the data clearly for accounting analysis

                Return your response as a JSON object in this format:
                {
                  "documentType": "text_question|financial_document|receipt|statement|ledger|other",
                  "extractedText": "exact text for text questions, or structured data for documents",
                  "structuredData": {
                    "accounts": [{"name": "account name", "amount": 000, "type": "debit/credit"}],
                    "totals": [{"label": "description", "amount": 000}],
                    "dates": ["any dates found"],
                    "metadata": {"bank": "name", "period": "timeframe", "currency": "USD"}
                  }
                }

                CRITICAL: For text questions, preserve exact wording. For documents, extract structured data properly. Always respond with valid JSON.`
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
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const extractedContent = response.choices[0]?.message?.content || '{}';

      // DEBUG: Log the raw response to understand what GPT-4 is returning
      logger.info(`🔍 RAW GPT-4 RESPONSE for ${originalName}:`, extractedContent);
      console.log(`🔍 CONSOLE DEBUG - GPT-4 RAW RESPONSE for ${originalName}:`, extractedContent);
      console.log(`🔍 CONSOLE DEBUG - Response type:`, typeof extractedContent);
      console.log(`🔍 CONSOLE DEBUG - Response length:`, extractedContent ? extractedContent.length : 'null/undefined');

      // Parse the JSON response
      let extractedData;
      try {
        extractedData = JSON.parse(extractedContent);
        logger.info(`✅ GPT-4 extracted data from ${originalName}:`, JSON.stringify(extractedData, null, 2));

        // Check if the extraction is empty or invalid
        if (!extractedData || Object.keys(extractedData).length === 0) {
          logger.warn(`⚠️ GPT-4 returned empty data for ${originalName}. Raw response:`, extractedContent);
        }
      } catch (e) {
        logger.warn(`❌ Failed to parse JSON from image ${originalName}:`, e);
        logger.warn(`Raw GPT-4 response:`, extractedContent);
        extractedData = {
          error: 'Failed to parse extracted data',
          rawText: extractedContent
        };
      }

      logger.info(`Image extracted successfully: ${originalName}`);

      // Handle different document types appropriately
      let content: string;
      let processedExtractedData: any;

      if (extractedData?.documentType === 'text_question') {
        // For text questions, use the exact text
        content = extractedData.extractedText || 'Unable to extract text from image';
        processedExtractedData = {
          type: 'text_question',
          extractedText: content
        };
      } else {
        // For financial documents, create structured summary
        if (extractedData?.structuredData) {
          content = `Financial document analysis from ${originalName}`;
          processedExtractedData = {
            type: extractedData.documentType || 'financial_document',
            extractedText: extractedData.extractedText,
            structuredData: extractedData.structuredData,
            summary: this.createFinancialSummary(extractedData.structuredData)
          };
        } else {
          // Fallback for any extraction format
          content = extractedData?.extractedText || extractedData?.text || 'Unable to extract text from image';
          processedExtractedData = {
            type: 'unknown',
            extractedText: content
          };
        }
      }

      return {
        originalName,
        type: 'image',
        content: content,
        extractedData: processedExtractedData
      };

    } catch (error) {
      logger.error(`Error processing image ${originalName}:`, error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  // Process PDF
  async processPDF(filePathOrBuffer: string | Buffer, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing PDF: ${originalName}`);

      // Handle both file path and buffer
      const dataBuffer = typeof filePathOrBuffer === 'string'
        ? await fs.readFile(filePathOrBuffer)
        : filePathOrBuffer;
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
  async processSpreadsheet(filePathOrBuffer: string | Buffer, originalName: string): Promise<ProcessedFile> {
    try {
      logger.info(`Processing spreadsheet: ${originalName}`);

      const extension = path.extname(originalName).toLowerCase();
      let extractedData;
      let content: string;

      if (extension === '.csv') {
        // Handle CSV files
        const csvContent = typeof filePathOrBuffer === 'string'
          ? await fs.readFile(filePathOrBuffer, 'utf-8')
          : filePathOrBuffer.toString('utf-8');
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
        if (typeof filePathOrBuffer === 'string') {
          await workbook.xlsx.readFile(filePathOrBuffer);
        } else {
          await workbook.xlsx.load(filePathOrBuffer as any);
        }
        
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

        // Use file.buffer for memory storage, file.path for disk storage
        const fileData = file.buffer || file.path;
        if (!fileData) {
          throw new Error(`No file data available for ${file.originalname}`);
        }

        if (isImage(file.originalname)) {
          processedFile = await this.processImage(fileData, file.originalname);
        } else if (isPDF(file.originalname)) {
          processedFile = await this.processPDF(fileData, file.originalname);
        } else if (isSpreadsheet(file.originalname)) {
          processedFile = await this.processSpreadsheet(fileData, file.originalname);
        } else {
          throw new Error(`Unsupported file type: ${file.originalname}`);
        }

        processedFiles.push(processedFile);

        // Clean up uploaded file (only if using disk storage)
        if (file.path) {
          await fs.unlink(file.path).catch(err =>
            logger.warn(`Failed to delete temp file ${file.path}:`, err)
          );
        }
      }

      return processedFiles;

    } catch (error) {
      // Clean up all uploaded files on error (only if using disk storage)
      for (const file of files) {
        if (file.path) {
          await fs.unlink(file.path).catch(err =>
            logger.warn(`Failed to delete temp file ${file.path}:`, err)
          );
        }
      }
      throw error;
    }
  }

  // Generate enhanced prompt with structured file content for DeepSeek analysis
  generateEnhancedPrompt(userMessage: string, processedFiles: ProcessedFile[]): string {
    let enhancedPrompt = userMessage;

    if (processedFiles.length > 0) {
      enhancedPrompt += '\n\n--- FINANCIAL DATA FROM UPLOADED FILES ---\n';

      for (const file of processedFiles) {
        switch (file.type) {
          case 'image':
            if (file.extractedData?.type === 'text_question') {
              // For text questions, add the exact text without any wrapper
              enhancedPrompt += `${file.extractedData.extractedText}\n`;
            } else if (file.extractedData?.structuredData) {
              // For financial documents, add structured context
              enhancedPrompt += `FINANCIAL DOCUMENT [${file.originalName}]:\n`;
              enhancedPrompt += `${file.extractedData.summary}\n`;
              if (file.extractedData.extractedText) {
                enhancedPrompt += `Raw text: ${file.extractedData.extractedText}\n`;
              }
            } else if (file.extractedData?.extractedText) {
              // Fallback - use extracted text with minimal context
              enhancedPrompt += `[${file.originalName}]: ${file.extractedData.extractedText}\n`;
            } else if (file.content) {
              enhancedPrompt += `${file.content}\n`;
            } else {
              enhancedPrompt += `IMAGE PROCESSING ERROR: Unable to extract text from image\n`;
            }
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

      enhancedPrompt += '\n--- END FINANCIAL DATA ---\n\n';
      enhancedPrompt += 'Using the structured financial data above, perform complete accounting analysis including ledger entries, account classifications, and professional Excel outputs as requested.';
    }

    return enhancedPrompt;
  }

  // Simple method to get enhanced prompt for external processing
  // File processing should only handle file extraction, not LLM analysis
  async getEnhancedPromptForProcessing(userMessage: string, processedFiles: ProcessedFile[]): Promise<string> {
    return this.generateEnhancedPrompt(userMessage, processedFiles);
  }
}

export default FileProcessingService;