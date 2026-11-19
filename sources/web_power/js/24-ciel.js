"use strict";
// ============================================================ ciel : jour et nuit, météo, saisons, neige au sol
// Rendus par le moteur (lumière, nuages, pluie, neige, brouillard, orage, saison et neige du plateau), d'après l'horloge et la météo du jeu.
const SAISON_MOIS = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0];  // hiver, printemps, été, automne
/** La position dans le cycle du moteur (jour 0–300 s, crépuscule 300–330, nuit 330–390, aube 390–420), d'après la hauteur du soleil. */
function cycleMoteur(m) {
  const u = clamp((.2 - soleil(m).el) / .28, 0, 1);
  return u <= 0 ? 150 : u >= 1 ? 360 : heure(m) < 12 ? 420 - u * 30 : 300 + u * 30;
}
const pluieDe = (w, m) => (S.evt && S.evt.tempete > m ? 1 : clamp((w.neb - .72) / .25, 0, 1));
function genreMeteo(w, m) {
  const mo = date(m).getUTCMonth(), h = heure(m), matin = (mo >= 9 || mo <= 1) && h > 4.5 && h < 9.5 && w.vent < 5;
  if (S.evt && S.evt.tempete > m) return 'tempete';
  if (pluieDe(w, m) > 0) return w.temp < 1.5 ? 'neige' : 'pluie';
  return matin ? 'brouillard' : w.temp > 30 ? 'canicule' : w.temp < -2 ? 'gel' : w.neb > .6 ? 'nuages' : 'soleil';
}
// fenêtres et réverbères la nuit : seules les villes alimentées s'allument
const LUM = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: TACHE, size: .5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
LUM.frustumCulled = false; LUM.visible = false; scene.add(LUM);
let foudreTic = 2, debordTic = 0, lumCle = '', lumTic = 0, neigeSol = 0, minPrec = null, cleMeteo = '', platTic = 0;
// une ville coupée par le délestage reste noire la nuit (une part des villes servies, toujours les mêmes d'abord)
const coupee = v => S.delestage > 1 && hache(v.centre.q, v.centre.r, 61) < clamp(S.delestage / Math.max(1, S.demServie), .15, 1);
function majLumieres() {
  const cle = VILLES.map(v => v.nom + v.tuiles.length + v.servie + coupee(v)).join();
  if (cle === lumCle) return; lumCle = cle;
  const pos = [], col = [];
  for (const v of VILLES) if (v.servie && !coupee(v)) for (const t of v.tuiles) for (let k = 0; k < 5; k++) {
    pos.push(t.x + (hache(t.q, t.r, 80 + k) - .5) * 14, t.top + 1.5 + hache(t.q, t.r, 90 + k) * 5, t.z + (hache(t.q, t.r, 100 + k) - .5) * 12);
    col.push(1, k % 3 ? .74 : .9, k % 3 ? .36 : .65);
  }
  LUM.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); LUM.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
// les décharges qui débordent (dessin de la bibliothèque), posées sur leur modèle : presque pleines (80 %), puis pleines (95 %)
function majDebords() {
  for (const u of UNITES) {
    if (u.type !== 'decharge' || u.fin || !u.grp) continue;
    const r = (u.rempli || 0) / TYPES.decharge.volume, n = r >= .95 ? 2 : r >= .8 ? 1 : 0, g = u.grp;
    if ((g.userData.debord || 0) === n) continue;
    jeter(g.userData.debordGrp); g.userData.debordGrp = null; g.userData.debord = n;
    if (!n) continue;
    const L = lot(), ex = { pieces: [] }; MODERNES.semer(u.t); MODERNES.debordDecharge(n)(L, ex);
    g.userData.debordGrp = fige(L, g); pieces(g.userData.debordGrp, ex);
  }
}
// les grèves des éboueurs : un piquet devant le garage des bennes, le centre de tri, l'incinérateur et la décharge
const GREVISTES = new Set(['garage', 'tri', 'incin', 'decharge']);
function majGreves() {
  const greve = (S.dec?.greve || 0) > S.min;
  for (const u of UNITES) {
    if (!GREVISTES.has(u.type) || u.fin || !u.grp) continue;
    const g = u.grp; if (!!g.userData.piquet === greve) continue;
    jeter(g.userData.piquet); g.userData.piquet = null;
    if (!greve) continue;
    const L = lot(), ex = { pieces: [] }; MODERNES.semer(u.t); MOTEUR.piquetGreve()(L, ex);
    g.userData.piquet = fige(L, g); pieces(g.userData.piquet, ex);
  }
}
function animCiel(dt, kt) {
  const w = meteo(S.min), mo = date(S.min).getUTCMonth(), g = genreMeteo(w, S.min), pluieK = pluieDe(w, S.min);
  MOTEUR.forcerHeure(cycleMoteur(S.min));
  // la neige tient au sol puis fond (en minutes de jeu)
  const dm = minPrec === null ? 0 : clamp(S.min - minPrec, 0, 1440); minPrec = S.min;
  neigeSol = clamp(neigeSol + (w.temp < 1.5 ? dm / 720 * pluieK : -dm / 1440 * clamp((w.temp - 1.5) / 4, 0, 1)), 0, 1);
  saisonM = SAISON_MOIS[mo]; neigeM = Math.round(neigeSol * 10) / 10;
  if ((platTic -= dt) < 0) { platTic = .25; majPlateau(); }
  const cle = [g, Math.round(w.vent), Math.round(w.temp), Math.round(pluieK * 5), saisonM, neigeM > .3].join();
  if (cle !== cleMeteo) {
    cleMeteo = cle;
    MOTEUR.appliquerMeteo({ genre: g, pluie: pluieK, vent: clamp(w.vent / 15, 0, 1), temperature: w.temp, direction: .5 + .5 * Math.sin(S.min / 4000), neige_sol: neigeSol }, saisonM);
  }
  MAT_SOL.color.lerp(TEINTE[vue], kt);  // les vues réseau assombrissent la carte
  MOTEUR.boue.TEINTE_ROUTES.copy(MAT_SOL.color);  // et les routes avec
  // pollution, rendue par la bibliothèque : ciel jauni et lointain voilé selon le charbon brûlé, rivières teintées quand l'eau n'est pas conforme
  const mwCharbon = UNITES.reduce((a, u) => a + (CHARBON.has(u.type) && actifU(u) ? u.p || 0 : 0), 0);
  MOTEUR.climat.pollution += (clamp(mwCharbon / 400, 0, .85) - MOTEUR.climat.pollution) * Math.min(1, dt * .3);
  MOTEUR.climat.eauSale = clamp((1 - (S.eau?.conf ?? 1)) * 1.5, 0, 1);
  if ((debordTic -= dt) < 0) { debordTic = 1; majDebords(); majGreves(); for (const u of UNITES) if (u.fin && u.grue && u.grue.userData.palier !== Math.round(avancement(u) * 5)) poserChantier(u); }
  // la foudre frappe les lignes pendant la tempête (un pylône au hasard)
  if (g === 'tempete' && LIGNES.length && (foudreTic -= dt) < 0) {
    foudreTic = 3 + Math.random() * 5;
    const l = LIGNES[Math.random() * LIGNES.length | 0], t = l.tuiles?.[Math.random() * (l.tuiles?.length || 0) | 0];
    if (t && !t.brume) { const p = versMoteur(t.x, t.top + (l.kv >= 225 ? 7 : 4.5), t.z); MOTEUR.foudreSur(p.x, p.y, p.z); }
  }
  if ((lumTic -= dt) < 0) { lumTic = .5; majLumieres(); }
  const nuit = MOTEUR.climat.nuit + MOTEUR.climat.aube * .5;
  LUM.material.opacity = clamp(nuit * 1.4, 0, 1); LUM.visible = LUM.material.opacity > .01;
}
