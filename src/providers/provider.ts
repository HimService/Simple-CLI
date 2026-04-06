/**
 * 💡 LLM 提供商基礎介面
 * 
 * 定義了所有模型提供商必須實做的標準方法，
 * 確保系統核心邏輯與具體 API 脫鉤，實現高擴展性。
 */

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;               // 供 Gemini 函式回應使用
  toolCallId?: string;        // 供 OpenAI/Gemini 關聯使用
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
}

export abstract class LLMProvider {
  protected options: ProviderOptions;

  constructor(options: ProviderOptions) {
    this.options = {
      temperature: 0.7,
      ...options,
    };
  }

  /**
   * 🗨️ 發送對話請求並獲取完整回應
   * @param messages 對話歷史
   * @param tools 可選工具定義
   */
  abstract chat(messages: Message[], tools?: ToolDefinition[]): Promise<Message>;

  /**
   * 🌊 串流回應 (Streaming)
   * 💡 注意：目前大多數 API 在進行 Tool Call 時不支持串流輸出文字，
   * 因此工具調用邏輯通常在非串流模式中處理。
   */
  abstract streamChat(
    messages: Message[], 
    onToken: (token: string) => void
  ): Promise<void>;

  /**
   * 🔍 獲取當前使用的模型名稱
   */
  getModelName(): string {
    return this.options.model;
  }
}
