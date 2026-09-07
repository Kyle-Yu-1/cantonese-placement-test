# 粤语能力定位测验（Cantonese Placement Test）

一个可离线运行的**自适应粤语水平定位测验**网页。从零基础起步，按答题表现逐题小幅调整难度，快速定位使用者的粤语等级（L1–L6），并给出各维度分项分、诊断建议、错题本与 14 天学习计划。

## 文件结构

- `index.html` 入口页面
- `styles.css` 样式
- `js/question-bank.js` 内置题库（单一数据源，48 题，L1–L6 × 6 个维度）
- `js/app.js` 核心逻辑：账号、存储、粤语语音合成、录音、Rasch 自适应引擎
- `js/app-views.js` 界面流程：测试、报告、错题本、趋势、设置、评分规则
- `question-bank.json` 由 `tools/gen-bank.js` 从题库源自动生成的 JSON 版（用于编辑/导入）
- `api/score.js` AI 口语评分的无服务器函数示例（Vercel/Netlify + OpenAI）
- `tools/gen-bank.js` 题库生成脚本

## 快速开始（本地演示模式）

直接用浏览器打开 `index.html` 即可（建议 Chrome / Edge）。首次使用先注册一个本地账号，然后点击「开始测试」。

- 登录/成绩只保存在**当前浏览器**（localStorage）。
- 跨设备使用：在「设置 → 数据」里导出 JSON，再到另一台设备导入。
- 题库可导入/导出：修改 `question-bank.json` 后，在「设置 → 题库」导入即可生效。

## 功能一览

- 自适应定位：从 L1 起步，相邻题难度跨度小；EAP 后验标准差 ≤ 0.3 时提前结束（最少 8 题、最多 30 题）。
- 维度覆盖：听力 30%、口语 30%、词汇 15%、语法 10%、粤拼/汉字 10%、俗语地道表达 5%。
- 题型：选择、填空、连线、听力（浏览器粤语 TTS）、口语（录音 + 评分）。
- 报告：总分、L1–L6 等级、95% 置信区间、雷达图/分项分、强弱项诊断、建议、14 天学习计划、逐题回顾。
- 错题本：自动收录、重练模式（答对减次数、答错加次数）。
- 历史趋势：每次定位分折线图与记录列表。
- 粤拼开关：所有粤语词句附 Jyutping，可一键显示/隐藏。

## 浏览器语音与降级

- 听力与口语示范使用浏览器 `speechSynthesis`，自动选择 `zh-HK`/粤语音色（如 Windows 的 Tracy、Danny）。
- 若浏览器没有粤语音色，会自动显示「文字 + 粤拼」降级方案，不中断测试。
- 口语录音使用 `getUserMedia`，首次使用需要允许麦克风权限。

## AI 口语评分（可选，对应需求「AI 接口」）

1. 把 `api/score.js` 部署为无服务器函数（如 Vercel，路径 `/api/score`）。
2. 配置环境变量：`OPENAI_API_KEY`（必填）、`SPEECH_MODEL`（默认 `gpt-4o-transcribe`）、`SCORE_API_KEY`（可选，作为请求密钥）。
3. 在网页「设置 → AI 口语评分接口」填入函数地址与 `SCORE_API_KEY`。
4. 口语题录音后会自动上传评分；未配置或失败时回退为「示范对照 + 手动打分」。

说明：示例函数用转写文本与示范文本的相似度近似「发音准确度」，声调/流利度为近似值；需要更精细的口音评测时，可将 `api/score.js` 换成 `gpt-4o-audio-preview` 等音频理解模型做逐字点评。

## 题库格式（question-bank.json）

```json
{
  "id": "L1-01",
  "level": 1,
  "difficulty": -3.9,
  "dimension": "vocabulary",
  "type": "mc",
  "prompt": "「你好」是什么意思？",
  "text": "你好",
  "jyutping": "nei5 hou2",
  "options": ["谢谢", "你好", "再见", "对不起"],
  "answer": 1,
  "explanation": "粤语最常用的问候语。"
}
```

字段说明：`difficulty` 与能力 θ 同尺度（-5～+5）；`type` 取值 `mc / fill / match / listening / speaking`；`fill` 可加 `accept` 数组放可接受答案；`match` 用 `pairs: [{left,right}]`；`listening` 用 `audioText`；`speaking` 用 `text + jyutping` 作示范。

修改题库后运行 `node tools/gen-bank.js` 同步生成 JSON，或在网页「设置 → 题库 → 导入题库 JSON」直接更新。

## 评分算法

单参数 logistic（Rasch）：P(对)=1/(1+e^(难度-θ))，θ 先验均值 -3.5（零基础），EAP 逐题更新。能力分=(θ+5)×10（0–100）。等级阈值：L1<23.3，L2<36.7，L3<50，L4<63.3，L5<76.7，其余为 L6。详见网页内「评分规则」。

## 已知限制与后续升级

- 本地演示模式没有服务端账号/云同步；正式版可接 Supabase/Firebase 做邮箱登录与跨设备成绩同步。
- 浏览器粤语 TTS 音色取决于系统；可把 `audioText` 换成真人录音 URL 得到更地道的听力。
- 内置题库 48 题仅作演示，正式使用前请人工审校粤拼与声调，并按同一 schema 扩充题量。