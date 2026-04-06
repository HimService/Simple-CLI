import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolModule } from './types.js';

const execAsync = promisify(exec);

/**
 * ⌨️ 執行系統命令工具
 */
export const runCommandTool: ToolModule = {
  definition: {
    name: 'runCommand',
    description: '在終端機中執行系統命令 (如 npm test, git status)。請謹慎使用。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要執行的指令內容' }
      },
      required: ['command']
    }
  },
  handler: async ({ command }: { command: string }) => {
    try {
      const { stdout, stderr } = await execAsync(command);
      return stdout || stderr || '✅ 命令執行成功 (無輸出)';
    } catch (error: any) {
      return `❌ 命令執行失敗: ${error.message}`;
    }
  }
};
