import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
}

/**
 * 📁 檔案與系統操作工具實作
 */
export const osTools = {
  /**
   * 📖 讀取檔案內容
   */
  async readFile({ filePath }: { filePath: string }): Promise<string> {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `❌ 讀取檔案失敗: ${error.message}`;
    }
  },

  /**
   * ✍️ 寫入或修改檔案
   */
  async writeFile({ filePath, content }: { filePath: string; content: string }): Promise<string> {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      // 自動建立目錄
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return `✅ 檔案已成功寫入: ${filePath}`;
    } catch (error: any) {
      return `❌ 寫入檔案失敗: ${error.message}`;
    }
  },

  /**
   * 📂 列出目錄結構
   */
  async listFiles({ directory = '.' }: { directory?: string }): Promise<string> {
    try {
      const fullPath = path.resolve(process.cwd(), directory);
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      const list = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`).join('\n');
      return list || '(目錄為空)';
    } catch (error: any) {
      return `❌ 列出目錄失敗: ${error.message}`;
    }
  },

  /**
   * ⌨️ 執行系統命令
   */
  async runCommand({ command }: { command: string }): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return stdout || stderr || '✅ 命令執行成功 (無輸出)';
    } catch (error: any) {
      return `❌ 命令執行失敗: ${error.message}`;
    }
  }
};

/**
 * 📜 工具的 JSON Schema 定義 (供 LLM 使用)
 */
export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'readFile',
    description: '讀取指定路徑的檔案內容',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '檔案路徑 (相對於當前目錄)' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'writeFile',
    description: '在指定路徑建立或覆蓋檔案內容',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '目標標路徑' },
        content: { type: 'string', description: '要寫入的完整內容' }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'listFiles',
    description: '列出指定目錄下的所有檔案與資料夾',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: '目錄路徑 (預設為 .)' }
      },
      required: []
    }
  },
  {
    name: 'runCommand',
    description: '在終端機中執行系統命令',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要執行的指令 (如 npm test, git status)' }
      },
      required: ['command']
    }
  }
];
