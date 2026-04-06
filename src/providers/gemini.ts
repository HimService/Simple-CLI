import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, Message, ToolDefinition } from './provider.js';

/**
 *  Gemini 提供商實作
 * 
 * 使用 Google Generative AI SDK。
 */
export class GeminiProvider extends LLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor(options: { 
    apiKey: string; 
    model: string; 
    temperature?: number 
  }) {
    super(options);
    this.genAI = new GoogleGenerativeAI(options.apiKey);
  }

  /**
   * 🔄 格式化訊息為 Gemini 格式
   */
  private formatMessages(messages: Message[]) {
    return messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'function',
          parts: [{
            functionResponse: {
              name: m.name!,
              response: { content: m.content }
            }
          }]
        };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(m.toolCalls ? m.toolCalls.map(tc => ({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments)
            }
          })) : []),
          ...(m.content ? [{ text: m.content }] : [])
        ] as any,
      };
    }) as any;
  }

  /**
   * 一般對話 (支持工具)
   */
  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<Message> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.options.model,
        generationConfig: {
          temperature: this.options.temperature,
        },
        tools: tools ? [{
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as any
          }))
        }] : []
      });

      const lastMessage = messages[messages.length - 1];
      const chat = model.startChat({
        history: this.formatMessages(messages.slice(0, -1)),
      });

      const result = await chat.sendMessage(
        lastMessage.role === 'tool' 
          ? [{ functionResponse: { name: lastMessage.name!, response: { content: lastMessage.content } } }] as any
          : lastMessage.content
      );

      const response = await result.response;
      const functionCalls = (response as any).functionCalls();

      return {
        role: 'assistant',
        content: response.text() || '',
        toolCalls: functionCalls?.map((fc: any) => ({
          id: Math.random().toString(36).substring(7), 
          type: 'function',
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args)
          }
        })) as any
      };
    } catch (error: any) {
      throw new Error(`Gemini API 錯誤: ${error.message}`);
    }
  }

  /**
   * 串流對話
   */
  async streamChat(
    messages: Message[], 
    onToken: (token: string) => void
  ): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.options.model });
      const lastMessage = messages[messages.length - 1].content;
      const chat = model.startChat({
        history: this.formatMessages(messages.slice(0, -1)),
      });

      const result = await chat.sendMessageStream(lastMessage);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onToken(chunkText);
        }
      }
    } catch (error: any) {
      throw new Error(`Gemini Stream 錯誤: ${error.message}`);
    }
  }
}
