/* 云端同步（Supabase，可选）：不配置时保持纯本地模式 */
'use strict';

const Cloud = {
  cfg(){
    try{
      const s=JSON.parse(localStorage.getItem('cy_cloud_cfg')||'{}');
      return { url:(s.url||'').trim(), key:(s.key||'').trim() };
    }catch(e){ return { url:'', key:'' }; }
  },
  enabled(){ const c=this.cfg(); return !!(c.url && c.key); },
  _client:null, _user:null, _t:null,
  async client(){
    if(!this.enabled()) return null;
    if(this._client) return this._client;
    const c=this.cfg();
    if(!window.supabase){
      await new Promise(function(res,rej){
        const sc=document.createElement('script');
        sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        sc.onload=res;
        sc.onerror=function(){ rej(new Error('无法加载 Supabase SDK，请检查网络')); };
        document.head.appendChild(sc);
      });
    }
    this._client=window.supabase.createClient(c.url, c.key);
    return this._client;
  },
  async signUp(email, pass, nick){
    const c=await this.client();
    const r=await c.auth.signUp({ email:email, password:pass, options:{ data:{ nickname:nick } } });
    if(r.error) throw new Error(r.error.message);
    return r;
  },
  async signIn(email, pass){
    const c=await this.client();
    const r=await c.auth.signInWithPassword({ email:email, password:pass });
    if(r.error) throw new Error(r.error.message);
    return r;
  },
  async signOut(){ if(this._client){ try{ await this._client.auth.signOut(); }catch(e){} } },
  async email(){
    const c=await this.client();
    const r=await c.auth.getUser();
    return (r.data && r.data.user && r.data.user.email) || null;
  },
  async restore(){
    if(!this.enabled()) return false;
    try{
      const c=await this.client();
      const r=await c.auth.getSession();
      if(r.data && r.data.session){ this._user=r.data.session.user; return true; }
    }catch(e){}
    return false;
  },
  async pull(){
    const c=await this.client();
    const u=await c.auth.getUser();
    if(!u.data || !u.data.user) return null;
    const r=await c.from('app_state').select('payload').eq('user_id', u.data.user.id).maybeSingle();
    if(r.error || !r.data) return null;
    return r.data.payload || null;
  },
  async push(payload){
    const c=await this.client();
    const u=await c.auth.getUser();
    if(!u.data || !u.data.user) return;
    await c.from('app_state').upsert({ user_id:u.data.user.id, payload:payload, updated_at:new Date().toISOString() });
  },
  maybePush(d){
    if(!this.enabled()) return;
    const self=this;
    clearTimeout(this._t);
    this._t=setTimeout(function(){
      self.push({ results:d.results||[], wrong:d.wrong||{}, updated_at:Date.now() }).catch(function(){});
    }, 800);
  }
};

/* 每次本地保存后去抖同步到云端 */
const _cloudOrigSave=Store.save.bind(Store);
Store.save=function(u,d){
  _cloudOrigSave(u,d);
  Cloud.maybePush(d);
};

/* 云端模式下，退出时同时登出 Supabase */
$('#logoutBtn').addEventListener('click', function(e){
  if(!Cloud.enabled()) return;
  if(!confirm('确定退出当前账号？')){ e.stopImmediatePropagation(); return; }
  e.stopImmediatePropagation();
  Cloud.signOut().catch(function(){});
  Store.setCurrent(null);
  location.reload();
});

/* 登录后合并云端与本地数据 */
function setupAfterCloudLogin(email, remote){
  return new Promise(function(resolve){
    const local=Store.data(email);
    let state;
    if(!local.cloudUpdated){
      state=(remote && Array.isArray(remote.results) && remote.results.length) ? remote : { results:[], wrong:{} };
    } else {
      state=(remote && (remote.updated_at||0) > local.cloudUpdated) ? remote : local;
    }
    state.settings=local.settings||{};
    state.cloudUpdated=Date.now();
    Store.save(email, state);
    Store.setCurrent(email);
    resolve();
  });
}

/* 云端登录/注册界面 */
let cloudAuthMode='login';
function renderCloudAuth(){
  $('#topbar').classList.add('hidden');
  appEl().innerHTML =
   '<div class="auth-wrap"><div class="card auth-card">' +
     '<div class="auth-logo">🎙️</div>' +
     '<h1>粤语能力定位测验</h1>' +
     '<p class="muted">云端模式：账号与成绩通过 Supabase 跨设备同步。</p>' +
     '<div class="tabs"><button class="tab active" id="tabLogin">登录</button><button class="tab" id="tabReg">注册</button></div>' +
     '<form id="authForm">' +
       '<label class="field">邮箱<input id="authEmail" type="email" required autocomplete="username" placeholder="you@example.com"></label>' +
       '<label class="field">密码<input id="authPass" type="password" required autocomplete="current-password" placeholder="至少 6 位"></label>' +
       '<label class="field hidden" id="nickField">昵称（可选）<input id="authNick" placeholder="显示用"></label>' +
       '<div class="hint" id="authHint"></div>' +
       '<button class="btn primary block" type="submit" id="authSubmit">登录</button>' +
     '</form>' +
     '<p class="demo-note">☁️ 云端同步已开启。若注册后收到确认邮件，请先到邮箱点击确认链接再登录。</p>' +
   '</div></div>';
  const setTab=function(m){
    cloudAuthMode=m;
    $('#tabLogin').classList.toggle('active', m==='login');
    $('#tabReg').classList.toggle('active', m==='register');
    $('#authSubmit').textContent = m==='login' ? '登录' : '注册并登录';
    $('#nickField').classList.toggle('hidden', m!=='register');
    $('#authHint').textContent='';
  };
  $('#tabLogin').addEventListener('click', function(){ setTab('login'); });
  $('#tabReg').addEventListener('click', function(){ setTab('register'); });
  $('#authForm').addEventListener('submit', async function(e){
    e.preventDefault();
    const email=$('#authEmail').value.trim();
    const pass=$('#authPass').value;
    const nick=$('#authNick').value.trim();
    const hint=$('#authHint');
    hint.textContent='';
    if(!email || pass.length<6){ hint.textContent='请填写有效邮箱，密码至少 6 位'; return; }
    hint.textContent='正在连接云端…';
    try{
      if(cloudAuthMode==='register'){
        const r=await Cloud.signUp(email, pass, nick);
        if(!r.data.session){ hint.textContent='注册成功：请先到邮箱点击确认链接，然后回来登录。'; return; }
      } else {
        await Cloud.signIn(email, pass);
      }
      const remote=await Cloud.pull();
      await setupAfterCloudLogin(email, remote);
      renderShell();
      renderHome();
    }catch(err){ hint.textContent='云端操作失败：'+err.message; }
  });
}

/* 覆盖登录入口：云端配置存在时走云端 */
const _cloudOrigRenderAuth=renderAuth;
renderAuth=function(){
  if(!Cloud.enabled()){ _cloudOrigRenderAuth(); return; }
  appEl().innerHTML='<div class="auth-wrap"><div class="card auth-card"><p class="muted">正在恢复云端会话…</p></div></div>';
  Cloud.restore().then(function(ok){
    if(!ok){ renderCloudAuth(); return; }
    Cloud.email().then(function(email){
      if(!email){ renderCloudAuth(); return; }
      Cloud.pull().then(function(remote){
        setupAfterCloudLogin(email, remote).then(function(){ renderShell(); renderHome(); });
      }).catch(function(){ renderCloudAuth(); });
    }).catch(function(){ renderCloudAuth(); });
  }).catch(function(){ renderCloudAuth(); });
};

/* 设置页追加云端配置卡片 */
const _cloudOrigRenderSettings=renderSettings;
renderSettings=function(){
  _cloudOrigRenderSettings();
  if(!Store.current()) return;
  const cfg=Cloud.cfg();
  const div=document.createElement('div');
  div.className='card';
  div.innerHTML =
   '<h3>☁️ 云端同步（Supabase，可选）</h3>' +
   '<p class="muted">填写 Supabase 项目的 URL 与 anon 公钥后，注册/登录将走云端账号，成绩跨设备同步；两项都留空则保持纯本地模式。建表 SQL 见仓库 supabase/schema.sql。</p>' +
   '<label class="field">项目 URL<input id="supUrl" placeholder="https://xxxx.supabase.co"></label>' +
   '<label class="field">anon 公钥<input id="supKey" placeholder="eyJhbGciOi…"></label>' +
   '<div class="btn-row"><button class="btn" id="btnSupTest">🔗 测试连接</button><button class="btn primary" id="btnSupGo">保存并用云端登录</button></div>' +
   '<div class="hint" id="supHint" style="color:#64748b"></div>';
  const cards=appEl().querySelectorAll('.card');
  appEl().insertBefore(div, cards[cards.length-1]);
  $('#supUrl').value=cfg.url;
  $('#supKey').value=cfg.key;
  const saveCfg=function(){
    const v={ url:$('#supUrl').value.trim(), key:$('#supKey').value.trim() };
    localStorage.setItem('cy_cloud_cfg', JSON.stringify(v));
  };
  $('#btnSupTest').addEventListener('click', async function(){
    saveCfg();
    Cloud._client=null;
    $('#supHint').textContent='连接中…';
    try{
      const c=await Cloud.client();
      const r=await c.from('app_state').select('payload').limit(1);
      if(r.error){ $('#supHint').textContent='连接成功，但 app_state 表不存在：请先在 Supabase SQL Editor 执行 supabase/schema.sql。'; }
      else { $('#supHint').textContent='✅ 连接成功，表结构正常。'; }
    }catch(err){ $('#supHint').textContent='连接失败：'+err.message; }
  });
  $('#btnSupGo').addEventListener('click', function(){
    saveCfg();
    Cloud._client=null;
    toast('已保存，切换为云端登录');
    Store.setCurrent(null);
    setTimeout(function(){ renderAuth(); }, 300);
  });
};