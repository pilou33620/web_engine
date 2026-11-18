// Position d'un personnage (pour régler la caméra des captures) : node ou.cjs '{"epoque":"empire"}' crieur_empire …
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const S = '/tmp/claude-0/-home-user-web-royaumes/aa7862c0-b04f-5a96-b006-81fd49c4941e/scratchpad';
fs.writeFileSync(S + '/quartiers/apercu.html', fs.readFileSync(S + '/quartiers.html', 'utf8').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', '/npm3/package/build/three.module.js'));
const srv = http.createServer((q, r) => { const f = path.join(S, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8814);
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 300 } }); await p.route('**/*', r => r.request().url().includes('fonts.g') ? r.abort() : r.continue());
  await p.goto('http://127.0.0.1:8814/quartiers/apercu.html'); await p.waitForFunction(() => window.MAQ);
  await p.evaluate(r => { MAQ.regler(r); MAQ.avancer(1); }, JSON.parse(process.argv[2]));
  for (const n of process.argv.slice(3)) console.log(n, JSON.stringify(await p.evaluate(n => MAQ.ou(n), n)));
  await b.close(); srv.close(); })();
