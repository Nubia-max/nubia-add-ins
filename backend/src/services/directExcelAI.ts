/**
 * Direct Excel AI - Lightweight Action Engine
 * Generates raw executable Office.js code for direct Excel automation
 * Clean, fast, minimal - Claude-for-Excel freedom
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { ENV } from '../config/environment';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: ENV.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 60000,
      maxRetries: 1
    });
  }
  return client;
}

interface ExcelCommand {
  command: string;
  context?: any;
}

interface ExcelCodeResponse {
  thinking: string;
  conversation: string;
  code?: string;
  needsApproval: boolean;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
}

export async function generateExcelCode(request: ExcelCommand): Promise<ExcelCodeResponse> {
  try {
    const completion = await getClient().chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: buildConversationalPrompt(request.context)
        },
        {
          role: "user",
          content: request.command
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const rawResponse = completion.choices[0]?.message?.content || '';
    const parsed = parseConversationalResponse(rawResponse);

    return {
      thinking: parsed.thinking,
      conversation: parsed.conversation,
      code: parsed.code,
      needsApproval: parsed.needsApproval,
      tokensUsed: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0
      }
    };

  } catch (error) {
    logger.error('Excel AI generation failed:', error);
    throw error;
  }
}

function buildConversationalPrompt(context?: any): string {
  const contextInfo = context ? `
Current Excel context: ${context.activeSheetName || 'Active sheet'}, Selection: ${context.selectedRange || 'None'}` : '';

  return `You are Moose, an Excel AI assistant. Behave exactly like Claude Code:

1. ALWAYS start with [THINKING] to analyze the user's request
2. Then provide a [CONVERSATION] response explaining what you'll do
3. If Excel automation is needed, include [CODE] with Office.js
4. Complex operations need [NEEDS_APPROVAL]: true
${contextInfo}

Response format:
[THINKING]
(Your analytical thinking about the user's request)

[CONVERSATION]
(Friendly conversational response explaining what you're doing)

[CODE]
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      // Your Office.js code here
      await context.sync();
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

[NEEDS_APPROVAL]
true/false

Examples:

User: "Make A1 yellow"
Response:
[THINKING]
The user wants to change the background color of cell A1 to yellow. This is a simple formatting operation.

[CONVERSATION]
I'll change the background color of cell A1 to yellow for you.

[CODE]
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const range = worksheet.getRange("A1");
      range.format.fill.color = "#FFFF00";
      await context.sync();
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

[NEEDS_APPROVAL]
false

User: "Delete all data"
Response:
[THINKING]
The user is asking to delete all data in the worksheet. This is a potentially destructive operation that could result in data loss.

[CONVERSATION]
I can help you delete all data from the current worksheet. This will permanently remove all values, formulas, and formatting. Would you like me to proceed?

[CODE]
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const usedRange = worksheet.getUsedRange();
      if (usedRange) {
        usedRange.clear();
        await context.sync();
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

[NEEDS_APPROVAL]
true

Be conversational, helpful, and always include both thinking and conversation responses.`;
}

function parseConversationalResponse(response: string): {
  thinking: string;
  conversation: string;
  code?: string;
  needsApproval: boolean;
} {
  const thinkingMatch = response.match(/\[THINKING\]\s*([\s\S]*?)(?=\[CONVERSATION\]|$)/);
  const conversationMatch = response.match(/\[CONVERSATION\]\s*([\s\S]*?)(?=\[CODE\]|\[NEEDS_APPROVAL\]|$)/);
  const codeMatch = response.match(/\[CODE\]\s*```(?:javascript|js)?\s*([\s\S]*?)```/);
  const approvalMatch = response.match(/\[NEEDS_APPROVAL\]\s*(true|false)/);

  const thinking = thinkingMatch ? thinkingMatch[1].trim() : 'Analyzing your request...';
  const conversation = conversationMatch ? conversationMatch[1].trim() : 'I\'ll help you with that Excel task.';
  const code = codeMatch ? codeMatch[1].trim() : undefined;
  const needsApproval = approvalMatch ? approvalMatch[1] === 'true' : false;

  // If no structured response, try to extract from unstructured response
  if (!thinkingMatch && !conversationMatch) {
    // Look for any code in the response
    const anyCodeMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
    if (anyCodeMatch) {
      return {
        thinking: 'Processing your Excel request...',
        conversation: 'I\'ll execute this Excel operation for you.',
        code: anyCodeMatch[1].trim(),
        needsApproval: false
      };
    } else {
      return {
        thinking: 'Understanding your request...',
        conversation: response.trim() || 'I\'ll help you with that Excel task.',
        code: undefined,
        needsApproval: false
      };
    }
  }

  return {
    thinking,
    conversation,
    code,
    needsApproval
  };
}