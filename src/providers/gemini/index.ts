import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, Message, ToolDefinition } from '../common/provider.js';

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
   * 🛠️ 正規化 JSON Schema (將 type 轉為大寫以符合某些 Gemini 模型要求)
   */
  private normalizeSchema(schema: any): any {
    if (!schema) return schema;
    const newSchema = { ...schema };
    if (newSchema.type && typeof newSchema.type === 'string') {
      newSchema.type = newSchema.type.toUpperCase();
    }
    if (newSchema.properties) {
      for (const key in newSchema.properties) {
        newSchema.properties[key] = this.normalizeSchema(newSchema.properties[key]);
      }
    }
    if (newSchema.items) {
      newSchema.items = this.normalizeSchema(newSchema.items);
    }
    return newSchema;
  }

  /**
   * 🔄 格式化訊息為 Gemini 格式 (排除 system 訊息，改由指令處理)
   */
  private formatMessages(messages: Message[]) {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        // 🔐 全量鏡像策略：優先使用原始數據塊 (包含 thought_signature)
        if (m.rawParts) {
          return {
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: m.rawParts
          };
        }

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
              functionCall: tc.function.rawCall || {
                name: tc.function.name,
                args: typeof tc.function.arguments === 'string' 
                  ? JSON.parse(tc.function.arguments) 
                  : tc.function.arguments
              }
            })) : []),
            ...(m.content ? [{ text: m.content }] : [])
          ] as any,
        };
      }) as any;
  }

  /**
   * 一般對話 (支持工具與系統指令)
   */
  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<Message> {
    try {
      // 🧠 提取系統提示詞 (System Prompt)
      const systemMessage = messages.find(m => m.role === 'system');
      
      const model = this.genAI.getGenerativeModel({
        model: this.options.model,
        systemInstruction: systemMessage ? {
          role: 'system',
          parts: [{ text: systemMessage.content }]
        } : undefined,
        generationConfig: {
          temperature: this.options.temperature,
        },
        tools: tools ? [{
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: this.normalizeSchema(t.parameters)
          }))
        }] : []
      });

      const history = this.formatMessages(messages.slice(0, -1));
      const lastMessage = messages[messages.length - 1];
      
      // 🚀 改用 generateContent 以獲得對協議數據的 100% 控制權
      const result = await model.generateContent({
        contents: [
          ...history,
          ...(lastMessage.role === 'tool' 
            ? [{ 
                role: 'function', 
                parts: [{ 
                  functionResponse: { 
                    name: lastMessage.name!, 
                    response: { content: lastMessage.content } 
                  } 
                }] 
              }] as any 
            : [{ 
                role: 'user', 
                parts: [{ text: lastMessage.content }] 
              }] as any)
        ]
      });

      const response = await result.response;
      
      // 🔍 從原始 parts 中提取 functionCalls 及其所有元數據
      const rawParts = response.candidates?.[0]?.content?.parts || [];
      const toolParts = rawParts.filter((p: any) => p.functionCall);

      return {
        role: 'assistant',
        content: response.text?.() || '',
        rawParts: rawParts, // 🔐 關鍵核心：全量鏡像保存所有原始數據塊 (含思考簽名)
        toolCalls: toolParts?.map((p: any) => ({
          id: Math.random().toString(36).substring(7), 
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args),
            rawCall: p.functionCall
          }
        })) as any
      };
    } catch (error: any) {
      throw new Error(`Gemini API 錯誤: ${error.message}`);
    }
  }

  /**
   * 串流對話 (支持系統指令)
   */
  async streamChat(
    messages: Message[], 
    onToken: (token: string) => void
  ): Promise<void> {
    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const model = this.genAI.getGenerativeModel({ 
        model: this.options.model,
        systemInstruction: systemMessage ? {
          role: 'system',
          parts: [{ text: systemMessage.content }]
        } : undefined
      });

      const history = this.formatMessages(messages.slice(0, -1));
      const lastMessage = messages[messages.length - 1].content;
      
      const chat = model.startChat({ history });

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
