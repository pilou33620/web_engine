// Captures de la maquette : sert le scratchpad, réécrit three vers la copie locale, règle chaque combinaison et photographie la scène.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const S = '/tmp/claude-0/-home-user-web-royaumes/aa7862c0-b04f-5a96-b006-81fd49c4941e/scratchpad';
const page0 = fs.readFileSync(S + '/quartiers.html', 'utf8').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', '/npm3/package/build/three.module.js');
fs.writeFileSync(S + '/quartiers/apercu.html', page0);
const srv = http.createServer((q, r) => { const f = path.join(S, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8811);
const combos = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: process.env.HAUT ? +process.env.HAUT : 900 } });
  const err = []; p.on('pageerror', x => err.push(String(x))); p.on('console', m => m.type() === 'error' && !m.text().includes('Failed to load resource') && err.push(m.text()));
  await p.route('**/*', r => r.request().url().includes('fonts.g') ? r.abort() : r.continue());
  await p.goto('http://127.0.0.1:8811/quartiers/apercu.html'); await p.waitForFunction(() => window.MAQ, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  for (const c of combos) {
    const { nom, avance = 4, page, ...reglage } = c;
    await p.evaluate(([r, a]) => { MAQ.regler(r); MAQ.avancer(a); }, [reglage, avance]);
    await p.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
    await p.waitForTimeout(800);
    const el = page ? p : await p.$('.scene');
    await el.screenshot({ path: `${S}/quartiers/cap/${nom}.jpg`, quality: 82, type: 'jpeg', fullPage: !!page, timeout: 180000 });
    console.log(nom, JSON.stringify(await p.evaluate(() => MAQ.etat())));
    if (c.liste) console.log('  panneau :', JSON.stringify(await p.evaluate(() => MAQ.panneau())));
  }
  console.log('ERREURS', JSON.stringify(err));
  await b.close(); srv.close();
})();
