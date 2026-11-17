// Les routes : tracées par le moteur entre les bâtiments et les villes, dessinées ici en rubans posés sur le relief,
// courbes dans les virages. Leur aspect suit leur niveau : chemin de terre, route pavée, route royale
// (large, empierrée, bordée d'arbres taillés et de bornes). Un pont enjambe chaque rivière.
import { THREE, scene, posCase, hache } from './scene.js';
import { solEn, carte, piece, fusion, MAT_LISSE } from './plateau.js';

const groupe = new THREE.Group();
scene.add(groupe);
let signature = '';
const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
const ASPECT = {
  1: { l: 0.085, centre: 0xb08d5e, bord: 0x9a7a50 },
  2: { l: 0.115, centre: 0xb9b3a6, bord: 0x8a8478 },
  3: { l: 0.15, centre: 0xe3d9c0, bord: 0xa39a86 },
};

function ruban(pts, a, pos, col) {
  const c1 = new THREE.Color(a.centre), c2 = new THREE.Color(a.bord), n = pts.length;
  const lignes = [];
  for (let k = 0; k < n; k++) {
    const p = pts[k], q = pts[Math.min(n - 1, k + 1)], o = pts[Math.max(0, k - 1)];
    let tx = q[0] - o[0], tz = q[1] - o[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const nx = -tz, nz = tx, y0 = solEn(p[0], p[1]);
    // le ruban ne s'enfonce pas dans une pente : chaque bord prend la hauteur la plus haute
    lignes.push([-1, -0.62, 0.62, 1].map(f => { const x = p[0] + nx * a.l * f, z = p[1] + nz * a.l * f; return [x, Math.max(solEn(x, z), y0) + 0.02, z]; }));
  }
  for (let k = 0; k < n - 1; k++) {
    const A = lignes[k], B = lignes[k + 1];
    for (let s = 0; s < 3; s++) {
      pos.push(...A[s], ...B[s], ...B[s + 1], ...A[s], ...B[s + 1], ...A[s + 1]);
      const c = s === 1 ? c1 : c2;
      // pavés : une case sur deux un peu plus sombre
      const k2 = a === ASPECT[2] && s === 1 ? 0.93 + 0.07 * (k % 2) : 1;
      for (let q = 0; q < 6; q++) col.push(c.r * k2, c.g * k2, c.b * k2);
    }
  }
}

/** routes : [[case, case voisine, niveau], …] */
export function majRoutes(routes) {
  const sig = JSON.stringify(routes || []);
  if (sig === signature) return;
  signature = sig;
  while (groupe.children.length) { const o = groupe.children.pop(); o.geometry?.dispose?.(); }
  if (!routes || !routes.length) return;
  const C = carte(), liens = new Map();
  const lier = (a, b, n) => { if (!liens.has(a)) liens.set(a, []); liens.get(a).push([b, n]); };
  for (const [a, b, n] of routes) { lier(a, b, n); lier(b, a, n); }
  const pos = [], col = [], objets = [];
  const boite = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), boule = new THREE.IcosahedronGeometry(0.5, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0);
  const m4 = (x, y, z, sx, sy, sz, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
  for (const [i, L] of liens) {
    const c = posCase(i), niv = Math.max(...L.map(x => x[1])), a = ASPECT[niv] || ASPECT[1];
    const milieux = L.map(([v]) => { const p = posCase(v); return [(c.x + p.x) / 2, (c.z + p.z) / 2]; });
    if (L.length === 2) {
      // virage : une courbe du milieu d'un bord au milieu de l'autre, par le centre
      const [A, B] = milieux, pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, u = 1 - t; pts.push([u * u * A[0] + 2 * u * t * c.x + t * t * B[0], u * u * A[1] + 2 * u * t * c.z + t * t * B[1]]); }
      ruban(pts, a, pos, col);
    } else {
      for (const M of milieux) { const pts = []; for (let k = 0; k <= 5; k++) pts.push([M[0] + (c.x - M[0]) * k / 5, M[1] + (c.z - M[1]) * k / 5]); ruban(pts, a, pos, col); }
    }
    const y = solEn(c.x, c.z), dir = Math.atan2(milieux[0][1] - c.z, milieux[0][0] - c.x);
    if (C.riviere[i] && C.terrain[i] >= 3) {
      // un pont : planches au niveau 1, pierre ensuite, avec ses parapets
      const cp = niv === 1 ? 0x8b5a2b : 0xb9b3a6, w = a.l * 2.6;
      objets.push(piece(boite, cp, m4(c.x, y + 0.035, c.z, 0.62, 0.035, w, -dir)));
      for (const s of [-1, 1]) objets.push(piece(boite, niv === 1 ? 0x6b4423 : 0x8a8478, m4(c.x + Math.sin(dir) * s * w / 2, y + 0.05, c.z - Math.cos(dir) * s * w / 2, 0.62, 0.06, 0.025, -dir)));
    }
    if (niv === 3 && C.terrain[i] >= 3) {
      // route royale : arbres d'alignement taillés et borne
      L.forEach(([v], k) => {
        if (hache(i, v, 3) > 0.6) return;
        const M = milieux[k], dx = M[0] - c.x, dz = M[1] - c.z, l = Math.hypot(dx, dz) || 1;
        for (const s of [-1, 1]) {
          const x = c.x + dx * 0.55 + (-dz / l) * s * 0.3, z = c.z + dz * 0.55 + (dx / l) * s * 0.3, yy = solEn(x, z);
          if (yy < 0.05) continue;
          objets.push(piece(cyl, 0x6b4a2a, m4(x, yy, z, 0.035, 0.2, 0.035)));
          objets.push(piece(boule, 0x4c8f3a, m4(x, yy + 0.27, z, 0.17, 0.2, 0.17)));
        }
      });
      if (hache(i, 9) < 0.4) objets.push(piece(boite, 0xe8e2d2, m4(c.x + Math.cos(dir + 1.2) * 0.24, y, c.z + Math.sin(dir + 1.2) * 0.24, 0.035, 0.07, 0.035)));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  groupe.add(m);
  if (objets.length) { const o = new THREE.Mesh(fusion(objets), MAT_LISSE); o.castShadow = true; o.receiveShadow = true; groupe.add(o); }
}
export function effacerRoutes() { signature = ''; while (groupe.children.length) { const o = groupe.children.pop(); o.geometry?.dispose?.(); } }
