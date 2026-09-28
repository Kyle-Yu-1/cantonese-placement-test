'use strict';
/* 中文机械产品介绍训练中心：阿基米德教练 + 语音训练 + 教学 + 记录 */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

const NODES = [
  { id:'E1', name:'开场定位', goal:'10 秒说清「这是什么、解决什么问题、凭什么不同」',
    rec:'口头默认 A；有现场照片叠加 C',
    menu:[
      ['A','问题场景式','先放失败现场照片/描述，再引出装置','进入装置较慢，前 15 秒不出现产品','受众不了解问题'],
      ['B','功能直给式','一句话说清是什么、解决什么','快，但偏平淡','时间少于 30 秒或受众熟悉问题'],
      ['C','对比反差式','现有做法 vs 你的做法','记忆度高','需要图示'],
    ],
    levers:['把开场砍到 15 个字，哪几个词必须留下？为什么是它们？','评审只听第一句，能说出你在解决什么问题吗？如果还不能，缺什么？'],
    pass:['问题','解决','换轮胎','顶升'],
    teach:{c:'先问题，后产品',w:'评审最先想知道「为什么要做」，而不是「你做了什么」。',ex:'换轮胎时手动顶车又慢又费力——液压千斤顶把它稳稳顶起。',do:'用 15 个字写出「为谁 + 解决什么」。'},
    diag:'开场还没有「问题」：先让评审看到换胎顶车哪里费力。' },

  { id:'E2', name:'问题与证据', goal:'根因、承担者、量化损失',
    rec:'口头默认 A；书面用 B；有素材叠加 C',
    menu:[
      ['A','根因优先式','只讲一个根因 + 量化损失','暂时放下次要问题','口头介绍、时间短'],
      ['B','分级清单式','2–3 个问题按影响排序、标注主次','篇幅长、易失焦','书面报告'],
      ['C','现场取证式','照片、视频或测试数据开讲','依赖素材质量','素材齐全'],
    ],
    levers:['你列的多个问题里，哪个是根因、哪个是它引发的症状？','「顶不动」这个结果，缺的是哪个条件？怎样量化损失？'],
    pass:['根因','费力','支撑','安全','损失'],
    teach:{c:'根因 vs 症状',w:'「顶不动」是现象；评审要知道你改的是根因，而不是只缓解现象。',ex:'顶不动 = 手动力太小；支撑不稳 = 人钻车底的安全隐患。',do:'把你列的 5 个问题分成「根因」和「症状」两栏。'},
    diag:'问题还停在现象层：把根因和量化损失说清。' },

  { id:'E3', name:'机制与因果链', goal:'输入 → 动作 → 效果 → 输出，一环都不能跳',
    rec:'默认 A；跨专业受众叠加 C',
    menu:[
      ['A','因果链式','接触→变形→作用→效果，一环一句','篇幅长','技术评审、需要说服「为什么可行」'],
      ['B','前后对比式','使用前 vs 使用后两张图','机制被省略','演示型'],
      ['C','类比式','借注射器、打气筒等建立直觉','可能不严谨','跨专业评委'],
    ],
    levers:['动作发生的瞬间，油先进入哪里、再怎样推动活塞，最后产生什么效果？','把「顶升」拆成三步：吸油→？→顶起，中间那步是什么？'],
    pass:['活塞','压强','帕斯卡','放大','油'],
    teach:{c:'机制因果链',w:'「顶升」是结果；油如何被吸入、压出、推动活塞才是因果。',ex:'摇手柄 → 小活塞吸油压油 → 大活塞受力上升 → 顶起车身。',do:'用 3 句话补全因果链，必须出现「吸油→压油→顶升」。'},
    diag:'机制跳步了：补上「先接触哪里、怎样变形」这一环。' },

  { id:'E4', name:'概念选择与取舍', goal:'选了什么、凭什么、输了什么、如何补',
    rec:'口头 B；书面 A；时间极紧 C',
    menu:[
      ['A','评分矩阵式','标准 × 方案打分量表','制作成本高','书面或详细答辩'],
      ['B','淘汰赛式','两轮淘汰，每轮给理由','需要标准稳定','口头介绍'],
      ['C','单一主因式','只讲决定性标准','显得未全面比较','时间极紧'],
    ],
    levers:['你的方案赢了哪两项标准、输了哪两项？','你为输掉的那两项做了什么补偿？'],
    pass:['赢','输','补','相比','省力'],
    teach:{c:'取舍要诚实（赢/输/补）',w:'只讲赢不讲输，评审会认为你没比较过；输项有补偿才可信。',ex:'相比机械/剪式千斤顶：更省力平稳；输在自重与价格，补「车载低吨位够用」。',do:'写一句「赢…输…补…」。'},
    diag:'还没有取舍：写明赢什么、输什么、怎么补。' },

  { id:'E5', name:'材料与密封', goal:'每个材料都有理由、承压不渗漏',
    rec:'默认 A；强调落地叠加 B',
    menu:[
      ['A','材料-功能对应式','逐个材料讲「为什么是它」','篇幅长','技术评委'],
      ['B','工艺链式','设计→制造→装配→测试走一遍','可能琐碎','强调可落地'],
      ['C','成本取舍式','先讲性能目标，再讲成本让步','削弱性能故事','有预算约束'],
    ],
    levers:['为什么这个部件用这种材料？','如果只允许一种材料，你保留哪个、牺牲什么？'],
    pass:['铸钢','合金','密封','承压','耐磨'],
    teach:{c:'材料-功能对应',w:'材料清单没有理由等于没做选择；每个材料都对应一个功能。',ex:'缸体铸钢承压 / 活塞杆淬硬耐磨 / O 形圈密封不漏油。',do:'给每个材料补一句「为什么是它」。'},
    diag:'材料只列了名字：补上每个材料对应的功能。' },

  { id:'E6', name:'测试与验证', goal:'验收标准前置、可证伪',
    rec:'A 作骨架，B/C 按材料叠加',
    menu:[
      ['A','验收标准前置式','先定成功定义与失败判据，再讲怎么测','标准必须先想清','评委重视证据'],
      ['B','数据表式','样本、尺寸、条件、结果成表','数据量要求高','已有数据'],
      ['C','迭代日志式','按「测→改→复测」讲轨迹','篇幅长','有真实迭代记录'],
    ],
    levers:['「额定 2 吨」怎么验证？顶升多高、密封多久、安全阀在哪一点开启？','如果实测泄压过早，你第一反应改哪里？'],
    pass:['吨','安全阀','密封','测试','超载'],
    teach:{c:'可证伪的验收标准',w:'「额定吨位」没有口径等于没标准；评审会追问高度、密封与超载点。',ex:'超载测试：1.15 倍额定载荷安全阀开启，密封 24 小时无渗漏。',do:'写出一句话版本的测试定义。'},
    diag:'数据没有口径：补样本、尺寸与失败判据。' },

  { id:'E7', name:'安全与边界', goal:'额定边界诚实、失效模式可接受',
    rec:'口头 A；书面 B；有竞品数据叠加 C',
    menu:[
      ['A','诚实边界式','主动给出额定负载与失效模式','直面短板','技术评委'],
      ['B','风险分层式','载荷、寿命、环境分桶各给应对','冗长','书面报告'],
      ['C','对照式','与现有装置并列限制对照','暴露差距','成熟品类'],
    ],
    levers:['超过额定吨位时，千斤顶是安全阀开启还是损坏？','作业时为什么不能只靠千斤顶支撑？'],
    pass:['超载','支架','支撑','安全','失效'],
    teach:{c:'失效模式优先',w:'回避边界会被评审戳穿；主动说明超载保护与支撑规则更专业。',ex:'额定吨位 + 绝不只靠千斤顶支撑钻车底，必须加安全支架。',do:'写出你的一条边界 + 失效模式。'},
    diag:'边界没交代：说清额定负载与失效方式。' },

  { id:'E8', name:'进度与风险', goal:'关键路径、延期预案、停止条件',
    rec:'默认 A；迭代风险明显时叠加 C',
    menu:[
      ['A','关键路径式','甘特图标关键路径 + 延期预案','需重算路径','有真实排期'],
      ['B','里程碑对价式','每阶段交付物与验收一一对应','前期工作量大','报告'],
      ['C','情景推演式','最好/基准/最差三种进度','需要估算','风险讨论'],
    ],
    levers:['如果「重复直至达标」一直达不到，你第几周触发预案？','甘特图里哪一步是其他步骤都等它的关键路径？'],
    pass:['周','预案','关键','迭代','风险'],
    teach:{c:'关键路径与停止条件',w:'计划没有预案等于没有计划；迭代必须设停止条件。',ex:'第 9 周迭代要有触发预案与停止条件。',do:'写出一个延期预案。'},
    diag:'计划没有风险意识：补关键路径与延期预案。' },

  { id:'E9', name:'价值与收尾', goal:'对谁有价值 + 明确下一步',
    rec:'A 收口，按场景叠加 B 或 C（C 几乎必须）',
    menu:[
      ['A','价值回扣式','结尾回到开场问题，说明已解决','无新信息','所有场合'],
      ['B','路线图式','下一步扩展（多尺寸、量产、降成本）','可能显发散','答辩或合作'],
      ['C','行动号召式','明确要评审下一步做什么','需要想清诉求','与其他方案叠加'],
    ],
    levers:['换胎的人用它后，具体省下什么时间与风险？','你要评审下一步做什么？'],
    pass:['解决','下一步','支持','量产','价值','评审'],
    teach:{c:'回扣 + 号召',w:'好的结尾 = 回到开场的痛点（它已被解决）+ 一句明确的下一步。',ex:'回到换胎场景：「车稳稳顶起，人安全作业」，号召评审通过。',do:'写一句回扣 + 一句号召。'},
    diag:'收尾没有闭环与号召：回到开场问题，再给下一步。' },
];

const LS = 'coach_state';
function loadState(){ try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch(e){ return {}; } }
function saveState(st){ localStorage.setItem(LS, JSON.stringify(st)); }
function defaultState(){
  return { current:'E1', done:[], ans:{}, qIndex:{} };
}
let st = loadState();
if (!st.current){ st = defaultState(); saveState(st); }

/* ---------------- tabs ---------------- */
function switchView(name){
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + name).classList.remove('hidden');
  if (name === 'voice'){
    const f = $('#voiceFrame');
    if (!f.src && f.dataset.src) f.src = f.dataset.src;
  }
  if (name === 'coach') renderCoach();
  if (name === 'teach') renderTeaching();
  if (name === 'history') renderHistory();
}
$$('.tab').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.go)));

(function(){
  if (location.protocol === 'file:'){
    const b = document.getElementById('fileBanner');
    if (b) b.classList.remove('hidden');
  }
})();

/* ---------------- coach ---------------- */
function nodeById(id){ return NODES.find(n => n.id === id); }
function nextNode(){
  const cur = st.current;
  let seen = false;
  for (const n of NODES){
    if (seen && !st.done.includes(n.id)) return n;
    if (n.id === cur) seen = true;
  }
  return NODES.find(n => !st.done.includes(n.id)) || null;
}

function renderCoach(){
  const root = $('#coachRoot');
  const node = nodeById(st.current) || NODES[0];
  const done = st.done.includes(node.id);
  const ans = st.ans[node.id] || {};

  let html = '<div class="card"><div class="row-between"><b>逐节点训练进度</b><span class="muted small">已完成 ' + st.done.length + '/9</span></div><div class="coach-progress">';
  for (const n of NODES){
    const cls = n.id === node.id ? 'active' : (st.done.includes(n.id) ? 'done' : '');
    html += '<div class="coach-dot ' + cls + '" data-node="' + n.id + '">' + n.id + '<br>' + n.name.slice(0,2) + '</div>';
  }
  html += '</div></div>';

  html += '<div class="card"><div class="row-between"><b>' + node.id + ' · ' + node.name + '</b>';
  if (st.done.includes(node.id)) html += '<span class="pill">已达标</span>';
  html += '</div><p class="muted small">目标：' + esc(node.goal) + '</p>';

  if (done){
    html += '<div class="fb-box fb-ok"><b>本节点已完成。</b>你的方案：' + esc(ans.option || '') + '；回答摘要：' + esc((ans.answer||'').slice(0,60)) + '…</div>';
    const nx = nextNode();
    html += '<div class="row-end">' + (nx ? '<button class="btn primary" id="goNext">下一个节点：' + nx.id + ' ' + nx.name + '</button>' : '<button class="btn primary" id="allDone">🎉 九个节点全部完成</button>') + '<button class="btn" id="redoNode">重练本节点</button></div>';
  } else if (!ans.option){
    // 阶段1：方案选择
    html += '<p>先选一个互斥方案（改变什么 / 代价 / 适用场景）：</p>';
    node.menu.forEach((m, i) => {
      html += '<div class="opt" data-k="' + m[0] + '"><b>' + m[0] + '　' + esc(m[1]) + '</b><div class="mut">改变：' + esc(m[2]) + '　|　代价：' + esc(m[3]) + '　|　适合：' + esc(m[4]) + '</div></div>';
    });
    html += '<p class="muted small">推荐：' + esc(node.rec) + '</p><div class="row-end"><button class="btn primary" id="pickOpt" disabled>选定方案</button></div>';
  } else if (!ans.answer){
    // 阶段2：杠杆问题
    const qi = (st.qIndex[node.id] || 0) % node.levers.length;
    html += '<p>已选方案：<b>' + ans.option + '</b>（可点下方「换方案」）</p><div class="q-box"><div class="lever">阿基米德杠杆问题：' + esc(node.levers[qi]) + '</div></div>';
    html += '<p class="muted small">请用你自己的话作答（这是「用力」一步，至少写 15 个字）：</p><textarea id="ansBox" rows="4" placeholder="写下你的回答…"></textarea>';
    html += '<div class="coach-voice"><button class="btn" id="voiceAns">🎙️ 语音作答</button> <button class="btn" id="uploadAns">📁 上传录音作答</button> <span id="voiceStatus" class="muted small hidden"></span></div>';
    html += '<div class="row-end"><button class="btn ghost" id="teachBtn">我不懂 · 教我</button><button class="btn ghost" id="swapQ">换一个问题</button><button class="btn ghost" id="swapOpt">换方案</button><button class="btn primary" id="submitAns">提交回答</button></div><div id="teachSlot"></div>';
  } else {
    // 阶段3：反馈 / 位移
    const sc = ans.score || 0;
    html += '<div class="fb-box ' + (sc >= 4 ? 'fb-ok' : 'fb-mid') + '"><b>教练反馈（' + sc + '/5）</b><br>' + esc(ans.feedback || '') + '</div>';
    html += '<div class="q-box"><b>杠杆问题：</b>' + esc(node.levers[(st.qIndex[node.id]||0) % node.levers.length]) + '</div>';
    html += '<p class="muted small">你的回答：</p><div class="fb-box">' + esc(ans.answer) + '</div>';
    if (!ans.shift){
      html += '<p class="muted small"><b>位移练习</b>：这次不看任何提示，用自己的话再讲一遍（可与上一版比较）。</p><textarea id="shiftBox" rows="4" placeholder="不参考提示，再写一遍…"></textarea>';
      html += '<div class="coach-voice"><button class="btn" id="voiceShift">🎙️ 语音作答</button> <button class="btn" id="uploadShift">📁 上传录音作答</button> <span id="shiftVoiceStatus" class="muted small hidden"></span></div>';
      html += '<div class="row-end"><button class="btn ghost" id="teachBtn2">教我</button><button class="btn" id="markDone">跳过 · 标记达标</button><button class="btn primary" id="submitShift">提交位移练习</button></div><div id="teachSlot"></div>';
    } else {
      html += '<div class="fb-box fb-ok"><b>位移练习完成。</b>两版比较：' + esc((ans.answer||'').slice(0,30)) + ' → ' + esc((ans.shiftAns||'').slice(0,30)) + '</div>';
      const nx = nextNode();
      html += '<div class="row-end">' + (nx ? '<button class="btn primary" id="goNext">下一节点：' + nx.id + ' ' + nx.name + '</button>' : '<button class="btn primary" id="allDone">🎉 九个节点全部完成</button>') + '<button class="btn" id="redoNode">重练本节点</button></div>';
    }
  }
  html += '</div>';
  root.innerHTML = html;
  bindCoach(root, node);
}

function assess(node, text){
  const t = (text || '').trim();
  const len = t.length;
  const hits = node.pass.filter(k => t.includes(k));
  const score = len >= 15 ? (hits.length >= 2 ? 4 : 3) : (hits.length >= 1 ? 2 : 1);
  const mirror = hits.length ? ('你提到了：' + hits.join('、') + '。') : '回答里还没有落到' + node.name + '的关键要素。';
  const extra = score >= 4 ? '本节点要点已覆盖，进入位移练习把它变成你自己的话。' : node.diag;
  return { score, feedback: mirror + extra, hits };
}

function bindCoach(root, node){
  root.querySelectorAll('.coach-dot').forEach(d => d.addEventListener('click', () => {
    st.current = d.dataset.node; saveState(st); renderCoach();
  }));
  const sel = {};
  root.querySelectorAll('.opt').forEach(o => o.addEventListener('click', () => {
    root.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
    o.classList.add('sel'); sel.k = o.dataset.k;
    const b = root.querySelector('#pickOpt'); if (b) b.disabled = false;
  }));
  const pick = root.querySelector('#pickOpt');
  if (pick) pick.addEventListener('click', () => {
    if (!sel.k) return;
    st.ans[node.id] = st.ans[node.id] || {}; st.ans[node.id].option = sel.k;
    saveState(st); renderCoach();
  });
  const swapOpt = root.querySelector('#swapOpt');
  if (swapOpt) swapOpt.addEventListener('click', () => {
    delete st.ans[node.id].option; saveState(st); renderCoach();
  });
  const swapQ = root.querySelector('#swapQ');
  if (swapQ) swapQ.addEventListener('click', () => {
    st.qIndex[node.id] = (st.qIndex[node.id] || 0) + 1; saveState(st); renderCoach();
  });
  const submit = root.querySelector('#submitAns');
  if (submit) submit.addEventListener('click', () => {
    const v = (root.querySelector('#ansBox') || {}).value || '';
    if (!v.trim()) { toast('先写下你的回答'); return; }
    const a = assess(node, v);
    st.ans[node.id] = st.ans[node.id] || {};
    st.ans[node.id].answer = v.trim(); st.ans[node.id].score = a.score; st.ans[node.id].feedback = a.feedback;
    saveState(st); renderCoach();
  });
  const voiceAns = root.querySelector('#voiceAns');
  if (voiceAns) voiceAns.addEventListener('click', () => coachStartRec('#ansBox', '#voiceStatus', voiceAns));
  const uploadAns = root.querySelector('#uploadAns');
  if (uploadAns) uploadAns.addEventListener('click', () => coachUpload('#ansBox', '#voiceStatus'));
  const voiceShift = root.querySelector('#voiceShift');
  if (voiceShift) voiceShift.addEventListener('click', () => coachStartRec('#shiftBox', '#shiftVoiceStatus', voiceShift));
  const uploadShift = root.querySelector('#uploadShift');
  if (uploadShift) uploadShift.addEventListener('click', () => coachUpload('#shiftBox', '#shiftVoiceStatus'));

  const submitShift = root.querySelector('#submitShift');
  if (submitShift) submitShift.addEventListener('click', () => {
    const v = (root.querySelector('#shiftBox') || {}).value || '';
    if (!v.trim()) { toast('先完成位移练习'); return; }
    st.ans[node.id].shiftAns = v.trim(); st.ans[node.id].shift = true;
    if (!st.done.includes(node.id)) st.done.push(node.id);
    saveState(st); renderCoach();
  });
  const markDone = root.querySelector('#markDone');
  if (markDone) markDone.addEventListener('click', () => {
    if (!st.done.includes(node.id)) st.done.push(node.id);
    saveState(st); renderCoach();
  });
  const goNext = root.querySelector('#goNext');
  if (goNext){ const nx = nextNode(); goNext.addEventListener('click', () => { if (nx){ st.current = nx.id; saveState(st); renderCoach(); } }); }
  const allDone = root.querySelector('#allDone');
  if (allDone) allDone.addEventListener('click', () => toast('九个节点全部完成，去「语音训练」做一次完整录音吧！'));
  const redo = root.querySelector('#redoNode');
  if (redo) redo.addEventListener('click', () => {
    st.done = st.done.filter(x => x !== node.id);
    st.ans[node.id] = {};
    saveState(st); renderCoach();
  });
  const teachBtn = root.querySelector('#teachBtn') || root.querySelector('#teachBtn2');
  if (teachBtn) teachBtn.addEventListener('click', () => {
    const slot = root.querySelector('#teachSlot');
    if (!slot) return;
    if (slot.dataset.on === '1'){ slot.innerHTML=''; slot.dataset.on='0'; return; }
    const t = node.teach;
    slot.innerHTML = '<div class="teach-card"><b>教学：' + esc(t.c) + '</b><div class="mut">为什么重要：' + esc(t.w) + '</div><div class="ex">范例：' + esc(t.ex) + '</div><div class="mut">小练习：' + esc(t.do) + '</div></div>';
    slot.dataset.on = '1';
  });
}

/* ---------------- coach voice input ---------------- */
let coachRec = null;

async function coachTranscribe(blob, targetSel, statusSel){
  const st = document.querySelector(statusSel);
  if (st){ st.classList.remove('hidden'); st.textContent = '正在本机 Whisper 转写（首次较慢）…'; }
  try {
    const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
    const res = await fetch('/api/transcribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ audio: b64, mime: blob.type || 'audio/webm' }) });
    const j = await res.json();
    if (j && j.ok && j.text){
      document.querySelector(targetSel).value = j.text;
      if (st) st.textContent = '转写完成，请检查后提交。';
      toast('转写完成');
      return true;
    } else {
      if (st) st.textContent = '❌ ' + ((j && j.error) || '转写失败');
      return false;
    }
  } catch(e){
    if (st) st.textContent = location.protocol === 'file:' ? '⚠️ 需用「启动机械产品介绍训练.bat」打开才能转写' : '❌ 本地转写服务不可用';
    return false;
  }
}

async function coachStartRec(targetSel, statusSel, btn){
  if (coachRec){
    const rec = coachRec;
    coachRec = null;
    rec.rec.onstop = () => {
      const blob = new Blob(rec.chunks, { type: rec.mime || 'audio/webm' });
      try { rec.stream.getTracks().forEach(t => t.stop()); } catch(e){}
      btn.textContent = '🎙️ 语音作答';
      coachTranscribe(blob, targetSel, statusSel);
    };
    try { rec.rec.stop(); } catch(e){ coachTranscribe(new Blob(rec.chunks, { type: rec.mime || 'audio/webm' }), targetSel, statusSel); }
    return;
  }
  const st = document.querySelector(statusSel);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = (['audio/webm','audio/mp4','audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || '');
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start();
    coachRec = { stream, rec, chunks, mime };
    btn.textContent = '⏹ 停止（转写）';
    if (st){ st.classList.remove('hidden'); st.textContent = '正在录音… 说完后再次点击「⏹ 停止」自动转写。'; }
  } catch(err){
    if (st){ st.classList.remove('hidden'); st.textContent = '无法录音：' + err.message + '（可改用上传）'; }
    toast('无法录音：' + err.message);
  }
}

function coachUpload(targetSel, statusSel){
  let inp = document.getElementById('coachFile');
  if (!inp){
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'audio/*'; inp.id = 'coachFile'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = (inp.files || [])[0];
      if (f) coachTranscribe(f, targetSel, statusSel);
    });
  }
  inp.click();
}

/* ---------------- teaching ---------------- */
const CONCEPTS = [
  { t:'先问题，后产品', ex:'开场先讲「换轮胎时手动顶车又慢又费力」，再引出液压千斤顶。', do:'用 15 个字写出「为谁 + 解决什么」。' },
  { t:'根因 vs 症状', ex:'「顶不动」是现象；根因是「手动力太小，要借帕斯卡原理放大」。', do:'把 5 个问题分成根因与症状两栏。' },
  { t:'机制因果链', ex:'摇手柄 → 小活塞吸油压油 → 大活塞受力上升 → 顶起车身。', do:'用 3 句话补全因果链，必须出现「吸油→压油→顶升」。' },
  { t:'取舍要诚实（赢/输/补）', ex:'相比机械/剪式千斤顶：更省力平稳；输在自重与价格，补「车载低吨位够用」。', do:'写一句「赢…输…补…」。' },
  { t:'参数三级转化', ex:'2 吨（额定）→ 家用轿车约 1.5 吨（工况）→ 单侧顶升约 0.8 吨（需求）。', do:'给「额定吨位」补上顶升高度与泄压方式。' },
  { t:'可证伪的验收标准', ex:'「额定 2 吨」必须说清顶升高度、泄压方式、安全阀开启点。', do:'写出一句话版本的测试定义。' },
];
const LESSONS = [
  ['E1 开场定位','10 秒说清「这是什么、解决什么问题、凭什么不同」。','开场先讲「换胎顶车费力又不安全」。'],
  ['E2 问题与证据','根因、承担者、量化损失。','顶不动 = 手动力太小；支撑不稳 = 安全隐患。'],
  ['E3 机制与因果链','输入→动作→效果→输出，逐环解释。','手柄→小活塞→大活塞→顶升。'],
  ['E4 概念选择与取舍','选了什么、凭什么、输了什么、如何补。','液压赢省力平稳、输自重价格 → 低吨位够用补上。'],
  ['E5 材料与密封','每个材料都要有理由。','缸体铸钢承压 / 活塞杆淬硬耐磨 / O 形圈密封不漏油。'],
  ['E6 测试与验证','标准前置、可证伪。','超载 1.15 倍安全阀开启，密封 24 小时无渗漏。'],
  ['E7 安全与边界','额定边界与失效模式。','额定吨位 + 绝不只靠千斤顶钻车底。'],
  ['E8 进度与风险','关键路径、延期预案、停止条件。','关键路径与延期预案要写清。'],
  ['E9 价值与收尾','对谁有价值 + 明确下一步。','回到换胎场景：「车稳稳顶起，人安全作业」。'],
];
const ERRORS = [
  ['帕斯卡尔','帕斯卡（Pascal）'],['阿基米德原理','帕斯卡原理'],['气压','液压/油压'],
  ['大活塞推小活塞','小活塞推大活塞'],['先把释放阀松开','顶升前先顺时针拧紧释放阀'],
];
function renderTeachingComparison(){
  let recs = [];
  try { recs = JSON.parse(localStorage.getItem('pitch_records') || '[]'); } catch(e){}
  recs = recs.slice().sort((a,b) => a.attempt - b.attempt);
  let html = '';
  if (recs.length >= 2){
    const a = recs[recs.length-2], b = recs[recs.length-1];
    let rows = '';
    ['流利度','准确性','语言复杂度','信息完整性','逻辑结构','自信度'].forEach((dn, i) => {
      const dlt = b.scores[i] - a.scores[i];
      rows += '<tr><td>' + dn + '</td><td>' + a.scores[i] + '</td><td>' + b.scores[i] + '</td><td>' + (dlt > 0 ? '+' : '') + dlt + '</td></tr>';
    });
    html = '<p class="muted small">录音对比：第 ' + a.attempt + ' 次 ' + a.total + '/30 → 第 ' + b.attempt + ' 次 ' + b.total + '/30（' + (b.total-a.total>=0?'+':'') + (b.total-a.total) + '）</p>' +
      '<table class="dim-table"><thead><tr><th>维度</th><th>前次</th><th>本次</th><th>提升</th></tr></thead><tbody>' + rows + '</tbody></table>';
  } else if (recs.length === 1){
    html = '<p class="muted small">已保存第 ' + recs[0].attempt + ' 次录音（' + recs[0].total + '/30，' + esc(recs[0].level) + '）。再录一次自动生成六维对比。</p>';
  } else {
    html = '<p class="muted small">文字稿对比：第一次 16/30（53.3%）→ 再次 26/30（86.7%），+10 分；准确性、信息完整性各 +2，流利度、逻辑结构、自信度各 +1。下一步：改对原理（帕斯卡/油压/小活塞推大活塞）+ 补安全要点冲线 90 分。</p>';
  }
  return '<div class="card"><h2>前后练习对比</h2>' + html + '</div>';
}

function renderTeaching(){
  const root = $('#teachRoot');
  root.innerHTML = renderTeachingComparison() + '<div class="card"><h2>核心概念卡</h2>' + CONCEPTS.map(c => '<div class="concept"><b>' + esc(c.t) + '</b><div class="ex">' + esc(c.ex) + '</div><div class="do">' + esc(c.do) + '</div></div>').join('') + '</div>';
  root.innerHTML += '<div class="card"><h2>工程介绍九节点</h2>' + LESSONS.map(l => '<div class="lesson"><span class="no">' + l[0].slice(1,2) + '</span><div><b>' + esc(l[0]) + '</b><div class="muted small">' + esc(l[1]) + '</div><div class="muted small">范例：' + esc(l[2]) + '</div></div></div>').join('') + '</div>';
  root.innerHTML += '<div class="card"><h2>高频错误对照</h2>' + ERRORS.map(e => '<div class="err-row"><span class="bad">' + esc(e[0]) + '</span><span>→ 应写「' + esc(e[1]) + '」</span></div>').join('') + '</div>';
}

/* ---------------- history ---------------- */
function renderHistory(){
  const root = $('#histRoot');
  const done = (st.done || []);
  let html = '<div class="card hist-sec"><h2>教练进度</h2><p class="muted small">已完成 ' + done.length + '/9 个节点</p><div class="coach-progress">';
  for (const n of NODES){
    html += '<div class="coach-dot ' + (done.includes(n.id) ? 'done' : '') + '">' + n.id + '</div>';
  }
  html += '</div></div>';
  let recs = [];
  try { recs = JSON.parse(localStorage.getItem('pitch_records') || '[]'); } catch(e){}
  html += '<div class="card hist-sec"><h2>语音练习记录（打分界面快照）</h2>';
  if (!recs.length) html += '<p class="muted">还没有语音记录：到「语音训练」录音打分，会自动保存并出现在这里。</p>';
  recs.slice().reverse().forEach((r, idx) => {
    const d = new Date(r.ts);
    let dimRows = '';
    r.scores.forEach((v, i) => {
      const note = (r.dims && r.dims[i] && r.dims[i].note) || '';
      dimRows += '<tr><td>' + ['流利度','准确性','复杂度','信息完整性','逻辑结构','自信度'][i] + '</td><td><b>' + v + '</b></td><td class="diag">' + esc(note) + '</td></tr>';
    });
    html += '<div class="hist-item"><div class="row-between"><b>第 ' + r.attempt + ' 次练习</b><span class="pill">' + r.total + '/30 · ' + esc(r.level) + '</span></div>' +
      '<div class="muted small">' + d.toLocaleString() + ' · 百分制 ' + r.pct + ' · 时长 ' + Math.round(r.duration || 0) + ' 秒</div>' +
      '<div class="hist-grid"><canvas class="mini-radar" id="mr' + idx + '" width="160" height="160"></canvas>' +
      '<table class="dim-table mini">' + dimRows + '</table></div>' +
      (r.flags && r.flags.length ? '<div class="flags"><b>需纠正</b><ul>' + r.flags.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="small muted">' + esc((r.transcript||'').slice(0,120)) + '…</div></div>';
  });
  html += '</div>';
  setTimeout(() => {
    recs.slice().reverse().forEach((r, idx) => {
      const cv = document.getElementById('mr' + idx);
      if (cv) drawMiniRadar(cv, r.scores);
    });
  }, 0);
  root.innerHTML = html;
}

function drawMiniRadar(cv, scores){
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W/2, cy = H/2, R = Math.min(W,H)/2 - 24, n = 6;
  const names = ['流利度','准确性','复杂度','信息完整性','逻辑结构','自信度'];
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
  for (let i = 0; i < n; i++){ const [x,y] = pt(i,5); const a = (-90 + i*60) * Math.PI/180; g.fillText(names[i].slice(0,2), x + Math.cos(a)*16, y + Math.sin(a)*14 + 3); }
}

switchView('home');
