import fs from 'fs/promises';
import path from 'path';
import { ToolModule } from './types.js';

/**
 * ✍️ 寫入或修改檔案工具
 */
export const writeFileTool: ToolModule = {
  definition: {
    name: 'writeFile',
    description: '在指定路徑建立或覆蓋檔案內容。可用於生成程式碼或修復 Bug。',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '目標標路徑' },
        content: { type: 'string', description: '要寫入的完整內容' }
      },
      required: ['filePath', 'content']
    }
  },
  handler: async ({ filePath, content }: { filePath: string; content: string }) => {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      // 自動建立目錄
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return `✅ 檔案已成功寫入: ${filePath}`;
    } catch (error: any) {
      return `❌ 寫入檔案失敗: ${error.message}`;
    }
  }
};
