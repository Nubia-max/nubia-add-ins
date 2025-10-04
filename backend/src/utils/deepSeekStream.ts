/**
 * DeepSeek AI Streaming Service
 * Handles real-time AI responses for Excel operations
 */

import { logger } from './logger';
import { ENV } from '../config/environment';

interface StreamOptions {
  userId: string;
  message: string;
  excelContext: any;
  history: any[];
  onToken: (token: string) => void;
  onProgress: (status: string, progress: number) => void;
  onComplete: (summary: any) => void;
}

/**
 * Stream AI response using DeepSeek API
 */
export async function deepSeekStream(options: StreamOptions): Promise<void> {
  const { userId, message, excelContext, history, onToken, onProgress, onComplete } = options;

  try {
    logger.info(`Starting DeepSeek stream for user ${userId}`);
    onProgress('Connecting to AI...', 20);

    // Build AI prompt with Excel context
    const prompt = buildExcelPrompt(message, excelContext, history);

    // Make streaming request to DeepSeek
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-coder',
        messages: prompt,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    onProgress('AI thinking...', 40);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalTokens = 0;
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            // Stream complete
            onComplete({
              tokensUsed: totalTokens,
              creditsUsed: Math.ceil(totalTokens / 100),
              remainingCredits: 0, // Will be calculated by credit system
              code: extractCode(accumulatedContent),
              understanding: accumulatedContent,
              confidence: 0.85
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;

            if (delta) {
              totalTokens++;
              accumulatedContent += delta;
              onToken(delta);

              // Update progress
              if (totalTokens % 10 === 0) {
                onProgress('Generating response...', Math.min(60 + (totalTokens / 20), 90));
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }

  } catch (error) {
    logger.error('DeepSeek streaming error:', error);
    onProgress('AI request failed', 0);
    throw error;
  }
}

/**
 * Build AI prompt with Excel context
 */
function buildExcelPrompt(message: string, context: any, history: any[]): any[] {
  const systemPrompt = `You are an Excel AI assistant. You help users with Excel operations using Office.js.

Current Excel Context:
- Workbook: ${context.workbookName || 'Unknown'}
- Active Sheet: ${context.activeSheet || 'Unknown'}
- Selected Range: ${context.selectedRange || 'None'}
- Total Sheets: ${context.totalSheets || 0}

${context.contextSummary || 'No additional context available'}

When generating Excel code:
1. Always use Excel.run() with async/await
2. Include proper error handling
3. Use context.sync() appropriately
4. Write clean, well-commented Office.js code
5. Explain what the code does

Format your response with the explanation first, followed by executable Office.js code in a code block.`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history
  history.forEach(msg => {
    if (msg.role && msg.content) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  });

  // Add current message
  messages.push({
    role: 'user',
    content: message
  });

  return messages;
}

/**
 * Extract Office.js code from AI response
 */
function extractCode(content: string): string {
  // Look for code blocks
  const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/g;
  const matches = content.match(codeBlockRegex);

  if (matches && matches.length > 0) {
    // Return the first code block, cleaned
    return matches[0]
      .replace(/```(?:javascript|js)?/g, '')
      .trim();
  }

  // Look for Excel.run patterns
  const excelRunRegex = /Excel\.run\([\s\S]*?\);?/g;
  const excelMatches = content.match(excelRunRegex);

  if (excelMatches && excelMatches.length > 0) {
    return excelMatches[0];
  }

  return '';
}

export { StreamOptions };