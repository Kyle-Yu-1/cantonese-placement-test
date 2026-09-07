// 粤语口语 AI 评分 · Vercel 无服务器函数
// 两种模式：
//   A) 请求体含 transcript（浏览器语音识别结果）→ DeepSeek 大模型评分（主用）
//   B) 请求体含 audio（base64 录音）→ OpenAI 转写 + 文本相似度（可选兼容）
// 环境变量：
//   DEEPSEEK_API_KEY 必填（模式 A）
//   DEEPSEEK_MODEL   可选，默认 deepseek-chat
//   OPENAI_API_KEY   可选（模式 B）
//   SPEECH_MODEL     可选，默认 gpt-4o-transcribe
//   SCORE_API_KEY    可选，若设置则要求请求头 x-api-key 与之匹配
// redeploy: DEEPSEEK enabled
module.exports = async function handler(req, res) {
  const send = function(code, obj){
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return send(405, {error:'Method Not Allowed'});
  const gate = process.env.SCORE_API_KEY;
  if (gate && req.headers['x-api-key'] !== gate) return send(401, {error:'x-api-key 不正确'});

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  if (!body) return send(400, {error:'缺少请求体'});

  const transcript = (body.transcript || '').trim();
  const expected = (body.expected || '').trim();
  const jyutping = (body.jyutping || '').trim();

  // 模式 A：DeepSeek 评分
  if (transcript) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return send(503, {error:'未配置 DEEPSEEK_API_KEY'});
    try {
      return send(200, await scoreWithDeepseek(key, transcript, expected, jyutping));
    } catch (err) {
      return send(500, {error:String(err)});
    }
  }

  // 模式 B：OpenAI 转写兼容
  if (body.audio) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return send(503, {error:'未配置 OPENAI_API_KEY'});
    try {
      const buf = Buffer.from(body.audio, 'base64');
      const mime = body.mime || 'audio/webm';
      const form = new FormData();
      form.append('file', new Blob([buf], {type:mime}), 'rec.webm');
      form.append('model', process.env.SPEECH_MODEL || 'gpt-4o-transcribe');
      form.append('language', 'yue');
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:'POST',
        headers:{ Authorization:'Bearer '+key },
        body:form
      });
      const j = await r.json();
      if (!r.ok) return send(r.status, {error:(j && j.error && j.error.message) || ('HTTP '+r.status)});
      const t = String(j.text || '').trim();
      const acc = similarity(t, expected);
      const flu = clamp(1 - Math.abs(t.length - expected.length) / Math.max(1, expected.length), 0, 1);
      return send(200, { accuracy:acc, tone:0.85, fluency:flu, transcript:t, feedback:buildFeedback(acc, jyutping) });
    } catch (err) {
      return send(500, {error:String(err)});
    }
  }

  return send(400, {error:'缺少 transcript 或 audio 字段'});
};

async function scoreWithDeepseek(key, transcript, expected, jyutping){
  const system = '你是严格的粤语口语评分器。根据“示范文本+粤拼”与“学习者识别文本”，评估发音准确度、声调准确度、流利度，并给出一句中文改进建议。只输出 JSON：{"accuracy":0到100整数,"tone":0到100整数,"fluency":0到100整数,"feedback":"建议"}，不要输出其他任何内容。';
  const user = '示范文本：' + (expected || '（无）') + '\n粤拼：' + (jyutping || '（无）') + '\n学习者识别文本：' + transcript;
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method:'POST',
    headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
    body:JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages:[ { role:'system', content:system }, { role:'user', content:user } ],
      temperature:0
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP '+r.status));
  const raw = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  const cleaned = raw.replace(/```json/g,'').replace(/```/g,'').trim();
  const s = JSON.parse(cleaned);
  const n = function(v){ v = Number(v); if (v > 1) v = v / 100; return clamp(v, 0, 1); };
  return {
    accuracy: n(s.accuracy),
    tone: n(s.tone),
    fluency: n(s.fluency),
    transcript: transcript,
    feedback: String(s.feedback || '')
  };
}

function norm(s){ return String(s || '').replace(/[\s，。！？、,.!?'"“”‘’]/g, '').toLowerCase(); }
function similarity(a, b){
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  const n = a.length, m = b.length;
  const dp = Array.from({length:n+1}, function(){ return new Array(m+1).fill(0); });
  for (let i = 1; i <= n; i++){
    for (let j = 1; j <= m; j++){
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[n][m] / Math.max(n, m);
}
function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
function buildFeedback(acc, jp){
  if (acc >= 0.9) return '发音很清晰，和示范基本一致。';
  if (acc >= 0.7) return '大部分内容能听清，注意逐字对齐示范。';
  return '识别率偏低，建议先慢速跟读，对照粤拼（'+jp+'）逐词练习。';
}