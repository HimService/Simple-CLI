#!/usr/bin/env node
/**
 * 🛠️ Simple CLI (CLI AI Agent) 入口點
 * 
 * 負責解析指令、初始化設定、實例化對話引擎與提供互動控制台。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { ConfigManager } from './config/index.js';
import { OpenAIProvider } from './providers/openai/index.js';
import { GeminiProvider } from './providers/gemini/index.js';
import { LMStudioProvider } from './providers/lmstudio/index.js';
import { AIAgent } from './core/agent.js';
import { LLMProvider } from './providers/common/provider.js';
import { loadPlugins } from './tools/index.js'; // 🔌 引入插件載入器
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import readline from 'readline';
import { fileURLToPath } from 'url';

// 🎨 配置 Markdown 終端機渲染 (高質感設計)
marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.yellow,
    blockquote: chalk.gray.italic,
    html: chalk.green,
    heading: chalk.cyan.bold,
    firstHeading: chalk.magenta.bold,
    listitem: chalk.white,
    table: chalk.white,
    strong: chalk.bold.green,
    em: chalk.italic.white,
    codespan: chalk.bgBlack.yellow,
    del: chalk.strikethrough.red,
    link: chalk.blue,
    href: chalk.blue.underline
  }) as any
});

const program = new Command();
const configManager = new ConfigManager();
let isProjectMode = false; // 🆕 追蹤是否為專案感知模式

/**
 * 🛠️ 初始化 Provider
 */
const initProvider = (): LLMProvider => {
  const config = configManager.getConfig();
  const providerType = config.defaultProvider;
  const settings = config.providers[providerType];

  if (!settings) {
    throw new Error(`找不到提供商 ${providerType} 的相關設定，請先執行配置。`);
  }

  switch (providerType) {
    case 'openai':
      return new OpenAIProvider({
        apiKey: (settings as any).apiKey,
        baseUrl: (settings as any).baseUrl,
        model: settings.model,
      });
    case 'gemini':
      return new GeminiProvider({
        apiKey: (settings as any).apiKey,
        model: settings.model,
      });
    case 'lmstudio':
      return new LMStudioProvider({
        baseUrl: (settings as any).baseUrl,
        model: settings.model,
      });
    default:
      throw new Error(`不支援的提供商類型: ${providerType}`);
  }
};

/**
 * 🌈 Simple CLI 標誌圖案
 */
const printLogo = () => {
  console.clear();
  console.log(chalk.cyan.bold('\n🚀 Simple CLI (CLI AI Agent) - 您的終端機 AI 助手\n'));
  const config = configManager.getConfig();
  console.log(chalk.dim(`當前預設提供商: ${chalk.yellow(config.defaultProvider)}`));
  console.log(chalk.dim(`當前使用模型: ${chalk.yellow(config.providers[config.defaultProvider]?.model || '未設定')}`));

  if (isProjectMode) {
    console.log(chalk.dim(`🏠 ${chalk.bold('專案路徑')}: ${chalk.yellow(process.cwd())}`));
    console.log(chalk.cyan.bold(` 🛰️  [ 專案感應模式：已開啟 ]`));
  } else {
    console.log(chalk.dim(' 🛰️  專案感應模式：未開啟 (通用助理模式)'));
  }
  process.stdout.write('\n');
};

/**
 * 🤖 建立並配置 AIAgent
 */
const createAgent = (provider: LLMProvider) => {
  const config = configManager.getConfig();

  // 🧠 專案規則掃描 (僅在專案模式下執行 - 支援大小寫不分)
  let projectRules = '';
  if (isProjectMode) {
    try {
      const files = fs.readdirSync('.');
      const ruleFile = files.find(f => f.toLowerCase() === 'spc.md');

      if (ruleFile) {
        projectRules = fs.readFileSync(ruleFile, 'utf-8');
        console.log(chalk.green(`\n📜 已成功讀取專案規範: ${chalk.bold(ruleFile)}`));
      }
    } catch (e: any) {
      console.log(chalk.red(`\n❌ 讀取專案規範失敗: ${e.message}`));
    }
  }

  const agent = new AIAgent(provider, {
    security: config.security,
    isProjectMode: isProjectMode,
    projectRules: projectRules // 👤 傳遞專案規則
  }, config.globalPrompt); // 📝 注入全域系統提示 (若無則使用 Agent 預設)

  // 當 AI 想要調用工具時，在終端機顯示狀態 (此處僅提供一個預設，實際在 startChat 會被重寫以支援平滑過渡)
  agent.onToolCall = (toolName, args) => {
    let message = `AI 正在執行: ${chalk.yellow(toolName)}`;
    if (args.filePath) message += ` (${chalk.blue(args.filePath)})`;
    if (args.command) message += ` [${chalk.dim(args.command)}]`;
    ora(message).start().succeed();
  };

  // 🔐 實作敏感工具的雙重確認
  agent.onConfirmTool = async (toolName, args) => {
    console.log(chalk.yellow(`\n⚠️  安全警告: AI 請求執行敏感指令`));
    console.log(`${chalk.white('工具:')} ${chalk.cyan(toolName)}`);
    if (args.command) {
      console.log(`${chalk.white('指令:')} ${chalk.green.bold(args.command)}`);
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.red('您確定要允許執行此指令嗎？'),
        default: false,
        prefix: '>',
      },
    ]);

    process.stdout.write('\n'); // 換行保持排版
    return confirmed;
  };

  return agent;
};

/**
 * ⌨️ 支援退格鍵返回的 Prompt 封裝
 */
const backablePrompt = async <T = any>(questions: any[]): Promise<T | { action: 'back' }> => {
  const prompt = inquirer.prompt(questions);
  const ui = (prompt as any).ui;
  const rl = ui.rl;

  return new Promise((resolve, reject) => {
    const onKeypress = (s: any, key: any) => {
      // 僅在 list 類型下攔截 backspace
      if (key && key.name === 'backspace' && questions.some(q => q.type === 'list')) {
        rl.input.removeListener('keypress', onKeypress);
        ui.close();
        resolve({ action: 'back' } as any);
      }
    };

    rl.input.on('keypress', onKeypress);

    prompt.then((answers) => {
      rl.input.removeListener('keypress', onKeypress);
      resolve(answers as T);
    }).catch((err) => {
      rl.input.removeListener('keypress', onKeypress);
      reject(err);
    });
  });
};

/**
 * 💬 互動式對話循環
 */
const startChat = async () => {
  let provider;
  try {
    provider = initProvider();
  } catch (e: any) {
    console.log(chalk.red(`❌ 初始化失敗: ${e.message}`));
    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...' }]);
    return;
  }

  const config = configManager.getConfig();
  const agent = createAgent(provider);
  console.log(chalk.cyan('\n------------------ 對話開始 ------------------'));
  console.log(chalk.dim('💡 此模式下 AI 具備讀寫檔案與執行指令的能力。'));

  // 🛡️ 顯示安全性狀態摘要
  const runStatus = config.security?.allowRunCommand ? chalk.green.bold('開啟') : chalk.red.bold('關閉');
  const autoStatus = config.security?.autoExecute
    ? chalk.bgRed.white.bold(' 🚀 自動模式 (極高風險) ')
    : chalk.cyan.bold('手動確認模式');

  console.log(chalk.white(`💡 ${chalk.bold('系統指令執行')}: ${runStatus} | ${chalk.bold('運作權限')}: ${autoStatus}`));

  // 🏠 僅在專案模式下顯示目錄地標
  if (isProjectMode) {
    console.log(chalk.dim(`🏠 ${chalk.bold('當前專案目錄')}: ${chalk.yellow(process.cwd())}`));
  }

  console.log(chalk.dim('💡 輸入 "exit" 或 "quit" 以退出對話並返回主選單。\n'));

  while (true) {
    const { userInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: chalk.green('您:'),
        prefix: '>',
      },
    ]);

    if (['exit', 'quit'].includes(userInput.toLowerCase())) {
      break;
    }

    // 🚀 啟動全局唯一的動畫實體
    let activeSpinner: any = ora('AI 正在思考中...').start();

    // 💉 動態注入平滑過渡邏輯
    agent.onToolCall = (toolName, args) => {
      let message = `AI 正在執行: ${chalk.yellow(toolName)}`;
      if (args.filePath) message += ` (${chalk.blue(args.filePath)})`;
      if (args.command) message += ` [${chalk.dim(args.command)}]`;

      if (activeSpinner?.isSpinning) {
        activeSpinner.text = message; // 僅更新文字，防止整行刷新閃爍
      } else {
        activeSpinner = ora(message).start();
      }
    };

    // 🔐 確保安全確認時停掉動畫，避免 UI 衝突
    const originalConfirm = agent.onConfirmTool;
    agent.onConfirmTool = async (toolName, args) => {
      if (activeSpinner?.isSpinning) {
        activeSpinner.stop(); // 暫停動畫，讓出終端機控制權
      }
      const result = await originalConfirm!(toolName, args);
      // 如果還沒開始輸出的話，重啟思考動畫
      activeSpinner = ora('AI 正在處理中...').start();
      return result;
    };

    agent.onToolResult = (toolName, result) => {
      if (activeSpinner?.isSpinning) {
        if (result.startsWith('❌')) {
          activeSpinner.fail();
        } else {
          activeSpinner.succeed();
        }
        // 工具結束後，立即在下一行繼續「思考中」的動畫
        activeSpinner = ora('AI 正在思考中...').start();
      }
    };

    let fullAnswer = '';
    let renderedLines = 0;
    let prefixPrinted = false;

    try {
      await agent.askStream(userInput, (token) => {
        // 當開始輸出文字時，停止動畫
        if (activeSpinner?.isSpinning) {
          activeSpinner.stop();
        }

        if (!prefixPrinted) {
          process.stdout.write(chalk.blue('\nAI: '));
          prefixPrinted = true;
        }

        fullAnswer += token;

        // 🚀 關鍵修復：在換行時執行全量渲染以保持 Markdown 序號正確性
        if (token.includes('\n')) {
          // 1. 清除之前渲染過的 AI 回覆區域 (回到 "AI: " 標籤後的第一行)
          if (renderedLines > 0) {
            readline.moveCursor(process.stdout, 0, -renderedLines);
            readline.cursorTo(process.stdout, 4); // 移動到 "AI: " 後方
            readline.clearScreenDown(process.stdout);
          }
          
          // 2. 渲染目前的完整答案
          const rendered = marked(fullAnswer) as string;
          process.stdout.write(rendered);
          
          // 3. 計算新渲染內容的行數
          renderedLines = rendered.split('\n').length - 1;
        } else {
          // 中間 token 直接輸出以維持流暢感
          process.stdout.write(token);
        }
      });

      // 最終結束後，輸出一個換行確保排版正確
      process.stdout.write('\n');

    } catch (e: any) {
      if (activeSpinner?.isSpinning) activeSpinner.stop();
      console.log(chalk.red(`\n❌ 回應出錯: ${e.message}\n`));
    }
  }
};

/**
 * ⚡ 快速提問專用
 */
const quickAsk = async (question?: string) => {
  let inputMessage = question;
  const { inputMessage: resQ } = await inquirer.prompt([{
    type: 'input',
    name: 'inputMessage',
    message: '請輸入您的問題 (或輸入 exit 返回):',
    prefix: '>',
  }]);

  inputMessage = resQ;
  if (!inputMessage || ['exit', 'quit'].includes(inputMessage.toLowerCase())) {
    return;
  }

  const spinner = ora('AI 思考中...').start();
  try {
    const provider = initProvider();
    const agent = createAgent(provider);
    let fullAnswer = '';
    let renderedLines = 0;
    let prefixPrinted = false;

    await agent.askStream(inputMessage!, (token: string) => {
      // 停止 Spinner 動畫
      if (spinner.isSpinning) {
        spinner.stop();
      }

      if (!prefixPrinted) {
        process.stdout.write(chalk.blue('\nAI 回覆: '));
        prefixPrinted = true;
      }

      fullAnswer += token;

      // 🚀 關鍵修復：在換行時執行全量渲染以保持 Markdown 序號正確性
      if (token.includes('\n')) {
        // 1. 移回 AI 回覆的起始位置 ( 'AI 回覆: ' 長度約為 9 )
        if (renderedLines > 0) {
          readline.moveCursor(process.stdout, 0, -renderedLines);
          readline.cursorTo(process.stdout, 9); 
          readline.clearScreenDown(process.stdout);
        }
        
        // 2. 重新渲染整段內容
        const rendered = marked(fullAnswer) as string;
        process.stdout.write(rendered);
        
        // 3. 紀錄當前行數
        renderedLines = rendered.split('\n').length - 1;
      } else {
        // 中間 token 直接輸出以維持流暢感
        process.stdout.write(token);
      }
    });

    // 最終美化校正 (僅輸出換行確保顯示整齊)
    process.stdout.write('\n');

    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...' }]);
  } catch (e: any) {
    spinner.fail(chalk.red(`錯誤: ${e.message}`));
    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...' }]);
  }
};

/**
 * ⚙️ 設定選單
 */
const setupConfig = async () => {
  console.clear();
  printLogo();
  const currentConfig = configManager.getConfig();

  // 🔌 檢查全域指令是否已安裝 (供 UI 顯示)
  let isGlobalLinked = false;
  try {
    execSync('where spc', { stdio: 'ignore' });
    isGlobalLinked = true;
  } catch {
    isGlobalLinked = false;
  }

  const res = await backablePrompt([
    {
      type: 'list',
      name: 'configType',
      message: '選擇要配置的類型:',
      choices: [
        { name: '🔌 模型提供商與 API 設定', value: 'provider' },
        { name: '🛡️ 安全性與權限管理', value: 'security' },
        { name: '📝 編輯全域系統提示詞 (Global Prompt)', value: 'globalPrompt' },
        {
          name: `🚀 全域啟動指令 (spc) [${isGlobalLinked ? chalk.green('已連結') : chalk.red('已斷開')}]`,
          value: 'installGlobal'
        },
        chalk.dim('<< 返回上一級'),
      ],
      prefix: '>',
    },
  ]);

  if ('action' in res && res.action === 'back') return;
  const { configType } = res as any;

  if (typeof configType === 'string' && configType.includes('返回')) return;

  // 🔌 檢查全域指令是否已安裝
  const checkGlobalInstalled = () => {
    try {
      execSync('where spc', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  if (configType === 'installGlobal') {
    const isInstalled = checkGlobalInstalled();
    const actionName = isInstalled ? '解除連結' : '連結';
    const spinner = ora(`正在嘗試${actionName}全域指令...`).start();

    try {
      if (isInstalled) {
        // 💡 使用 package.json 中的正確名稱進行解除連結
        execSync(`npm uninstall -g ${packageJson.name}`, { stdio: 'ignore' });
        // 額外保險：在某些環境下 npm link 需要 unlink
        try { execSync(`npm unlink`, { stdio: 'ignore' }); } catch {}
        
        spinner.succeed(chalk.green('✅ 已成功解除全域指令連結！您可以隨時重新開啟。'));
      } else {
        // 💡 執行 npm link
        execSync('npm link', { stdio: 'ignore' });
        spinner.succeed(chalk.green('✅ 已成功啟用全域指令！您現在可以在任何地方輸入 `spc` 啟動。'));
      }
    } catch (e: any) {
      spinner.fail(chalk.red(`❌ ${actionName}失敗: ${e.message}`));
      console.log(chalk.yellow(`\n💡 建議：`));
      console.log(chalk.dim(`1. 請嘗試以「系統管理員身分 (Administrator)」重新啟動終端機。`));
      console.log(chalk.dim(`2. 您也可以手動輸入: ${chalk.cyan(`npm uninstall -g ${packageJson.name}`)} 試試看。`));
    }
    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...', prefix: '>' }]);
    return setupConfig();
  }

  if (configType === 'security') {
    const sRes = await backablePrompt([
      {
        type: 'list',
        name: 'securityAction',
        message: '安全與權限管理:',
        choices: [
          {
            name: `🔓 允許執行指令 (runCommand) [${currentConfig.security?.allowRunCommand ? chalk.green('已開啟') : chalk.red('已關閉')}]`,
            value: 'toggleRun'
          },
          {
            name: `🚀 自動執行模式 (不詢問直接執行) [${currentConfig.security?.autoExecute ? chalk.green('已開啟') : chalk.red('已關閉')}]`,
            value: 'toggleAuto'
          },
          chalk.dim('<< 返回上一級'),
        ],
        prefix: '>',
      },
    ]);

    if ('action' in sRes && sRes.action === 'back') return setupConfig();
    const { securityAction } = sRes as any;
    if (typeof securityAction === 'string' && securityAction.includes('返回')) return setupConfig();

    if (securityAction === 'toggleRun') {
      configManager.updateSecurityConfig({
        ...currentConfig.security!,
        allowRunCommand: !currentConfig.security?.allowRunCommand
      });
    } else if (securityAction === 'toggleAuto') {
      if (!currentConfig.security?.autoExecute) {
        // 展示極致危險警告 ⚠️
        console.log(chalk.bgRed.white.bold('\n' + '!'.repeat(50)));
        console.log(chalk.red.bold('  ⚠️  極度危險警告 (DANGER WARNING) ⚠️  '));
        console.log(chalk.white('  開啟「自動執行模式」後，AI 將具備以下權限：'));
        console.log(chalk.yellow('  1. 無需您的確認即可執行任何系統指令。'));
        console.log(chalk.yellow('  2. 可能導致檔案被永久刪除或系統設定被更改。'));
        console.log(chalk.white('  請僅在完全信任環境與模型的輸出時才開啟此功能。'));
        console.log(chalk.bgRed.white.bold('!'.repeat(50) + '\n'));

        const { confirmDanger } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDanger',
            message: chalk.red.bold('我已閱讀並理解風險，確定要開啟自動執行嗎？'),
            default: false,
          }
        ]);
        if (!confirmDanger) return setupConfig();
      }

      configManager.updateSecurityConfig({
        ...currentConfig.security!,
        autoExecute: !currentConfig.security?.autoExecute
      });
    }

    console.log(chalk.green('\n✅ 安全設定已更新！\n'));
    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...', prefix: '>' }]);
    return setupConfig();
  }

  if (configType === 'globalPrompt') {
    console.log(chalk.cyan('\n📝 編輯全域系統提示詞 (Global System Prompt)'));
    console.log(chalk.dim('將為您啟動系統編輯器。編輯完成後「儲存並關閉」視窗即會生效。'));
    console.log(chalk.dim('提示：清空內容或輸入 "none" 可還原為系統預設。\n'));

    const configDir = path.dirname(configManager.getConfigPath());
    const tempFilePath = path.join(configDir, '.spc_prompt_tmp.txt');
    const initialContent = currentConfig.globalPrompt || '';
    fs.writeFileSync(tempFilePath, initialContent, 'utf8');

    try {
      const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'nano');
      
      // 🚀 對 Windows 進行特殊處理，確保同步等待
      if (process.platform === 'win32' && editor === 'notepad') {
        execSync(`cmd /c start /wait notepad "${tempFilePath}"`, { stdio: 'inherit' });
      } else {
        execSync(`${editor} "${tempFilePath}"`, { stdio: 'inherit' });
      }

      // 🔄 重置終端機狀態 (防止 Inquirer 卡死關鍵步)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
      }

      const newPrompt = fs.readFileSync(tempFilePath, 'utf8').trim();

      if (newPrompt.toLowerCase() === 'none' || !newPrompt) {
        configManager.updateGlobalPrompt('');
        console.log(chalk.green('\n✅ 已清除全域提示，將還原為系統內建預設。'));
      } else {
        configManager.updateGlobalPrompt(newPrompt);
        console.log(chalk.green('\n✅ 全域系統提示詞已更新！'));
      }
    } catch (e: any) {
      console.log(chalk.red(`\n❌ 編輯器啟動失敗: ${e.message}`));
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...', prefix: '>' }]);
    
    // 🔐 恢復正軌：移除 setTimeout 遞迴，改用標準遞迴以維持正確的呼叫棧
    return await setupConfig();
  }

  // 模型提供商設定邏輯
  const pRes = await backablePrompt([
    {
      type: 'list',
      name: 'providerType',
      message: '選擇要配置的模型提供商:',
      choices: ['openai', 'gemini', 'lmstudio', chalk.dim('<< 返回上一級')],
      default: currentConfig.defaultProvider,
      prefix: '>',
    },
  ]);

  if ('action' in pRes && pRes.action === 'back') return setupConfig();
  const { providerType } = pRes as any;

  if (typeof providerType === 'string' && providerType.includes('返回')) return setupConfig();

  const config = currentConfig.providers[providerType as keyof typeof currentConfig.providers];

  const questions = [
    {
      type: 'input',
      name: 'model',
      message: '模型名稱 (例如: gpt-4o, gemini-1.5-flash):',
      default: config?.model || '',
      prefix: '>',
    },
  ];

  if (providerType !== 'lmstudio') {
    questions.push({
      type: 'input',
      name: 'apiKey',
      message: 'API Key:',
      default: (config as any)?.apiKey || '',
      prefix: '>',
    });
  }

  if (providerType === 'openai' || providerType === 'lmstudio') {
    questions.push({
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL (OpenAI 預設為官方，LM Studio 預設為 localhost):',
      default: (config as any)?.baseUrl || (providerType === 'lmstudio' ? 'http://localhost:1234/v1' : ''),
      prefix: '>',
    });
  }

  const answers = await inquirer.prompt(questions);
  configManager.updateProviderConfig(providerType as any, answers as any);
  configManager.setDefaultProvider(providerType as any);

  console.log(chalk.green('\n✅ 設定更新成功！已切換為預設。\n'));
  await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回選單...', prefix: '>' }]);
  return setupConfig();
};

/**
 * ℹ️ 關於此專案頁面
 */
const showAbout = async () => {
  console.clear();
  printLogo();
  
  const configPath = configManager.getConfigPath();
  
  // 標題與簡介
  console.log(chalk.cyan.bold('\nℹ️  關於此專案 (About)'));
  console.log(chalk.white(`${chalk.bold('Simple CLI')} 是一個致力於提供極致終端機體驗的 AI 代理程式。`));
  console.log(chalk.dim('—'.repeat(process.stdout.columns || 60)));

  // 專案資訊
  console.log(chalk.magenta.bold('\n📊 專案資訊'));
  console.log(`${chalk.yellow('  🚀  專案名稱 :')} ${chalk.white(packageJson.name)}`);
  console.log(`${chalk.yellow('  🔢  當前版本 :')} ${chalk.white(packageJson.version)}`);
  console.log(`${chalk.yellow('  👤  開發團隊 :')} ${chalk.white(packageJson.author)}`);
  console.log(`${chalk.yellow('  ⚖️   授權協議 :')} ${chalk.white('LICENSE.txt')}`);

  // 儲存路徑
  console.log(chalk.magenta.bold('\n📁 系統儲存路徑'));
  console.log(`${chalk.yellow('  ⚙️   設定檔位置 :')}`);
  console.log(chalk.bgBlack.yellow(`  ${configPath}`));
  
  console.log(chalk.dim('\n' + '—'.repeat(process.stdout.columns || 60) + '\n'));
  
  await inquirer.prompt([{ type: 'input', name: 'pause', message: '按回車鍵返回主選單...', prefix: '>' }]);
};

/**
 * 🏠 主互動選單
 */
const mainMenu = async () => {
  while (true) {
    printLogo();
    const res = await backablePrompt([
      {
        type: 'list',
        name: 'action',
        message: '您可以執行以下操作:',
        prefix: '>',
        choices: [
          { name: '💬 開始互動式對話', value: 'chat' },
          { name: '⚡ 快速提問', value: 'ask' },
          { name: '⚙️ 模型與 API 配置', value: 'config' },
          { name: 'ℹ️  關於此專案', value: 'about' },
          { name: '❌ 退出程式', value: 'exit' },
        ],
      },
    ]);

    // Home 頁面忽略 Back
    if ('action' in res && res.action === 'back') continue;
    const { action } = res as any;

    switch (action) {
      case 'chat':
        await startChat();
        break;
      case 'ask':
        await quickAsk();
        break;
      case 'config':
        await setupConfig();
        break;
      case 'about':
        await showAbout();
        break;
      case 'exit':
        console.log(chalk.yellow('\n👋 再見！謝謝使用 Simple CLI。\n'));
        process.exit(0);
    }
  }
};

// --- CLI 指令定義 ---

// 讀取 package.json 以獲取版本號 (確保無論在何處啟動都能正確讀取)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

program
  .name('spc')
  .description('一個強大且模組化的 CLI AI 代理程式')
  .version(packageJson.version)
  .option('-f, --folder [path]', '啟用專案感知模式並指定工作目錄');

// 🧪 輔助函式：處理路徑跳轉與模式切換
const handleFolderOption = () => {
  const options = program.opts();

  // 💡 如果選項存在 (不論是 true 還是字串路徑)，即開啟專案模式
  if (options.folder !== undefined) {
    isProjectMode = true;

    // 如果帶有特定的路徑字串，則執行跳轉
    if (typeof options.folder === 'string' && options.folder !== process.cwd()) {
      try {
        const targetPath = path.resolve(options.folder);
        if (!fs.existsSync(targetPath)) {
          console.log(chalk.red(`❌ 錯誤: 找不到路徑 "${targetPath}"`));
          process.exit(1);
        }
        process.chdir(targetPath);
      } catch (e: any) {
        console.log(chalk.red(`❌ 切換目錄失敗: ${e.message}`));
        process.exit(1);
      }
    }

    console.log(chalk.dim(`\n🛰️  專案模式已啟動: ${chalk.yellow(process.cwd())}`));
  }
};

program
  .command('chat')
  .description('進入互動對話模式')
  .action(async () => {
    handleFolderOption();
    await startChat();
  });

program
  .command('ask [question]')
  .description('快速提問專用指令')
  .action(async (question) => {
    handleFolderOption();
    await quickAsk(question);
  });

program
  .command('config')
  .description('設定 API Key 與模型參數')
  .action(async () => {
    handleFolderOption();
    await setupConfig();
  });

// --- 啟動邏輯 ---

const runInteractive = async () => {
  await loadPlugins();
  handleFolderOption();
  await mainMenu();
};

// 1. 先進行初步解析，確保全域參數 (-f) 被讀取
program.parseOptions(process.argv.slice(2));

// 2. 取得指令與參數
const { args } = program;
const subCommand = args[0];
const validCommands = ['chat', 'ask', 'config', 'help'];

// 3. 判斷進入互動選單還是直接執行指令
if (!subCommand || !validCommands.includes(subCommand)) {
  await runInteractive();
} else {
  await loadPlugins();
  program.parse(process.argv);
}
