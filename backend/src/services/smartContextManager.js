require('dotenv').config();
const OpenAI = require('openai');
const { firebaseService } = require('./firebase');

class SmartContextManager {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 60000
    });
  }

  // STAGE 1: Let DeepSeek think without context first
  async getInitialResponse(message, systemPrompt) {
    console.log('🧠 STAGE 1: DeepSeek thinking WITHOUT context (pure reasoning)');

    const response = await this.client.chat.completions.create({
      model: 'deepseek-reasoner',
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 32000,
      reasoning: true
    });

    return {
      content: response.choices[0].message.content,
      reasoning: response.choices[0].message.reasoning_content,
      tokensUsed: response.usage?.total_tokens || 0
    };
  }

  // STAGE 2: Analyze if context would be helpful
  async analyzeContextRelevance(originalMessage, initialResponse, chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return { relevant: false, reason: 'No history available' };
    }

    console.log('🔍 STAGE 2: Analyzing context relevance...');

    // Smart context relevance detection
    const contextAnalysis = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a context relevance analyzer. Your job is to determine if chat history would be helpful for answering the user's current question.

ANALYZE:
1. Does the current question reference previous work ("that document", "the previous file", "change that", "update it")?
2. Would knowing about previous financial documents/calculations help understand the current request?
3. Is this a continuation of a previous conversation topic?

Return JSON: { "relevant": boolean, "reason": "explanation", "confidence": 0-1 }`
        },
        {
          role: 'user',
          content: `CURRENT MESSAGE: "${originalMessage}"

INITIAL RESPONSE: "${initialResponse.substring(0, 500)}"

RECENT HISTORY: ${this.formatHistoryForAnalysis(chatHistory)}

Is the history relevant for improving this response?`
        }
      ],
      max_tokens: 200
    });

    try {
      const analysis = JSON.parse(contextAnalysis.choices[0].message.content);
      console.log('📊 Context Analysis:', analysis);
      return analysis;
    } catch (error) {
      console.log('⚠️ Context analysis failed, assuming not relevant');
      return { relevant: false, reason: 'Analysis failed', confidence: 0 };
    }
  }

  // STAGE 3: Enhance with relevant context if helpful
  async enhanceWithContext(originalMessage, initialResponse, chatHistory, relevanceAnalysis) {
    if (!relevanceAnalysis.relevant || relevanceAnalysis.confidence < 0.7) {
      console.log('✅ Using initial response (context not helpful)');
      return initialResponse;
    }

    console.log('🔄 STAGE 3: Enhancing with relevant context...');

    const contextPrompt = this.buildSmartContext(chatHistory);
    const enhancedMessage = `${contextPrompt}\n\nCURRENT REQUEST: ${originalMessage}

INITIAL RESPONSE: ${initialResponse.content}

Please review your initial response and enhance it ONLY if the context provides additional helpful information. If the initial response is already complete and correct, return it unchanged.`;

    const enhancedResponse = await this.client.chat.completions.create({
      model: 'deepseek-reasoner',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are enhancing a response with relevant context. Only improve the response if context adds value. Do not change correct information.`
        },
        {
          role: 'user',
          content: enhancedMessage
        }
      ],
      max_tokens: 32000,
      reasoning: true
    });

    return {
      content: enhancedResponse.choices[0].message.content,
      reasoning: enhancedResponse.choices[0].message.reasoning_content,
      tokensUsed: initialResponse.tokensUsed + (enhancedResponse.usage?.total_tokens || 0),
      enhanced: true
    };
  }

  // Smart context builder - only include relevant parts
  buildSmartContext(chatHistory) {
    const recentMessages = chatHistory.slice(-5); // Last 5 interactions
    let context = '\n**CONVERSATION CONTEXT:**\n';

    recentMessages.forEach((msg, index) => {
      if (msg.userMessage && msg.gptResponse) {
        context += `${index + 1}. User: ${msg.userMessage.substring(0, 150)}\n`;
        context += `   Response: ${msg.gptResponse.substring(0, 150)}\n`;

        if (msg.excelGenerated) {
          context += `   📊 Excel file was generated\n`;
        }
        context += '\n';
      }
    });

    return context;
  }

  formatHistoryForAnalysis(chatHistory) {
    return chatHistory.slice(-3).map((msg, i) =>
      `${i + 1}. User: "${msg.userMessage?.substring(0, 100)}" | Response: "${msg.gptResponse?.substring(0, 100)}"`
    ).join('\n');
  }

  // Save complete interaction to Firebase
  async saveInteractionToFirebase(userId, interaction) {
    try {
      await firebaseService.createChatSession({
        userId,
        messages: JSON.stringify([
          { role: 'user', content: interaction.userMessage },
          { role: 'assistant', content: interaction.finalResponse }
        ]),
        tokensUsed: interaction.tokensUsed,
        enhanced: interaction.enhanced || false,
        contextUsed: interaction.contextUsed || false
      });

      console.log('💾 Interaction saved to Firebase');
    } catch (error) {
      console.error('❌ Failed to save to Firebase:', error);
    }
  }

  // Main orchestrator for file uploads with smart context
  async processWithSmartContextAndFiles(message, systemPrompt, userId, files = [], fileProcessingService = null) {
    try {
      // Get recent chat history from Firebase
      const chatHistory = await this.getRecentHistory(userId);

      // Process files first if they exist
      let enhancedMessage = message;
      let fileData = [];

      if (files && files.length > 0 && fileProcessingService) {
        console.log(`🖼️ SMART CONTEXT: Processing ${files.length} files with two-stage reasoning`);

        try {
          // Process all files (GPT-4 extraction for images)
          const processedFiles = await fileProcessingService.processUploadedFiles(files);
          console.log('🔍 SMART CONTEXT DEBUG - Processed files:', JSON.stringify(processedFiles, null, 2));

          const enhancedPrompt = await fileProcessingService.getEnhancedPromptForProcessing(message, processedFiles);
          console.log('🔍 SMART CONTEXT DEBUG - Enhanced prompt:', enhancedPrompt.substring(0, 500) + '...');

          // CRITICAL CHECK: Ensure GPT-4 actually extracted meaningful data
          const hasValidData = processedFiles && processedFiles.length > 0 &&
            processedFiles.some(file =>
              file.content &&
              file.content.trim() !== '' &&
              file.content !== '{}' &&
              !file.content.includes('"error":')
            );

          if (!hasValidData) {
            console.error('❌ GPT-4 failed to extract meaningful data from files. Falling back to original system.');
            throw new Error('GPT-4 Vision extraction failed - no meaningful data extracted');
          }

          enhancedMessage = enhancedPrompt;
          console.log('✅ GPT-4 extraction successful, using enhanced message');

          // Store file metadata for Firebase saving
          fileData = files.map(f => ({
            name: f.originalname,
            size: f.size,
            type: f.mimetype
          }));

        } catch (fileError) {
          console.error('⚠️ File processing error:', fileError);
          // For file processing errors, throw to fall back to original system
          throw fileError;
        }
      }

      // STAGE 1: Get pure DeepSeek response without context
      const initialResponse = await this.getInitialResponse(enhancedMessage, systemPrompt);

      // STAGE 2: Analyze if context would help
      const relevanceAnalysis = await this.analyzeContextRelevance(
        message, // Use original message for context analysis, not file-enhanced
        initialResponse.content,
        chatHistory
      );

      // STAGE 3: Enhance with context if relevant
      const finalResponse = await this.enhanceWithContext(
        enhancedMessage, // Use file-enhanced message for final processing
        initialResponse,
        chatHistory,
        relevanceAnalysis
      );

      // Save interaction to Firebase including file metadata
      const interaction = {
        userMessage: message,
        finalResponse: finalResponse.content,
        tokensUsed: finalResponse.tokensUsed,
        enhanced: finalResponse.enhanced || false,
        contextUsed: relevanceAnalysis.relevant,
        reasoning: finalResponse.reasoning,
        filesUploaded: fileData
      };

      await this.saveInteractionToFirebase(userId, interaction);

      return {
        success: true,
        chatResponse: finalResponse.content,
        tokensUsed: finalResponse.tokensUsed,
        contextUsed: relevanceAnalysis.relevant,
        enhanced: finalResponse.enhanced || false,
        reasoning: finalResponse.reasoning
      };

    } catch (error) {
      console.error('❌ Smart context with files processing failed:', error);
      throw error;
    }
  }

  // Main orchestrator - the two-stage process
  async processWithSmartContext(message, systemPrompt, userId) {
    try {
      // Get recent chat history from Firebase
      const chatHistory = await this.getRecentHistory(userId);

      // STAGE 1: Get pure DeepSeek response without context
      const initialResponse = await this.getInitialResponse(message, systemPrompt);

      // STAGE 2: Analyze if context would help
      const relevanceAnalysis = await this.analyzeContextRelevance(
        message,
        initialResponse.content,
        chatHistory
      );

      // STAGE 3: Enhance with context if relevant
      const finalResponse = await this.enhanceWithContext(
        message,
        initialResponse,
        chatHistory,
        relevanceAnalysis
      );

      // Save interaction to Firebase
      const interaction = {
        userMessage: message,
        finalResponse: finalResponse.content,
        tokensUsed: finalResponse.tokensUsed,
        enhanced: finalResponse.enhanced || false,
        contextUsed: relevanceAnalysis.relevant,
        reasoning: finalResponse.reasoning
      };

      await this.saveInteractionToFirebase(userId, interaction);

      return {
        success: true,
        chatResponse: finalResponse.content,
        tokensUsed: finalResponse.tokensUsed,
        contextUsed: relevanceAnalysis.relevant,
        enhanced: finalResponse.enhanced || false,
        reasoning: finalResponse.reasoning
      };

    } catch (error) {
      console.error('❌ Smart context processing failed:', error);
      throw error;
    }
  }

  // Get recent history from Firebase
  async getRecentHistory(userId, limit = 10) {
    try {
      const sessions = await firebaseService.getChatSessions(userId, limit);
      return sessions.map(session => ({
        userMessage: JSON.parse(session.messages)[0]?.content,
        gptResponse: JSON.parse(session.messages)[1]?.content,
        timestamp: session.createdAt,
        excelGenerated: session.excelGenerated || false
      }));
    } catch (error) {
      console.error('⚠️ Failed to get chat history:', error);
      return [];
    }
  }
}

module.exports = SmartContextManager;