"use strict";
// ============================================================ réseau : topologie, flux de puissance en courant continu, N-1
// Jeux de barres : un par ouvrage ; un poste en a deux (225/400 kV « H » et 63 kV « B ») reliés par ses 2 autotransformateurs.
const busDe = (t, kv) => (t.occ && t.occ.type === 'poste' ? t.k + (kv <= 63 ? ':B' : ':H') : t.k);
let BR = [], TRANSFOS = new Map();
const actifB = (b, exclu) => b !== exclu && !(b.hs > S.min) && !b.fin;
function branches() {
  BR = [];
  for (const l of LIGNES) { l.ba = busDe(l.a, l.kv); l.bb = busDe(l.b, l.kv); l.cap = capLigne(l); l.x = KV[l.kv].x * Math.max(1, l.len); l.type = 'L'; BR.push(l); }
  for (const u of UNITES) if (u.type === 'poste' && !u.fin) {
    let tr = TRANSFOS.get(u.id); if (!tr) TRANSFOS.set(u.id, tr = { id: 'T' + u.id, type: 'T', u, f: 0, taux: 0, sur: 0, hs: 0, fin: 0 });
    Object.assign(tr, { ba: u.t.k + ':H', bb: u.t.k + ':B', cap: 500, x: .12 * 100 / 500, nom: `Autotransformateurs 225/63 kV · ${u.nom}` }); BR.push(tr);
  }
}
const busFront = () => (FRONT_T && FRONT_T.occ ? FRONT_T.k : null);  // l'interconnexion n'existe qu'à partir de 1938
// Composantes connexes : une île est alimentée si elle contient l'interconnexion ou une centrale en service.
// Chaque île a son nœud bilan : l'interconnexion, sinon sa plus grosse centrale.
function iles(exclu = null) {
  const adj = new Map(), add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
  for (const b of BR) if (actifB(b, exclu)) { add(b.ba, b.bb); add(b.bb, b.ba); }
  const gens = new Map(); for (const u of UNITES) if (enService(u) && TYPES[u.type].mw) { const k = busU(u); if (!gens.has(k) || gens.get(k) < u.cap) gens.set(k, u.cap); }
  const vus = new Set(), res = [], comp = new Set();
  for (const dep of [busFront(), ...gens.keys()].filter(Boolean)) {
    if (vus.has(dep)) continue;
    const ile = new Set([dep]), pile = [dep]; vus.add(dep);
    while (pile.length) for (const n of adj.get(pile.pop()) || []) if (!vus.has(n)) { vus.add(n); ile.add(n); pile.push(n); }
    let slack = ile.has(busFront()) ? busFront() : null;
    if (!slack) { let mx = -1; for (const k of ile) if (gens.has(k) && gens.get(k) > mx) { mx = gens.get(k); slack = k; } }
    res.push({ ile, slack }); for (const k of ile) comp.add(k);
  }
  return { comp, res };
}
const composante = exclu => iles(exclu).comp;
const busU = u => u.t.k;
const enService = u => !u.fin && u.dispo && !(u.panne > S.min);
let COMP = new Set(), ILES = [];
function topologie() {
  branches(); const r = iles(); COMP = r.comp; ILES = r.res;
  for (const v of VILLES) v.servie = COMP.has(v.centre.k);
}
const raccordee = u => COMP.has(busU(u));
const actifU = u => (u === IMP ? !!busFront() && COMP.has(busFront()) : enService(u) && raccordee(u));
let INJ = new Map();
function injections() {
  INJ = new Map(); const add = (k, v) => INJ.set(k, (INJ.get(k) || 0) + v);
  for (const u of UNITES) if (actifU(u) && u.p) add(busU(u), u.p);
  const k = 1 + S.pertes / Math.max(1, S.charge);
  for (const v of VILLES) if (v.servie) add(v.centre.k, -(v.charge || 0) * k);
}
function resoudre(exclu = null, liste = ILES) {  // B·θ = P sur chaque île, avec son nœud bilan
  const res = new Map();
  for (const { ile, slack } of liste) {
    const ids = [...ile].filter(k => k !== slack), idx = new Map(ids.map((k, i) => [k, i])), n = ids.length;
    if (!n) continue;
    const A = ids.map((id, i) => { const r = new Float64Array(n + 1); r[i] = 1e-7; r[n] = INJ.get(id) || 0; return r; });
    for (const b of BR) if (actifB(b, exclu) && ile.has(b.ba) && ile.has(b.bb)) {
      const i = idx.get(b.ba), j = idx.get(b.bb), y = 1 / b.x;
      if (i !== undefined) A[i][i] += y; if (j !== undefined) A[j][j] += y; if (i !== undefined && j !== undefined) { A[i][j] -= y; A[j][i] -= y; }
    }
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; if (f) for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    const th = new Float64Array(n); for (let r = n - 1; r >= 0; r--) { let v = A[r][n]; for (let k = r + 1; k < n; k++) v -= A[r][k] * th[k]; th[r] = v / A[r][r]; }
    const ang = k => (idx.has(k) ? th[idx.get(k)] : 0);
    for (const b of BR) if (actifB(b, exclu) && ile.has(b.ba) && ile.has(b.bb)) res.set(b, (ang(b.ba) - ang(b.bb)) / b.x);
  }
  return res;
}
function reseau() {
  injections();
  const f = resoudre(), niv = { 400: 0, 225: 0, 63: 0, tr: 0 }, kP = (rd('scada') ? .85 : 1) * (rd('ia') ? .9 : 1);
  for (const b of BR) {
    b.f = f.get(b) || 0; b.taux = Math.abs(b.f) / b.cap;
    if (b.type === 'T') niv.tr += actifB(b) ? (.0007 * b.cap + .005 * b.f ** 2 / b.cap) * kP : 0;
    else niv[b.kv] += .1 * Math.max(1, b.len) * b.f ** 2 / b.kv ** 2 * kP;
  }
  S.pertesNiv = niv; S.pertes = niv[400] + niv[225] + niv[63] + niv.tr;
}
function n1() {
  const res = [];
  for (const b of BR) {
    if (!actifB(b)) continue;
    if (b.type === 'T') { const t = Math.abs(b.f) / (b.cap / 2); if (t > 1) res.push({ b, el: `Un des 2 autotransformateurs · ${b.u.nom}`, cons: `le second passe à ${nf(t * 100)} %` }); continue; }
    const r = iles(b), perdu = VILLES.filter(v => v.servie && !r.comp.has(v.centre.k)).reduce((a, v) => a + (v.charge || 0), 0);
    if (perdu > .5) { res.push({ b, el: `Ligne ${b.nom}`, cons: `coupure de ${nf(perdu)} MW (ville en antenne)` }); continue; }
    const f = resoudre(b, r.res); let pire = null, tp = 0;
    for (const o of BR) { const t = Math.abs(f.get(o) || 0) / o.cap; if (o !== b && t > tp) { tp = t; pire = o; } }
    if (tp > 1) res.push({ b, el: `Ligne ${b.nom}`, cons: `${pire.type === 'T' ? pire.nom : 'ligne ' + pire.nom} à ${nf(tp * 100)} %` });
  }
  return res;
}
