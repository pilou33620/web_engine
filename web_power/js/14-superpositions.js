"use strict";
// ============================================================ superpositions : survol, sélection, frontières, lentilles
function anneau(k1, k2, col, op) {
  const p = [], o = { x: 0, z: 0 };
  for (let i = 0; i < 6; i++) { const a1 = coin(o, i, k1), b1 = coin(o, (i + 1) % 6, k1), a2 = coin(o, i, k2), b2 = coin(o, (i + 1) % 6, k2); p.push(a1[0], 0, a1[1], a2[0], 0, a2[1], b1[0], 0, b1[1], b1[0], 0, b1[1], a2[0], 0, a2[1], b2[0], 0, b2[1]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
  m.visible = false; m.renderOrder = 3; scene.add(m); return m;
}
const survolR = anneau(.95, .8, 0xffffff, .9), selR = anneau(.97, .78, 0xffc94d, 1), depR = anneau(.97, .78, 0x7be08a, 1);
const surf = t => Math.max(t.top, -.6) + .35;
function placeAnneau(m, t) { m.visible = !!t; if (t) m.position.set(t.x, surf(t), t.z); }
let FRONT = null;
function dessinerFrontieres() {
  jeter(FRONT);
  for (const t of LISTE) { if (t.brume) continue; let best = null, bd = 99; for (const v of VILLES) { const d = Math.min(...v.tuiles.map(x => dist(t, x))) + (dist(t, v.centre) > v.rayon + 1 ? 9 : 0); if (d <= v.rayon && d < bd) { bd = d; best = v; } } t.terr = best; }
  const pos = [], col = [];
  for (const t of LISTE) {
    if (!t.terr) continue; const c = new THREE.Color(t.terr.couleur), y = surf(t) - .15;
    for (const n of voisins(t)) {
      if (n.terr === t.terr) continue;
      const [a, b] = bordCommun(t, n), ia = [a[0] + (t.x - a[0]) * .08, a[1] + (t.z - a[1]) * .08], ib = [b[0] + (t.x - b[0]) * .08, b[1] + (t.z - b[1]) * .08];
      const ja = [a[0] + (t.x - a[0]) * .2, a[1] + (t.z - a[1]) * .2], jb = [b[0] + (t.x - b[0]) * .2, b[1] + (t.z - b[1]) * .2];
      pos.push(ia[0], y, ia[1], ja[0], y, ja[1], ib[0], y, ib[1], ib[0], y, ib[1], ja[0], y, ja[1], jb[0], y, jb[1]);
      for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  FRONT = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); FRONT.material.userData = {}; FRONT.renderOrder = 2; scene.add(FRONT);
}
const hexPlat = new THREE.CircleGeometry(R * .94, 6, Math.PI / 6); hexPlat.rotateX(-Math.PI / 2);
const LENT = new THREE.InstancedMesh(hexPlat, new THREE.MeshBasicMaterial({ transparent: true, opacity: .66, depthWrite: false }), COLS * ROWS);  // la grille n'existe pas encore au chargement : LISTE est vide
LENT.renderOrder = 1; scene.add(LENT);
const CA = new THREE.Color(), CB = new THREE.Color(), CC = new THREE.Color();
const RAMPES = { vent: [0xe9f2f7, 0x2f6fc4], soleil: [0xfff3c4, 0xf07a1a], accept: [0xe5533f, 0x5cc46a], bon: [0xfaf6c8, 0x0f9a52], nappe: [0xe6f3fb, 0x1d64b8], nitr: [0xeaf6d6, 0xb4560f], bacs: [0x7be08a, 0xe5533f], nuis: [0xfff3c4, 0xb4560f] };
const valeur = (t, k) => (k === 'vent' ? (t.vent - 3) / 7 : k === 'soleil' ? (t.soleil - 1) / 4 : k === 'eau' ? 1 : k === 'nappe' ? t.nappe : k === 'nitr' ? t.nitr : k === 'bacs' ? (t.ville ? remplissage(t.ville) : 0) : k === 'nuis' ? nuisHex(t) / 8 : t.accept / 100);
const TRACES = { conduite: 'p', egout: 'a', chaleur: 'c' };  // outils de tracé de l'eau : famille de conduite
let mode = null, kvMode = 225, depart = null, apercu = null;
function majLentille() {
  const k = mode ? (mode === 'ligne' || TRACES[mode] ? null : TYPES[mode].pot) : S.lentille;
  LISTE.forEach((t, i) => {
    let vis = false;
    if (mode === 'ligne' || TRACES[mode]) { vis = !!apercu && apercu.includes(t); CC.setHex(mode === 'ligne' ? 0xffe27a : 0x7cc4ff); }
    else if (mode) { vis = !t.brume && (!estEau(t) || TYPES[mode].eau); const r = raison(t, mode); if (r) CC.setHex(0x0c0f0b); else { CA.setHex(RAMPES.bon[0]); CB.setHex(RAMPES.bon[1]); CC.lerpColors(CA, CB, .15 + .85 * valeur(t, k)); } }
    else if (RAMPES[k]) { vis = !t.brume && !estEau(t) && (k !== 'bacs' || !!t.ville) && (k !== 'nuis' || nuisHex(t) > .3); const [a, b] = RAMPES[k]; CA.setHex(a); CB.setHex(b); CC.lerpColors(CA, CB, clamp(valeur(t, k), 0, 1)); }
    MD.makeScale(vis ? 1 : 0, 1, vis ? 1 : 0).setPosition(t.x, surf(t) - .2 + (k === 'bacs' && t.ville ? .35 : 0), t.z);  // au-dessus du sol des quartiers
    LENT.setMatrixAt(i, MD); LENT.setColorAt(i, CC);
  });
  LENT.instanceMatrix.needsUpdate = true; LENT.instanceColor.needsUpdate = true; majVetuste();
}
const coulTaux = b => (b.fin ? '#8d8f96' : b.hs > S.min ? '#6b6f68' : b.taux > 1 ? '#ff5a4a' : b.taux > .8 ? '#ffc94d' : '#7be08a');
function couleurCables() { for (const l of LIGNES) if (l.cables && !l.fin) (l.cables.userData.m0 || l.cables.material).color.set(S.lentille === 'charge' && !mode ? coulTaux(l) : l.hs > S.min ? '#8a3a30' : '#2d2621'); }

// ============================================================ fumées
const BOULE = new THREE.IcosahedronGeometry(1, 1), MFUM = new THREE.MeshToonMaterial({ color: 0x8f8f8f, gradientMap: degrade }), MVAP = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade });
const BOULES = []; for (let i = 0; i < 110; i++) { const m = new THREE.Mesh(BOULE, MFUM); m.visible = false; scene.add(m); BOULES.push({ m, vie: 0 }); }
function animFumees(dt) {
  for (const f of FUMEES) {
    const marche = f.u ? (estDecU(f.u) ? enService(f.u) && f.u.q > 1 : actifU(f.u) && f.u.p > 1) : true; if (!marche) continue;
    f.tic -= dt; if (f.tic <= 0) { f.tic = f.vap ? .55 : .7; const b = BOULES.find(b => b.vie <= 0); if (b) { b.vie = 1; b.p = f.p.clone(); b.vap = f.vap; b.m.material = f.vap ? MVAP : MFUM; b.m.visible = true; } }
  }
  for (const b of BOULES) {
    if (b.vie <= 0) continue; b.vie -= dt / (b.vap ? 3.2 : 3.6); if (b.vie <= 0) { b.m.visible = false; continue; }
    const a = 1 - b.vie, s = (b.vap ? 1.6 : 1.1) * (.6 + a * 1.6) * Math.min(1, b.vie * 3);
    b.m.position.set(b.p.x + a * 7, b.p.y + a * 9, b.p.z - a * 2); b.m.scale.setScalar(s);
  }
}
