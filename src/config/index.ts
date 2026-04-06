import Conf from 'conf';

/**
 * ⚙️ 系統設定結構
 */
export interface AppConfig {
  defaultProvider: 'openai' | 'gemini' | 'lmstudio';
  providers: {
    openai?: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    };
    gemini?: {
      apiKey: string;
      model: string;
    };
    lmstudio?: {
      baseUrl: string;
      model: string;
    };
  };
  security: {
    allowRunCommand: boolean;
    autoExecute: boolean; 
  };
  globalPrompt?: string;   // 🆕 新增：全域系統提示詞
}

/**
 * 📦 設定管理模組
 */
export class ConfigManager {
  private conf: Conf<AppConfig>;

  constructor() {
    this.conf = new Conf<AppConfig>({
      projectName: 'Simple CLI-agent',
      defaults: {
        defaultProvider: 'lmstudio',
        providers: {
          lmstudio: {
            baseUrl: 'http://localhost:1234/v1',
            model: 'local-model',
          },
        },
        security: {
          allowRunCommand: false,
          autoExecute: false, // 預設關閉以保證安全
        },
      },
    });
  }

  /**
   * 🔍 取得完整的設定
   */
  getConfig(): AppConfig {
    return this.conf.store;
  }

  /**
   * 💾 更新單一提供商的設定
   */
  updateProviderConfig<T extends keyof AppConfig['providers']>(
    provider: T,
    data: NonNullable<AppConfig['providers'][T]>
  ) {
    this.conf.set(`providers.${provider}`, data);
  }

  /**
   * 🛡️ 更新安全設定
   */
  updateSecurityConfig(data: AppConfig['security']) {
    this.conf.set('security', data);
  }

  /**
   * 🔄 切換預設模型提供商
   */
  setDefaultProvider(provider: AppConfig['defaultProvider']) {
    this.conf.set('defaultProvider', provider);
  }

  /**
   * 📝 更新全域系統提示詞
   */
  updateGlobalPrompt(prompt: string) {
    this.conf.set('globalPrompt', prompt);
  }

  /**
   * 📁 獲取設定檔路徑 (供開發除錯用)
   */
  getConfigPath(): string {
    return this.conf.path;
  }
}
