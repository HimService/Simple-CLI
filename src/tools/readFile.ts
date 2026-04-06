import fs from 'fs/promises';
import path from 'path';
import { ToolModule } from './types.js';

/**
 * 📖 讀取檔案工具
 */
export const readFileTool: ToolModule = {
  definition: {
    name: 'readFile',
    description: '讀取指定路徑的檔案內容，幫助您暸解原始碼與配置。',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '檔案路徑 (相對於當前專案目錄)' }
      },
      required: ['filePath']
    }
  },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `❌ 讀取檔案失敗: ${error.message}`;
    }
  }
};
