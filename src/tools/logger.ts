import fs from 'fs/promises';
import path from 'path';

/**
 * 📝 工具執行日誌記錄器
 */
export class ToolLogger {
  private logPath: string;

  constructor() {
    // 預設將日誌存在專案根目錄的 logs 資料夾
    this.logPath = path.resolve(process.cwd(), 'logs', 'tools_execution.log');
  }

  /**
   * 🖋️ 記錄一次工具調用
   */
  async log(toolName: string, args: any, result: string) {
    try {
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] TOOL: ${toolName}\nARGS: ${JSON.stringify(args)}\nRESULT: ${result.substring(0, 500)}${result.length > 500 ? '...' : ''}\n-------------------\n`;
      
      await fs.appendFile(this.logPath, logEntry, 'utf-8');
    } catch (error) {
      console.error('❌ 無法寫入日誌:', error);
    }
  }
}

export const toolLogger = new ToolLogger();
