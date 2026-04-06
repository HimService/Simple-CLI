import fs from 'fs/promises';
import path from 'path';
import { ToolModule } from './types.js';

/**
 * 📂 列出目錄結構工具
 */
export const listFilesTool: ToolModule = {
  definition: {
    name: 'listFiles',
    description: '列出指定目錄下的所有檔案與資料夾結構。',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: '目錄路徑 (預設為 .)' }
      },
      required: []
    }
  },
  handler: async ({ directory = '.' }: { directory?: string }) => {
    try {
      const fullPath = path.resolve(process.cwd(), directory);
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      const list = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`).join('\n');
      return list || '(目錄為空)';
    } catch (error: any) {
      return `❌ 列出目錄失敗: ${error.message}`;
    }
  }
};
