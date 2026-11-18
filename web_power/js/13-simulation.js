"use strict";
// ============================================================ un pas de 15 minutes : économie, sécurité, événements
function pas(m, silencieux = false) {
  dispatch(m);
  if (silencieux) for (const u of [...UNITES, IMP]) u.p = actifU(u) ? u.c : 0;
  const D = S.D, prod = {}, tot = Math.max(1, UNITES.reduce((a, u) => a + (actifU(u) ? Math.max(0, u.p) : 0), 0) + Math.max(0, IMP.p));
  for (const u of UNITES) if (actifU(u) && TYPES[u.type].f) prod[TYPES[u.type].f] = (prod[TYPES[u.type].f] || 0) + u.p;
  prod.import = IMP.p;
  const co2 = (UNITES.reduce((a, u) => a + (actifU(u) ? Math.max(0, u.p) * co2U(u) : 0), 0) + Math.max(0, IMP.p) * 80) / tot;
  S.hist.push({ m, prod, charge: S.charge + S.pertes, dem: S.demTot + S.pertes, co2, spot: S.spot }); if (S.hist.length > 96) S.hist.shift();
  // économie du pas (0,25 h)
  const kd = S.demServie > 0 ? clamp(1 - S.delestage / S.demServie, 0, 1) : 0, sv = c => D.villes.filter(x => x.v.servie).reduce((a, x) => a + x[c], 0) * kd;
  const e = S.charge * .25, eDist = .25 * (sv('res') + sv('ter') + sv('crit')), ventes = .25 * (sv('res') * S.tarif.res + (sv('ter') + sv('crit')) * S.tarif.ter + sv('ind') * S.tarif.ind) * (CARTE.tarifK || 1) * tarifEre(annee(m));
  const comb = UNITES.reduce((a, u) => a + (actifU(u) && u.p > 0 ? u.p * .25 * (u.type === 'barrage' ? 2 : prixCombustible(u.type, annee(m)) * (S.evt.gaz > m && (u.type === 'gaz' || u.type === 'tac') ? 1.6 : 1) * (u.type === 'gaz' && rd('ccga') ? .9 : 1)) : 0), 0);
  const carbone = UNITES.reduce((a, u) => a + (actifU(u) ? Math.max(0, u.p) * .25 * co2U(u) / 1e3 : 0), 0) * prixCO2();
  const pv = prixVoisin(m), imp = Math.max(0, IMP.p) * .25 * pv, exp = Math.max(0, -IMP.p) * .25 * pv * (CARTE.exportK || .7) + (rd('h2') ? S.ecretement * .25 * 45 : 0);
  const opex = UNITES.reduce((a, u) => a + (u.fin ? 0 : u.cap * (TYPES[u.type].opex || 0) * 1e3), 0) / (365 * 96) + e * 12 + eDist * DISTRIB * tarifEre(annee(m)) + LIGNES.reduce((a, l) => a + l.len * ({ 15: 4e3, 63: 20e3, 225: 40e3, 400: 70e3 }[l.kv]), 0) / (365 * 96);
  const rdc = (S.rd.cours ? S.rd.budget : 0) * 1e6 / (365 * 96), prets = S.prets.reduce((a, p) => a + p.annuite, 0) / (365 * 96);
  pasChaleur(m);
  for (const v of VILLES) if (v.tuiles.some(t => t.quartier === 'hopital') && (!v.servie || S.delestage > 1)) v.hopCoupe = (v.hopCoupe || 0) + 15;  // l'hôpital exige une électricité sans coupure
  const W = pasEau(m), amendes = (annee(m) >= 2032 && UNITES.some(u => estCharbon(u) && !u.fin && u.dispo) ? 40e6 / (365 * 96) : 0) + W.amendes;
  const bas = (prod.solaire || 0) + (prod.eolien || 0) + Math.max(0, prod.hydro || 0) + (prod.nucleaire || 0) + (prod.biomasse || 0) + Math.max(0, prod.stockage || 0);
  const ren = bas - (prod.nucleaire || 0), coupure = (S.demIlot + S.delestage) / Math.max(1, S.demTot) * 15;
  for (const c of [S.jour, S.an]) Object.assign(c, { ventes: c.ventes + ventes + W.ventes, comb: c.comb + comb, carbone: c.carbone + carbone, imp: c.imp + imp, exp: c.exp + exp, opex: c.opex + opex + W.opex, rd: c.rd + rdc, prets: c.prets + prets, amendes: c.amendes + amendes,
    m3: c.m3 + W.livre, m3d: c.m3d + W.dem, m3m: c.m3m + W.manque, nc: c.nc + W.nc, eu: c.eu + W.usees, ut: c.ut + W.nonTraite, eauV: c.eauV + W.ventes, eauO: c.eauO + W.opex,
    e: c.e + e, co2: c.co2 + co2 * e, bas: c.bas + bas / tot * e, ren: c.ren + ren / tot * e, coupure: c.coupure + coupure, pointe: Math.max(c.pointe, S.charge + S.pertes) });
  S.argent += ventes + W.ventes + exp - comb - carbone - imp - opex - W.opex - rdc - prets - amendes;
  if (silencieux) return;
  // surcharges : la protection déclenche une ligne restée au-delà de 130 % pendant 45 minutes
  for (const b of BR) {
    if (!actifB(b)) continue;
    if (b.taux > 1.3) { b.sur += 15; if (b.sur >= 45) { b.hs = m + 240; b.sur = 0; log(`Surcharge : ${b.type === 'T' ? b.nom : 'ligne ' + b.nom} déclenchée par ses protections (${nf(b.taux * 100)} %). Réparation en 4 h.`, 'mauvais'); toast(`Déclenchement par surcharge : ${b.type === 'T' ? b.nom : 'ligne ' + b.nom}.`); } }
    else b.sur = 0;
  }
  if (S.delestage > 1 && !S.delestOn) { S.delestOn = true; log(`Délestage : ${nf(S.delestage)} MW coupés faute de production disponible.`, 'mauvais'); toast(`Délestage de ${nf(S.delestage)} MW : il manque de la production.`); }
  if (S.delestage <= 1) S.delestOn = false;
  for (const v of VILLES) { if (!v.servie && v.etaitServie !== false) { log(`${v.nom} n'est plus alimentée : aucun chemin électrique vers le réseau.`, 'mauvais'); toast(`${v.nom} est privée d'électricité.`); } v.etaitServie = v.servie; }
  for (const u of UNITES) if (u.fin && m >= u.fin) terminer(u);
  for (const l of LIGNES) if (l.fin && m >= l.fin) { l.fin = 0; dessinerLigne(l); log(`Ligne ${KV[l.kv].nom} ${l.nom} mise sous tension.`, 'bon'); }
  for (const u of UNITES) if (u.panne && u.panne <= m) { u.panne = 0; log(`${u.nom} réparée et recouplée.`, 'bon'); }
  for (const [k, fin] of Object.entries(S.evt)) if (fin && fin <= m) { S.evt[k] = 0; finEvt(k); }
  const h = heure(m);
  if (Math.abs(h) < .01) minuit(m);
}
function minuit(m) {
  const j = S.jour, dif = DIFF[S.diff];
  log(`Bilan du jour : ${nf(j.e)} MWh livrés, ${nf(j.co2 / Math.max(1, j.e))} gCO₂/kWh, ${nf(j.bas / Math.max(1, j.e) * 100)} % bas carbone${j.coupure > .5 ? `, ${nf(j.coupure)} min de coupure` : ''}.`);
  S.jourPrec = { ...j }; S.jour = nouveauCumul();
  jourDechets(m); if (!BANC_ON && vue === 'dechets' && !mode && ['bacs', 'nuis'].includes(S.lentille)) majLentille();
  // satisfaction
  const charbon = annee(m) >= 1980 ? UNITES.filter(u => estCharbon(u) && enService(u) && !amel(u, 'filtres')).length : 0;  // la pollution n'est mal vue qu'à partir des années 1980
  const exigence = clamp((annee(m) - 1900) / 70, .05, 1);  // au début du siècle, les pannes faisaient partie de la vie
  const ex = exigenceEau(annee(m)), E = S.eau;  // eau : pénurie, eau non conforme, rejets non épurés, prix, restrictions
  const eauPen = Math.min(30, j.m3m / Math.max(1, j.m3d) * 100 * .8 * ex) * (S.crise ? .75 : 1) + Math.min(20, j.nc / Math.max(1, j.m3) * 60 * ex) + (annee(m) >= 1970 ? Math.min(8, j.ut / Math.max(1, j.eu) * 8) : 0) + Math.max(0, E.tarif - 3.6) * 8 + (E.restriction ? 3 : 0)
    + (annee(m) >= 1970 ? Math.min(3, UNITES.filter(u => ['step', 'lagunage'].includes(u.type) && !u.fin && !amel(u, 'desodo') && VILLES.some(v => v.tuiles.some(x => dist(x, u.t) <= 2))).length) : 0)  // odeurs des stations près des villes
    + Math.min(15, (E.crises || []).filter(c => c.fin > m).reduce((s, c) => s + (VILLES.find(v => v.nom === c.v)?.hab || 0), 0) / Math.max(1, VILLES.reduce((s, v) => s + v.hab, 0)) * 40);  // une épidémie marque les esprits
  const hopPen = Math.min(10, VILLES.reduce((s, v) => s + (v.hopCoupe || 0), 0) / 60 * 2) * exigence * (S.crise ? .5 : 1);  // groupes électrogènes du plan de crise
  for (const v of VILLES) { if (v.hopCoupe) log(`L’hôpital de ${v.nom} a été privé d’électricité ${nf(v.hopCoupe)} minutes${S.crise ? ' (groupes électrogènes du plan de crise)' : ''}.`, 'mauvais'); v.hopCoupe = 0; }
  S.hopPen = hopPen;
  if (S.crise) { const c = coutCrise() / 365; S.argent -= c; S.jour.opex += c; S.an.opex += c; }
  const d0 = date(m); if (d0.getUTCMonth() === 2 && d0.getUTCDate() === 1 && annee(m) >= (S.mandat?.fin ?? 1902)) elections(m);
  const cible = 80 - hopPen - Math.min(70, S.an.coupure * .25 * exigence) - Math.max(0, S.tarif.res - 170) * .7 - Math.max(0, S.tarif.ter - 150) * .3 - Math.min(20, charbon * 3) - S.nimby + (S.an.bas / Math.max(1, S.an.e)) * 8 - eauPen - S.dec.pen;
  S.eauPen = eauPen;
  S.sat = clamp(S.sat + (cible - S.sat) * .03, 0, 100); S.nimby *= .985;
  // recherche
  if (S.rd.cours) { S.rd.avance += S.rd.budget / 365; const r = RDI[S.rd.cours]; if (S.rd.avance >= r.cout) { S.rd.acquis.push(r.id); S.rd.cours = null; S.rd.avance = 0; log(`R&D : « ${r.nom} » acquise. ${r.effet}.`, 'bon'); toast(`Recherche terminée : ${r.nom}.`, 'ok'); majBarre(); } }
  // pannes et aléas (une vieille centrale tombe plus souvent en panne)
  cassesEau(m); crisesEau(m); accidentEau(m);
  for (const u of UNITES) if (enService(u) && !TYPES[u.type].r && !TYPES[u.type].fatal && u.type !== 'poste' && u.type !== 'frontiere' && alea() < .0035 * dif.evt * (rd('maint') ? .5 : 1) * (1 + 2 * vieux(u))) { u.panne = m + (1 + Math.floor(alea() * 4)) * 1440; log(`Panne : ${u.nom} s'arrête pour ${Math.round((u.panne - m) / 1440)} jours.`, 'mauvais'); toast(`Panne : ${u.nom} à l'arrêt (−${nf(u.p)} MW).`); }
  const mo = date(m).getUTCMonth(), hiver = mo <= 1 || mo === 11, ete = mo >= 5 && mo <= 7;
  if (alea() < (hiver ? .02 : .006) * dif.evt) evenement('tempete');
  if (hiver && alea() < .012 * dif.evt) evenement('froid');
  if (ete && alea() < .015 * dif.evt) evenement('canicule');
  if (ete && alea() < .006 * dif.evt) evenement('secheresse');
  if (alea() < .002 * dif.evt) evenement('gaz');
  if (annee(m) >= 2010 && alea() < .003 * dif.evt * (rd('cyber') ? .25 : 1)) evenement('cyber');
  { const arret = UNITES.filter(u => !u.fin && alimente(u) < 1); if (arret.length && !S.cascade) log(`Coupure en cascade : ${arret.map(u => u.nom).slice(0, 4).join(', ')}${arret.length > 4 ? '…' : ''} ${arret.length > 1 ? 'tournent' : 'tourne'} ${S.crise ? 'au ralenti sur groupes électrogènes' : 'plus'} faute d’électricité. Un groupe de secours (fiche du bâtiment) l’évite.`, 'mauvais'); S.cascade = arret.length > 0; }
  // événements historiques
  const d = date(m), HIST = { 1956: [1, 1, 'froid'], 1985: [0, 5, 'froid'], 1999: [11, 26, 'tempete'], 2003: [7, 1, 'canicule'], 2022: [8, 1, 'gaz'] }, hh = HIST[d.getUTCFullYear()];
  if (hh && hh[0] === d.getUTCMonth() && hh[1] === d.getUTCDate()) evenement(hh[2]);
  // fin d'année
  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) nouvelAn(m);
  if (S.argent < -seuilFaillite() && !S.fini) finPartie('faillite');
  else if (!S.fini) { S.joursColere = S.sat < 15 ? (S.joursColere || 0) + 1 : 0; if (S.joursColere === 30) { log('La population gronde : la satisfaction est sous 15 %. Sans amélioration dans trois mois, la concession vous sera retirée.', 'mauvais'); toast('Satisfaction sous 15 % : vous avez trois mois pour redresser la situation.'); } if (S.joursColere >= 120) finPartie('revocation'); }
  sauver();
}
function evenement(k) {
  const m = S.min;
  if (S.evt[k] > m) return;
  if (k === 'tempete') { S.evt.tempete = m + 480 + alea() * 480; const ls = BR.filter(b => b.type === 'L' && actifB(b)); const l = ls[Math.floor(alea() * ls.length)]; if (l && alea() < .6) { l.hs = m + (S.crise ? 180 : 360); log(`Tempête : la ligne ${l.nom} est tombée, réparation en ${S.crise ? 3 : 6} h${S.crise ? ' (équipes du plan de crise)' : ''}.`, 'mauvais'); } toast('Tempête : rafales au-delà de 25 m/s, les éoliennes se mettent en sécurité.'); log('Tempête sur la région : arrêt de sécurité des éoliennes.', 'mauvais'); }
  if (k === 'froid') { S.evt.froid = m + 3 * 1440; toast('Vague de froid : −10 °C pendant 3 jours, le chauffage fait bondir la demande.', 'info'); log('Vague de froid annoncée pour 3 jours. Les prix d’import montent.', 'alerte'); }
  if (k === 'canicule') { S.evt.canicule = m + 5 * 1440; toast('Canicule : les centrales thermiques refroidies par la rivière perdent 28 % de puissance.', 'info'); log('Canicule : limitation des centrales thermiques, climatisation en hausse.', 'alerte'); }
  if (k === 'secheresse') { S.evt.secheresse = m + 25 * 1440; toast('Sécheresse : le débit de la rivière chute de moitié.', 'info'); log('Sécheresse : apports au barrage divisés par deux pendant 25 jours.', 'alerte'); }
  if (k === 'cyber') { S.evt.cyber = m + (2 + alea() * 4) * 1440 * (rd('cyber') ? .5 : 1); toast('Cyberattaque : la supervision est tombée, plus d’alertes ni de prévisions.'); log('Cyberattaque contre les systèmes de supervision : alertes, prévisions et optimisation des tournées indisponibles pendant quelques jours.', 'mauvais'); }
  if (k === 'gaz') { S.evt.gaz = m + 30 * 1440; toast('Flambée du prix du gaz : +60 % pendant un mois.', 'info'); log('Crise gazière : le gaz coûte 60 % plus cher pendant 30 jours.', 'alerte'); }
}
function finEvt(k) { log({ tempete: 'Fin de la tempête : les éoliennes redémarrent.', froid: 'Fin de la vague de froid.', canicule: 'Fin de la canicule.', secheresse: 'Fin de la sécheresse : la rivière retrouve son débit.', gaz: 'Le prix du gaz redescend.', cyber: 'Supervision rétablie après la cyberattaque.' }[k] || '', 'bon'); }
const NOM_EVT = { tempete: 'Tempête', froid: 'Grand froid', canicule: 'Canicule', secheresse: 'Sécheresse', gaz: 'Gaz cher', cyber: 'Cyberattaque' };

function nouvelAn(m) {
  const an = annee(m) - 1, a = S.an, e = Math.max(1, a.e);
  const res = a.ventes + a.exp - a.comb - a.carbone - a.imp - a.opex - a.rd - a.prets - a.amendes;
  const r = { an, co2: a.co2 / e, bas: a.bas / e * 100, ren: a.ren / e * 100, coupure: a.coupure, res, capex: a.capex, sat: S.sat, pointe: a.pointe, e: a.e, ...statsAnEau(a), ...statsAnDec(a) };
  S.rapports.push(r); S.anPrec = { ...a }; S.an = nouveauCumul();
  const nv = an + 1;
  // les villes grandissent, de nouveaux villages apparaissent
  for (const v of [...VILLES]) if (nv >= v.prochaine) croissanceVille(v, r);
  fonderPeutEtre(r);
  for (const p of S.prets) p.reste--; S.prets = S.prets.filter(p => p.reste > 0); S.dette = S.prets.reduce((s, p) => s + p.capital * p.reste / p.duree, 0);
  if (nv === 2032 && UNITES.some(estCharbon)) log('Loi de sortie du charbon : chaque année de fonctionnement coûte désormais 40 M€ d’amende.', 'alerte');
  if (nv === TYPES.frontiere.an && FRONT_T && !FRONT_T.occ) { creerUnite(FRONT_T, 'frontiere', { immediat: true, nom: 'Interconnexion avec la région voisine' }); log('La région voisine ouvre une interconnexion : tirez une ligne 225 kV jusqu’à la frontière pour importer et exporter.', 'bon'); toast('Nouvelle interconnexion avec la région voisine.', 'info'); dessinerMini(); }
  const nouveaux = [...Object.entries(TYPES).filter(([, t]) => t.an === nv && !t.cache).map(([, t]) => t.nom), ...Object.values(KV).filter(k => k.an === nv).map(k => `lignes ${k.nom}`)];
  if (nouveaux.length) log(`Nouveau en ${nv} : ${nouveaux.join(', ')}.`, 'bon');
  for (const [, t] of Object.entries(TYPES)) if (t.fin === an) log(`${t.nom} : on n’en construit plus à partir de ${nv}.`, 'alerte');
  majBarre(); trierOrdre(); if (nv === 1930 || ERES.some(e => e.an === nv)) routesSale = true;  // goudron en 1930, véhicules de chaque époque
  const er = ERES.find(x => x.an === nv);
  if (er) { S.ere = ERES.indexOf(er); log(`Nouvelle époque : ${er.nom}. ${er.txt}`, 'bon'); }
  rapportAnnuel(r, er);
}
const touche0 = u => { const c = S.eau.acc; return c && c.fin > S.min && (c.id === u.id || (c.genre === 'riviere' && u.type === 'prise' && u.rivI >= c.i)); };
const statsAnEau = a => ({ crises: a.crises || 0, acc: a.acc || 0, eauServi: 100 * (1 - a.m3m / Math.max(1, a.m3d)), eauConf: 100 * (1 - a.nc / Math.max(1, a.m3)), eauEpure: 100 * (1 - a.ut / Math.max(1, a.eu)) });
const HAB = { centre: 30000, residentiel: 25000, affaires: 12000, industriel: 8000, hopital: 3000, village: 2500 };
const habVille = v => v.tuiles.reduce((a, t) => a + HAB[t.quartier], 0);
const COULEURS_V = ['#ffc94d', '#7cc0f2', '#ff9f8a', '#b8e07b', '#d9a6ff', '#ffb36b', '#8fe3d0', '#f2a1c8'];
function intervalle(v, r) {
  const a = annee(S.min), base = { capitale: 9, ville: 12, village: 15 }[v.rang], boom = a >= 1946 && a < 1975 ? .6 : a < 1946 ? 1.1 : a >= 2000 ? 1.3 : 1;
  const mauvais = r && (r.coupure > 120 || S.sat < 45);  // une ville mal servie grandit moins vite
  return Math.max(2, Math.round(base * boom / DIFF[S.diff].croit + (mauvais ? 3 : 0)));
}
function typeQuartier(v) {
  const a = annee(S.min);
  if (v.rang === 'village') return 'residentiel';
  if (a >= 1930 && v.tuiles.length >= 4 && !v.tuiles.some(t => t.quartier === 'hopital')) return 'hopital';
  const cyc = a >= 1960 ? ['residentiel', 'industriel', 'affaires', 'residentiel'] : ['residentiel', 'industriel', 'residentiel'];
  if (CARTE.industriel) cyc.splice(1, 0, 'industriel');
  return cyc[v.i++ % cyc.length];
}
const placeLibre = t => libre(t) && plat(t) && !t.occ && t.npyl === 0 && t !== FRONT_T;
const TAILLE_MAX = { capitale: 12, ville: 7, village: 3 };
function croissanceVille(v, r) {
  v.prochaine = annee(S.min) + intervalle(v, r);
  if (v.tuiles.length >= TAILLE_MAX[v.rang]) return;  // la ville a atteint sa taille : sa demande ne monte plus qu'avec l'électrification
  const cand = LISTE.filter(t => placeLibre(t) && v.tuiles.some(x => dist(x, t) === 1)).sort((a, b) => dist(a, v.centre) - dist(b, v.centre) || hache(a.q, a.r, 8) - hache(b.q, b.r, 8));
  const t = cand[0]; if (!t) { log(`${v.nom} manque de place pour s’étendre.`, 'alerte'); return; }
  const type = typeQuartier(v);
  ajouterQuartier(v, t, type, true);
  log(`${v.nom} s’agrandit : nouveau ${QUART[type].nom.toLowerCase()} (+${nf(QUART[type].mw * facteurDemande(), 1)} MW).`, 'bon');
  if (v.rang === 'village' && v.tuiles.length >= 3) {  // le village devient une ville : son cœur devient un centre-ville
    const c = v.tuiles.find(x => x.quartier === 'village') || v.centre;
    c.quartier = 'centre'; jeter(c.grpQ); FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => f.q !== c)); dessinerQuartier(c, true);
    v.rang = 'ville'; v.rayon = 2; v.hab = habVille(v); dessinerFrontieres();
    log(`${v.nom} devient une ville (${nf(v.hab)} habitants).`, 'bon'); toast(`${v.nom} devient une ville.`, 'info');
  }
}
function ajouterQuartier(v, t, type, anim) {
  retirerFerme(t); Object.assign(t, { ville: v, quartier: type, t: 'ville' }); t.top = Math.max(t.top, TERR.ville.h); v.tuiles.push(t); v.hab = habVille(v);
  dessinerQuartier(t, anim); dessinerFrontieres(); majAcceptation(); dessinerMini(); EAU_SALE = true;
  if (v.tuiles.length === 1 && !BANC_ON) dessinerRoutes(); else if (!BANC_ON) majAmbiance();
}
function fonderPeutEtre(r) {
  if (VILLES.length >= 5) return;
  const a = annee(S.min), base = a < 1920 ? .08 : a < 1946 ? .09 : a < 1975 ? .15 : a < 1990 ? .08 : .05;
  const bon = S.sat > 50 && (!r || r.coupure < 60);
  if (!(VILLES.length === 1 && a >= 1915) && alea() > base * (bon ? 1 : .4)) return;
  const loinDe = t => VILLES.every(v => v.tuiles.every(x => dist(x, t) >= 4)) && UNITES.every(u => dist(u.t, t) >= 2);
  const t = SITES.find(x => placeLibre(x) && loinDe(x)) || LISTE.filter(x => placeLibre(x) && loinDe(x) && Math.min(x.col, x.row, COLS - 1 - x.col, ROWS - 1 - x.row) >= 3).sort((x, y) => hache(x.q, x.r, 21) - hache(y.q, y.r, 21))[0];
  if (!t) return;
  const nom = CARTE.villes[VILLES.length] || NOMS_VILLES.find(n => !VILLES.some(v => v.nom === n)) || `Ville ${VILLES.length + 1}`;
  const v = { nom, centre: t, couleur: COULEURS_V[VILLES.length % COULEURS_V.length], tuiles: [], rang: 'village', rayon: 1, i: 0, servie: false, base: 0, fondee: a, grace: S.min + 365 * 1440, prochaine: a + intervalle({ rang: 'village' }) };
  VILLES.push(v); ajouterQuartier(v, t, 'village', true);
  log(`Un nouveau village est fondé : ${nom}. Raccordez-le au réseau dans l’année.`, 'alerte'); toast(`Nouveau village : ${nom}. Raccordez-le au réseau.`, 'info');
}
