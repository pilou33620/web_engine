// Les agents sur la carte (web_conquete, SPEC-POLITIQUE module 4 ; maquette maquettes/web_engine/agents.html) : espion, gentilhomme,
// prêtre et diplomate en figurines à l'échelle des troupes de maillageTroupe (unités de web_power, groupe à l'échelle 0,1, face à +z),
// à la couleur du camp et à l'habit de l'époque, sur un socle à ses couleurs où le niveau se lit en étoiles. Au repos, ils regardent
// alentour et ajustent leur chapeau (le prêtre bénit) ; en marche, ils vont au pas ; cachés, ce n'est plus qu'une silhouette
// translucide sous un petit œil barré. Et les scènes courtes de mission (sceneMission) : duel, sabotage, assassinat, espionnage,
// apaisement, diplomate reçu, agent pris, réussies ou manquées.
// (espions.js est l'espionnage de web_royaumes, mené par son état : il ne change pas.)
import { THREE, scene, chaqueImage, qualite, posCase } from './scene.js';
import { MAT, CONT, lot, put, fusion, toon, boite, cyl, cone, sphere } from './toon.js';
import { ECH_BAT, PALIERS, fantassin } from './modeles.js';
import { lisse, franchit, feu, oublierFeu, drapeau, rond } from './guerre_commun.js';
import { dessus } from './plateau.js';

const PEAU = 0xf0c9a0, NOIR = 0x1f1f1f, BLANC = 0xf2efe6, OR = 0xe0b23a, ACIER = 0xd9d9d9, CUIR = 0x7a4a24, SOMBRE = 0x2b2f3a, BRUN = 0x4a3322;
const POUDRE = 0xeeeae2, CREME = 0xeadfc4, BLEU_COUR = 0x26304a, BOIS = 0x8a6a42;
const EPOQUES = ['ancien', 'lumieres', 'empire', 'industrie'];
const PALIER = { ancien: 1, lumieres: 2, empire: 3, industrie: 5 };  // l'uniforme des gardes de l'époque (PALIERS de modeles.js)
const COU = 1.85, EPAULE = [-0.47, 1.78, 0], H_SOCLE = 0.165;      // pivots de la tête et du bras droit (à -x : la figurine regarde +z)
export const TYPES_AGENT = ['espion', 'gentilhomme', 'pretre', 'diplomate'];

// ------------------------------------------------------------------ pièces communes (coordonnées absolues, tête centrée en y = 2,1)
function jambes(L, col, pas, bottes = false) {
  for (const dx of [-0.16, 0.16]) {
    const z = dx < 0 ? pas : -pas;
    put(L, boite(0.24, 0.9, 0.3), col, dx, 0.45, z, 0, 0.05);
    if (bottes) put(L, boite(0.27, 0.5, 0.33), NOIR, dx, 0.25, z, 0, 0.04);
    else put(L, boite(0.26, 0.14, 0.4), NOIR, dx, 0.07, z + 0.05, 0, 0.03);
  }
}
/** Un bras pendant (manche, parement, main) à l'épaule x ; le droit (x < 0) est la pièce qui bouge. */
function bras(L, x, manche, parement) {
  put(L, boite(0.2, 0.78, 0.22), manche, x, 1.39, 0, 0, 0.05);
  put(L, boite(0.23, 0.1, 0.25), parement, x, 1.03, 0, 0, 0.03);
  put(L, sphere(0.1, 0), PEAU, x, 0.92, 0, 0, 0.03);
}
const tete = L => put(L, sphere(0.28, 1), PEAU, 0, 2.1, 0, 0, 0.05);
function cheveux(L, genre, col = BRUN) {
  if (genre === 'perruque') {  // la grande perruque de 1700, en boucles sur les épaules
    put(L, sphere(0.33, 1), col, 0, 2.16, -0.06, 0, 0.04);
    for (const s of [-1, 1]) put(L, sphere(0.2, 1).scale(1, 1.7, 1), col, s * 0.27, 1.92, -0.04, 0, 0.03);
  } else if (genre === 'poudre') {  // poudrée, rouleaux sur les oreilles, catogan noué de noir
    put(L, sphere(0.3, 1).scale(1, 0.85, 1), POUDRE, 0, 2.15, -0.06, 0, 0.03);
    for (const s of [-1, 1]) put(L, cyl(0.09, 0.09, 0.2, 8).rotateX(Math.PI / 2), POUDRE, s * 0.29, 2.04, -0.02, 0, 0.02);
    put(L, boite(0.12, 0.36, 0.1), POUDRE, 0, 1.86, -0.3, 0, 0.02); put(L, boite(0.18, 0.12, 0.08), NOIR, 0, 2.0, -0.31, 0, 0);
  } else put(L, sphere(0.29, 1).scale(1, 0.72, 1), col, 0, 2.2, -0.05, 0, 0.03);
}
const BICORNE = new THREE.CylinderGeometry(0.5, 0.5, 0.26, 12, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);  // un demi-disque debout
function chapeau(L, genre, col = NOIR) {
  if (genre === 'tricorne') { put(L, cyl(0.6, 0.44, 0.2, 3), col, 0, 2.42, 0, 0, 0.05); put(L, cyl(0.24, 0.28, 0.2, 10), col, 0, 2.56, 0, 0, 0.04); }  // bords relevés, une corne en avant
  else if (genre === 'bicorne') put(L, BICORNE, col, 0, 2.3, 0, 0, 0.05);  // en bataille
  else if (genre === 'colonne') { put(L, BICORNE.clone().rotateY(Math.PI / 2), col, 0, 2.3, 0, 0, 0.05); put(L, sphere(0.13, 0), BLANC, 0.06, 2.72, 0, 0, 0.02); }  // bicorne de cour et plumet
  else if (genre === 'haut') { put(L, cyl(0.42, 0.42, 0.05, 12), col, 0, 2.36, 0, 0, 0.04); put(L, cyl(0.25, 0.27, 0.58, 10), col, 0, 2.66, 0, 0, 0.05); }
  else if (genre === 'mou') { put(L, cyl(0.56, 0.56, 0.05, 12), col, 0, 2.36, 0, 0, 0.04); put(L, cyl(0.22, 0.28, 0.32, 10), col, 0, 2.52, 0, 0, 0.05); }
  else if (genre === 'rond') { put(L, cyl(0.58, 0.58, 0.06, 14), col, 0, 2.36, 0, 0, 0.04); put(L, new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, 0, 2.38, 0, 0, 0.04); }
}
// ------------------------------------------------------------------ les figurines : corps (C), tête et chapeau (T), bras droit (B)
const MODELES = {
  /** Manteau sombre au col relevé et écharpe du camp, tricorne (chapeau mou à partir de l'Empire), lanterne sourde à la main gauche. */
  espion(C, T, B, roy, ep, pas) {
    const vieux = ep === 'ancien' || ep === 'lumieres';
    jambes(C, 0x2b2b30, pas);
    put(C, cyl(0.34, vieux ? 0.64 : 0.5, 1.45, 8), SOMBRE, 0, 1.2, 0, 0, 0.07);  // la cape, puis la redingote
    put(C, cyl(0.3, 0.34, 0.18, 8), roy, 0, 1.95, 0, 0, 0.03);
    put(C, boite(0.2, 0.5, 0.22), SOMBRE, 0.47, 1.53, 0.02, 0, 0.05); put(C, boite(0.2, 0.2, 0.5), SOMBRE, 0.45, 1.3, 0.2, 0, 0.05); put(C, sphere(0.1, 0), PEAU, 0.45, 1.3, 0.5, 0, 0.03);  // le bras gauche plié
    put(C, boite(0.04, 0.14, 0.04), 0x3a3a40, 0.45, 1.2, 0.52, 0, 0); put(C, cone(0.18, 0.15, 8), 0x3a3a40, 0.45, 1.12, 0.52, 0, 0.02);
    put(C, cyl(0.16, 0.18, 0.36, 8), 0x3a3a40, 0.45, 0.87, 0.52, 0, 0.03); put(C, boite(0.17, 0.18, 0.05), 0xffd36a, 0.45, 0.87, 0.7, 0, 0);  // la lanterne et son volet entrouvert
    tete(T); cheveux(T, 'naturel'); chapeau(T, vieux ? 'tricorne' : 'mou', 0x181818);
    bras(B, EPAULE[0], SOMBRE, 0x22252e);
  },
  /** Habit brodé d'or à la couleur du camp, perruque (1700), cheveux poudrés (Lumières) ou naturels, épée au côté gauche. */
  gentilhomme(C, T, B, roy, ep, pas) {
    const vieux = ep === 'ancien' || ep === 'lumieres';
    jambes(C, ep === 'industrie' ? 0x3a3a44 : ep === 'empire' ? 0xe0d2a8 : BLANC, pas, ep === 'empire');
    put(C, boite(0.74, 1.0, 0.48), roy, 0, 1.4, 0, 0, 0.07);
    if (vieux) put(C, cyl(0.4, 0.53, 0.55, 8), roy, 0, 0.9, 0, 0, 0.05);  // les basques
    else { put(C, boite(0.6, 0.75, 0.1), roy, 0, 0.95, -0.24, 0, 0.04); put(C, boite(0.5, 0.18, 0.42), roy, 0, 1.94, 0, 0, 0.03); }  // queue-de-pie, col haut
    put(C, boite(0.3, 0.75, 0.04), vieux ? 0xe8d9a8 : BLANC, 0, 1.38, 0.25, 0, 0);  // le gilet
    for (const s of [-1, 1]) put(C, boite(0.06, 1.0, 0.03), OR, s * 0.19, 1.4, 0.255, 0, 0);  // les broderies
    if (vieux) for (const s of [-1, 1]) put(C, boite(0.2, 0.05, 0.03), OR, s * 0.25, 1.08, 0.255, 0, 0);
    put(C, boite(0.16, 0.2, 0.06), BLANC, 0, 1.78, 0.26, 0, 0.02);  // le jabot, la cravate
    put(C, boite(0.07, 0.07, 1.3).rotateX(-0.46), NOIR, 0.5, 0.77, -0.38, 0, 0.02);  // l'épée au fourreau
    put(C, boite(0.1, 0.06, 0.26), OR, 0.5, 1.07, 0.22, 0, 0.02); put(C, boite(0.05, 0.05, 0.2), OR, 0.5, 1.13, 0.36, 0, 0);
    bras(C, 0.47, roy, OR);
    tete(T); cheveux(T, ['perruque', 'poudre', 'naturel', 'naturel'][EPOQUES.indexOf(ep)]); chapeau(T, ['tricorne', 'tricorne', 'bicorne', 'haut'][EPOQUES.indexOf(ep)]);
    bras(B, EPAULE[0], roy, OR);
  },
  /** Soutane et pèlerine noires, ceinture à la couleur du camp, croix d'or sur la poitrine, chapeau rond, bréviaire. */
  pretre(C, T, B, roy, ep, pas) {
    const vieux = ep === 'ancien' || ep === 'lumieres';
    for (const s of [-1, 1]) put(C, boite(0.2, 0.12, 0.34), 0x4a3424, s * 0.13, 0.06, (s < 0 ? pas : -pas) * 0.6 + 0.12, 0, 0.03);
    put(C, cyl(0.3, 0.52, 1.78, 10).rotateX(pas * 0.2), NOIR, 0, 0.95, 0, 0, 0.07);  // (l'ourlet balance au pas)
    put(C, cyl(0.32, 0.45, 0.3, 10), 0x262626, 0, 1.72, 0, 0, 0.05);
    put(C, cyl(0.415, 0.415, 0.14, 10), roy, 0, 1.0, 0, 0, 0.03); put(C, boite(0.12, 0.45, 0.04), roy, 0.24, 0.76, 0.42, 0, 0.02);
    put(C, boite(0.1, 0.44, 0.05), OR, 0, 1.36, 0.37, 0, 0.02); put(C, boite(0.3, 0.1, 0.05), OR, 0, 1.46, 0.365, 0, 0.02);  // la croix
    if (vieux) put(C, boite(0.2, 0.16, 0.04), BLANC, 0, 1.8, 0.3, 0, 0.01);  // le rabat, puis le col romain
    else put(C, boite(0.12, 0.07, 0.03), BLANC, 0, 1.87, 0.27, 0, 0);
    bras(C, 0.47, NOIR, 0x262626); put(C, boite(0.26, 0.34, 0.1), 0x7a1f24, 0.42, 0.98, 0.22, 0, 0.03);
    tete(T); cheveux(T, 'naturel', 0x5a4632); chapeau(T, 'rond');
    bras(B, EPAULE[0], NOIR, 0x262626);
  },
  /** Habit de cour (brocart crème, puis uniforme bleu brodé d'or), écharpe en sautoir à la couleur du camp, porte-documents. */
  diplomate(C, T, B, roy, ep, pas) {
    const vieux = ep === 'ancien' || ep === 'lumieres', habit = vieux ? CREME : BLEU_COUR;
    jambes(C, ep === 'industrie' ? 0x2b2b30 : BLANC, pas);
    put(C, boite(0.74, 1.0, 0.48), habit, 0, 1.4, 0, 0, 0.07);
    put(C, cyl(0.4, 0.53, 0.55, 8), habit, 0, 0.9, 0, 0, 0.05); put(C, cyl(0.535, 0.535, 0.06, 8), OR, 0, 0.65, 0, 0, 0);
    for (const s of [-1, 1]) put(C, boite(0.08, 1.0, 0.03), OR, s * 0.19, 1.4, 0.255, 0, 0);
    if (!vieux) put(C, boite(0.52, 0.18, 0.42), OR, 0, 1.94, 0, 0, 0.03);
    put(C, boite(0.16, 0.2, 0.06), BLANC, 0, 1.78, 0.26, 0, 0.02);
    put(C, boite(0.2, 1.2, 0.54).rotateZ(0.62), roy, 0, 1.42, 0, 0, 0.03); put(C, sphere(0.12, 0), roy, 0.33, 1.0, 0.24, 0, 0.02);  // l'écharpe et son nœud
    bras(C, 0.47, habit, OR);
    put(C, boite(0.1, 0.5, 0.68), CUIR, 0.62, 1.3, 0.05, 0, 0.03); put(C, cyl(0.08, 0.08, 0.03, 10).rotateZ(Math.PI / 2), 0xb8322a, 0.675, 1.24, 0.2, 0, 0);  // le porte-documents et son sceau
    tete(T); cheveux(T, ['perruque', 'poudre', 'poudre', 'naturel'][EPOQUES.indexOf(ep)], ep === 'industrie' ? 0x9a948a : BRUN);
    chapeau(T, ['tricorne', 'tricorne', 'colonne', 'haut'][EPOQUES.indexOf(ep)]);
    bras(B, EPAULE[0], habit, OR);
  },
  // (les figurants des scènes)
  garde(C, T, B, roy, ep, pas) { fantassin(C, PALIERS[PALIER[ep]], 0, 0, roy, 'ligne', pas); },
  gens(C, T, B, roy, ep, pas, v) {
    const habit = [0x8a3a2a, 0x3a5a8a, 0x6a5a3a, 0xc9a24a, 0x5a7a4a, 0x7a4a6a][v % 6];
    for (const dx of [-0.15, 0.15]) put(C, boite(0.22, 0.85, 0.26), 0x5a4a3a, dx, 0.42, dx < 0 ? pas : -pas, 0, 0.05);
    put(C, cyl(0.32, 0.42, 1.0, 8), habit, 0, 1.3, 0, 0, 0.06);
    put(C, sphere(0.27, 1), PEAU, 0, 2.06, 0, 0, 0.05); put(C, sphere(0.28, 1).scale(1, 0.7, 1), [0x4a3322, 0x2f2c2a, 0x8a5a2a, 0xd9b060][v % 4], 0, 2.15, -0.04, 0, 0);
    bras(C, 0.47, habit, habit); bras(B, EPAULE[0], habit, habit);
  },
};
// les géométries de chaque figurine, assemblées une fois : deux corps (jambes en avant et en arrière), la tête et le bras droit
// (autour de leurs pivots) ; fus : tout dans le corps (qualité légère : une pièce de moins à dessiner, la figurine bouge d'un bloc)
const CACHE = new Map();
const fige2 = L => (L.g.length ? { g: fusion(L.g), o: L.o.length ? fusion(L.o) : null } : null);
function geos(type, roy, ep, v = 0, fus = false) {
  const k = `${type}|${roy}|${ep}|${v}|${fus ? 1 : 0}`;
  let r = CACHE.get(k);
  if (!r) {
    const fait = pas => {
      const C = lot(), T = lot(), B = lot(); MODELES[type](C, T, B, roy, ep, pas, v);
      if (fus) { C.g.push(...T.g, ...B.g); C.o.push(...T.o, ...B.o); T.g = []; T.o = []; B.g = []; B.o = []; }
      return { C, T, B };
    };
    const a = fait(0.2), b = fait(-0.2), decale = (L, x, y, z) => { for (const g of [...L.g, ...L.o]) g.translate(x, y, z); return L; };
    r = { A: fige2(a.C), B: fige2(b.C), tete: fige2(decale(a.T, 0, -COU, 0)), bras: fige2(decale(a.B, -EPAULE[0], -EPAULE[1], -EPAULE[2])) };
    CACHE.set(k, r);
  }
  return r;
}
// le décor des scènes et le socle, assemblés une fois chacun
const DECOR = new Map();
function cachee(cle, dessin) { let r = DECOR.get(cle); if (!r) { const L = lot(); dessin(L); r = fige2(L); DECOR.set(cle, r); } return r; }
/** Un groupe (pièces + contours) sur des géométries partagées ; parts : la figurine dont il prend le matériau (cachée, fondue). */
function maillage(r, parent, parts) {
  const o = new THREE.Group(), a = new THREE.Mesh(r.g, MAT); a.castShadow = true; o.add(a); parts?.mats.push(a);
  if (r.o) { const b = new THREE.Mesh(r.o, CONT); o.add(b); parts?.conts.push(b); }
  parent.add(o);
  return o;
}
const ETOILE = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.08 : 0.19, a = i * Math.PI / 5; if (i) s.lineTo(Math.sin(a) * r, Math.cos(a) * r); else s.moveTo(0, r); } return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }).rotateX(-Math.PI / 2); })();
function socle(L, roy, n) {
  put(L, cyl(1.2, 1.26, 0.1, 18), 0x2a2622, 0, 0.05, 0, 0, 0.04);
  put(L, cyl(1.08, 1.12, 0.07, 18), roy, 0, 0.13, 0, 0, 0);
  for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.42; put(L, ETOILE, OR, Math.sin(a) * 0.84, H_SOCLE, Math.cos(a) * 0.84, a, 0.015); }  // le niveau, devant
}

/** Une figurine : groupe (rotation 'YXZ' : cap, puis penché ou couché) > pied (rebond, posture) > corps A/B, tête, bras. */
function figure(type, roy, ep, { v = 0, fus = false, niveau = 0 } = {}) {
  const r = geos(type, roy, ep, v, fus), g = new THREE.Group(), pied = new THREE.Group();
  const P = { pied, mats: [], conts: [], y0: niveau ? H_SOCLE : 0 };
  P.A = maillage(r.A, pied, P); P.B = maillage(r.B, pied, P); P.B.visible = false;
  if (r.tete) { P.tete = maillage(r.tete, pied, P); P.tete.position.y = COU; }
  if (r.bras) { P.bras = maillage(r.bras, pied, P); P.bras.position.set(...EPAULE); P.bras.rotation.order = 'YXZ'; }
  if (niveau) maillage(cachee(`socle|${roy}|${niveau}`, L => socle(L, roy, niveau)), g).children[0].receiveShadow = true;
  pied.position.y = P.y0; g.add(pied); g.rotation.order = 'YXZ';
  g.userData = { parts: P, type, marche: false, cache: false, _cache: false, phase: 0 };
  return g;
}

// ------------------------------------------------------------------ marques face à la caméra : œil barré, issue, alerte
const SIGNES = {
  oeil(g) {
    rond(g, 'rgba(242,239,230,.92)'); g.lineWidth = 6; g.strokeStyle = '#24180f';
    g.beginPath(); g.moveTo(20, 48); g.quadraticCurveTo(48, 20, 76, 48); g.quadraticCurveTo(48, 76, 20, 48); g.stroke();
    g.fillStyle = '#24180f'; g.beginPath(); g.arc(48, 48, 9, 0, 7); g.fill();
    g.strokeStyle = '#c0392b'; g.lineWidth = 9; g.beginPath(); g.moveTo(24, 72); g.lineTo(72, 24); g.stroke();
  },
  ok(g) { rond(g, '#3f9b4a'); g.lineWidth = 11; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.beginPath(); g.moveTo(28, 50); g.lineTo(42, 64); g.lineTo(68, 32); g.stroke(); },
  non(g) { rond(g, '#c0392b'); g.lineWidth = 11; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32); g.lineTo(64, 64); g.moveTo(64, 32); g.lineTo(32, 64); g.stroke(); },
  alerte(g) { rond(g, '#ffb02e'); g.fillStyle = '#24180f'; g.fillRect(41, 20, 14, 36); g.beginPath(); g.arc(48, 70, 8, 0, 7); g.fill(); },
};
const MATS_SIGNE = new Map();
function signe(nom, taille = 1.2) {
  let m = MATS_SIGNE.get(nom);
  if (!m) {
    const c = document.createElement('canvas'); c.width = c.height = 96; SIGNES[nom](c.getContext('2d'));
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }); MATS_SIGNE.set(nom, m);
  }
  const s = new THREE.Sprite(m); s.scale.setScalar(taille); s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ les agents posés
const AGENTS = new Set();
const MAT_FANTOME = MAT.clone(); MAT_FANTOME.transparent = true; MAT_FANTOME.opacity = 0.38; MAT_FANTOME.depthWrite = true;
let nAgents = 0;
/** Un agent sur la carte (face à +z) : THREE.Group à l'échelle 0,1, ses géométries en cache par type, couleur et époque.
 *  type : 'espion', 'gentilhomme', 'pretre' ou 'diplomate' ; epoque : 'ancien', 'lumieres', 'empire' ou 'industrie' ; niveau (1 à 5) :
 *  les étoiles du socle ; leger : la figurine d'un bloc (par défaut, la qualité légère). Animé tant qu'il est dans la scène (masqué, il
 *  ne coûte rien) : au repos il regarde alentour et ajuste son chapeau ; userData.marche (vrai : il marche au pas) et userData.cache
 *  (vrai : silhouette translucide et œil barré) se changent à tout moment, sans rien rebâtir. À jeter par jeterAgent. */
export function maillageAgent({ type = 'espion', couleur = '#3b6fd1', epoque = 'ancien', marche = false, cache = false, niveau = 1, leger = qualite.niveau === 'leger' } = {}) {
  const t = TYPES_AGENT.includes(type) ? type : 'espion', ep = EPOQUES.includes(epoque) ? epoque : 'ancien', n = Math.max(1, Math.min(5, niveau | 0));
  const g = figure(t, couleur, ep, { fus: leger, niveau: n });
  g.scale.setScalar(ECH_BAT);
  Object.assign(g.userData, { agent: true, niveau: n, marche: !!marche, cache: !!cache, phase: (nAgents++ * 2.3) % 9 });
  g.addEventListener('added', () => AGENTS.add(g));  // (retiré de la scène, il n'est plus animé ; remis, il l'est de nouveau)
  return g;
}
/** Retire un agent de la scène (ses géométries restent en cache, partagées). */
export function jeterAgent(grp) { if (!grp) return; grp.parent?.remove(grp); AGENTS.delete(grp); }

function cacher(g, oui) {
  const u = g.userData, P = u.parts;
  for (const m of P.mats) { m.material = oui ? MAT_FANTOME : MAT; m.castShadow = !oui; }
  for (const m of P.conts) m.visible = !oui;
  if (oui && !u.oeil) { u.oeil = signe('oeil', 1.1); g.add(u.oeil); }
  if (u.oeil) u.oeil.visible = oui;
}
function animerAgent(g, t) {
  const u = g.userData, P = u.parts, h = t + u.phase, pas = Math.sin(h * 3.2 * Math.PI);
  if (u.cache !== u._cache) cacher(g, u._cache = !!u.cache);
  if (u.oeil?.visible) u.oeil.position.y = 3.4 + Math.sin(h * 2.4) * 0.08;
  P.A.visible = !(u.marche && (h * 3.2) % 2 >= 1); P.B.visible = !P.A.visible;
  P.pied.position.y = P.y0 + (u.marche ? Math.abs(pas) * 0.1 : 0);
  P.tete?.rotation.set(0, 0, 0);
  P.bras?.rotation.set(u.marche ? pas * 0.5 : 0, 0, 0);
  if (u.pilote) { P.pied.scale.y = 1; return; }  // (figurant d'une scène : elle le pose elle-même après)
  if (u.marche) { P.pied.rotation.y = 0; return; }
  if (!P.tete) { P.pied.rotation.y = Math.sin(h * 0.5) * 0.5; return; }  // d'un bloc : la figurine entière regarde alentour
  const c = h % 9, k = lisse(5, 5.6, c) - lisse(6.8, 7.4, c);
  P.tete.rotation.y = 0.65 * lisse(0.5, 1.2, c) - 1.3 * lisse(1.8, 2.8, c) + 0.65 * lisse(3.3, 4, c);  // à gauche, à droite, devant
  if (u.type === 'pretre') P.bras.rotation.set(k * (-1.3 + Math.sin(h * 3) * 0.2), 0, k * Math.sin(h * 3 + 1.6) * 0.2);  // il bénit
  else { P.bras.rotation.set(k * 0.3, 0, k * 2.7); P.tete.rotation.x = k * 0.08; }  // la main au chapeau
}

// ------------------------------------------------------------------ scènes de mission
const MISSIONS = [];
const GEO_ECLAT = new THREE.OctahedronGeometry(0.11, 0), GEO_FUMEE = new THREE.IcosahedronGeometry(0.32, 1);
const MATS_PART = {
  eclat: new THREE.MeshBasicMaterial({ color: 0xffd36a }), rouge: new THREE.MeshBasicMaterial({ color: 0xd83a2a }),
  blanche: toon(0xe8e4dc, { transparent: true, opacity: 0.7, depthWrite: false }), noire: toon(0x3a3632, { transparent: true, opacity: 0.75, depthWrite: false }),
};
const GEO_FEUILLE = new THREE.PlaneGeometry(0.8, 0.6), MAT_FEUILLE = toon(0xf6f2e6, { side: THREE.DoubleSide });
/** Une particule de la scène : étincelle ('eclat', 'rouge') qui jaillit et retombe, ou bouffée ('blanche', 'noire') qui monte et s'étale. */
function particule(M, genre, x, y, z, k = 1) {
  if (qualite.part < 1 && Math.random() > qualite.part) return;  // qualité légère : moins de particules
  const vif = genre === 'eclat' || genre === 'rouge', m = new THREE.Mesh(vif ? GEO_ECLAT : GEO_FUMEE, MATS_PART[genre]), a = Math.random() * 6.28;
  m.position.set(x, y, z); M.racine.add(m);
  M.parts.push(vif ? { m, v: [Math.cos(a) * 2.5 * k, 1.5 + Math.random() * 2.5 * k, Math.sin(a) * 2.5 * k], vie: 0.45, age: 0, g: 9, k: 1 }
    : { m, v: [(Math.random() - 0.5) * 0.3, 0.9, (Math.random() - 0.5) * 0.3], vie: 1.8, age: 0, g: 0, k, fumee: true });
}
/** Un figurant de la scène, posé en (x, z) et tourné de ry (face à +z à 0). */
function fig(M, type, roy, x, z, ry, v = 0) {
  const g = figure(type, roy, M.ep, { v });
  g.position.set(x, 0, z); g.rotation.y = ry; g.userData.pilote = true;
  M.racine.add(g); M.figures.push(g); AGENTS.add(g);
  return g;
}
/** Marche de (x0, z0) à (x1, z1) entre les instants a et b (parts de la durée), tourné vers où il va ; rend la part du trajet faite. */
function aller(g, x0, z0, x1, z1, u, a, b) {
  const f = Math.max(0, Math.min(1, (u - a) / (b - a)));
  g.position.x = x0 + (x1 - x0) * f; g.position.z = z0 + (z1 - z0) * f;
  g.userData.marche = f > 0 && f < 1;
  if (g.userData.marche) g.rotation.y = Math.atan2(x1 - x0, z1 - z0);
  return f;
}
const accroupi = (g, k) => { g.userData.parts.pied.scale.y = 1 - 0.28 * k; g.rotation.x = 0.3 * k; };
/** Un matériau propre à une figurine, pour la faire fondre (opacity) ou l'assombrir (color) ; libéré avec la scène. */
function fondu(M, g) {
  const m = MAT.clone(); m.transparent = true; m.depthWrite = false; M.mats.push(m);
  for (const o of g.userData.parts.mats) { o.material = m; o.castShadow = false; }
  for (const o of g.userData.parts.conts) o.visible = false;
  return m;
}
/** Une lame dans la main droite (le long du bras pendant) : épée, ou dague (longueur courte). */
const lame = (g, long = 1.3) => maillage(cachee('lame|' + long, L => { put(L, boite(0.05, long, 0.05), ACIER, 0, -0.86 - long / 2, 0, 0, 0.02); put(L, boite(0.26, 0.05, 0.1), OR, 0, -0.86, 0, 0, 0.02); }), g.userData.parts.bras, g.userData.parts);
const posa = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// chaque scène : durée par défaut (ms) et jouer(M) qui pose le décor et les figurants (unités de web_power, centrés sur l'origine,
// face à la caméra, à peu près une case) et rend maj(u, pu, t, dt) (u : part de la durée écoulée, pu : celle de l'image d'avant) ;
// M.ici : où poser la marque de l'issue (✓ réussite, ✗ échec), qui paraît aux trois quarts
const SCENES = {
  // deux gentilshommes en garde, quelques assauts (les lames se croisent, étincelles), une fente : l'un tombe, l'autre salue
  duel: { duree: 5200, jouer(M) {
    const A = fig(M, 'gentilhomme', M.a, -1.3, 0, Math.PI / 2), B = fig(M, 'gentilhomme', M.b, 1.3, 0, -Math.PI / 2);
    lame(A); lame(B);
    const [gagne, perd] = M.reussite ? [A, B] : [B, A], cg = Math.sign(gagne.position.x), cp = -cg;
    M.ici = [cg * 1.3, 3.7, 0];
    return (u, pu, t) => {
      const garde = lisse(0.03, 0.1, u);
      if (u < 0.6) [A, B].forEach((g, i) => {
        const assaut = u > 0.1 ? Math.max(0, Math.sin(t * 7 + i * Math.PI)) : 0;
        g.position.x = (i ? 1 : -1) * (1.3 - assaut * 0.35);
        g.userData.parts.bras.rotation.set(-2.6 + 1.1 * garde + assaut * 0.12, 0.27 * garde, 0);
      });
      else {
        const f = lisse(0.6, 0.65, u) - lisse(0.68, 0.76, u) * 0.6, c = lisse(0.64, 0.74, u), salut = lisse(0.78, 0.86, u);
        gagne.position.x = cg * (1.3 - f * 0.6);
        gagne.userData.parts.bras.rotation.set(-1.5 - f * 0.1 - salut * 1.3, 0.27 * (1 - salut), 0);
        perd.position.x = cp * (1.3 + c * 0.3); perd.rotation.x = -1.45 * c;
        perd.userData.parts.bras.rotation.set(-1.5 * (1 - c), 0, 0.6 * c);
      }
      for (const k of [0.17, 0.25, 0.33, 0.41, 0.49, 0.57]) if (franchit(pu, u, k)) for (let i = 0; i < 8; i++) particule(M, 'eclat', 0, 1.85, 0, 0.8);
      if (franchit(pu, u, 0.645)) for (let i = 0; i < 9; i++) particule(M, 'eclat', cp * 1.1, 1.6, 0, 0.7);
    };
  } },
  // l'espion se glisse au pied de la palissade, allume la mèche (étincelles) et s'enfuit ; réussite : le feu prend, fumée noire, les
  // pieux tombent l'un après l'autre ; échec : la mèche fait long feu (une bouffée blanche), l'alerte est donnée, la palissade tient
  sabotage: { duree: 5600, jouer(M) {
    const pieu = traverses => cachee('pieu' + traverses, L => { put(L, boite(0.3, 2.2, 0.3), BOIS, 0, 1.1, 0, 0, 0.05); put(L, cone(0.22, 0.45, 4), BOIS, 0, 2.42, 0, Math.PI / 4, 0.04); if (traverses) for (const y of [0.7, 1.7]) put(L, boite(0.66, 0.16, 0.14), 0x6b4a2b, 0.33, y, -0.2, 0, 0.02); });
    const n = M.leger ? 4 : 5, pieux = Array.from({ length: n }, (_, i) => posa(maillage(pieu(i < n - 1), M.racine), 0.9 + (i - (n - 1) / 2) * 0.66, 0, -0.7));  // de face, derrière
    drapeau(pieux[n >> 1], M.b, 0, 2.3, 0, 0.8, 0.5);
    const E = fig(M, 'espion', M.a, -3.4, 0.8, Math.PI / 2), f = feu(M.racine, 0.5, 0, -0.45, 3.5), alerte = posa(signe('alerte'), 0.9, 3.6, -0.7);
    M.feux.push(f); alerte.visible = false; M.racine.add(alerte);
    M.ici = [0.9, 3.8, -0.7];
    return (u, pu, t, dt) => {
      if (u < 0.26) aller(E, -3.4, 0.8, -0.9, 0, u, 0, 0.26);
      else if (u < 0.46) { E.userData.marche = false; E.rotation.y = 2.36; E.userData.parts.bras.rotation.set(-0.9, 0, 0); if (u > 0.3) particule(M, 'eclat', -0.4, 0.3, -0.5, 0.35); }
      else aller(E, -0.9, 0, -3.6, 1.2, u, 0.46, 0.64);
      accroupi(E, u > 0.26 && u < 0.46 ? lisse(0.26, 0.3, u) : 0);
      if (M.reussite) {
        f.visible = u > 0.46; f.scale.setScalar(3.5 * lisse(0.46, 0.52, u) * (1 - lisse(0.88, 0.98, u)) + 0.01);
        if (u > 0.47 && u < 0.92 && Math.random() < dt * 9) particule(M, 'noire', Math.random() * 2, 1.0, -0.7, 1.4);
        pieux.forEach((p, i) => { p.rotation.x = 1.45 * lisse(0.54 + i * 0.05, 0.6 + i * 0.05, u); });  // ils tombent l'un après l'autre
      } else {
        if (franchit(pu, u, 0.46)) for (let i = 0; i < 4; i++) particule(M, 'blanche', -0.4, 0.4, -0.5, 0.6);
        alerte.visible = u > 0.5 && u < 0.72; alerte.position.y = 3.6 + Math.abs(Math.sin(t * 6)) * 0.2;
      }
    };
  } },
  // une silhouette sombre approche dans le dos de la cible et frappe ; réussite : la cible s'efface ; échec : elle se retourne,
  // l'alerte est donnée, elle pare (étincelles) et la silhouette s'enfuit
  assassinat: { duree: 4800, jouer(M) {
    const C = fig(M, 'gentilhomme', M.b, 1.0, 0.2, 0), S = fig(M, 'espion', M.a, -3.4, -0.5, Math.PI / 2);
    lame(S, 0.5);
    const ombre = fondu(M, S); ombre.color.setScalar(0.18); ombre.opacity = 0.7;
    const epee = M.reussite ? null : lame(C), cible = M.reussite ? fondu(M, C) : null, alerte = posa(signe('alerte'), 1.0, 3.6, 0.2);
    if (epee) epee.visible = false;
    alerte.visible = false; M.racine.add(alerte);
    M.ici = [1.0, 3.8, 0.2];
    return (u, pu, t) => {
      const PC = C.userData.parts, PS = S.userData.parts;
      if (u < 0.46) aller(S, -3.4, -0.5, 0.05, -0.15, u, 0, 0.46);
      else if (u < 0.56) { S.userData.marche = false; S.rotation.y = Math.PI / 2 - 0.15; PS.bras.rotation.set(-1.5 * lisse(0.46, 0.5, u), 0, 0); }
      else aller(S, 0.05, -0.15, -3.6, -0.7, u, 0.58, 0.85);
      if (u < 0.4) PC.tete.rotation.y = Math.sin(t * 0.9) * 0.5;
      if (M.reussite) {
        if (franchit(pu, u, 0.5)) for (let i = 0; i < 8; i++) particule(M, 'rouge', 0.9, 1.5, 0.1, 0.5);
        const k = lisse(0.52, 0.8, u);
        cible.opacity = 1 - k; C.rotation.x = 0.5 * lisse(0.5, 0.66, u); C.visible = k < 1;
        ombre.opacity = 0.7 * (1 - lisse(0.84, 0.95, u));
      } else {
        C.rotation.y = -Math.PI / 2 * lisse(0.38, 0.45, u); epee.visible = u > 0.44;
        if (u > 0.44) PC.bras.rotation.set(-1.6, 0.25, 0);
        alerte.visible = u > 0.4 && u < 0.72; alerte.position.y = 3.6 + Math.abs(Math.sin(t * 6)) * 0.2;
        if (franchit(pu, u, 0.5)) for (let i = 0; i < 8; i++) particule(M, 'eclat', 0.5, 1.8, -0.1, 0.6);
        ombre.opacity = 0.7 * (1 - lisse(0.75, 0.86, u));
      }
    };
  } },
  // l'espion, accroupi derrière un buisson, observe la table du camp adverse ; une feuille s'envole : réussite, elle vient à sa main
  // et il repart avec ; échec, le vent l'emporte au loin, le garde se retourne, l'alerte est donnée et l'espion s'enfuit
  espionnage: { duree: 5200, jouer(M) {
    posa(maillage(cachee('table', L => { put(L, boite(1.4, 0.12, 0.9), 0x9a6a3a, 0, 0.95, 0, 0, 0.04); for (const [x, z] of [[-0.6, -0.36], [0.6, -0.36], [-0.6, 0.36], [0.6, 0.36]]) put(L, boite(0.1, 0.9, 0.1), 0x6b4a2b, x, 0.45, z, 0, 0.02); put(L, boite(0.5, 0.04, 0.36), 0xf6f2e6, 0.25, 1.03, -0.1, 0.3, 0); put(L, cyl(0.07, 0.09, 0.16, 8), 0x2b2b30, -0.4, 1.09, 0.15, 0, 0.02); }), M.racine), 1.6, 0, -0.3);
    posa(maillage(cachee('buisson', L => { put(L, sphere(0.7, 1).scale(1, 0.85, 1), 0x4c8a3a, 0, 0.55, 0, 0, 0.05); put(L, sphere(0.55, 1), 0x5fae3e, 0.1, 0.9, 0.35, 0, 0.04); }), M.racine), -0.55, 0, 0.15);
    const mat = posa(maillage(cachee('hampe', L => put(L, boite(0.08, 2.6, 0.08), 0x4a3420, 0, 1.3, 0, 0, 0.02)), M.racine), 2.5, 0, -0.9);
    drapeau(mat, M.b, 0, 2.3, 0, 0.9, 0.6);
    const G = fig(M, 'garde', M.b, 2.4, 0.5, 0), E = fig(M, 'espion', M.a, -1.4, 0, Math.PI / 2);
    const feuille = posa(new THREE.Mesh(GEO_FEUILLE, MAT_FEUILLE), 1.85, 1.04, -0.4), alerte = posa(signe('alerte'), 2.4, 3.5, 0.5);
    feuille.rotation.x = -Math.PI / 2; M.racine.add(feuille, alerte); alerte.visible = false;
    M.ici = [-1.4, 3.6, 0];
    return (u, pu, t) => {
      const PE = E.userData.parts, k = lisse(0.3, 0.6, u);
      const debout = M.reussite ? 0.62 : 0.6;
      accroupi(E, u < debout ? 1 : 0); if (u < debout) PE.tete.rotation.y = Math.sin(t * 1.3) * 0.25;
      if (M.reussite) {
        if (u < 0.6) { posa(feuille, 1.85 + (-1.0 - 1.85) * k, 1.04 + (1.0 - 1.04) * k + Math.sin(k * Math.PI) * 1.6, -0.4 + 0.8 * k); feuille.rotation.set(-Math.PI / 2 + Math.sin(t * 9) * 0.6 * (k > 0 && k < 1), 0, k * 8); }
        else if (feuille.parent !== E) { E.add(feuille); posa(feuille, 0.55, 0.95, 0.35).rotation.set(0.3, 0, 0.2); }
        if (u > 0.55 && u < 0.66) PE.bras.rotation.set(-1.2, 0, 0);
        aller(E, -1.4, 0, -3.6, 0.6, u, 0.66, 0.95); M.ici = [E.position.x, 3.6, E.position.z];
      } else {
        posa(feuille, 1.85 + k * 1.2 + lisse(0.5, 0.85, u) * 2, 1.04 + Math.sin(k * Math.PI * 0.8) * 2.2 + lisse(0.5, 0.85, u) * 1.5, -0.4 + k * 2);
        feuille.rotation.set(-Math.PI / 2 + Math.sin(t * 9) * 0.8, t * 3, k * 10); feuille.visible = u < 0.85;
        G.rotation.y = -Math.PI / 2 * lisse(0.52, 0.58, u);
        alerte.visible = u > 0.55 && u < 0.72; M.ici = [2.4, 3.5, 0.5]; alerte.position.y = 3.5 + Math.abs(Math.sin(t * 6)) * 0.2;
        aller(E, -1.4, 0, -3.8, 0.9, u, 0.6, 0.82);
      }
    };
  } },
  // la cloche sonne, le prêtre bénit une petite foule agitée (sauts, poings levés) ; réussite : elle se calme et s'incline ;
  // échec : elle s'agite de plus belle et s'avance
  apaisement: { duree: 6000, jouer(M) {
    posa(maillage(cachee('clocher', L => { for (const x of [-0.55, 0.55]) put(L, boite(0.2, 3.1, 0.2), 0x6b4a2b, x, 1.55, 0, 0, 0.03); put(L, boite(1.5, 0.2, 0.26), 0x6b4a2b, 0, 3.1, 0, 0, 0.03); put(L, cone(0.95, 0.6, 4), 0xa8553a, 0, 3.5, 0, Math.PI / 4, 0.04); }), M.racine), -2.3, 0, -0.6);
    const cloche = posa(new THREE.Group(), -2.3, 2.95, -0.6); M.racine.add(cloche);
    maillage(cachee('cloche', L => { put(L, cyl(0.18, 0.42, 0.62, 10), 0xc9a24a, 0, -0.38, 0, 0, 0.04); put(L, sphere(0.09, 0), 0x3a3a3a, 0, -0.75, 0, 0, 0); }), cloche);
    const P = fig(M, 'pretre', M.a, -1.1, 0.3, Math.PI / 2), n = M.leger ? 3 : 6;
    const X = i => 0.6 + (i % 3) * 0.85 + (i > 2 ? 0.45 : 0), foule = Array.from({ length: n }, (_, i) => fig(M, 'gens', M.b, X(i), i > 2 ? -0.6 : 0.5, -Math.PI / 2 + (i % 3 - 1) * 0.3, i));
    const alerte = posa(signe('alerte'), 1.9, 3.6, 0); M.racine.add(alerte);
    M.ici = [-1.1, 3.8, 0.3];
    return (u, pu, t) => {
      cloche.rotation.z = Math.sin(t * 6) * 0.7 * lisse(0.06, 0.12, u) * (1 - lisse(0.5, 0.58, u));
      const b = lisse(0.15, 0.2, u) * (1 - lisse(0.62, 0.68, u));
      P.userData.parts.bras.rotation.set(b * (-1.3 + Math.sin(t * 3) * 0.2), 0, b * Math.sin(t * 3 + 1.6) * 0.2);
      const calme = M.reussite ? lisse(0.42, 0.62, u) : 0, agite = (1 - calme) * (M.reussite ? 1 : 1 + lisse(0.5, 0.9, u) * 0.5);
      foule.forEach((g, i) => {
        g.position.y = Math.abs(Math.sin(t * 8 + i * 1.7)) * 0.3 * agite;
        g.userData.parts.bras.rotation.set(0, 0, -(2.7 + Math.sin(t * 9 + i) * 0.3) * Math.min(1, agite));  // le poing levé
        g.rotation.x = M.reussite ? 0.35 * lisse(0.66, 0.78, u) : 0;
        if (!M.reussite) g.position.x = X(i) - lisse(0.55, 0.9, u) * 0.5;
      });
      alerte.visible = !M.reussite || u < 0.5; alerte.position.y = 3.6 + Math.abs(Math.sin(t * 6)) * 0.2 * agite;
    };
  } },
  // le diplomate arrive devant son hôte ; réussite : on hisse ses couleurs au mât, révérence de part et d'autre ; échec : le drapeau
  // monte à mi-mât et redescend, l'hôte tourne le dos, le diplomate s'en va
  diplomate: { duree: 5600, jouer(M) {
    posa(maillage(cachee('mat', L => { put(L, boite(0.12, 4.8, 0.12), 0x4a3420, 0, 2.4, 0, 0, 0.03); put(L, sphere(0.14, 0), OR, 0, 4.86, 0, 0, 0.02); put(L, boite(0.7, 0.2, 0.7), 0x9a948a, 0, 0.1, 0, 0, 0.03); }), M.racine), 0.4, 0, -1.0);
    const dr = drapeau(M.racine, M.a, 0.46, 1.0, -1.0, 1.3, 0.85);
    const H = fig(M, 'gentilhomme', M.b, 1.5, 0.1, -Math.PI / 2), D = fig(M, 'diplomate', M.a, -3.4, 0.3, Math.PI / 2);
    M.ici = [-0.6, 3.8, 0.2];
    return u => {
      if (u < 0.34) aller(D, -3.4, 0.3, -0.6, 0.2, u, 0, 0.32);
      if (M.reussite) {
        dr.position.y = 1.0 + 3.3 * lisse(0.34, 0.6, u);
        const k = lisse(0.6, 0.66, u) - lisse(0.74, 0.8, u);
        D.rotation.x = 0.5 * k; H.rotation.x = 0.4 * k;
        D.userData.parts.bras.rotation.set(-1.1 * k, 0, 0.5 * k); H.userData.parts.bras.rotation.set(-0.9 * k, 0, 0);
      } else {
        dr.position.y = 1.0 + 1.6 * (lisse(0.34, 0.48, u) - lisse(0.5, 0.6, u));
        H.rotation.y = -Math.PI / 2 + Math.PI * lisse(0.58, 0.64, u);
        if (u > 0.34) aller(D, -0.6, 0.2, -3.6, 0.6, u, 0.68, 0.98);
      }
    };
  } },
  // l'alerte, deux gardes du camp adverse accourent et l'encadrent ; échec : ils l'emmènent ; réussite : il file avant qu'ils
  // n'arrivent et se fond dans l'ombre, les gardes cherchent autour d'eux
  pris: { duree: 5200, jouer(M) {
    const A = fig(M, TYPES_AGENT.includes(M.agent) ? M.agent : 'espion', M.a, -0.4, 0.1, 0);
    const G = [3.4, -3.4].map(x => fig(M, 'garde', M.b, x, 0.2, -Math.sign(x) * Math.PI / 2)), alerte = signe('alerte');  // un de chaque côté
    const ombre = M.reussite ? fondu(M, A) : null, X = [0.4, -1.2];
    M.racine.add(alerte); M.ici = [-0.4, 3.8, 0.1];
    return (u, pu, t) => {
      const PA = A.userData.parts;
      alerte.visible = u > 0.08 && u < 0.45; posa(alerte, A.position.x, 3.6 + Math.abs(Math.sin(t * 6)) * 0.2, A.position.z);
      if (u < 0.45) G.forEach((g, i) => aller(g, i ? -3.4 : 3.4, 0.2, X[i], 0.1, u, 0.1, 0.42));
      if (!M.reussite) {  // encadré, puis emmené, tête basse, entre les deux gardes
        if (u < 0.45) { PA.tete.rotation.y = Math.sin(t * 4) * 0.6 * (u < 0.3); A.rotation.y = Math.PI / 2 * lisse(0.3, 0.38, u); }
        else { PA.tete.rotation.x = 0.35; aller(A, -0.4, 0.1, 2.6, 0.1, u, 0.48, 0.95); G.forEach((g, i) => aller(g, X[i], 0.1, X[i] + 3, 0.1, u, 0.48, 0.95)); }
        M.ici = [A.position.x, 3.8, A.position.z];
      } else {  // il file vers le fond et se fond dans l'ombre ; les gardes cherchent autour d'eux
        if (u < 0.3) PA.tete.rotation.y = Math.sin(t * 4) * 0.6;
        aller(A, -0.4, 0.1, -0.6, -3.4, u, 0.3, 0.55);
        ombre.opacity = 1 - 0.75 * lisse(0.42, 0.6, u);
        if (u > 0.45) G.forEach((g, i) => { g.rotation.y = (i ? 1 : -1) * Math.PI / 2 + Math.sin(t * 3 + i * 2) * 1.2; });
        M.ici = [-0.6, 3.6, -3.4];
      }
    };
  } },
};
export const TYPES_MISSION = Object.keys(SCENES);

/** Joue une scène courte de mission au point donné et rend sa durée (ms ; 0 pour un type inconnu). Le décor et les figurants y
 *  sont posés puis retirés tout seuls à la fin (géométries en cache, le reste libéré). type : 'duel', 'sabotage', 'assassinat',
 *  'espionnage', 'apaisement', 'diplomate' (diplomate reçu) ou 'pris' (agent pris) ; position : { x, y, z } ou [x, y, z] (sinon
 *  case : une case du plateau) ; couleurs : [camp de l'agent, camp adverse] ; reussite : la mission de l'agent réussit (pour « pris » :
 *  il s'échappe ; sinon les gardes l'emmènent) ; duree : en ms ; epoque : les habits ; echelle : celle des figurines (0,1 comme les
 *  agents ; un jeu qui grossit ses troupes passe la même) ; cap : rotation de la scène autour de y (0 : les acteurs de profil pour la
 *  caméra du plateau) ; agent : le type de l'agent pris ; parent : où la poser (la scène par défaut). */
export function sceneMission({ type, position, case: c, couleurs = ['#3b6fd1', '#c0392b'], reussite = true, duree, epoque = 'ancien', echelle = ECH_BAT, cap = 0, agent = 'espion', parent = scene } = {}) {
  const S = SCENES[type];
  if (!S) return 0;
  const racine = new THREE.Group();
  if (position) { const [x, y, z] = Array.isArray(position) ? position : [position.x, position.y, position.z]; racine.position.set(x || 0, y || 0, z || 0); }
  else if (c != null) { const p = posCase(c); racine.position.set(p.x, dessus(c), p.z); }
  racine.scale.setScalar(echelle); racine.rotation.y = cap; parent.add(racine);
  const M = { racine, a: couleurs[0], b: couleurs[1] || '#8a8a8a', ep: EPOQUES.includes(epoque) ? epoque : 'ancien', reussite: !!reussite, agent, leger: qualite.niveau === 'leger', figures: [], feux: [], mats: [], parts: [], ici: [0, 3.6, 0], pu: 0 };
  M.maj = S.jouer(M); M.ms = Math.max(1000, +duree || S.duree); M.t0 = performance.now();
  MISSIONS.push(M);
  return M.ms;
}
/** Arrête et retire toutes les scènes de mission en cours (changement de vue, fin de partie). */
export function finirMissions() { for (const M of MISSIONS.splice(0)) finir(M); }
function finir(M) {
  M.racine.parent?.remove(M.racine);
  for (const g of M.figures) AGENTS.delete(g);
  for (const f of M.feux) oublierFeu(f);
  for (const m of M.mats) m.dispose();
}
function jouer(M, now, dt, t) {
  const u = (now - M.t0) / M.ms;
  if (u >= 1 || !M.racine.parent) { finir(M); return false; }
  M.maj(u, M.pu, t, dt); M.pu = u;
  for (let i = M.parts.length - 1; i >= 0; i--) {
    const p = M.parts[i], m = p.m;
    if ((p.age += dt) > p.vie) { M.racine.remove(m); M.parts.splice(i, 1); continue; }
    m.position.x += p.v[0] * dt; m.position.y += p.v[1] * dt; m.position.z += p.v[2] * dt; p.v[1] -= p.g * dt;
    const w = p.age / p.vie;
    m.scale.setScalar(p.fumee ? p.k * (1 + p.age * 1.2) * (1 - w * w * w) : 1 - w);
  }
  if (u > 0.72) {
    if (!M.issue) { M.issue = signe(M.reussite ? 'ok' : 'non', 1.4); M.racine.add(M.issue); }
    const k = lisse(0.72, 0.78, u);
    M.issue.position.set(M.ici[0], M.ici[1] + k * 0.4, M.ici[2]); M.issue.scale.setScalar(1.4 * Math.max(0.01, Math.min(1, k * 1.3)));
  }
  return true;
}

// ------------------------------------------------------------------ chaque image : les agents (figurants compris), puis les scènes
chaqueImage((dt, t) => {
  for (const g of AGENTS) { if (!g.parent) { AGENTS.delete(g); continue; } if (g.visible) animerAgent(g, t); }
  const now = performance.now();
  for (let i = MISSIONS.length - 1; i >= 0; i--) if (!jouer(MISSIONS[i], now, dt, t)) MISSIONS.splice(i, 1);
});
