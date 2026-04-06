import { OpenAIProvider } from '../openai/index.js';

/**
 * 🏠 LM Studio 提供商實作
 * 
 * 繼承自 OpenAIProvider，因為 LM Studio 使用相容的 API 格式。
 * 預設連接到本地端點。
 */
export class LMStudioProvider extends OpenAIProvider {
  constructor(options: { 
    baseUrl?: string; 
    model: string; 
    temperature?: number 
  }) {
    // LM Studio 通常不要求真實的 API Key
    super({
      apiKey: 'lm-studio-local', 
      baseUrl: options.baseUrl || 'http://localhost:1234/v1',
      model: options.model,
      temperature: options.temperature,
    });
  }
}
