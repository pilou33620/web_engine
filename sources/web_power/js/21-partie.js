"use strict";
// ============================================================ nouvelle partie, sauvegarde, chargement
function toutEffacer() {
  for (const u of [...UNITES]) { jeter(u.grp); jeter(u.grue); jeter(u.halo); u.eti?.remove(); u.t.occ = null; }
  ARETES = new Map(); EAU_SALE = true; RESEAUX = []; EGOUTS = [];
  for (const l of [...LIGNES]) jeter(l.grp);
  UNITES = []; LIGNES = []; TRANSFOS = new Map(); ROTORS.length = 0; FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => f.q && f.q.ville && f.q.ville.tuiles.indexOf(f.q) < f.q.ville.base));
  for (const t of LISTE) t.npyl = 0;
  for (const v of VILLES) { for (const t of v.tuiles.slice(v.base)) { jeter(t.grpQ); t.grpQ = null; t.ville = null; t.quartier = null; t.t = t.t0; t.top = TERR[t.t].h; FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => f.q !== t)); } v.tuiles.length = v.base; v.i = 0; v.hab = v.hab0; v.etaitServie = undefined; v.prochaine = 1905; v.rang = v.rang0 || v.rang; v.bac = null; if (!v.base) v.el?.remove(); }
  VILLES = VILLES.filter(v => v.base > 0);
  IMP.p = IMP.c = 0;
}
function genererCarte(def) {
  for (const v of VILLES) { for (const t of v.tuiles) jeter(t.grpQ); v.el?.remove(); }
  FUMEES.length = 0; ROTORS.length = 0; jeter(FRONT); FRONT = null;
  genererTerrain(def); construirePlateau();
  for (const v of VILLES) { v.hab0 = v.hab; v.rang0 = v.rang; for (const t of v.tuiles) dessinerQuartier(t, false); }
  dessinerFrontieres(); majAcceptation(); ARETES = new Map(); EAU_SALE = true; dessinerEau(); dessinerRoutes(); dessinerMini();
  selT = null; placeAnneau(selR, null); placeAnneau(survolR, null);
}
function installationsDepart() {  // 1900 : une usine au charbon et, s'il y a une rivière, une usine au fil de l'eau, reliées en 15 kV
  const cap = VILLES[0].centre;
  const pres = (c, d1, d2) => LISTE.filter(t => !raison(t, 'usine') && plat(t) && dist(t, c) >= d1 && dist(t, c) <= d2).sort((a, b) => dist(a, c) - dist(b, c) || hache(a.q, a.r, 13) - hache(b.q, b.r, 13))[0];
  const usine = pres(cap, 2, 2) || pres(cap, 2, 4);
  creerUnite(usine, 'usine', { immediat: true, nom: `Usine électrique de ${VILLES[0].nom}` });
  const fil = LISTE.filter(t => !raison(t, 'fil') && dist(t, cap) <= 6).sort((a, b) => dist(a, cap) - dist(b, cap))[0];
  if (fil) creerUnite(fil, 'fil', { immediat: true });
  const relier = (a, b, kv) => tracerLigne(a, b, kv, { immediat: true }) || console.warn('ligne impossible', nomCourt(a));
  relier(usine, cap, 15); relier(usine, cap, 15); if (fil) relier(fil, cap, 15);
  S.ordre = UNITES.filter(u => TYPES[u.type].f && !TYPES[u.type].fatal && u.type !== 'batterie').map(u => u.id).concat('imp'); trierOrdre();
  // eau : un forage (ou une source) et un château d'eau reliés à la capitale
  const v0 = VILLES[0], pres2 = (ty, d1, d2) => LISTE.filter(t => !raison(t, ty) && dist(t, cap) >= d1 && dist(t, cap) <= d2 && cheminEau(t, cap)).sort((a, b) => dist(a, cap) - dist(b, cap) || hache(a.q, a.r, 14) - hache(b.q, b.r, 14))[0];
  const entree = t => v0.tuiles.slice().sort((a, b) => dist(a, t) - dist(b, t))[0];
  for (const ty of ['forage', 'source', 'prise']) { const t = pres2(ty, 2, 4); if (t) { creerUnite(t, ty, { immediat: true, nom: `${TYPES[ty].court} de ${v0.nom}` }); poserConduite(t, entree(t), 'potable'); break; } }
  const ch = pres2('chateau', 1, 3); if (ch) { creerUnite(ch, 'chateau', { immediat: true, nom: `Château d’eau de ${v0.nom}` }); poserConduite(ch, entree(ch), 'potable'); }
  topoEau();
  // déchets : une décharge brute à l'écart et des tombereaux pour vider les poubelles de la capitale
  const dch = LISTE.filter(t => !raison(t, 'decharge') && dist(t, cap) <= 7).sort((a, b) => dist(a, cap) - dist(b, cap) || hache(a.q, a.r, 15) - hache(b.q, b.r, 15))[0];
  if (dch) creerUnite(dch, 'decharge', { immediat: true, nom: `Décharge de ${v0.nom}` });
  const gar = LISTE.filter(t => !raison(t, 'garage') && dist(t, cap) >= 2 && dist(t, cap) <= 4).sort((a, b) => dist(a, cap) - dist(b, cap) || hache(a.q, a.r, 18) - hache(b.q, b.r, 18))[0];
  if (gar) creerUnite(gar, 'garage', { immediat: true, nom: `Dépôt de ${v0.nom}` });
  S.dec.camions = Math.ceil(besoinCamions() * 1.15);
}
function prechauffer() {
  majAcceptation(); topologie();
  const m0 = S.min; S.min = m0 - 1440;
  for (; S.min < m0; S.min += 15) { pas(S.min, true); reseau(); }
  S.min = m0; S.jour = nouveauCumul(); S.an = nouveauCumul();
  pas(S.min, true); reseau(); S.jour = nouveauCumul(); S.an = nouveauCumul();
  for (const [k, b] of INJ) if (!ILES.some(i => i.slack === k)) console.assert(Math.abs(b - BR.reduce((a, r) => a + (r.ba === k ? r.f : r.bb === k ? -r.f : 0), 0)) < 1e-3, 'loi des nœuds', k);
}
function nouvellePartie(diff, def = carteDef('valmont')) {
  toutEffacer(); genererCarte(def); S = etatInitial(diff); S.carte = def; gs = 99 + (def.graine || 0); uid = 0; IMP.cap = 0;
  installationsDepart(); dessinerFrontieres(); dessinerRoutes(); prechauffer();
  log(`1900 · ${CARTE.nom}. ${VILLES[0].nom} compte ${nf(VILLES[0].hab)} habitants et découvre l’électricité : environ ${nf(Math.max(...S.hist.map(h => h.charge)), 1)} MW à la pointe. Votre mission : électrifier la région jusqu’en 2050.`);
  log(`${ERES[0].nom} · ${ERES[0].txt}${FRONT_T ? '' : ' Sur une île, aucune interconnexion ne viendra jamais.'}`, 'bon');
  S.enJeu = true; S.pause = false; S.vit = 1;
  if (BANC_ON) return;
  majBarre(); majLentilles(); majLentille(); couleurCables(); dessinerMini(); hud();
  ouvrir(!portrait() ? 'accueil' : 'carte');
  cible.set(VILLES[0].centre.x + 30, 0, VILLES[0].centre.z + 20); distc = 330; majCam();
  sauver();
}
const CLE = 'gridmaster-campagne-v1';
function sauver() {
  if (!S?.enJeu || BANC_ON) return;
  const d = { S: { ...S, hist: S.hist.slice(-96), fhist: undefined, D: undefined }, uid, gs, carte: CARTE,
    unites: UNITES.map(u => ({ id: u.id, type: u.type, k: u.t.k, nom: u.nom, dispo: u.dispo, panne: u.panne, fin: u.fin, debut: u.debut, soc: u.soc, mode: u.mode, niv: u.niv, etapes: u.etapes, reut: u.reut, rempli: u.rempli, amelio: u.amelio })),
    aretes: [...ARETES.values()].map(e => [e.a.k, e.b.k, e.type, e.an]),
    lignes: LIGNES.map(l => ({ id: l.id, a: l.a.k, b: l.b.k, kv: l.kv, fin: l.fin, hs: l.hs, chemin: l.tuiles.map(t => t.k) })), villes: VILLES.map(v => ({ nom: v.nom, couleur: v.couleur, rang: v.rang, rayon: v.rayon, i: v.i, prochaine: v.prochaine, fondee: v.fondee, grace: v.grace, base: v.base, bac: v.bac, moy: v.moy, sauvage: v.sauvage, centre: v.centre.k, tuiles: v.tuiles.map(t => [t.k, t.quartier]) })) };
  try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* stockage indisponible : la partie continue sans sauvegarde */ }
}
function lireSauvegarde() { try { const d = JSON.parse(localStorage.getItem(CLE)); return d && d.S && d.unites && d.carte ? d : null; } catch (e) { return null; } }
function charger() {
  const d = lireSauvegarde(); if (!d) { toast('Aucune partie enregistrée.'); return false; }
  toutEffacer(); genererCarte(d.carte);
  S = Object.assign(etatInitial(d.S.diff), d.S, { fhist: Array(200).fill(50), enJeu: true, pause: true }); uid = d.uid; gs = d.gs;
  for (const v of VILLES) { for (const t of v.tuiles) { jeter(t.grpQ); t.grpQ = null; t.ville = null; t.quartier = null; t.t = t.t0; t.top = TERR[t.t].h; } v.el?.remove(); }
  FUMEES.splice(0, FUMEES.length, ...FUMEES.filter(f => !f.q)); VILLES = [];
  for (const x of d.villes) {
    const v = { ...x, centre: T.get(x.centre), tuiles: [], servie: false };
    for (const [k, q] of x.tuiles) { const t = T.get(k); Object.assign(t, { ville: v, quartier: q, t: 'ville' }); t.top = Math.max(t.top, TERR.ville.h); v.tuiles.push(t); dessinerQuartier(t, false); }
    v.hab = v.hab0 = habVille(v); v.rang0 = v.base ? 'capitale' : v.rang; VILLES.push(v);
  }
  for (const s of d.unites) { const u = creerUnite(T.get(s.k), s.type, { immediat: !s.fin, nom: s.nom, fin: s.fin }); Object.assign(u, { id: s.id, dispo: s.dispo, panne: s.panne, debut: s.debut, soc: s.soc, mode: s.mode }); if (s.niv !== undefined) u.niv = s.niv; if (s.etapes) u.etapes = s.etapes; if (s.reut) u.reut = true; if (s.rempli !== undefined) u.rempli = s.rempli; if (s.amelio) u.amelio = s.amelio; }
  if (!d.S.dec) S.dec.camions = Math.ceil(besoinCamions() * 1.15);  // partie enregistrée avant les déchets
  for (const [a, b, ty, an] of d.aretes || []) ajouteArete(T.get(a), T.get(b), ty, an);
  dessinerEau(); dessinerRoutes(); topoEau();
  for (const s of d.lignes) { const l = tracerLigne(T.get(s.a), T.get(s.b), s.kv, { immediat: !s.fin, chemin: s.chemin.map(k => T.get(k)) }); if (l) Object.assign(l, { id: s.id, fin: s.fin, hs: s.hs }); if (l && l.fin) dessinerLigne(l); }
  dessinerFrontieres(); majAcceptation(); topologie(); dispatch(S.min); for (const u of [...UNITES, IMP]) u.p = actifU(u) ? u.c : 0; reseau();
  majBarre(); majLentilles(); majLentille(); couleurCables(); dessinerMini(); hud(); S.pause = false;
  ouvrir(!portrait() ? 'accueil' : 'carte'); cible.set(VILLES[0].centre.x + 30, 0, VILLES[0].centre.z + 20); majCam();
  toast(`Partie reprise au ${dateTxt(S.min)}.`, 'ok'); return true;
}
