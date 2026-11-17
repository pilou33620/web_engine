// Les modèles low-poly : bâtiments (style selon l'époque, toits aux couleurs du royaume, champs selon la saison)
// et armées (habits du royaume, coiffure de l'époque : tricorne, bicorne, shako).
// Chaque modèle est fusionné en un seul maillage (un seul appel de dessin), mis en cache par variante.
import { THREE, hache } from './scene.js';
import { fusion, piece, MAT_LISSE } from './plateau.js';

const G = {
  boite: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 10).translate(0, 0.5, 0),
  pyr: new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  boule: new THREE.IcosahedronGeometry(0.5, 1),
  dome: new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  disque: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  pignon: (() => {
    const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0], v = [];
    const t = (a, b, c) => v.push(...a, ...b, ...c);
    t(A, E, F); t(A, F, B); t(D, F, E); t(D, C, F); t(A, D, E); t(B, F, C);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
  })(),
  mansarde: (() => {
    // toit à la Mansart : brisis raide puis terrasson
    const v = [], P = (x, y, z) => [x, y, z];
    const b = [P(-0.5, 0, -0.5), P(0.5, 0, -0.5), P(0.5, 0, 0.5), P(-0.5, 0, 0.5)];
    const m = [P(-0.42, 0.6, -0.36), P(0.42, 0.6, -0.36), P(0.42, 0.6, 0.36), P(-0.42, 0.6, 0.36)];
    const h = [P(-0.3, 1, 0), P(0.3, 1, 0)];
    const q = (a, b2, c, d) => v.push(...a, ...b2, ...c, ...a, ...c, ...d);
    for (let k = 0; k < 4; k++) q(b[k], b[(k + 1) % 4], m[(k + 1) % 4], m[k]);
    q(m[0], m[1], h[1], h[0]); q(m[2], m[3], h[0], h[1]);
    v.push(...m[1], ...m[2], ...h[1], ...m[3], ...m[0], ...h[0]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
  })(),
};

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
function mat(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
}

class Kit {
  constructor() { this.g = []; this.anim = []; }
  p(geo, c, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { this.g.push(piece(geo, c, mat(x, y, z, sx, sy, sz, ry, rx, rz))); return this; }
  boite(w, h, d, c, x, y, z, ry = 0) { return this.p(G.boite, c, x, y, z, w, h, d, ry); }
  groupe(x, z, ry, s, fn, y = 0) {
    const k = new Kit(); fn(k);
    const m = mat(x, y, z, s, s, s, ry);
    for (const g of k.g) { g.applyMatrix4(m); this.g.push(g); }
    for (const a of k.anim) { const v = new THREE.Vector3(...a.pos).applyMatrix4(m); this.anim.push({ ...a, pos: [v.x, v.y, v.z] }); }
    return this;
  }
  geometrie() { return fusion(this.g); }
}

// ------------------------------------------------------------------ styles d'époque
// Ancien Régime : colombages, torchis, chaume ; Lumières : crépi clair, volets, tuiles ; Empire : pierre de taille,
// deux niveaux, toits à la Mansart et lucarnes ; ère industrielle : brique, chaînes d'angle, ardoise, cheminées doubles.
export function style(epoque, couleur) {
  const toit = new THREE.Color(couleur);
  const sombre = toit.clone().multiplyScalar(0.55).getHex();
  const s = { ep: epoque, toit: toit.getHex(), mur: 0xf1e4c4, bois: 0x5b3a1e, pierre: 0xbcb6a8, socle: 0x9c9486, vitre: 0x587590, colombage: true, mansarde: false, etage: 0.28, volets: null, angles: null, lucarnes: false, brique: 0xb0604a, ardoise: 0x58606c, pave: null, chaume: 0xc9a14f };
  if (epoque === 'lumieres') Object.assign(s, { mur: 0xf5eddc, colombage: false, etage: 0.33, volets: sombre, chaume: toit.clone().offsetHSL(0, -0.1, 0.08).getHex() });
  if (epoque === 'empire') Object.assign(s, { mur: 0xe9e0ca, colombage: false, mansarde: true, etage: 0.42, volets: 0x6c7d68, lucarnes: true, pave: 0xc9c2b2, chaume: toit.clone().offsetHSL(0, -0.15, 0.05).getHex() });
  if (epoque === 'industrie') {
    Object.assign(s, { mur: 0xb86a50, colombage: false, mansarde: true, etage: 0.48, volets: null, angles: 0xe4dbc6, lucarnes: true, pave: 0xb5b0a4, vitre: 0xe9d38a });
    s.toit = toit.clone().lerp(new THREE.Color(0x58606c), 0.35).getHex();
    s.chaume = s.ardoise;
  }
  return s;
}

function maison(k, x, z, e, S, ry = 0, toit = S.toit, mur = S.mur) {
  k.groupe(x, z, ry, e, q => {
    const h = S.etage, y0 = 0.03, rangs = h > 0.4 ? 2 : 1;
    q.boite(0.44, y0, 0.36, S.socle, 0, 0, 0);
    q.boite(0.4, h, 0.32, mur, 0, y0, 0);
    if (S.colombage) {
      for (const f of [1, -1]) { for (const dx of [-0.19, -0.065, 0.065, 0.19]) q.boite(0.022, h, 0.01, S.bois, dx, y0, 0.162 * f); q.boite(0.4, 0.022, 0.01, S.bois, 0, y0 + h * 0.55, 0.162 * f); q.boite(0.4, 0.022, 0.01, S.bois, 0, y0 + h - 0.02, 0.162 * f); }
      q.p(G.boite, S.bois, -0.128, y0 + 0.01, 0.163, 0.02, h * 0.62, 0.008, 0, 0, 0.55);
    }
    if (S.angles) for (const [dx, dz] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) q.boite(0.035, h, 0.035, S.angles, dx, y0, dz);
    for (let r = 0; r < rangs; r++) {
      const yf = y0 + (rangs === 2 ? 0.07 + r * 0.2 : h * 0.42), hf = rangs === 2 ? 0.1 : 0.085;
      for (const f of [1, -1]) for (const dx of [-0.12, 0.12]) {
        if (r === 0 && f === 1 && dx < 0 && rangs === 1) continue; // la porte prend cette place
        q.boite(0.06, hf, 0.012, S.vitre, dx, yf, 0.162 * f);
        q.boite(0.075, 0.012, 0.016, 0xe9e2d0, dx, yf - 0.012, 0.163 * f);
        if (S.volets) for (const sv of [-1, 1]) q.boite(0.018, hf, 0.014, S.volets, dx + sv * 0.04, yf, 0.163 * f);
      }
      for (const f of [1, -1]) q.boite(0.012, hf, 0.06, S.vitre, 0.202 * f, yf, 0);
    }
    const px = rangs === 1 ? -0.12 : 0;
    q.boite(0.075, 0.14, 0.014, S.bois, px, y0, 0.163);
    q.boite(0.095, 0.015, 0.02, 0xe9e2d0, px, y0 + 0.14, 0.165);
    q.boite(0.11, 0.02, 0.05, S.socle, px, 0, 0.19);
    if (S.mansarde) {
      q.p(G.mansarde, toit, 0, y0 + h, 0, 0.47, 0.24, 0.39);
      if (S.lucarnes) for (const dx of [-0.11, 0.11]) { q.boite(0.07, 0.07, 0.05, mur, dx, y0 + h + 0.04, 0.165); q.p(G.pignon, toit, dx, y0 + h + 0.11, 0.165, 0.09, 0.035, 0.06, Math.PI / 2); q.boite(0.04, 0.04, 0.008, S.vitre, dx, y0 + h + 0.055, 0.192); }
    } else {
      q.p(G.pignon, toit, 0, y0 + h, 0, 0.5, 0.25, 0.42);
      q.boite(0.52, 0.018, 0.03, S.bois, 0, y0 + h - 0.005, 0.2); q.boite(0.52, 0.018, 0.03, S.bois, 0, y0 + h - 0.005, -0.2);
    }
    const yc = y0 + h + 0.1;
    q.boite(0.055, 0.17, 0.055, S.ep === 'industrie' ? S.brique : S.pierre, 0.12, yc, -0.05); q.boite(0.07, 0.02, 0.07, S.socle, 0.12, yc + 0.17, -0.05);
    q.anim.push({ type: 'cheminee', pos: [0.12, yc + 0.2, -0.05] });
    if (S.ep === 'industrie') { q.boite(0.05, 0.15, 0.05, S.brique, -0.13, yc, 0.04); q.boite(0.065, 0.02, 0.065, S.socle, -0.13, yc + 0.15, 0.04); }
  });
}
// petits riens qui font vivre un lieu
function buisson(k, x, z, s = 1, c = 0x4c8f3a) { k.p(G.boule, c, x, 0.05 * s, z, 0.16 * s, 0.13 * s, 0.16 * s); }
function meule(k, x, z) { k.p(G.dome, 0xe2c868, x, 0, z, 0.2, 0.3, 0.2); }
function barriere(k, x1, z1, x2, z2) {
  const l = Math.hypot(x2 - x1, z2 - z1), a = -Math.atan2(z2 - z1, x2 - x1), n = Math.max(2, Math.round(l / 0.16));
  for (let i = 0; i <= n; i++) k.boite(0.022, 0.09, 0.022, 0x8b5a2b, x1 + (x2 - x1) * i / n, 0, z1 + (z2 - z1) * i / n);
  for (const y of [0.035, 0.07]) k.boite(l, 0.014, 0.014, 0x9b6a3c, (x1 + x2) / 2, y, (z1 + z2) / 2, a);
}
function charrette(k, x, z, ry = 0) {
  k.groupe(x, z, ry, 1, q => { q.boite(0.2, 0.05, 0.11, 0x9b6a3c, 0, 0.05, 0); q.boite(0.2, 0.04, 0.012, 0x7a4a24, 0, 0.1, 0.05); q.boite(0.2, 0.04, 0.012, 0x7a4a24, 0, 0.1, -0.05); for (const dz of [-0.065, 0.065]) q.p(G.disque, 0x4a3420, 0, 0.05, dz, 0.1, 0.015, 0.1, 0, Math.PI / 2); q.boite(0.14, 0.012, 0.012, 0x7a4a24, 0.16, 0.06, 0); });
}
function lampadaire(k, x, z) { k.boite(0.018, 0.3, 0.018, 0x2b2b30, x, 0, z); k.boite(0.05, 0.05, 0.05, 0xffe9a0, x, 0.3, z); k.p(G.pyr, 0x2b2b30, x, 0.35, z, 0.07, 0.03, 0.07); }
function puitsRond(k, x, z, S) { k.p(G.cyl, S.pierre, x, 0, z, 0.13, 0.07, 0.13); k.p(G.disque, 0x2f6fa8, x, 0.07, z, 0.09, 0.008, 0.09); k.boite(0.014, 0.14, 0.014, 0x8b5a2b, x - 0.06, 0, z); k.boite(0.014, 0.14, 0.014, 0x8b5a2b, x + 0.06, 0, z); k.boite(0.15, 0.014, 0.014, 0x8b5a2b, x, 0.14, z); }
function pavage(k, r, c) { k.p(G.disque, c, 0, 0.004, 0, r * 2, 0.008, r * 2); }

/** L'hôtel de ville : beffroi à colombages, puis maison commune à arcades et horloge, puis mairie à fronton et colonnes, puis grande mairie à campanile. */
function mairie(k, S, v) {
  const T = S.toit, e = S.ep;
  if (S.pave) pavage(k, 0.5, S.pave);
  if (e === 'ancien') {
    k.boite(0.52, 0.34, 0.42, S.mur, 0, 0.03, 0); k.boite(0.56, 0.03, 0.46, S.socle, 0, 0, 0);
    for (const dx of [-0.25, -0.12, 0, 0.12, 0.25]) k.boite(0.022, 0.34, 0.01, S.bois, dx, 0.03, 0.212);
    k.boite(0.52, 0.022, 0.01, S.bois, 0, 0.2, 0.212);
    for (const dx of [-0.18, 0.18]) k.boite(0.07, 0.09, 0.012, S.vitre, dx, 0.22, 0.213);
    k.boite(0.1, 0.17, 0.014, S.bois, 0, 0.03, 0.213);
    k.p(G.pignon, T, 0, 0.37, 0, 0.62, 0.3, 0.52);
    k.boite(0.17, 0.66, 0.17, S.pierre, 0.32, 0, -0.08); k.boite(0.2, 0.03, 0.2, S.socle, 0.32, 0.5, -0.08); k.p(G.pyr, T, 0.32, 0.66, -0.08, 0.21, 0.3, 0.21);
    k.boite(0.07, 0.09, 0.012, 0x2b2b30, 0.32, 0.54, 0.008);
  } else if (e === 'lumieres') {
    k.boite(0.6, 0.38, 0.42, S.mur, 0, 0.03, 0); k.boite(0.64, 0.03, 0.46, S.socle, 0, 0, 0);
    for (let i = 0; i < 4; i++) { k.boite(0.09, 0.15, 0.014, 0x3a3128, -0.21 + i * 0.14, 0.03, 0.212); k.p(G.disque, 0x3a3128, -0.21 + i * 0.14, 0.18, 0.212, 0.09, 0.014, 0.09, 0, Math.PI / 2); }
    for (let i = 0; i < 4; i++) { k.boite(0.06, 0.09, 0.012, S.vitre, -0.21 + i * 0.14, 0.27, 0.213); for (const sv of [-1, 1]) k.boite(0.016, 0.09, 0.014, S.volets, -0.21 + i * 0.14 + sv * 0.04, 0.27, 0.214); }
    k.p(G.pignon, T, 0, 0.41, 0, 0.7, 0.26, 0.52);
    k.boite(0.14, 0.2, 0.14, S.mur, 0, 0.55, 0); k.p(G.disque, 0xf7f3e6, 0, 0.66, 0.072, 0.09, 0.012, 0.09, 0, Math.PI / 2); k.p(G.dome, S.ardoise, 0, 0.75, 0, 0.17, 0.14, 0.17);
  } else if (e === 'empire') {
    k.boite(0.66, 0.42, 0.42, S.mur, 0, 0.04, 0); k.boite(0.74, 0.04, 0.56, S.socle, 0, 0, 0.03);
    for (let i = 0; i < 4; i++) k.p(G.cyl, 0xf5efe2, -0.18 + i * 0.12, 0.04, 0.26, 0.05, 0.36, 0.05);
    k.boite(0.46, 0.035, 0.12, 0xf5efe2, 0, 0.4, 0.25); k.p(G.pignon, 0xf5efe2, 0, 0.435, 0.25, 0.46, 0.1, 0.12);
    for (const dx of [-0.26, 0.26]) for (const yy of [0.1, 0.28]) k.boite(0.06, 0.1, 0.012, S.vitre, dx, yy, 0.212);
    k.boite(0.1, 0.2, 0.014, S.bois, 0, 0.04, 0.212);
    k.p(G.mansarde, T, 0, 0.46, 0, 0.72, 0.26, 0.48);
    k.boite(0.1, 0.12, 0.1, S.mur, 0, 0.7, 0); k.p(G.dome, 0xd8c070, 0, 0.82, 0, 0.14, 0.1, 0.14);
  } else {
    k.boite(0.74, 0.5, 0.44, S.mur, 0, 0.04, 0); k.boite(0.8, 0.04, 0.52, S.socle, 0, 0, 0);
    for (const [dx, dz] of [[-0.37, -0.22], [0.37, -0.22], [-0.37, 0.22], [0.37, 0.22]]) k.boite(0.04, 0.5, 0.04, S.angles, dx, 0.04, dz);
    k.boite(0.76, 0.025, 0.46, S.angles, 0, 0.28, 0);
    for (let i = 0; i < 5; i++) for (const yy of [0.1, 0.34]) if (!(i === 2 && yy < 0.2)) k.boite(0.06, 0.12, 0.012, S.vitre, -0.28 + i * 0.14, yy, 0.222);
    k.boite(0.11, 0.2, 0.014, S.bois, 0, 0.04, 0.222); k.boite(0.2, 0.03, 0.08, S.angles, 0, 0.24, 0.24);
    k.p(G.mansarde, T, 0, 0.54, 0, 0.8, 0.24, 0.5);
    k.boite(0.18, 0.5, 0.18, S.mur, 0, 0.54, 0.1); for (const f of [[0, 0.092], [0.092, 0], [-0.092, 0]]) k.p(G.disque, 0xf7f3e6, f[0], 0.92, 0.1 + f[1], 0.11, 0.012, 0.11, f[0] ? 0 : 0, f[0] ? 0 : Math.PI / 2, f[0] ? Math.PI / 2 : 0);
    k.p(G.pyr, S.ardoise, 0, 1.04, 0.1, 0.22, 0.26, 0.22);
    for (const [x, z] of [[-0.42, 0.42], [0.42, 0.42], [0, 0.5]]) lampadaire(k, x, z);
  }
  drapeau(k, e === 'ancien' ? 0 : -0.3, e === 'ancien' ? 0.02 : 0.24, e === 'ancien' ? 1.02 : 0.9, v.couleur);
}

function drapeau(k, x, z, h, c) {
  k.boite(0.025, h, 0.025, 0x4a3420, x, 0, z);
  k.anim.push({ type: 'drapeau', pos: [x, h - 0.08, z], couleur: c });
}
function tour(k, x, z, r, h, toit, mur) { k.p(G.cyl, mur, x, 0, z, r * 2, h, r * 2); k.p(G.cone, toit, x, h, z, r * 2.5, r * 2.3, r * 2.5); }
function arbre(k, x, z, s = 1, c = 0x4f9e3a) { k.p(G.cyl, 0x7a5232, x, 0, z, 0.05 * s, 0.15 * s, 0.05 * s); k.p(G.boule, c, x, 0.26 * s, z, 0.32 * s, 0.32 * s, 0.32 * s); }
function rondins(k, x, z, n = 3) { for (let i = 0; i < n; i++) k.p(G.cyl, 0x8b5a2b, x - 0.16, 0.05 + (i > 1 ? 0.08 : 0), z + (i % 2) * 0.09, 0.08, 0.32, 0.08, 0, 0, Math.PI / 2); }
function caisse(k, x, z, s = 0.12) { k.boite(s, s, s, 0xb07a45, x, 0, z, hache(x * 99, z * 77) * 3); }
function tonneau(k, x, z) { k.p(G.cyl, 0x8a5a2b, x, 0, z, 0.12, 0.15, 0.12); }
function cloture(k, r) {
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, a2 = (i + 1) / 8 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, x2 = Math.cos(a2) * r, z2 = Math.sin(a2) * r;
    k.boite(0.03, 0.1, 0.03, 0x8b5a2b, x, 0, z);
    k.boite(Math.hypot(x2 - x, z2 - z), 0.02, 0.02, 0x8b5a2b, (x + x2) / 2, 0.07, (z + z2) / 2, -Math.atan2(z2 - z, x2 - x));
  }
}
function murs(k, r, h, c, n = 6, bastions = false) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + Math.PI / n, a2 = (i + 1) / n * Math.PI * 2 + Math.PI / n;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, x2 = Math.cos(a2) * r, z2 = Math.sin(a2) * r;
    k.boite(Math.hypot(x2 - x, z2 - z), h, 0.08, c, (x + x2) / 2, 0, (z + z2) / 2, -Math.atan2(z2 - z, x2 - x));
    if (bastions) k.p(G.pyr, c, x, 0, z, 0.22, h * 1.2, 0.22, a);
    else k.p(G.cyl, c, x, 0, z, 0.14, h * 1.35, 0.14);
  }
}
const CHAMPS = [[0x8a6e4a, 0x7a6040], [0x9fd35a, 0x86c24a], [0xe8c45a, 0xd4a93e], [0xc9a35a, 0xa8803f]];
function champ(k, x, z, w, d, ry, saison, neige, autre) {
  let [c1, c2] = autre ? [[0x8a6e4a, 0x7a6040], [0x7dc456, 0x6db44a], [0x6aa843, 0x5e9a3c], [0x9b7d4a, 0x8a6e40]][saison] : CHAMPS[saison];
  if (neige > 0.3) { c1 = 0xe8edf2; c2 = 0xdfe6ec; }
  k.groupe(x, z, ry, 1, q => { for (let i = 0; i < 4; i++) q.boite(w, 0.04, d / 4, i % 2 ? c1 : c2, 0, 0, -d / 2 + d / 8 + i * d / 4); });
}

// ------------------------------------------------------------------ bâtiments
const cache = new Map();

/** Rend { geo, anim } pour un bâtiment ; v : { cle, couleur, epoque, saison, neige, niveau, fini }. */
export function geometrieBatiment(v) {
  const cle = `${v.cle}|${v.couleur}|${v.epoque}|${v.saison}|${v.neige > 0.3 ? 1 : 0}|${v.niveau || 0}`;
  if (cache.has(cle)) return cache.get(cle);
  const k = new Kit(), S = style(v.epoque, v.couleur), T = S.toit, s = v.saison, n = v.neige;
  const ind = v.epoque === 'industrie';
  switch (v.cle) {
    case 'hotel': {
      const L = v.niveau || 1;
      mairie(k, S, v);
      const lieux = [[-0.52, 0.3], [0.45, 0.42], [-0.45, -0.36], [0.1, 0.56], [0.58, -0.32], [-0.14, -0.56], [-0.62, 0], [0.64, 0.08]];
      for (let i = 0; i < Math.min(8, L * 2); i++) { const [x, z] = lieux[i]; maison(k, x, z, 0.6 + (i % 3) * 0.07, S, Math.atan2(-x, -z), i % 3 === 2 ? S.chaume : T); }
      if (L >= 2) puitsRond(k, 0.22, 0.34, S);
      if (L >= 2 && !ind) charrette(k, -0.3, 0.52, 0.5);
      for (let i = 0; i < 3 + L; i++) { const a = hache(i, L, 5) * 6.28; buisson(k, Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0.7 + hache(i, 3) * 0.5); }
      if (L >= 3) murs(k, 0.88, 0.14, S.pierre, 6, v.epoque !== 'ancien');
      if (L >= 4) { k.boite(0.13, 0.7, 0.13, S.pierre, -0.36, 0, -0.3); k.p(G.pyr, T, -0.36, 0.7, -0.3, 0.16, 0.28, 0.16); k.boite(0.02, 0.1, 0.02, 0xf2c23a, -0.36, 0.98, -0.3); }
      if (L >= 5) { for (const [x, z] of [[0.5, 0.2], [-0.52, 0.12]]) lampadaire(k, x, z); k.p(G.cyl, S.pierre, 0.05, 0, 0.42, 0.2, 0.05, 0.2); k.p(G.disque, 0x5fc0ee, 0.05, 0.05, 0.42, 0.15, 0.01, 0.15); }
      break;
    }
    case 'cabane': maison(k, -0.18, 0.05, 0.75, S, 0.4, S.chaume); maison(k, 0.27, -0.2, 0.6, S, -0.3); arbre(k, 0.3, 0.38, 0.8); barriere(k, -0.55, 0.42, 0.05, 0.55); if (!ind) meule(k, -0.48, -0.32); buisson(k, 0.55, 0.1); buisson(k, -0.05, -0.5, 0.8); break;
    case 'maison': maison(k, -0.27, 0.17, 0.85, S, 0.3); maison(k, 0.27, 0.22, 0.8, S, -0.5); maison(k, 0, -0.32, 0.9, S, 0); puitsRond(k, 0, 0.5, S); buisson(k, -0.6, -0.2); buisson(k, 0.58, -0.25, 0.8); if (ind) lampadaire(k, 0.02, 0.12); else tonneau(k, 0.45, -0.1); break;
    case 'maison_pierre': maison(k, -0.22, 0.05, 1.15, S, 0.2, T, 0xd8d2c4); maison(k, 0.3, 0.1, 1.0, S, -0.4, T, 0xd8d2c4); arbre(k, 0.1, -0.42); break;
    case 'hotel_particulier': k.boite(0.72, 0.4, 0.38, S.mur, 0, 0, 0); k.p(G.mansarde, T, 0, 0.4, 0, 0.8, 0.3, 0.48); k.boite(0.24, 0.32, 0.46, S.mur, -0.4, 0, 0.16); k.boite(0.24, 0.32, 0.46, S.mur, 0.4, 0, 0.16); k.boite(0.9, 0.06, 0.06, 0x3e7d2c, 0, 0, 0.55); for (let i = 0; i < 4; i++) k.p(G.boule, 0x3e7d2c, -0.3 + i * 0.2, 0.08, 0.42, 0.1, 0.12, 0.1); break;
    case 'immeuble': for (const [x, z] of [[-0.22, -0.1], [0.24, 0.12]]) { k.boite(0.36, 0.62, 0.34, 0xc9b8a0, x, 0, z); k.p(G.mansarde, T, x, 0.62, z, 0.4, 0.2, 0.38); for (let f = 0; f < 3; f++) k.boite(0.28, 0.05, 0.01, 0x6f8fb0, x, 0.12 + f * 0.17, z + 0.172); } break;
    case 'bucheron': maison(k, -0.17, -0.17, 0.8, S, 0.3); rondins(k, 0.32, 0.2); rondins(k, 0.36, -0.2, 2); k.p(G.cyl, 0x9b6a3c, -0.2, 0, 0.34, 0.15, 0.1, 0.15); k.p(G.boite, 0x777777, -0.2, 0.1, 0.34, 0.02, 0.13, 0.05, 0, 0, 0.4); k.p(G.cyl, 0xb98a55, 0.05, 0, 0.5, 0.11, 0.05, 0.11); k.p(G.cyl, 0xb98a55, -0.5, 0, 0.1, 0.1, 0.04, 0.1); charrette(k, 0.1, 0.48, -0.4); break;
    case 'forestier': maison(k, 0, -0.2, 0.75, S, 0); for (let i = 0; i < 4; i++) k.p(G.cone, 0x3e7d2c, -0.35 + i * 0.22, 0, 0.3, 0.13, 0.22, 0.13); break;
    case 'carriere': k.p(G.boule, 0x8a857a, 0.15, 0.05, -0.15, 0.7, 0.45, 0.6); for (let i = 0; i < 4; i++) k.boite(0.15, 0.12, 0.15, S.pierre, -0.35 + (i % 2) * 0.2, 0, 0.25 + (i > 1 ? 0.18 : 0), i); maison(k, -0.35, -0.25, 0.6, S, 0.5); k.boite(0.03, 0.5, 0.03, 0x8b5a2b, 0.4, 0, 0.3); k.boite(0.35, 0.03, 0.03, 0x8b5a2b, 0.3, 0.48, 0.3); break;
    case 'ferme': champ(k, -0.27, 0.27, 0.5, 0.45, 0.2, s, n); champ(k, 0.34, 0.2, 0.4, 0.5, -0.3, s, n, true); maison(k, -0.12, -0.38, 0.85, S, 0, 0xb03a2e, S.ep === 'industrie' ? S.mur : 0xe8d6b0); k.boite(0.26, 0.2, 0.22, 0x9b5a34, 0.34, 0, -0.42); k.p(G.pignon, 0x7a3a26, 0.34, 0.2, -0.42, 0.3, 0.14, 0.26); k.boite(0.1, 0.13, 0.012, 0x4a2c18, 0.34, 0, -0.305); if (s >= 2) { meule(k, 0.62, -0.18); meule(k, -0.55, -0.2); } barriere(k, -0.6, 0.02, 0.1, -0.08); charrette(k, 0.02, -0.1, 0.3); break;
    case 'champ_patates': champ(k, -0.2, 0.1, 0.55, 0.6, 0.1, s, n, true); champ(k, 0.35, -0.05, 0.3, 0.55, 0.1, s, n, true); maison(k, -0.1, -0.45, 0.6, S, 0); for (let i = 0; i < 3; i++) k.p(G.cyl, 0xa0784a, 0.3 + i * 0.1, 0, 0.42, 0.08, 0.08, 0.08); break;
    case 'pecheur': maison(k, -0.25, 0, 0.75, S, 0); tonneau(k, -0.3, 0.35); tonneau(k, -0.16, 0.4); k.boite(0.015, 0.2, 0.015, 0x8b5a2b, 0.0, 0, -0.35); k.boite(0.015, 0.2, 0.015, 0x8b5a2b, 0.3, 0, -0.35); k.boite(0.3, 0.012, 0.012, 0x8b5a2b, 0.15, 0.2, -0.35); k.boite(0.26, 0.13, 0.008, 0xd9d2bc, 0.15, 0.06, -0.35); k.boite(0.6, 0.03, 0.14, 0x8b5a2b, 0.35, 0.02, 0); k.boite(0.3, 0.06, 0.12, 0x7a4a24, 0.75, -0.15, 0.25); k.boite(0.02, 0.3, 0.02, 0x5b3a1e, 0.75, -0.1, 0.25); k.boite(0.1, 0.14, 0.01, 0xf7f7f2, 0.8, 0, 0.25); break;
    case 'chasseur': k.p(G.pyr, 0x7a6a40, -0.2, 0, 0, 0.35, 0.32, 0.35); maison(k, 0.2, -0.2, 0.65, S, 0.5); k.boite(0.3, 0.02, 0.02, 0x8b5a2b, 0.2, 0.25, 0.25); k.boite(0.08, 0.1, 0.04, 0x8b3a2a, 0.2, 0.13, 0.25); break;
    case 'bergerie': cloture(k, 0.5); k.boite(0.3, 0.2, 0.25, 0x8b5a2b, -0.2, 0, -0.15); k.p(G.pignon, T, -0.2, 0.2, -0.15, 0.36, 0.14, 0.3); break;
    case 'vignoble': for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const col = n > 0.3 ? 0x8b7d6b : [0x6b5a44, 0x7fc24f, 0x5e9a3c, 0xb8502c][s]; k.boite(0.02, 0.16, 0.02, 0x6b4a2a, -0.45 + c * 0.2, 0, -0.4 + r * 0.18); k.p(G.boule, col, -0.45 + c * 0.2, 0.16, -0.4 + r * 0.18, 0.1, 0.09, 0.1); } maison(k, 0.35, 0.45, 0.55, S, 0.4); break;
    case 'mine_fer': case 'mine_or': case 'mine_charbon': {
      const pep = v.cle === 'mine_or' ? 0xf2c23a : v.cle === 'mine_charbon' ? 0x2b2b30 : 0xa5532a;
      k.p(G.boule, 0x8a857a, 0, 0.08, -0.1, 0.8, 0.55, 0.7); k.boite(0.2, 0.22, 0.1, 0x222222, 0, 0, 0.22); k.boite(0.26, 0.04, 0.12, 0x8b5a2b, 0, 0.22, 0.24);
      k.boite(0.2, 0.1, 0.12, 0x6b4a2a, 0.32, 0, 0.32); for (let i = 0; i < 3; i++) k.p(G.boule, pep, 0.28 + i * 0.04, 0.1, 0.32, 0.08, 0.07, 0.08);
      if (v.cle === 'mine_charbon') { k.boite(0.06, 0.55, 0.06, 0x8b5a2b, -0.35, 0, 0.2); k.boite(0.06, 0.55, 0.06, 0x8b5a2b, -0.2, 0, 0.2); k.p(G.disque, 0x555555, -0.27, 0.55, 0.2, 0.18, 0.03, 0.18, 0, Math.PI / 2); }
      break;
    }
    case 'scierie': for (let i = 0; i < 3; i++) k.boite(0.3, 0.025, 0.1, 0xd9b77a, 0.35, i * 0.025, 0.42 - i * 0.01); if (ind) { k.boite(0.07, 0.5, 0.07, S.brique, -0.25, 0.2, -0.1); k.anim.push({ type: 'fumee', pos: [-0.25, 0.75, -0.1], noire: true }); } k.boite(0.6, 0.25, 0.3, S.mur, 0, 0, -0.05); k.p(G.pignon, T, 0, 0.25, -0.05, 0.68, 0.18, 0.38); k.p(G.disque, 0x8b5a2b, 0.38, 0.15, -0.05, 0.3, 0.05, 0.3, 0, 0, Math.PI / 2); rondins(k, -0.15, 0.35); break;
    case 'moulin': k.boite(0.07, 0.13, 0.012, S.bois, 0, 0, 0.18); k.boite(0.05, 0.06, 0.012, S.vitre, 0, 0.32, 0.178); for (let i = 0; i < 3; i++) k.p(G.boule, 0xe9e2d0, -0.3 + i * 0.07, 0.04, 0.3, 0.08, 0.08, 0.08); maison(k, -0.42, -0.3, 0.55, S, 0.6); k.p(G.cyl, S.mur, 0, 0, 0, 0.36, 0.62, 0.36); k.p(G.cone, T, 0, 0.62, 0, 0.46, 0.3, 0.46); k.anim.push({ type: 'ailes', pos: [0, 0.55, 0.2] }); champ(k, 0.42, 0.38, 0.25, 0.3, 0, s, n); break;
    case 'boulangerie': maison(k, -0.1, 0, 0.95, S, 0); k.p(G.dome, 0xc78a54, 0.35, 0, 0.15, 0.32, 0.32, 0.32); k.boite(0.08, 0.3, 0.08, S.pierre, -0.25, 0.2, -0.08); k.anim.push({ type: 'fumee', pos: [-0.25, 0.55, -0.08] }); break;
    case 'brasserie': maison(k, -0.1, -0.1, 1.0, S, 0.2); for (let i = 0; i < 3; i++) tonneau(k, 0.3 + (i % 2) * 0.14, 0.25 + (i > 1 ? 0.15 : 0)); break;
    case 'fonderie': k.boite(0.55, 0.32, 0.4, 0x8a857a, 0, 0, 0); k.boite(0.14, 0.75, 0.14, S.pierre, 0.2, 0, -0.1); k.boite(0.16, 0.08, 0.02, 0xff8a1c, -0.08, 0.05, 0.205); k.anim.push({ type: 'fumee', pos: [0.2, 0.8, -0.1], noire: true }); break;
    case 'haut_fourneau': k.p(G.cyl, S.brique, 0, 0, 0, 0.42, 0.7, 0.42); k.p(G.cyl, 0x6b4a3a, 0, 0.7, 0, 0.28, 0.2, 0.28); k.boite(0.5, 0.3, 0.3, S.brique, -0.35, 0, 0.25); k.p(G.pignon, S.ardoise, -0.35, 0.3, 0.25, 0.55, 0.15, 0.36); k.boite(0.1, 0.9, 0.1, S.brique, 0.4, 0, -0.3); k.anim.push({ type: 'fumee', pos: [0.4, 0.95, -0.3], noire: true }); k.anim.push({ type: 'fumee', pos: [0, 0.95, 0], noire: true }); break;
    case 'forge': maison(k, -0.1, -0.1, 0.95, S, 0); k.boite(0.14, 0.08, 0.07, 0x444444, 0.3, 0.1, 0.25); k.boite(0.06, 0.1, 0.05, 0x555555, 0.3, 0, 0.25); k.anim.push({ type: 'fumee', pos: [0.02, 0.62, -0.15], noire: true }); break;
    case 'armurerie': k.boite(0.5, 0.32, 0.4, S.pierre, 0, 0, 0); k.p(S.mansarde ? G.mansarde : G.pignon, T, 0, 0.32, 0, 0.58, 0.22, 0.48); k.p(G.disque, T, 0.32, 0.15, 0.25, 0.22, 0.03, 0.22, 0, Math.PI / 2); k.boite(0.03, 0.35, 0.02, 0x6b6b6b, 0.35, 0, 0.35, 0); break;
    case 'tisserand': maison(k, -0.15, -0.1, 0.9, S, 0); for (let i = 0; i < 3; i++) k.boite(0.12, 0.18, 0.01, [0xd94f4f, 0x4f7fd9, 0xe0c040][i], 0.15 + i * 0.15, 0.06, 0.3); k.boite(0.5, 0.02, 0.02, 0x8b5a2b, 0.3, 0.26, 0.3); break;
    case 'manufacture': k.boite(0.85, 0.38, 0.42, S.mur, 0, 0, 0); k.p(G.mansarde, T, 0, 0.38, 0, 0.92, 0.26, 0.5); for (let i = 0; i < 5; i++) k.boite(0.08, 0.12, 0.01, 0x6f8fb0, -0.32 + i * 0.16, 0.14, 0.212); k.boite(0.12, 0.3, 0.012, S.bois, 0, 0, 0.213); break;
    case 'filature': case 'usine': { const L = v.cle === 'usine' ? 0.95 : 0.8; k.boite(L, 0.4, 0.45, S.brique, 0, 0, 0); for (let i = 0; i < 4; i++) k.p(G.pignon, S.ardoise, -L / 2 + L / 8 + i * L / 4, 0.4, 0, L / 4, 0.16, 0.48, Math.PI / 2); for (let i = 0; i < 6; i++) k.boite(0.07, 0.14, 0.01, 0xe9d38a, -0.35 + i * 0.14, 0.14, 0.232); k.boite(0.12, 1.0, 0.12, S.brique, 0.42, 0, -0.3); k.anim.push({ type: 'fumee', pos: [0.42, 1.05, -0.3], noire: true }); if (v.cle === 'usine') { k.boite(0.12, 0.85, 0.12, S.brique, -0.42, 0, -0.3); k.anim.push({ type: 'fumee', pos: [-0.42, 0.9, -0.3], noire: true }); } break; }
    case 'entrepot': k.boite(0.16, 0.2, 0.012, S.bois, 0, 0, 0.162); tonneau(k, 0.5, 0.3); tonneau(k, -0.52, 0.3); charrette(k, 0.1, 0.55, 0); k.boite(0.75, 0.32, 0.42, S.mur, 0, 0, -0.05); k.p(G.pignon, T, 0, 0.32, -0.05, 0.82, 0.24, 0.5); for (let i = 0; i < 4; i++) caisse(k, -0.3 + i * 0.2, 0.35, 0.13); break;
    case 'grenier': k.p(G.cyl, S.mur, -0.15, 0, 0, 0.36, 0.45, 0.36); k.p(G.cone, T, -0.15, 0.45, 0, 0.44, 0.25, 0.44); k.p(G.cyl, S.mur, 0.28, 0, 0.15, 0.28, 0.36, 0.28); k.p(G.cone, T, 0.28, 0.36, 0.15, 0.36, 0.2, 0.36); break;
    case 'marche': { const cs = [0xd94f4f, 0x4f9fd9, 0xe0b040, 0x5fbf5f]; [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.3], [0.3, 0.3]].forEach(([x, z], i) => { k.boite(0.3, 0.12, 0.22, 0x8b5a2b, x, 0, z); k.p(G.pyr, cs[i], x, 0.22, z, 0.38, 0.14, 0.3); for (const dx of [-0.13, 0.13]) k.boite(0.02, 0.22, 0.02, 0x8b5a2b, x + dx, 0, z); caisse(k, x + 0.1, z + 0.18, 0.08); }); k.p(G.cyl, S.pierre, 0, 0, 0, 0.18, 0.1, 0.18); break; }
    case 'comptoir': maison(k, -0.15, -0.1, 1.05, S, 0); drapeau(k, 0.35, -0.3, 0.8, v.couleur); caisse(k, 0.25, 0.25); caisse(k, 0.38, 0.3); tonneau(k, -0.4, 0.35); k.boite(0.3, 0.08, 0.18, 0x8b5a2b, 0.1, 0.08, 0.45); break;
    case 'port': k.boite(0.4, 0.28, 0.3, S.mur, -0.35, 0, -0.1); k.p(G.pignon, T, -0.35, 0.28, -0.1, 0.46, 0.2, 0.36); k.boite(0.95, 0.04, 0.18, 0x8b5a2b, 0.35, 0, 0); k.boite(0.55, 0.12, 0.2, 0x7a4a24, 0.78, -0.12, 0.35); k.boite(0.03, 0.6, 0.03, 0x5b3a1e, 0.78, -0.05, 0.35); k.boite(0.02, 0.35, 0.32, 0xf7f7f2, 0.78, 0.12, 0.35); drapeau(k, 0.78, 0.35, 0.62, v.couleur); break;
    case 'banque': k.boite(0.62, 0.4, 0.4, 0xe8e2d4, 0, 0, 0); for (let i = 0; i < 4; i++) k.p(G.cyl, 0xf4efe4, -0.24 + i * 0.16, 0, 0.24, 0.07, 0.38, 0.07); k.p(G.pignon, 0xe8e2d4, 0, 0.4, 0.05, 0.66, 0.14, 0.5, Math.PI / 2); k.boite(0.66, 0.04, 0.5, T, 0, 0.4, 0.05); break;
    case 'gare': k.boite(0.8, 0.3, 0.32, S.brique, 0, 0, -0.15); k.p(G.pignon, S.ardoise, 0, 0.3, -0.15, 0.86, 0.18, 0.4); k.boite(0.14, 0.55, 0.14, S.brique, 0, 0, -0.1); k.boite(1.6, 0.02, 0.04, 0x555555, 0, 0.01, 0.28); k.boite(1.6, 0.02, 0.04, 0x555555, 0, 0.01, 0.4); k.boite(0.3, 0.18, 0.14, 0x2b2b30, 0.25, 0.03, 0.34); k.anim.push({ type: 'fumee', pos: [0.32, 0.3, 0.34], noire: true }); break;
    case 'puits': k.p(G.cyl, S.pierre, 0, 0, 0, 0.25, 0.12, 0.25); k.p(G.disque, 0x2f6fa8, 0, 0.12, 0, 0.18, 0.01, 0.18); k.boite(0.02, 0.25, 0.02, 0x8b5a2b, -0.11, 0, 0); k.boite(0.02, 0.25, 0.02, 0x8b5a2b, 0.11, 0, 0); k.p(G.pyr, T, 0, 0.25, 0, 0.3, 0.1, 0.18); maison(k, 0.4, -0.35, 0.5, S, 0.6); break;
    case 'taverne': maison(k, -0.1, -0.05, 1.1, S, 0); k.boite(0.02, 0.25, 0.02, 0x8b5a2b, 0.33, 0, 0.25); k.boite(0.18, 0.02, 0.02, 0x8b5a2b, 0.4, 0.25, 0.25); k.boite(0.12, 0.09, 0.015, 0xd9a43a, 0.45, 0.15, 0.25); tonneau(k, -0.35, 0.35); tonneau(k, -0.2, 0.4); break;
    case 'eglise': for (const dz of [-0.1, 0.1, 0.3]) for (const f of [1, -1]) k.boite(0.012, 0.13, 0.05, 0x6ab0e8, 0.162 * f, 0.1, dz); k.boite(0.08, 0.14, 0.012, S.bois, 0, 0, -0.412); for (let i = 0; i < 4; i++) k.boite(0.03, 0.06, 0.015, S.pierre, 0.32 + (i % 2) * 0.12, 0, 0.1 + (i > 1 ? 0.16 : 0)); buisson(k, -0.4, 0.3); arbre(k, -0.45, -0.1, 0.9, 0x3e7d2c); k.boite(0.32, 0.3, 0.55, S.mur, 0, 0, 0.05); k.p(G.pignon, T, 0, 0.3, 0.05, 0.4, 0.22, 0.62, Math.PI / 2); k.boite(0.18, 0.62, 0.18, S.mur, 0, 0, -0.32); k.p(G.pyr, T, 0, 0.62, -0.32, 0.22, 0.32, 0.22); k.boite(0.02, 0.12, 0.02, 0xf2c23a, 0, 0.94, -0.32); break;
    case 'jardin': for (let i = 0; i < 4; i++) k.boite(0.5, 0.1, 0.08, 0x3e7d2c, 0, 0, -0.3 + i * 0.2); for (let i = 0; i < 10; i++) k.p(G.boule, s === 0 ? 0x8b7d6b : [0xff6b9a, 0xffd34d, 0xb57bff, 0xff8a3d][i % 4], -0.25 + (i % 5) * 0.12, 0.12, -0.2 + Math.floor(i / 5) * 0.4, 0.06, 0.06, 0.06); arbre(k, 0.4, 0.3); arbre(k, -0.42, 0.32, 0.8); break;
    case 'ecole': maison(k, 0, 0, 1.1, S, 0); k.boite(0.12, 0.18, 0.12, S.mur, 0.15, 0.5, 0); k.p(G.pyr, T, 0.15, 0.68, 0, 0.15, 0.12, 0.15); k.boite(0.6, 0.02, 0.25, 0x5fa83c, 0, 0, 0.38); break;
    case 'fontaine': k.p(G.cyl, S.pierre, 0, 0, 0, 0.6, 0.1, 0.6); k.p(G.disque, n > 0.3 ? 0xdfeaf2 : 0x5fc0ee, 0, 0.1, 0, 0.5, 0.01, 0.5); k.p(G.cyl, S.pierre, 0, 0, 0, 0.08, 0.3, 0.08); k.p(G.cyl, S.pierre, 0, 0.3, 0, 0.22, 0.04, 0.22); arbre(k, 0.5, 0.35, 0.8); arbre(k, -0.5, -0.35, 0.8); break;
    case 'statue': k.boite(0.32, 0.2, 0.32, S.pierre, 0, 0, 0); k.boite(0.32, 0.14, 0.1, 0x9aa0a8, 0, 0.2, 0); k.boite(0.08, 0.2, 0.08, 0x9aa0a8, 0, 0.34, 0); k.p(G.boule, 0x9aa0a8, 0, 0.58, 0, 0.1, 0.1, 0.1); arbre(k, 0.4, 0.3, 0.7); arbre(k, -0.4, 0.3, 0.7); break;
    case 'academie': k.boite(0.7, 0.36, 0.4, 0xece6d8, 0, 0, 0); k.p(G.mansarde, T, 0, 0.36, 0, 0.78, 0.22, 0.48); k.p(G.dome, 0xd8dde4, 0.22, 0.58, 0, 0.24, 0.2, 0.24); k.boite(0.03, 0.18, 0.03, 0x444444, 0.22, 0.66, 0, 0); break;
    case 'theatre': k.boite(0.66, 0.42, 0.5, 0xf0e6d0, 0, 0, 0); for (let i = 0; i < 5; i++) k.p(G.cyl, 0xfbf6ec, -0.24 + i * 0.12, 0, 0.3, 0.06, 0.38, 0.06); k.p(G.dome, T, 0, 0.42, -0.05, 0.5, 0.26, 0.42); break;
    case 'hopital': k.boite(0.8, 0.34, 0.36, S.mur, 0, 0, 0); k.p(G.mansarde, T, 0, 0.34, 0, 0.88, 0.22, 0.44); k.boite(0.3, 0.3, 0.5, S.mur, 0, 0, 0.3); k.boite(0.14, 0.04, 0.012, 0xd03030, 0, 0.22, 0.555); k.boite(0.04, 0.14, 0.012, 0xd03030, 0, 0.17, 0.556); break;
    case 'cathedrale': k.boite(0.4, 0.42, 0.85, S.mur, 0, 0, 0.05); k.p(G.pignon, T, 0, 0.42, 0.05, 0.48, 0.3, 0.92, Math.PI / 2); for (const x of [-0.16, 0.16]) { k.boite(0.16, 0.85, 0.16, S.mur, x, 0, -0.42); k.p(G.pyr, T, x, 0.85, -0.42, 0.19, 0.35, 0.19); } k.p(G.disque, 0x6ab0e8, 0, 0.5, 0.48, 0.14, 0.02, 0.14, 0, Math.PI / 2); break;
    case 'palais': k.boite(1.2, 0.42, 0.42, 0xefe7d6, 0, 0, -0.2); k.p(G.mansarde, T, 0, 0.42, -0.2, 1.26, 0.26, 0.5); k.boite(0.32, 0.38, 0.62, 0xefe7d6, -0.55, 0, 0.2); k.boite(0.32, 0.38, 0.62, 0xefe7d6, 0.55, 0, 0.2); k.p(G.dome, 0xd8c070, 0, 0.66, -0.2, 0.32, 0.24, 0.32); for (let i = 0; i < 6; i++) k.p(G.boule, 0x3e7d2c, -0.4 + i * 0.16, 0.06, 0.5, 0.1, 0.1, 0.1); k.p(G.disque, 0x5fc0ee, 0, 0.03, 0.42, 0.3, 0.02, 0.3); drapeau(k, 0, -0.2, 1.2, v.couleur); break;
    case 'caserne': for (let i = 0; i < 5; i++) k.boite(0.06, 0.09, 0.012, S.vitre, -0.26 + i * 0.13, 0.12, 0.027); k.boite(0.08, 0.2, 0.08, 0xe9e2d0, -0.5, 0, 0.42); k.p(G.pyr, v.couleur, -0.5, 0.2, 0.42, 0.1, 0.06, 0.1); if (S.pave) pavage(k, 0.45, S.pave); k.boite(0.7, 0.28, 0.35, S.pierre, 0, 0, -0.15); k.p(G.pignon, T, 0, 0.28, -0.15, 0.78, 0.2, 0.42); drapeau(k, 0.4, 0.3, 0.75, v.couleur); for (let i = 0; i < 3; i++) { k.boite(0.02, 0.18, 0.02, 0x8b5a2b, -0.3 + i * 0.18, 0, 0.3); k.boite(0.1, 0.04, 0.02, 0xc9b27a, -0.3 + i * 0.18, 0.14, 0.3); } break;
    case 'haras': k.boite(0.55, 0.25, 0.3, 0x8b5a2b, -0.1, 0, -0.2); k.p(G.pignon, T, -0.1, 0.25, -0.2, 0.62, 0.18, 0.36); cloture(k, 0.55); for (let i = 0; i < 2; i++) { k.boite(0.2, 0.1, 0.08, 0x7a4a2a, 0.15 + i * 0.12, 0.1, 0.25 - i * 0.15); k.boite(0.06, 0.12, 0.06, 0x7a4a2a, 0.25 + i * 0.12, 0.15, 0.25 - i * 0.15); } break;
    case 'arsenal': k.boite(0.62, 0.32, 0.4, S.pierre, 0, 0, -0.1); k.p(G.pignon, T, 0, 0.32, -0.1, 0.7, 0.2, 0.48); for (let i = 0; i < 3; i++) k.p(G.cyl, 0x2b2b2b, -0.25 + i * 0.25, 0.08, 0.35, 0.06, 0.3, 0.06, 0, Math.PI / 2); k.p(G.boule, 0x2b2b2b, 0.42, 0.05, 0.35, 0.08, 0.08, 0.08); break;
    case 'tour': tour(k, 0, 0, 0.16, 0.95, T, S.pierre); drapeau(k, 0, 0, 1.35, v.couleur); break;
    case 'remparts': murs(k, 0.6, 0.25, S.pierre, 6, true); k.boite(0.15, 0.18, 0.1, 0x3a2a1a, 0, 0, 0.62); break;
    case 'citadelle': murs(k, 0.72, 0.28, S.pierre, 5, true); murs(k, 0.42, 0.22, S.pierre, 5, true); k.boite(0.22, 0.4, 0.22, S.pierre, 0, 0, 0); k.p(G.pyr, T, 0, 0.4, 0, 0.26, 0.2, 0.26); drapeau(k, 0, 0, 1.05, v.couleur); break;
    case 'colonie': maison(k, 0, 0, 1, S, 0); drapeau(k, 0.3, 0.2, 0.9, v.couleur); rondins(k, -0.3, 0.3); break;
    default: maison(k, 0, 0, 1, S, 0);
  }
  const r = { geo: k.geometrie(), anim: k.anim };
  cache.set(cle, r);
  if (cache.size > 900) cache.delete(cache.keys().next().value);
  return r;
}

export function maillageBatiment(v) {
  const r = geometrieBatiment(v);
  const m = new THREE.Mesh(r.geo, MAT_LISSE);
  m.castShadow = true;
  m.receiveShadow = true;
  return { mesh: m, anim: r.anim };
}

// ------------------------------------------------------------------ chantier (échafaudage)
const geoChantier = (() => {
  const k = new Kit();
  for (const [x, z] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.22], [0.28, 0.22]]) k.boite(0.03, 0.42, 0.03, 0x9b6a3c, x, 0, z);
  k.boite(0.62, 0.03, 0.03, 0x9b6a3c, 0, 0.4, -0.22); k.boite(0.62, 0.03, 0.03, 0x9b6a3c, 0, 0.4, 0.22); k.boite(0.03, 0.03, 0.48, 0x9b6a3c, -0.28, 0.25, 0); k.boite(0.03, 0.03, 0.48, 0x9b6a3c, 0.28, 0.25, 0);
  rondins(k, 0.42, 0.42, 2); k.boite(0.14, 0.1, 0.14, 0xbcb6a8, -0.42, 0, 0.4);
  return k.geometrie();
})();
export function maillageChantier() { const m = new THREE.Mesh(geoChantier, MAT_LISSE); m.castShadow = true; return m; }

// ------------------------------------------------------------------ armées
const cacheArmees = new Map();
export function geometrieArmee(couleur, epoque, compo) {
  const cle = `${couleur}|${epoque}|${compo.inf}|${compo.cav}|${compo.art}`;
  if (cacheArmees.has(cle)) return cacheArmees.get(cle);
  const k = new Kit();
  const chapeau = epoque === 'empire' ? 'bicorne' : epoque === 'industrie' ? 'shako' : 'tricorne';
  const habit = new THREE.Color(couleur).getHex();
  const soldat = (x, z) => {
    k.boite(0.035, 0.09, 0.04, 0xf2efe6, x - 0.025, 0, z); k.boite(0.035, 0.09, 0.04, 0xf2efe6, x + 0.025, 0, z);
    k.boite(0.1, 0.11, 0.07, habit, x, 0.09, z);
    k.boite(0.11, 0.015, 0.075, 0xf2efe6, x, 0.15, z);
    k.p(G.boule, 0xf0c9a0, x, 0.235, z, 0.07, 0.07, 0.07);
    if (chapeau === 'tricorne') k.p(G.cone, 0x1f1f1f, x, 0.26, z, 0.11, 0.05, 0.11);
    else if (chapeau === 'bicorne') k.boite(0.13, 0.05, 0.04, 0x1f1f1f, x, 0.26, z);
    else { k.p(G.cyl, 0x1f1f1f, x, 0.26, z, 0.065, 0.07, 0.065); k.boite(0.02, 0.03, 0.02, 0xd9d9d9, x, 0.33, z + 0.02); }
    k.boite(0.012, 0.3, 0.012, 0x5b3a1e, x + 0.06, 0.03, z + 0.02);
  };
  const cavalier = (x, z) => {
    k.boite(0.22, 0.1, 0.08, 0x6b4226, x, 0.1, z); k.boite(0.06, 0.12, 0.06, 0x6b4226, x + 0.12, 0.16, z);
    for (const [dx, dz] of [[-0.08, -0.025], [-0.08, 0.025], [0.08, -0.025], [0.08, 0.025]]) k.boite(0.025, 0.1, 0.025, 0x4a2c18, x + dx, 0, z + dz);
    k.boite(0.08, 0.1, 0.06, habit, x, 0.2, z); k.p(G.boule, 0xf0c9a0, x, 0.32, z, 0.06, 0.06, 0.06);
    k.p(chapeau === 'shako' ? G.cyl : G.cone, 0x1f1f1f, x, 0.34, z, 0.08, 0.05, 0.08);
  };
  const canon = (x, z) => {
    k.p(G.cyl, 0x2b2b2b, x + 0.06, 0.09, z, 0.06, 0.28, 0.06, 0, 0, Math.PI / 2 - 0.15);
    k.boite(0.18, 0.05, 0.08, 0x6b4a2a, x - 0.02, 0.05, z);
    k.p(G.disque, 0x4a3420, x, 0.07, z + 0.06, 0.13, 0.02, 0.13, 0, Math.PI / 2); k.p(G.disque, 0x4a3420, x, 0.07, z - 0.06, 0.13, 0.02, 0.13, 0, Math.PI / 2);
  };
  const lieux = [[0, 0], [-0.16, 0.08], [0.16, 0.08], [-0.08, -0.1], [0.08, -0.1]];
  let i = 0;
  for (let n = 0; n < Math.min(compo.inf, 3); n++) soldat(...lieux[i++]);
  for (let n = 0; n < Math.min(compo.cav, 2) && i < 5; n++) cavalier(...lieux[i++]);
  if (compo.art) canon(0.02, 0.26);
  // porte-drapeau
  k.boite(0.02, 0.62, 0.02, 0x4a3420, -0.26, 0, -0.02);
  k.boite(0.2, 0.13, 0.012, habit, -0.16, 0.46, -0.02);
  k.boite(0.2, 0.025, 0.014, 0xffffff, -0.16, 0.5, -0.02);
  k.boite(0.025, 0.13, 0.014, 0xffffff, -0.16, 0.46, -0.02);
  const g = k.geometrie();
  cacheArmees.set(cle, g);
  return g;
}
void X; void Z;
