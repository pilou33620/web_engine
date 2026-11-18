"use strict";
// ============================================================ territoire : ce qui relie les trois réseaux et leurs habitants
// Réseau de chaleur, fêtes et vacances, élections municipales, plan de crise, vieillissement des installations,
// coupures en cascade, sécheresse partagée, déchets dangereux de l'industrie, hôpitaux.

// ------------------------------------------------------------ réseau de chaleur : MW thermiques livrables par chaque source
const CHALEUR = {
  incin: u => (u.q || 0) / 24 * 2, metha: u => (u.q || 0) / 24 * .5, biomasse: u => Math.max(0, u.p) * 1.2,
  usine: u => Math.max(0, u.p) * .6, charbon: u => Math.max(0, u.p) * .6, charbonG: u => Math.max(0, u.p) * .6, fioul: u => Math.max(0, u.p) * .6,
  gaz: u => Math.max(0, u.p) * .5, nucleaire: u => Math.max(0, u.p) * .3, smr: u => Math.max(0, u.p) * .5,
};
let CHAUD = [];  // réseaux de chaleur connexes, calculés avec ceux de l'eau
const froidK = w => clamp((16 - w.temp) / 22, 0, 1);
function pasChaleur(m) {  // chaque pas de 15 minutes : la chaleur livrée remplace le chauffage électrique et se vend
  const w = meteo(m), fr = froidK(w); let livre = 0;
  for (const v of VILLES) v.chaudK = 0;
  for (const C of CHAUD) {
    const besoin = C.villes.reduce((s, v) => s + v.hab / 1000 * 1.2 * fr, 0), cap = C.unites.filter(enService).reduce((s, u) => s + CHALEUR[u.type](u), 0);
    C.taux = besoin > 0 ? Math.min(1, cap / besoin) : (cap > 0 ? 1 : 0); C.besoin = besoin; C.cap = cap;
    for (const v of C.villes) v.chaudK = C.taux;
    livre += Math.min(cap, besoin);
  }
  const ventes = livre * .25 * 45 * tarifEre(annee(m)), opex = [...ARETES.values()].filter(e => e.f === 'c').length * 3000 / (365 * 96);
  S.argent += ventes - opex;
  for (const c of [S.jour, S.an]) Object.assign(c, { ventes: c.ventes + ventes, opex: c.opex + opex, chal: (c.chal || 0) + livre * .25 });
}

// ------------------------------------------------------------ fêtes, marchés et vacances : à date fixe, plus de déchets et d'eau
const FETES = [
  { nom: 'Fête nationale', du: [6, 13], au: [6, 15], an: 1900, dec: () => 1.5, eau: () => 1.1 },
  { nom: 'Vacances d’été', du: [7, 1], au: [7, 31], an: 1936, dec: () => (['littoral', 'ile'].includes(CARTE?.id) ? 1.35 : .9), eau: () => (['littoral', 'ile'].includes(CARTE?.id) ? 1.25 : .92) },
  { nom: 'Fêtes de fin d’année', du: [11, 15], au: [11, 31], an: 1900, dec: () => 1.3, eau: () => 1 },
];
const dansFete = (f, m) => { const d = date(m), x = d.getUTCMonth() * 100 + d.getUTCDate(); return annee(m) >= f.an && x >= f.du[0] * 100 + f.du[1] && x <= f.au[0] * 100 + f.au[1]; };
const fetesEnCours = m => FETES.filter(f => dansFete(f, m));
const facFete = (m, k) => fetesEnCours(m).reduce((s, f) => s * f[k](), 1);
function prochainesFetes(m) {
  const a = annee(m); return FETES.flatMap(f => [a, a + 1].map(y => ({ f, debut: Date.UTC(y, f.du[0], f.du[1]) / 60000 - DEBUT, fin: Date.UTC(y, f.au[0], f.au[1], 23) / 60000 - DEBUT, y })))
    .filter(x => x.y >= x.f.an && x.fin >= m).sort((x, y) => x.debut - y.debut).slice(0, 3);
}
const renfortsCout = () => S.dec.camions * coutCamion() / 365 * 30 * .45;  // 30 jours de camions loués et de bacs en plus

// ------------------------------------------------------------ élections municipales tous les 6 ans : le maire fixe une priorité pour le mandat
const MAIRES = ['Mme Durand', 'M. Lefèvre', 'Mme Martin', 'M. Bernard', 'Mme Petit', 'M. Moreau', 'Mme Girard', 'M. Roux', 'Mme Fournier', 'M. Lambert'];
const habTot = () => Math.max(1, VILLES.reduce((s, v) => s + v.hab, 0));
const PRIOS = [
  { id: 'propre', nom: 'Une ville propre', an: 1900, txt: 'Aucun bac qui déborde, presque pas de dépôts sauvages', ok: () => !VILLES.some(v => v.deborde) && sauvageTotal() < habTot() / 1000 * .3 },
  { id: 'lumiere', nom: 'L’électricité pour tous', an: 1900, txt: 'Toutes les villes alimentées, moins de 30 min de coupure dans l’année', ok: () => VILLES.every(v => v.servie) && S.an.coupure < 30 },
  { id: 'eau', nom: 'L’eau moins chère', an: 1950, txt: 'Eau sous 3 € le m³ (euros de 2020) et conforme', ok: () => S.eau.tarif <= 3 && (S.eau.conf ?? 1) > .97 },
  { id: 'chaleur', nom: 'Le chauffage urbain', an: 1960, txt: 'Un habitant sur trois raccordé à un réseau de chaleur', ok: () => VILLES.filter(v => CHAUD.some(C => C.villes.includes(v))).reduce((s, v) => s + v.hab, 0) / habTot() >= .33 },
  { id: 'decharge', nom: 'Zéro décharge', an: 1980, txt: 'Moins de 20 % des déchets enfouis', ok: () => { const so = surJ(30, 'enfoui') + surJ(30, 'export'), t = tauxDec(30).sortie; return t > 0 && so / t < .2; } },
  { id: 'charbon', nom: 'Sortie du charbon', an: 1980, txt: 'Plus aucune centrale au charbon en service', ok: () => !UNITES.some(u => estCharbon(u) && !u.fin) },
];
const prioDe = id => PRIOS.find(p => p.id === id);
const primeMandat = () => Math.max(1e6, (S.anPrec?.ventes || 0) * .02);
function elections(m) {
  const a = annee(m), P = S.mandat;
  if (P) {  // bilan du mandat qui s'achève
    const p = prioDe(P.prio), ok = p.ok();
    if (ok) { const c = primeMandat(); S.argent += c; S.an.ventes += c; S.sat = clamp(S.sat + 5, 0, 100); log(`Fin du mandat de ${P.maire} : objectif « ${p.nom} » tenu. Prime de ${euros(c)} et habitants satisfaits.`, 'bon'); }
    else { S.sat = clamp(S.sat - 5, 0, 100); log(`Fin du mandat de ${P.maire} : objectif « ${p.nom} » manqué. Les habitants sont déçus.`, 'mauvais'); }
  }
  const reelu = P && S.sat >= 50, maire = reelu ? P.maire : MAIRES[(MAIRES.indexOf(P?.maire) + 1 + Math.floor(alea() * 3)) % MAIRES.length];
  const choix = PRIOS.filter(p => a >= p.an && p.id !== P?.prio && !p.ok()), pool = choix.length ? choix : PRIOS.filter(p => a >= p.an), prio = pool[Math.floor(alea() * pool.length)];
  S.mandat = { maire, prio: prio.id, debut: a, fin: a + 6, reelu: !!reelu };
  log(`Élections municipales : ${maire} ${reelu ? 'est réélu(e)' : 'est élu(e)'}. Priorité du mandat jusqu’en ${a + 6} : « ${prio.nom} » (${prio.txt.toLowerCase()}).`, 'alerte');
  toast(`Élections : ${maire}, priorité « ${prio.nom} ».`, 'info');
}

// ------------------------------------------------------------ plan de crise : réserves payées en temps normal, effets des crises divisés par deux
const coutCrise = () => Math.max(.2e6 * kDec(), (S.anPrec?.ventes || 0) * .006);

// ------------------------------------------------------------ vieillissement : chaque bâtiment s'use, tombe plus souvent en panne et gêne davantage
const DUREES = { eolien: 25, solaire: 25, offshore: 25, batterie: 15, tac: 30, usine: 35 };
const dureeU = u => DUREES[u.type] || (TYPES[u.type].r === 'dechets' ? 30 : 40);
const ageU = u => Math.max(0, (S.min - (u.debut || 0)) / (365 * 1440));
const usureU = u => clamp(ageU(u) / dureeU(u), 0, 1.5);
const etatU = u => (usureU(u) > 1 ? ['vétuste', '--rouge'] : usureU(u) > .7 ? ['usé', '--orange'] : ['bon état', '--vert']);
const vieux = u => Math.max(0, usureU(u) - .7) / .8;  // 0 jusqu'à 70 % de la durée de vie, 1 au-delà de la fin de vie
const coutRenov = u => TYPES[u.type].capex * .4;
function renover(u) {
  if (u.fin || u.type === 'frontiere') return 'Impossible.';
  const c = coutRenov(u) * 1e6; S.argent -= c; S.an.capex += c; u.debut = S.min;
  log(`${u.nom} rénovée (${nf(c / 1e6, 1)} M€) : elle repart à neuf.`, 'bon'); majAcceptation(); return null;
}
// fin de vie : une décharge fermée doit être surveillée 30 ans ; un réacteur se démantèle
function finDeVie(u) {
  if (u.type === 'decharge') { (S.suivis = S.suivis || []).push({ nom: u.nom, fin: annee(S.min) + 30, cout: .15e6 }); log(`${u.nom} fermée : 30 ans de surveillance des jus et des gaz (${euros(.15e6 * kDec())} par an).`, 'alerte'); }
  if (['nucleaire', 'smr'].includes(u.type)) { const c = TYPES[u.type].capex * .3e6; S.argent -= c; S.an.capex += c; log(`Démantèlement de ${u.nom} : ${nf(c / 1e6)} M€.`, 'alerte'); }
}
const coutSuivis = () => (S.suivis || []).filter(s => s.fin > annee(S.min)).reduce((t, s) => t + s.cout, 0) * kDec();

// ------------------------------------------------------------ coupures en cascade : sans électricité, pompes, usines, épurations et sites de déchets s'arrêtent
const SECOURS = ['forage', 'prise', 'potab', 'pompage', 'dessal', 'step', 'tri', 'incin', 'metha', 'dangereux'];
const villeProche = u => VILLES.reduce((b, v) => (!b || dist(v.centre, u.t) < dist(b.centre, u.t) ? v : b), null);
function alimente(u) {  // 1 : tourne ; .5 : sur les groupes électrogènes du plan de crise ; 0 : arrêté
  if (!SECOURS.includes(u.type) || amel(u, 'secours') || annee(S.min) < 1920) return 1;
  const vs = [...(u.res?.villes || []), ...VILLES.filter(v => dist(v.centre, u.t) <= 6)];  // les villes de son réseau, ou une ville proche, peuvent l'alimenter
  return !vs.length || vs.some(v => v.servie) ? 1 : S.crise ? .5 : 0;
}

const partCentre = () => VILLES.reduce((s, v) => s + v.tuiles.filter(t => t.quartier === 'centre').length * HAB.centre, 0) / habTot();
// ------------------------------------------------------------ déchets dangereux de l'industrie : à traiter à part, sinon stockés sur place
const ddJour = () => VILLES.reduce((s, v) => s + v.tuiles.filter(t => t.quartier === 'industriel').length, 0) * .4 * sstep(1930, 1975, annee(S.min));
function jourDangereux(m) {  // appelé par la journée des déchets ; renvoie [traité, coût]
  const D = S.dec, cap = UNITES.filter(u => u.type === 'dangereux' && !u.fin && !(u.panne > m)).reduce((s, u) => s + TYPES.dangereux.tj * alimente(u), 0);
  D.dd = (D.dd || 0) + ddJour(); const x = Math.min(D.dd, cap); D.dd -= x;
  for (const u of UNITES) if (u.type === 'dangereux') u.q = cap ? x * TYPES.dangereux.tj / cap : 0;
  if (annee(m) >= TYPES.dangereux.an && D.dd > 300 && !(S.eau.acc && S.eau.acc.fin > m) && RIV.length && alea() < D.dd / 4e5 * (S.crise ? .5 : 1)) {  // fuite d'un stock de fûts vers la rivière
    const v = VILLES.find(v => v.tuiles.some(t => t.quartier === 'industriel')) || VILLES[0], i = v ? rivProche(v.centre) : null;
    if (i !== null) { S.eau.acc = { genre: 'riviere', i, fin: m + 4 * 1440 * (S.crise ? .5 : 1), nom: 'Fuite de fûts de déchets dangereux', lieu: v.nom }; S.an.acc++; log(`Des fûts de déchets dangereux stockés à ${v.nom} fuient dans la rivière. Construisez un centre de traitement des déchets dangereux.`, 'mauvais'); toast('Fuite de déchets dangereux dans la rivière !'); }
  }
  return [x, x * TYPES.dangereux.opexT * kDec(annee(m)) + (annee(m) >= 1990 ? D.dd * .5 : 0)];  // amendes sur le stock à partir de 1990
}
