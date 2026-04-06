/**
 * 🧮 範例插件: 簡易計算機
 * 
 * 展示如何透過外部 .js 檔案擴充 AI 的功能。
 */

export default {
  definition: {
    name: 'calculator',
    description: '執行基礎數學運算 (加、減、乘、除)',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: '運算類型: add, subtract, multiply, divide'
        },
        a: { type: 'number', description: '第一個數字' },
        b: { type: 'number', description: '第二個數字' }
      },
      required: ['operation', 'a', 'b']
    }
  },
  handler: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return `結果: ${a + b}`;
      case 'subtract': return `結果: ${a - b}`;
      case 'multiply': return `結果: ${a * b}`;
      case 'divide': 
        if (b === 0) return '❌ 錯誤: 除數不能為 0';
        return `結果: ${a / b}`;
      default:
        return '❌ 錯誤: 未知的運算類型';
    }
  }
};
