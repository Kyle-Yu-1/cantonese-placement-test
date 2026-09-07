// 本地静态服务器：node tools/serve.js，默认端口 8123
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8'
};
const server = http.createServer(function(req, res){
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, function(err, data){
    if (err) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404 not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
});
const port = Number(process.env.PORT || 8123);
server.listen(port, '127.0.0.1', function(){ console.log('serving on http://127.0.0.1:'+port); });