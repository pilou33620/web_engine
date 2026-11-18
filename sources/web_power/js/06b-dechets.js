"use strict";
// ============================================================ déchets : production, collecte, tri, traitement, élimination
// Un pas par jour, à minuit : chaque ville remplit ses bacs, les camions les vident (du lundi au samedi),
// puis les tonnes partent vers le tri, le compost, l'incinérateur ou la décharge. Chaque tonne produite est retrouvée quelque part.
const FLUX_D = ['res', 'emb', 'verre', 'bio', 'enc'];
const NOM_FLUX_D = { res: 'Ordures résiduelles', emb: 'Emballages', verre: 'Verre', bio: 'Biodéchets', enc: 'Encombrants', boues: 'Boues d’épuration' };
const COUL_FLUX_D = { res: '#3987e5', emb: '#c98500', verre: '#199e70', bio: '#d95926', enc: '#9085e9', boues: '#d55181' };  // palette catégorielle validée sur le fond sombre
const KG_HAB = [[1900, 120], [1930, 160], [1950, 200], [1970, 290], [1990, 430], [2005, 540], [2020, 510], [2050, 430]];  // kg par habitant et par an
const PART_D = { emb: [[1900, .04], [1950, .1], [1975, .22], [2000, .26]], verre: [[1900, .03], [1960, .08]], bio: [[1900, .45], [1960, .3], [1990, .22]], enc: [[1900, .06], [1970, .12]] };
const K_DEC = [[1900, .15], [1950, .4], [1975, .65], [2000, .9], [2020, 1]];  // coûts, prix et redevance réels par rapport à 2020
const kDec = (a = annee(S.min)) => interp(K_DEC, a);
const CAMION = [[1900, 40], [1950, 90], [1980, 150], [2020, 180]];  // k€ par camion et par an, équipage compris
const coutCamion = (a = annee(S.min)) => interp(CAMION, a) * 1e3 * (S.dec.nuit ? 1.25 : 1);  // la collecte de nuit paie des majorations
const achatCamion = (a = annee(S.min)) => coutCamion(a) * 1.5;
const capCamion = (a = annee(S.min)) => (a < 1925 ? 2.5 : a < 1955 ? 5 : 7) * (rd('tasseuse') ? 1.6 : 1) * (rd('tournees') ? 1.2 : 1) * (S.evt.cyber > S.min ? .8 : 1);  // sans supervision, les tournées ne sont plus optimisées  // t/j : tombereau à cheval, camion, benne
const nomCamion = (a = annee(S.min)) => (a < 1925 ? 'tombereaux à cheval' : rd('tasseuse') ? 'bennes tasseuses' : 'camions-bennes');
const tgap = a => (a < 1999 ? 0 : Math.min(65, 9 + (a - 1999) * 2.2) + Math.max(0, a - 2025) * 2);  // taxe sur l'enfouissement, €/t
const CAPJ_D = { res: 5, emb: 10, verre: 16, bio: 5 };  // autonomie des bacs, en jours de production
const MODES_D = {
  res: { an: 1900, nom: 'Porte-à-porte, bac gris', cout: 0 },
  verre: { an: 1974, nom: 'Colonnes d’apport volontaire', cout: .3 },
  emb: { an: 1992, rd: 'selective', nom: 'Bac jaune en porte-à-porte', cout: 1 },
  bio: { an: 2000, rd: 'biodechets', nom: 'Bac marron en porte-à-porte', cout: .8 },
};  // cout : M€ pour 100 000 habitants
const coutMode = f => MODES_D[f].cout * 1e6 * Math.max(.2, VILLES.reduce((s, v) => s + v.hab, 0) / 1e5);
const modeDispo = f => annee(S.min) >= MODES_D[f].an && (!MODES_D[f].rd || rd(MODES_D[f].rd));
const MATIERES_D = { papier: ['Papier et carton', 95], plastique: ['Plastiques', 230], metal: ['Métaux', 280], verre: ['Verre', 25], materiaux: ['Ferraille et bois', 45] };
// tj : capacité en t/j ; volume en t ; capex M€ ; delai mois ; opexT €/t de 2020 ; fixe €/an ; loin : distance minimale aux habitations ; nuis : gêne des riverains
// mw et mwhT : l'incinérateur et le méthaniseur produisent de l'électricité selon les tonnes traitées, s'ils sont raccordés au réseau
Object.assign(TYPES, {
  garage: { role: 'depot', nom: 'Dépôt de camions', court: 'Dépôt', capex: .3, delai: 3, fixe: 30e3, nuis: .5, ok: t => plat(t) || t.t === 'colline', non: 'Plaine ou collines', pot: 'accept', an: 1900 },
  quai: { role: 'quai', nom: 'Quai de transfert', court: 'Quai', capex: 2, delai: 6, fixe: 120e3, nuis: 1, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1970 },
  decharge: { role: 'enfouir', nom: 'Décharge', court: 'Décharge', volume: 1e6, capex: 6, delai: 8, opexT: 25, loin: 3, nuis: 4, ok: t => (plat(t) || t.t === 'colline') && !(t.dr <= 1), non: 'Plaine ou collines, loin de la rivière (lixiviats)', pot: 'accept', an: 1900 },
  decheterie: { role: 'apport', nom: 'Déchèterie', court: 'Déchèterie', capex: .6, delai: 4, fixe: 150e3, nuis: 0, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1985 },
  compost: { role: 'compost', nom: 'Plateforme de compostage', court: 'Compostage', tj: 25, capex: 1.5, delai: 4, opexT: 40, nuis: 1.5, ok: t => plat(t) || t.t === 'colline', non: 'Plaine ou collines', pot: 'accept', an: 1980 },
  tri: { role: 'tri', nom: 'Centre de tri', court: 'Tri', tj: 30, capex: 12, delai: 12, opexT: 135, nuis: .5, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1990 },
  incin: { role: 'bruler', nom: 'Usine d’incinération', court: 'Incinérateur', tj: 120, capex: 60, delai: 30, opexT: 95, loin: 2, nuis: 3, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1960, mw: 4, mwhT: .65, f: 'dechets', fatal: true, cout: 0, co2: 450, ramp: 99, reseau: 63 },
  dangereux: { role: 'dangereux', nom: 'Centre de traitement des déchets dangereux', court: 'Déchets dangereux', tj: 15, capex: 20, delai: 18, opexT: 400, loin: 3, nuis: 2, ok: plat, non: 'Terrain plat', pot: 'accept', an: 1955 },
  metha: { role: 'metha', nom: 'Méthaniseur', court: 'Méthaniseur', tj: 50, capex: 8, delai: 12, opexT: 60, loin: 2, nuis: 1.5, ok: plat, non: 'Terrain plat', pot: 'accept', an: 2005, rd: 'metha', mw: 1, mwhT: .3, f: 'biomasse', fatal: true, cout: 0, co2: 0, ramp: 99, reseau: 63 },
});
const ORDRE_DEC = ['garage', 'decharge', 'quai', 'decheterie', 'compost', 'tri', 'incin', 'metha', 'dangereux'];
for (const k of ORDRE_DEC) Object.assign(TYPES[k], { r: 'dechets', f: TYPES[k].f || null, mw: TYPES[k].mw || 0, groupe: 'dechets' });
const estDecU = u => TYPES[u.type]?.r === 'dechets';
const capTri = () => TYPES.tri.tj * (rd('optique') ? 2.2 : rd('trisemi') ? 1.7 : 1);
const capDec = u => (u.type === 'tri' ? capTri() : TYPES[u.type].tj || 0);
const etatDec = () => ({ camions: 0, tarif: 90, modes: { res: 2, emb: 0, verre: 0, bio: 0 }, brigade: false, campagne: 0, greve: 0, nuit: false, usure: .2,
  prix: Object.fromEntries(Object.entries(MATIERES_D).map(([k, v]) => [k, v[1]])), vendre: Object.fromEntries(Object.keys(MATIERES_D).map(k => [k, true])), stock: Object.fromEntries(Object.keys(MATIERES_D).map(k => [k, 0])),
  L: { prod: 0, vendu: 0, compost: 0, energie: 0, enfoui: 0, export: 0 }, jours: [], liens: [], pen: 0 });
const bacs = v => v.bac || Object.assign(v, { bac: { res: 0, emb: 0, verre: 0, bio: 0 }, moy: { res: 0, emb: 0, verre: 0, bio: 0 }, sauvage: 0 }).bac;
const remplissage = v => { bacs(v); let m = 0; for (const f of ['res', 'emb', 'verre', 'bio']) if (S.dec.modes[f] && v.moy[f] > .02) m = Math.max(m, v.bac[f] / (CAPJ_D[f] * v.moy[f])); return m; };
const sauvageTotal = () => VILLES.reduce((s, v) => (bacs(v), s + v.sauvage), 0);
const stockDec = () => Object.values(S.dec.stock).reduce((s, x) => s + x, 0);
const surJ = (n, k) => S.dec.jours.slice(-n).reduce((s, j) => s + j[k], 0);
function tauxDec(n = 30) {
  const so = surJ(n, 'vendu') + surJ(n, 'compost') + surJ(n, 'energie') + surJ(n, 'enfoui') + surJ(n, 'export');
  return { recyclage: so ? (surJ(n, 'vendu') + surJ(n, 'compost')) / so : 0, valorisation: so ? (surJ(n, 'vendu') + surJ(n, 'compost') + surJ(n, 'energie')) / so : 0, sortie: so };
}
function etatDecharges() {
  const ds = UNITES.filter(u => u.type === 'decharge' && !u.fin), vol = ds.reduce((s, u) => s + TYPES.decharge.volume, 0), rem = ds.reduce((s, u) => s + (u.rempli || 0), 0);
  const parJour = surJ(30, 'enfoui') / Math.max(1, Math.min(30, S.dec.jours.length));
  return { taux: vol ? rem / vol : 1, reste: vol - rem, ans: parJour > 0 ? (vol - rem) / parJour / 365 : Infinity };
}
// trajet d'un camion : du dépôt au quartier, puis au lieu de vidage (le site, ou un quai de transfert plus proche) ; plus c'est loin, moins il collecte
const procheDe = (v, us) => (us.length ? Math.min(...us.map(u => Math.min(...v.tuiles.map(t => dist(t, u.t))))) : null);
function trajetVille(v, dest = UNITES.some(u => u.type === 'incin' && !u.fin) ? 'incin' : 'decharge') {
  const ok = ty => UNITES.filter(u => u.type === ty && !u.fin && !(u.panne > S.min));
  const dg = procheDe(v, ok('garage')) ?? 8, ds = procheDe(v, ok(dest)) ?? 6, dq = procheDe(v, ok('quai')), quai = dq !== null && dq < ds;
  return { dg, ds, dq, quai, vide: quai ? dq : ds, eff: 1 / (1 + .05 * (dg + (quai ? dq : ds))) };
}
const prodEstimee = v => v.decProd ?? v.hab * interp(KG_HAB, annee(S.min)) / 365e3;
const besoinCamions = () => VILLES.reduce((s, v) => s + prodEstimee(v) * 7 / 6 / (capCamion() * trajetVille(v).eff), 0);
function bilanDec() {  // conservation de la matière
  const L = S.dec.L, ou = L.vendu + stockDec() + L.compost + L.energie + L.enfoui + L.export + VILLES.reduce((s, v) => s + Object.values(bacs(v)).reduce((a, x) => a + x, 0), 0) + sauvageTotal();
  return { prod: L.prod, ou, ecart: Math.abs(L.prod - ou) };
}
// nuisance ressentie par une ville : sites de déchets à moins de 3 hexagones, d'autant plus gênants qu'ils sont proches ; les améliorations la réduisent
const nuisU = u => TYPES[u.type].nuis * (amel(u, 'biogaz') ? .5 : 1) * (amel(u, 'fumees') ? .4 : 1) * (amel(u, 'ferme') ? .3 : 1) * (1 + .5 * vieux(u)) * (S.evt.canicule > S.min ? 1.5 : 1);  // vieux sites et canicule : plus d'odeurs
const nuisVille = v => UNITES.reduce((s, u) => { if (!estDecU(u) || !TYPES[u.type].nuis || u.fin) return s; const d = Math.min(...v.tuiles.map(x => dist(x, u.t))); return d <= 3 ? s + nuisU(u) * (1 - (d - 1) / 3) : s; }, 0);
const nuisHex = t => UNITES.reduce((s, u) => { if (!estDecU(u) || !TYPES[u.type].nuis) return s; const d = dist(t, u.t); return d <= 3 ? s + nuisU(u) * (1 - d / 4) : s; }, 0);
// boues d'épuration : environ 1,5 kg par m³ épuré, trois fois moins si la station les déshydrate
const partSechage = () => { const ep = UNITES.filter(u => estEauU(u) && TYPES[u.type].role === 'epuration' && !u.fin), tot = ep.reduce((s, u) => s + ehU(u), 0); return tot ? ep.filter(u => amel(u, 'sechage')).reduce((s, u) => s + ehU(u), 0) / tot : 0; };
const lixiviats = (u, w) => (u.rempli || 0) * 3e-5 * w.debit;  // m³ d'eau polluée par pas de 15 minutes, comme des eaux usées non épurées : une décharge pleine pollue comme une petite ville
const bouesJour = () => VILLES.reduce((s, v) => s + (v.traite || 0), 0) * 96 * 1.5e-3 * (1 - 2 / 3 * partSechage());

function jourDechets(m) {
  const D = S.dec, a = annee(m), K = kDec(a), d0 = date(m), mo = d0.getUTCMonth(), dow = d0.getUTCDay();
  const J = { prod: 0, boues: 0, collecte: 0, vendu: 0, compost: 0, energie: 0, enfoui: 0, export: 0, sauvage: 0, manque: 0, triIn: 0, refus: 0, recettes: 0, depenses: 0 };
  const L = {}, lien = (x, y, t) => { if (t > 1e-9) L[x + '>' + y] = (L[x + '>' + y] || 0) + t; };
  const payer = x => { J.depenses += x; }, encaisser = x => { J.recettes += x; };
  const actifs = ty => UNITES.filter(u => u.type === ty && !u.fin && !(u.panne > m));
  const capAl = ty => actifs(ty).reduce((s, u) => s + capDec(u) * alimente(u), 0);  // sans électricité, un site s'arrête (coupure en cascade)
  const cap = { tri: capAl('tri'), compost: capAl('compost'), incin: capAl('incin'), metha: capAl('metha') }, cap0 = { ...cap }, renfort = D.renfort > m;
  const decheterie = actifs('decheterie').length > 0, greve = D.greve > m, canicule = S.evt.canicule > m, tempete = S.evt.tempete > m;
  const camp = D.campagne > m ? .08 : 0, inc = rd('incitative') ? 1 : 0, qualite = .76 + camp + inc * .04;  // part des objets bien triés dans le bac jaune
  const tri = { emb: D.modes.emb ? .55 + camp + inc * .15 : 0, verre: D.modes.verre ? .72 + inc * .1 : 0, bio: D.modes.bio ? .48 + camp / 2 + inc * .12 : 0 };
  const p0 = { emb: interp(PART_D.emb, a), verre: interp(PART_D.verre, a), bio: interp(PART_D.bio, a), enc: interp(PART_D.enc, a) }; p0.res = 1 - p0.emb - p0.verre - p0.bio - p0.enc;
  const fac = { bio: 1 + .35 * (Math.exp(-(((mo - 4) / 1.2) ** 2)) + Math.exp(-(((mo - 9.5) / 1) ** 2))), emb: mo === 11 ? 1.2 : 1, enc: tempete ? 3 : 1 };  // tontes, feuilles, fêtes de fin d'année, tempêtes
  const rue = (v, f, x) => { v.sauvage += x; J.sauvage += x; lien(f, 'sauvage', x); };
  // 1. production et dépôt dans les bacs
  for (const v of VILLES) {
    const B = bacs(v), ind = v.tuiles.filter(t => t.quartier === 'industriel').length * 4 * (.3 + .7 * indusEau(a));
    const tot = (v.hab * interp(KG_HAB, a) / 365e3 + ind) * facFete(m, 'dec'), p = {};  // fêtes et vacances
    for (const f of FLUX_D) p[f] = tot * p0[f] * (fac[f] || 1);
    const prod = FLUX_D.reduce((s, f) => s + p[f], 0); J.prod += prod; D.L.prod += prod; v.decProd = prod;
    const verts = decheterie ? p.bio * .15 : 0;  // déchets verts apportés en déchèterie
    const dans = { res: p.res + p.emb * (1 - tri.emb) + p.verre * (1 - tri.verre) + (p.bio - verts) * (1 - tri.bio), emb: p.emb * tri.emb, verre: p.verre * tri.verre, bio: (p.bio - verts) * tri.bio };
    const err = Math.min(dans.res * .5, dans.emb * (1 - qualite) / qualite); dans.res -= err; dans.emb += err;  // erreurs de tri : des résiduels dans le bac jaune
    if (decheterie) { v.versDech = p.enc * .85; dans.res += p.enc * .15; } else { v.versDech = 0; dans.res += p.enc * .85; rue(v, 'enc', p.enc * .15); }  // sans déchèterie, une partie des encombrants finit sur les trottoirs
    v.verts = verts;
    if (inc) { const x = dans.res * .03; dans.res -= x; rue(v, 'res', x); }  // la redevance au poids pousse certains à jeter dehors
    v.deborde = false;
    for (const f of ['res', 'emb', 'verre', 'bio']) {
      v.moy[f] = v.moy[f] * .9 + dans[f] * .1; B[f] += dans[f];
      const capB = CAPJ_D[f] * Math.max(v.moy[f], .02) * (canicule && (f === 'bio' || f === 'res') ? .75 : 1) * (renfort ? 1.5 : 1);  // bacs en plus loués pour la saison
      if (B[f] > capB) { rue(v, f, B[f] - capB); B[f] = capB; v.deborde = true; }
    }
  }
  // 2. collecte du lundi au samedi : avec f passages par semaine, les camions vident chaque jour f/6 des bacs ; capT compte les camions encore libres
  const par = { res: 0, emb: 0, verre: 0, bio: 0 }, vers = f => (f === 'res' ? (cap.incin ? 'incin' : 'decharge') : f === 'emb' ? (cap.tri ? 'tri' : 'decharge') : f === 'bio' ? (cap.metha ? 'metha' : cap.compost ? 'compost' : 'decharge') : 'decheterie');
  let capT = (greve ? (S.crise ? .5 : 0) : 1) * D.camions * (renfort ? 1.3 : 1);  // en grève, seuls les camions de réserve du plan de crise roulent
  if (dow !== 0) for (const f of ['res', 'bio', 'emb', 'verre']) {
    const fr = D.modes[f]; if (!fr) continue;
    const poids = 1 + .06 * (fr - 2);  // des passages fréquents remplissent moins les camions
    for (const v of [...VILLES].sort((x, y) => bacs(y)[f] - bacs(x)[f])) {
      const tr = trajetVille(v, vers(f)), tpc = capCamion(a) * tr.eff, B = bacs(v), voulu = B[f] * Math.min(1, fr / 6), x = Math.min(voulu, capT * tpc / poids);
      if (x < voulu - 1e-9) J.manque += voulu - x;
      if (x <= 0) continue;
      B[f] -= x; capT -= x * poids / tpc; J.collecte += x; par[f] += x;
      payer(x * (Math.max(1, tr.vide) * 1.5 + (tr.quai ? (tr.ds - tr.dq) * .5 : 0)) * K * (rd('tournees') ? .85 : 1));  // après un quai, de gros porteurs font le reste du trajet pour moins cher
    }
  }
  payer(D.camions * coutCamion(a) / 365 + (actifs('garage').length * TYPES.garage.fixe + actifs('quai').length * TYPES.quai.fixe) * K / 365);
  // usure des équipages : des tournées trop chargées et le travail de nuit fatiguent, et les équipages fatigués font grève
  if (dow !== 0 && !greve) { const util = D.camions ? 1 - capT / D.camions : 0; D.usure = clamp(D.usure + (.004 * (util - .8) + (D.nuit ? .0015 : 0)) * (rd('ergonomie') ? .5 : 1), 0, 1); }
  // 3. traitement : incinérateur, puis décharge, puis export d'urgence vers une autre région
  function eliminer(src, t, brulable = true) {
    const col0 = src in NOM_FLUX_D, via = (inst, dest, x) => { if (col0) { lien(src, inst, x); lien(inst, dest, x); } else lien(src, dest, x); };
    if (brulable && cap.incin > 0) { const x = Math.min(t, cap.incin); cap.incin -= x; t -= x; J.energie += x; D.L.energie += x; via('incin', 'energie', x); payer(x * (TYPES.incin.opexT * K + tgap(a) / 3)); if (rd('chaleur')) encaisser(x * 25 * K); }
    for (const u of actifs('decharge')) { if (t <= 0) break; const x = Math.min(t, TYPES.decharge.volume - (u.rempli || 0)); if (x <= 0) continue; u.rempli = (u.rempli || 0) + x; t -= x; J.enfoui += x; D.L.enfoui += x; via('decharge', 'enfoui', x); payer(x * (TYPES.decharge.opexT * K + tgap(a))); }
    if (t > 0) { J.export += t; D.L.export += t; via('export', 'enfoui', t); payer(t * 165 * K); if (!D.alerteExport) { D.alerteExport = true; log('Décharges pleines : les déchets partent en export d’urgence vers une autre région, à prix d’or. Ouvrez une décharge ou un incinérateur.', 'mauvais'); toast('Décharges pleines : export d’urgence des déchets.'); } }
    else D.alerteExport = false;
  }
  function matiere(k, t) {
    if (D.vendre[k]) { encaisser(t * D.prix[k] * K); D.L.vendu += t; }
    else { D.stock[k] += t; const exc = stockDec() - 5000; if (exc > 0) { D.stock[k] -= exc; encaisser(exc * D.prix[k] * K); D.L.vendu += exc; } }  // stock limité à 5 000 t
    J.vendu += t;
  }
  if (par.emb > 0) {
    const x = Math.min(par.emb, cap.tri); cap.tri -= x; J.triIn += x;
    if (x > 0) {
      const tauxRefus = clamp(1 - qualite + .04 - (rd('trisemi') ? .05 : 0) - (rd('optique') ? .05 : 0), .03, .6), refus = x * tauxRefus, bon = x - refus;
      J.refus += refus; lien('emb', 'tri', x); lien('tri', 'recycle', bon); payer(x * TYPES.tri.opexT * K);
      matiere('papier', bon * .55); matiere('plastique', bon * .27); matiere('metal', bon * .18); eliminer('tri', refus);
    }
    if (par.emb - x > 0) eliminer('emb', par.emb - x);
  }
  if (par.verre > 0) { lien('verre', 'verrier', par.verre); lien('verrier', 'recycle', par.verre); matiere('verre', par.verre); }
  // biodéchets puis boues d'épuration : méthaniseur (biogaz et électricité), compost, sinon élimination
  function organique(src, t) {
    const xm = Math.min(t, cap.metha); cap.metha -= xm; t -= xm;
    if (xm > 0) { J.compost += xm; D.L.compost += xm; lien(src, 'metha', xm); lien('metha', 'composte', xm); payer(xm * TYPES.metha.opexT * K); encaisser(xm * 6 * K); }  // le digestat est épandu
    const x = Math.min(t, cap.compost); cap.compost -= x; t -= x;
    if (x > 0) { J.compost += x; D.L.compost += x; lien(src, 'compost', x); lien('compost', 'composte', x); payer(x * TYPES.compost.opexT * K); encaisser(x * 4 * K); }
    if (t > 0) eliminer(src, t);
  }
  const verts = VILLES.reduce((s, v) => s + (v.verts || 0), 0), Bio = par.bio + verts;
  if (Bio > 0) organique('bio', Bio);
  const boues = bouesJour(); if (boues > 0) { J.prod += boues; J.boues = boues; D.L.prod += boues; organique('boues', boues); }
  const Dd = VILLES.reduce((s, v) => s + (v.versDech || 0), 0);
  if (Dd > 0) { lien('enc', 'decheterie', Dd); lien('decheterie', 'recycle', Dd * .45); matiere('materiaux', Dd * .45); eliminer('decheterie', Dd * .55, false); }
  payer(actifs('decheterie').length * TYPES.decheterie.fixe * K / 365);
  if (par.res > 0) eliminer('res', par.res);
  const [ddTraite, ddCout] = jourDangereux(m); payer(ddCout + coutSuivis() / 365 + (renfort ? renfortsCout() / 30 : 0)); J.dd = ddTraite;
  // propreté : les cantonniers ramassent 1 t/j par 50 000 habitants, la brigade trois fois plus ; les camions qui ont fini leur tournée ramassent le reste
  const popT = VILLES.reduce((s, v) => s + v.hab, 0);
  let reste = cantonniers() * (D.brigade ? 4 : 1) + (dow !== 0 ? capT * capCamion(a) * .7 : 0); payer(D.brigade ? brigadeCout() / 365 : 0);
  for (const v of [...VILLES].sort((x, y) => y.sauvage - x.sauvage)) { const x = Math.min(v.sauvage, reste); if (x > 0) { v.sauvage -= x; reste -= x; eliminer('sauvage', x); } }
  for (const u of UNITES) if (estDecU(u) && TYPES[u.type].tj) { const c = cap0[u.type]; u.q = c ? (c - cap[u.type]) * capDec(u) / c : 0; u.util = (u.util ?? 0) * .9 + (c ? 1 - cap[u.type] / c : 0) * .1; }
  // 4. redevance des ménages ; les professionnels paient au poids
  encaisser(popT * D.tarif * K / 365 + VILLES.reduce((s, v) => s + v.tuiles.filter(t => t.quartier === 'industriel').length, 0) * 4 * 110 * K);
  // 5. marché des matières recyclées : retour à la moyenne et petits chocs
  for (const k in MATIERES_D) { const base = MATIERES_D[k][1]; D.prix[k] = Math.max(base * .1, D.prix[k] + (base - D.prix[k]) * .01 + D.prix[k] * .022 * (alea() + alea() + alea() - 1.5) * 1.4); }
  // 6. historique, bilan matière, argent
  D.jours.push(J); if (D.jours.length > 30) D.jours.shift();
  D.liens.push(L); if (D.liens.length > 30) D.liens.shift();
  const b = bilanDec(); console.assert(b.ecart < 1e-6 * b.prod + 1e-6, 'bilan matière des déchets', b);
  const res = J.recettes - J.depenses; S.argent += res;
  for (const c of [S.jour, S.an]) Object.assign(c, { ventes: c.ventes + J.recettes, opex: c.opex + J.depenses, decV: c.decV + J.recettes, decO: c.decO + J.depenses, decP: c.decP + J.prod, decR: c.decR + J.vendu + J.compost, decE: c.decE + J.energie, decS: c.decS + J.vendu + J.compost + J.energie + J.enfoui + J.export });
  // 7. gêne ressentie : dépôts sauvages, bacs qui débordent, riverains des sites, prix
  const exig = clamp((a - 1900) / 70, .2, 1), hab = Math.max(1, popT);
  D.penD = { sauvage: Math.min(12, sauvageTotal() / (hab / 1000) * 3) * exig, debord: VILLES.filter(v => v.deborde).reduce((s, v) => s + v.hab, 0) / hab * 6 * exig,
    nuis: Math.min(4, VILLES.reduce((s, v) => s + nuisVille(v) * v.hab, 0) / hab) * exig, prix: Math.max(0, D.tarif - 110) * .15, passages: D.modes.res < 2 ? 3 : 0, bruit: a >= 1960 && !D.nuit ? 1.5 * (1 + partCentre()) : 0,
    centre: D.modes.res < 3 ? 2 * partCentre() * exig : 0, dangereux: a >= TYPES.dangereux.an ? Math.min(4, (D.dd || 0) / 400) : 0 };  // pas de reproche tant qu'aucun centre n'existe  // le centre-ville veut une collecte fréquente et silencieuse
  D.pen = Object.values(D.penD).reduce((s, x) => s + x, 0);
  evenementsDec(m);
}
function evenementsDec(m) {
  const D = S.dec, a = annee(m), dif = DIFF[S.diff].evt;
  if (D.greve && D.greve <= m) { D.greve = 0; log('Fin de la grève de la collecte : les tournées reprennent.', 'bon'); }
  if (!D.greve && a >= 1920 && alea() < .0008 * dif * (.4 + 3 * D.usure)) { D.greve = m + (3 + Math.floor(alea() * 5)) * 1440; D.usure = Math.max(0, D.usure - .3); log(`Grève des équipages de collecte jusqu’au ${dateTxt(D.greve)} : les bacs vont déborder.`, 'mauvais'); toast('Grève de la collecte des déchets !'); }
  const tri = UNITES.filter(u => u.type === 'tri' && !u.fin && !(u.panne > m));
  if (tri.length && alea() < .0006 * dif * (S.evt.canicule > m ? 5 : 1)) { const u = tri[Math.floor(alea() * tri.length)], c = 1e6 * kDec(a); u.panne = m + 30 * 1440; S.argent -= c; S.an.amendes += c; log(`Incendie au ${u.nom} : arrêt d’un mois, ${nf(c / 1e6, 1)} M€ de dégâts.`, 'mauvais'); toast(`Incendie au ${u.nom} !`); }
  if (a >= 1975 && alea() < .0008) { const k = alea() < .5 ? 'plastique' : 'papier'; D.prix[k] *= .35; log(`Effondrement du cours : ${MATIERES_D[k][0].toLowerCase()} à ${nf(D.prix[k] * kDec(a))} €/t. Stockez en attendant que le cours remonte (onglet Déchets).`, 'alerte'); }
  if (VILLES.length && alea() < .001 * dif) { const v = VILLES[Math.floor(alea() * VILLES.length)], x = Math.max(5, v.hab / 1e4); bacs(v); v.sauvage += x; D.L.prod += x; log(`Décharge sauvage découverte près de ${v.nom} (${nf(x)} t).`, 'alerte'); }
}
const cantonniers = () => 2 + VILLES.reduce((s, v) => s + v.hab, 0) / 5e4;  // t/j de dépôts sauvages ramassés sans brigade
const brigadeCout = () => (.15e6 + VILLES.reduce((s, v) => s + v.hab, 0) * 2) * kDec();  // € par an
const statsAnDec = a => ({ decVal: 100 * (a.decR + a.decE) / Math.max(1, a.decS), decRec: 100 * a.decR / Math.max(1, a.decS) });
// achats du joueur et du banc
function deployerMode(f) { const c = coutMode(f); if (!modeDispo(f) || S.dec.modes[f]) return 'Indisponible.'; S.argent -= c; S.an.capex += c; S.dec.modes[f] = f === 'bio' ? 2 : 1; log(`${NOM_FLUX_D[f]} : collecte déployée (${MODES_D[f].nom.toLowerCase()}, ${nf(c / 1e6, 1)} M€).`, 'bon'); return null; }
function changerCamions(n) {
  const D = S.dec; n = Math.max(1, Math.round(n)); const d = n - D.camions; if (!d) return;
  const c = d > 0 ? d * achatCamion() : d * achatCamion() * .3; S.argent -= c; if (d > 0) S.an.capex += c; D.camions = n; routesSale = true;
  log(d > 0 ? `${d} ${nomCamion()} achetés (${euros(c)}) : ${n} en service.` : `${-d} ${nomCamion()} revendus : ${n} en service.`);
}
