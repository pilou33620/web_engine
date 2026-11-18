// Ouvre chaque page de la galerie (avec plusieurs réglages) et chaque maquette dans Chromium, échoue à la moindre erreur
// JavaScript, et enregistre des captures dans outils/captures/.
// Usage : node outils/verifier.mjs   (nécessite playwright ; THREE_LOCAL=/chemin/node_modules/three si le CDN est inaccessible)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const racine = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serveur = createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try { const corps = await readFile(join(racine, chemin.endsWith('/') || !chemin ? chemin + 'index.html' : chemin)); res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream' }); res.end(corps); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${serveur.address().port}/`;

// page, attente (ms), réglages successifs (champs du formulaire #choix ; frise : l'année de l'époque à choisir sur la carte test)
const PAGES = [
  ['galerie/web_royaumes/visionneuse.html', 4000, [{}, { epoque: 'industrie', saison: '0', neige: true }, { epoque: 'empire', saison: '3', neige: false, ruine: true }]],
  ['galerie/web_royaumes/monde.html', 6000, [{}, { epoque: 'industrie', saison: '0', genre: 'neige', neige: true, heure: 'crepuscule', fortif: '4' }, { epoque: 'lumieres', saison: '2', genre: 'orage', neige: false, heure: 'nuit', fortif: '2' }]],
  ['galerie/web_power/visionneuse.html', 4000, [{}, { ere: '1900', saison: '0', neige: true }]],
  ['galerie/web_power/monde.html', 15000, [{}, { ere: '1900', mois: '0', temps: 'neige', neige: true, heure: '7' }, { ere: '2020', mois: '6', temps: 'degage', neige: false, heure: '19' }]],
  ['carte-test/index.html', 8000, [{}, { frise: '1816', saison: '0', genre: 'neige', neige: true }, { frise: '1960', saison: '2', genre: 'soleil', neige: false, heure: 'nuit' }, { frise: '2035', heure: 'jour' }]],
  ['index.html', 5000, [{}]],
];
const sources = JSON.parse(await readFile(join(racine, 'sources/SOURCES.json'), 'utf8'));
for (const m of sources.maquettes) PAGES.push([m.chemin, 5000, [{}]]);

await mkdir(join(racine, 'outils/captures'), { recursive: true });
const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
let echecs = 0;
for (const [page, attente, reglages] of PAGES) {
  const p = await navigateur.newPage({ viewport: { width: 1200, height: 800 } });
  if (process.env.THREE_LOCAL) await p.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, r => r.fulfill({ path: join(process.env.THREE_LOCAL, r.request().url().match(/three@[^/]+\/(.*)/)[1]), contentType: 'text/javascript' }));
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts\.g/.test(m.text())) erreurs.push(m.text()); });
  await p.goto(base + page); await p.waitForTimeout(attente);
  for (const [i, r] of reglages.entries()) {
    if (i) {
      await p.evaluate(r => { if (r.frise) [...document.querySelectorAll('#frise button')].find(b => b.textContent.startsWith(r.frise)).click(); const f = document.getElementById('choix'); for (const [k, v] of Object.entries(r)) { if (k === 'frise') continue; if (typeof v === 'boolean') f[k].checked = v; else f[k].value = v; } f.dispatchEvent(new Event('change')); }, r);
      await p.waitForTimeout(Math.min(attente, 5000));
    }
    await p.screenshot({ path: join(racine, 'outils/captures', `${page.replace(/[/.]/g, '_')}-${i}.png`) });
  }
  console.log(erreurs.length ? `ÉCHEC ${page}\n  ${erreurs.join('\n  ')}` : `ok    ${page}`);
  echecs += erreurs.length > 0;
  await p.close();
}
await navigateur.close(); serveur.close();
process.exit(echecs ? 1 : 0);
