# 🔌 Simple CLI 插件開發完全指南 (Plugin Guide)

本指南旨在幫助開發者了解如何為 Simple CLI 編寫與整合自定義工具模組。透過插件系統，您可以讓 AI 具備操作任何 API、資料庫或系統資源的能力。

---

## ⚡ 快速開始

所有插件皆放置於根目錄的 `plugins/` 資料夾下，並以 `.js` 作為副檔名。系統會在啟動時自動掃描並載入。

### 基本模版 (Template)

```javascript
export default {
  // 📜 工具定義：定義 AI 如何看這項工具
  definition: {
    name: 'custom_tool',
    description: '此工具的詳細用途描述',
    parameters: {
      type: 'object',
      properties: {
        arg1: { type: 'string', description: '參數描述' }
      },
      required: ['arg1']
    },
    // 🛡️ 安全標記 (關鍵配置)
    isSensitive: false 
  },

  // ⚙️ 執行邏輯：實際執行的代碼
  handler: async ({ arg1 }) => {
    return `執行結果: ${arg1}`;
  }
};
```

---

## 🛡️ 安全控管：`isSensitive` 配置

這是您在開發涉及系統修改、檔案刪除或敏感資訊存取工具時最重要的配置項。

### 1. 什麼是 `isSensitive`？
當您將此屬性設為 `true` 時，Simple CLI 將會觸發安全攔截機制：
-   **手動模式下**：AI 在執行此工具前，終端機會強制跳出詢問框，要求用戶按下 `Yes` 才會執行。
-   **自動執行模式下**：系統會直接執行並通知用戶。

### 2. 何時該設為 `true`？
-   **檔案操作**：如刪除檔案、格式化資料。
-   **系統控制**：重啟電腦、暫停服務。
-   **外部請求**：發送具備副作用的 POST 請求（例如下單、刪除帳號）。

> [!IMPORTANT]
> 內建的 `runCommand` 工具預設即具備最高權限的敏感保護，不論您的插件如何定義，它永遠都會受到安全過濾。

---

## 📝 設計精要 (Best Practices)

### 1. 語義化的 `description`
AI 是透過工具描述來判斷「現在適不適合用這個」。
-   **不好的描述**：`"這是一個讀取資訊的工具"` (太模糊)
-   **好的描述**：`"當用戶需要得知伺服器當前的 CPU 負載與記憶體剩餘空間時，調用此工具。"` (具備場景描述)

### 2. 參數型別定義
我們採用 JSON Schema 格式。確保 `required` 數列中正確列出必要的參數，否則 AI 可能會漏傳導致程式崩潰。

### 3. 錯誤處理
您的 `handler` 應該具備完善的 `try...catch` 邏輯。如果工具執行失敗，回傳字串應以 `❌` 開頭，這能讓 AI 更清晰地理解執行發生了錯誤。

```javascript
handler: async ({ path }) => {
  try {
    const data = await doSomething(path);
    return `成功: ${data}`;
  } catch (err) {
    return `❌ 執行失敗: ${err.message}`;
  }
}
```

---

## 🚀 進階：結合其他工具
您的插件回傳的「字串」不一定要是最終結果，它也可以是給 AI 的指令或數據片段，讓 AI 進一步處理。

**現在，試著寫下您的第一個 `isSensitive: true` 插件，看看 Simple CLI 是如何保護您的系統吧！**
