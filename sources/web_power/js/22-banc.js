"use strict";
// ============================================================ banc d'équilibrage : stratégies programmées, parties accélérées jusqu'en 2050
// Aucune IA : chaque stratégie applique des règles fixes une fois par mois de jeu, ce qui rend le banc reproductible.
const STRATS = {
  passif: { nom: 'Passif', desc: 'Ne construit rien : la région manque vite d’électricité, la partie doit être perdue.' },
  fossile: { nom: 'Fossile', desc: 'Charbon, puis fioul, puis gaz : suit la croissance au moindre coût, sans viser le bas carbone.', budget: .3, ferme: true, rd: ['fuites', 'cag', 'ozone', 'tasseuse', 'desulfu', 'lixiviats', 'desodo', 'selective', 'alerte', 'chaleur', 'boues', 'fumees', 'biogaz', 'ergonomie', 'biodechets', 'trisemi', 'denitr', 'membranes', 'maint', 'compteurs', 'locales', 'ccga', 'compens', 'scada', 'effac', 'tarifs', 'htls'], ferme2: ['gaz', 'charbonG', 'fioul', 'charbon', 'tac', 'usine'] },
  vert: { nom: 'Bas carbone', desc: 'Hydraulique dès que possible, nucléaire à partir de 1974, puis renouvelables, stockage et petits réacteurs.', budget: 1, ferme: true, vert: true,
    rd: ['fuites', 'cag', 'ozone', 'tasseuse', 'desulfu', 'lixiviats', 'desodo', 'selective', 'alerte', 'chaleur', 'boues', 'fumees', 'biogaz', 'ergonomie', 'lownox', 'biodechets', 'trisemi', 'metha', 'tournees', 'incitative', 'optique', 'cyber', 'denitr', 'telerel', 'membranes', 'bioMB', 'reut', 'osmose', 'reversible', 'compens', 'tarifs', 'effac', 'scada', 'pales', 'maint', 'locales', 'volants', 'htls', 'ccga', 'epr', 'compteurs', 'li', 'offshore', 'dlr', 'previ', 'bifacial', 'b4h', 'sodium', 'gridf', 'smr', 'v2g', 'h2', 'ia', 'hvdc', 'fusion'], ferme2: ['smr', 'nucleaire', 'barrage', 'fil', 'biomasse', 'charbonG', 'charbon', 'usine', 'tac'] },
};
let BANC_ON = false;
const reserveBot = () => seuilFaillite() * .25;  // le robot garde une réserve avant de dépenser, sans attendre d'avoir le seuil de faillite en caisse
const CF = { fil: .55, solaire: .13, eolien: .27, offshore: .42, barrage: .45, biomasse: .7, nucleaire: .85, smr: .85, fusion: .85 };
function pointeEstimee(ans = 0) {
  const f = { res: 1.3, ter: .6, ind: 1, crit: 1 }; let p = 0;
  for (const v of VILLES) for (const t of v.tuiles) { const q = QUART[t.quartier]; p += q.mw * f[q.cat]; }
  return p * elec(annee(S.min) + ans) * DIFF[S.diff].k * ((CARTE && CARTE.demande) || 1);
}
function capFerme(sansCharbon) {
  let c = 0;
  for (const u of UNITES) { if (!u.dispo || (sansCharbon && estCharbon(u))) continue; c += u.cap * ({ fil: .35, solaire: 0, eolien: .05, offshore: .08, barrage: .6, batterie: FRONT_T ? .5 : .35 }[u.type] ?? (TYPES[u.type].mw ? .9 : 0)); }
  return c + capImport() * .8;
}
const energieBas = () => UNITES.reduce((a, u) => a + (u.dispo && CF[u.type] ? u.cap * CF[u.type] * (TYPES[u.type].f === 'eolien' ? u.t.vent / 6.5 : 1) : 0), 0) * 8760;
const postesB = () => UNITES.filter(u => u.type === 'poste');
const sousTension = t => COMP.has(t.k) || COMP.has(t.k + ':H') || COMP.has(t.k + ':B');
function relierA(t, kv, cibles = null) {  // vers les postes, ou, avant 1935, directement entre usines et villes
  const c = cibles || [...postesB().map(p => p.t), ...(kv <= 63 ? (t.ville ? UNITES.filter(u => TYPES[u.type].mw && !u.fin).map(u => u.t) : VILLES.map(v => v.centre)) : [])];
  for (const b of c.filter(b => b !== t).sort((a, b) => dist(a, t) - dist(b, t)).slice(0, 5)) { const l = acheterLigne(t, b, kv); if (typeof l !== 'string') return l; }
  return null;
}
function financer(besoin) { while (besoin > 0 && S.dette < detteMax()) { const m = besoin > taillePret() * 3e6 ? taillePret() * 5 : taillePret(); emprunter(m, 20); besoin -= m * 1e6; } return besoin <= 0; }
function siteBot(type) {
  const pot = TYPES[type].pot, centres = [...postesB().map(p => p.t), ...VILLES.map(v => v.centre)];
  const c = LISTE.filter(t => !raison(t, type)).map(t => ({ t, s: (pot === 'vent' ? t.vent : pot === 'soleil' ? t.soleil * 1.5 : 0) + t.accept / 30 - recours(t) * 3 - Math.min(20, ...centres.map(p => dist(p, t))) * .3 })).sort((a, b) => b.s - a.s);
  for (const { t } of c.slice(0, 6)) if (centres.some(p => chemin(t, p))) return t;
  return null;
}
function posteBot() {  // un poste 225/63 kV près de la plus grande ville, relié à elle en 63 kV
  if (S.argent < 40e6 && !financer(60e6)) return null;
  const v = [...VILLES].sort((a, b) => b.tuiles.length - a.tuiles.length)[0];
  const site = LISTE.filter(x => !raison(x, 'poste') && plat(x) && dist(x, v.centre) >= 2 && dist(x, v.centre) <= 3).sort((a, b) => hache(a.q, a.r, 3) - hache(b.q, b.r, 3))[0];
  if (!site || typeof acheterUnite(site, 'poste') === 'string') return null;
  acheterLigne(site, v.centre, 63); acheterLigne(site, v.centre, 63);
  const p = UNITES.filter(u => u.type === 'poste' && u.t !== site); if (p.length) relierA(site, 225, p.map(u => u.t));
  return site;
}
function construireBot(type) {
  if (!dispoType(type) || (TYPES[type].rd && !rd(TYPES[type].rd))) return false;
  const kv = kvDispo(TYPES[type].reseau);
  const t = siteBot(type); if (!t) return false;  // on ne s'endette qu'une fois l'emplacement trouvé
  const cout = coutType(type) * 1e6 * 1.15 + (kv >= 225 && !postesB().length ? 60e6 : 0);
  if (S.argent < cout && !financer(cout - S.argent + taillePret() * 1e6)) return false;
  if (kv >= 225 && !postesB().length && !posteBot()) return false;
  const u = acheterUnite(t, type); if (typeof u === 'string') return false;
  if (!relierA(t, kv)) log(`Banc : ${u.nom} n’a pas pu être raccordée.`, 'alerte');
  return true;
}
function reparerBot(suivi) {
  let n = 0;
  const kvV = kvDispo(63);
  if (busFront() && !LIGNES.some(l => l.a === FRONT_T || l.b === FRONT_T) && S.argent > reserveBot() + 60e6) {  // l'interconnexion sert de secours, seulement si on en a les moyens
    if (!postesB().length) posteBot();
    if (postesB().length) { relierA(FRONT_T, 225, postesB().map(p => p.t)); n++; }
  }
  for (const p of postesB()) if (!p.fin && !sousTension(p.t)) { const c = [...postesB().filter(q => q !== p && !q.fin && sousTension(q.t)).map(q => q.t)]; if (relierA(p.t, 225, c)) n++; }
  for (const v of VILLES) {
    if (n >= 3) break;
    const besoin = v.tuiles.reduce((a, t) => a + QUART[t.quartier].mw * { res: 1.3, ter: .6, ind: 1, crit: 1 }[QUART[t.quartier].cat], 0) * facteurDemande() * 1.5;
    const ls = LIGNES.filter(l => (l.a === v.centre || l.b === v.centre) && !(l.hs > S.min)), caps = ls.map(capLigne);
    if (!ls.length || caps.reduce((a, c) => a + c, 0) - Math.max(...caps) < besoin || !v.servie) {
      if (S.argent < 0) financer(taillePret() * 1e6);
      const sources = [...postesB().filter(p => !p.fin && sousTension(p.t)).map(p => p.t), ...UNITES.filter(u => TYPES[u.type].mw && !u.fin && sousTension(u.t) && u.cap <= KV[kvV].cap).map(u => u.t)];
      if (relierA(v.centre, kvV, sources)) { n++; continue; }
      if (dispoType('poste')) { const site = LISTE.filter(x => !raison(x, 'poste') && dist(x, v.centre) >= 1 && dist(x, v.centre) <= 3).sort((a, b) => dist(a, v.centre) - dist(b, v.centre))[0];
        if (site && typeof acheterUnite(site, 'poste') !== 'string') { relierA(site, 225, postesB().filter(p => p.t !== site && sousTension(p.t)).map(p => p.t)); acheterLigne(site, v.centre, 63); acheterLigne(site, v.centre, 63); n++; } }
    }
  }
  for (const [b, tx] of suivi) {
    if (n >= 6 || tx < .92 || !BR.includes(b)) continue;
    if (S.argent < 0) financer(taillePret() * 1e6);
    if (b.type === 'L') {  // une ligne saturée est doublée ; une ligne 15 kV saturée est remplacée par du 63 kV
      const kv = b.kv <= 15 && kvV > 15 ? kvV : b.kv, a = b.a, c = b.b;
      if (kv !== b.kv) demolirLigne(b, true);
      if (typeof acheterLigne(a, c, kv) !== 'string') n++; continue;
    }
    const t = b.u.t, v = VILLES.filter(v => LIGNES.some(l => (l.a === t && l.b === v.centre) || (l.b === t && l.a === v.centre))).sort((x, y) => (y.dem || 0) - (x.dem || 0))[0];
    if (!v) continue;
    const site = LISTE.filter(x => !raison(x, 'poste') && plat(x) && dist(x, v.centre) >= 2 && dist(x, v.centre) <= 3).sort((x, y) => dist(x, t) - dist(y, t))[0];
    if (!site || typeof acheterUnite(site, 'poste') === 'string') continue;
    acheterLigne(site, t, 225); acheterLigne(site, v.centre, 63); acheterLigne(site, v.centre, 63); n++;
  }
  suivi.clear();
}
// eau pour le banc : chaque ville reçoit un captage, un château d'eau, puis une épuration, et les usines suivent les normes
function siteEau(type, v, dmax = 5) {  // on laisse libre la couronne autour de la ville pour qu'elle puisse grandir
  const d = t => Math.min(...v.tuiles.map(x => dist(x, t))), cout = t => (d(t) < 2 ? 10 : d(t)) + (SITES.includes(t) ? 20 : 0);
  return LISTE.filter(t => !raison(t, type) && d(t) <= dmax && cheminEau(t, v.centre, 'p')).sort((a, b) => cout(a) - cout(b) || b.accept - a.accept)[0] || null;
}
function acheterEau(type, v, dmax = 5) {
  const t = siteEau(type, v, dmax); if (!t) return null;
  const c = coutType(type) * 1e6; if (S.argent < c && !financer(c - S.argent + taillePret() * 1e6)) return null;
  const u = acheterUnite(t, type); return typeof u === 'string' ? null : u;
}
function relierEau(u, v, type) { const p = cheminEau(u.t, v.tuiles.slice().sort((a, b) => dist(a, u.t) - dist(b, u.t))[0], FAM[type]); if (!p) return false; S.argent -= (p.length - 1) * COUT_TUYAU[FAM[type]] * 1e6; poserConduite(null, null, type, p); return true; }
function botPollution() {  // comme un joueur attentif : on coupe les captages touchés par une pollution, on les rouvre après
  for (const u of UNITES) if (TYPES[u.type].role === 'captage') { const t = touche0(u); if (t && u.dispo !== false) { u.dispo = false; u.coupeBot = true; } else if (!t && u.coupeBot) { u.dispo = true; u.coupeBot = false; } }
}
function botEau() {
  const a = annee(S.min);
  for (const v of VILLES) {
    const C = v.res, besoin = (v.m3d || 0) * 96 * 1.35 / (1 - (C?.fuite || .1));
    const capJ = C ? Math.min(C.unites.filter(u => TYPES[u.type].role === 'captage').reduce((s, u) => s + TYPES[u.type].m3, 0), (C.dispo || 0) * 96 * 1.1) : 0;  // un forage sur une nappe vide ne compte plus
    const enCours = UNITES.some(u => u.fin && estEauU(u) && Math.min(...v.tuiles.map(x => dist(x, u.t))) <= 5);
    if (capJ < besoin && !enCours) {
      let u = null;
      const nappeOk = S.eau.nappe > .45, profOk = S.eau.profonde > .5 && UNITES.filter(x => x.type === 'forageP').length < 3;
      if ((besoin - capJ > 4000 || !nappeOk) && dispoType('potab')) { u = acheterEau('prise', v, 8); if (u) { const p = acheterEau('potab', v); if (p) { relierEau(u, v, 'brute'); relierEau(p, v, 'potable'); u = p; } } }
      u = u || (nappeOk && acheterEau('forage', v)) || (profOk && dispoType('forageP') && acheterEau('forageP', v)) || acheterEau('source', v) || (dispoType('dessal') && acheterEau('dessal', v, 4)) || (!dispoType('potab') && acheterEau('forage', v));
      if (u && u.type !== 'potab') relierEau(u, v, 'potable');
    }
    if (C && !C.pression && !enCours) { const s = acheterEau('chateau', v, 2); if (s) relierEau(s, v, 'potable'); }
    if (C && C.volMax && C.volMax < besoin * .15 && !enCours) { const s = acheterEau('chateau', v, 2); if (s) relierEau(s, v, 'potable'); }
    // assainissement : lagunage pour les petites villes, station d'épuration dès 1950
    const E = v.egout, capE = E ? E.unites.reduce((s, u) => s + ehU(u), 0) : 0;
    if (capE < v.hab * 1.1 && !UNITES.some(u => u.fin && TYPES[u.type].role === 'epuration')) {  // avant 1950, seuls les petits villages ont un lagunage
      const ep = a >= 1950 && v.hab > 8000 ? acheterEau('step', v) : v.hab <= 8000 && !capE ? acheterEau('lagunage', v, 3) : null;
      if (ep) relierEau(ep, v, 'usee');
    }
    // traitement : on ajoute l'étape qui corrige le défaut
    if (C && !C.conf) for (const p of C.unites.filter(u => u.type === 'potab' && !u.fin)) {
      const k = Object.keys(ETAPES).find(k => !(p.etapes || []).includes(k) && etapeOk(k)); if (k) ajouterEtape(p, k);
    }
    if (rd('reut') && E) for (const u of E.unites.filter(u => u.type === 'step' && !u.fin && !u.reut)) if (S.argent > REUT.step[1] * 1e6 + reserveBot()) equiperReut(u);
  }
  if (vieilles().length > 12 && S.argent > coutRenouv() + reserveBot()) renouveler();
}
function botDechets() {  // en gestionnaire prudent : flotte au besoin, décharge d'avance, puis tri, compost et incinération
  const D = S.dec, a = annee(S.min), n = Math.max(1, Math.min(30, D.jours.length)), p = surJ(30, 'prod') / n, nb = ty => UNITES.filter(u => u.type === ty).length, enCours = ty => UNITES.some(u => u.type === ty && u.fin);
  const cible = Math.ceil(besoinCamions() * 1.15); if (D.jours.length >= 7 && (D.camions < cible || D.camions > cible + 2)) changerCamions(cible);
  const poser = ty => { const t = LISTE.filter(x => !raison(x, ty) && Math.min(...VILLES.map(v => dist(v.centre, x))) <= 7).sort((x, y) => Math.min(...VILLES.map(v => dist(v.centre, x))) - Math.min(...VILLES.map(v => dist(v.centre, y))) || hache(x.q, x.r, 16) - hache(y.q, y.r, 16))[0]; return t && typeof acheterUnite(t, ty) !== 'string'; };
  const de = etatDecharges();
  if (de.ans < 4 && !enCours('decharge')) poser('decharge');
  if (dispoType('decheterie') && !nb('decheterie')) poser('decheterie');
  for (const f of ['verre', 'emb', 'bio']) if (!D.modes[f] && modeDispo(f) && S.argent > coutMode(f) + reserveBot()) deployerMode(f);
  if (D.modes.emb && nb('tri') * capTri() < p * .2 && !enCours('tri')) poser('tri');
  if (dispoType('compost') && nb('compost') * TYPES.compost.tj < p * (D.modes.bio ? .12 : .03) && !enCours('compost')) poser('compost');
  if (!nb('garage')) poser('garage');
  if ((D.dd || 0) > 50 && dispoType('dangereux') && !nb('dangereux')) poser('dangereux');
  for (const u of UNITES) if (usureU(u) > 1.1 && !['frontiere', 'poste'].includes(u.type) && S.argent > coutRenov(u) * 1e6 + reserveBot()) renover(u);  // le banc rénove ce qui a dépassé sa durée de vie
  if (rd('metha') && nb('metha') * TYPES.metha.tj < p * .1 && !enCours('metha')) poser('metha');
  for (const u of UNITES) for (const k of amelPour(u)) if (!amel(u, k) && amelDispo(k) && !u.fin && S.argent > AMELIO[k].cout(u) * 1e6 + reserveBot()) ameliorer(u, k);  // le banc équipe ses bâtiments dès que possible
  if (dispoType('incin') && nb('incin') * TYPES.incin.tj < p * .45 && !enCours('incin') && (a >= 1975 || de.ans < 6) && S.argent > coutType('incin') * 1e6 + reserveBot()) poser('incin');
}
function ajouterEtape(u, k) {
  const e = ETAPES[k]; if (!u.etapes) u.etapes = ['sable']; if (u.etapes.includes(k) || !etapeOk(k)) return 'Étape indisponible.';
  S.argent -= e.cout * 1e6; S.an.capex += e.cout * 1e6; u.etapes.push(k); log(`${u.nom} : nouvelle étape « ${e.nom} » (${e.cout} M€).`, 'bon'); return null;
}
function botMois(st, suivi) {
  if (!st.rd) return;
  const an = annee(S.min), mo = date(S.min).getUTCMonth();
  S.rd.budget = Math.max(1, Math.round(st.budget * pointeEstimee() / 10));  // budget de recherche proportionnel à la taille du réseau
  if (!S.rd.cours) { const r = st.rd.map(id => RDI[id]).find(r => r && rdDispo(r)); if (r) { S.rd.cours = r.id; S.rd.avance = 0; } }
  if (rd('effac')) S.effacement = S.delestage > 0 || marge() < 60;
  reparerBot(suivi); botEau(); botDechets();
  const ch = UNITES.find(estCharbon);
  if (ch && st.ferme && (an > 2031 || (an === 2031 && mo >= 6) || (an >= 2026 && capFerme(true) > pointeEstimee(1) * 1.2))) fermer(ch);
  const plusGros = Math.max(0, ...UNITES.filter(u => TYPES[u.type].mw && !TYPES[u.type].fatal).map(u => u.cap));  // on garde de quoi perdre la plus grosse centrale
  const pe = pointeEstimee(2), besoin = pe * 1.1 + plusGros * .9 - capFerme(st.ferme && an >= 2026);
  const tropGros = ty => TYPES[ty].mw > Math.max(pe * .6, 15) && st.ferme2.some(x => x !== ty && dispoType(x) && (!TYPES[x].rd || rd(TYPES[x].rd)) && TYPES[x].mw <= Math.max(pe * .6, 15));  // pas de groupe démesuré
  if (besoin > 0) for (const ty of st.ferme2) { if (tropGros(ty)) continue; if (construireBot(ty)) break; }
  if (st.vert && an >= 1974) {
    const cible = clamp(.35 + (an - 2027) * .045, .3, .96), mesure = (S.rapports.at(-1)?.bas ?? 35) / 100, Edem = pointeEstimee(0) * .62 * 8760;
    const nb = an < 1996 ? 0 : mesure < cible - .1 ? 2 : mesure < cible ? 1 : 0;  // on mesure la part bas carbone réelle de l'année passée
    // un réacteur à la fois tant que la part bas carbone reste sous 90 %, s'il ne dépasse pas la pointe et si la dette reste sous la moitié du plafond ;
    // il passe avant les renouvelables, qui sinon prennent toute la capacité d'emprunt et les sites au bord de l'eau
    const financable = ty => S.dette + Math.max(0, coutType(ty) * 1.15e6 - S.argent) <= detteMax() * .5;
    if (mesure < .9 && !UNITES.some(u => (u.type === 'smr' || u.type === 'nucleaire') && u.fin)) for (const ty of ['smr', 'nucleaire']) if (TYPES[ty].mw <= pe * .9 && financable(ty) && construireBot(ty)) break;
    for (let k = 0; k < nb && energieBas() < (FRONT_T ? 1.8 : 1.15) * Edem; k++)  // sans export possible, la surproduction est perdue
      if (!['offshore', 'eolien', 'solaire'].some(construireBot)) break;
    const ren = UNITES.filter(u => TYPES[u.type].fatal && u.type !== 'fil').reduce((a, u) => a + u.cap, 0), bat = UNITES.filter(u => u.type === 'batterie').reduce((a, u) => a + u.cap, 0);
    if (ren > pointeEstimee(0) * .5 && bat < ren * .35) construireBot('batterie');
  }
}
async function bancPartie(carte, diff, strat, graine) {
  BANC_ON = true; S.pause = true;
  nouvellePartie(diff, carteDef(carte, graine));
  S.pause = true;
  const st = STRATS[strat], suivi = new Map(), t0 = performance.now(); let jours = 0;
  S.min = Math.ceil(S.min / 15) * 15;
  const villesKO = VILLES.filter(v => !v.servie).map(v => v.nom);
  while (!S.fini && annee(S.min) < 2050) {
    S.imb = integrer(15); S.min += 15; pas(S.min);
    for (const b of BR) if (actifB(b) || b.hs > S.min) suivi.set(b, Math.max(suivi.get(b) || 0, actifB(b) ? b.taux : 1.2));
    if (Math.abs(heure(S.min)) < .01) { jours++; if (st.rd) botPollution(); if (jours % 30 === 0) botMois(st, suivi); if (jours % 120 === 0) { bancEtat?.(`${CARTE.nom} · ${DIFF[diff].nom} · ${st.nom} · ${annee(S.min)}`); await new Promise(r => setTimeout(r, 0)); } }
  }
  const r49 = S.rapports.at(-1) || {}, compte = {};
  for (const u of UNITES) compte[u.type] = (compte[u.type] || 0) + 1;
  return { carte: CARTE.nom, carteId: carte, graine: CARTE.graine, diff, strat, issue: S.fini || 'en cours', fin: dateTxt(S.min), duree: Math.round((performance.now() - t0) / 1000),
    argent: Math.round(S.argent / 1e6), dette: Math.round(S.dette / 1e6), sat: Math.round(S.sat), villesKO, compte, lignes: LIGNES.length, objectifs: OBJ.map(([n, f]) => [n, !!f(r49)]),
    rapports: S.rapports.map(r => ({ an: r.an, bas: Math.round(r.bas), co2: Math.round(r.co2), coupure: Math.round(r.coupure * 10) / 10, res: Math.round(r.res / 1e6), sat: Math.round(r.sat), pointe: Math.round(r.pointe), capex: Math.round(r.capex / 1e6), eau: Math.round(r.eauServi ?? 0), conf: Math.round(r.eauConf ?? 0), epure: Math.round(r.eauEpure ?? 0), crises: r.crises, acc: r.acc, decVal: Math.round(r.decVal ?? 0), decRec: Math.round(r.decRec ?? 0) })) };
}
let bancEtat = null;
const ISSUES = { victoire: ['Victoire', 'vert'], echec: ['Objectifs manqués', 'or'], faillite: ['Faillite', 'rouge'], revocation: ['Révocation', 'rouge'] };
let bancSel = { cartes: ['valmont'], diffs: ['normal'], strats: ['passif', 'fossile', 'vert'] }, bancRes = [];
function menuBanc() {
  const tog = (k, v, n) => `<button type="button" data-act="banc-sel" data-k="${k}" data-id="${v}" class="${bancSel[k].includes(v) ? 'actif' : ''}">${n}</button>`;
  const nb = bancSel.cartes.length * bancSel.diffs.length * bancSel.strats.length;
  modale(`<h2 id="modale-titre">Banc d’équilibrage</h2><p>Le banc joue des campagnes complètes de 1900 à 2050 avec des stratégies programmées, sans affichage, puis compare les résultats. Comptez quelques minutes par partie.</p>
    <div class="section" style="margin-top:0">Cartes</div><div class="choix-l">${Object.entries(CARTES).map(([k, c]) => tog('cartes', k, c.nom)).join('')}${tog('cartes', 'aleatoire', 'Aléatoire')}</div>
    <div class="section" style="margin-top:0">Difficultés</div><div class="choix-l">${Object.entries(DIFF).map(([k, d]) => tog('diffs', k, d.nom)).join('')}</div>
    <div class="section" style="margin-top:0">Stratégies</div><div class="choix-l">${Object.entries(STRATS).map(([k, s]) => tog('strats', k, s.nom)).join('')}</div>
    <p class="verrou">${Object.values(STRATS).map(s => `${s.nom} : ${s.desc}`).join('<br>')}</p>
    <button type="button" class="btn" data-act="banc-go" ${nb ? '' : 'disabled'}>Lancer ${nb} partie${nb > 1 ? 's' : ''}</button>
    ${bancRes.length ? '<button type="button" class="btn secondaire" data-act="banc-voir">Derniers résultats</button>' : ''}
    <button type="button" class="btn secondaire" data-act="menu">Retour</button>`);
}
function tableBanc(res) {
  return `<div style="overflow-x:auto"><table class="tab"><thead><tr><th>Partie</th><th>Issue</th><th>Bas carbone 2049</th><th>Coupure moy.</th><th>Trésorerie</th><th>Satisf.</th></tr></thead><tbody>
    ${res.map(r => { const [n, c] = ISSUES[r.issue] || [r.issue, '']; const rs = r.rapports, coup = rs.reduce((a, x) => a + x.coupure, 0) / Math.max(1, rs.length);
      return `<tr><td>${r.carte}<br><small>${DIFF[r.diff].nom} · ${STRATS[r.strat].nom}</small></td><td><span class="chip ${c}">${n}</span><br><small>${r.fin}</small></td><td>${rs.at(-1)?.bas ?? '—'} %</td><td>${nf(coup, 1)} min</td><td>${nf(r.argent)} M€<br><small>dette ${nf(r.dette)}</small></td><td>${r.sat} %</td></tr>`; }).join('')}</tbody></table></div>`;
}
function voirBanc() {
  modale(`<h2 id="modale-titre">Résultats du banc</h2>${tableBanc(bancRes)}
    <button type="button" class="btn secondaire" data-act="banc-copier">Copier les résultats détaillés (JSON)</button>
    <button type="button" class="btn secondaire" data-act="banc">Nouveau banc</button><button type="button" class="btn" data-act="menu">Retour au menu</button>`);
}
async function lancerBanc() {
  if (S.enJeu) sauver();
  const runs = []; for (const c of bancSel.cartes) for (const d of bancSel.diffs) for (const s of bancSel.strats) runs.push([c, d, s, c === 'aleatoire' ? 1001 : undefined]);
  bancRes = [];
  for (const [i, run] of runs.entries()) {
    bancEtat = txt => { modale(`<h2 id="modale-titre">Banc en cours · partie ${i + 1} sur ${runs.length}</h2><p>${txt}</p>${bancRes.length ? tableBanc(bancRes) : ''}`); };
    bancEtat('Préparation…');
    bancRes.push(await bancPartie(...run));
  }
  BANC_ON = false; S.enJeu = false; bancEtat = null;
  voirBanc();
}
