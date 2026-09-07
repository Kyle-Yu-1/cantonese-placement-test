/* 粤语能力定位测验 · 视图与流程 */
'use strict';

let engine=null, curItem=null, startTime=0;
let drillMode=false, drillList=[], drillIdx=0, drillRight=0;

/* ============ 首页 ============ */
function renderHome(){
  renderShell();
  const u=Store.current();
  const d=Store.ensure(u);
  const results=d.results||[];
  const last=results[results.length-1];
  const wrongCount=Object.keys(d.wrong||{}).filter(function(id){ return d.wrong[id] && d.wrong[id].count>0; }).length;
  const bankCount=Store.bank().length;
  appEl().innerHTML =
   '<section class="hero"><h2>你好，'+esc(u)+' 👋</h2><p class="muted">每次测试约 8–30 题，自适应定位你的粤语等级。</p></section>' +
   '<div class="stat-grid">' +
     '<div class="stat"><b>'+results.length+'</b><span>测试次数</span></div>' +
     '<div class="stat"><b>'+ (last ? (last.level.name+' · '+last.display+'分') : '—') +'</b><span>最近成绩</span></div>' +
     '<div class="stat"><b>'+wrongCount+'</b><span>待攻克错题</span></div>' +
     '<div class="stat"><b>'+bankCount+'</b><span>题库题数</span></div>' +
   '</div>' +
   '<div class="btn-grid">' +
     '<button class="btn big primary" id="btnStart">🎯 开始测试</button>' +
     '<button class="btn big" id="btnWrong">📕 错题本与重练</button>' +
     '<button class="btn big" id="btnTrends">📈 历史趋势</button>' +
     '<button class="btn big" id="btnSettings">⚙️ 设置与题库</button>' +
     '<button class="btn big" id="btnRules">📋 评分规则</button>' +
   '</div>';
  $('#btnStart').addEventListener('click', startTest);
  $('#btnWrong').addEventListener('click', renderWrongBook);
  $('#btnTrends').addEventListener('click', renderTrends);
  $('#btnSettings').addEventListener('click', renderSettings);
  $('#btnRules').addEventListener('click', renderRules);
}

/* ============ 测试流程 ============ */
function startTest(){
  const bank=Store.bank();
  if(bank.length<MIN_ITEMS){ toast('题库题数不足，无法测试'); return; }
  drillMode=false;
  engine=buildEngine(bank);
  startTime=Date.now();
  nextQuestion();
}
function nextQuestion(){
  if(engine.isDone()){ finishTest(); return; }
  const q=engine.nextItem();
  if(!q){ finishTest(); return; }
  curItem=q;
  renderQuestion(q, false);
}

function qTypeHtml(q){
  const jp=(showJp() && q.jyutping) ? '<div class="jyutping">粤拼：'+esc(q.jyutping)+'</div>' : '';
  if(q.type==='listening'){
    return '<div class="audio-row">' +
      '<button class="btn audio" id="btnPlay">🔊 播放</button>' +
      '<button class="btn ghost" id="btnPlaySlow">🐢 慢速</button>' +
      '<span class="muted small" id="voiceHint"></span>' +
      '</div>' +
      '<div id="audioFallback" class="audio-fallback hidden"><b>'+esc(q.audioText||q.text||'')+'</b>'+jp+'</div>' +
      optionsHtml(q);
  }
  if(q.type==='speaking'){
    return '<div class="audio-row"><button class="btn audio" id="btnPlay">🔊 播放示范</button><button class="btn ghost" id="btnPlaySlow">🐢 慢速</button></div>' +
      '<div class="jyutping big">示范：<b>'+esc(q.text||'')+'</b> · '+esc(q.jyutping||'')+'</div>' +
      '<div class="record-row"><button class="btn record" id="btnRec">🎤 开始录音</button><span id="recTime" class="muted"></span></div>' +
      '<div id="recPlay" class="hidden"><p class="muted">回听你的录音：</p><audio id="recAudio" controls></audio></div>' +
      '<div id="scorePanel" class="hidden">' +
        '<div class="slider-row"><label>发音准确度</label><input type="range" id="sAcc" min="0" max="10" value="8"><b id="vAcc">8</b></div>' +
        '<div class="slider-row"><label>声调准确度</label><input type="range" id="sTone" min="0" max="10" value="8"><b id="vTone">8</b></div>' +
        '<div class="slider-row"><label>流利度</label><input type="range" id="sFlu" min="0" max="10" value="8"><b id="vFlu">8</b></div>' +
        '<div class="score-preview">本题得分：<b id="scoreVal">80</b> / 100</div>' +
        '<div class="hint" id="aiStatus" style="color:#64748b"></div>' +
      '</div>';
  }
  if(q.type==='fill'){
    return '<div class="fill-row"><input id="fillInput" placeholder="输入答案"><button class="btn ghost" id="btnHint" type="button" title="提示">💡</button></div>' +
      '<div class="hint hidden" id="fillHint" style="color:#64748b">'+esc(q.explanation||'')+'</div>'+jp;
  }
  if(q.type==='match'){
    const rights=shuffle(q.pairs.map(function(p){ return p.right; }));
    const rows=q.pairs.map(function(p,i){
      return '<div class="match-row"><span class="match-left">'+esc(p.left)+'</span><span class="arrow">↔</span>' +
        '<select class="match-sel" data-i="'+i+'"><option value="">—选择—</option>' +
        rights.map(function(r){ return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('') +
        '</select></div>';
    }).join('');
    return '<div class="match-box">'+rows+'</div>'+jp;
  }
  return optionsHtml(q)+jp;
}
function optionsHtml(q){
  const opts=(q.options||[]).map(function(o,i){ return '<button class="opt" data-i="'+i+'">'+esc(o)+'</button>'; }).join('');
  return '<div class="options" id="options">'+opts+'</div>';
}

function renderQuestion(q, isDrill){
  const answeredCount=isDrill ? drillIdx : engine.count();
  const totalHint=isDrill ? ('错题重练 '+ (drillIdx+1) +'/'+ drillList.length) : ('正在定位 · 第 '+ (answeredCount+1) +' 题');
  let estHtml='';
  if(!isDrill && engine.count()>=2){
    const est=engine.posterior();
    const L=levelOf(est.mean);
    estHtml='<span class="est-pill">当前估计：'+esc(L.name)+'（约 '+thetaToDisplay(est.mean)+' 分）</span>';
  }
  const dim=DIMENSIONS[q.dimension]||{label:q.dimension,color:'#94a3b8'};
  const pct=Math.min(100, (isDrill ? (drillIdx+1)/drillList.length : engine.count()/PROG_REF)*100);
  appEl().innerHTML =
   '<div class="test-top">' +
     '<button class="btn ghost" id="btnQuit">✕ 退出</button>' +
     '<div class="prog-text"><span>'+totalHint+'</span>'+estHtml+'</div>' +
     '<div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%"></div></div>' +
   '</div>' +
   '<div class="card qcard">' +
     '<div class="q-meta"><span class="tag" style="background:'+dim.color+'22;color:'+dim.color+'">'+esc(dim.label)+'</span><span class="tag">L'+q.level+'</span></div>' +
     '<h3 class="q-prompt">'+esc(q.prompt)+'</h3>' +
     qTypeHtml(q) +
     '<div class="q-foot"><button class="btn primary" id="btnSubmit" '+(q.type==='speaking'?'disabled':'')+'>提交答案</button></div>' +
   '</div>';
  $('#btnQuit').addEventListener('click', function(){ if(confirm('退出本次测试？当前进度不会保存。')) renderHome(); });
  bindQuestion(q, isDrill);
}

function bindQuestion(q, isDrill){
  const submitBtn=$('#btnSubmit');
  let chosen=null, fillVal='';
  if(q.type==='listening' || q.type==='mc'){
    $$('#options .opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        $$('#options .opt').forEach(function(b){ b.classList.remove('sel'); });
        btn.classList.add('sel');
        chosen=Number(btn.dataset.i);
      });
    });
  }
  if(q.type==='fill'){
    $('#fillInput').addEventListener('input', function(e){ fillVal=e.target.value; });
    $('#btnHint').addEventListener('click', function(){ $('#fillHint').classList.toggle('hidden'); });
  }
  const play=$('#btnPlay'), slow=$('#btnPlaySlow');
  if(play){
    play.addEventListener('click', function(){ TTS.speak(q.audioText||q.text||''); });
    if(slow) slow.addEventListener('click', function(){ TTS.speak(q.audioText||q.text||'', {rate:0.7}); });
    const vh=$('#voiceHint');
    if(vh && !TTS.hasCant()){
      vh.textContent='⚠️ 无粤语音色，已降级为文字+粤拼';
      const fb=$('#audioFallback');
      if(fb) fb.classList.remove('hidden');
    }
  }
  if(q.type==='speaking') bindSpeaking(q, isDrill);
  submitBtn.addEventListener('click', function(){
    if(q.type==='mc' || q.type==='listening'){
      if(chosen===null){ toast('请先选择一个答案'); return; }
      submitAnswer(chosen===Number(q.answer)?1:0, q, String(q.options[chosen]), isDrill);
    } else if(q.type==='fill'){
      const v=normText(fillVal);
      if(!v){ toast('请输入答案'); return; }
      const ok=normText(q.answer)===v || (q.accept||[]).some(function(a){ return normText(a)===v; });
      submitAnswer(ok?1:0, q, fillVal, isDrill);
    } else if(q.type==='match'){
      const sels=$$('.match-sel');
      if(sels.some(function(s){ return !s.value; })){ toast('请完成全部连线'); return; }
      let ok=true; const pairs=[];
      sels.forEach(function(sel){
        const i=Number(sel.dataset.i);
        pairs.push(q.pairs[i].left+'→'+sel.value);
        if(sel.value!==q.pairs[i].right) ok=false;
      });
      submitAnswer(ok?1:0, q, pairs.join('；'), isDrill);
    }
  });
}

function aiConfig(){
  const u=Store.current();
  const s=u ? (Store.data(u).settings||{}) : {};
  return { endpoint:(s.aiEndpoint||'').trim(), key:(s.aiKey||'').trim() };
}

async function aiScore(blob, item, cfg){
  const buf=await blob.arrayBuffer();
  const bytes=new Uint8Array(buf);
  let bin='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){ bin+=String.fromCharCode.apply(null, bytes.subarray(i, i+chunk)); }
  const res=await fetch(cfg.endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':cfg.key||'' },
    body:JSON.stringify({ audio:btoa(bin), expected:item.text||item.audioText||'', jyutping:item.jyutping||'', mime:blob.type||'audio/webm' })
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  const j=await res.json();
  const n=function(v){ v=Number(v); if(v>1) v=v/100; return clamp(v,0,1); };
  return { acc:n(j.accuracy), tone:n(j.tone), flu:n(j.fluency), feedback:j.feedback||'', transcript:j.transcript||'' };
}

function bindSpeaking(q, isDrill){
  const btnRec=$('#btnRec'), recTime=$('#recTime'), scorePanel=$('#scorePanel'), submitBtn=$('#btnSubmit');
  let recording=false, blob=null;
  function updateScore(){
    const v=Math.round((Number($('#sAcc').value)+Number($('#sTone').value)+Number($('#sFlu').value))/3*10);
    $('#scoreVal').textContent=v;
    $('#vAcc').textContent=$('#sAcc').value;
    $('#vTone').textContent=$('#sTone').value;
    $('#vFlu').textContent=$('#sFlu').value;
  }
  ['sAcc','sTone','sFlu'].forEach(function(id){ $('#'+id).addEventListener('input', updateScore); });
  btnRec.addEventListener('click', async function(){
    if(recording){
      btnRec.disabled=true; btnRec.textContent='⏳ 处理中…';
      blob=await Recorder.stop(false);
      recording=false;
      btnRec.disabled=false; btnRec.textContent='🔁 重新录音';
      if(!blob){ toast('未录到音频，请重试'); return; }
      $('#recAudio').src=URL.createObjectURL(blob);
      $('#recPlay').classList.remove('hidden');
      scorePanel.classList.remove('hidden');
      submitBtn.disabled=false;
      updateScore();
      const cfg=aiConfig();
      if(cfg.endpoint){
        $('#aiStatus').textContent='AI 评分中…';
        try{
          const r=await aiScore(blob, q, cfg);
          $('#sAcc').value=Math.round(r.acc*10);
          $('#sTone').value=Math.round(r.tone*10);
          $('#sFlu').value=Math.round(r.flu*10);
          updateScore();
          $('#aiStatus').textContent=r.feedback ? ('AI 反馈：'+r.feedback) : 'AI 评分完成';
        }catch(err){ $('#aiStatus').textContent='AI 评分失败，请手动调整滑块。'; }
      } else {
        $('#aiStatus').textContent='未配置 AI 评分接口：请对照示范与粤拼，手动调整滑块。';
      }
    } else {
      try{
        $('#recPlay').classList.add('hidden');
        await Recorder.start(function(t){ recTime.textContent=fmtDur(t); });
        recording=true;
        btnRec.textContent='⏹ 停止录音';
      }catch(err){ toast('无法录音：'+err.message); }
    }
  });
  submitBtn.addEventListener('click', function(){
    const v=Math.round((Number($('#sAcc').value)+Number($('#sTone').value)+Number($('#sFlu').value))/3*10);
    submitAnswer(v/100, q, '口语评分 '+v+' 分', isDrill);
  });
}

function submitAnswer(score, q, userAnswer, isDrill){
  if(isDrill){
    const d=Store.ensure(Store.current());
    const w=d.wrong||{};
    const ok=score>=PASS;
    if(ok){ drillRight++; if(w[q.id]){ w[q.id].count--; w[q.id].last={date:Date.now(),ok:true}; if(w[q.id].count<=0) delete w[q.id]; } }
    else if(w[q.id]){ w[q.id].count++; w[q.id].last={date:Date.now(),ok:false}; }
    d.wrong=w;
    Store.save(Store.current(), d);
    showDrillFeedback(q, score, userAnswer, ok);
    return;
  }
  engine.submit(q, score);
  nextQuestion();
}

function showAnswer(q){
  if(q.type==='match') return q.pairs.map(function(p){ return p.left+'↔'+p.right; }).join('；');
  if(q.type==='mc' || q.type==='listening') return (q.options||[])[q.answer];
  return q.answer||'';
}
function showDrillFeedback(q, score, userAnswer, ok){
  appEl().innerHTML =
   '<div class="card qcard">' +
     '<div class="fb-badge '+(ok?'ok':'bad')+'">'+(ok?'✔ 答对了':'✘ 答错了')+'</div>' +
     '<h3 class="q-prompt">'+esc(q.prompt)+'</h3>' +
     '<p>你的答案：<b>'+esc(userAnswer)+'</b>（'+Math.round(score*100)+' 分）</p>' +
     (showAnswer(q) ? '<p>正确答案：<b>'+esc(showAnswer(q))+'</b></p>' : '') +
     (q.jyutping ? '<p class="jyutping">粤拼：'+esc(q.jyutping)+'</p>' : '') +
     '<p class="muted">'+esc(q.explanation||'')+'</p>' +
     '<button class="btn primary" id="btnNextDrill">下一题</button>' +
   '</div>';
  $('#btnNextDrill').addEventListener('click', function(){
    drillIdx++;
    if(drillIdx>=drillList.length){ endDrill(); } else { renderQuestion(drillList[drillIdx], true); }
  });
}

/* ============ 结果与报告 ============ */
function finishTest(){
  const est=engine.posterior();
  const answered=engine.answered();
  const theta=est.mean;
  const display=thetaToDisplay(theta);
  const level=levelOf(theta);
  const ci=Math.round(est.sd*10*1.96*10)/10;
  const dims={};
  for(const k of DIM_KEYS){
    const arr=answered.filter(function(a){ return a.item.dimension===k; });
    dims[k]={ n:arr.length, pct:arr.length ? Math.round(arr.reduce(function(s,a){ return s+a.score; },0)/arr.length*100) : null };
  }
  let weighted=0, wsum=0;
  for(const k of DIM_KEYS){ if(dims[k].pct!=null){ weighted+=dims[k].pct*DIMENSIONS[k].weight; wsum+=DIMENSIONS[k].weight; } }
  weighted=wsum ? Math.round(weighted/wsum) : 0;
  const weak=[];
  for(const k of DIM_KEYS){
    const p=dims[k].pct;
    if(p!=null && (p<60 || p<display-15)) weak.push({ key:k, label:DIMENSIONS[k].label, pct:p });
  }
  weak.sort(function(a,b){ return a.pct-b.pct; });
  const suggestions=weak.length
    ? weak.slice(0,3).map(function(w){ return { dim:w.label, tips:SUGGESTIONS[w.key] }; })
    : [{ dim:'整体', tips:['各维度比较均衡：按学习计划持续输入+输出，稳步提升'] }];
  const result={
    id:Date.now(), date:fmtDate(), dur:Math.round((Date.now()-startTime)/1000),
    display:display, theta:Math.round(theta*100)/100, ci:ci,
    level:{ name:level.name, label:level.label },
    dims:dims, weighted:weighted, weak:weak, suggestions:suggestions,
    plan:buildPlan(dims),
    answers:answered.map(function(a){ return { qid:a.item.id, type:a.item.type, dimension:a.item.dimension, prompt:a.item.prompt, score:Math.round(a.score*100), correct:a.correct }; })
  };
  const u=Store.current();
  const d=Store.ensure(u);
  d.results.push(result);
  answered.forEach(function(a){
    if(!a.correct){
      const w=d.wrong[a.item.id]||{count:0, first:Date.now()};
      w.count++; w.last={date:Date.now(), ok:false};
      d.wrong[a.item.id]=w;
    } else if(d.wrong[a.item.id]){
      d.wrong[a.item.id].count=Math.max(0, d.wrong[a.item.id].count-1);
      if(d.wrong[a.item.id].count<=0) delete d.wrong[a.item.id];
    }
  });
  Store.save(u,d);
  renderReport(result);
}

function dimListHtml(r){
  return DIM_KEYS.map(function(k){
    const dim=DIMENSIONS[k], d=r.dims[k];
    const pct=d.pct==null ? '—' : d.pct;
    const bar=Math.max(3, Math.min(100, d.pct==null?0:d.pct));
    return '<div class="dim-row"><span class="dim-name">'+dim.label+'</span>' +
      '<span class="dim-bar"><span style="width:'+bar+'%;background:'+dim.color+'"></span></span>' +
      '<b>'+pct+(d.pct!=null?'分':'')+'</b><span class="muted">('+d.n+'题)</span></div>';
  }).join('');
}
function diagHtml(r){
  if(!r.weak.length) return '<p>各维度表现均衡，综合加权分 '+r.weighted+' 分。</p>';
  return '<p>综合加权分：<b>'+r.weighted+'</b> 分。需要加强：'+r.weak.map(function(w){ return w.label; }).join('、')+'。</p>' +
    r.suggestions.map(function(s){
      return '<div class="sugg"><b>'+esc(s.dim)+'</b><ul>'+s.tips.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul></div>';
    }).join('');
}
function planHtml(r){
  return '<div class="plan-grid">'+r.plan.map(function(d){
    return '<div class="plan-item"><span class="plan-day">D'+String(d.day).padStart(2,'0')+'</span><span class="tag-dim">'+esc(d.dim)+'</span><span>'+esc(d.task)+'</span></div>';
  }).join('')+'</div>';
}
function reviewHtml(r){
  const bank=Store.bank();
  const byId={};
  bank.forEach(function(q){ byId[q.id]=q; });
  return '<div class="review-list">'+r.answers.map(function(a){
    const q=byId[a.qid]||{};
    const dim=DIMENSIONS[a.dimension]||{label:a.dimension,color:'#94a3b8'};
    return '<div class="review-item '+(a.correct?'ok':'bad')+'"><span class="r-icon">'+(a.correct?'✔':'✘')+'</span>' +
      '<div><span class="tag" style="color:'+dim.color+'">'+dim.label+'</span> '+esc(a.prompt)+' <span class="muted">('+a.score+'分)</span>' +
      (q.explanation ? '<div class="muted small">'+esc(q.explanation)+'</div>' : '') +
      '</div></div>';
  }).join('')+'</div>';
}

function renderReport(r){
  const L=r.level;
  appEl().innerHTML =
   '<div class="report print-area" id="printArea">' +
     '<div class="report-head"><h2>📊 测试报告</h2><p class="muted">'+esc(Store.current())+' · '+esc(r.date)+' · 用时 '+fmtDur(r.dur)+' · 共 '+r.answers.length+' 题</p></div>' +
     '<div class="score-hero">' +
       '<div><div class="level-badge">'+esc(L.name)+'</div><div class="level-label">'+esc(L.label)+'</div></div>' +
       '<div class="score-num">'+r.display+'<small> /100</small></div>' +
       '<div class="score-ci">95% 置信区间：'+(r.display-r.ci)+' – '+(r.display+r.ci)+'</div>' +
     '</div>' +
     '<div class="report-grid">' +
       '<div class="card"><h3>各维度得分</h3><canvas id="radar" width="340" height="280"></canvas><div class="dim-list">'+dimListHtml(r)+'</div></div>' +
       '<div class="card"><h3>诊断与建议</h3>'+diagHtml(r)+'</div>' +
     '</div>' +
     '<div class="card"><h3>📅 两周学习计划</h3>'+planHtml(r)+'</div>' +
     '<div class="card"><h3>答题回顾</h3>'+reviewHtml(r)+'</div>' +
     '<div class="report-actions no-print">' +
       '<button class="btn primary" id="btnPrint">🖨 导出/打印报告</button>' +
       '<button class="btn" id="btnAgain">🔁 再测一次</button>' +
       '<button class="btn" id="btnHome">🏠 返回首页</button>' +
     '</div>' +
   '</div>';
  $('#btnPrint').addEventListener('click', function(){ window.print(); });
  $('#btnAgain').addEventListener('click', startTest);
  $('#btnHome').addEventListener('click', renderHome);
  drawRadar($('#radar'), r.dims);
}

function drawRadar(canvas, dims){
  const ctx=canvas.getContext('2d');
  const n=DIM_KEYS.length;
  const cx=canvas.width/2, cy=canvas.height/2, R=Math.min(cx,cy)-34;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const ang=function(i){ return -Math.PI/2 + i*2*Math.PI/n; };
  for(let g=1;g<=4;g++){
    const rr=R*g/4;
    ctx.beginPath();
    for(let i=0;i<n;i++){
      const x=cx+Math.cos(ang(i))*rr, y=cy+Math.sin(ang(i))*rr;
      if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
    }
    ctx.closePath(); ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1; ctx.stroke();
  }
  ctx.fillStyle='#334155'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let i=0;i<n;i++){
    const x=cx+Math.cos(ang(i))*R, y=cy+Math.sin(ang(i))*R;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.strokeStyle='#e2e8f0'; ctx.stroke();
    ctx.fillText(DIMENSIONS[DIM_KEYS[i]].label, cx+Math.cos(ang(i))*(R+20), cy+Math.sin(ang(i))*(R+20));
  }
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const pct=(dims[DIM_KEYS[i]].pct==null?0:dims[DIM_KEYS[i]].pct)/100;
    const rr=Math.max(0.04, Math.min(1,pct))*R;
    const x=cx+Math.cos(ang(i))*rr, y=cy+Math.sin(ang(i))*rr;
    if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fillStyle='rgba(79,124,255,0.25)'; ctx.fill();
  ctx.strokeStyle='#4f7cff'; ctx.lineWidth=2; ctx.stroke();
  for(let i=0;i<n;i++){
    const pct=(dims[DIM_KEYS[i]].pct==null?0:dims[DIM_KEYS[i]].pct)/100;
    const rr=Math.max(0.04, Math.min(1,pct))*R;
    ctx.beginPath(); ctx.arc(cx+Math.cos(ang(i))*rr, cy+Math.sin(ang(i))*rr, 3, 0, Math.PI*2);
    ctx.fillStyle='#4f7cff'; ctx.fill();
  }
}

/* ============ 错题本 ============ */
function renderWrongBook(){
  const u=Store.current();
  const d=Store.ensure(u);
  const bank=Store.bank();
  const ids=Object.keys(d.wrong||{}).filter(function(id){ return d.wrong[id].count>0; });
  const items=ids.map(function(id){ return bank.find(function(q){ return q.id===id; }); }).filter(Boolean);
  appEl().innerHTML =
   '<div class="page-head"><h2>📕 错题本</h2><button class="btn ghost" id="btnBack">← 返回</button></div>' +
   (items.length
     ? '<p class="muted">共 '+items.length+' 道待攻克错题。重练答对会减少次数，答错会增加。</p>' +
       '<div class="btn-row"><button class="btn primary" id="btnDrill">🔁 开始重练</button><button class="btn ghost" id="btnClear">清空错题本</button></div>' +
       '<div class="list">'+items.map(function(q){
         const w=d.wrong[q.id];
         const dim=DIMENSIONS[q.dimension]||{label:q.dimension,color:'#94a3b8'};
         return '<div class="list-item"><div><span class="tag" style="color:'+dim.color+'">'+dim.label+'</span> <b>'+esc(q.prompt)+'</b><div class="muted small">'+esc(q.explanation||'')+'</div></div><span class="badge-count">'+w.count+'</span></div>';
       }).join('')+'</div>'
     : '<div class="empty">🎉 暂无错题，去做一次测试吧。</div>');
  $('#btnBack').addEventListener('click', renderHome);
  if(items.length){
    $('#btnClear').addEventListener('click', function(){ if(confirm('确定清空全部错题？')){ d.wrong={}; Store.save(u,d); renderWrongBook(); } });
    $('#btnDrill').addEventListener('click', function(){
      drillMode=true; drillList=items; drillIdx=0; drillRight=0;
      renderQuestion(drillList[0], true);
    });
  }
}
function endDrill(){
  toast('重练完成：'+drillRight+'/'+drillList.length+' 题答对');
  renderWrongBook();
}

/* ============ 历史趋势 ============ */
function renderTrends(){
  const u=Store.current();
  const d=Store.ensure(u);
  const rs=(d.results||[]).slice(-30);
  appEl().innerHTML =
   '<div class="page-head"><h2>📈 历史趋势</h2><button class="btn ghost" id="btnBack">← 返回</button></div>' +
   (rs.length
     ? '<div class="card"><canvas id="trend" width="720" height="240"></canvas></div>' +
       '<div class="list">'+rs.slice().reverse().map(function(r){
         return '<div class="list-item"><div><b>'+esc(r.date)+'</b> · '+r.answers.length+' 题 · 用时 '+fmtDur(r.dur)+'</div><div><span class="level-badge small">'+esc(r.level.name)+'</span> <b>'+r.display+'分</b></div></div>';
       }).join('')+'</div>'
     : '<div class="empty">还没有测试记录。</div>');
  $('#btnBack').addEventListener('click', renderHome);
  if(rs.length) drawTrend($('#trend'), rs);
}
function drawTrend(canvas, rs){
  const ctx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  const pad=28, plotW=W-pad*2, plotH=H-pad*2;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#e2e8f0'; ctx.fillStyle='#64748b'; ctx.font='11px system-ui';
  for(let i=0;i<=4;i++){
    const y=pad+plotH*i/4;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
    ctx.fillText(String(100-25*i), 2, y+3);
  }
  const xs=rs.map(function(r,i){ return rs.length===1 ? W/2 : pad+plotW*i/(rs.length-1); });
  const ys=rs.map(function(r){ return pad+plotH*(1-r.display/100); });
  ctx.strokeStyle='#4f7cff'; ctx.lineWidth=2; ctx.beginPath();
  xs.forEach(function(x,i){ if(i) ctx.lineTo(x,ys[i]); else ctx.moveTo(x,ys[i]); });
  ctx.stroke();
  xs.forEach(function(x,i){
    ctx.beginPath(); ctx.arc(x,ys[i],4,0,Math.PI*2); ctx.fillStyle='#4f7cff'; ctx.fill();
    ctx.fillStyle='#334155'; ctx.textAlign='center'; ctx.fillText(rs[i].level.name, x, ys[i]-8);
  });
  ctx.fillStyle='#94a3b8'; ctx.fillText('每次测试的定位分（0–100）', pad, H-6);
}

/* ============ 设置 ============ */
function renderSettings(){
  const u=Store.current();
  const d=Store.ensure(u);
  const s=d.settings||{};
  const voices=TTS.cant.map(function(v){ return '<option value="'+esc(v.name)+'"'+(s.ttsVoice===v.name?' selected':'')+'>'+esc(v.name)+'</option>'; }).join('');
  appEl().innerHTML =
   '<div class="page-head"><h2>⚙️ 设置</h2><button class="btn ghost" id="btnBack">← 返回</button></div>' +
   '<div class="card">' +
     '<h3>🤖 AI 口语评分接口（可选）</h3>' +
     '<p class="muted">留空则口语题使用“示范对照 + 手动打分”。接口需接受 POST JSON，返回 {accuracy,tone,fluency,feedback}（0–1 或 0–100）。本项目已附 api/score.js 示例。</p>' +
     '<label class="field">接口地址<input id="aiEndpoint" value="'+esc(s.aiEndpoint||'')+'" placeholder="https://你的域名/api/score"></label>' +
     '<label class="field">API Key<input id="aiKey" type="password" value="'+esc(s.aiKey||'')+'" placeholder="服务端校验用，可留空"></label>' +
   '</div>' +
   '<div class="card">' +
     '<h3>🔊 语音</h3>' +
     '<label class="field">语速 <span id="rateVal">'+(s.ttsRate||1)+'×</span><input type="range" id="ttsRate" min="0.6" max="1.4" step="0.1" value="'+(s.ttsRate||1)+'"></label>' +
     '<label class="field">粤语音色<select id="ttsVoice">'+(voices||'<option value="">（无粤语音色）</option>')+'</select></label>' +
     '<button class="btn" id="btnTestVoice">🔊 试听</button>' +
   '</div>' +
   '<div class="card">' +
     '<h3>💾 数据</h3>' +
     '<div class="btn-row"><button class="btn" id="btnExportData">导出本账号数据</button><button class="btn" id="btnImportData">导入本账号数据</button><button class="btn danger" id="btnWipe">清空本账号数据</button></div>' +
   '</div>' +
   '<div class="card">' +
     '<h3>📚 题库</h3>' +
     '<p class="muted">当前 '+Store.bank().length+' 题'+(Store.bank()!==BUILTIN_BANK?'（使用导入题库）':'（内置题库）')+'</p>' +
     '<div class="btn-row"><button class="btn" id="btnExportBank">导出题库 JSON</button><button class="btn" id="btnImportBank">导入题库 JSON</button><button class="btn ghost" id="btnResetBank">恢复内置题库</button></div>' +
     '<input type="file" id="bankFile" accept=".json,application/json" hidden>' +
   '</div>' +
   '<div class="card"><h3>📋 说明</h3><p class="muted"><a href="#" id="linkRules">查看评分规则</a> · 本地演示模式数据仅存于此浏览器，跨设备请用导出/导入。</p></div>';
  $('#btnBack').addEventListener('click', renderHome);
  $('#linkRules').addEventListener('click', function(e){ e.preventDefault(); renderRules(); });
  $('#ttsRate').addEventListener('input', function(e){ $('#rateVal').textContent=e.target.value+'×'; });
  const saveSettings=function(){
    d.settings={ aiEndpoint:$('#aiEndpoint').value.trim(), aiKey:$('#aiKey').value.trim(), ttsRate:Number($('#ttsRate').value), ttsVoice:$('#ttsVoice').value };
    Store.save(u,d);
  };
  $('#aiEndpoint').addEventListener('change', saveSettings);
  $('#aiKey').addEventListener('change', saveSettings);
  $('#ttsVoice').addEventListener('change', saveSettings);
  $('#ttsRate').addEventListener('change', saveSettings);
  $('#btnTestVoice').addEventListener('click', function(){ saveSettings(); TTS.test(); });
  $('#btnExportData').addEventListener('click', function(){ download('粤语测验数据_'+u+'.json', JSON.stringify(d,null,2)); });
  $('#btnImportData').addEventListener('click', function(){
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='.json';
    inp.onchange=async function(e){
      const f=e.target.files[0]; if(!f) return;
      try{
        const j=JSON.parse(await f.text());
        if(!Array.isArray(j.results)) throw new Error('bad');
        Store.save(u,j); toast('导入成功'); renderSettings();
      }catch(err){ toast('导入失败：文件格式不正确'); }
    };
    inp.click();
  });
  $('#btnWipe').addEventListener('click', function(){
    if(confirm('确定清空本账号的所有成绩与错题？此操作不可恢复。')){
      Store.save(u, {results:[], wrong:{}, settings:d.settings});
      renderSettings(); toast('已清空');
    }
  });
  $('#btnExportBank').addEventListener('click', function(){ download('question-bank.json', JSON.stringify(Store.bank(),null,2)); });
  $('#btnImportBank').addEventListener('click', function(){ $('#bankFile').click(); });
  $('#bankFile').addEventListener('change', async function(e){
    const f=e.target.files[0]; if(!f) return;
    try{
      const j=JSON.parse(await f.text());
      if(!validateBank(j)) throw new Error('bad');
      Store.setBank(j);
      toast('题库导入成功（'+j.length+' 题）');
      setTimeout(renderHome, 400);
    }catch(err){ toast('题库格式不正确'); }
  });
  $('#btnResetBank').addEventListener('click', function(){ Store.setBank(null); toast('已恢复内置题库'); setTimeout(renderHome, 400); });
}
function validateBank(arr){
  if(!Array.isArray(arr)||!arr.length) return false;
  return arr.every(function(q){
    return q && q.id && q.prompt && q.type && typeof q.difficulty==='number' && q.level && DIMENSIONS[q.dimension] &&
      ['mc','fill','match','listening','speaking'].indexOf(q.type)>=0;
  });
}

/* ============ 评分规则 ============ */
function renderRules(){
  appEl().innerHTML =
   '<div class="page-head"><h2>📋 评分规则</h2><button class="btn ghost" id="btnBack">← 返回</button></div>' +
   '<div class="card"><h3>自适应定位算法</h3>' +
     '<p>测验采用单参数 logistic（Rasch）模型：能力 θ 与题目难度同处 -5～+5 的量表，答对概率 P=1/(1+e^(难度-θ))。</p>' +
     '<ul>' +
       '<li>起始：假定使用者为零基础，θ 先验均值 -3.5；</li>' +
       '<li>选题：优先选难度最接近当前估计、且维度覆盖少的题目（相邻题难度跨度小）；</li>' +
       '<li>估计：每答一题用 EAP 更新 θ 的后验均值与标准差；</li>' +
       '<li>终止：至少 8 题后，后验标准差 ≤ 0.3（或达到 30 题上限）即结束；</li>' +
       '<li>口语题分数 0–100 按比例计入似然，≥60 分记为“答对”。</li>' +
     '</ul>' +
   '</div>' +
   '<div class="card"><h3>等级与分数换算</h3>' +
     '<p>能力分 = (θ+5)×10，范围 0–100；等级划分如下：</p>' +
     '<div class="list">'+LEVELS.map(function(L){
       return '<div class="list-item"><b>'+L.name+' '+L.label+'</b><span class="muted">能力分 '+Math.round((L.min+5)*10)+'–'+Math.round((L.max+5)*10)+' · '+L.desc+'</span></div>';
     }).join('')+'</div>' +
   '</div>' +
   '<div class="card"><h3>维度权重</h3>' +
     '<p class="muted">综合加权分按各维度得分加权：听 30%、说 30%、词汇 15%、语法 10%、粤拼/汉字 10%、俗语 5%。等级由整体能力 θ 决定。</p>' +
   '</div>' +
   '<div class="card"><h3>口语题评分</h3>' +
     '<ul>' +
       '<li>配置 AI 接口：录音上传，返回发音/声调/流利度并给出反馈；</li>' +
       '<li>未配置：对照示范与粤拼，由使用者自评三个维度；</li>' +
       '<li>浏览器没有粤语音色时，听力/口语示范自动降级为文字+粤拼。</li>' +
     '</ul>' +
   '</div>';
  $('#btnBack').addEventListener('click', renderHome);
}
/* 暴露视图 API（供测试/扩展） */
window.CY = Object.assign(window.CY||{}, { renderHome:renderHome, startTest:startTest, finishTest:finishTest, renderReport:renderReport, renderQuestion:renderQuestion, qTypeHtml:qTypeHtml, drawRadar:drawRadar, renderWrongBook:renderWrongBook, renderTrends:renderTrends, renderSettings:renderSettings, renderRules:renderRules, validateBank:validateBank });
