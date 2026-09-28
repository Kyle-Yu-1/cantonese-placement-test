'use strict';
/* 机械产品介绍 · 语音训练（录入 / 打分 / 教学 / 导入更新 Word） */

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DIMS = ['流利度', '准确性', '语言复杂度', '信息完整性', '逻辑结构', '自信度'];
const LS = 'pitch_records';

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); }
function fmtDur(sec){ const m = Math.floor(sec/60), s = Math.floor(sec%60); return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
function loadRecs(){ try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch(e){ return []; } }
function saveRecs(a){ localStorage.setItem(LS, JSON.stringify(a)); }

/* ---------------- tabs ---------------- */
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + btn.dataset.view).classList.remove('hidden');
  if (btn.dataset.view === 'history') renderHistory();
}));

/* ---------------- recording ---------------- */
let recorder = null, recognition = null, liveTimer = 0, recActive = false, lastBlob = null, recSupported = true;
let metrics = { hasAudio:false, rate:0, pauseRatio:0, volumeVar:0, duration:0 };

const SEED = [
  { attempt:1, ts:'2026-09-27T16:19:34+08:00', duration:57, level:'达标', total:19, pct:63.3,
    transcript:'这款瓶盖夹取装置采取了平行夹取的结构，同时在它的操作末端，运用了德国费斯通公司发明的鱼鳍仿生自适应技术。这种技术能够使它的执行末端自动适应不同尺寸大小的瓶盖，与其紧密贴合，增加与瓶盖的接触面积，能够有效地增加摩擦力，防止瓶盖脱落。同时，这款机械臂结构简单，用料精简，适用于大规模批量化商业生产。',
    scores:[3,3,4,4,2,3], flags:['公司名请核对：费斯通 → 费斯托（Festo）','「机械臂」应为「末端执行器」','缺安全要点'], missing:['安全要点'],
    dims:[{score:3,note:'57 秒讲完全稿，语速适中；但出现「与与、它它、能能够」等重复。'},{score:3,note:'公司名与用词待纠正：费斯通→费斯托；机械臂→末端执行器。'},{score:4,note:'连接词与专业术语较丰富。'},{score:4,note:'名称/构成/原理/用途/优势基本覆盖；缺安全要点。'},{score:2,note:'缺「问题→方案」的开场与收尾号召。'},{score:3,note:'由音量/语速波动估算（参考分）。'}] },
  { attempt:2, label:'第 2 次语音练习 · 再次练习（修订稿）录音', ts:'2026-09-27T16:41:00+08:00', duration:81, level:'达标', total:21, pct:70,
    transcript:'原先一代瓶盖夹取装置采取微型夹爪结构，并且由于接触面太滑，气形力把瓶盖往外推，会导致瓶盖在抓取时脱落。为解决这个问题，我们这次采取了平行夹爪结构，并且将费斯通公司的鱼鳍仿生学自适应技术，运用到了夹爪的末端执行器上，使夹爪能够自适应不同尺寸的瓶盖。当夹取瓶盖时，抓取器受力肋条会发生卷曲，使夹爪紧紧紧包裹住瓶盖，增加接触面与摩擦力，防止瓶盖脱落。目前该项目处于样机测试阶段，我们运用3D打印技术将TPU、PLA、PETG材料打印成件并进行组装，目前抓取成功率已经大于95%。',
    scores:[4,2,4,4,4,3], flags:['气形力→楔形力；卷曲→屈曲；费斯通→费斯托；p l a→PLA','缺安全要点'], missing:['安全要点'],
    dims:[{score:4,note:'81 秒约 190 字，语速约 140 字/分钟，节奏平稳。'},{score:2,note:'口述术语待纠正：气形力→楔形力；卷曲→屈曲；费斯通→费斯托；p l a→PLA。'},{score:4,note:'句式多样，连接词与专业术语丰富。'},{score:4,note:'名称/构成/原理/用途/优势与制造数据齐全；缺安全要点。'},{score:4,note:'问题→方案→机制→数据顺序清楚；缺总述与收尾。'},{score:3,note:'文字稿无法观察，中性预估。'}] }
];
function migrateRecords(){
  try { if (localStorage.getItem('pitch_migrate_v2')) return false; } catch(e){ return false; }
  const recs = loadRecs();
  const filtered = recs.filter(r => !(r.attempt === 2 || r.attempt === 3));
  const revised = SEED.find(x => x.attempt === 2);
  if (revised && !filtered.find(r => r.attempt === 2)) filtered.push(revised);
  saveRecs(filtered);
  try { localStorage.setItem('pitch_migrate_v2', '1'); } catch(e){}
  return true;
}
const migratedAtLoad = migrateRecords();
function ensureSeeded(){
  const recs = loadRecs();
  let changed = false;
  SEED.forEach(sd => { if (!recs.find(r => r.attempt === sd.attempt)){ recs.push(sd); changed = true; } });
  if (changed) saveRecs(recs);
}
ensureSeeded();
if (migratedAtLoad){ setTimeout(function(){ syncWord(); }, 800); }

function nextAttempt(){
  const recs = loadRecs();
  return (recs.reduce((m,r) => Math.max(m, Number(r.attempt) || 0), 0) || 0) + 1;
}
function initAttempts(selected){
  const recs = loadRecs();
  const sel = $('#attemptSel');
  const n = nextAttempt();
  sel.innerHTML = '';
  for (let i = 1; i <= Math.max(n, 3); i++) {
    const o = document.createElement('option');
    o.value = i; o.textContent = '第 ' + i + ' 次练习';
    sel.appendChild(o);
  }
  sel.value = String(selected || n);
}
initAttempts();
$('#attemptSel').addEventListener('change', () => {
  const a = Number($('#attemptSel').value);
  const rec = loadRecs().find(r => r.attempt === a);
  if (rec && rec.scores){
    current = rec;
    renderScore();
    switchView('score');
    toast('已载入第 ' + a + ' 次练习（仅查看；新录音会自动存为新轮次，不会覆盖）');
  }
});
// 修正：文字内容存在时即可打分（不强制必须先录音）
const draft = localStorage.getItem('pitch_draft');
if (draft) { $('#transcript').value = draft; $('#btnScore').disabled = false; }
$('#transcript').addEventListener('input', function(){
  const has = $('#transcript').value.trim().length > 0;
  $('#btnScore').disabled = !(has || recActive);
  localStorage.setItem('pitch_draft', $('#transcript').value);
});

$('#btnRec').addEventListener('click', async () => {
  if (recActive) return stopAll();
  $('#btnRec').disabled = true;
  $('#noTranscript').classList.add('hidden');
  $('#liveBox').textContent = '正在请求麦克风…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = {
      stream,
      chunks: [],
      mime: (['audio/webm','audio/mp4','audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || ''),
      rec: null, ctx: null, analyser: null, raf: 0, samples: [], timeBuf: [], pitches: [], start: 0
    };
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    src.connect(analyser);
    recorder.ctx = ctx; recorder.analyser = analyser;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++){ const v = (buf[i]-128)/128; sum += v*v; }
      const rms = Math.sqrt(sum/buf.length);
      recorder.samples.push(rms);
      // 基频（音高）估计：自相关，约每 8 帧估一次
      recorder.pitchTick = (recorder.pitchTick || 0) + 1;
      if (recorder.pitchTick % 8 === 0 && rms > 0.02){
        const fb = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(fb);
        recorder.timeBuf.push(...fb);
        if (recorder.timeBuf.length > 4096) recorder.timeBuf.splice(0, recorder.timeBuf.length - 4096);
        if (recorder.timeBuf.length >= 2048){
          const f0 = estF0(recorder.timeBuf.slice(-2048), ctx.sampleRate);
          if (f0) recorder.pitches.push(f0);
        }
      }
      $('#levelBar').style.width = Math.min(100, rms*260) + '%';
      recorder.raf = requestAnimationFrame(tick);
    };
    tick();
    recorder.rec = new MediaRecorder(stream, recorder.mime ? { mimeType: recorder.mime } : undefined);
    recorder.rec.ondataavailable = e => { if (e.data && e.data.size) recorder.chunks.push(e.data); };
    recorder.rec.start();
    recorder.start = Date.now();
    liveTimer = setInterval(() => { const s = (Date.now()-recorder.start)/1000; $('#recTime').textContent = fmtDur(s); }, 250);

    recSupported = true;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR(); recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = e => {
        let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        $('#liveBox').textContent = t.trim() || '（还在听…）';
        $('#transcript').value = t.trim();
        $('#btnScore').disabled = false;
      };
      recognition.onerror = () => {
        recSupported = false;
        $('#liveBox').textContent = '识别不可用：本浏览器不支持语音识别。录音会照常保存，停止后请粘贴转写或点「本机 Whisper 转写」。';
      };
      try { recognition.start(); }
      catch(e){ recSupported = false; $('#liveBox').textContent = '识别启动失败：录音会照常保存，停止后请粘贴转写或点「本机 Whisper 转写」。'; }
    } else {
      recSupported = false;
      $('#liveBox').textContent = '本浏览器不支持语音识别：录音会照常保存，停止后请粘贴转写或点「本机 Whisper 转写」。';
    }

    recActive = true;
    $('#btnRec').disabled = false;
    $('#btnRec').textContent = '⏹ 停止录音并打分';
    $('#btnScore').disabled = false;
  } catch (err) {
    $('#btnRec').disabled = false;
    $('#btnRec').textContent = '🎙️ 开始录音';
    $('#liveBox').textContent = '无法使用麦克风：' + err.message + '。可直接把转写文本粘贴到下方文本框再打分。';
    toast('无法录音：' + err.message);
    $('#btnScore').disabled = !($('#transcript').value.trim().length > 0);
  }
});

function finalizeAfterStop(){
  $('#btnRec').textContent = '🎙️ 重新录音';
  $('#btnScore').textContent = '打分';
  const text = $('#transcript').value.trim();
  if (!text){
    $('#noTranscript').classList.remove('hidden');
    switchView('record');
    if (lastBlob){
      // 录音停止后自动转写，成功则自动打分
      const st = $('#whisperStatus');
      st.classList.remove('hidden');
      st.textContent = '录音已保存，正在自动用本机 Whisper 转写…';
      runWhisper(lastBlob).then(ok => {
        if (!ok && !$('#transcript').value.trim()){
          st.textContent = '自动转写未成功。补救：① 点上方「本机 Whisper 转写」重试；② 上传录音文件；③ 手动粘贴转写文本。';
        }
      });
    } else {
      $('#transcript').focus();
      toast('没有拿到文字：请粘贴/输入转写，或上传录音文件');
    }
  } else {
    $('#noTranscript').classList.add('hidden');
    doScore();
  }
}

async function stopAll(){
  recActive = false;
  clearInterval(liveTimer);
  try { recognition && recognition.stop(); } catch(e){}
  const buildBlob = () => {
    const cur = recorder;
    if (!cur) { finalizeAfterStop(); return; }
    const sec = (Date.now() - cur.start)/1000;
    const blob = new Blob(cur.chunks || [], { type: cur.mime || 'audio/webm' });
    if (blob.size > 0){
      lastBlob = blob;
      const audio = $('#recAudio'); audio.src = URL.createObjectURL(blob); audio.classList.remove('hidden');
      $('#btnAutoTranscribe').classList.remove('hidden');
    }
    cancelAnimationFrame(cur.raf);
    const samples = cur.samples || [];
    const mean = samples.length ? samples.reduce((a,b)=>a+b,0)/samples.length : 0;
    const varSum = samples.length ? samples.reduce((a,b)=>a+(b-mean)*(b-mean),0)/samples.length : 0;
    const silent = samples.length ? samples.filter(v => v < 0.025).length / samples.length : 0;
    const tailN = Math.max(1, Math.floor(samples.length * 0.15));
    const tail = samples.slice(samples.length - tailN);
    const tailMean = tail.length ? tail.reduce((a,b)=>a+b,0)/tail.length : 0;
    const pitches = recorder.pitches || [];
    const pm = pitches.length ? pitches.reduce((a,b)=>a+b,0)/pitches.length : 0;
    const pvar = pitches.length ? Math.sqrt(pitches.reduce((a,b)=>a+(b-pm)*(b-pm),0)/pitches.length) : 0;
    const text = $('#transcript').value.trim();
    metrics = { hasAudio:true, duration:sec, rate: text ? text.length/sec*60 : 0, pauseRatio: silent, volumeVar: Math.sqrt(varSum), rmsMean: mean, endHold: mean ? tailMean/mean : 1, pitchVar: pm ? pvar/pm : 0 };
    try { cur.stream.getTracks().forEach(t=>t.stop()); cur.ctx.close(); } catch(e){}
    recorder = null;
    finalizeAfterStop();
  };
  if (recorder && recorder.rec && recorder.rec.state !== 'inactive') {
    recorder.rec.onstop = buildBlob;
    try { recorder.rec.stop(); } catch(e){ buildBlob(); }
  } else {
    buildBlob();
  }
}

$('#btnScore').addEventListener('click', () => {
  if (recActive) { stopAll(); return; }
  doScore();
});

// 本机 Whisper 转写兜底（录音按钮与上传文件共用）
let whisperBusy = false;
async function runWhisper(blob){
  if (!blob){ toast('没有可用音频：请先录音或上传文件'); return; }
  if (whisperBusy) return;
  whisperBusy = true;
  const st = $('#whisperStatus');
  st.classList.remove('hidden'); st.textContent = '🔤 正在自动转写（首次可能较慢，请稍候）…';
  $('#liveBox').textContent = '🔤 自动转写中，请稍候…';
  try {
    const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
    const res = await fetch('/api/transcribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ audio: b64, mime: blob.type || 'audio/webm' }) });
    const j = await res.json();
    whisperBusy = false;
    if (j && j.ok && j.text){
      $('#transcript').value = j.text;
      $('#btnScore').disabled = false;
      st.textContent = '✅ 转写完成，已自动打分。';
      $('#liveBox').textContent = '✅ 自动转写完成。';
      doScore();
      return true;
    } else {
      st.textContent = '❌ ' + ((j && j.error) || '转写失败') + '　可点「🔤 自动转写当前录音」重试，或上传/粘贴。';
      return false;
    }
  } catch(e){
    whisperBusy = false;
    if (location.protocol === 'file:') st.textContent = '⚠️ 当前是 file:// 打开，无法调用本机转写。请用「启动机械产品介绍训练.bat」打开。';
    else st.textContent = '❌ 本地转写服务不可用，可改为上传或粘贴转写文本。';
    return false;
  }
}

$('#btnWhisper').addEventListener('click', () => { runWhisper(lastBlob); });
$('#btnAutoTranscribe').addEventListener('click', () => { runWhisper(lastBlob); });

// 上传录音文件：录音失败时的备用语音录入
$('#btnUpload').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', () => {
  const f = ($('#fileInput').files || [])[0];
  if (!f) return;
  lastBlob = f;
  const audio = $('#recAudio');
  audio.src = URL.createObjectURL(f);
  audio.classList.remove('hidden');
  $('#noTranscript').classList.add('hidden');
  $('#liveBox').textContent = '已载入录音文件：' + f.name + '（' + Math.round(f.size/1024) + ' KB）';
  toast('正在转写上传的录音…');
  runWhisper(f);
});

function doScore(){
  const text = $('#transcript').value.trim();
  if (!text) { toast('请先录音或粘贴转写文本'); finalizeAfterStop(); return; }
  $('#noTranscript').classList.add('hidden');
  scoreAndShow(text, metrics);
}

/* ---------------- scoring engine ---------------- */
function estF0(buf, sampleRate){
  // 归一化自相关基频估计（70–350 Hz）
  const n = buf.length;
  let e0 = 0; for (let i=0;i<n;i++) e0 += buf[i]*buf[i];
  if (e0 <= 0) return null;
  const rms = Math.sqrt(e0/n);
  if (rms < 0.01) return null;
  const minLag = Math.max(2, Math.floor(sampleRate/350));
  const maxLag = Math.min(n-1, Math.floor(sampleRate/70));
  let bestLag = -1, best = -1;
  for (let lag=minLag; lag<=maxLag; lag++){
    let s = 0;
    for (let i=0;i<n-lag;i++) s += buf[i]*buf[i+lag];
    if (s > best){ best = s; bestLag = lag; }
  }
  if (bestLag < 0 || best/e0 < 0.4) return null;
  const f0 = sampleRate/bestLag;
  if (f0 < 70 || f0 > 350) return null;
  return f0;
}

function analyze(text, met){
  const flags = [];
  const hard = [
    { re:/气形力/, msg:'“气形力”应为“楔形力”（wedge force）' },
    { re:/卷曲/, msg:'建议改用术语“屈曲”（buckling）' },
    { re:/\bp\s*l\s*a\b/i, msg:'“p l a”应写作“PLA”' },
    { re:/费斯通/, msg:'公司名请核对：Festo 通用中文名为“费斯托”' },
    { re:/机械臂/, msg:'本装置是“末端执行器”，说“机械臂”范围偏大' },
  ];
  for (const c of hard) if (c.re.test(text)) flags.push(c.msg);
  const reps = text.match(/(.)\1{2,}/g) || [];
  if (reps.length) flags.push('重复字词：' + Array.from(new Set(reps)).join('、'));
  const fillers = text.match(/呃|嗯嗯|然后然后|这个这个|那个那个|就是说|\bem\b/gi) || [];
  if (fillers.length) flags.push('口头禅：' + Array.from(new Set(fillers)).join('、'));

  const groups = [
    { name:'名称', re:/瓶盖|夹取|夹爪|末端执行器/ },
    { name:'构成', re:/平行夹爪|夹爪|手指|底座|连杆|肋条|结构/ },
    { name:'原理', re:/肋条|屈曲|卷曲|包覆|包裹|finray|鱼鳍|仿生|自适应|贴合|受力/i },
    { name:'用途', re:/夹取|抓取|瓶盖|装配|拧盖/ },
    { name:'优势', re:/摩擦|防脱落|脱落|接触面积|不同尺寸|自适应|防滑/ },
    { name:'安全要点', re:/打滑|损坏|负载|安全|失效|超载|寿命/ },
  ];
  let covered = 0; const missing = [];
  for (const g of groups){ if (g.re.test(text)) covered++; else missing.push(g.name); }
  const infoScore = covered >= 6 ? 5 : covered >= 5 ? 4 : covered >= 3 ? 3 : covered >= 2 ? 2 : 1;

  const segs = [
    { name:'问题', re:/原先|现有|问题|脱落|打滑|太滑|缺点|不足/ },
    { name:'方案', re:/解决|改用|采用|设计|采取|新增|加上/ },
    { name:'机制', re:/当|受力|肋条|屈曲|卷曲|包覆|包裹|贴合|接触/ },
    { name:'制造与测试', re:/打印|材料|tpU|pla|petg|组装|测试|成功率|95|样机/i },
    { name:'收尾', re:/下一步|未来|量产|欢迎|谢谢|支持|安全/ },
  ];
  let last = -1, inOrder = 0;
  for (const s of segs){ const m = text.search(s.re); if (m >= 0){ if (m > last) inOrder++; last = m; } }
  const structScore = inOrder >= 4 ? 4 : inOrder >= 3 ? 3 : inOrder >= 2 ? 2 : 1;

  const connectors = (text.match(/因为|因此|所以|同时|并且|此外|由于|当|目前|于是|由此/g) || []).length;
  const terms = (text.match(/平行|夹爪|肋条|屈曲|包覆|仿生|3D|TPU|PLA|PETG|成功率|摩擦|末端执行器|自适应/gi) || []).length;
  const sentences = text.split(/[。！？!?；;]/).filter(s => s.trim().length > 1);
  const avgLen = sentences.length ? Math.round(text.replace(/[，、]/g,'').length / sentences.length) : 0;
  let compScore = 1;
  if (connectors >= 3 && terms >= 6) compScore = 5;
  else if (connectors >= 2 && terms >= 4) compScore = 4;
  else if (connectors >= 1 && terms >= 3) compScore = 3;
  else if (connectors >= 1 || terms >= 2) compScore = 2;

  let accScore = 5 - hard.filter(c => c.re.test(text)).length - Math.min(reps.length, 1) - Math.min(fillers.length, 1);
  accScore = Math.max(1, Math.min(4, accScore));

  let fluScore = 3;
  if (met && met.hasAudio && met.rate > 0){
    const r = met.rate;
    fluScore = r >= 200 ? 5 : r >= 140 ? 4 : r >= 90 ? 3 : r >= 50 ? 2 : 1;
    if (met.pauseRatio > 0.35) fluScore = Math.max(1, fluScore - 1);
    if (reps.length) fluScore = Math.max(1, fluScore - 1);
  } else {
    fluScore = reps.length ? 2 : 3;
  }

  const confFillerCount = fillers.length;
  const weakWords = (text.match(/可能|大概|也许|应该吧|我觉得吧|差不多|好像是|或许/g) || []).length;
  let confScore, confNote, confSub = [], confFeatures;
  if (met && met.hasAudio && typeof met.rmsMean === 'number'){
    const e1 = met.rmsMean >= 0.03 ? 1 : met.rmsMean >= 0.015 ? 0 : -1;
    const e2 = met.endHold >= 0.8 ? 1 : met.endHold >= 0.5 ? 0 : -1;
    const e3 = confFillerCount === 0 ? 1 : confFillerCount <= 2 ? 0 : -1;
    const e4 = met.rate > 160 ? 1 : met.rate < 90 ? -1 : 0;
    const e5 = met.pitchVar > 0.06 ? 1 : met.pitchVar < 0.02 ? -1 : 0;
    confScore = Math.max(1, Math.min(5, 3 + e1 + e2 + e3 + e4 + e5));
    confSub = [
      { k:'平均响度', v:e1, d:'RMS 均值 ' + (met.rmsMean*100).toFixed(1) + '（≥3 为足）', w: e1>0?'声音够响亮':e1<0?'整体偏轻，底气不足':'音量一般' },
      { k:'结尾保持', v:e2, d:'末15%能量/全篇均值 = ' + (met.endHold*100).toFixed(0) + '%', w: e2>0?'收尾不塌':e2<0?'结尾音量衰减，显犹豫':'收尾尚可' },
      { k:'填充词', v:e3, d:'检测到 ' + confFillerCount + ' 个', w: e3>0?'干净利落':e3<0?'填充词偏多':'有少量填充词' },
      { k:'语速', v:e4, d:Math.round(met.rate) + ' 字/分', w: e4>0?'语速干脆':e4<0?'偏慢拖沓':'速度适中' },
      { k:'语调起伏', v:e5, d:'音高波动 CV = ' + (met.pitchVar*100).toFixed(1) + '%', w: e5>0?'有强调起伏':e5<0?'语调平淡':'起伏一般' },
    ];
    confFeatures = { rmsMean: met.rmsMean, endHold: met.endHold, fillers: confFillerCount, rate: met.rate, pitchVar: met.pitchVar, weakWords: weakWords };
    confNote = '由响度/收尾/填充词/语速/语调 5 项估算，可点「AI 复核」二次确认';
  } else {
    const e3 = confFillerCount === 0 ? 1 : confFillerCount <= 2 ? 0 : -1;
    const w = weakWords === 0 ? 0 : weakWords <= 2 ? -1 : -2;
    confScore = Math.max(1, Math.min(5, 3 + e3 + w));
    confSub = [
      { k:'填充词', v:e3, d:'检测到 ' + confFillerCount + ' 个', w: e3>0?'干净利落':e3<0?'填充词偏多':'有少量填充词' },
      { k:'弱化词', v:w, d:'「可能/大概/我觉得吧」× ' + weakWords, w: w===0?'语气确定':weakWords<=2?'略有犹豫':'犹豫词较多' },
    ];
    confFeatures = { rmsMean: null, endHold: null, fillers: confFillerCount, rate: null, pitchVar: null, weakWords: weakWords };
    confNote = '无录音：仅按文本填充词/弱化词估计，录音后更准';
  }

  const scores = [fluScore, accScore, compScore, infoScore, structScore, confScore];
  return { scores, flags, missing, confNote, confSub, confFeatures, sentences: sentences.length, avgLen, terms, connectors, inOrder };
}

const DIAG = [
  v => v >= 4 ? '语速与停顿控制较好。' : '语速偏慢或停顿偏多：先把因果链想清楚再开口，会自然变流利。',
  v => v >= 4 ? '术语与语法基本准确。' : '存在术语或拼写问题，见上方红色标记，先逐条改对。',
  v => v >= 3 ? '句式与术语较丰富。' : '句式偏单一：多用“当…时”“因此”“同时”把因果连起来。',
  v => v >= 4 ? '名称/构成/原理/用途/优势/安全要点覆盖较全。' : '信息缺项，补齐缺失模块。',
  v => v >= 4 ? '问题→方案→机制→数据顺序清楚。' : '结构不完整：按“问题→方案→机制→制造与测试→收尾”重排。',
  v => '（参考分）' + (v >= 4 ? '音量稳定、状态放松。' : '语速或音量偏弱，建议面对镜头多练两遍。'),
];
const LEVER = [
  '你刚才在哪里卡顿最多？那一处是不是你还没想清楚的因果链？',
  '哪个术语你最没把握？它对应的物理含义是什么？',
  '把最长的一句话拆成两个因果短句，你会拆在哪一步？',
  '评审只听一遍，能复述出“名称、原理、用途、优势、安全”五样吗？缺哪样？',
  '如果把这段重排成“问题→方案→机制→数据→收尾”，哪一句该提前？',
  '哪一句你最不敢放慢语速？为什么？',
];

let current = null;

function buildDims(a){
  const hardMsgs = a.flags.filter(f => /应为|改用|写作|核对|末端执行器/.test(f));
  return a.scores.map((v, i) => {
    let note;
    if (i === 0) note = v >= 4 ? '语速与停顿控制较好。' : '语速偏慢或停顿偏多：先把因果链想清楚再开口。';
    else if (i === 1) note = hardMsgs.length ? hardMsgs.join('；') : '术语与语法基本准确。';
    else if (i === 2) note = '连接词 ' + a.connectors + ' 个、术语 ' + a.terms + ' 个、平均句长 ' + a.avgLen + ' 字。';
    else if (i === 3) note = a.missing && a.missing.length ? '信息缺项：' + a.missing.join('、') + '。' : '名称/构成/原理/用途/优势/安全要点覆盖较全。';
    else if (i === 4) note = '段落衔接 ' + a.inOrder + '/5（问题→方案→机制→制造与测试→收尾）。';
    else note = a.confNote;
    return { score: v, note: note };
  });
}

function autoSave(){
  if (!current) return;
  const recs = loadRecs().filter(r => r.attempt !== current.attempt);
  recs.push(current);
  saveRecs(recs);
  initAttempts(current.attempt);
}

let syncTimer = 0;
function syncWord(stSel){
  const recs = loadRecs();
  if (!recs.length) return;
  const st = $(stSel || '#wordStatus');
  if (st) st.textContent = '正在同步 Word…';
  fetch('/api/word-sync', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ records: recs }) })
    .then(res => res.json())
    .then(j => { if (st) st.textContent = (j && j.ok) ? '✅ Word 已同步（' + ((j.records && j.records.length) || recs.length) + ' 条记录）' : '❌ 同步失败：' + ((j && j.error) || '未知错误'); })
    .catch(() => { if (st) st.textContent = '❌ 同步失败：本地服务不可用（请用 bat 启动）。'; });
}
function autoExport(){
  if (!current) return;
  const st = $('#wordStatus');
  if (st) st.textContent = '正在同步 Word…';
  syncWord();
}

function scoreAndShow(text, met){
  const a = analyze(text, met);
  const attempt = nextAttempt();
  const total = a.scores.reduce((x,y)=>x+y,0);
  const pct = Math.round(total/30*1000)/10;
  const level = pct >= 90 ? '卓越' : pct >= 80 ? '熟练' : pct >= 60 ? '达标' : pct >= 40 ? '发展中' : '起步';
  current = { attempt, ts: new Date().toISOString(), duration: met.duration || 0, transcript: text, scores: a.scores, total, pct, level, flags: a.flags, missing: a.missing, meta: { sentences: a.sentences, avgLen: a.avgLen, terms: a.terms, connectors: a.connectors }, dims: buildDims(a), confSub: a.confSub, confFeatures: a.confFeatures };
  renderScore();
  autoSave();
  toast('已自动保存为第 ' + attempt + ' 次练习（每次录音都新建一轮，不会覆盖旧练习）');
  autoExport();
  switchView('score');
  $('#btnRec').textContent = '🎙️ 重新录音';
}

function renderScore(){
  $('#scoreEmpty').classList.add('hidden');
  const p = $('#scorePanel'); p.classList.remove('hidden');
  $('#totalVal').textContent = current.total;
  $('#pctVal').textContent = current.pct;
  const pill = $('#levelPill'); pill.textContent = current.level;
  const good = current.level === '达标' || current.level === '熟练' || current.level === '卓越';
  pill.style.background = good ? 'var(--ok-soft)' : 'var(--bad-soft)';
  pill.style.color = good ? 'var(--ok)' : 'var(--bad)';
  drawRadar(current.scores);
  const tbody = $('#dimBody'); tbody.innerHTML = '';
  current.scores.forEach((v, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + DIMS[i] + '</td>' +
      '<td class="auto-' + i + '">' + v + '</td>' +
      '<td><input type="range" min="1" max="5" step="1" value="' + v + '" data-i="' + i + '"></td>' +
      '<td class="diag">' + (i === 5 ? confCellHtml() : DIAG[i](v)) + '</td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('input', e => {
    const i = Number(e.target.dataset.i);
    current.scores[i] = Number(e.target.value);
    e.target.closest('tr').querySelector('.auto-' + i).textContent = e.target.value;
    recalcTotals();
    drawRadar(current.scores);
  }));
  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => { autoSave(); clearTimeout(syncTimer); syncTimer = setTimeout(syncWord, 400); }));

  const fb = $('#flagsBox');
  if (current.flags.length){
    fb.classList.remove('hidden');
    fb.innerHTML = '<b>需纠正</b><ul>' + current.flags.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>';
  } else fb.classList.add('hidden');
  const weak = current.scores.indexOf(Math.min(...current.scores));
  const fbBox = $('#feedbackBox'); fbBox.classList.remove('hidden');
  fbBox.innerHTML = '<b>一句话诊断</b>：最薄弱维度是「' + DIMS[weak] + '」。' +
    (current.missing && current.missing.length ? ' 信息缺项：' + current.missing.join('、') + '。' : '') +
    '<br><b>阿基米德杠杆问题</b>：' + LEVER[weak] +
    '<br><span class="muted small">时长 ' + Math.round(current.duration || 0) + ' 秒 · 句子 ' + current.meta.sentences + ' · 平均句长 ' + current.meta.avgLen + ' 字 · 术语 ' + current.meta.terms + ' 个 · 连接词 ' + current.meta.connectors + ' 个</span>';
  $('#wordStatus').textContent = '';
}

function recalcTotals(){
  current.total = current.scores.reduce((x,y)=>x+y,0);
  current.pct = Math.round(current.total/30*1000)/10;
  current.level = current.pct >= 90 ? '卓越' : current.pct >= 80 ? '熟练' : current.pct >= 60 ? '达标' : current.pct >= 40 ? '发展中' : '起步';
  $('#totalVal').textContent = current.total;
  $('#pctVal').textContent = current.pct;
  const pill = $('#levelPill'); pill.textContent = current.level;
  const good = current.level === '达标' || current.level === '熟练' || current.level === '卓越';
  pill.style.background = good ? 'var(--ok-soft)' : 'var(--bad-soft)';
  pill.style.color = good ? 'var(--ok)' : 'var(--bad)';
}

function confCellHtml(){
  let h = '<div class="conf-note">' + esc(current.confNote) + '</div>';
  if (current.confSub && current.confSub.length){
    h += '<table class="conf-sub"><tbody>';
    current.confSub.forEach(s => {
      const sym = s.v > 0 ? '+' + s.v : String(s.v);
      h += '<tr><td>' + esc(s.k) + '</td><td class="conf-val ' + (s.v>0?'ok':s.v<0?'bad':'') + '">' + sym + '</td><td>' + esc(s.d) + '</td><td>' + esc(s.w) + '</td></tr>';
    });
    h += '</tbody></table>';
  }
  return h;
}
function drawRadar(scores){
  const cv = $('#radar'); const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W/2, cy = H/2, R = Math.min(W,H)/2 - 58, n = 6;
  g.clearRect(0,0,W,H);
  const pt = (i, v) => { const a = (-90 + i*60) * Math.PI/180; const r = (v-1)/4*R; return [cx + r*Math.cos(a), cy + r*Math.sin(a)]; };
  g.strokeStyle = '#dde3ec'; g.lineWidth = 1;
  for (let v = 1; v <= 5; v++){
    g.beginPath(); for (let i = 0; i < n; i++){ const [x,y] = pt(i,v); i ? g.lineTo(x,y) : g.moveTo(x,y); } g.closePath(); g.stroke();
  }
  for (let i = 0; i < n; i++){ const [x,y] = pt(i,5); g.beginPath(); g.moveTo(cx,cy); g.lineTo(x,y); g.stroke(); }
  g.fillStyle = '#64748b'; g.font = '13px Microsoft YaHei, sans-serif'; g.textAlign = 'center';
  for (let i = 0; i < n; i++){
    const [x,y] = pt(i,5); const a = (-90 + i*60) * Math.PI/180;
    g.fillText(DIMS[i], x + Math.cos(a)*34, y + Math.sin(a)*30 + 5);
  }
  g.fillStyle = 'rgba(79,70,229,0.25)'; g.strokeStyle = '#4f46e5'; g.lineWidth = 2.5;
  g.beginPath();
  scores.forEach((v,i) => { const [x,y] = pt(i,v); i ? g.lineTo(x,y) : g.moveTo(x,y); });
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#4f46e5'; g.font = 'bold 13px Microsoft YaHei, sans-serif';
  scores.forEach((v,i) => { const [x,y] = pt(i,v); g.fillText(String(v), x, y - 10); });
}

/* ---------------- save / export word ---------------- */
$('#btnSave').addEventListener('click', () => {
  if (!current) return;
  const recs = loadRecs().filter(r => r.attempt !== current.attempt);
  recs.push(current);
  saveRecs(recs);
  toast('已保存第 ' + current.attempt + ' 次练习');
  initAttempts();
});

$('#btnWord').addEventListener('click', async () => {
  if (!current) return;
  const st = $('#wordStatus');
  st.textContent = '正在导入更新 Word…';
  const weakIdx = current.scores.indexOf(Math.min(...current.scores));
  const payload = {
    attempt: current.attempt, ts: current.ts, duration: current.duration,
    transcript: current.transcript, scores: current.scores, total: current.total,
    pct: current.pct, level: current.level, flags: current.flags, missing: current.missing,
    weak: DIMS[weakIdx], lever: LEVER[weakIdx]
  };
  try {
    const res = await fetch('/api/word-update', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    if (j && j.ok){ st.textContent = '✅ 已更新：' + (j.path || 'Word 文件') + '（第 ' + (j.attempt || current.attempt) + ' 次练习）'; toast('已导入更新 Word'); }
    else st.textContent = '❌ ' + ((j && j.error) || '更新失败');
  } catch(e){
    if (location.protocol === 'file:'){
      st.textContent = '⚠️ 当前用 file:// 打开，无法写 Word。请双击「启动机械产品介绍训练.bat」从本地服务打开，再点此按钮。';
      downloadJson();
    } else {
      st.textContent = '❌ 本地服务不可用：请双击「启动机械产品介绍训练.bat」。';
      downloadJson();
    }
  }
});

function downloadJson(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type:'application/json' }));
  a.download = 'pitch-record-' + current.attempt + '.json';
  a.click();
  toast('已下载 JSON 备份');
}

/* ---------------- teaching ---------------- */
const CONCEPTS = [
  { t:'先问题，后产品', ex:'开场先讲“V 形夹爪一夹就滑、楔形力把瓶盖往外推”，再引出你的装置；不要第一句就报结构。', do:'练习：用 15 个字写出“为谁 + 解决什么”。' },
  { t:'根因 vs 症状', ex:'“打滑”是现象；根因是“楔形力外推 + 接触面滑”。评审要知道你改的是根因。', do:'练习：把你列的 5 个问题分成“根因”和“症状”两栏。' },
  { t:'机制因果链', ex:'夹紧 → 肋条受力屈曲 → 像鱼鳍一样包住瓶盖 → 接触面积与摩擦增大。一环都不能跳。', do:'练习：用 3 句话补全你自己的因果链，必须出现“接触→屈曲→包覆→摩擦”。' },
  { t:'取舍要诚实（赢/输/补）', ex:'相比纯 FinRay 爪：补足了夹持力；相比纯平行爪：多了自适应包覆。', do:'练习：写一句“赢…输…补…”说明你为什么选这个组合。' },
  { t:'参数三级转化', ex:'1000 匹（参数）→ 满载爬坡 38%（工况）→ 每百公里省 11.7kWh（收益）。', do:'练习：给你的“>95% 成功率”补上样本、尺寸、失败判据。' },
  { t:'可证伪的验收标准', ex:'“成功率 ≥95%”必须说清多少样本、什么尺寸、什么条件、怎样算失败。', do:'练习：写出一句话版本的测试定义。' },
];
const LESSONS = [
  ['E1 开场定位','10 秒说清“这是什么、解决什么问题、凭什么不同”。', '先放 V 形爪打滑的现场照片。'],
  ['E2 问题与证据','根因、承担者、量化损失。', '打滑根因 = 楔形力外推 + 接触面滑。'],
  ['E3 机制与因果链','输入→动作→效果→输出，逐环解释。', '夹紧→肋条屈曲→包覆→摩擦增大。'],
  ['E4 概念选择与取舍','选了什么、凭什么、输了什么、如何补。', 'FinRay 赢圆帽适应、输夹持力 → 平行爪补力。'],
  ['E5 材料与制造','每个材料都要有理由。', 'TPU 弹性 / PLA 刚性 / PETG 韧性。'],
  ['E6 测试与验证','标准前置、可证伪。', '统一摩擦测试，≥95% 成功率的定义与判据。'],
  ['E7 安全与边界','额定负载与失效模式。', '超载时优先打滑而非损坏，更安全。'],
  ['E8 进度与风险','关键路径、延期预案、停止条件。', '第 9 周迭代要有触发预案。'],
  ['E9 价值与收尾','对谁有价值 + 明确下一步。', '回到打滑照片：“它已被解决”，号召评审通过。'],
];
const ERRORS = [
  ['气形力', '楔形力'],
  ['卷曲', '屈曲（buckling）'],
  ['p l a', 'PLA'],
  ['费斯通', '费斯托（Festo，请核对）'],
  ['机械臂', '末端执行器'],
  ['发明了鱼鳍技术', '采用 Festo FinRay® 的鱼鳍仿生原理'],
];

function renderComparison(){
  const recs = loadRecs().slice().sort((a,b) => a.attempt - b.attempt);
  const box = $('#comparison');
  if (!box) return;
  if (recs.length >= 2){
    const a = recs[recs.length-2], b = recs[recs.length-1];
    let rows = '';
    DIMS.forEach((dn, i) => {
      const dlt = b.scores[i] - a.scores[i];
      rows += '<tr><td>' + dn + '</td><td>' + a.scores[i] + '</td><td>' + b.scores[i] + '</td><td>' + (dlt > 0 ? '+' : '') + dlt + '</td></tr>';
    });
    box.innerHTML = '<p class="muted small">第 ' + a.attempt + ' 次 → 第 ' + b.attempt + ' 次（总分 ' + a.total + ' → ' + b.total + '，' + (b.total - a.total >= 0 ? '+' : '') + (b.total - a.total) + '）</p>' +
      '<table class="dim-table"><thead><tr><th>维度</th><th>前次</th><th>本次</th><th>提升</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="muted small">解读：' + (b.total > a.total ? '总分提升，继续稳住提升维度、补平未动维度。' : '总分未提升：优先看未动或下降的维度。') + '</p>';
  } else if (recs.length === 1){
    box.innerHTML = '<p class="muted small">已保存第 ' + recs[0].attempt + ' 次练习（' + recs[0].total + '/30，' + esc(recs[0].level) + '）。再录一次，这里会自动生成六维对比。</p>';
  } else {
    box.innerHTML = '<p class="muted small">文字稿两次对比：第一次 13/30（43.3%）→ 再次 17/30（56.7%），+4 分。流利度、复杂度、信息完整性、逻辑结构各 +1；准确性与自信度未动——先改对术语（楔形力/屈曲/PLA/费斯托），再补安全要点冲线 60 分。录音打分后，这里会自动切换为录音对比。</p>';
  }
}

function renderTeaching(){
  renderComparison();
  $('#concepts').innerHTML = CONCEPTS.map(c =>
    '<div class="concept"><b>' + esc(c.t) + '</b><div class="ex">' + esc(c.ex) + '</div><div class="do">' + esc(c.do) + '</div></div>').join('');
  $('#lessons').innerHTML = LESSONS.map(l =>
    '<div class="lesson"><span class="no">' + l[0].slice(1,2) + '</span><div><b>' + esc(l[0]) + '</b><div class="muted small">' + esc(l[1]) + '</div><div class="muted small">范例：' + esc(l[2]) + '</div></div></div>').join('');
  $('#errTable').innerHTML = ERRORS.map(e =>
    '<div class="err-row"><span class="bad">' + esc(e[0]) + '</span><span>→ 应写「' + esc(e[1]) + '」</span></div>').join('');
}
renderTeaching();

/* ---------------- history ---------------- */
function drawRadarOn(cv, scores){
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W/2, cy = H/2, R = Math.min(W,H)/2 - 24, n = 6;
  g.clearRect(0,0,W,H);
  const pt = (i, v) => { const a = (-90 + i*60) * Math.PI/180; const r = (v-1)/4*R; return [cx + r*Math.cos(a), cy + r*Math.sin(a)]; };
  g.strokeStyle = '#dde3ec'; g.lineWidth = 1;
  for (let v = 1; v <= 5; v++){ g.beginPath(); for (let i = 0; i < n; i++){ const [x,y] = pt(i,v); i ? g.lineTo(x,y) : g.moveTo(x,y); } g.closePath(); g.stroke(); }
  for (let i = 0; i < n; i++){ const [x,y] = pt(i,5); g.beginPath(); g.moveTo(cx,cy); g.lineTo(x,y); g.stroke(); }
  g.fillStyle = 'rgba(79,70,229,0.25)'; g.strokeStyle = '#4f46e5'; g.lineWidth = 2;
  g.beginPath(); scores.forEach((v,i) => { const [x,y] = pt(i,v); i ? g.lineTo(x,y) : g.moveTo(x,y); }); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#4f46e5'; g.font = 'bold 10px Microsoft YaHei, sans-serif'; g.textAlign='center';
  scores.forEach((v,i) => { const [x,y] = pt(i,v); g.fillText(String(v), x, y - 8); });
  g.fillStyle = '#64748b'; g.font = '10px Microsoft YaHei, sans-serif';
  for (let i = 0; i < n; i++){ const [x,y] = pt(i,5); const a = (-90 + i*60) * Math.PI/180; g.fillText(DIMS[i].slice(0,2), x + Math.cos(a)*16, y + Math.sin(a)*14 + 3); }
}

function renderHistory(){
  const recs = loadRecs();
  const list = $('#historyList');
  list.innerHTML = '<div class="row-end" style="justify-content:flex-start"><button id="btnSync" class="btn">🔄 同步 Word</button><span id="syncStatus" class="muted small" style="margin-left:8px"></span></div>' + (recs.length ? '' : '<p class="muted">还没有记录：录音打分后会自动保存并出现在这里。</p>');
  recs.slice().reverse().forEach(r => {
    const d = new Date(r.ts);
    const el = document.createElement('div'); el.className = 'hist-item';
    let dimRows = '';
    r.scores.forEach((v, i) => {
      const note = (r.dims && r.dims[i] && r.dims[i].note) || '';
      dimRows += '<tr><td>' + DIMS[i] + '</td><td><b>' + v + '</b></td><td class="diag">' + esc(note) + '</td></tr>';
    });
    el.innerHTML = '<div class="row-between"><b>第 ' + r.attempt + ' 次练习</b><span>' +
      '<button class="btn ghost danger del-rec" data-a="' + r.attempt + '" title="删除并同步 Word">✕ 删除</button>' +
      '<span class="pill">' + r.total + '/30 · ' + esc(r.level) + '</span></div>' +
      '<div class="muted small">' + d.toLocaleString() + ' · 百分制 ' + r.pct + ' · 时长 ' + Math.round(r.duration || 0) + ' 秒</div>' +
      '<div class="hist-grid">' +
        '<canvas class="mini-radar" width="160" height="160"></canvas>' +
        '<table class="dim-table mini">' + dimRows + '</table>' +
      '</div>' +
      (r.flags && r.flags.length ? '<div class="flags"><b>需纠正</b><ul>' + r.flags.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="small muted">' + esc((r.transcript || '').slice(0, 120)) + '…</div>';
    list.appendChild(el);
    const cv = el.querySelector('.mini-radar');
    if (cv) drawRadarOn(cv, r.scores);
  });
  list.querySelectorAll('.del-rec').forEach(b => b.addEventListener('click', () => {
    const a = Number(b.dataset.a);
    saveRecs(loadRecs().filter(r => r.attempt !== a));
    initAttempts();
    renderHistory();
    syncWord('#syncStatus');
    toast('已删除第 ' + a + ' 次练习，并同步 Word');
  }));
  const bs = list.querySelector('#btnSync');
  if (bs) bs.addEventListener('click', () => {
    const stl = list.querySelector('#syncStatus');
    if (stl) stl.textContent = '同步中…';
    syncWord('#syncStatus');
  });
  drawTrend(recs);
}

function drawTrend(recs){
  const cv = $('#trend'); const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, L = 46, Rm = 16, T = 18, B = 28;
  g.clearRect(0,0,W,H);
  g.textAlign = 'right'; g.font = '12px Microsoft YaHei, sans-serif';
  for (let v = 0; v <= 30; v += 10){ const y = T + (H-T-B) * (1 - v/30); g.strokeStyle='#e8edf4'; g.beginPath(); g.moveTo(L,y); g.lineTo(W-Rm,y); g.stroke(); g.fillStyle='#94a3b8'; g.fillText(String(v), L-8, y+4); }
  g.textAlign = 'center'; g.fillStyle = '#64748b';
  if (!recs.length){ g.fillText('暂无数据', W/2, H/2); return; }
  // 按练习轮次编号升序排列，x 坐标严格按「第 N 次」编号映射
  const sorted = recs.slice().sort((a,b) => Number(a.attempt) - Number(b.attempt));
  const minA = Number(sorted[0].attempt);
  const maxA = Number(sorted[sorted.length-1].attempt);
  const span = Math.max(1, maxA - minA);
  const pts = sorted.map((r) => {
    const t = sorted.length === 1 ? 0.5 : (Number(r.attempt) - minA) / span;
    return { x: L + (W-L-Rm) * t, y: T + (H-T-B) * (1 - r.total/30), r: r };
  });
  g.strokeStyle = '#4f46e5'; g.lineWidth = 2.5;
  g.beginPath(); pts.forEach((p,i) => i ? g.lineTo(p.x,p.y) : g.moveTo(p.x,p.y)); g.stroke();
  g.font = '10px Microsoft YaHei, sans-serif';
  pts.forEach((p) => {
    g.fillStyle='#4f46e5'; g.beginPath(); g.arc(p.x,p.y,4,0,Math.PI*2); g.fill();
    g.fillStyle='#0f172a'; g.fillText('第' + p.r.attempt + '次', p.x, H-8);
    g.fillStyle='#4f46e5'; g.fillText(String(p.r.total), p.x, p.y - 10);
  });
}

$('#btnClear').addEventListener('click', () => { saveRecs([]); renderHistory(); toast('已清空本地记录'); });

function switchView(name){
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + name).classList.remove('hidden');
  if (name === 'history') renderHistory();
}

(function(){
  if (location.protocol === 'file:'){
    const b = document.getElementById('fileBanner');
    if (b) b.classList.remove('hidden');
  }
})();
