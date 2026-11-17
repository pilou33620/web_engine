"use strict";
// ============================================================ eau : captages, traitement, stockage, conduites, assainissement
// Bilan par réseau connexe à chaque pas de 15 minutes : ressource, stocks des châteaux d'eau, fuites, qualité (6 paramètres), rejets.
const interp = (T, a) => { if (a <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (a <= T[i][0]) { const [a0, v0] = T[i - 1], [a1, v1] = T[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0); } return T.at(-1)[1]; };
const LITRES = [[1900, 40], [1930, 70], [1950, 100], [1970, 160], [1990, 165], [2010, 148], [2050, 128]];  // litres par habitant et par jour
const K_EAU = [[1900, .2], [1950, .25], [1975, .4], [1990, .65], [2005, .9], [2020, 1]];  // prix réel de l'eau, assainissement compris, par rapport à 2020
const PROFIL_EAU = h => (.55 + .55 * Math.exp(-(((h - 8) / 1.7) ** 2)) + .45 * Math.exp(-(((h - 19.5) / 2.2) ** 2)) + .15 * Math.exp(-(((h - 13) / 2) ** 2))) / .714;  // moyenne 1 sur la journée
const agri = a => sstep(1950, 1990, a) * (CARTE && CARTE.id === 'plaine' ? 1.3 : 1);  // engrais et pesticides
const indusEau = a => sstep(1955, 1985, a);
const exigenceEau = a => clamp((a - 1905) / 55, .05, 1);  // au début du siècle, beaucoup se contentent du puits
const kEau = (a = annee(S.min)) => interp(K_EAU, a);
// paramètres de qualité : clé, nom, unité, norme, année d'entrée en vigueur
const POLL = [['turb', 'Turbidité', 'NFU', 5, 1930], ['mic', 'Microbes', 'germes/mL', 1, 1902], ['org', 'Matières organiques', 'mg/L', 20, 1960], ['nitr', 'Nitrates', 'mg/L', 50, 1975], ['pest', 'Pesticides', 'indice', 10, 1990], ['micro', 'Micropolluants', 'indice', 15, 2030]];
// étapes de potabilisation : facteur restant de chaque polluant après l'étape
const ETAPES = {
  sable: { nom: 'Filtre à sable et chlore', an: 1905, cout: 0, f: { turb: .05, org: .5, mic: .005 } },
  charbon: { nom: 'Charbon actif', an: 1965, rd: 'cag', cout: 4, f: { org: .4, pest: .12, micro: .6 } },
  ozone: { nom: 'Ozonation', an: 1980, rd: 'ozone', cout: 6, f: { mic: .2, org: .6, micro: .5 } },
  denitr: { nom: 'Dénitratation', an: 1990, rd: 'denitr', cout: 8, f: { nitr: .3 } },
  membranes: { nom: 'Ultrafiltration', an: 2000, rd: 'membranes', cout: 12, f: { turb: .1, mic: .05, micro: .3 } },
};
const etapeOk = k => annee(S.min) >= ETAPES[k].an && (!ETAPES[k].rd || rd(ETAPES[k].rd));
const REUT = { step: [12000, 6], lagunage: [800, .5] };  // réutilisation : m³/j fournis, équipement en M€
const ehU = u => TYPES[u.type].eh * (u.type === 'step' && rd('bioMB') ? 1.5 : 1);
// m3 : capacité en m³/j ; stock en m³ ; eh : équivalents-habitants ; kwh par m³ ; opexE en k€/an
Object.assign(TYPES, {
  source: { role: 'captage', qual: 'source', nom: 'Captage de source', court: 'Source', m3: 1500, capex: .4, delai: 4, opexE: 8, kwh: 0, ok: t => t.t === 'colline' || voisins(t).some(n => n.t === 'montagne'), non: 'Collines ou pied de montagne', pot: 'nappe', an: 1900 },
  forage: { role: 'captage', qual: 'nappe', nom: 'Forage en nappe', court: 'Forage', m3: 5000, capex: 1, delai: 4, opexE: 25, kwh: .35, ok: t => t.nappe > .35 && t.t !== 'montagne', non: 'Sur une nappe (lentille Nappes)', pot: 'nappe', an: 1900 },
  prise: { role: 'captage', qual: 'riviere', nom: 'Prise d’eau en rivière', court: 'Prise d’eau', m3: 25000, capex: 2.5, delai: 8, opexE: 40, kwh: .1, ok: t => t.dr === 1 && t.t !== 'montagne', non: 'Au bord d’une rivière', pot: 'nappe', an: 1900 },
  potab: { role: 'traitement', nom: 'Usine de potabilisation', court: 'Potabilisation', m3: 40000, capex: 12, delai: 18, opexE: 300, kwh: .15, ok: t => plat(t) || t.t === 'colline', non: 'Terrain plat ou collines', pot: 'accept', an: 1905 },
  chateau: { role: 'stock', nom: 'Château d’eau', court: 'Château d’eau', stock: 2500, capex: 1.5, delai: 8, opexE: 10, kwh: 0, ok: t => t.t !== 'montagne', non: 'Hors montagne', pot: 'accept', an: 1900 },
  reservoir: { role: 'stock', nom: 'Réservoir sur colline', court: 'Réservoir', stock: 10000, capex: 3, delai: 10, opexE: 12, kwh: 0, ok: t => t.t === 'colline', non: 'Collines seulement', pot: 'accept', an: 1900 },
  pompage: { role: 'pression', nom: 'Station de pompage', court: 'Pompage', m3: 30000, capex: 2, delai: 6, opexE: 30, kwh: .25, ok: t => t.t !== 'montagne', non: 'Hors montagne', pot: 'accept', an: 1910 },
  lagunage: { role: 'epuration', nom: 'Lagunage', court: 'Lagunage', eh: 5000, capex: 1, delai: 6, opexE: 15, kwh: 0, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1900 },
  forageP: { role: 'captage', qual: 'profonde', nom: 'Forage profond', court: 'Forage profond', m3: 8000, capex: 4, delai: 10, opexE: 40, kwh: .6, ok: t => t.t !== 'montagne', non: 'Hors montagne', pot: 'accept', an: 1955 },
  step: { role: 'epuration', nom: 'Station d’épuration', court: 'Épuration', eh: 150000, capex: 30, delai: 24, opexE: 600, kwh: .4, ok: t => t.t !== 'montagne' && (t.dr === 1 || voisins(t).some(n => n.t === 'cote')), non: 'Au bord d’une rivière ou de la mer', pot: 'accept', an: 1950 },
  dessal: { role: 'captage', qual: 'mer', nom: 'Usine de dessalement', court: 'Dessalement', m3: 20000, capex: 90, delai: 30, opexE: 900, kwh: 3.5, ok: t => voisins(t).some(n => n.t === 'cote'), non: 'Sur la côte', pot: 'accept', an: 1985 },
});
const ORDRE_EAU = ['source', 'forage', 'prise', 'potab', 'chateau', 'reservoir', 'pompage', 'lagunage', 'forageP', 'step', 'dessal'];
for (const k of ORDRE_EAU) Object.assign(TYPES[k], { r: 'eau', f: null, mw: 0, groupe: 'eau' });
const estEauU = u => TYPES[u.type]?.r === 'eau';
const capTexte = ty => (ty.m3 ? `${nf(ty.m3)} m³/j` : ty.stock ? `${nf(ty.stock)} m³` : ty.eh ? `${nf(ty.eh)} hab.` : ty.tj ? `${nf(ty.tj)} t/j` : ty.volume ? `${nf(ty.volume / 1000)} kt` : '');
const ORDRE_CAPT = { source: 0, forage: 1, prise: 2, forageP: 3, dessal: 4 };  // on appelle d'abord l'eau la moins chère

// ------------------------------------------------------------ conduites : graphe d'arêtes entre hexagones voisins
const TUYAU = { brute: [0x3ad1c4, 1, 'Adduction d’eau brute'], potable: [0x3f9cff, .9, 'Conduite d’eau potable'], secondaire: [0x86c8ff, .55, 'Distribution'], usee: [0xb07f4c, .85, 'Collecteur d’eaux usées'], rejet: [0x9fe0b5, .6, 'Rejet épuré'], reut: [0x7ed957, .6, 'Eau traitée réutilisée'], chaleur: [0xff7a3a, .8, 'Réseau de chaleur'] };
const FAM = { brute: 'p', potable: 'p', secondaire: 'p', usee: 'a', rejet: 'a', reut: 'r', chaleur: 'c' }, RANG = { secondaire: 0, potable: 1, brute: 2, rejet: 0, usee: 1, reut: 0, chaleur: 0 };
const DECAL = { p: [0, 0], a: [3.2, 2], r: [-3.2, -2], c: [1.6, -3.4] };  // l'assainissement et la chaleur courent à côté de l'eau potable, jamais dessus
const COUT_TUYAU = { p: .06, a: .08, c: .15 };  // M€ par hexagone
let ARETES = new Map(), EAU_SALE = true, RESEAUX = [], EGOUTS = [];
const cleA = (f, a, b) => f + '|' + a.k + '|' + b.k;
const areteDe = (f, a, b) => ARETES.get(cleA(f, a, b)) || ARETES.get(cleA(f, b, a));
const passEau = (t, a, b) => t === a || t === b || (!t.brume && !estEau(t) && t.t !== 'montagne' && !t.occ && !t.ville);
function cheminEau(a, b, f = 'p') {  // Dijkstra : longer une conduite existante coûte moins cher, pour former des troncs communs
  const d = new Map([[a, 0]]), prev = new Map([[a, null]]), vu = new Set();
  for (;;) {
    let t = null, m = Infinity; for (const [k, v] of d) if (!vu.has(k) && v < m) { m = v; t = k; }
    if (!t || t === b) break; vu.add(t);
    for (const n of voisins(t)) if (!vu.has(n) && passEau(n, a, b)) { const c = m + (areteDe(f, t, n) ? .3 : 1) * (n.t === 'colline' ? 1.3 : 1); if (c < (d.get(n) ?? Infinity)) { d.set(n, c); prev.set(n, t); } }
  }
  if (!prev.has(b)) return null;
  const p = []; for (let t = b; t; t = prev.get(t)) p.unshift(t); return p;
}
function ajouteArete(a, b, type, an = annee(S.min)) {
  const f = FAM[type], ex = areteDe(f, a, b);
  if (ex) { if (RANG[type] > RANG[ex.type]) ex.type = type; return false; }
  ARETES.set(cleA(f, a, b), { a, b, type, f, an, hs: 0 }); EAU_SALE = true; return true;
}
function poserConduite(a, b, type, p = cheminEau(a, b, FAM[type])) { if (!p) return null; for (let i = 1; i < p.length; i++) ajouteArete(p[i - 1], p[i], type); dessinerEau(); return p; }
const noeudEau = (t, f) => [...ARETES.values()].some(e => e.f === f && (e.a === t || e.b === t));
function finEau(t, f) {  // extrémité valable pour une conduite (f = 'p') ou un collecteur (f = 'a')
  if (!t || t.brume || estEau(t)) return 'Une conduite part d’un hexagone de terre';
  if (t.ville || noeudEau(t, f)) return null;
  if (f === 'c') return t.occ && CHALEUR[t.occ.type] ? null : 'Un réseau de chaleur relie une centrale thermique, un incinérateur ou un méthaniseur à une ville';
  if (t.occ && estEauU(t.occ)) return (TYPES[t.occ.type].role === 'epuration') === (f === 'a') ? null : f === 'a' ? 'Un collecteur relie une ville à une station d’épuration' : 'Les eaux usées partent vers l’épuration avec l’outil Égout';
  return f === 'a' ? 'Un collecteur relie une ville, une épuration ou un collecteur existant' : 'Une conduite relie un ouvrage d’eau, une ville ou une conduite existante';
}
// la distribution intérieure d'une ville raccordée se dessine toute seule, de quartier en quartier
function reseauxVilles() {
  let ajout = false;
  for (const f of ['p', 'a', 'c']) for (const v of VILLES) {
    const entree = v.tuiles.find(t => noeudEau(t, f)); if (!entree) continue;
    const vu = new Set([entree]), file = [entree];
    while (file.length) { const t = file.shift(); for (const n of voisins(t)) if (n.ville === v && !vu.has(n)) { vu.add(n); file.push(n); if (!areteDe(f, t, n)) { ajouteArete(t, n, f === 'p' ? 'secondaire' : f === 'c' ? 'chaleur' : 'usee'); ajout = true; } } }
  }
  return ajout;
}
function topoEau() {
  EAU_SALE = false;
  if (reseauxVilles()) dessinerEau();
  const comps = f => {
    const par = new Map(), find = k => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
    const add = k => { if (!par.has(k)) par.set(k, k); }, uni = (a, b) => { add(a); add(b); par.set(find(a), find(b)); };
    for (const v of VILLES) for (const t of v.tuiles) uni(t.k, v.centre.k);  // une ville forme un seul nœud
    for (const e of ARETES.values()) if (e.f === f && !(e.hs && e.hs > S.min)) uni(e.a.k, e.b.k);
    const g = new Map(), de = k => { const r = find(k); if (!g.has(r)) g.set(r, { f, unites: [], villes: [], aretes: [], age: 0, conf: true, defauts: [], taux: 1, fuite: .05, dem: 0, charge: 0, pression: true }); return g.get(r); };
    for (const u of UNITES) if (par.has(u.t.k) && (f === 'c' ? !!CHALEUR[u.type] : estEauU(u) && (TYPES[u.type].role === 'epuration') === (f === 'a'))) de(u.t.k).unites.push(u);
    for (const v of VILLES) de(v.centre.k).villes.push(v);
    for (const e of ARETES.values()) if (e.f === f && par.has(e.a.k)) de(e.a.k).aretes.push(e);
    return [...g.values()].filter(c => c.unites.length && c.villes.length);
  };
  RESEAUX = comps('p'); EGOUTS = comps('a'); CHAUD = comps('c');
  for (const e of ARETES.values()) e.res = null; for (const C of [...RESEAUX, ...EGOUTS]) for (const e of C.aretes) e.res = C;
  for (const v of VILLES) { v.res = RESEAUX.find(c => c.villes.includes(v)) || null; v.egout = EGOUTS.find(c => c.villes.includes(v)) || null; v.rivI = rivProche(v.centre); }
  for (const u of UNITES) if (estEauU(u)) { u.res = [...RESEAUX, ...EGOUTS].find(c => c.unites.includes(u)) || null; if (u.type === 'prise') u.rivI = Math.max(...voisins(u.t).filter(n => n.riviere !== undefined).map(n => n.riviere), 0); }
}
const rivProche = t => { let b = null, bd = 4; for (const r of RIV) if (r.riviere !== undefined) { const d = dist(r, t); if (d < bd) { bd = d; b = r.riviere; } } return b; };

// ------------------------------------------------------------ qualité de l'eau brute
function brute(u, w, a) {
  const v = brute0(u, w, a), acc = S.eau.acc;
  if (acc && acc.id === u.id && acc.fin > S.min) { v.mic *= 50; v.nitr *= 4; v.pest *= 10; v.micro *= 10; v.org *= 3; }  // lisier ou carburant dans la nappe
  return v;
}
function brute0(u, w, a) {
  const q = TYPES[u.type].qual, t = u.t, ag = agri(a), ind = indusEau(a), crue = w.debit > 1.25 ? 2.5 : 1;
  if (q === 'source') return { turb: 1, mic: .02, org: 2, nitr: 12 * t.nitr * ag, pest: 2 * ag, micro: ind };
  if (q === 'nappe') return { turb: 2 * Math.sqrt(crue), mic: .06, org: 4, nitr: 65 * t.nitr * ag, pest: 14 * t.nitr * ag, micro: 6 * ind };  // le forage est chloré sur place
  if (q === 'profonde') return { turb: .5, mic: .01, org: 1, nitr: 4, pest: .5 * ag, micro: .5 * ind };
  if (q === 'mer') return { turb: .2, mic: .01, org: .5, nitr: 1, pest: .1, micro: .5 };
  const p = S.eau.pollu[u.rivI] || 0;  // rivière : les rejets non épurés en amont dégradent l'eau
  return { turb: 30 * crue, mic: 80 * (1 + 30 * p), org: 40 + 200 * p, nitr: 35 * ag, pest: 60 * ag, micro: (50 + 300 * p) * ind };
}
const traiter = (v, etapes) => { const r = { ...v }; for (const e of etapes) for (const [k, f] of Object.entries(ETAPES[e].f)) r[k] *= f; return r; };
const defauts = (q, a) => POLL.filter(([k, , , n, an]) => a >= an && q[k] > n).map(p => p[1]);
const debitRiv = (i, w) => (.6 + 2.2 * i / Math.max(1, RIV.length)) * w.debit;  // m³/s
const FERMES = [];  // fermes irriguées : indice de rivière le plus proche

// ------------------------------------------------------------ un pas de 15 minutes
function pasEau(m) {
  if (EAU_SALE) topoEau();
  for (const e of ARETES.values()) if (e.hs && e.hs <= m) { e.hs = 0; EAU_SALE = true; log(`Conduite réparée près de ${lieu(e.a)}.`, 'bon'); }
  const E = S.eau, a = annee(m), w = meteo(m), mo = date(m).getUTCMonth(), Lj = interp(LITRES, a), K = kEau(a);
  const chaud = (1 + clamp((w.temp - 20) / 12, 0, 1) * .3) * facFete(m, 'eau'), prof = PROFIL_EAU(heure(m)), restr = E.restriction ? .85 : 1;  // la chaleur, les fêtes et les vacances font monter la demande
  const r = { dem: 0, livre: 0, manque: 0, nc: 0, usees: 0, nonTraite: 0, ventes: 0, opex: 0, amendes: 0, reut: 0 };
  // eaux usées traitées réutilisées (volume du pas précédent) : d'abord l'irrigation, puis l'industrie à la place de l'eau potable
  const irr = (mo >= 5 && mo <= 7 ? 1 : mo === 4 || mo === 8 ? .4 : 0) * (E.restriction ? .5 : 1), preleve = new Float64Array(RIV.length + 1);
  const irrTot = FERMES.length * .012 * irr * 900, irrR = Math.min(irrTot, E.reutQ || 0);
  let indTot = 0; for (const v of VILLES) { v.m3i = v.tuiles.filter(t => t.quartier === 'industriel').length * 2500 * (.4 + .6 * indusEau(a)) / 96 * prof * chaud * restr; indTot += v.m3i; }
  const indR = Math.min(indTot, (E.reutQ || 0) - irrR), kInd = indTot ? 1 - indR / indTot : 1, kDem = rd('telerel') ? .95 : 1;
  r.reut = irrR + indR; r.ventes += r.reut * .5 * K; r.opex += r.reut * .15;
  for (const v of VILLES) { v.m3d = (v.hab * Lj / 1000 / 96 * prof * chaud * restr + v.m3i * kInd) * kDem; v.m3l = 0; v.eauMW = 0; r.dem += v.m3d; }
  if (VILLES[0]) VILLES[0].eauMW += r.reut * .3 / 250;
  // rivière : débit, débit réservé (loi de 1984), irrigation des fermes l'été, prélèvements de l'amont vers l'aval
  for (const f of FERMES) preleve[f] += .012 * irr * 900 * (irrTot ? 1 - irrR / irrTot : 1);
  const acc = E.acc && E.acc.fin > m ? E.acc : null;
  const touche = u => acc && (acc.id === u.id || (acc.genre === 'riviere' && u.type === 'prise' && u.rivI >= acc.i));  // captage dans la pollution
  const dispoRiv = i => { let p = 0; for (let k = 0; k <= i; k++) p += preleve[k]; return Math.max(0, debitRiv(i, w) * 900 - (a >= 1984 ? .1 * (.6 + 2.2 * i / RIV.length) * 900 : 0) - p); };
  let pompeNappe = 0, pompeProf = 0;
  for (const C of RESEAUX) {
    const d = C.villes.reduce((s, v) => s + v.m3d, 0), U = C.unites.filter(u => !u.fin && !(u.panne > m) && u.dispo !== false && !(rd('alerte') && touche(u)) && alimente(u) > 0);  // sans électricité, les pompes s'arrêtent
    for (const u of C.unites) u.q = 0;  // un captage coupé ne produit plus
    C.age = C.aretes.length ? C.aretes.reduce((s, e) => s + a - e.an, 0) / C.aretes.length : 0;
    C.fuite = (.05 + .35 * clamp(C.age / 80, 0, 1)) * (rd('fuites') ? .7 : 1);
    const stocks = U.filter(u => TYPES[u.type].role === 'stock'), pompe = U.some(u => u.type === 'pompage'); C.pression = stocks.length > 0 || pompe;
    const capt = U.filter(u => TYPES[u.type].role === 'captage').sort((x, y) => ORDRE_CAPT[x.type] - ORDRE_CAPT[y.type]);
    let dispo = 0;
    for (const u of capt) {
      const ty = TYPES[u.type], q = ty.qual; let c = ty.m3 / 96 * alimente(u) * (q === 'riviere' && S.evt.secheresse > m && E.prioRiv === 'centrales' ? .6 : 1);  // en sécheresse, la rivière va d'abord aux centrales si on l'a décidé
      if (q === 'source') c *= clamp(.35 + .65 * w.debit, .2, 1);
      if (q === 'nappe') c *= clamp(E.nappe / .35, 0, 1);
      if (q === 'profonde') c *= clamp(E.profonde / .2, 0, 1);
      if (q === 'riviere') c = Math.min(c, dispoRiv(u.rivI));
      u.qmax = c; dispo += c;
    }
    const volMax = stocks.reduce((s, u) => s + TYPES[u.type].stock, 0), vol = stocks.reduce((s, u) => s + TYPES[u.type].stock * u.niv, 0);
    const besoin = d / (1 - C.fuite) * (C.pression ? 1 : .8), servi = Math.min(besoin, dispo + vol);
    let reste = Math.min(dispo, servi + (volMax - vol)); const prod = reste;  // le surplus remplit les châteaux d'eau
    for (const u of capt) { u.q = Math.min(u.qmax, reste); reste -= u.q; if (TYPES[u.type].qual === 'riviere') preleve[u.rivI] += u.q; if (TYPES[u.type].qual === 'nappe') pompeNappe += u.q; if (TYPES[u.type].qual === 'profonde') pompeProf += u.q; }
    if (volMax) { const n = clamp((vol + prod - servi) / volMax, 0, 1); for (const u of stocks) u.niv = n; }
    const livre = servi * (1 - C.fuite); C.taux = d > 0 ? livre / d : 1; C.dem = d; C.livre = livre; C.prod = prod; C.dispo = dispo; C.vol = vol; C.volMax = volMax;
    for (const v of C.villes) v.m3l = v.m3d * C.taux;
    // qualité : rivière puis nappe traitées dans la limite des usines de potabilisation, puis mélange
    const parts = [], file = [];
    for (const u of capt) if (u.q > 0) { const v = brute(u, w, a); (['riviere', 'nappe'].includes(TYPES[u.type].qual) ? file : parts).push([u.q, v, u]); }
    file.sort((x, y) => (TYPES[x[2].type].qual === 'riviere' ? 0 : 1) - (TYPES[y[2].type].qual === 'riviere' ? 0 : 1));
    let kwh = capt.reduce((s, u) => s + (u.q || 0) * TYPES[u.type].kwh, 0) + (pompe ? servi * .25 : 0);
    for (const p of U.filter(u => u.type === 'potab')) {
      let c = TYPES.potab.m3 / 96; p.q = 0;
      while (c > 1e-6 && file.length) { const x = file[0], k = Math.min(c, x[0]); parts.push([k, traiter(x[1], p.etapes || ['sable'])]); x[0] -= k; c -= k; p.q += k; if (x[0] <= 1e-6) file.shift(); }
      kwh += p.q * TYPES.potab.kwh; r.opex += p.q * .03;
    }
    for (const x of file) parts.push(x);  // eau brute distribuée sans traitement
    const tot = parts.reduce((s, x) => s + x[0], 0), qual = {};
    for (const [k] of POLL) qual[k] = tot > 0 ? parts.reduce((s, x) => s + x[0] * x[1][k], 0) / tot : 0;
    C.qual = qual; C.defauts = tot > 0 ? defauts(qual, a) : []; C.conf = !C.defauts.length;
    if (!C.conf) r.nc += livre;
    if (qual.mic > 1 && livre > 0) for (const v of C.villes) { v.micJ = (v.micJ || 0) + 1; v.micM = Math.max(v.micM || 0, qual.mic); }  // risque d'épidémie, avec ou sans norme
    for (const u of capt) if (u.type === 'dessal') { r.opex += (u.q || 0) * (rd('osmose') ? .18 : .3); kwh -= (u.q || 0) * (rd('osmose') ? 1.4 : 0); }
    const ch = C.villes[0]; if (ch) ch.eauMW += kwh / 250;
    r.livre += livre; r.ventes += livre * E.tarif * K;
  }
  for (const v of VILLES) r.manque += Math.max(0, v.m3d - v.m3l);
  // assainissement : les eaux usées des villes raccordées sont épurées dans la limite des stations
  const rej = new Float64Array(RIV.length + 1); let reutQ = 0;
  for (const v of VILLES) { v.usees = v.m3l * .85 + (v.res ? 0 : v.m3d * .5); v.traite = 0; r.usees += v.usees; }  // sans réseau, le puits et la fosse rejettent quand même
  for (const C of EGOUTS) {
    const U = C.unites.filter(u => !u.fin && !(u.panne > m)), cap = U.reduce((s, u) => s + ehU(u) * alimente(u), 0) * Lj / 1000 / 96, us = C.villes.reduce((s, v) => s + v.usees, 0);
    const k = us > 0 ? Math.min(1, cap / us) : 1; C.charge = cap > 0 ? us / cap : 0;
    reutQ += Math.min(us * k, U.reduce((s, u) => s + (u.reut ? REUT[u.type][0] / 96 : 0), 0));
    for (const v of C.villes) v.traite = v.usees * k;
    const kw = U.reduce((s, u) => s + TYPES[u.type].kwh, 0) ? us * k * .4 : 0; if (C.villes[0]) C.villes[0].eauMW += kw / 250;
    r.opex += us * k * .05;
  }
  for (const v of VILLES) { const nt = v.usees - v.traite; r.nonTraite += nt; if (v.rivI !== null && v.rivI !== undefined) rej[v.rivI] += nt; }
  for (const u of UNITES) if (u.type === 'decharge' && !u.fin && u.rempli && !amel(u, 'casiers')) { const i = rivProche(u.t); if (i !== null) rej[i] += lixiviats(u, w); }  // jus de décharge, plus abondants quand il pleut
  // pollution de la rivière : les rejets se cumulent vers l'aval et s'auto-épurent un peu à chaque hexagone
  let cum = 0; E.pollu = E.pollu || [];
  for (let i = 0; i < RIV.length; i++) { cum = cum * .85 + rej[i]; E.pollu[i] = cum / Math.max(50, debitRiv(i, w) * 900) + (acc && acc.genre === 'riviere' && i >= acc.i ? 1.5 * .85 ** (i - acc.i) : 0); }
  E.reutQ = reutQ;
  // nappes : recharge l'hiver, pompage
  const rech = (mo <= 2 || mo >= 10 ? 1.6 : mo >= 5 && mo <= 8 ? .35 : 1) * w.debit;
  E.nappe = clamp(E.nappe + (80000 / 96 * rech - pompeNappe) / 4e7, 0, 1); E.profonde = clamp(E.profonde + (6000 / 96 - pompeProf) / 8e7, 0, 1);  // nappe alluviale ≈ 30 hm³ rechargés par an ; nappe profonde : réserve lente
  // coûts fixes : ouvrages et entretien des conduites ; amendes après la directive de 1991
  r.opex += UNITES.reduce((s, u) => s + (estEauU(u) && !u.fin ? TYPES[u.type].opexE * 1e3 : 0), 0) / (365 * 96) + ARETES.size * 2000 / (365 * 96);
  if (a >= 1992) r.amendes += r.nonTraite * .5;
  if (a >= 1976) r.amendes += r.nc * .2;
  E.taux = r.dem > 0 ? 1 - r.manque / r.dem : 1; E.conf = r.livre > 0 ? 1 - r.nc / r.livre : 1; E.epure = r.usees > 0 ? 1 - r.nonTraite / r.usees : 1;
  return r;
}
// renouvellement des conduites de plus de 30 ans
const vieilles = () => [...ARETES.values()].filter(e => annee(S.min) - e.an >= 30);
const coutRenouv = () => vieilles().length * .1e6;
function renouveler() { const l = vieilles(), c = coutRenouv(); if (!l.length) return 'Aucune conduite de plus de 30 ans.'; S.argent -= c; S.an.capex += c; for (const e of l) e.an = annee(S.min); EAU_SALE = true; dessinerEau(); log(`Renouvellement de ${l.length} tronçons de conduites (${nf(c / 1e6, 1)} M€) : les fuites et les casses diminuent.`, 'bon'); return null; }
function equiperReut(u) { const c = REUT[u.type][1] * 1e6; if (!rd('reut') || u.reut) return; S.argent -= c; S.an.capex += c; u.reut = true; poserReut(u); log(`${u.nom} : réutilisation des eaux traitées pour l’irrigation et l’industrie (${nf(c / 1e6, 1)} M€).`, 'bon'); }
function poserReut(u) {  // conduites vertes vers les trois fermes les plus proches et la zone industrielle la plus proche
  const pres = (l, d) => l.filter(t => dist(t, u.t) <= d).sort((a, b) => dist(a, u.t) - dist(b, u.t));
  const fermes = pres(LISTE.filter(t => t.ferme && !t.occ && !t.ville), 5).slice(0, 3), indus = pres(VILLES.flatMap(v => v.tuiles.filter(t => t.quartier === 'industriel')), 6).slice(0, 1);
  for (const t of [...fermes, ...indus]) { const p = cheminEau(u.t, t, 'r'); if (p) for (let i = 1; i < p.length; i++) ajouteArete(p[i - 1], p[i], 'reut'); }
  dessinerEau();
}
function retirerReut(u) {  // à la démolition, on retire le réseau vert qui part de la station
  const vu = new Set([u.t]), file = [u.t];
  while (file.length) { const t = file.shift(); for (const [k, e] of ARETES) if (e.f === 'r' && (e.a === t || e.b === t)) { const n = e.a === t ? e.b : e.a; ARETES.delete(k); if (!vu.has(n) && !(n.occ && n.occ.reut)) { vu.add(n); file.push(n); } } }
  dessinerEau();
}
function cassesEau(m) {  // chaque nuit, une vieille conduite peut casser
  const a = annee(m);
  for (const e of ARETES.values()) if (!e.hs && e.type !== 'secondaire' && alea() < .000004 * Math.max(0, a - e.an) * DIFF[S.diff].evt * (rd('telerel') ? .5 : 1)) {
    e.hs = m + 1440; EAU_SALE = true; S.argent -= .05e6;
    log(`Casse d’une conduite près de ${lieu(e.a)} : réparation en 24 h (50 k€).`, 'mauvais'); toast(`Casse de conduite près de ${lieu(e.a)}.`);
  }
}

// crises sanitaires : une eau chargée en microbes finit par rendre les habitants malades
const NOM_CRISE = a => a < 1920 ? 'Épidémie de fièvre typhoïde' : a < 1950 ? 'Épidémie de dysenterie' : a < 1990 ? 'Épidémie de gastro-entérite' : 'Contamination bactérienne du réseau';
function crisesEau(m) {
  const E = S.eau, a = annee(m), al = rd('alerte') ? .5 : 1; E.crises = (E.crises || []).filter(c => c.fin > m || (c.fini || log(`Fin de la crise sanitaire à ${c.v}.`, 'bon'), c.fini = true, c.fin > m - 90 * 1440));  // 3 mois d'accalmie après une crise
  for (const v of VILLES) {
    const f = (v.micJ || 0) / 96, sev = clamp(Math.log10(v.micM || 1) / 2, .15, 1); v.micJ = 0; v.micM = 0;
    if (f > 0 && !E.crises.some(c => c.v === v.nom) && alea() < .04 * f * sev * DIFF[S.diff].evt * al) {
      const n = NOM_CRISE(a), j = Math.round((7 + alea() * 10) * al * (S.crise ? .5 : 1)), c = v.hab * 30 * (S.crise ? .5 : 1);
      E.crises.push({ v: v.nom, fin: m + j * 1440, nom: n }); S.an.crises++; S.argent -= c; S.an.amendes += c;
      log(`${n} à ${v.nom} : l’eau du réseau est contaminée. Soins et eau en bouteille pendant ${j} jours (${nf(c / 1e6, 1)} M€). Ajoutez une étape de traitement ou coupez le captage en cause.`, 'mauvais'); toast(`${n} à ${v.nom} !`);
    }
  }
}
// pollutions accidentelles : rejet dans la rivière ou dans une nappe, de plus en plus fréquentes avec l'industrie et l'agriculture
function accidentEau(m) {
  const E = S.eau, a = annee(m);
  if (E.acc && E.acc.fin <= m) { log(`Pollution résorbée : ${E.acc.nom.toLowerCase()} près de ${E.acc.lieu}.`, 'bon'); E.acc = null; }
  if (E.acc || a < 1920 || alea() > .0015 * DIFF[S.diff].evt * (.3 + indusEau(a) + .5 * agri(a))) return;
  const capt = UNITES.filter(u => !u.fin && ['forage', 'source'].includes(u.type)), riv = RIV.length && alea() < .7;
  if (riv) { const i = Math.floor(alea() * RIV.length); E.acc = { genre: 'riviere', i, fin: m + (2 + alea() * 3) * 1440 * (S.crise ? .5 : 1), nom: a < 1950 ? 'Rejet d’une tannerie' : ['Déversement d’hydrocarbures', 'Rejet toxique d’une usine', 'Mortalité de poissons après un rejet chimique'][Math.floor(alea() * 3)], lieu: lieu(RIV[i]) }; }
  else if (capt.length) { const u = capt[Math.floor(alea() * capt.length)]; E.acc = { genre: 'nappe', id: u.id, fin: m + (5 + alea() * 10) * 1440 * (S.crise ? .5 : 1), nom: ['Pollution au lisier', 'Fuite d’une cuve de carburant'][Math.floor(alea() * 2)], lieu: lieu(u.t) }; }
  else return;
  S.an.acc++;
  log(`${E.acc.nom} près de ${E.acc.lieu} : ${E.acc.genre === 'riviere' ? 'la pollution descend la rivière. Coupez les prises d’eau en aval' : 'le captage est contaminé. Coupez-le'} le temps qu’elle passe${rd('alerte') ? ' (la surveillance continue s’en charge)' : ''}.`, 'mauvais');
  toast(`${E.acc.nom} près de ${E.acc.lieu}.`);
}
