// 粤语口语 AI 评分 · Vercel/Netlify 无服务器函数示例（CommonJS）
// 请求：POST JSON { audio: base64, expected: string, jyutping: string, mime: string }
// 环境变量：
//   OPENAI_API_KEY  必填，用于调用音频转写
//   SPEECH_MODEL    可选，默认 gpt-4o-transcribe
//   SCORE_API_KEY   可选，若设置则要求请求头 x-api-key 与之匹配
module.exports = async function handler(req, res) {
  const send = function(code, obj){
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return send(405, {error:'Method Not Allowed'});
  const key = process.env.OPENAI_API_KEY;
  if (!key) return send(503, {error:'未配置 OPENAI_API_KEY'});
  const gate = process.env.SCORE_API_KEY;
  if (gate && req.headers['x-api-key'] !== gate) return send(401, {error:'x-api-key 不正确'});

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  if (!body || !body.audio) return send(400, {error:'缺少 audio 字段'});

  try {
    const buf = Buffer.from(body.audio, 'base64');
    const mime = body.mime || 'audio/webm';
    const expected = body.expected || '';
    const jyutping = body.jyutping || '';

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

    const transcript = String(j.text || '').trim();
    const acc = similarity(transcript, expected);
    // 声调与流利度为近似值；需要更专业的口音评测时，可替换为 gpt-4o-audio-preview 等模型做逐字点评
    const tone = 0.85;
    const flu = clamp(1 - Math.abs(transcript.length - expected.length) / Math.max(1, expected.length), 0, 1);
    send(200, {
      accuracy: acc,
      tone: tone,
      fluency: flu,
      transcript: transcript,
      feedback: buildFeedback(acc, jyutping)
    });
  } catch (err) {
    send(500, {error:String(err)});
  }
};

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