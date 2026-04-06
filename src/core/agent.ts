import { LLMProvider, Message } from '../providers/common/provider.js';
import { allTools, allToolDefinitions, toolLogger } from '../tools/index.js';

export interface AgentOptions {
  security?: {
    allowRunCommand: boolean;
    autoExecute: boolean;
  };
  isProjectMode?: boolean; // 🆕 新增：標記是否開啟專案感知模式
  projectRules?: string;   // 🆕 新增：由專案根目錄讀取的自定義規範 (例如 SPC.md)
}

/**
 * 🕵️ AI 代理核心
 * 
 * 負責管理對話歷史、引導模型回答，
 * 並處理工具調用 (Tool Calling) 的自動化循環。
 */
export class AIAgent {
  private history: Message[] = [];
  private provider: LLMProvider;
  private options: AgentOptions;

  // 🧠 核心系統指令：定義 AI 的靈魂與行為準則
  private readonly DEFAULT_SYSTEM_PROMPT = `你是一個專業、高效且具備實作能力的 CLI AI 代理人 (CLI AI Agent)。
你的目標是協助使用者在終端機環境中完成任務、撰寫程式碼並自動化流程。

# 🛠️ 你的工具能力 (Capabilities)
你擁有以下實體工具，可以對使用者的檔案系統進行真實操作：
1. readFile: 讀取本地檔案內容。
2. writeFile: 寫入或修改本地檔案。
3. listFiles: 查看目錄結構與檔案列表。
4. runCommand: 在終端機中執行系統指令（npm, git, dir, python 等）。

# ⚖️ 行為準則 (Guidelines)
- **拒絕推託**：絕對禁止說「我只是一個 AI，無法操作電腦」。你有工具，請直接使用。
- **觀察優先**：面對問題時，請優先使用 listFiles 或 readFile 來獲取真實資訊，不要憑空假設。
- **目標導向**：如果任務需要多個步驟，請主動連續調用工具循環 (Loop) 直到完成目標。
- **環境意識**：你就在使用者的電腦裡，請直接依據路徑處理，代碼應具備專業度與錯誤處理。
- **安全性**：執行指令時請確保語法正確。`;

  // 定義工具執行時的對調函式 (供 UI 顯示狀態)
  public onToolCall?: (toolName: string, args: any) => void;
  public onToolResult?: (toolName: string, result: string) => void;
  // 定義敏感工具執行前的確認請求
  public onConfirmTool?: (toolName: string, args: any) => Promise<boolean>;

  constructor(provider: LLMProvider, options: AgentOptions = {}, systemPrompt?: string) {
    this.provider = provider;
    this.options = options;
    
    // 初始化系統指令
    const finalSystemPrompt = systemPrompt || this.DEFAULT_SYSTEM_PROMPT;
    
    // 🏠 動態注入專案路徑感知 (僅在專案模式下啟用)
    let extraContext = '';
    if (this.options.isProjectMode) {
      extraContext = `\n\n# 當前專案上下文\n- 當前所處的專案目錄 (CWD): ${process.cwd()}\n- 你所有的檔案操作與指令執行都應以此目錄為基準路徑。`;
      
      // 🧠 注入專案自定義守則 (如果有的話)
      if (this.options.projectRules) {
        extraContext += `\n\n# 🛡️ 專案開發規範 (SPC.md)\n${this.options.projectRules}`;
      }
    }
    
    this.history.push({ role: 'system', content: finalSystemPrompt + extraContext });
  }

  /**
   * 🤖 核心代理循環 (遍歷工具調用直到獲得最終回應)
   */
  private async runAgentLoop(): Promise<Message> {
    while (true) {
      // 1. 詢問模型
      const response = await this.provider.chat(this.history, allToolDefinitions);
      
      // 2. 如果沒有工具調用，這就是最終回答
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return response;
      }

      // 3. 將模型的工具調用訊息加入歷史 (模型要求執行)
      this.history.push(response);

      // 4. 執行各個工具調用
      for (const toolCall of response.toolCalls) {
        const { name, arguments: argsJson } = toolCall.function;
        const args = JSON.parse(argsJson);

        // --- 安全性攔截 🛡️ ---
        let result = '';
        
        // 🔍 動態尋找工具定義，確認是否標記為「敏感操作」
        const toolDef = allToolDefinitions.find(d => d.name === name);
        const isSensitive = name === 'runCommand' || toolDef?.isSensitive;

        if (isSensitive) {
          // 檢查權限
          if (!this.options.security?.allowRunCommand && name === 'runCommand') {
            result = '❌ 權限被拒絕: 自定義指令執行功能目前已關閉，請聯絡使用者在設定中開啟。';
          } else if (this.options.security?.autoExecute) {
            // 🚀 自動執行模式：跳過詢問，直接執行
            result = '';
          } else if (this.onConfirmTool) {
            // 需要人工確認
            const confirmed = await this.onConfirmTool(name, args);
            if (!confirmed) {
              result = '❌ 使用者拒絕了此指令的執行。';
            }
          }
        }

        // 如果還沒有結果 (即通過了上面的檢查或是不需要檢查的工具)
        if (!result) {
          // 通知 UI 正在執行工具
          if (this.onToolCall) this.onToolCall(name, args);

          // 執行本地代碼 (從模組化註冊中心尋找)
          const toolHandler = allTools[name];
          if (toolHandler) {
            result = await toolHandler(args);
          } else {
            result = `❌ 找不到工具: ${name}`;
          }
        }

        // 📝 記錄日誌 (不論成功失敗)
        await toolLogger.log(name, args, result);

        // 通知 UI 工具執行結果
        if (this.onToolResult) this.onToolResult(name, result);

        // 5. 將工具執行結果加入歷史
        this.history.push({
          role: 'tool',
          content: result,
          name: name,
          toolCallId: toolCall.id,
        });
      }

      // 6. 繼續循環，將執行結果傳回給模型
    }
  }

  /**
   * 提問並獲得回應 (不使用串流)
   */
  async ask(question: string): Promise<string> {
    this.history.push({ role: 'user', content: question });
    const response = await this.runAgentLoop();
    this.history.push(response);
    return response.content;
  }

  /**
   * 提問並以串流方式處理
   * 💡 注意：如果有工具調用，會先在後台完成所有工具循環，最後再將最終文字結果串流輸出。
   */
  async askStream(question: string, onToken: (token: string) => void): Promise<string> {
    this.history.push({ role: 'user', content: question });
    
    // 1. 先運行代理循環處理可能的工具調用
    const finalResponse = await this.runAgentLoop();

    // 2. 如果最後有文字內容，模擬串流輸出 (或在此處優化為真串流，目前為保持一致性採取的簡化方案)
    // 💡 注意：正規表達式 [\s\S] 能確保換行符號也能被正確捕獲，防止新行消失。
    if (finalResponse.content) {
      const tokens = finalResponse.content.match(/[\s\S]{1,5}/g) || [finalResponse.content];
      for (const token of tokens) {
        onToken(token);
        await new Promise(resolve => setTimeout(resolve, 15)); // 微小延遲模擬串流感
      }
    }

    this.history.push(finalResponse);
    return finalResponse.content;
  }

  /**
   * 📜 獲取當前對話歷史
   */
  getHistory(): Message[] {
    return this.history;
  }

  /**
   * 🧹 清除對話歷史
   */
  clearHistory() {
    this.history = this.history.filter(m => m.role === 'system');
  }
}
