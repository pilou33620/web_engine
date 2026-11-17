"use strict";
// ============================================================ terrain et cartes
const TERR = {
  mer: { nom: 'Mer', col: 0x1d5a86, h: -5.5, eau: true }, cote: { nom: 'Côte', col: 0xe6d49a, h: -2.4, eau: true }, lac: { nom: 'Lac de retenue', col: 0xd2c88f, h: -2.4, eau: true },
  prairie: { nom: 'Prairie', col: 0x84c450, h: 0 }, plaine: { nom: 'Plaine cultivée', col: 0xc9c65c, h: 0 }, foret: { nom: 'Forêt', col: 0x5d9b3a, h: .2 },
  colline: { nom: 'Collines', col: 0xa2b65a, h: 2.6 }, montagne: { nom: 'Montagne', col: 0x8f8879, h: 4.6 }, ville: { nom: 'Ville', col: 0xd3c7a6, h: .3 },
  brume: { nom: 'Terres inexplorées', col: 0xdcc79a, h: .9 },
};
const estEau = t => TERR[t.t].eau;
// Relief : e = amp·bruit + gu·u + gv·v + base − ile·(distance au centre). Les proportions de mer, collines, montagnes, forêts et plaines
// sont des quantiles, ce qui garantit des cartes jouables quelle que soit la graine (Valmont garde ses seuils d'origine).
const CARTES = {
  valmont: { nom: 'Vallée de Valmont', sous: 'Montagnes, rivière et crêtes ventées', graine: 7, amp: .85, freq: .17, gu: .95, gv: -.18, base: -.12, abs: { mer: .36, coll: 1.03, mont: 1.2, foret: .6, plaine: .43 }, front: 'est', villes: ['Valmont', 'Bréhal', 'Saint-Aure', 'Montclair', 'Les Aubiers', 'Roquefeuil', 'Sainte-Gemme'] },
  littoral: { nom: 'Côte d’Émeraude', sous: 'Longue côte, vent de mer, éolien en mer', graine: 21, amp: .7, freq: .16, gu: .25, gv: -1, base: 0, mer: .3, coll: .15, mont: .04, foret: .25, plaine: .35, front: 'auto', villes: ['Port-Émeraude', 'Lannevez', 'Kerbihan', 'Ploumor', 'Trégastel-sur-Mer', 'Locmaria', 'Penhir'] },
  plaine: { nom: 'Grande plaine agricole', sous: 'Soleil, cultures et biomasse, peu de relief', graine: 33, amp: .55, freq: .14, gu: .2, gv: .15, base: 0, mer: .04, coll: .1, mont: .02, foret: .13, plaine: .6, front: 'auto', villes: ['Champvert', 'Blémont', 'Les Trois-Moulins', 'Vauxbrie', 'Saint-Fiacre', 'Orgemont', 'Beaumarais'] },
  ile: { nom: 'Île de Kerlann', sous: 'Sans interconnexion, tarifs majorés de 45 % par la péréquation', graine: 45, amp: .55, freq: .2, gu: 0, gv: 0, base: 0, ile: 1.6, mer: .42, coll: .14, mont: .06, foret: .25, plaine: .35, front: null, tarifK: 1.45, villes: ['Kerlann', 'Port-Tudy', 'Lanvaux', 'Kervillec', 'Pors-Hir', 'Le Stang', 'Kerdual'] },
  industrie: { nom: 'Bassin de Forgeval', sous: 'Usines exigeantes : 10 minutes de coupure par an au plus', graine: 58, amp: .7, freq: .18, gu: .7, gv: .2, base: 0, mer: .12, coll: .16, mont: .06, foret: .2, plaine: .45, front: 'auto', industriel: true, coupureMax: 10, demande: 1.2, villes: ['Forgeval', 'Acier-sur-Lys', 'Vernay', 'Hautcrassier', 'Saint-Éloi', 'Fonderie-les-Bains', 'Ferrières'] },
  marche: { nom: 'Carrefour des frontières', sous: 'Marché ouvert : gros échanges, prix volatils', graine: 64, amp: .6, freq: .15, gu: -.5, gv: .3, base: 0, mer: .14, coll: .14, mont: .04, foret: .22, plaine: .4, front: 'auto', prixVol: 1.8, exportK: .85, frontLignes: 2, villes: ['Trois-Frontières', 'Hallange', 'Lauterbourg', 'Sarrelinde', 'Rosselange', 'Wissenberg', 'Florange-le-Haut'] },
};
const NOMS_VILLES = ['Montrevel', 'Aubrac-le-Haut', 'Sainte-Lune', 'Belcastel', 'Ravenel', 'Port-Lys', 'Vallauris-sur-Orne', 'Givrac', 'Morteau-les-Bains', 'Clairefont', 'Rochebrune', 'Lormont', 'Saint-Cyrille', 'Vernoux', 'Hautefage', 'Brassac'];
function carteAleatoire(graine = 1 + Math.floor(Math.random() * 99998)) {
  const h = k => hache(graine, k, 777), ile = h(1) < .22, th = h(2) * Math.PI * 2, gr = .3 + h(3) * .8;
  const noms = [...NOMS_VILLES].sort((a, b) => hache(graine, NOMS_VILLES.indexOf(a), 5) - hache(graine, NOMS_VILLES.indexOf(b), 5));
  return { id: 'aleatoire', nom: `Terres de ${noms[0]}`, sous: `Carte aléatoire · graine ${graine}`, graine, amp: .5 + h(4) * .4, freq: .13 + h(5) * .07, gu: ile ? 0 : gr * Math.cos(th), gv: ile ? 0 : gr * Math.sin(th), base: 0,
    ile: ile ? 1.2 + h(6) * .6 : 0, tarifK: ile ? 1.45 : 1, mer: ile ? .38 + h(7) * .08 : .05 + h(7) * .27, coll: .1 + h(8) * .12, mont: .02 + h(9) * .06, foret: .15 + h(10) * .17, plaine: .25 + h(11) * .25,
    front: ile ? null : 'auto', villes: noms.slice(0, 8) };
}
const carteDef = (id, graine) => (id === 'aleatoire' ? carteAleatoire(graine) : { id, ...CARTES[id] });
const quantile = (vals, q) => { const s = [...vals].sort((a, b) => a - b); return s[clamp(Math.floor(q * (s.length - 1)), 0, s.length - 1)]; };
const QUART = {
  centre: { nom: 'Centre-ville', mw: 55, cat: 'ter' }, residentiel: { nom: 'Quartier résidentiel', mw: 35, cat: 'res' }, affaires: { nom: "Quartier d'affaires", mw: 45, cat: 'ter' },
  industriel: { nom: 'Zone industrielle', mw: 70, cat: 'ind' }, hopital: { nom: 'Hôpital (critique)', mw: 10, cat: 'crit' }, village: { nom: 'Village', mw: 9, cat: 'res' },
};
const libre = t => t && !t.brume && !estEau(t) && t.riviere === undefined && !t.ville && t.t !== 'montagne';
const plat = t => t.t === 'prairie' || t.t === 'plaine';
const proche = (liste, x, z) => liste.sort((a, b) => Math.hypot(a.col - x, a.row - z) - Math.hypot(b.col - x, b.row - z))[0];
function fonderVille(nom, centre, types, couleur, rang) {
  const v = { nom, centre, couleur, tuiles: [], rang, rayon: rang === 'village' ? 1 : 2, i: 0, servie: true, fondee: 1900, prochaine: 1905 };
  v.tuiles.push(centre); Object.assign(centre, { ville: v, quartier: types[0], t: 'ville' });
  const autour = voisins(centre).filter(libre).sort((a, b) => voisins(b).filter(libre).length - voisins(a).filter(libre).length);
  types.slice(1).forEach((type, i) => { const t = autour[i]; if (t) { Object.assign(t, { ville: v, quartier: type, t: 'ville' }); v.tuiles.push(t); } });
  v.base = v.tuiles.length; v.hab = v.tuiles.reduce((a, t) => a + ({ centre: 30000, residentiel: 25000, industriel: 8000, village: 2500 }[t.quartier] || 10000), 0); VILLES.push(v); return v;
}
function genererTerrain(def) {
  CARTE = def; GRAINE = def.graine; nouvelleGrille(); RIV = []; VILLES = []; FRONT_T = null; BARRAGE_T = null;
  for (const t of LISTE) {
    const u = t.col / (COLS - 1), v = t.row / (ROWS - 1), dc = Math.hypot((u - .5) * 1.25, v - .5) * 1.6;
    t.e = def.amp * fbm(t.col * def.freq, t.row * def.freq) + def.gu * u + def.gv * v + def.base - (def.ile || 0) * dc;
    t.m = fbm(t.col * .21 + 40, t.row * .21 + 17);
    const bordure = Math.min(t.col, t.row, COLS - 1 - t.col, ROWS - 1 - t.row);
    t.brume = bordure + bruit(t.col * .55, t.row * .55 + 3) * 1.8 < 1.7;
  }
  const es = LISTE.map(t => t.e), S0 = def.abs || { mer: quantile(es, def.mer), mont: quantile(es, 1 - def.mont), coll: quantile(es, 1 - def.mont - def.coll) };
  const terre = LISTE.filter(t => t.e >= S0.mer && t.e <= S0.coll).map(t => t.m);
  const hum = def.abs || { foret: quantile(terre, 1 - def.foret), plaine: quantile(terre, def.plaine) };
  for (const t of LISTE) t.t = t.e < S0.mer ? 'mer' : t.e > S0.mont ? 'montagne' : t.e > S0.coll ? 'colline' : t.m > hum.foret ? 'foret' : t.m < hum.plaine ? 'plaine' : 'prairie';
  for (const t of LISTE) if (t.t === 'mer' && voisins(t).some(n => !estEau(n))) t.t = 'cote';
  // rivière : descente depuis les collines au pied des montagnes
  const sources = LISTE.filter(t => t.t === 'colline' && !t.brume && voisins(t).some(n => n.t === 'montagne'));
  const hautes = LISTE.filter(x => !x.brume && x.t === 'colline').sort((a, b) => b.e - a.e);
  let t = def.abs ? sources.sort((a, b) => Math.hypot(a.col - COLS * .7, a.row - ROWS * .32) - Math.hypot(b.col - COLS * .7, b.row - ROWS * .32))[0]
    : (sources.length ? sources : hautes).sort((a, b) => b.e - a.e)[Math.floor(hache(1, 2, 3) * Math.min(4, (sources.length || hautes.length)))] || LISTE.filter(x => !x.brume && !estEau(x)).sort((a, b) => b.e - a.e)[0];
  const vu = new Set();
  while (t && RIV.length < 40) {
    RIV.push(t); vu.add(t);
    const mer = voisins(t).find(n => n.t === 'mer' || n.t === 'cote');
    if (mer) { t.versMer = mer; break; }
    t = voisins(t).filter(n => !vu.has(n) && !n.brume && n.t !== 'montagne').sort((a, b) => (a.e + hache(a.q, a.r, 3) * .12) - (b.e + hache(b.q, b.r, 3) * .12))[0];
  }
  RIV.forEach((r, i) => { r.riviere = i; if (!estEau(r)) r.t = r.t === 'plaine' ? 'plaine' : 'prairie'; });
  if (RIV.length >= 7) { RIV[1].t = RIV[2].t = 'lac'; RIV[1].riviere = RIV[2].riviere = undefined; BARRAGE_T = RIV[3]; }
  // en 1900, une seule ville au bord de la rivière ; les emplacements des futures villes sont réservés (SITES)
  const nbl = x => voisins(x).filter(libre).length;
  const k = RIV.length >= 5 ? RIV[Math.floor(RIV.length * .55)] : null;
  const cand = LISTE.filter(x => libre(x) && plat(x) && Math.min(x.col, x.row, COLS - 1 - x.col, ROWS - 1 - x.row) >= 4);
  const c1 = (k ? LISTE.filter(x => libre(x) && dist(x, k) <= 2 && dist(x, k) >= 1) : []).sort((a, b) => nbl(b) - nbl(a) || dist(a, k) - dist(b, k))[0]
    || cand.sort((a, b) => nbl(b) - nbl(a) || Math.hypot(a.col - COLS / 2, a.row - ROWS / 2) - Math.hypot(b.col - COLS / 2, b.row - ROWS / 2))[0];
  fonderVille(def.villes[0], c1, def.industriel ? ['centre', 'industriel', 'residentiel', 'industriel'] : ['centre', 'residentiel', 'residentiel', 'industriel'], '#ffc94d', 'capitale');
  SITES = [];
  const okSite = x => libre(x) && plat(x) && Math.min(x.col, x.row, COLS - 1 - x.col, ROWS - 1 - x.row) >= 3 && [...VILLES.map(v => v.centre), ...SITES].every(c => dist(x, c) >= 5);
  for (let n = 0; n < 6; n++) {
    const l = LISTE.filter(okSite); if (!l.length) break;
    const cote = l.filter(x => voisins(x).some(y => y.t === 'cote' || y.riviere !== undefined));
    SITES.push((n % 2 === 0 && cote.length ? cote : l).sort((a, b) => nbl(b) - nbl(a) || hache(a.q, a.r, 11) - hache(b.q, b.r, 11))[0]);
  }
  // interconnexion : sur le bord qui a le plus de terre (à l'est pour Valmont), aucune sur une île
  if (def.front) {
    const bords = { est: x => COLS - 1 - x.col, ouest: x => x.col, nord: x => x.row, sud: x => ROWS - 1 - x.row };
    const ok = x => libre(x) && !x.ville && x.t !== 'colline' && [...VILLES.map(v => v.centre), ...SITES].every(c => dist(x, c) >= 3);
    let cote = def.front;
    if (cote === 'auto') cote = Object.keys(bords).sort((a, b) => LISTE.filter(x => ok(x) && bords[b](x) < 5).length - LISTE.filter(x => ok(x) && bords[a](x) < 5).length)[0];
    FRONT_T = LISTE.filter(x => ok(x) && (def.abs ? x.row > ROWS * .4 && x.row < ROWS * .8 : true)).sort((a, b) => bords[cote](a) - bords[cote](b) || Math.abs(a.row - ROWS / 2) + Math.abs(a.col - COLS / 2) - Math.abs(b.row - ROWS / 2) - Math.abs(b.col - COLS / 2))[0] || null;
  }
  for (const x of LISTE) { x.top = TERR[x.brume ? 'brume' : x.t].h; x.t0 = x.ville ? 'prairie' : x.t; }
  // hydrologie : distance à la rivière, nappe alluviale, sensibilité aux nitrates ; fermes sur les plaines et les prairies
  const d = new Map(), file = RIV.filter(x => x.riviere !== undefined); file.forEach(x => d.set(x, 0));
  while (file.length) { const x = file.shift(); for (const n of voisins(x)) if (!d.has(n)) { d.set(n, d.get(x) + 1); file.push(n); } }
  for (const x of LISTE) {
    x.dr = d.get(x) ?? 9;
    x.nappe = clamp(.85 * Math.max(0, 1 - x.dr / 3.5) + .5 * (fbm(x.col * .13 + 70, x.row * .13) - .3), 0, 1);
    x.nitr = clamp(({ plaine: .75, prairie: .4, foret: .08 }[x.t] ?? .2) + (hache(x.q, x.r, 11) - .5) * .25 + (x.dr <= 2 ? .1 : 0), 0, 1);
    x.ferme = !x.brume && !x.ville && x.riviere === undefined && x !== FRONT_T && !SITES.includes(x) && VILLES.every(v => dist(v.centre, x) > 2) ? (x.t === 'plaine' && hache(x.q, x.r, 41) < .5 ? 'culture' : x.t === 'prairie' && hache(x.q, x.r, 41) < .2 ? 'elevage' : null) : null;
  }
}
// les riverains n'aiment pas ces voisins, sauf s'ils ont été équipés contre leur malus
const genant = u => u.type === 'nucleaire' || ((estCharbon(u) || u.type === 'fioul') && !amel(u, 'filtres')) || (['gaz', 'tac'].includes(u.type) && !amel(u, 'lownox'))
  || (['step', 'lagunage'].includes(u.type) && !amel(u, 'desodo')) || (u.type === 'incin' && !amel(u, 'fumees')) || (u.type === 'decharge' && !amel(u, 'biogaz'));
function majAcceptation() {
  for (const t of LISTE) {
    const v = t.row / (ROWS - 1), mer = voisins(t).some(n => n.t === 'cote' || n.t === 'mer');
    t.soleil = clamp(2.3 + v * 1.5 + bruit(t.col * .3, t.row * .3 + 20) * 1.2 - (t.t === 'foret' ? .5 : 0) - (t.t === 'montagne' ? .7 : 0), 1, 5);
    t.vent = clamp(4.2 + ({ colline: 2.3, montagne: 2.9, foret: -.9, cote: 2.6, mer: 3 }[t.t] || 0) + (mer ? 1.5 : 0) + bruit(t.col * .25 + 7, t.row * .25) * 1.6, 3, 10);
    const dv = Math.min(...VILLES.map(c => Math.min(...c.tuiles.map(x => dist(t, x)))));
    let a = 22 + 16 * Math.min(dv, 4) + (hache(t.q, t.r, 9) - .5) * 14 - (t.t === 'foret' ? 9 : 0);
    for (const u of UNITES) if (genant(u) && dist(u.t, t) <= 2 && u.t !== t) a -= 12;
    t.accept = clamp(a, 5, 96);
  }
}
