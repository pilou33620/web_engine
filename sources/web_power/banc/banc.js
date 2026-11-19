// Banc d'équilibrage GridMaster : joue des parties complètes (2027 → 2050) avec les stratégies programmées du jeu,
// en parallèle dans Chromium sans affichage, puis écrit banc-resultats.json et banc-rapport.md.
// Usage : node banc/banc.js [url-de-la-page-du-jeu, par défaut ../index.html] [cartes=valmont,littoral,...] [diffs=facile,normal,difficile] [strats=passif,fossile,vert] [paralleles=4] [graine=1001] [sortie=banc]
// Cartes : valmont, littoral, plaine, ile, industrie, marche, aleatoire. Prérequis : npm i playwright && npx playwright install chromium.
// Sans URL, le banc sert lui-même le dépôt (le moteur graphique est en modules, refusés en file://).
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];  // WebGL logiciel : marche sans carte graphique
const fs = require('fs');
const path = require('path');
const http = require('http');
const arg = (k, d) => (process.argv.find(a => a.startsWith(k + '=')) || '').split('=')[1] || d;
const URL0 = process.argv[2] && !process.argv[2].includes('=') ? process.argv[2] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
/** Sert le dépôt sur un port libre (seulement si aucune URL n'est donnée) et rend l'adresse de la page. */
const servir = () => new Promise(ok => {
  const racine = path.join(__dirname, '..'), srv = http.createServer((q, r) => { const f = path.join(racine, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(racine)) { r.writeHead(403); r.end(); return; } fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
  srv.listen(0, '127.0.0.1', () => { srv.unref(); ok(`http://127.0.0.1:${srv.address().port}/index.html`); });
});
const cartes = arg('cartes', 'valmont,littoral,plaine,ile,industrie,marche,aleatoire').split(','), diffs = arg('diffs', 'normal').split(','), strats = arg('strats', 'passif,fossile,vert').split(',');
const N = +arg('paralleles', 4), sortie = arg('sortie', 'banc');
(async () => {
  const URL = URL0 || await servir();
  const b = await chromium.launch({ args: ARGS });
  const runs = []; for (const c of cartes) for (const d of diffs) for (const s of strats) runs.push([c, d, s, c === 'aleatoire' ? +arg('graine', 1001) : undefined]);
  const res = []; let i = 0; const t0 = Date.now();
  async function ouvrier(n) {
    const p = await b.newPage({ viewport: { width: 400, height: 300 } });
    p.on('pageerror', e => console.log(`[${n}] ERREUR`, e.message));
    await p.goto(URL); await p.waitForFunction(() => window.GM && GM.bancPartie, null, { timeout: 60000 });
    while (i < runs.length) {
      const run = runs[i++];
      const r = await p.evaluate(run => GM.bancPartie(...run), run);
      res.push(r);
      console.log(`[${res.length}/${runs.length}] ${r.carte} · ${r.diff} · ${r.strat} → ${r.issue} (${r.fin}) · bas carbone ${r.rapports.at(-1)?.bas ?? '-'} % · eau ${r.rapports.at(-1)?.eau ?? '-'} % · trésorerie ${r.argent} M€ · dette ${r.dette} · sat ${r.sat} % · ${r.duree} s`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(N, runs.length) }, (_, n) => ouvrier(n)));
  await b.close();
  fs.writeFileSync(sortie + '-resultats.json', JSON.stringify(res, null, 1));
  const L = [`# Banc d'équilibrage GridMaster`, '', `${res.length} parties en ${Math.round((Date.now() - t0) / 1000)} s.`, '', '| Carte | Difficulté | Stratégie | Issue | Bas carbone 2049 | Coupure moy. (min/an) | Trésorerie (M€) | Dette (M€) | Satisfaction | Déchets valorisés 2049 | dont recyclés |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of res) { const rs = r.rapports, cp = rs.reduce((a, x) => a + x.coupure, 0) / Math.max(1, rs.length); L.push(`| ${r.carte} | ${r.diff} | ${r.strat} | ${r.issue} (${r.fin}) | ${rs.at(-1)?.bas ?? '-'} % | ${cp.toFixed(1)} | ${r.argent} | ${r.dette} | ${r.sat} % | ${rs.at(-1)?.decVal ?? '-'} % | ${rs.at(-1)?.decRec ?? '-'} % |`); }
  for (const r of res) {
    L.push('', `## ${r.carte} · ${r.diff} · ${r.strat}`, '', `Ouvrages : ${Object.entries(r.compte).map(([k, v]) => `${k} ${v}`).join(', ')} · ${r.lignes} lignes`, '', '| Année | Bas carbone | gCO₂/kWh | Coupure | Résultat (M€) | Investi (M€) | Pointe (MW) | Satisf. | Eau servie | Eau conforme | Épurée | Crises | Pollutions | Déchets valorisés | Recyclés |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const a of r.rapports) L.push(`| ${a.an} | ${a.bas} % | ${a.co2} | ${a.coupure} | ${a.res} | ${a.capex} | ${a.pointe} | ${a.sat} % | ${a.eau ?? '-'} % | ${a.conf ?? '-'} % | ${a.epure ?? '-'} % | ${a.crises ?? '-'} | ${a.acc ?? '-'} | ${a.decVal ?? '-'} % | ${a.decRec ?? '-'} % |`);
  }
  fs.writeFileSync(sortie + '-rapport.md', L.join('\n'));
  console.log('Écrit :', sortie + '-resultats.json', sortie + '-rapport.md');
})();
