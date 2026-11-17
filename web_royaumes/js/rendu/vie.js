// La vie de la carte : fumées des cheminées et des ateliers, nuages et leurs ombres, oiseaux, barques et voiliers,
// villageois et charrettes, moutons. Tout est décor : rien ici ne touche aux règles.
import { THREE, scene, posCase, chaqueImage, hache, cam, voisins, lerp } from './scene.js';
import { dessus, carte, TERRE, solEn } from './plateau.js';
import { parts, couleurDe } from './monde.js';

export const climat = { froid: true, vent: 0.3, dir: 0, nuages: 6, gris: 0, oiseaux: true };
const groupe = new THREE.Group();
scene.add(groupe);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ fumées
function pool(couleur, opacite, n) {
  const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshLambertMaterial({ color: couleur, transparent: true, opacity: opacite, depthWrite: false }), n);
  m.count = 0;
  m.frustumCulled = false;
  groupe.add(m);
  return { m, p: [] };
}
const fumees = { blanche: pool(0xf4f4f4, 0.38, 600), noire: pool(0x5a5853, 0.42, 400), poudre: pool(0xf4f1ea, 0.75, 200) };
export function bouffee(x, y, z, genre = 'blanche') {
  const f = fumees[genre];
  if (f.p.length >= f.m.instanceMatrix.count) f.p.shift();
  const vie = genre === 'poudre' ? 2.2 : 3.6 + Math.random() * 1.2;
  f.p.push({ x, y, z, age: 0, vie, t0: genre === 'poudre' ? 1.6 : 0.45, monte: genre === 'poudre' ? 0.25 : 0.32, s: Math.random() * 6 });
}
function majFumees(dt) {
  const vx = Math.cos(climat.dir) * climat.vent * 0.45, vz = Math.sin(climat.dir) * climat.vent * 0.45;
  for (const f of Object.values(fumees)) {
    let n = 0;
    for (let i = f.p.length - 1; i >= 0; i--) {
      const q = f.p[i];
      q.age += dt;
      if (q.age > q.vie) { f.p.splice(i, 1); continue; }
      q.y += q.monte * dt;
      q.x += (vx + Math.sin(q.s + q.age) * 0.03) * dt;
      q.z += vz * dt;
    }
    for (const q of f.p) {
      const k = q.age / q.vie, taille = q.t0 * (0.6 + k * 1.6) * (k > 0.75 ? (1 - k) / 0.25 : 1);
      _m.compose(_p.set(q.x, q.y, q.z), _q.identity(), _s.set(taille, taille, taille));
      f.m.setMatrixAt(n++, _m);
    }
    f.m.count = n;
    f.m.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ nuages (et leurs ombres)
const matNuage = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, flatShading: true });
const geoNuage = (() => {
  const s = new THREE.IcosahedronGeometry(1, 1);
  const P = [];
  for (const [x, y, z, k] of [[0, 0, 0, 1.3], [1.3, -0.2, 0.3, 1], [-1.2, -0.25, -0.2, 0.95], [0.5, 0.45, -0.4, 0.9], [-0.4, 0.3, 0.6, 0.8]]) {
    const g = s.clone(); g.scale(k * 1.2, k * 0.7, k); g.translate(x * 1.1, y, z); P.push(g.toNonIndexed());
  }
  let n = 0; for (const p of P) n += p.attributes.position.count;
  const A = new Float32Array(n * 3), B = new Float32Array(n * 3); let o = 0;
  for (const p of P) { A.set(p.attributes.position.array, o * 3); B.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(A, 3)); g.setAttribute('normal', new THREE.BufferAttribute(B, 3));
  return g;
})();
const nuages = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(geoNuage, matNuage);
  m.castShadow = true;
  m.visible = false;
  const s = 1.2 + hache(i, 3) * 1.4;
  m.scale.set(s, s, s);
  groupe.add(m);
  nuages.push({ m, x: hache(i, 1) * 80, z: hache(i, 2) * 60, y: 9 + hache(i, 4) * 3 });
}
function majNuages(dt) {
  const vx = Math.cos(climat.dir) * (0.3 + climat.vent * 1.6), vz = Math.sin(climat.dir) * (0.3 + climat.vent * 1.6);
  const R = Math.max(30, cam.d * 1.6);
  // visibles de loin seulement : de près, seule leur ombre passe sur la campagne
  const op = Math.min(1, Math.max(0, (cam.d - 30) / 25)) * (0.75 + climat.gris * 0.2);
  matNuage.opacity = op;
  matNuage.colorWrite = op > 0.02;
  matNuage.color.setRGB(1 - climat.gris * 0.45, 1 - climat.gris * 0.43, 1 - climat.gris * 0.38);
  nuages.forEach((n, i) => {
    n.m.visible = i < climat.nuages;
    n.x += vx * dt; n.z += vz * dt;
    if (n.x - cam.x > R) n.x -= 2 * R; if (n.x - cam.x < -R) n.x += 2 * R;
    if (n.z - cam.z > R) n.z -= 2 * R; if (n.z - cam.z < -R) n.z += 2 * R;
    n.m.position.set(n.x, n.y, n.z);
  });
}

// ------------------------------------------------------------------ oiseaux
const geoOiseau = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.12, 0.03, -0.06, -0.02, 0, 0.02, 0, 0, 0, 0.12, 0.03, -0.06, 0.02, 0, 0.02], 3)); g.computeVertexNormals(); return g; })();
const matOiseau = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide });
const vols = [];
for (let i = 0; i < 3; i++) {
  const grp = new THREE.Group();
  for (let k = 0; k < 5; k++) { const o = new THREE.Mesh(geoOiseau, matOiseau); const c = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2); o.position.set(c * 0.3, 0, -Math.abs(c) * 0.25); grp.add(o); }
  groupe.add(grp);
  vols.push({ grp, a: hache(i, 5) * 6.28, x: 0, z: 0, t: 99 });
}
function majOiseaux(dt, t) {
  for (const v of vols) {
    v.t += dt;
    if (v.t > 26) { v.t = 0; v.a = Math.random() * 6.28; v.x = cam.x - Math.cos(v.a) * 25; v.z = cam.z - Math.sin(v.a) * 25; }
    v.x += Math.cos(v.a) * 2.2 * dt; v.z += Math.sin(v.a) * 2.2 * dt;
    v.grp.visible = climat.oiseaux;
    v.grp.position.set(v.x, 3.2 + Math.sin(t * 0.5) * 0.3, v.z);
    v.grp.rotation.y = -v.a + Math.PI / 2;
    v.grp.children.forEach((o, k) => { o.scale.y = Math.sin(t * 9 + k) * 1.4; });
  }
}

// ------------------------------------------------------------------ barques, voiliers, villageois, charrettes, moutons
const matCoque = new THREE.MeshLambertMaterial({ color: 0x7a4a24 }), matVoile = new THREE.MeshLambertMaterial({ color: 0xf7f4ea, side: THREE.DoubleSide });
function barque(voile) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.BoxGeometry(voile ? 0.5 : 0.26, 0.07, voile ? 0.16 : 0.1).translate(0, 0.035, 0), matCoque); c.castShadow = true; g.add(c);
  if (voile) { const mat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.02).translate(0, 0.25, 0), matCoque); g.add(mat); const v = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32).translate(0, 0.27, 0), matVoile); v.rotation.y = Math.PI / 2; v.castShadow = true; g.add(v); g.userData.voile = v; }
  return g;
}
const geoVillageois = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6).translate(0, 0.06, 0);
const geoTete = new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.15, 0);
const matPeau = new THREE.MeshLambertMaterial({ color: 0xf0c9a0 });
const HABITS = [0x8b3a2a, 0x3b5998, 0x6b8e23, 0x8b6914, 0x5a4a7a, 0xcfc6b0].map(c => new THREE.MeshLambertMaterial({ color: c }));
const matMouton = new THREE.MeshLambertMaterial({ color: 0xf4f2ea }), matTeteM = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
let acteurs = [];
const groupeActeurs = new THREE.Group();
groupe.add(groupeActeurs);

let liensRoutes = new Map();
/** Le trajet par la route d'une case à l'autre (à défaut : tout droit). */
function trajet(de, vers) {
  const vu = new Map([[de, -1]]), file = [de];
  while (file.length) {
    const c = file.shift();
    if (c === vers) { const p = []; for (let x = vers; x !== -1; x = vu.get(x)) p.unshift(x); return p; }
    for (const n of liensRoutes.get(c) || []) if (!vu.has(n)) { vu.set(n, c); file.push(n); }
  }
  return [de, vers];
}

/** Replace barques, passants et moutons d'après l'état (villes et bâtiments). */
export function majVie(etat) {
  liensRoutes = new Map();
  for (const [a, b] of etat.routes || []) { for (const [x, y] of [[a, b], [b, a]]) { if (!liensRoutes.has(x)) liensRoutes.set(x, []); liensRoutes.get(x).push(y); } }
  while (groupeActeurs.children.length) groupeActeurs.remove(groupeActeurs.children[0]);
  acteurs = [];
  const C = carte();
  if (!C) return;
  const parVille = new Map();
  for (const b of etat.batiments) {
    if (b.reste > 0) continue;
    if (b.ville != null) { if (!parVille.has(b.ville)) parVille.set(b.ville, []); parVille.get(b.ville).push(b); }
    if (b.cle === 'pecheur' || b.cle === 'port') {
      const eau = voisins(b.case).filter(v => !TERRE(C.terrain[v]));
      if (eau.length) {
        const g = barque(b.cle === 'port');
        groupeActeurs.add(g);
        const p = posCase(eau[0]), q = posCase(b.case);
        acteurs.push({ g, type: 'barque', cx: lerp(q.x, p.x, 0.8), cz: lerp(q.z, p.z, 0.8), r: 0.35 + hache(b.id) * 0.25, ph: hache(b.id, 2) * 6, v: 0.25 + hache(b.id, 3) * 0.2 });
      }
    }
    if (b.cle === 'bergerie') {
      const { x, z } = posCase(b.case);
      for (let k = 0; k < 4; k++) {
        const g = new THREE.Group();
        const corps = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 5).scale(1.3, 0.9, 1), matMouton); corps.position.y = 0.07; corps.castShadow = true; g.add(corps);
        const tete = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), matTeteM); tete.position.set(0.08, 0.09, 0); g.add(tete);
        groupeActeurs.add(g);
        acteurs.push({ g, type: 'mouton', cx: x + 0.12, cz: z + 0.12, ph: hache(b.id, k) * 6, y: dessus(b.case) });
        void solEn;
      }
    }
  }
  // passants entre l'hôtel de ville et les bâtiments
  for (const v of etat.villes) {
    const liste = (parVille.get(v.id) || []).filter(b => b.case !== v.case);
    if (!liste.length) continue;
    const n = Math.min(2 + v.niveau, 6);
    for (let k = 0; k < n; k++) {
      const b = liste[Math.floor(hache(v.id, k, 4) * liste.length)];
      const g = new THREE.Group();
      const corps = new THREE.Mesh(geoVillageois, HABITS[Math.floor(hache(v.id, k, 5) * HABITS.length)]); corps.castShadow = true; g.add(corps);
      g.add(new THREE.Mesh(geoTete, matPeau));
      if (k === 0 && v.niveau >= 2) {
        const ch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.1).translate(0.14, 0.08, 0), matCoque); ch.castShadow = true; g.add(ch);
      }
      groupeActeurs.add(g);
      acteurs.push({ g, type: 'passant', a: v.case, b: b.case, chemin: trajet(v.case, b.case), ph: hache(v.id, k, 6), v: 0.06 + hache(v.id, k, 7) * 0.05 });
    }
  }
  // quelques voiliers au large
  const larges = [];
  for (let i = 0; i < C.terrain.length; i++) if (C.terrain[i] === 0 && voisins(i).every(v => C.terrain[v] === 0)) larges.push(i);
  for (let k = 0; k < Math.min(4, larges.length); k++) {
    const i = larges[Math.floor(hache(k, 99) * larges.length)], g = barque(true);
    groupeActeurs.add(g);
    const p = posCase(i);
    acteurs.push({ g, type: 'barque', cx: p.x, cz: p.z, r: 1.4 + hache(k, 98), ph: hache(k, 97) * 6, v: 0.08 });
  }
  void couleurDe;
}
function majActeurs(dt, t) {
  for (const a of acteurs) {
    if (a.type === 'barque') {
      const ang = a.ph + t * a.v;
      a.g.position.set(a.cx + Math.cos(ang) * a.r, 0.0 + Math.sin(t * 2 + a.ph) * 0.01, a.cz + Math.sin(ang) * a.r);
      a.g.rotation.y = -ang;
      a.g.rotation.z = Math.sin(t * 1.6 + a.ph) * 0.06 * (0.5 + climat.vent);
    } else if (a.type === 'passant') {
      // les passants suivent la route, case après case
      const u = (Math.sin(t * a.v * 2 / Math.max(1, a.chemin.length - 1) * 1.6 + a.ph * 6.28) + 1) / 2, f = u * (a.chemin.length - 1), n0 = Math.min(a.chemin.length - 2, Math.floor(f));
      const p = posCase(a.chemin[n0]), q = posCase(a.chemin[n0 + 1]);
      const x = lerp(p.x, q.x, f - n0), z = lerp(p.z, q.z, f - n0);
      a.g.position.set(x, solEn(x, z) + 0.02 + Math.abs(Math.sin(t * 9 + a.ph * 9)) * 0.012, z);
      const dir = Math.cos(t * a.v * 2 / Math.max(1, a.chemin.length - 1) * 1.6 + a.ph * 6.28) > 0 ? 1 : -1;
      a.g.rotation.y = -Math.atan2((q.z - p.z) * dir, (q.x - p.x) * dir);
    } else if (a.type === 'mouton') {
      const ang = a.ph + Math.sin(t * 0.15 + a.ph) * 2;
      a.g.position.set(a.cx + Math.cos(ang) * 0.28, a.y, a.cz + Math.sin(ang) * 0.22);
      a.g.rotation.y = -ang - Math.PI / 2;
    }
  }
}

// ------------------------------------------------------------------ boucle
chaqueImage((dt, t) => {
  for (const c of parts.cheminees) {
    if (!climat.froid) continue;
    c.prochain -= dt;
    if (c.prochain <= 0) { c.prochain = 0.9 + Math.random() * 0.8; bouffee(c.pos.x, c.pos.y, c.pos.z, 'blanche'); }
  }
  for (const f of parts.fumees) {
    f.prochain -= dt;
    if (f.prochain <= 0) { f.prochain = 0.55 + Math.random() * 0.5; bouffee(f.pos.x, f.pos.y, f.pos.z, f.noire ? 'noire' : 'blanche'); }
  }
  majFumees(dt);
  majNuages(dt);
  majOiseaux(dt, t);
  majActeurs(dt, t);
});
