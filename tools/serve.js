// 本地静态服务器 + 语音评分记录写入 Word
// node tools/serve.js，默认端口 8123
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.wav':'audio/wav',
  '.webm':'audio/webm',
  '.mp4':'video/mp4'
};
const PY_CANDIDATES = [
  path.join(root, 'tools', '.whisper-venv', 'Scripts', 'python.exe'),
  process.env.BUNDLED_PY,
  'C:\\Users\\19461\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe',
  'python'
].filter(Boolean);

function findPython(){
  for (const py of PY_CANDIDATES){
    try {
      const r = spawnSync(py, ['--version'], { encoding:'utf8', timeout:8000 });
      if (!r.error && r.status === 0) return py;
    } catch(e){}
  }
  return null;
}

function sendJson(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(obj));
}

const server = http.createServer(function(req, res){
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'POST' && url === '/api/word-update'){
    let chunks = [], size = 0;
    req.on('data', function(c){
      size += c.length;
      if (size > 3 * 1024 * 1024){ res.writeHead(413); res.end('too large'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function(){
      const py = findPython();
      if (!py) return sendJson(res, 500, {ok:false, error:'未找到 Python 运行时（更新 Word 需要）'});
      const tmp = path.join(os.tmpdir(), 'pitch-word-' + Date.now() + '.json');
      try {
        fs.writeFileSync(tmp, Buffer.concat(chunks));
        const out = spawnSync(py, [path.join(root, 'tools', 'update_word.py'), '--payload', tmp], { encoding:'utf8', timeout:90000 });
        if (out.error) return sendJson(res, 500, {ok:false, error:'运行 Word 更新脚本失败：' + out.error.message});
        const line = (out.stdout || '').trim().split(/\r?\n/).pop() || '{}';
        try {
          const j = JSON.parse(line);
          return sendJson(res, j.ok ? 200 : 500, j);
        } catch(e){
          return sendJson(res, 500, {ok:false, error:'更新脚本输出异常：' + ((out.stderr || '').slice(0, 300))});
        }
      } catch(err){
        return sendJson(res, 500, {ok:false, error:String(err)});
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/word-sync'){
    let chunks = [], size = 0;
    req.on('data', function(c){
      size += c.length;
      if (size > 3 * 1024 * 1024){ res.writeHead(413); res.end('too large'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function(){
      const py = findPython();
      if (!py) return sendJson(res, 500, {ok:false, error:'未找到 Python 运行时'});
      const tmp = path.join(os.tmpdir(), 'pitch-sync-' + Date.now() + '.json');
      try {
        fs.writeFileSync(tmp, Buffer.concat(chunks));
        const out = spawnSync(py, [path.join(root, 'tools', 'sync_word.py'), '--payload', tmp], { encoding:'utf8', timeout:120000 });
        if (out.error) return sendJson(res, 500, {ok:false, error:'运行同步脚本失败：' + out.error.message});
        const line = (out.stdout || '').trim().split(/\r?\n/).pop() || '{}';
        try { const j = JSON.parse(line); return sendJson(res, j.ok ? 200 : 500, j); }
        catch(e){ return sendJson(res, 500, {ok:false, error:'同步脚本输出异常：' + ((out.stderr || '').slice(0, 300))}); }
      } catch(err){
        return sendJson(res, 500, {ok:false, error:String(err)});
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/transcribe'){
    let chunks = [], size = 0;
    req.on('data', function(c){
      size += c.length;
      if (size > 12 * 1024 * 1024){ res.writeHead(413); res.end('too large'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function(){
      const py = findPython();
      if (!py) return sendJson(res, 500, {ok:false, error:'未找到 Python 运行时'});
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch(e){}
      const audio = body.audio;
      if (!audio) return sendJson(res, 400, {ok:false, error:'缺少 audio 字段'});
      const mime = body.mime || 'audio/webm';
      const ext = ({ 'audio/webm':'.webm', 'audio/mp4':'.mp4', 'audio/ogg':'.ogg', 'audio/wav':'.wav', 'audio/x-wav':'.wav' })[mime] || '.webm';
      const tmp = path.join(os.tmpdir(), 'pitch-audio-' + Date.now() + ext);
      try {
        fs.writeFileSync(tmp, Buffer.from(audio, 'base64'));
        const out = spawnSync(py, [path.join(root, 'tools', 'transcribe.py'), '--audio', tmp], { encoding:'utf8', timeout:600000 });
        if (out.error) return sendJson(res, 500, {ok:false, error:'运行转写脚本失败：' + out.error.message});
        const line = (out.stdout || '').trim().split(/\r?\n/).pop() || '{}';
        try { const j = JSON.parse(line); return sendJson(res, 200, j); }
        catch(e){ return sendJson(res, 200, {ok:false, error:'转写脚本输出异常：' + ((out.stderr || '').slice(0, 300))}); }
      } catch(err){
        return sendJson(res, 500, {ok:false, error:String(err)});
      }
    });
    return;
  }

  // 静态文件
  let p = decodeURIComponent(url);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(file, function(err, data){
    if (err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404 not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
});

const port = Number(process.env.PORT || 8123);
server.listen(port, '127.0.0.1', function(){ console.log('serving on http://127.0.0.1:' + port + '  (语音训练页: /pitch-training.html)'); });
