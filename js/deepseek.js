/* 口语题：浏览器语音识别转写 + DeepSeek 大模型评分（不识别时回退录音自评） */
'use strict';

async function aiScoreText(text, item, cfg){
  const res = await fetch(cfg.endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':cfg.key||'' },
    body:JSON.stringify({ transcript:text, expected:item.text||item.audioText||'', jyutping:item.jyutping||'' })
  });
  if (!res.ok) throw new Error('HTTP '+res.status);
  const j = await res.json();
  const n = function(v){ v = Number(v); if (v > 1) v = v / 100; return clamp(v, 0, 1); };
  return { acc:n(j.accuracy), tone:n(j.tone), flu:n(j.fluency), feedback:j.feedback||'' };
}

bindSpeaking = function(q, isDrill){
  const btnRec=$('#btnRec'), recTime=$('#recTime'), scorePanel=$('#scorePanel'), submitBtn=$('#btnSubmit');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active=false, transcript='', rec=null, blob=null, recording=false;

  function updateScore(){
    const v = Math.round((Number($('#sAcc').value)+Number($('#sTone').value)+Number($('#sFlu').value))/3*10);
    $('#scoreVal').textContent=v;
    $('#vAcc').textContent=$('#sAcc').value;
    $('#vTone').textContent=$('#sTone').value;
    $('#vFlu').textContent=$('#sFlu').value;
  }
  ['sAcc','sTone','sFlu'].forEach(function(id){ $('#'+id).addEventListener('input', updateScore); });

  function showPanelAndStatus(msg){
    scorePanel.classList.remove('hidden');
    submitBtn.disabled=false;
    updateScore();
    $('#aiStatus').textContent=msg;
  }
  async function scoreByAI(text){
    const cfg=aiConfig();
    if(cfg.endpoint){
      $('#aiStatus').textContent='AI 评分中…';
      try{
        const r=await aiScoreText(text, q, cfg);
        $('#sAcc').value=Math.round(r.acc*10);
        $('#sTone').value=Math.round(r.tone*10);
        $('#sFlu').value=Math.round(r.flu*10);
        updateScore();
        $('#aiStatus').textContent = r.feedback ? ('AI 反馈：'+r.feedback) : 'AI 评分完成';
      }catch(err){ $('#aiStatus').textContent='AI 评分失败，请手动调整滑块。'; }
    } else {
      $('#aiStatus').textContent='未配置 AI 评分接口：请对照示范与粤拼，手动调整滑块。';
    }
  }
  function ensureBox(){
    let b=document.getElementById('srBox');
    if(!b){
      b=document.createElement('div');
      b.id='srBox';
      b.className='audio-fallback';
      const row=document.querySelector('.record-row');
      if(row && row.parentNode) row.parentNode.insertBefore(b, row.nextSibling);
    }
    return b;
  }
  async function startRecordingFlow(){
    try{
      await Recorder.start(function(t){ recTime.textContent=fmtDur(t); });
      recording=true;
      btnRec.textContent='⏹ 停止录音';
    }catch(err){ toast('无法录音：'+err.message); }
  }
  async function stopRecordingFlow(){
    btnRec.disabled=true; btnRec.textContent='⏳ 处理中…';
    blob=await Recorder.stop(false);
    recording=false;
    btnRec.disabled=false; btnRec.textContent='🔁 重新录音';
    if(!blob){ toast('未录到音频，请重试'); return; }
    $('#recAudio').src=URL.createObjectURL(blob);
    $('#recPlay').classList.remove('hidden');
    showPanelAndStatus('请对照示范与粤拼，手动调整滑块评分。');
  }

  btnRec.addEventListener('click', async function(){
    if(active){
      try{ rec.stop(); }catch(e){}
      active=false;
      btnRec.textContent='🎤 开始识别';
      if(transcript){ showPanelAndStatus('识别完成'); await scoreByAI(transcript); }
      return;
    }
    if(recording){ await stopRecordingFlow(); return; }
    if(SR){
      transcript='';
      const box=ensureBox();
      box.innerHTML='正在识别，请朗读示范…';
      try{
        rec=new SR();
        rec.lang='zh-HK';
        rec.continuous=false;
        rec.interimResults=true;
        rec.onresult=function(e){
          let t='';
          for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript;
          transcript=t.trim();
          box.innerHTML='识别结果：<b>'+esc(transcript||'（还在听…）')+'</b>';
        };
        rec.onerror=function(e){
          active=false;
          btnRec.textContent='🎤 开始识别';
          box.innerHTML='识别不可用（'+e.error+'），改为录音自评。';
          startRecordingFlow();
        };
        rec.onend=function(){
          active=false;
          btnRec.textContent='🎤 开始识别';
          if(transcript){ showPanelAndStatus('识别完成'); scoreByAI(transcript); }
          else if(!recording) box.innerHTML='没有识别到语音：可再点一次，或退出本页用其他浏览器。';
        };
        rec.start();
        active=true;
        btnRec.textContent='⏹ 停止识别';
        recTime.textContent='请朗读示范';
      }catch(err){
        box.innerHTML='识别启动失败，改为录音自评。';
        startRecordingFlow();
      }
    } else {
      startRecordingFlow();
    }
  });

  submitBtn.addEventListener('click', function(){
    const v=Math.round((Number($('#sAcc').value)+Number($('#sTone').value)+Number($('#sFlu').value))/3*10);
    submitAnswer(v/100, q, '口语评分 '+v+' 分', isDrill);
  });
};