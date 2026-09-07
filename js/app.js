/* 粤语能力定位测验 · 核心逻辑 */
'use strict';

/* ============ 常量 ============ */
const DIMENSIONS = {
  listening:  { key:'listening',   label:'听力',       weight:0.30, color:'#4f7cff' },
  speaking:   { key:'speaking',    label:'口语',       weight:0.30, color:'#ff6b81' },
  vocabulary: { key:'vocabulary',  label:'词汇',       weight:0.15, color:'#34c3a0' },
  grammar:    { key:'grammar',     label:'语法',       weight:0.10, color:'#f5a623' },
  jyutping:   { key:'jyutping',    label:'粤拼/汉字',  weight:0.10, color:'#9b59b6' },
  slang:      { key:'slang',       label:'俗语地道表达', weight:0.05, color:'#e67e22' }
};
const DIM_KEYS = Object.keys(DIMENSIONS);

const LEVELS = [
  { n:1, name:'L1', label:'零基础·入门', min:-5,    max:-2.67, desc:'能听懂并说出问候、数字等最基本词句' },
  { n:2, name:'L2', label:'初级',       min:-2.67, max:-1.33, desc:'能听懂简单日常句，做简短自我介绍' },
  { n:3, name:'L3', label:'基础进阶',   min:-1.33, max:0,     desc:'能听懂常见问答，表达基本需求' },
  { n:4, name:'L4', label:'中级',       min:0,     max:1.33,  desc:'能进行日常对话，掌握核心语法与常用词' },
  { n:5, name:'L5', label:'中高级',     min:1.33,  max:2.67,  desc:'能听懂地道日常语，比较流利地交流' },
  { n:6, name:'L6', label:'高级',       min:2.67,  max:5,     desc:'接近母语者的日常口语与俗语运用' }
];

const PRIOR_MEAN = -3.5;
const PRIOR_SD = 2.0;
const THETA_MIN = -5;
const THETA_MAX = 5;
const THETA_STEP = 0.05;
const SE_STOP = 0.3;
const MIN_ITEMS = 8;
const MAX_ITEMS = 30;
const PASS = 0.6;
const PROG_REF = 18;

const BUILTIN_BANK = (window.QUESTION_BANK && Array.isArray(window.QUESTION_BANK)) ? window.QUESTION_BANK : [];

/* ============ 工具 ============ */
const $ = function(s){ return document.querySelector(s); };
const $$ = function(s){ return Array.from(document.querySelectorAll(s)); };
const appEl = function(){ return $('#app'); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function clamp(v,a,b){ return Math.min(b, Math.max(a, v)); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function fmtDate(t){ const d=new Date(t||Date.now()); const p=function(n){ return String(n).padStart(2,'0'); }; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
function fmtDur(sec){ sec=Math.round(sec||0); return Math.floor(sec/60)+'分'+String(sec%60).padStart(2,'0')+'秒'; }
function normText(s){ return String(s||'').toLowerCase().replace(/[\s，。！？、,.!?'"“”‘’]/g,''); }
function toast(msg, ms){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('show'); }, ms||2400); }
function download(name, text, mime){ const blob=new Blob([text],{type:mime||'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },1000); }
function thetaToDisplay(t){ return Math.round(clamp((t-THETA_MIN)/(THETA_MAX-THETA_MIN)*100,0,100)); }
function levelOf(theta){ for(const L of LEVELS){ if(theta < L.max) return L; } return LEVELS[LEVELS.length-1]; }
function showJp(){ return localStorage.getItem('cy_show_jp')!=='0'; }

/* ============ 存储 ============ */
const Store = {
  get accounts(){ try{ return JSON.parse(localStorage.getItem('cy_accounts')||'{}'); }catch(e){ return {}; } },
  set accounts(v){ localStorage.setItem('cy_accounts', JSON.stringify(v)); },
  current(){ return localStorage.getItem('cy_current')||null; },
  setCurrent(u){ if(u) localStorage.setItem('cy_current', u); else localStorage.removeItem('cy_current'); },
  data(u){ try{ return JSON.parse(localStorage.getItem('cy_data_'+u)||'{}'); }catch(e){ return {}; } },
  save(u,d){ localStorage.setItem('cy_data_'+u, JSON.stringify(d)); },
  ensure(u){ const d=this.data(u); d.results=d.results||[]; d.wrong=d.wrong||{}; d.settings=d.settings||{}; this.save(u,d); return d; },
  bank(){ const ov=localStorage.getItem('cy_bank_override'); if(ov){ try{ const a=JSON.parse(ov); if(Array.isArray(a)&&a.length) return a; }catch(e){} } return BUILTIN_BANK; },
  setBank(arr){ if(!arr) localStorage.removeItem('cy_bank_override'); else localStorage.setItem('cy_bank_override', JSON.stringify(arr)); }
};

/* ============ 密码散列（本地演示用） ============ */
async function hashPass(s){
  s='cy::'+s;
  try{
    if(window.crypto && crypto.subtle){
      const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    }
  }catch(e){}
  let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; } return 'fnv_'+h;
}

/* ============ 语音合成 ============ */
const TTS = {
  voices:[], cant:[],
  init(){
    const self=this;
    const load=function(){
      if(!('speechSynthesis' in window)){ self.voices=[]; self.cant=[]; return; }
      self.voices=speechSynthesis.getVoices();
      self.cant=self.voices.filter(function(v){ return /^(zh-HK|zh_HK|yue)/i.test(v.lang) || /香港|粵語|Cantonese|yue/i.test(v.name); });
    };
    load();
    if('speechSynthesis' in window && 'onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged=load;
  },
  settings(){ const u=Store.current(); return u ? (Store.data(u).settings||{}) : {}; },
  rate(){ return Number(this.settings().ttsRate||1); },
  voiceName(){ return this.settings().ttsVoice||''; },
  hasCant(){ return this.cant.length>0; },
  speak(text, opts){
    if(!text || !('speechSynthesis' in window)) return;
    opts=opts||{};
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const name=this.voiceName();
    const v=(name && this.cant.find(function(x){ return x.name===name; })) || this.cant[0] || null;
    if(v){ u.voice=v; u.lang=v.lang; } else { u.lang='zh-HK'; }
    u.rate=opts.rate||this.rate(); u.pitch=1; u.volume=1;
    speechSynthesis.speak(u);
  },
  test(){ this.speak('你好，早晨'); toast(this.hasCant() ? '已播放试音（粤语音色）' : '当前浏览器没有粤语音色，已尝试降级播放'); }
};

/* ============ 录音 ============ */
const Recorder = {
  media:null, rec:null, chunks:[], timer:null,
  async start(onTick){
    await this.stop(true);
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('当前环境不支持录音');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    this.media=stream;
    let mime='';
    if(window.MediaRecorder){
      mime=['audio/webm','audio/mp4','audio/ogg'].find(function(m){ return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m); })||'';
    }
    this.rec=new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
    this.chunks=[];
    const self=this;
    this.rec.ondataavailable=function(e){ if(e.data && e.data.size) self.chunks.push(e.data); };
    this.rec.start();
    let t=0;
    this.timer=setInterval(function(){ t++; onTick && onTick(t); },1000);
  },
  stop(silent){
    const self=this;
    return new Promise(function(resolve){
      clearInterval(self.timer); self.timer=null;
      if(!self.rec || self.rec.state==='inactive'){
        if(self.media){ self.media.getTracks().forEach(function(t){ t.stop(); }); self.media=null; }
        self.rec=null; resolve(null); return;
      }
      self.rec.onstop=function(){
        const type=(self.rec && self.rec.mimeType)||'audio/webm';
        const blob=new Blob(self.chunks,{type:type});
        if(self.media){ self.media.getTracks().forEach(function(t){ t.stop(); }); self.media=null; }
        self.rec=null; self.chunks=[];
        resolve(blob);
      };
      try{ self.rec.stop(); }catch(e){ resolve(null); }
    });
  },
  cancel(){ this.stop(true); }
};

/* ============ 自适应引擎（Rasch/EAP） ============ */
function buildEngine(items){
  const used=new Set();
  const answered=[];
  function likelihood(r, t, b){
    const p=1/(1+Math.exp(b-t));
    return Math.max(1e-9, r*p+(1-r)*(1-p));
  }
  function posterior(){
    const grid=[];
    for(let t=THETA_MIN; t<=THETA_MAX+1e-9; t+=THETA_STEP){
      let w=Math.exp(-0.5*Math.pow((t-PRIOR_MEAN)/PRIOR_SD,2));
      for(const a of answered) w*=likelihood(a.score, t, a.item.difficulty);
      grid.push([t,w]);
    }
    let den=0, mean=0;
    for(const g of grid){ den+=g[1]; mean+=g[1]*g[0]; }
    mean/=den;
    let v=0;
    for(const g of grid) v+=g[1]*Math.pow(g[0]-mean,2);
    return { mean:mean, sd:Math.sqrt(v/den) };
  }
  function dimCounts(){
    const c={};
    answered.forEach(function(a){ c[a.item.dimension]=(c[a.item.dimension]||0)+1; });
    return c;
  }
  function nextItem(){
    const remaining=items.filter(function(q){ return !used.has(q.id); });
    if(!remaining.length) return null;
    const est=posterior();
    remaining.sort(function(a,b){ return Math.abs(a.difficulty-est.mean)-Math.abs(b.difficulty-est.mean); });
    const c=dimCounts();
    let minCount=Infinity;
    DIM_KEYS.forEach(function(k){ minCount=Math.min(minCount, c[k]||0); });
    let best=null, bestScore=Infinity;
    const span=Math.min(5, remaining.length);
    for(let i=0;i<span;i++){
      const q=remaining[i];
      const sc=Math.abs(q.difficulty-est.mean)+0.35*((c[q.dimension]||0)-minCount);
      if(sc<bestScore){ bestScore=sc; best=q; }
    }
    return best;
  }
  function submit(item, score){
    used.add(item.id);
    answered.push({ item:item, score:clamp(score,0,1), correct:score>=PASS, time:Date.now() });
  }
  function isDone(){
    if(answered.length>=MAX_ITEMS) return true;
    if(!items.some(function(q){ return !used.has(q.id); })) return true;
    if(answered.length>=MIN_ITEMS && posterior().sd<=SE_STOP) return true;
    return false;
  }
  return {
    answered:function(){ return answered.slice(); },
    posterior:posterior,
    nextItem:nextItem,
    submit:submit,
    isDone:isDone,
    count:function(){ return answered.length; }
  };
}

/* ============ 诊断建议与学习计划 ============ */
const SUGGESTIONS = {
  listening:['每天听 10–15 分钟粤语真人素材（港剧、新闻、播客），先盲听再对照字幕','精听数字、时间、方位等高频信息，做听写练习','跟读听力材料，模仿语调，注意语气词（呀、啦、咩）的含义'],
  speaking:['每天大声跟读 3–5 句常用语并录音回听对比','用“粤拼+声调”逐词校准发音，重点练 2、5、6 声','找语伴或 AI 语音对话，练习自我介绍、点餐、问路等场景'],
  vocabulary:['按主题记词（饮食、交通、家庭、工作），每天 8–10 个并造句','用粤拼辅助记忆发音，遮住汉字看粤拼回想意思','把新词放进对话里用，隔天复习（间隔重复）'],
  grammar:['系统学习「係/喺、咗/紧/住、畀、同、先」等高频虚词','做替换练习：同一句变换时态（食咗/食紧/会食）','每天仿写 3 句口语化句子并请 AI 或语伴订正'],
  jyutping:['学习粤语九声六调，先掌握 1、2、4、6 声','做“看粤拼读字、听音标调”配对练习','用「唔该、早晨」等高频词记住典型调型'],
  slang:['每周学 3–5 个地道俗语（如倾偈、埋单、求其），了解使用场景','看港剧/访谈积累口语，注意语气与语境','尝试在日常对话中自然使用，不怕用错']
};
const PLAN_STEPS = {
  listening:['盲听 10 分钟粤语播客，写下听到的关键词','精听 3 句日常句并听写，对照原文订正','听数字/时间/方位专题音频，做快速反应练习'],
  speaking:['跟读 5 句高频口语句并录音，回听找差距','用粤拼+声调校准 10 个易错字音','模拟一段点餐/问路对话并开口说'],
  vocabulary:['按主题学 10 个词，遮汉字看粤拼回忆','用新词各造 1 句粤语口语','做词汇自测，把忘记的词加入错题重练'],
  grammar:['学 1 个语法点（如 咗/紧 的区别）并做例句替换','仿写 3 句口语化句子','用 AI 或语伴检查自己造的句子'],
  jyutping:['练九声六调听辨，标出听到的调号','看粤拼读词、听音选字各 10 个','把易错声调词做成自己的小卡片'],
  slang:['学 3 个俗语并搞清使用场景','在对话里刻意用一次所学俗语','看 10 分钟港剧，收集听到的地道说法']
};
function buildPlan(dims){
  const ranked=[];
  for(const k of DIM_KEYS){ if(dims[k] && dims[k].n>0) ranked.push([k, dims[k].pct]); }
  ranked.sort(function(a,b){ return a[1]-b[1]; });
  const focus=(ranked.length ? ranked.map(function(r){ return r[0]; }) : DIM_KEYS.slice()).slice(0,3);
  const days=[];
  for(let i=1;i<=14;i++){
    const k=focus[(i-1)%focus.length];
    const steps=PLAN_STEPS[k];
    days.push({ day:i, dim:DIMENSIONS[k].label, task:steps[(i-1)%steps.length] });
  }
  return days;
}

/* ============ 登录界面 ============ */
let authMode='login';
function renderAuth(){
  $('#topbar').classList.add('hidden');
  appEl().innerHTML =
   '<div class="auth-wrap">' +
    '<div class="card auth-card">' +
      '<div class="auth-logo">🎙️</div>' +
      '<h1>粤语能力定位测验</h1>' +
      '<p class="muted">自适应定位你的粤语水平（L1–L6），给出分项分数、诊断建议与 14 天学习计划。</p>' +
      '<div class="tabs"><button class="tab active" id="tabLogin">登录</button><button class="tab" id="tabReg">注册</button></div>' +
      '<form id="authForm">' +
        '<label class="field">昵称<input id="authName" required autocomplete="username" placeholder="例如：小明"></label>' +
        '<label class="field">密码<input id="authPass" type="password" required autocomplete="current-password" placeholder="至少 4 位"></label>' +
        '<div class="hint" id="authHint"></div>' +
        '<button class="btn primary block" type="submit" id="authSubmit">登录</button>' +
      '</form>' +
      '<p class="demo-note">🛠 本地演示模式：数据保存在当前浏览器；跨设备请在「设置」里导出/导入数据。</p>' +
    '</div>' +
   '</div>';
  const setTab=function(m){
    authMode=m;
    $('#tabLogin').classList.toggle('active', m==='login');
    $('#tabReg').classList.toggle('active', m==='register');
    $('#authSubmit').textContent = m==='login' ? '登录' : '注册并登录';
    $('#authHint').textContent='';
  };
  $('#tabLogin').addEventListener('click', function(){ setTab('login'); });
  $('#tabReg').addEventListener('click', function(){ setTab('register'); });
  $('#authForm').addEventListener('submit', async function(e){
    e.preventDefault();
    const name=$('#authName').value.trim();
    const pass=$('#authPass').value;
    const hint=$('#authHint');
    if(!name || pass.length<4){ hint.textContent='昵称不能为空，密码至少 4 位'; return; }
    const h=await hashPass(pass);
    const acc=Store.accounts;
    if(authMode==='register'){
      if(acc[name]){ hint.textContent='该昵称已注册，请直接登录'; return; }
      acc[name]={ h:h, createdAt:Date.now() };
      Store.accounts=acc;
    } else {
      if(!acc[name]){ hint.textContent='账号不存在，请先注册'; return; }
      if(acc[name].h!==h){ hint.textContent='密码错误'; return; }
    }
    Store.setCurrent(name);
    renderShell();
    renderHome();
  });
}

function renderShell(){
  $('#topbar').classList.remove('hidden');
  $('#userChip').textContent='👤 '+Store.current();
  $('#jpToggle').checked=showJp();
}

/* ============ 初始化 ============ */
function init(){
  TTS.init();
  $('#jpToggle').addEventListener('change', function(e){ localStorage.setItem('cy_show_jp', e.target.checked?'1':'0'); });
  $('#logoutBtn').addEventListener('click', function(){ if(confirm('确定退出当前账号？')){ Store.setCurrent(null); location.reload(); } });
  $('#brandBtn').addEventListener('click', function(){ if(Store.current()) renderHome(); });
  if(Store.current()){ renderShell(); renderHome(); } else { renderAuth(); }
}
document.addEventListener('DOMContentLoaded', init);
/* 暴露只读测试/扩展 API */
window.CY = { Store:Store, TTS:TTS, Recorder:Recorder, buildEngine:buildEngine, buildPlan:buildPlan, SUGGESTIONS:SUGGESTIONS, PLAN_STEPS:PLAN_STEPS, DIMENSIONS:DIMENSIONS, LEVELS:LEVELS, thetaToDisplay:thetaToDisplay, levelOf:levelOf };
