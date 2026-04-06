import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFileTool } from './readFile.js';
import { writeFileTool } from './writeFile.js';
import { listFilesTool } from './listFiles.js';
import { runCommandTool } from './runCommand.js';
import { ToolDefinition } from './types.js';

/**
 * 🛠️ 所有工具實作對照表 (Handler Registry)
 */
export const allTools: Record<string, (args: any) => Promise<string>> = {
  [readFileTool.definition.name]: readFileTool.handler,
  [writeFileTool.definition.name]: writeFileTool.handler,
  [listFilesTool.definition.name]: listFilesTool.handler,
  [runCommandTool.definition.name]: runCommandTool.handler,
};

/**
 * 📜 所有工具定義 (供 LLM 參考)
 */
export const allToolDefinitions: ToolDefinition[] = [
  readFileTool.definition,
  writeFileTool.definition,
  listFilesTool.definition,
  runCommandTool.definition,
];

/**
 * 🔌 載入外部插件 (plugins/ 資料夾)
 */
export const loadPlugins = async () => {
  const pluginsDir = path.join(process.cwd(), 'plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir);
    return;
  }

  const files = fs.readdirSync(pluginsDir).filter((f: string) => f.endsWith('.js'));
  
  if (files.length === 0) return;

  console.log(chalk.dim(`\n📦 正在掃描插件目錄: ${pluginsDir}`));

  for (const file of files) {
    try {
      const filePath = path.join(pluginsDir, file);
      // 💡 在 Node.js ESM 中使用動態 import 需要 file:// 協議
      const pluginUrl = pathToFileURL(filePath).href;
      const plugin = await import(pluginUrl);
      
      const module = plugin.default || plugin;
      
      if (module.definition && typeof module.handler === 'function') {
        const toolName = module.definition.name;
        
        // 防止與核心工具衝突
        if (allTools[toolName]) {
          console.log(chalk.yellow(`⚠️  跳過插件 ${file}: 工具名稱 "${toolName}" 已存在。`));
          continue;
        }

        allTools[toolName] = module.handler;
        allToolDefinitions.push(module.definition);
        console.log(chalk.green(`✅ 已成功載入插件: ${chalk.blue(toolName)} (${file})`));
      } else {
        console.log(chalk.red(`❌ 插件格式錯誤 ${file}: 必須包含 definition 與 handler。`));
      }
    } catch (e: any) {
      console.log(chalk.red(`❌ 載入插件失敗 ${file}: ${e.message}`));
    }
  }
};

// 匯出共用型別
export * from './types.js';
export * from './logger.js';
