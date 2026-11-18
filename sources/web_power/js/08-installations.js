"use strict";
// ============================================================ état de la partie
// argent en M€ ; k : demande ; croit : rythme de croissance des villes (plus de croissance = plus difficile)
const DIFF = { facile: { nom: 'Facile', argent: 40, k: .95, croit: .8, evt: .5, sat: 80 }, normal: { nom: 'Normal', argent: 20, k: 1, croit: 1, evt: 1, sat: 72 }, difficile: { nom: 'Difficile', argent: 10, k: 1.08, croit: 1.25, evt: 1.6, sat: 64 } };
const DEBUT = Date.UTC(1900, 0, 1, 0, 0) / 60000 + 8 * 60;
const date = m => new Date((DEBUT + m) * 60000);
const heure = m => { const d = date(m); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const annee = m => date(m).getUTCFullYear();
const jourAn = m => { const d = date(m); return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5; };
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const hhmm = m => { const d = date(m); return `${d.getUTCHours()} h ${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const jourTxt = m => { const d = date(m); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`; };
const dateTxt = m => { const d = date(m); return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const saison = m => ['Hiver', 'Hiver', 'Printemps', 'Printemps', 'Printemps', 'Été', 'Été', 'Été', 'Automne', 'Automne', 'Automne', 'Hiver'][date(m).getUTCMonth()];
const MOIS_MIN = 30.44 * 1440;
const DISTRIB = 45;  // €/MWh livré en basse et moyenne tension (les industriels raccordés en 63 kV n'en paient pas)
const nouveauCumul = () => ({ ventes: 0, comb: 0, carbone: 0, opex: 0, imp: 0, exp: 0, rd: 0, prets: 0, amendes: 0, capex: 0, e: 0, co2: 0, bas: 0, ren: 0, coupure: 0, pointe: 0, m3: 0, m3d: 0, m3m: 0, nc: 0, eu: 0, ut: 0, eauV: 0, eauO: 0, crises: 0, acc: 0, decV: 0, decO: 0, decP: 0, decR: 0, decE: 0, decS: 0 });
let S, UNITES = [], LIGNES = [], uid = 0;
let routesSale = false;  // une installation posée ou démolie : routes redessinées au prochain rafraîchissement
const IMP = { id: 'imp', type: 'import', nom: 'Interconnexion avec la région voisine', p: 0, c: 0, dispo: true };
function etatInitial(diff) {
  return {
    diff, min: 0, vit: 1, pause: true, enJeu: false, f: 50, imb: 0, onglet: 'dispatch', lentille: 'relief', ordre: [],
    argent: DIFF[diff].argent * 1e6, dette: 0, prets: [], sat: DIFF[diff].sat, tarif: { res: 168, ter: 142, ind: 96 }, effacement: false,
    ere: 0, evt: {}, hist: [], fhist: Array(200).fill(50), jour: nouveauCumul(), an: nouveauCumul(), anPrec: null, journal: [], rapports: [],
    pertes: 0, charge: 0, demServie: 0, demIlot: 0, delestage: 0, ecretement: 0, spot: 40, nimby: 0, pertesNiv: {},
    rd: { acquis: [], cours: null, avance: 0, budget: 10 }, quartiers: [], fini: false,
    eau: { nappe: .85, profonde: 1, tarif: 3, restriction: false, pollu: [], taux: 1, conf: 1, epure: 0 }, dec: etatDec(),
  };
}

// ============================================================ installations : construire, terminer, démolir
const unite = id => (id === 'imp' ? IMP : UNITES.find(u => u.id === id));
const coutType = ty => TYPES[ty].capex * (ty === 'nucleaire' && rd('epr') ? .8 : ty === 'batterie' && rd('sodium') ? .7 : 1);
const delaiType = ty => Math.max(1, TYPES[ty].delai - (ty === 'nucleaire' && rd('epr') ? 24 : 0));
function rotPour(t, type) {
  if (type === 'barrage' || type === 'fil') { const i = RIV.indexOf(t), a = RIV[i - 1] || t, b = RIV[i + 1] || t.versMer || t; return Math.atan2(-(b.z - a.z), b.x - a.x); }
  if (['eolien', 'solaire', 'offshore', 'frontiere'].includes(type)) return 0;
  if (['prise', 'step', 'dessal'].includes(type)) { const n = voisins(t).find(n => n.riviere !== undefined) || voisins(t).find(n => n.t === 'cote' || n.t === 'mer'); if (n) return Math.atan2(-(n.z - t.z), n.x - t.x); }
  return (hache(t.q, t.r, 4) * 6 | 0) * Math.PI / 3;
}
function modele(t, type, mat = MAT, u = null) {
  semer(t); const L = lot(), ex = { rotors: [], fum: [] };
  BAT[type](L, ex, t);
  const grp = fige(L, scene, mat);
  grp.position.set(t.x, type === 'barrage' ? t.top - 1 : TYPES[type].eau ? -.7 : t.top, t.z); grp.rotation.y = rotPour(t, type);
  for (const r of ex.rotors) {
    const rg = rotor(); rg.position.set(...r);
    if (mat !== MAT) rg.traverse(o => { if (o.isMesh) { if (o.material === CONT) o.visible = false; else o.material = mat; } });
    grp.add(rg); if (u) ROTORS.push({ g: rg, v: .5 + t.vent * .13, u });
  }
  if (u) for (const f of ex.fum) FUMEES.push({ p: new THREE.Vector3(f[0], f[1], f[2]).applyAxisAngle(AXEY, grp.rotation.y).add(grp.position), vap: f[3], tic: rnd() * 2, u });
  return grp;
}
function nomUnite(type, t) { const n = lieu(t); return `${TYPES[type].court} ${/^[aeiouéèh]/i.test(n) ? 'd’' : 'de '}${n}`.replace('de le ', 'du ').replace('de les ', 'des '); }
function creerUnite(t, type, { immediat = false, nom = null, fin = 0 } = {}) {
  const ty = TYPES[type];
  const u = { id: 'u' + (++uid), type, t, nom: nom || nomUnite(type, t), cap: ty.mw, p: 0, c: 0, dispo: true, panne: 0, fin: immediat ? 0 : fin, soc: ty.stock && !ty.r ? .7 : ty.mwh ? .5 : 0, mode: 'auto', debut: S.min };
  if (ty.r === 'eau') { u.niv = .8; if (type === 'potab') u.etapes = ['sable']; EAU_SALE = true; }
  if (type === 'decharge') u.rempli = 0;
  if (CHALEUR[type]) EAU_SALE = true;  // une source de chaleur change les réseaux de chaleur
  t.occ = u; UNITES.push(u); retirerFerme(t); routesSale = true;
  dessinerUnite(u, !immediat);
  return u;
}
function dessinerUnite(u, anim) {
  jeter(u.grp); jeter(u.grue);
  ROTORS.splice(0, ROTORS.length, ...ROTORS.filter(r => r.u !== u)); FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => f.u !== u));
  if (u.fin) { u.grp = modele(u.t, u.type, CHANT); const L = lot(); BAT.grue(L); u.grue = fige(L); u.grue.position.set(u.t.x, u.t.top, u.t.z); if (anim) pop(u.grue); }
  else { u.grp = modele(u.t, u.type, MAT, u); u.grue = null; if (anim) pop(u.grp); }
  stylerU(u);
}
function retirerFerme(t) { if (t.grpF) { jeter(t.grpF); t.grpF = null; } t.ferme = null; }
function terminer(u) {
  u.fin = 0; dessinerUnite(u, true);
  if (TYPES[u.type].f && !TYPES[u.type].fatal && u.type !== 'batterie') insererOrdre(u);
  if (estEauU(u)) { EAU_SALE = true; if (TYPES[u.type].role === 'epuration') { const n = voisins(u.t).find(x => x.riviere !== undefined) || voisins(u.t).find(x => x.t === 'cote'); if (n) { ajouteArete(u.t, n, 'rejet'); dessinerEau(); } } }
  log(`${u.nom} mise en service (${TYPES[u.type].r ? capTexte(TYPES[u.type]) : nf(u.cap) + ' MW'}).`, 'bon'); toast(`${u.nom} est en service.`, 'ok');
  majAcceptation(); dessinerMini();
}
function insererOrdre(u) { if (S.ordre.includes(u.id)) return; S.ordre.push(u.id); trierOrdre(); }
function coutMarginal(u) {
  if (u === IMP) return prixVoisin(S.min);
  const ty = TYPES[u.type]; let c = prixCombustible(u.type, annee(S.min)) * (S.evt.gaz > S.min && (u.type === 'gaz' || u.type === 'tac') ? 1.6 : 1) * (u.type === 'gaz' && rd('ccga') ? .9 : 1);
  if (u.type === 'barrage') c = 4 + 150 * (1 - u.soc) ** 2;  // valeur de l'eau : plus le lac se vide, plus on la garde
  return c + co2U(u) * prixCO2() / 1000;
}
const co2U = u => (TYPES[u.type]?.co2 || 0) * (u.type === 'gaz' && rd('ccga') ? .9 : 1);
function trierOrdre() { S.ordre.sort((a, b) => coutMarginal(unite(a)) - coutMarginal(unite(b))); }
function demolir(u) {
  const ls = LIGNES.filter(l => l.a === u.t || l.b === u.t), garder = u.type !== 'poste' && ls.length >= 2;  // le poste de la centrale reste en place
  if (!garder) for (const l of ls) demolirLigne(l, true);
  jeter(u.grp); jeter(u.grue); jeter(u.halo); u.eti?.remove(); if (estEauU(u) || CHALEUR[u.type]) EAU_SALE = true; if (u.reut) retirerReut(u);
  ROTORS.splice(0, ROTORS.length, ...ROTORS.filter(r => r.u !== u)); FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => f.u !== u));
  UNITES.splice(UNITES.indexOf(u), 1); S.ordre = S.ordre.filter(id => id !== u.id); u.t.occ = null; routesSale = true;
  if (garder) { creerUnite(u.t, 'poste', { immediat: true, nom: `Poste ${/^[aeiouéèh]/i.test(lieu(u.t)) ? 'd’' : 'de '}${lieu(u.t)}`.replace('de le ', 'du ').replace('de les ', 'des ') }); log(`Le poste électrique de ${u.nom} est conservé : ses ${ls.length} lignes restent en service.`); }
  majAcceptation(); dessinerMini();
}
function raison(t, type) {
  if (!t || t.brume) return 'Terres inexplorées';
  const ty = TYPES[type], a = annee(S.min);
  if (a < ty.an) return `Disponible en ${ty.an}`;
  if (ty.fin && a > ty.fin) return `Technologie dépassée depuis ${ty.fin}`;
  if (ty.rd && !rd(ty.rd)) return `Recherche nécessaire : ${RDI[ty.rd].nom}`;
  if (estEau(t) && !ty.eau) return 'Hexagone d’eau';
  if (t.ville) return `Quartier de ${t.ville.nom}`;
  if (t.occ) return `Déjà occupé : ${t.occ.nom}`;
  if (t === FRONT_T && type !== 'frontiere') return `Réservé à l’interconnexion (${TYPES.frontiere.an})`;
  if (type !== 'barrage' && type !== 'fil' && t.riviere !== undefined) return 'Rivière : usine hydraulique seulement';
  if (t.npyl > 0 && type !== 'poste') return 'Des pylônes passent ici';
  if (ty.loin && VILLES.some(v => v.tuiles.some(x => dist(x, t) < ty.loin))) return `Trop près des habitations : ${ty.loin} hexagones au moins`;
  if (!ty.ok(t)) return ty.non;
  return null;
}
// améliorations : chaque bâtiment a ses malus (fumées, odeurs, jus de décharge, boues…) ; une recherche débloque l'équipement qui les réduit
const AMELIO = {
  filtres: { nom: 'Dépoussiéreurs et désulfuration', pour: ['usine', 'charbon', 'charbonG', 'fioul'], rd: 'desulfu', cout: u => TYPES[u.type].capex * .15, malus: 'Fumées noires : riverains gênés, malus du charbon sur la satisfaction', effet: 'Plus de gêne des riverains ni de malus du charbon' },
  lownox: { nom: 'Brûleurs bas NOx', pour: ['gaz', 'tac'], rd: 'lownox', cout: u => TYPES[u.type].capex * .05, malus: 'Oxydes d’azote : riverains gênés', effet: 'Les riverains ne sont plus gênés' },
  desodo: { nom: 'Couverture et désodorisation', pour: ['step', 'lagunage'], rd: 'desodo', cout: u => (u.type === 'step' ? 3 : .5), malus: 'Odeurs : riverains gênés', effet: 'Plus d’odeurs pour les riverains' },
  sechage: { nom: 'Déshydratation des boues', pour: ['step', 'lagunage'], rd: 'boues', cout: u => (u.type === 'step' ? 2 : .3), malus: 'Boues d’épuration à éliminer (onglet Déchets)', effet: 'Boues divisées par trois' },
  casiers: { nom: 'Casiers étanches et traitement des lixiviats', pour: ['decharge'], rd: 'lixiviats', cout: () => 1.5, malus: 'Jus de décharge (lixiviats) : polluent la rivière', effet: 'La rivière n’est plus polluée' },
  biogaz: { nom: 'Captage du biogaz', pour: ['decharge'], rd: 'biogaz', cout: () => 2, malus: 'Odeurs et méthane', effet: 'Gêne des riverains divisée par deux' },
  fumees: { nom: 'Traitement des fumées', pour: ['incin'], rd: 'fumees', cout: () => 10, malus: 'Fumées : riverains gênés', effet: 'Gêne des riverains −60 %' },
  secours: { nom: 'Groupe électrogène de secours', pour: SECOURS, an: 1930, cout: u => (estDecU(u) ? .8 : .4), malus: 'S’arrête quand la ville voisine est privée d’électricité (coupure en cascade)', effet: 'Continue de tourner pendant les coupures' },
  ferme: { nom: 'Bâtiment fermé et traitement de l’air', pour: ['compost', 'metha'], an: 1995, cout: () => 1, malus: 'Odeurs : riverains gênés', effet: 'Gêne des riverains −70 %' },
};
const amel = (u, k) => !!u.amelio?.includes(k);
const amelDispo = k => annee(S.min) >= (AMELIO[k].an || 0) && (!AMELIO[k].rd || rd(AMELIO[k].rd));
const amelPour = u => Object.keys(AMELIO).filter(k => AMELIO[k].pour.includes(u.type));
function ameliorer(u, k) {
  const A = AMELIO[k]; if (!A || !A.pour.includes(u.type) || amel(u, k) || !amelDispo(k) || u.fin) return 'Amélioration indisponible.';
  const c = A.cout(u) * 1e6; S.argent -= c; S.an.capex += c; (u.amelio = u.amelio || []).push(k);
  log(`${u.nom} : ${A.nom.toLowerCase()} (${nf(c / 1e6, 1)} M€). ${A.effet}.`, 'bon'); majAcceptation(); return null;
}
const recours = t => (annee(S.min) < 1970 ? 0 : t.accept < 20 ? 2 : t.accept < 35 ? 1 : 0);  // les recours des riverains apparaissent dans les années 1970
