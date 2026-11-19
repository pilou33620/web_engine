"use strict";
// ============================================================ le jeu dans le moteur de web_engine
// Le moteur (js/01-moteur.js) dessine le plateau ; le jeu pose ses ouvrages, lignes, conduites et superpositions dans MONDE,
// en ses unités : une case de R = 10, la carte centrée sur l'origine.
const { MONDE, plateau: PLATEAU_M, toon: TOON, modernes: MODERNES } = MOTEUR;
MONDE.position.set(OX / R, 0, OZ / R);
const scene = MONDE, toile = MOTEUR.canvas, zone = $('#zone'), renderer = MOTEUR.renderer;
const MER_Y = -1.5;  // la surface de la mer du moteur (−0,15 case), en unités du jeu
const { degrade, MAT, CONT, lot, put } = TOON;
const FANT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade, transparent: true, opacity: .7, depthWrite: false });
const CHANT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: degrade, transparent: true, opacity: .42, depthWrite: false });
const MAT_SOL = PLATEAU_M.MAT_SOL, MAT_RIV = PLATEAU_M.MAT_RIV;  // terrain, décor et rivières du moteur : assombris dans les vues réseau
const GHOST = new THREE.MeshToonMaterial({ color: 0xa3a89a, gradientMap: degrade, transparent: true, opacity: .32, depthWrite: false });
const CONT_V = { eau: new THREE.MeshBasicMaterial({ color: 0x38b6ff, side: THREE.BackSide }), elec: new THREE.MeshBasicMaterial({ color: 0xffc94d, side: THREE.BackSide }), dechets: new THREE.MeshBasicMaterial({ color: 0xf0a35e, side: THREE.BackSide }) };
for (const m of [FANT, GHOST]) MOTEUR.sansBrouillard(m);

const VA = new THREE.Vector3(), VB = new THREE.Vector3(), AXEY = new THREE.Vector3(0, 1, 0);
function transfere(src, L, x, y, z, ry = 0, s = 1) { for (const k of ['g', 'o']) for (const geo of src[k]) { if (s !== 1) geo.scale(s, s, s); if (ry) geo.rotateY(ry); geo.translate(x, y, z); L[k].push(geo); } }
/** Fige un lot dans parent (MONDE par défaut) ; les matériaux translucides (fantôme, chantier) n'ont ni contours ni ombres. */
function fige(L, parent = scene, mat = MAT) {
  const plein = mat === MAT || mat === MAT_SOL || mat === MAT_RIV || mat === MOTEUR.boue.MAT_TERRE || mat === MOTEUR.boue.MAT_PAVE;
  const grp = TOON.fige(plein ? L : { g: L.g, o: [] }, parent, mat);
  if (!plein) grp.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
  return grp;
}
function jeter(obj) { if (!obj) return; obj.parent?.remove(obj); obj.traverse(o => { if (o.isMesh || o.isLineSegments || o.isPoints) { o.geometry.dispose(); const mt = o.userData.m0 || o.material; if (o.userData.propre && ![MAT, FANT, CHANT, CONT, GHOST, MAT_SOL, MAT_RIV].includes(mt)) mt.dispose(); } }); }
const { boite, cyl, cone, sphere } = TOON;
function toit(L, w, d, h, col, x, y, z, ry = 0) {
  const p = cyl(1, 1, d, 3); p.rotateX(Math.PI / 2); p.rotateZ(Math.PI / 2); p.scale(h / 1.5, w / SQ3, 1); p.translate(0, h / 2 - h / 3, 0);
  put(L, p, col, x, y + h / 6, z, ry);
}
function perp(pts, i) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }
const ruban = (pts, larg, y) => PLATEAU_M.ruban(pts, larg, y);
/** Un point du jeu (unités de 10) dans le repère du moteur (une case de 1), pour les fumées, les étiquettes et la caméra. */
const versMoteur = (x, y, z) => new THREE.Vector3((x + OX) / R, y / R, (z + OZ) / R);

// ============================================================ plateau : la carte du jeu au format du moteur
// terrain du moteur : 0 mer, 1 haut-fond (la côte), 2 lac, 4 plaine, 5 colline, 6 montagne ; une ville ou une ferme est du bâti
// (case aplanie, sans décor) ; les terres inexplorées passent sous la brume du moteur
const TERRAIN_M = { mer: 0, cote: 1, lac: 2, prairie: 4, plaine: 4, foret: 4, ville: 4, colline: 5, montagne: 6 };
let CARTE_M = null;
function construirePlateau() {
  for (const t of LISTE) { jeter(t.grpF); t.grpF = null; }
  FERMES.length = 0;
  const N = LISTE.length, z = () => new Array(N).fill(0), C = { l: COLS, h: ROWS, terrain: z(), fertile: z(), riviere: z(), foret: z(), arbres: z(), gisement: z(), rivieres: [] };
  LISTE.forEach((t, i) => {
    const k = t.ville ? t.t0 : t.t;
    C.terrain[i] = TERRAIN_M[k] ?? 4; C.fertile[i] = k === 'plaine' ? 1 : 0;
    if (k === 'foret') { C.foret[i] = 1; C.arbres[i] = 6; }
    if (t.riviere !== undefined) C.riviere[i] = 1;
  });
  const ch = [...RIV, RIV.at(-1)?.versMer].filter(Boolean).map(t => LISTE.indexOf(t)); if (ch.length) C.rivieres.push(ch);
  CARTE_M = C;
  PLATEAU_M.construire(C);
  majPlateau();
  MOTEUR.majBrouillard({ explore: LISTE.map(t => !t.brume), visible: LISTE.map(t => !t.brume) });
  MOTEUR.cam.l = SQ3 * COLS; MOTEUR.cam.h = 1.5 * ROWS;
  // la rivière du jeu suit le tracé du moteur (mêmes courbes) : courant de la vue Eau
  const milieu = (a, b) => [(a.x + b.x) / 2, (a.z + b.z) / 2];
  for (const t of RIV) {
    t.rivPts = null; if (t.riviere === undefined) continue;
    const i = RIV.indexOf(t), av = RIV[i - 1], ap = RIV[i + 1] || t.versMer;
    const A = av ? milieu(t, av) : [t.x + 2, t.z - 2], B = ap ? milieu(t, ap) : [t.x - 1.5, t.z + 1.5], Cc = [t.x + (MOTEUR.hache(t.col, t.row, 5) - .5) * 4, t.z + (MOTEUR.hache(t.col, t.row, 6) - .5) * 4];
    const pts = []; for (let s = 0; s <= 12; s++) { const k = s / 12; pts.push([(1 - k) ** 2 * A[0] + 2 * k * (1 - k) * Cc[0] + k * k * B[0], (1 - k) ** 2 * A[1] + 2 * k * (1 - k) * Cc[1] + k * k * B[1]]); }
    t.rivPts = pts;
  }
  // fermes : culture sur les plaines, élevage sur les prairies (modèles de la bibliothèque)
  for (const t of LISTE) if (t.ferme && !t.brume && !t.ville && t !== FRONT_T) {
    const F = lot(), ex = { pieces: [] }; MODERNES.semer(t); MODERNES.bFerme(F, t.ferme === 'elevage', ex);
    t.grpF = fige(F, scene, MAT_SOL); t.grpF.position.set(t.x, t.top, t.z); t.grpF.rotation.y = (hache(t.q, t.r, 43) * 6 | 0) * Math.PI / 3; pieces(t.grpF, ex, MAT_SOL);
    if (t.ferme === 'culture' && t.dr <= 2) FERMES.push(rivProche(t) ?? 0);
  }
}
/** L'état du plateau : villes et fermes (bâti), saison et neige au sol ; le moteur ne refait le décor que si cela change. */
let saisonM = 2, neigeM = 0;
function majPlateau() {
  if (!CARTE_M) return;
  const bati = []; LISTE.forEach((t, i) => { if (t.ville || t.ferme) bati.push({ case: i }); });
  const vide = new Array(LISTE.length).fill(-1);
  PLATEAU_M.majEtat({ cases: { arbres: CARTE_M.arbres, foret: CARTE_M.foret, proprio: vide }, batiments: bati, routes: [], forts: [], royaumes: [], saison: saisonM, meteo: { neige_sol: neigeM } });
}

// ============================================================ modèles de la bibliothèque, et leur vie dans le jeu
// fumées, éoliennes et rebond de construction suivent l'état du jeu (une centrale à l'arrêt ne fume pas) : le jeu les anime lui-même
const { BAT, QBAT, bFerme, rotor: rotorM, pylone } = MODERNES;
const FUMEES = [], ROTORS = [], ANIMS = [];
const rotor = () => rotorM();
function dessinerQuartier(t, anim) {
  semer(t); MODERNES.semer(t); const L = lot(), ex = { fum: [], pieces: [] }, ry = (hache(t.q, t.r, 2) * 6 | 0) * Math.PI / 3;
  QBAT[t.quartier](L, ex); t.grpQ = fige(L); t.grpQ.position.set(t.x, t.top, t.z); t.grpQ.rotation.y = ry; pieces(t.grpQ, ex);
  for (const f of ex.fum) FUMEES.push({ p: new THREE.Vector3(f[0], f[1], f[2]).applyAxisAngle(AXEY, ry).add(t.grpQ.position), vap: f[3], tic: rnd() * 2, q: t });
  if (anim) pop(t.grpQ);
}
// les parties mobiles de la bibliothèque (piece() : voitures, engins, oiseaux, grues…) : posées dans grp, animées par la bibliothèque sauf en travaux
function pieces(grp, ex, mat = MAT, anime = true) {
  for (const p of ex.pieces) { const P = lot(); p.dessin(P); p.o = fige(P, grp, mat); p.o.position.set(...p.pos); p.base = p.o.position[p.axe]; }
  if (anime && ex.pieces.length) MODERNES.animer({ groupe: grp, fumees: [], rotors: [], lumieres: null, courant: [], pieces: ex.pieces });
}
function pop(grp) { grp.scale.y = .01; ANIMS.push({ grp, t0: performance.now() }); }
