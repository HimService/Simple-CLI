import OpenAI from 'openai';
import { LLMProvider, Message, ToolDefinition } from './provider.js';

/**
 * 🚀 OpenAI 提供商實作
 * 
 * 使用 OpenAI SDK 與 API 溝通。
 * 支援一般對話、工具調用 (Tool Calls) 與串流輸出。
 */
export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

  constructor(options: { 
    apiKey: string; 
    baseUrl?: string; 
    model: string; 
    temperature?: number 
  }) {
    super(options);
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
  }

  /**
   * 一般對話實作 (封裝 Tool Call 邏輯)
   */
  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<Message> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: messages.map(m => ({
          role: m.role === 'tool' ? 'tool' : m.role,
          content: m.content,
          tool_call_id: m.toolCallId,
          tool_calls: m.toolCalls as any,
        })) as any,
        tools: tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          }
        })) as any,
        temperature: this.options.temperature,
      });

      const message = response.choices[0]?.message;
      
      return {
        role: 'assistant',
        content: message?.content || '',
        toolCalls: message?.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          }
        })) as any,
      };
    } catch (error: any) {
      throw new Error(`OpenAI API 錯誤: ${error.message}`);
    }
  }

  /**
   * 串流對話實作
   */
  async streamChat(
    messages: Message[], 
    onToken: (token: string) => void
  ): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.options.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })) as any,
        temperature: this.options.temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onToken(content);
        }
      }
    } catch (error: any) {
      throw new Error(`OpenAI Stream 錯誤: ${error.message}`);
    }
  }
}
