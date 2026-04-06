/**
 * 🛠️ 工具介面定義
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  isSensitive?: boolean; // 🆕 新增：標記此工具是否為敏感操作 (需要使用者確認)
}

/**
 * 🔧 工具模組介面
 */
export interface ToolModule {
  definition: ToolDefinition;
  handler: (args: any) => Promise<string>;
}
