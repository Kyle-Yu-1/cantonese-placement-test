// 自信度 AI 复核 · Vercel 无服务器函数
// POST { transcript, features: { rmsMean, endHold, fillers, rate, pitchVar, weakWords } }
// 环境变量：
//   DEEPSEEK_API_KEY 必填
//   CONF_API_KEY     可选，设置后要求请求头 x-api-key 与之匹配
module.exports = async function handler(req, res) {
  const send = function(code, obj){
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return send(405, {error:'Method Not Allowed'});

  const gate = process.env.CONF_API_KEY || process.env.SCORE_API_KEY;
  if (gate && req.headers['x-api-key'] !== gate) return send(401, {error:'x-api-key 不正确'});

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return send(503, {error:'未配置 DEEPSEEK_API_KEY'});

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  if (!body) return send(400, {error:'缺少请求体'});

  const transcript = String(body.transcript || '').trim();
  if (!transcript) return send(400, {error:'缺少 transcript'});

  const f = body.features || {};
  const feats = [
    f.rmsMean == null ? '无' : '平均响度RMS=' + (+f.rmsMean).toFixed(3),
    f.endHold == null ? '无' : '结尾能量保持=' + Math.round((+f.endHold) * 100) + '%',
    '填充词=' + ((f.fillers == null ? 0 : +f.fillers)) + '个',
    f.rate == null ? '无' : '语速=' + Math.round(+f.rate) + '字/分',
    f.pitchVar == null ? '无' : '音高波动CV=' + Math.round((+f.pitchVar) * 100) + '%',
    '弱化词=' + ((f.weakWords == null ? 0 : +f.weakWords)) + '个'
  ].join('；');

  const system = '你是严格的演讲自信度评审。根据学习者的中文机械产品介绍稿及其声学特征，评估其表达"自信度"（0到100整数）。评判依据：响度是否足够、结尾是否保持、填充词多少、语速是否干脆、语调是否有起伏、用词是否确定。给一句中文理由和一句可执行建议。只输出 JSON：{"confidence":0到100整数,"rationale":"理由","advice":"建议"}，不要输出其他任何内容。';
  const user = '介绍稿：' + transcript + '\n声学特征：' + feats;

  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        temperature: 0
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
    const raw = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const s = JSON.parse(cleaned);
    return send(200, {
      confidence: Math.max(0, Math.min(100, Math.round(Number(s.confidence)))),
      rationale: String(s.rationale || ''),
      advice: String(s.advice || '')
    });
  } catch (err) {
    return send(500, { error: String(err) });
  }
};