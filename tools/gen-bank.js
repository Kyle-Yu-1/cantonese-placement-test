// 从 js/question-bank.js 生成 question-bank.json（单一数据源）
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../js/question-bank.js', 'utf8'));
const bank = window.QUESTION_BANK;
fs.writeFileSync(__dirname + '/../question-bank.json', JSON.stringify(bank, null, 2));
console.log('generated question-bank.json with', bank.length, 'items');