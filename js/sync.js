/* GitHub 云存储同步模块（跨设备同步训练记录）
 * 数据打包：pitch_records / coach_state / pitch_draft
 * 存储：仓库 data/records.json（GitHub Contents API + Personal Access Token）
 * 注意：仓库公开时该文件任何人可读，请勿写入敏感个人信息。
 */
(function(){
  'use strict';
  var CFG_KEY = 'github_sync_cfg';
  var KEYS = ['pitch_records','coach_state','pitch_draft'];

  function cfgGet(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)||'{}'); }catch(e){ return {}; } }
  function cfgSet(c){ try{ localStorage.setItem(CFG_KEY, JSON.stringify(c)); }catch(e){} }

  function b64encode(s){ var bytes = new TextEncoder().encode(s), bin=''; for(var i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); }
  function b64decode(s){ var bin = atob(String(s).replace(/\s/g,'')); var bytes = Uint8Array.from(bin, function(c){return c.charCodeAt(0);}); return new TextDecoder().decode(bytes); }

  function snapshot(){
    var data = { app:'pitch-training', version:2, updatedAt:new Date().toISOString() };
    for(var i=0;i<KEYS.length;i++){ try{ data[KEYS[i]] = JSON.parse(localStorage.getItem(KEYS[i])||'null'); }catch(e){ data[KEYS[i]]=null; } }
    return data;
  }
  function restore(data){
    var n=0;
    for(var i=0;i<KEYS.length;i++){ if(data[KEYS[i]]!==undefined){ localStorage.setItem(KEYS[i], JSON.stringify(data[KEYS[i]])); n++; } }
    return n;
  }
  function fingerprint(){ try{ return JSON.stringify(snapshot()); }catch(e){ return ''; } }

  function ghUrl(cfg){ return 'https://api.github.com/repos/'+(cfg.owner||'Kyle-Yu-1')+'/'+(cfg.repo||'cantonese-placement-test')+'/contents/'+(cfg.file||'data/records.json'); }
  function hdr(cfg){ return { 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Authorization':'Bearer '+cfg.token }; }

  async function ghGet(cfg){
    var res = await fetch(ghUrl(cfg), { headers: hdr(cfg) });
    if(res.status===404) return null;
    if(!res.ok) throw new Error('GitHub 读取失败 HTTP '+res.status);
    var j = await res.json();
    return { sha: j.sha, data: JSON.parse(b64decode(j.content)) };
  }
  async function ghPut(cfg, obj, sha){
    var body = { message:'sync training records @ '+new Date().toLocaleString(), content:b64encode(JSON.stringify(obj,null,2)) };
    if(sha) body.sha = sha;
    var res = await fetch(ghUrl(cfg), { method:'PUT', headers: Object.assign(hdr(cfg), {'Content-Type':'application/json'}), body: JSON.stringify(body) });
    if(!res.ok){ var t=''; try{ t = await res.text(); }catch(e){} throw new Error('GitHub 写入失败 HTTP '+res.status+' '+(t||'').slice(0,140)); }
    return (await res.json()).sha;
  }

  /* ---------- UI ---------- */
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!==undefined)e.textContent=txt; return e; }

  var btn = el('button','gs-fab','☁');
  var panel = el('div','gs-panel');
  panel.setAttribute('role','dialog');

  function buildPanel(){
    panel.innerHTML='';
    var c = cfgGet();
    var head = el('div','gs-head');
    var title = el('span','gs-title','☁ GitHub 云同步');
    var close = el('button','gs-close','×');
    head.appendChild(title); head.appendChild(close);
    panel.appendChild(head);

    var hint = el('div','gs-hint','训练记录将写入你的仓库 data/records.json。仓库公开时该文件他人可读，请勿存敏感信息。');
    panel.appendChild(hint);

    function row(label, ph, val, isPass){
      var r = el('div','gs-row');
      var l = el('label',null,label); l.textContent=label;
      var inp = document.createElement('input');
      inp.type = isPass?'password':'text';
      inp.placeholder = ph||'';
      if(val!==undefined && val!==null) inp.value = val;
      inp.dataset.field = label;
      r.appendChild(l); r.appendChild(inp);
      return r;
    }

    panel.appendChild(row('Token','ghp_… / github_pat_…', c.token||'', true));
    panel.appendChild(row('Owner','Kyle-Yu-1', c.owner||'', false));
    panel.appendChild(row('Repo','cantonese-placement-test', c.repo||'', false));
    panel.appendChild(row('File','data/records.json', c.file||'', false));

    var acts = el('div','gs-actions');
    var up = el('button','gs-btn gs-up','⬆ 上传到 GitHub');
    var down = el('button','gs-btn gs-down','⬇ 从 GitHub 下载');
    acts.appendChild(up); acts.appendChild(down);
    panel.appendChild(acts);

    var autoRow = el('div','gs-row gs-auto');
    var al = el('label',null,'自动同步');
    var chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!c.auto;
    autoRow.appendChild(chk); autoRow.appendChild(al);
    panel.appendChild(autoRow);

    var st = el('div','gs-status', c.lastPush ? ('上次上传：'+new Date(c.lastPush).toLocaleString()) : '未配置');
    panel.appendChild(st);

    close.onclick = function(){ panel.style.display='none'; };
    up.onclick = function(){ push(st); };
    down.onclick = function(){ pull(st); };
    chk.onchange = function(){ c.auto = chk.checked; cfgSet(c); setStatus(st, c.auto?'自动同步已开启（每 45 秒检测变化）':'自动同步已关闭'); };
  }

  function readCfg(){
    var c = {};
    var fields = panel.querySelectorAll('input[data-field]');
    for(var i=0;i<fields.length;i++) c[fields[i].dataset.field] = fields[i].value.trim();
    c.token = c['Token']||''; c.owner = c['Owner']||'Kyle-Yu-1'; c.repo = c['Repo']||'cantonese-placement-test'; c.file = c['File']||'data/records.json';
    var chk = panel.querySelector('.gs-auto input[type=checkbox]');
    c.auto = chk ? chk.checked : false;
    return c;
  }
  function setStatus(st, msg, cls){
    if(!st) st = panel.querySelector('.gs-status');
    st.textContent = msg;
    st.className = 'gs-status' + (cls?(' '+cls):'');
  }

  async function push(st){
    var c = readCfg();
    if(!c.token){ setStatus(st,'请先填写 GitHub Token','err'); return; }
    cfgSet(Object.assign(cfgGet(), {owner:c.owner, repo:c.repo, file:c.file, token:c.token, auto:c.auto}));
    setStatus(st,'上传中…');
    try{
      var cur = await ghGet(c);
      var sha = await ghPut(c, snapshot(), cur?cur.sha:null);
      var cfg = cfgGet(); cfg.sha = sha; cfg.lastPush = Date.now(); cfgSet(cfg);
      setStatus(st,'✓ 已上传 '+new Date().toLocaleString(),'ok');
    }catch(e){ setStatus(st,e.message,'err'); }
  }
  async function pull(st){
    var c = readCfg();
    if(!c.token){ setStatus(st,'请先填写 GitHub Token','err'); return; }
    cfgSet(Object.assign(cfgGet(), {owner:c.owner, repo:c.repo, file:c.file, token:c.token, auto:c.auto}));
    setStatus(st,'下载中…');
    try{
      var cur = await ghGet(c);
      if(!cur){ setStatus(st,'云端还没有记录文件（先在另一设备上传一次）','err'); return; }
      var n = restore(cur.data);
      var cfg = cfgGet(); cfg.sha = cur.sha; cfg.lastPull = Date.now(); cfgSet(cfg);
      setStatus(st,'✓ 已同步 '+n+' 项数据，刷新页面生效','ok');
      setTimeout(function(){ location.reload(); }, 1200);
    }catch(e){ setStatus(st,e.message,'err'); }
  }

  function injectStyles(){
    var css = [
      '.gs-fab{position:fixed;right:16px;bottom:16px;width:52px;height:52px;border-radius:50%;background:#1f6feb;color:#fff;font-size:24px;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);z-index:9998;}',
      '.gs-panel{position:fixed;right:16px;bottom:78px;width:320px;max-width:92vw;background:#fff;border:1px solid #d0d7de;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.24);padding:14px;z-index:9999;font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:13px;color:#24292f;}',
      '.gs-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}',
      '.gs-title{font-weight:700;font-size:14px;}',
      '.gs-close{border:none;background:none;font-size:18px;cursor:pointer;color:#57606a;}',
      '.gs-hint{background:#fff8c5;border:1px solid #d4a72c;border-radius:8px;padding:8px;margin-bottom:10px;line-height:1.5;}',
      '.gs-row{display:flex;align-items:center;gap:6px;margin-bottom:8px;}',
      '.gs-row label{min-width:44px;color:#57606a;flex:none;}',
      '.gs-row input[type=text],.gs-row input[type=password]{flex:1;border:1px solid #d0d7de;border-radius:6px;padding:6px 8px;font-size:12px;width:100%;min-width:0;}',
      '.gs-auto{justify-content:flex-start;gap:8px;} .gs-auto label{min-width:0;}',
      '.gs-actions{display:flex;gap:8px;margin:10px 0;}',
      '.gs-btn{flex:1;padding:9px 0;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;}',
      '.gs-up{background:#2da44e;} .gs-down{background:#1f6feb;}',
      '.gs-status{margin-top:6px;color:#57606a;line-height:1.4;} .gs-status.ok{color:#1a7f37;} .gs-status.err{color:#cf222e;}'
    ].join('\n');
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function init(){
    injectStyles();
    btn.title = 'GitHub 云同步';
    btn.onclick = function(){ buildPanel(); panel.style.display = panel.style.display==='none'?'block':'none'; };
    panel.style.display='none';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    var lastFp = fingerprint();
    setInterval(function(){
      var c = cfgGet();
      if(!c.auto || !c.token) return;
      var fp = fingerprint();
      if(fp !== lastFp){
        lastFp = fp;
        var st = panel.querySelector('.gs-status');
        if(st) setStatus(st,'检测到新记录，自动上传中…');
        push(st).catch(function(){});
      }
    }, 45000);
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();