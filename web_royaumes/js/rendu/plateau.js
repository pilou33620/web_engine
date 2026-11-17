// Le plateau : cases biseautées (un seul maillage), mer animée (écume, reflets, glace), rivières qui coulent,
// montagnes, rochers et gisements, arbres qui ondulent au vent et changent avec les saisons,
// teinte et liseré des territoires, surbrillances.
import { THREE, scene, geo, posCase, voisin, hache, lerp } from './scene.js';

export const U = { t: { value: 0 }, vent: { value: 0.3 }, gel: { value: 0 }, vague: { value: 1 } };
const groupe = new THREE.Group();
scene.add(groupe);

let C = null;           // la carte reçue du serveur
let H = [];             // hauteur du dessus de chaque case
let plage = null;       // [début, fin[ des sommets du dessus de chaque case
let solMesh = null, eauMesh = null, arbresF = null, arbresC = null, troncs = null, rochers = null;
let teinte = null, liseres = null, surb = null, anneau = null, points = null;
let saisonActuelle = -1, neigeActuelle = -1;
const etatCases = { proprio: [], arbres: [], foret: [], bati: new Set() };

export const TERRE = t => t >= 3;
export const hauteur = i => (H[i] ?? 0);
export const carte = () => C;

const MAT_SOL = new THREE.MeshLambertMaterial({ vertexColors: true });
const MAT_VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** Pour les bâtiments, les routes et les troupes : volumes ronds lissés, faces franches là où la géométrie le dit. */
const MAT_LISSE = new THREE.MeshLambertMaterial({ vertexColors: true });
export { MAT_VC, MAT_LISSE };

// ------------------------------------------------------------------ couleurs
const col = h => new THREE.Color(h);
const SOL = {
  plaine: [0xb3c096, 0x8ccf55, 0x7dbb44, 0xa8b14c].map(col),
  fertile: [0xaec294, 0x83cc4b, 0x76c140, 0xb0aa46].map(col),
  foret: [0x8e9b72, 0x5c9e3a, 0x579537, 0x7a8a3b].map(col),
  colline: [0xa2a788, 0x93ac60, 0x8da35c, 0x9c9c58].map(col),
  sable: [0xdcc68c, 0xe2cd92, 0xe4cf92, 0xdcc68c].map(col),
  montagne: [0x8a8d86, 0x8d9088, 0x8f9289, 0x8d8f87].map(col),
  bati: [0xd5ccb2, 0xd6c497, 0xd8c594, 0xd3bf90].map(col),
};
const NEIGE = col(0xeef3f8), COTE = col(0xd9c48e), TERREC = col(0x7d6a4c);
const VERT = [0x3f8f36, 0x4f9e3a, 0x5aab3f, 0x6cb846, 0x86c24c, 0x3a7f33, 0x72b843];
const PRINTEMPS = [0x8fd15a, 0xa6dd6a, 0x7cc84d, 0x97d35f];
const FLEURS = [0xf6c6d8, 0xfff2f6, 0xf2b5cf];
const AUTOMNE = [0xe3a33a, 0xd9792b, 0xc9502c, 0xe8c547, 0x8a9a3a, 0xd28a2e];
const CONIF = [0x2f6f3a, 0x3b7d3f, 0x2c6534, 0x356f36];

function genre(i) {
  const t = C.terrain[i];
  if (etatCases.bati.has(i)) return 'bati';
  if (t === 3) return 'sable';
  if (t === 5) return 'colline';
  if (t === 6) return 'montagne';
  if ((etatCases.foret[i] ?? C.foret[i])) return 'foret';
  return C.fertile[i] ? 'fertile' : 'plaine';
}
function couleurCase(i, s, neige, out) {
  out.copy(SOL[genre(i)][s]);
  if (neige > 0.02) {
    const k = etatCases.bati.has(i) ? 0.55 : C.terrain[i] === 6 ? 0.9 : 0.85;
    out.lerp(NEIGE, neige * k);
  }
  return out;
}

// ------------------------------------------------------------------ outils de géométrie
function coin(x, z, r, k, y) { const a = (60 * k - 30) * Math.PI / 180; return [x + Math.cos(a) * r, y, z + Math.sin(a) * r]; }
const SQ3 = Math.sqrt(3), R0 = 0.42, R1 = 1.25;
const HT = [-0.55, -0.22, -0.2, 0.07, 0.2, 0.5, 0.72];
const lisse = t => t * t * (3 - 2 * t);

/** Le relief : chaque case a sa hauteur, fondue avec ses voisines (côtes, collines et berges arrondies). */
function poids(x, z, fn) {
  const r0 = Math.round(z / 1.5);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    const dec = 0.5 * (r & 1), c0 = Math.round(x / SQ3 - dec);
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      const d = Math.hypot(SQ3 * (c + dec) - x, 1.5 * r - z);
      if (d >= R1) continue;
      fn(c < 0 || r < 0 || c >= C.l || r >= C.h ? -1 : r * C.l + c, d <= R0 ? 1 : 1 - lisse((d - R0) / (R1 - R0)));
    }
  }
}
export function hauteurEn(x, z) {
  if (!C) return 0;
  let s = 0, w = 0;
  poids(x, z, (i, k) => { s += k * (i < 0 ? HT[0] : H[i]); w += k; });
  return w > 0 ? s / w : HT[0];
}
/** Hauteur où poser quelque chose (jamais sous l'eau). */
export const solEn = (x, z) => Math.max(hauteurEn(x, z), 0.0);

// ------------------------------------------------------------------ construction
export function construire(carteServeur) {
  C = carteServeur;
  geo.l = C.l; geo.h = C.h;
  while (groupe.children.length) { const o = groupe.children.pop(); o.geometry?.dispose?.(); }
  const N = C.l * C.h;
  H = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = C.terrain[i];
    H[i] = HT[t] + (t >= 4 ? (hache(i, 7) - 0.5) * 0.05 : 0);
  }
  etatCases.foret = C.foret.slice();
  etatCases.arbres = C.arbres.slice();
  etatCases.proprio = new Array(N).fill(-1);
  etatCases.couleurs = {};
  etatCases.bati = new Set();
  saisonActuelle = -1;
  construireSol();
  construireEau();
  construireRivieres();
  construireRelief();
  construireArbres();
  construireSuperpositions();
  majSaison(1, 0);
}

let solIdx = null, solW = null;
const PAS = 0.21;
function construireSol() {
  const x0 = -1.1, z0 = -1.3, WX = SQ3 * C.l + 1.2, HZ = 1.5 * C.h + 0.6;
  const nx = Math.ceil((WX - x0) / PAS) + 1, nz = Math.ceil((HZ - z0) / PAS) + 1, n = nx * nz;
  const pos = new Float32Array(n * 3);
  solIdx = new Int32Array(n * 4).fill(-1);
  solW = new Float32Array(n * 4);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const v = iz * nx + ix, x = x0 + ix * PAS, z = z0 + iz * PAS;
    let s = 0, w = 0;
    const L = [];
    poids(x, z, (i, k) => { s += k * (i < 0 ? HT[0] : H[i]); w += k; if (i >= 0 && k > 0.001) L.push([i, k]); });
    L.sort((a, b) => b[1] - a[1]);
    for (let q = 0; q < Math.min(4, L.length); q++) { solIdx[v * 4 + q] = L[q][0]; solW[v * 4 + q] = L[q][1] / w; }
    pos[v * 3] = x; pos[v * 3 + 1] = w > 0 ? s / w : HT[0]; pos[v * 3 + 2] = z;
  }
  const idx = [];
  for (let iz = 0; iz < nz - 1; iz++) for (let ix = 0; ix < nx - 1; ix++) {
    const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
    if (pos[a * 3 + 1] < -0.14 && pos[b * 3 + 1] < -0.14 && pos[c * 3 + 1] < -0.14 && pos[d * 3 + 1] < -0.14) continue; // sous la mer : inutile
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  solMesh = new THREE.Mesh(g, MAT_SOL);
  solMesh.receiveShadow = true;
  groupe.add(solMesh);
  // le contour des cases, discret, posé sur le relief (comme sur la vidéo)
  const lv = [];
  for (let i = 0; i < C.l * C.h; i++) {
    if (!TERRE(C.terrain[i])) continue;
    const { x, z } = posCase(i);
    for (let k = 0; k < 6; k++) {
      const nvo = voisin(i, k);
      if (nvo >= 0 && TERRE(C.terrain[nvo]) && nvo < i) continue;
      const a = coin(x, z, 1, k, 0), b = coin(x, z, 1, k + 1, 0);
      for (let q = 0; q < 4; q++) {
        const p1 = [a[0] + (b[0] - a[0]) * q / 4, a[2] + (b[2] - a[2]) * q / 4], p2 = [a[0] + (b[0] - a[0]) * (q + 1) / 4, a[2] + (b[2] - a[2]) * (q + 1) / 4];
        const h1 = hauteurEn(p1[0], p1[1]), h2 = hauteurEn(p2[0], p2[1]);
        if (h1 < 0.03 || h2 < 0.03) continue;
        lv.push(p1[0], h1 + 0.012, p1[1], p2[0], h2 + 0.012, p2[1]);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3));
  groupe.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x20330f, transparent: true, opacity: 0.2, depthWrite: false })));
}

/** Recolore le relief (saison, neige, bâti, plages, teinte des territoires). */
const SABLE = col(0xe6d39a), FOND = col(0xc9b780);
function recolorer(s, neige) {
  const N = C.l * C.h, tc = new Float32Array(N * 3), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    if (TERRE(C.terrain[i])) couleurCase(i, s, neige, c); else c.copy(FOND);
    tc[i * 3] = c.r; tc[i * 3 + 1] = c.g; tc[i * 3 + 2] = c.b;
  }
  const cr = {};
  for (const [k, v] of Object.entries(etatCases.couleurs || {})) cr[k] = new THREE.Color(v);
  const colA = solMesh.geometry.attributes.color, pos = solMesh.geometry.attributes.position, n = pos.count, pr = etatCases.proprio;
  for (let v = 0; v < n; v++) {
    let r = 0, g = 0, b = 0, tr = 0, tg = 0, tb = 0, tw = 0;
    for (let q = 0; q < 4; q++) {
      const i = solIdx[v * 4 + q];
      if (i < 0) break;
      const w = solW[v * 4 + q];
      r += w * tc[i * 3]; g += w * tc[i * 3 + 1]; b += w * tc[i * 3 + 2];
      const o = cr[pr[i]];
      if (o) { tr += w * o.r; tg += w * o.g; tb += w * o.b; tw += w; }
    }
    const h = pos.getY(v), x = pos.getX(v), z = pos.getZ(v);
    // plage : le sable borde toutes les rives
    const sb = h < 0.12 ? 1 - lisse(Math.max(0, Math.min(1, (h - 0.02) / 0.1))) : 0;
    if (sb > 0) { r += (SABLE.r - r) * sb; g += (SABLE.g - g) * sb; b += (SABLE.b - b) * sb; }
    else if (tw > 0.01) { const k = 0.09 * tw; r += (tr / tw - r) * k; g += (tg / tw - g) * k; b += (tb / tw - b) * k; }
    const nz = 0.92 + hache(Math.round(x * 2.4), Math.round(z * 2.4), 5) * 0.14;
    colA.setXYZ(v, r * nz, g * nz, b * nz);
  }
  colA.needsUpdate = true;
}

// ------------------------------------------------------------------ eau
const EAU_VS = `
attribute float dist; attribute float lac;
varying float vD; varying float vL; varying vec2 vP;
#include <fog_pars_vertex>
void main(){
  vD = dist; vL = lac;
  vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const EAU_FS = `
uniform float uT; uniform float uGel; uniform float uVague;
varying float vD; varying float vL; varying vec2 vP;
#include <common>
#include <fog_pars_fragment>
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hh(i), hh(i+vec2(1.0,0.0)), f.x), mix(hh(i+vec2(0.0,1.0)), hh(i+vec2(1.0,1.0)), f.x), f.y); }
void main(){
  float d = vD;
  vec3 cote = vec3(0.40, 0.86, 0.85);
  vec3 milieu = vec3(0.17, 0.58, 0.82);
  vec3 large = vec3(0.10, 0.34, 0.64);
  vec3 c = mix(cote, milieu, smoothstep(0.05, 1.7, d));
  c = mix(c, large, smoothstep(1.7, 5.5, d));
  float w = nn(vP*1.2 + vec2(uT*0.22, uT*0.15))*0.5 + nn(vP*2.6 - vec2(uT*0.28, -uT*0.19))*0.5;
  c += (w - 0.5) * 0.07 * uVague;
  float bord = smoothstep(0.45, 0.0, d);
  float bande = smoothstep(0.72, 1.0, sin(d*9.0 - uT*1.5*uVague + w*3.0)*0.5 + 0.5) * smoothstep(1.0, 0.15, d);
  c = mix(c, vec3(0.94, 0.98, 1.0), bord*0.6 + bande*0.38);
  float s = smoothstep(0.84, 0.97, nn(vP*4.2 + vec2(uT*0.55, uT*0.37)));
  c += s * 0.13 * (1.0 - bord);
  float glace = uGel * (vL > 0.5 ? 0.9 : smoothstep(0.7, 0.0, d) * 0.7);
  c = mix(c, vec3(0.86, 0.93, 0.97), glace);
  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

export function materiauEau(vs = EAU_VS, fs = EAU_FS, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: U.t, uGel: U.gel, uVague: U.vague }, extra]),
    vertexShader: vs, fragmentShader: fs, fog: true, toneMapped: false,
  });
}

function construireEau() {
  const WX = Math.sqrt(3) * C.l, HZ = 1.5 * C.h, marge = 60;
  const sx = Math.ceil((WX + marge * 2) / 0.45), sz = Math.ceil((HZ + marge * 2) / 0.45);
  const g = new THREE.PlaneGeometry(WX + marge * 2, HZ + marge * 2, sx, sz);
  g.rotateX(-Math.PI / 2);
  g.translate(WX / 2, 0, HZ / 2);
  const pos = g.attributes.position, n = pos.count;
  const dist = new Float32Array(n), lac = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), z = pos.getZ(v);
    const r0 = Math.round(z / 1.5), c0 = Math.round(x / Math.sqrt(3));
    let m = 6;
    for (let r = r0 - 4; r <= r0 + 4; r++) {
      if (r < 0 || r >= C.h) continue;
      for (let c = c0 - 4; c <= c0 + 4; c++) {
        if (c < 0 || c >= C.l) continue;
        const i = r * C.l + c;
        if (!TERRE(C.terrain[i])) continue;
        const p = posCase(i), d = Math.hypot(p.x - x, p.z - z) - 0.9;
        if (d < m) m = d;
      }
    }
    dist[v] = Math.max(0, -hauteurEn(x, z) * 3.5) + Math.max(0, m - 1.2);
    const r = Math.round(z / 1.5);
    const c = Math.round(x / Math.sqrt(3) - 0.5 * (r & 1));
    lac[v] = r >= 0 && r < C.h && c >= 0 && c < C.l && C.terrain[r * C.l + c] === 2 ? 1 : 0;
  }
  g.setAttribute('dist', new THREE.BufferAttribute(dist, 1));
  g.setAttribute('lac', new THREE.BufferAttribute(lac, 1));
  eauMesh = new THREE.Mesh(g, materiauEau());
  groupe.add(eauMesh);
}

// ------------------------------------------------------------------ rivières
const RIV_VS = `
varying vec2 vUv; varying vec2 vP;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vP = wp.xz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const RIV_FS = `
uniform float uT; uniform float uGel; varying vec2 vUv; varying vec2 vP;
#include <common>
#include <fog_pars_fragment>
void main(){
  float bord = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  vec3 c = mix(vec3(0.55, 0.86, 0.90), vec3(0.24, 0.66, 0.86), bord);
  float f = sin(vUv.x*3.0 - uT*2.4 + sin(vUv.y*6.0)*0.6);
  c += smoothstep(0.85, 1.0, f) * 0.18 * bord;
  c = mix(c, vec3(0.88,0.94,0.98), uGel*0.8);
  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

function construireRivieres() {
  const mat = materiauEau(RIV_VS, RIV_FS);
  mat.side = THREE.DoubleSide;
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  for (const ch of C.rivieres) {
    if (ch.length < 2) continue;
    const pts = ch.map(i => { const p = posCase(i); return new THREE.Vector3(p.x, 0, p.z); });
    // la rivière se jette dans l'eau au bord de la dernière case, pas en son centre
    const der = pts[pts.length - 1], av = pts[pts.length - 2];
    if (!TERRE(C.terrain[ch[ch.length - 1]])) der.lerp(av, 0.35);
    const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = ch.length * 12, pos = [], uv = [], idx = [];
    let long = 0, prec = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, p = courbe.getPoint(t), tg = courbe.getTangent(t);
      if (prec) long += p.distanceTo(prec);
      prec = p;
      const nx = -tg.z, nz = tg.x, l = Math.hypot(nx, nz) || 1, w = 0.1 + 0.08 * t;
      // posée sur le relief, point par point : elle suit les pentes sans jamais passer dessous
      for (const sgn of [1, -1]) {
        const x = p.x + sgn * nx / l * w, z = p.z + sgn * nz / l * w;
        pos.push(x, Math.max(hauteurEn(x, z), hauteurEn(p.x, p.z), 0) + 0.022, z);
      }
      uv.push(long, 0, long, 1);
      if (k < n) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    groupe.add(new THREE.Mesh(g, mat));
  }
}

// ------------------------------------------------------------------ montagnes, rochers, gisements
export function fusion(geos) {
  // fusionne des géométries non indexées (position, normal, color)
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, o * 3);
    Nn.set(g.attributes.normal.array, o * 3);
    Cc.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  r.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  r.computeBoundingSphere();
  return r;
}
export function piece(g, couleur, m) {
  const x = g.index ? g.toNonIndexed() : g.clone();
  if (m) x.applyMatrix4(m);
  const c = new THREE.Color(couleur), n = x.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  x.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!x.attributes.normal) x.computeVertexNormals();
  return x;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
function mat4(x, y, z, sx, sy, sz, ry = 0) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), new THREE.Vector3(sx, sy, sz)); }

function construireRelief() {
  const pic = new THREE.ConeGeometry(0.5, 1, 7, 2).translate(0, 0.5, 0);
  const geos = [];
  const N = C.l * C.h;
  for (let i = 0; i < N; i++) {
    if (C.terrain[i] !== 6) continue;
    const { x, z } = posCase(i), nb = 1 + Math.floor(hache(i, 3) * 3);
    for (let k = 0; k < nb; k++) {
      const a = hache(i, k, 1) * 6.28, r = k ? 0.38 + hache(i, k, 2) * 0.2 : hache(i, k, 4) * 0.15;
      const w = k ? 0.75 + hache(i, k, 5) * 0.3 : 1.2 + hache(i, k, 6) * 0.3, h = k ? 0.7 + hache(i, k, 7) * 0.4 : 1.15 + hache(i, k, 8) * 0.55;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const yb = hauteurEn(px, pz) - 0.06;
      const g = piece(pic, 0x8b8e88, mat4(px, yb, pz, w, h, w, a));
      // dégradé : roche sombre en bas, plus claire en haut
      const p = g.attributes.position, c = g.attributes.color;
      for (let v = 0; v < p.count; v++) { const t = (p.getY(v) - yb) / h; const k2 = 0.82 + t * 0.3; c.setXYZ(v, 0.52 * k2, 0.53 * k2, 0.51 * k2); }
      geos.push(g);
      geos.push(piece(pic, 0xf3f6fa, mat4(px, yb + h * 0.64, pz, w * 0.37, h * 0.37, w * 0.37, a)));
    }
  }
  if (geos.length) {
    const m = new THREE.Mesh(fusion(geos), MAT_VC);
    m.castShadow = true; m.receiveShadow = true;
    groupe.add(m);
  }
  const caillou = new THREE.DodecahedronGeometry(0.15, 0);
  const rg = [];
  for (let i = 0; i < N; i++) {
    const t = C.terrain[i], gis = C.gisement[i];
    if (!(t === 5 && !C.foret[i]) && !gis) continue;
    const { x, z } = posCase(i), nb = gis ? 3 : 1 + Math.floor(hache(i, 9) * 2);
    const couleur = gis === 'fer' ? 0xb0603a : gis === 'or' ? 0xf0c43a : gis === 'charbon' ? 0x2e2e33 : gis === 'pierre' ? 0xd0cbbf : 0x9c9c94;
    for (let k = 0; k < nb; k++) {
      const a = hache(i, k, 11) * 6.28, r = t === 6 ? 0.66 : 0.2 + hache(i, k, 12) * 0.42, s = 0.7 + hache(i, k, 13) * 0.8;
      const rx = x + Math.cos(a) * r, rz = z + Math.sin(a) * r;
      rg.push(piece(caillou, couleur, mat4(rx, solEn(rx, rz) + 0.04, rz, s, s * 0.8, s, a)));
    }
  }
  if (rg.length) {
    rochers = new THREE.Mesh(fusion(rg), MAT_VC);
    rochers.castShadow = true;
    groupe.add(rochers);
  }
}

// ------------------------------------------------------------------ arbres
function houppier() {
  const s = new THREE.IcosahedronGeometry(0.2, 2);
  const parts = [[0, 0.42, 0, 1.15], [0.12, 0.36, 0.06, 0.8], [-0.1, 0.38, -0.07, 0.85]].map(([x, y, z, k]) => {
    const g = s.clone(); g.scale(k, k * 0.95, k); g.translate(x, y, z); return g.toNonIndexed();
  });
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const P = new Float32Array(n * 3), N2 = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { P.set(p.attributes.position.array, o * 3); N2.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
  return g;
}
function balancer(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.t; sh.uniforms.uVent = U.vent;
    sh.vertexShader = 'uniform float uT; uniform float uVent;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
      #else
      float ph = 0.0;
      #endif
      float sw = sin(uT * (1.4 + uVent) + ph) * 0.6 + sin(uT * 3.1 + ph * 1.3) * 0.25;
      float hy = max(position.y - 0.15, 0.0);
      transformed.x += sw * uVent * 0.22 * hy;
      transformed.z += cos(uT * 1.2 + ph) * uVent * 0.1 * hy;`);
  };
  return mat;
}
let capArbres = 0, placeArbre = [];
function construireArbres() {
  const N = C.l * C.h;
  capArbres = 0;
  for (let i = 0; i < N; i++) if (TERRE(C.terrain[i]) && C.terrain[i] !== 6) capArbres += 12;
  capArbres = Math.max(capArbres, 64);
  arbresF = new THREE.InstancedMesh(houppier(), balancer(new THREE.MeshLambertMaterial({})), capArbres);
  arbresC = new THREE.InstancedMesh(new THREE.ConeGeometry(0.19, 0.62, 10).translate(0, 0.5, 0), balancer(new THREE.MeshLambertMaterial({})), capArbres);
  troncs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.05, 0.26, 5).translate(0, 0.13, 0), new THREE.MeshLambertMaterial({ color: 0x7a5232 }), capArbres);
  const c = new THREE.Color(0x5aab3f);
  for (const m of [arbresF, arbresC]) { for (let k = 0; k < capArbres; k++) m.setColorAt(k, c); m.castShadow = true; m.receiveShadow = true; groupe.add(m); }
  troncs.castShadow = true; groupe.add(troncs);
  placerArbres();
}
function placerArbres() {
  const N = C.l * C.h;
  let nf = 0, nc = 0, nt = 0;
  placeArbre = [];
  for (let i = 0; i < N; i++) {
    const n = Math.min(11, (etatCases.arbres[i] | 0) * 2);
    if (!n || !TERRE(C.terrain[i]) || C.terrain[i] === 6) continue;
    const { x, z } = posCase(i);
    for (let k = 0; k < n; k++) {
      const a = hache(i, k, 21) * 6.283, r = Math.sqrt(hache(i, k, 22)) * 0.66, s = 0.62 + hache(i, k, 23) * 0.5;
      const conif = C.terrain[i] === 5 || hache(i, k, 24) < 0.12;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, py = hauteurEn(px, pz) - 0.01;
      if (py < 0.05) continue; // pas d'arbre dans l'eau ni sur la plage
      _m.compose(_p.set(px, py, pz), _q.setFromAxisAngle(Y, hache(i, k, 25) * 6.28), _s.set(s, s * (conif ? 1.1 : 1), s));
      troncs.setMatrixAt(nt++, _m);
      if (conif) arbresC.setMatrixAt(nc++, _m); else arbresF.setMatrixAt(nf++, _m);
      placeArbre.push([conif, conif ? nc - 1 : nf - 1, i, k, s, px, py, pz]);
    }
  }
  arbresF.count = nf; arbresC.count = nc; troncs.count = nt;
  for (const m of [arbresF, arbresC, troncs]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere?.(); }
}
function colorerArbres(s, neige) {
  const c = new THREE.Color(), blanc = NEIGE;
  for (const [conif, idx, i, k, sc, px, py, pz] of placeArbre) {
    if (conif) {
      c.setHex(CONIF[Math.floor(hache(i, k, 31) * CONIF.length)]);
      if (neige > 0.2) c.lerp(blanc, 0.45 * neige);
      arbresC.setColorAt(idx, c);
    } else {
      const h = hache(i, k, 32);
      if (s === 1) c.setHex(h < 0.08 ? FLEURS[h < 0.04 ? 0 : 2] : PRINTEMPS[Math.floor(h * 40) % PRINTEMPS.length]);
      else if (s === 2) c.setHex(VERT[Math.floor(h * VERT.length)]);
      else if (s === 3) c.setHex(h < 0.22 ? VERT[Math.floor(h * 30) % VERT.length] : AUTOMNE[Math.floor(h * 60) % AUTOMNE.length]);
      else { c.setHex(0x8b7d6b); if (neige > 0.25) c.lerp(blanc, 0.6 * neige); }
      arbresF.setColorAt(idx, c);
      // l'hiver, les feuillus sont nus : houppier réduit
      const e = s === 0 ? 0.62 : 1;
      _m.compose(_p.set(px, py, pz), _q.setFromAxisAngle(Y, hache(i, k, 25) * 6.28), _s.set(sc * e, sc * e, sc * e));
      arbresF.setMatrixAt(idx, _m);
    }
  }
  for (const m of [arbresF, arbresC]) { if (m.instanceColor) m.instanceColor.needsUpdate = true; m.instanceMatrix.needsUpdate = true; }
}

/** Saison (0 hiver… 3 automne) et neige au sol (0 à 1). */
export function majSaison(s, neige) {
  const nq = Math.round(neige * 10) / 10;
  if (s === saisonActuelle && nq === neigeActuelle) return;
  saisonActuelle = s; neigeActuelle = nq;
  recolorer(s, nq);
  colorerArbres(s, nq);
}

// ------------------------------------------------------------------ état de la partie (arbres, territoires, bâti)
export function majEtat(etat) {
  const cs = etat.cases;
  let arbres = false;
  for (let i = 0; i < cs.arbres.length; i++) if (cs.arbres[i] !== etatCases.arbres[i]) { arbres = true; break; }
  etatCases.arbres = cs.arbres.slice();
  etatCases.foret = cs.foret.slice();
  const bati = new Set(etat.batiments.map(b => b.case));
  const changeBati = bati.size !== etatCases.bati.size || [...bati].some(i => !etatCases.bati.has(i));
  etatCases.bati = bati;
  etatCases.proprio = cs.proprio.slice();
  etatCases.couleurs = Object.fromEntries(etat.royaumes.map(r => [r.id, r.couleur]));
  if (arbres) { placerArbres(); }
  saisonActuelle = -1;
  majSaison(etat.saison, etat.meteo.neige_sol);
  dessinerTerritoires(etat);
}

function construireSuperpositions() {
  const N = C.l * C.h;
  const hex = new THREE.CircleGeometry(0.97, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  g0.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
  liseres = new THREE.Mesh(g0, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  groupe.add(liseres);
  surb = new THREE.InstancedMesh(hex, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false, depthTest: false }), N);
  surb.count = 0;
  for (let i = 0; i < N; i++) surb.setColorAt(i, new THREE.Color(0xe6ff4a));
  groupe.add(surb);
  const ring = [];
  for (let k = 0; k < 6; k++) {
    const o1 = coin(0, 0, 1.0, k, 0), o2 = coin(0, 0, 1.0, k + 1, 0), i1 = coin(0, 0, 0.83, k, 0), i2 = coin(0, 0, 0.83, k + 1, 0);
    ring.push(...o1, ...o2, ...i2, ...o1, ...i2, ...i1);
  }
  const gr = new THREE.BufferGeometry();
  gr.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
  anneau = new THREE.Mesh(gr, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false }));
  anneau.visible = false;
  groupe.add(anneau);
  points = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false, transparent: true }), 500);
  points.count = 0;
  groupe.add(points);
}

export const dessus = i => Math.max(H[i] ?? 0, 0.02);

function dessinerTerritoires(etat) {
  const couleurs = {};
  for (const r of etat.royaumes) couleurs[r.id] = new THREE.Color(r.couleur);
  couleurs[99] = new THREE.Color('#4b4b4b');
  const pr = etat.cases.proprio, N = pr.length;
  const pos = [], cols = [], c = new THREE.Color(), sombre = new THREE.Color(0x1a1a1a), gris = new THREE.Color(0x888888);
  for (let i = 0; i < N; i++) {
    const p = pr[i];
    if (p < 0) continue;
    const { x, z } = posCase(i);
    for (let k = 0; k < 6; k++) {
      const v = voisin(i, k);
      if (v >= 0 && pr[v] === p) continue;
      // liseré double (sombre dessous, couleur du royaume dessus), posé sur le relief
      for (const [r1, r2, dy, cc] of [[1.0, 0.8, 0.02, sombre], [0.98, 0.86, 0.03, c.copy(couleurs[p] || gris).offsetHSL(0, 0.12, 0.14)]]) {
        const A = coin(x, z, r1, k, 0), B = coin(x, z, r1, k + 1, 0), A2 = coin(x, z, r2, k, 0), B2 = coin(x, z, r2, k + 1, 0);
        for (let q = 0; q < 3; q++) {
          const P = (U1, U2, t) => { const px = U1[0] + (U2[0] - U1[0]) * t, pz = U1[2] + (U2[2] - U1[2]) * t; return [px, solEn(px, pz) + dy, pz]; };
          const o1 = P(A, B, q / 3), o2 = P(A, B, (q + 1) / 3), i1 = P(A2, B2, q / 3), i2 = P(A2, B2, (q + 1) / 3);
          pos.push(...o1, ...o2, ...i2, ...o1, ...i2, ...i1);
          for (let w = 0; w < 6; w++) cols.push(cc.r, cc.g, cc.b);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  liseres.geometry.dispose();
  liseres.geometry = g;
}

export function surbrillance(cases, couleur = 0xe6ff4a) {
  let n = 0;
  const c = new THREE.Color(couleur);
  for (const i of cases) {
    const { x, z } = posCase(i);
    _m.makeTranslation(x, dessus(i) + 0.03, z);
    surb.setMatrixAt(n, _m);
    surb.setColorAt(n, c);
    n++;
  }
  surb.count = n;
  surb.instanceMatrix.needsUpdate = true;
  if (surb.instanceColor) surb.instanceColor.needsUpdate = true;
}
export function selection(i, couleur = 0xffffff) {
  if (i == null || i < 0) { anneau.visible = false; return; }
  const { x, z } = posCase(i);
  anneau.visible = true;
  anneau.position.set(x, dessus(i) + 0.045, z);
  anneau.material.color.setHex(couleur);
}
export function trace(cases) {
  let n = 0;
  for (const i of cases || []) {
    if (n >= 500) break;
    const { x, z } = posCase(i);
    _m.makeTranslation(x, dessus(i) + 0.05, z);
    points.setMatrixAt(n++, _m);
  }
  points.count = n;
  points.instanceMatrix.needsUpdate = true;
}
export function animer(dt, t) {
  U.t.value = t;
  if (surb && surb.count) surb.material.opacity = 0.36 + Math.sin(t * 4.5) * 0.16;
}
export { lerp };
