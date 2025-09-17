import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';
import FileProcessingService from '../services/fileProcessingService';
import { AuthenticatedRequest } from '../middleware/auth';

// Enhanced conversation memory storage with file/image context
interface UploadedDocument {
  id: string;
  filename: string;
  type: string; // 'image', 'pdf', 'excel', etc.
  extractedData: any; // Vision API data for images, parsed data for documents
  uploadedAt: string;
}

interface ExtractedTotals {
  documentId: string;
  totals: Array<{
    label: string;
    value: number;
    currency?: string;
    category?: string;
  }>;
}

interface EnhancedConversationHistory {
  messages: any[];
  lastExcelStructure: any;
  uploadedDocuments: UploadedDocument[];
  extractedTotals: ExtractedTotals[];
}

// Helper function to generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to generate unique document IDs
function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced context builder with file/image context
function buildContextFromHistory(history: EnhancedConversationHistory): string {
  if (!history || (history.messages.length === 0 && history.uploadedDocuments.length === 0)) {
    return '';
  }

  const lastExcelStructure = history.lastExcelStructure;
  const recentMessages = history.messages.slice(-3); // Last 3 exchanges for context
  const recentDocuments = history.uploadedDocuments.slice(-5); // Last 5 uploaded documents

  let context = '\n**CONVERSATION CONTEXT:**\n';

  // Previous Excel work context
  if (lastExcelStructure) {
    context += `PREVIOUS EXCEL WORK:
- Last created: ${lastExcelStructure.meta?.mode || 'Financial document'}
- Worksheets: ${lastExcelStructure.workbook?.map((w: any) => w.name).join(', ') || 'Unknown'}
- Type: ${lastExcelStructure.meta?.framework || 'Financial analysis'}
- Currency: ${lastExcelStructure.meta?.currency || 'USD'}

`;
  }

  // Uploaded documents context
  if (recentDocuments.length > 0) {
    context += 'PREVIOUSLY UPLOADED DOCUMENTS:\n';
    recentDocuments.forEach((doc, index) => {
      context += `${index + 1}. ${doc.filename} (${doc.type}) - uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}\n`;

      // Add extracted data summary
      if (doc.extractedData) {
        if (doc.type === 'image' && doc.extractedData.description) {
          context += `   Vision Analysis: ${doc.extractedData.description.substring(0, 150)}${doc.extractedData.description.length > 150 ? '...' : ''}\n`;
        }
        if (doc.extractedData.totals && doc.extractedData.totals.length > 0) {
          context += `   Key Values: ${doc.extractedData.totals.map((t: any) => `${t.label}: ${t.value}`).join(', ')}\n`;
        }
      }
    });
    context += '\n';
  }

  // Recent conversation context
  if (recentMessages.length > 0) {
    context += 'RECENT CONVERSATION:\n';
    recentMessages.forEach((msg: any, index: number) => {
      context += `${index + 1}. User: ${msg.userMessage.substring(0, 100)}${msg.userMessage.length > 100 ? '...' : ''}\n`;
      context += `   Response: ${msg.gptResponse.substring(0, 100)}${msg.gptResponse.length > 100 ? '...' : ''}\n`;
      if (msg.filesUploaded && msg.filesUploaded > 0) {
        context += `   Files: ${msg.filesUploaded} file(s) uploaded\n`;
      }
      context += '\n';
    });
  }

  context += `When users reference "previous work", "that document", "the image I uploaded", "change the value", "update that", or similar phrases, they refer to the context above. Use this information to understand their requests.\n\n`;

  return context;
}

// Enhanced context detection including document references
function needsContext(message: string): boolean {
  const contextCommands = [
    /change .* to/i,
    /update the/i,
    /correct that/i,
    /add another/i,
    /remove the/i,
    /show me .* instead/i,
    /modify .*/i,
    /adjust .*/i,
    /fix .*/i,
    /(that|this|previous|last) (document|file|excel|sheet|workbook|image|pdf)/i,
    /from (before|earlier|previous)/i,
    /(the|that) (image|picture|photo|screenshot) (I|you) uploaded/i,
    /(the|that) (file|document) (I|you) (uploaded|attached|sent)/i,
    /in the (previous|last|uploaded) (document|file|image)/i,
    /based on (the|that) (image|document|file)/i,
    /from the (uploaded|attached) (file|document|image)/i,
    /(use|reference|check) (the|that) (previous|uploaded) (data|information|document)/i
  ];

  return contextCommands.some(pattern => pattern.test(message));
}

// Document reference detection for contextual processing
function detectDocumentReferences(message: string): Array<{ type: string; reference: string }> {
  const references: Array<{ type: string; reference: string }> = [];

  const patterns = [
    { regex: /(the|that) (image|picture|photo|screenshot)/i, type: 'image' },
    { regex: /(the|that) (pdf|document)/i, type: 'document' },
    { regex: /(the|that) (excel|spreadsheet)/i, type: 'excel' },
    { regex: /uploaded (file|document|image)/i, type: 'uploaded_file' },
    { regex: /previous (document|file|work)/i, type: 'previous_work' }
  ];

  patterns.forEach(pattern => {
    const match = message.match(pattern.regex);
    if (match) {
      references.push({
        type: pattern.type,
        reference: match[0]
      });
    }
  });

  return references;
}

// Format conversation history for GPT messages
function formatHistoryForGPT(messages: any[]): any[] {
  const formatted: any[] = [];
  messages.forEach(msg => {
    // Ensure content fields exist and are non-empty
    if (msg.userMessage && typeof msg.userMessage === 'string' && msg.userMessage.trim()) {
      formatted.push({ role: 'user', content: msg.userMessage });
    }
    if (msg.gptResponse && typeof msg.gptResponse === 'string' && msg.gptResponse.trim()) {
      formatted.push({ role: 'assistant', content: msg.gptResponse });
    }
  });
  return formatted;
}

// Import services - clean architecture
const FinancialIntelligenceService = require('../services/financialIntelligence');
const DynamicExcelGenerator = require('../services/dynamicExcelGenerator');
const OpenAI = require('openai');

// Initialize services with clean dependencies
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator(financialIntelligence);
const fileProcessingService = new FileProcessingService();

// Single OpenAI client for vision API (when needed)
const openaiVision = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Use OpenAI for vision, not DeepSeek
});

// OpenAI Vision API integration for image data extraction
async function extractImageData(file: Express.Multer.File): Promise<any> {
  try {
    let base64Image: string;
    let mimeType = file.mimetype;

    // Handle both buffer and file path scenarios
    if (file.buffer) {
      // Memory storage - convert buffer to base64
      base64Image = file.buffer.toString('base64');
    } else if (file.path) {
      // Disk storage - read file and convert to base64
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(file.path);
      base64Image = fileBuffer.toString('base64');
    } else {
      throw new Error('No file buffer or path available');
    }

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await openaiVision.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and extract any financial data, totals, values, or important information. Focus on:

1. Any numerical values, amounts, totals, or calculations
2. Financial terms, account names, or categories
3. Dates, periods, or timeframes
4. Table data, charts, or structured information
5. Key insights or patterns

Return the analysis in this JSON format:
{
  "description": "Brief description of what the image contains",
  "totals": [
    {
      "label": "descriptive name",
      "value": numerical_value,
      "currency": "USD" (if applicable),
      "category": "type of data"
    }
  ],
  "insights": ["key insight 1", "key insight 2"],
  "hasFinancialData": true/false
}`
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content!);
    } catch (parseError) {
      // If JSON parsing fails, return structured data anyway
      return {
        description: content,
        totals: [],
        insights: [],
        hasFinancialData: false,
        rawResponse: content
      };
    }
  } catch (error) {
    console.error('Vision API error:', error);
    throw new Error('Failed to analyze image: ' + error.message);
  }
}

// Enhanced file context builder for chat processing
function buildFileContextForChat(uploadedDocuments: UploadedDocument[], currentFiles?: Express.Multer.File[]): string {
  let fileContext = '';

  // Add context from previously uploaded documents
  if (uploadedDocuments.length > 0) {
    fileContext += '\n**UPLOADED DOCUMENT CONTEXT:**\n';
    uploadedDocuments.forEach((doc, index) => {
      fileContext += `Document ${index + 1}: ${doc.filename} (${doc.type})\n`;

      if (doc.extractedData) {
        if (doc.extractedData.description) {
          fileContext += `  Content: ${doc.extractedData.description}\n`;
        }
        if (doc.extractedData.totals && doc.extractedData.totals.length > 0) {
          fileContext += `  Key Values: ${doc.extractedData.totals.map((t: any) => `${t.label}: ${t.value}${t.currency ? ' ' + t.currency : ''}`).join(', ')}\n`;
        }
        if (doc.extractedData.insights && doc.extractedData.insights.length > 0) {
          fileContext += `  Insights: ${doc.extractedData.insights.join('; ')}\n`;
        }
      }
      fileContext += '\n';
    });
  }

  // Add context about currently uploaded files
  if (currentFiles && currentFiles.length > 0) {
    fileContext += '**CURRENT FILE UPLOADS:**\n';
    currentFiles.forEach((file, index) => {
      fileContext += `File ${index + 1}: ${file.originalname} (${file.mimetype}, ${(file.size / 1024).toFixed(1)}KB)\n`;
    });
    fileContext += '\n';
  }

  if (fileContext) {
    fileContext += `You can reference these uploaded documents in your analysis and responses. When users say "that document", "the image I uploaded", or similar references, they mean these files.\n\n`;
  }

  return fileContext;
}

// Process and store uploaded documents with extraction
async function processAndStoreDocuments(files: Express.Multer.File[], userId: string): Promise<UploadedDocument[]> {
  const processedDocs: UploadedDocument[] = [];

  for (const file of files) {
    const docId = generateDocumentId();
    let extractedData: any = null;

    try {
      // Process based on file type
      if (file.mimetype.startsWith('image/')) {
        // Use Vision API for images
        extractedData = await extractImageData(file);
        console.log(`📸 Vision analysis for ${file.originalname}:`, extractedData?.description?.substring(0, 100));
      } else if (file.mimetype === 'application/pdf') {
        // For PDFs, use existing file processing service
        try {
          const processedFiles = await fileProcessingService.processUploadedFiles([file]);
          const pdfData = processedFiles[0];
          extractedData = {
            description: `PDF document processed`,
            content: pdfData?.content?.substring(0, 2000) || 'PDF content extraction failed',
            totals: [],
            hasFinancialData: /\$|USD|total|amount|balance/i.test(pdfData?.content || '')
          };
        } catch (pdfError) {
          extractedData = {
            description: 'PDF processing failed',
            content: 'Unable to extract PDF content',
            totals: [],
            hasFinancialData: false
          };
        }
      } else if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        // For Excel files, use existing processing
        try {
          const processedFiles = await fileProcessingService.processUploadedFiles([file]);
          const excelData = processedFiles[0];
          extractedData = {
            description: `Excel spreadsheet processed`,
            content: excelData?.content || 'Excel processing completed',
            totals: [],
            hasFinancialData: true
          };
        } catch (excelError) {
          extractedData = {
            description: 'Excel processing failed',
            content: 'Unable to extract Excel content',
            totals: [],
            hasFinancialData: false
          };
        }
      }

      const processedDoc: UploadedDocument = {
        id: docId,
        filename: file.originalname,
        type: file.mimetype.startsWith('image/') ? 'image' :
               file.mimetype === 'application/pdf' ? 'pdf' :
               file.mimetype.includes('excel') ? 'excel' : 'document',
        extractedData,
        uploadedAt: new Date().toISOString()
      };

      processedDocs.push(processedDoc);

    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      // Still add the document even if processing failed
      processedDocs.push({
        id: docId,
        filename: file.originalname,
        type: 'document',
        extractedData: { error: 'Processing failed', description: 'File upload received but processing failed' },
        uploadedAt: new Date().toISOString()
      });
    }
  }

  return processedDocs;
}

interface ExcelResult {
  success: boolean;
  filename: string;
  filepath: string;
  structure: string;
  worksheets: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
  }>;
}

// Universal chat endpoint - Rules-First Accounting Engine with Firebase
export const handleUniversalChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('💬 Processing message:', message.substring(0, 100));
    console.log('📏 Full message length:', message.length);

    // Check usage limits
    const subscription = await firebaseService.getSubscriptionByUserId(userId);

    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Get conversation history from Firebase
    const history = await firebaseService.getConversationHistory(userId) || {
      messages: [],
      lastExcelStructure: null,
      uploadedDocuments: [],
      extractedTotals: []
    };
    let enhancedMessage = message;

    // Add context if message needs it or if context exists
    if (needsContext(message) || history.messages.length > 0) {
      const contextString = buildContextFromHistory(history);
      enhancedMessage = contextString + message;
      console.log('📝 Adding conversation context, enhanced message length:', enhancedMessage.length);
    }

    // Call financial intelligence with context-enhanced message
    const result = await financialIntelligence.processFinancialCommand(enhancedMessage);

    // Declare variables
    let excelResult: ExcelResult | null = null;

    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      console.log('📊 Generating Excel with structure:', JSON.stringify(result.structure, null, 2).substring(0, 500));
      excelResult = await excelGenerator.generateWithCompleteFreedom(
        result.structure,
        userId
      );
      console.log('📊 Excel generation result:', excelResult);

      // Update usage if successful
      if (subscription && excelResult?.success) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      // Store conversation in Firebase
      const messageId = generateMessageId();
      const conversationEntry = {
        id: messageId,
        userMessage: message,
        gptResponse: result.chatResponse,
        timestamp: new Date().toISOString(),
        excelGenerated: true,
        excelStructure: result.structure
      };

      // Update conversation history (keep last 10 messages)
      if (!history.messages) history.messages = [];
      history.messages.push(conversationEntry);
      if (history.messages.length > 10) {
        history.messages = history.messages.slice(-10);
      }
      history.lastExcelStructure = result.structure;
      await firebaseService.saveConversationHistory(userId, history);

      // Store chat session for accounting
      await firebaseService.createChatSession({
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message },
          { role: 'assistant', content: result.chatResponse }
        ]),
        tokensUsed: result.tokensUsed
      });

      return res.json({
        success: true,
        type: result.automationExecuted ? 'automation' : 'excel',
        message: result.chatResponse,
        automationExecuted: result.automationExecuted || false,
        functionResults: result.functionResults || [],
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: excelResult?.structure || 'Excel workbook generated',
          worksheets: excelResult?.worksheets || []
        }
      });
    } else {
      // Store conversation in Firebase for chat-only responses
      const messageId = generateMessageId();
      const conversationEntry = {
        id: messageId,
        userMessage: message,
        gptResponse: result.chatResponse,
        timestamp: new Date().toISOString(),
        excelGenerated: false
      };

      // Update conversation history (keep last 10 messages)
      if (!history.messages) history.messages = [];
      history.messages.push(conversationEntry);
      if (history.messages.length > 10) {
        history.messages = history.messages.slice(-10);
      }
      await firebaseService.saveConversationHistory(userId, history);

      // Just chat response, no Excel
      await firebaseService.createChatSession({
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message },
          { role: 'assistant', content: result.chatResponse }
        ]),
        tokensUsed: result.tokensUsed
      });

      return res.json({
        success: true,
        type: result.automationExecuted ? 'automation' : 'chat',
        message: result.chatResponse,
        automationExecuted: result.automationExecuted || false,
        functionResults: result.functionResults || []
      });
    }

  } catch (error: any) {
    logger.error('Chat processing error:', error);

    // Detailed error messages for debugging
    let errorMessage = 'Processing error occurred';
    let statusCode = 500;

    if (error.message?.includes('quota')) {
      errorMessage = 'DeepSeek quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API configuration error.';
      statusCode = 503;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      statusCode = 504;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      type: 'error'
    });
  }
};

// Get chat history from Firebase
export const getChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const sessions = await firebaseService.getChatSessions(userId, 50);

    res.json({
      success: true,
      sessions
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
};

// Delete chat session from Firebase
export const deleteChatSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await firebaseService.deleteChatSession(sessionId, userId);

    res.json({
      success: true,
      message: 'Session deleted'
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
};

// Universal chat endpoint with file uploads - Firebase version
export const handleUniversalChatWithFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Message or files are required'
      });
    }

    console.log('💬 Processing message with files:', message?.substring(0, 100));
    console.log('📎 Files uploaded:', files?.length || 0);

    // Check usage limits
    const subscription = await firebaseService.getSubscriptionByUserId(userId);

    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Get conversation history from Firebase for file uploads
    const history = await firebaseService.getConversationHistory(userId) || {
      messages: [],
      lastExcelStructure: null,
      uploadedDocuments: [],
      extractedTotals: []
    };

    let enhancedMessage = message || '';
    let processedDocuments: UploadedDocument[] = [];

    // Process uploaded files if any with enhanced document processing
    if (files && files.length > 0) {
      try {
        console.log('🔄 Processing uploaded files with enhanced extraction...');

        // Process and extract data from uploaded documents
        processedDocuments = await processAndStoreDocuments(files, userId);

        // Add documents to user's conversation history
        history.uploadedDocuments.push(...processedDocuments);

        // Keep only last 10 documents to prevent memory issues
        if (history.uploadedDocuments.length > 10) {
          history.uploadedDocuments = history.uploadedDocuments.slice(-10);
        }

        // Extract totals for quick reference
        processedDocuments.forEach(doc => {
          if (doc.extractedData?.totals && doc.extractedData.totals.length > 0) {
            history.extractedTotals.push({
              documentId: doc.id,
              totals: doc.extractedData.totals
            });
          }
        });

        // Use enhanced file context builder
        const fileContext = buildFileContextForChat(history.uploadedDocuments, files);

        // Use unified file processing approach
        const processedFiles = await fileProcessingService.processUploadedFiles(files);
        const originalPrompt = await fileProcessingService.getEnhancedPromptForProcessing(message || '', processedFiles);

        // Combine both approaches for maximum context
        enhancedMessage = fileContext + originalPrompt;

        console.log('✅ Enhanced document processing completed:', {
          documentsProcessed: processedDocuments.length,
          visionAnalysis: processedDocuments.filter(d => d.type === 'image').length,
          totalDocuments: history.uploadedDocuments.length,
          enhancedMessageLength: enhancedMessage.length
        });
      } catch (error) {
        console.error('❌ Enhanced file processing error:', error);
        return res.status(400).json({
          success: false,
          error: `Enhanced file processing failed: ${error.message}`,
          type: 'file_error'
        });
      }
    }

    // Add enhanced context including document references
    if (needsContext(enhancedMessage) || history.messages.length > 0 || history.uploadedDocuments.length > 0) {
      const contextString = buildContextFromHistory(history);
      const documentReferences = detectDocumentReferences(enhancedMessage);

      // Add specific document context if references detected
      if (documentReferences.length > 0) {
        console.log('🔍 Document references detected:', documentReferences.map(r => r.reference));
      }

      enhancedMessage = contextString + enhancedMessage;
      console.log('📝 Adding enhanced conversation context:', {
        contextLength: contextString.length,
        documentReferences: documentReferences.length,
        totalMessageLength: enhancedMessage.length
      });
    }

    // Call financial intelligence with enhanced message (includes file content + context)
    const result = await financialIntelligence.processFinancialCommand(enhancedMessage);

    // Declare variables
    let excelResult: ExcelResult | null = null;

    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      console.log('📊 FILE UPLOAD: Generating Excel with structure:', JSON.stringify(result.structure, null, 2).substring(0, 500));
      excelResult = await excelGenerator.generateWithCompleteFreedom(
        result.structure,
        userId
      );
      console.log('📊 FILE UPLOAD: Excel generation result:', excelResult);

      // Update usage if successful
      if (subscription && excelResult?.success) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      // Store enhanced conversation in Firebase for file uploads
      const messageId = generateMessageId();
      const conversationEntry = {
        id: messageId,
        userMessage: message || '[Files uploaded]',
        gptResponse: result.chatResponse,
        timestamp: new Date().toISOString(),
        excelGenerated: true,
        excelStructure: result.structure,
        filesUploaded: files?.length || 0,
        documentsProcessed: processedDocuments.map(d => ({ id: d.id, filename: d.filename, type: d.type })),
        documentReferences: detectDocumentReferences(message || '')
      };

      // Update conversation history (keep last 10 messages)
      if (!history.messages) history.messages = [];
      history.messages.push(conversationEntry);
      if (history.messages.length > 10) {
        history.messages = history.messages.slice(-10);
      }
      history.lastExcelStructure = result.structure;
      await firebaseService.saveConversationHistory(userId, history);

      // Store chat session for accounting
      await firebaseService.createChatSession({
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message || '[Files uploaded]' },
          { role: 'assistant', content: result.chatResponse }
        ]),
        tokensUsed: result.tokensUsed
      });

      return res.json({
        success: true,
        type: result.automationExecuted ? 'automation' : 'excel',
        message: result.chatResponse,
        filesProcessed: files?.length || 0,
        automationExecuted: result.automationExecuted || false,
        functionResults: result.functionResults || [],
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: excelResult?.structure || 'Excel workbook generated',
          worksheets: excelResult?.worksheets || []
        }
      });
    } else {
      // Store enhanced conversation in Firebase for chat-only responses with files
      const messageId = generateMessageId();
      const conversationEntry = {
        id: messageId,
        userMessage: message || '[Files uploaded]',
        gptResponse: result.chatResponse,
        timestamp: new Date().toISOString(),
        excelGenerated: false,
        filesUploaded: files?.length || 0,
        documentsProcessed: processedDocuments.map(d => ({ id: d.id, filename: d.filename, type: d.type })),
        documentReferences: detectDocumentReferences(message || '')
      };

      // Update conversation history (keep last 10 messages)
      if (!history.messages) history.messages = [];
      history.messages.push(conversationEntry);
      if (history.messages.length > 10) {
        history.messages = history.messages.slice(-10);
      }
      await firebaseService.saveConversationHistory(userId, history);

      // Just chat response, no Excel
      await firebaseService.createChatSession({
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message || '[Files uploaded]' },
          { role: 'assistant', content: result.chatResponse }
        ]),
        tokensUsed: result.tokensUsed
      });

      return res.json({
        success: true,
        type: result.automationExecuted ? 'automation' : 'chat',
        message: result.chatResponse,
        filesProcessed: files?.length || 0,
        documentsAnalyzed: processedDocuments.length,
        visionAnalysis: processedDocuments.filter(d => d.type === 'image' && d.extractedData?.description).length,
        automationExecuted: result.automationExecuted || false,
        functionResults: result.functionResults || []
      });
    }

  } catch (error: any) {
    logger.error('Chat with files processing error:', error);

    // Detailed error messages for debugging
    let errorMessage = 'Processing error occurred';
    let statusCode = 500;

    if (error.message?.includes('quota')) {
      errorMessage = 'DeepSeek quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API configuration error.';
      statusCode = 503;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('File size') || error.message?.includes('File type')) {
      errorMessage = error.message;
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      type: 'error'
    });
  }
};

// Clear enhanced conversation memory from Firebase
export const clearConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current history for logging
    const currentHistory = await firebaseService.getConversationHistory(userId);
    const stats = {
      messages: currentHistory?.messages?.length || 0,
      documents: currentHistory?.uploadedDocuments?.length || 0,
      totals: currentHistory?.extractedTotals?.length || 0
    };

    // Clear conversation history from Firebase
    await firebaseService.clearConversationHistory(userId);

    console.log(`🧹 Cleared enhanced conversation history for user ${userId}:`, stats);

    res.json({
      success: true,
      message: 'Conversation history and document context cleared',
      cleared: stats
    });

  } catch (error) {
    console.error('Error clearing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation history'
    });
  }
};

// Get document context for user from Firebase
export const getDocumentContext = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const history = await firebaseService.getConversationHistory(userId);

    if (!history) {
      return res.json({
        success: true,
        documents: [],
        extractedTotals: [],
        message: 'No document context found'
      });
    }

    // Return sanitized document context (without raw buffers)
    const sanitizedDocuments = history.uploadedDocuments.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      type: doc.type,
      uploadedAt: doc.uploadedAt,
      extractedData: {
        description: doc.extractedData?.description,
        totals: doc.extractedData?.totals,
        insights: doc.extractedData?.insights,
        hasFinancialData: doc.extractedData?.hasFinancialData
      }
    }));

    res.json({
      success: true,
      documents: sanitizedDocuments,
      extractedTotals: history.extractedTotals || [],
      totalDocuments: history.uploadedDocuments?.length || 0,
      message: 'Document context retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting document context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document context'
    });
  }
};

// NEW: Smart context chat endpoint - two-stage reasoning
export const handleSmartContextChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🧠 Smart Context Chat:', message.substring(0, 100));

    // Check usage limits
    const subscription = await firebaseService.getSubscriptionByUserId(userId);

    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Use smart context processing (two-stage reasoning)
    const result = await financialIntelligence.processWithSmartContext(message, userId);

    let excelResult: ExcelResult | null = null;

    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      console.log('📊 SMART CONTEXT: Generating Excel with structure:', JSON.stringify(result.structure, null, 2).substring(0, 500));
      excelResult = await excelGenerator.generateWithCompleteFreedom(
        result.structure,
        userId
      );
      console.log('📊 SMART CONTEXT: Excel generation result:', excelResult);

      // Update usage if successful
      if (subscription && excelResult?.success) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      return res.json({
        success: true,
        type: 'excel',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        reasoning: result.reasoning,
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: excelResult?.structure || 'Excel workbook generated',
          worksheets: excelResult?.worksheets || []
        }
      });
    } else {
      // Just chat response
      return res.json({
        success: true,
        type: 'chat',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        reasoning: result.reasoning
      });
    }

  } catch (error: any) {
    logger.error('Smart context chat error:', error);

    let errorMessage = 'Processing error occurred';
    let statusCode = 500;

    if (error.message?.includes('quota')) {
      errorMessage = 'DeepSeek quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API configuration error.';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      type: 'error'
    });
  }
};

// Test endpoint for Nubia verification with Firebase
export const testNubia = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const testMessage = "record june 1 started business with cash 10000";

    // Call the main handler with test data
    req.body = { message: testMessage };

    // Mock user for testing (temporarily)
    req.user = { id: 'test-user-123', email: 'test@nubia.ai' };

    // Process through main handler
    await handleUniversalChat(req, res);

  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
};

export default {
  handleUniversalChat,
  handleUniversalChatWithFiles,
  handleSmartContextChat,
  getChatHistory,
  deleteChatSession,
  clearConversation,
  getDocumentContext,
  testNubia
};