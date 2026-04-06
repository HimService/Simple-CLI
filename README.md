# 🚀 Simple CLI (Professional AI Agent Platform)

**Simple CLI** 是一個基於 TypeScript 構建的高級 AI 代理程式平台。它不僅僅是一個對話工具，更是一個具備「動作實施能力」的終端機助手。透過強大的工具連接器 (Tool Calling) 與動態插件系統，您可以讓 AI 直接操作您的檔案系統、執行系統指令，並透過自定義插件無限擴充其能力。

---

## ✨ 核心特性

- 🤖 **Agentic 自動化循環**：具備自主思考與工具調用能力，能連續執行多個任務直到達成目標。
- 🔌 **動態插件系統**：無需修改核心代碼，只需放置 `.js` 檔案即可讓 AI 學會新技能。
- 🛡️ **進階安全模型**：支援「手動確認」與「自動執行 (Autonomous)」雙模式，並具備嚴格的權限過濾。
- 🎨 **極致終端機美學**：實時 Markdown 渲染、流式輸出緩衝補償、動態狀態指示器 (Ora Spinners)。
- ⚙️ **多模型驅動**：原生支援 OpenAI, Google Gemini 以及 本地端模型 (LM Studio/Ollama)。

---

## 🛠️ 開發者指南：如何編寫擴充工具 (Plugins)

本專案最強大的地方在於其 **「零干預插件系統」**。AI 的所有能力本質上都是一個「工具 (Tool)」，您可以透過在 `plugins/` 目錄新增腳本來擴展它。

### 1. 插件存放路徑
將您編寫好的 `.js` 檔案放入專案根目錄的 `plugins/` 資料夾中。

### 2. 插件結構規範
每個插件必須使用 **ESM (ECMAScript Modules)** 格式導出一個包含 `definition` 與 `handler` 的對象：

```javascript
// plugins/myScanner.js
export default {
  // 📜 工具定義：告訴 AI 這是在做什麼、需要什麼參數
  definition: {
    name: 'scan_network',
    description: '掃描本地網路中的設備狀態',
    parameters: {
      type: 'object',
      properties: {
        range: { 
          type: 'string', 
          description: 'IP 範圍，例如: 192.168.1.0/24' 
        }
      },
      required: ['range']
    }
  },

  // ⚙️ 執行邏輯：當 AI 決定調用此工具時，實際執行的代碼
  handler: async ({ range }) => {
    // 您可以在此調用任何 Node.js API 或執行指令
    return `成功掃描範圍 ${range}，發現 3 個活動設備。`;
  }
};
```

### 3. 解構核心組件
-   **`definition.name`**: 工具的唯一標識符，建議使用蛇形命名法 (snake_case)。
-   **`definition.description`**: **關鍵部分！** 請詳細描述此工具的用途。AI 是根據這段文字來判斷「何時」該使用您的工具。
-   **`handler`**: 一個異步函式，接收參數並返回字串。返回的字串將作為「觀測結果」回傳給 AI 進行下一輪思考。

---

## 📦 安裝與快速啟動

### 📋 系統環境要求
- **Node.js**: v18.0.0 或更高版本 (建議使用最新的 LTS 版本)。
- **npm**: 隨 Node.js 安裝的套件管理器。
- **TypeScript**: 專案核心語言，執行前需經過編譯。

### ⚙️ 核心依賴項概覽
安裝時，系統會自動下載以下關鍵套件：
-   **AI SDK**: `@google/generative-ai` & `openai` (支援多模型對話)。
-   **互動介面**: `inquirer` (問答選單) & `ora` (動態載入動畫)。
-   **文字渲染**: `chalk` (顏色標註) & `marked-terminal` (Markdown 終端渲染)。
-   **底層工具**: `commander` (CLI 命令解析) & `conf` (跨平台設定持久化)。
-   **開發工具**: `typescript` & `ts-node` (開發期直接執行 TS)。

### 🚀 逐步安裝指南

1. **安裝所有依賴**:
   在專案根目錄執行以下指令，這將確保所有 AI 模型 SDK 與 CLI 工具正確安裝。
   ```bash
   npm install
   ```

2. **編譯專案**:
   將 TypeScript 代碼轉換為 Node.js 可執行的 JavaScript。
   ```bash
   npm run build
   ```

3. **設置全域指令 (強烈建議)**:
   執行以下指令將 `spc` 連結到系統路徑，讓您可以在**任何資料夾**下啟動它。
   ```bash
   npm link
   ```

4. **初始化配置**:
   設定您的 API Key (如 OpenAI 或 Gemini) 與預設模型。
   ```bash
   spc config
   ```

5. **開始對話**:
   ```bash
   spc chat
   ```

### 🛠️ 開發中啟動 (Developer Mode)
如果您正在修改代碼且不想每次都編譯，可以直接使用 `ts-node` 執行：
```bash
npm run dev -- chat
```

### ✅ 驗證安裝
您可以執行以下指令確認安裝是否成功：
```bash
spc --version
```
若輸出 `1.0.0` 或目前版本號，即代表安裝成功！

---

## 🛡️ 安全性配置

為了保護您的電腦安全，我們設計了分層權限：
-   **手動模式 [預設]**: 當 AI 嘗試執行 `runCommand` (系統指令) 時，會跳出詢問框，獲得您的 `(y/N)` 授權後才執行。
-   **自動模式 (Autonomous)**: 適合信任模型且需要高度自動化的場景。可在 `設定 > 安全性` 中開啟，開啟後 AI 將不再詢問，直接執行指令。

> [!WARNING]
> **開啟自動模式具備極高風險。** 建議僅在受控環境或處理可信任任務時開啟。

---

## 📁 專案目錄結構

```text
.
├── plugins/           # 🔌 外部插件存放區 (JS 格式)
├── src/
│   ├── config/        # ⚙️ 設定檔管理與持久化 (Conf)
│   ├── core/          # 🧠 Agent 核心循環與對話歷史管理
│   ├── providers/     # 🤖 模型提供商實作 (OpenAI, Gemini, etc.)
│   ├── tools/         # 🛠️ 內建核心工具模組 (讀、寫、列表、指令)
│   └── index.ts       # 🚀 CLI 入口點與 UI 渲染邏輯
├── dist/              # 📦 編譯後的代碼輸出
└── package.json
```

## 📄 授權協議
MIT License. 歡迎 Fork 與二次開發！
