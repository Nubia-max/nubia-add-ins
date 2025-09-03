import { LLMProvider, LLMResponse, ExcelTask, ChatMessage } from '../types';
import { storageService } from './storage';
import { excelParser, ParseResult } from './excelParser';
import { automationService } from './automation';
import { errorHandler } from './errorHandler';

export interface LLMConfig {
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  systemPrompt: `You are Nubia, an AI assistant specialized in Excel automation and accounting. You can control Excel through visual automation or background processing.

Your capabilities include:
- Data entry and manipulation
- Formula creation and optimization
- Chart and visualization creation
- Financial analysis and accounting tasks
- Macro development and automation
- Data validation and cleaning

When users request Excel tasks, analyze the complexity:
- Simple tasks: Basic data entry, formatting, simple formulas
- Complex tasks: Advanced formulas, macros, multi-sheet operations, data analysis

Always provide clear, step-by-step instructions and offer to automate the task when possible.`,
  maxTokens: 2000,
  temperature: 0.7
};

class LLMService {
  private config: LLMConfig = DEFAULT_CONFIG;
  private messageHistory: ChatMessage[] = [];

  async getCurrentProvider(): Promise<LLMProvider> {
    const providerName = await storageService.getCurrentProvider();
    const openaiKey = await storageService.getOpenAIApiKey();
    const anthropicKey = await storageService.getAnthropicApiKey();

    if (providerName === 'openai') {
      return {
        name: 'openai',
        displayName: 'OpenAI GPT-4',
        model: 'gpt-4-turbo-preview',
        apiKey: openaiKey || undefined
      };
    } else {
      return {
        name: 'anthropic',
        displayName: 'Anthropic Claude',
        model: 'claude-3-haiku-20240307',
        apiKey: anthropicKey || undefined
      };
    }
  }

  async sendMessage(content: string, history: ChatMessage[] = []): Promise<LLMResponse> {
    const provider = await this.getCurrentProvider();
    
    try {
      if (!provider.apiKey) {
        // Return mock response when no API key is set
        return this.getMockResponse(content);
      }

      if (provider.name === 'openai') {
        return await this.callOpenAI(content, history, provider);
      } else {
        return await this.callAnthropic(content, history, provider);
      }
    } catch (error: any) {
      // Handle error through error service
      await errorHandler.handleServiceError(
        'LLM service error',
        error.message || 'Unknown LLM error',
        { provider: provider.name }
      );
      
      // Return mock response on error
      return {
        content: `I apologize, but I encountered an error while processing your request. This might be due to API connectivity issues or configuration problems.

In the meantime, I can still help you with Excel automation. Here's what I would typically suggest for "${content}":

• I'd analyze your request to determine if it's a simple or complex Excel task
• For simple tasks like data entry or basic formulas, I'd provide step-by-step instructions
• For complex tasks involving multiple sheets or advanced analysis, I'd recommend using automation
• I can help with formulas, charts, data validation, and basic macro development

Would you like me to provide specific guidance for your Excel task?`,
        metadata: {
          provider: provider.name,
          model: provider.model,
          processingTime: Date.now()
        }
      };
    }
  }

  private async callOpenAI(content: string, history: ChatMessage[], provider: LLMProvider): Promise<LLMResponse> {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: this.config.systemPrompt }
    ];

    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content });

    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    return {
      content: responseContent,
      excelTask: this.detectExcelTask(content, responseContent),
      metadata: {
        provider: provider.name,
        model: provider.model,
        tokens: data.usage?.total_tokens,
        processingTime: Date.now() - startTime
      }
    };
  }

  private async callAnthropic(content: string, history: ChatMessage[], provider: LLMProvider): Promise<LLMResponse> {
    const messages: AnthropicMessage[] = [];

    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content });

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: this.config.maxTokens,
        system: this.config.systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.content[0]?.text || 'I apologize, but I was unable to generate a response.';

    return {
      content: responseContent,
      excelTask: this.detectExcelTask(content, responseContent),
      metadata: {
        provider: provider.name,
        model: provider.model,
        tokens: data.usage?.input_tokens + data.usage?.output_tokens,
        processingTime: Date.now() - startTime
      }
    };
  }

  private getMockResponse(content: string): LLMResponse {
    const lowerContent = content.toLowerCase();
    let mockResponse = '';
    let excelTask: ExcelTask | undefined;

    // Detect Excel-related keywords and provide contextual responses
    if (lowerContent.includes('excel') || lowerContent.includes('spreadsheet')) {
      if (lowerContent.includes('formula') || lowerContent.includes('calculate')) {
        mockResponse = `I can help you with Excel formulas! Based on your request, I'd suggest:

1. **For basic calculations**: Use SUM, AVERAGE, or simple arithmetic formulas
2. **For conditional logic**: Consider IF statements or VLOOKUP functions
3. **For data analysis**: Try PIVOT tables or advanced functions like INDEX/MATCH

Would you like me to create a specific formula for your data? I can also automate the process if you have a large dataset to work with.

*Note: I'm currently running in demo mode. Connect your OpenAI or Anthropic API key in settings for full functionality.*`;

        excelTask = {
          id: Date.now().toString(),
          description: `Create Excel formula based on: ${content}`,
          type: 'formula',
          complexity: 'simple',
          status: 'pending'
        };
      } else if (lowerContent.includes('chart') || lowerContent.includes('graph')) {
        mockResponse = `I can help you create charts in Excel! Here's what I recommend:

1. **Data preparation**: Ensure your data is properly formatted
2. **Chart selection**: Choose the right chart type (bar, line, pie, scatter, etc.)
3. **Customization**: Add titles, labels, and formatting for clarity

I can automate the chart creation process for you. What type of data are you working with?

*Note: I'm currently running in demo mode. Connect your API key for full automation capabilities.*`;

        excelTask = {
          id: Date.now().toString(),
          description: `Create Excel chart for: ${content}`,
          type: 'chart',
          complexity: 'simple',
          status: 'pending'
        };
      } else {
        mockResponse = `I'm ready to help with your Excel task! As your specialized Excel automation assistant, I can assist with:

• **Data entry and manipulation** - Automating repetitive data tasks
• **Formula creation** - Building complex calculations and logic
• **Charts and visualizations** - Creating professional dashboards
• **Financial analysis** - Accounting and business intelligence
• **Macro development** - Advanced automation scripts

Please describe what you'd like to accomplish, and I'll provide step-by-step guidance or offer to automate the process for you.

*Note: Currently in demo mode - connect your API key in settings for full LLM integration.*`;
      }
    } else {
      mockResponse = `Hello! I'm Nubia, your AI assistant specialized in Excel automation and accounting. 

While I can help with various tasks, I'm particularly skilled at:
• Excel spreadsheet automation
• Financial analysis and accounting
• Data processing and visualization
• Formula optimization and macro development

How can I assist you today? Feel free to ask me about any Excel-related task or accounting question!

*Note: I'm currently running in demo mode. For full AI capabilities, please add your OpenAI or Anthropic API key in the settings.*`;
    }

    return {
      content: mockResponse,
      excelTask,
      metadata: {
        provider: 'mock',
        model: 'demo-mode',
        processingTime: 500 + Math.random() * 1000 // Simulate processing time
      }
    };
  }

  private detectExcelTask(userInput: string, response: string): ExcelTask | undefined {
    // Use the excel parser for sophisticated task detection
    const parseResult = excelParser.parse(userInput);
    
    if (parseResult.success && parseResult.task && parseResult.confidence > 0.3) {
      // Return the parsed task, suggesting the optimal mode
      const task = parseResult.task;
      task.mode = automationService.suggestMode(task);
      return task;
    }

    // Fallback to simple detection for ambiguous cases
    const lowerInput = userInput.toLowerCase();
    const hasExcelKeywords = lowerInput.includes('excel') || 
                            lowerInput.includes('spreadsheet') ||
                            lowerInput.includes('workbook') ||
                            lowerInput.includes('chart') ||
                            lowerInput.includes('formula') ||
                            lowerInput.includes('pivot');

    if (hasExcelKeywords) {
      // Create a simple fallback task
      return {
        id: `simple_task_${Date.now()}`,
        type: 'create_spreadsheet',
        description: userInput,
        complexity: excelParser.estimateComplexity(userInput),
        estimatedActions: 5,
        parameters: {},
        mode: 'background',
        priority: 1,
        status: 'pending',
        steps: [],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 30
        }
      };
    }

    return undefined;
  }

  // Configuration methods
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  setMaxTokens(tokens: number): void {
    this.config.maxTokens = Math.max(100, Math.min(4000, tokens));
  }

  setTemperature(temp: number): void {
    this.config.temperature = Math.max(0, Math.min(2, temp));
  }

  // Testing method
  async testConnection(provider?: 'openai' | 'anthropic'): Promise<boolean> {
    try {
      const testProvider = provider ? 
        (provider === 'openai' ? {
          name: 'openai' as const,
          displayName: 'OpenAI GPT-4',
          model: 'gpt-4-turbo-preview',
          apiKey: await storageService.getOpenAIApiKey() || undefined
        } : {
          name: 'anthropic' as const,
          displayName: 'Anthropic Claude',
          model: 'claude-3-haiku-20240307',
          apiKey: await storageService.getAnthropicApiKey() || undefined
        }) : await this.getCurrentProvider();

      if (!testProvider.apiKey) {
        return false;
      }

      const response = await this.sendMessage('Hello, can you confirm you\'re working?', []);
      return response.content.length > 0 && response.metadata?.provider !== 'mock';
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

export const llmService = new LLMService();