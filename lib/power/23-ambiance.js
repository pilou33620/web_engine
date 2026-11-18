"use strict";
// ============================================================ ambiance : routes, véhicules, bateaux, oiseaux, animaux, tracteurs
// Décor animé, sans effet sur la simulation. Tout est en instances : quelques centaines d'objets mis à jour à chaque image.
let ROUTES = null, VEHIC = [], AMB = null;
// b : une tuile, ou un ensemble de tuiles (la première atteinte termine) ; une route existante coûte moins cher, pour former des troncs communs
const cheminRoute = (a, b, deja = null) => {
  const fin = t => (b instanceof Set ? b.has(t) : t === b), d = new Map([[a, 0]]), prev = new Map([[a, null]]), vu = new Set();
  const poids = t => (t.t === 'montagne' ? 6 : t.t === 'colline' ? 1.6 : t.t === 'foret' ? 1.3 : t.ville ? .6 : t.occ ? 4 : 1) * (deja && deja.has(t) ? .4 : 1);
  let bout = null;
  for (;;) {
    let t = null, m = Infinity; for (const [k, v] of d) if (!vu.has(k) && v < m) { m = v; t = k; }
    if (!t) break; if (fin(t)) { bout = t; break; } vu.add(t);
    for (const n of voisins(t)) if (!vu.has(n) && (fin(n) || (!n.brume && !estEau(n)))) { const c = m + poids(n); if (c < (d.get(n) ?? Infinity)) { d.set(n, c); prev.set(n, t); } }
  }
  if (!bout) return null; const p = []; for (let t = bout; t; t = prev.get(t)) p.unshift(t); return p;
};
function dessinerRoutes() {
  jeter(ROUTES); ROUTES = new THREE.Group(); scene.add(ROUTES); VEHIC = [];
  const L = lot(), liens = [], vus = new Set(), reseau = new Set(VILLES.flatMap(v => v.tuiles));
  // chaque ville vers ses deux voisines les plus proches
  VILLES.forEach(v => VILLES.filter(x => x !== v).sort((x, y) => dist(x.centre, v.centre) - dist(y.centre, v.centre)).slice(0, 2).forEach(x => { const k = [v.nom, x.nom].sort().join('|'); if (!vus.has(k)) { vus.add(k); liens.push([v.centre, x.centre, false]); } }));
  liens.sort((x, y) => dist(x[0], x[1]) - dist(y[0], y[1]));
  const bordure = LISTE.filter(t => !t.brume && !estEau(t) && t.t !== 'montagne' && voisins(t).some(n => n.brume)).sort((x, y) => dist(x, VILLES[0].centre) - dist(y, VILLES[0].centre));
  if (FRONT_T) liens.push([VILLES[0].centre, FRONT_T, false]); else if (bordure[0]) liens.push([VILLES[0].centre, bordure[0], false]);
  // puis une desserte vers chaque ouvrage qui ne touche ni une ville ni une route, du plus proche au plus loin
  const ouvrages = UNITES.filter(u => u.type !== 'frontiere' && !estEau(u.t)).sort((x, y) => Math.min(...VILLES.map(v => dist(v.centre, x.t))) - Math.min(...VILLES.map(v => dist(v.centre, y.t))));
  const goudron = annee(S.min) >= 1930;
  const tracer = (p, acces, chemin = false, benne = false) => {
    p.forEach(t => reseau.add(t));
    const pts = p.map((t, i) => [t.x + (i && i < p.length - 1 ? (hache(t.q, t.r, 17) - .5) * 3 : 0), t.z + (i && i < p.length - 1 ? (hache(t.q, t.r, 19) - .5) * 3 : 0)]);
    if (acces) { pts[0][0] += (pts[1][0] - pts[0][0]) * .45; pts[0][1] += (pts[1][1] - pts[0][1]) * .45; }  // la desserte s'arrête au pied de l'ouvrage
    const lisse = []; for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 4; s++) { const k = s / 4; lisse.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]); } lisse.push(pts.at(-1));
    const haut = i => { const t = versHex(lisse[i][0], lisse[i][1]); return t ? Math.max(t.top, 0) : 0; };
    for (let i = 0; i < lisse.length - 1; i++) { const y = Math.max(haut(i), haut(i + 1)) + .18; put(L, ruban([lisse[i], lisse[i + 1]], chemin ? .7 : acces ? 1.2 : 1.7, y), goudron && !chemin ? 0x6f6c66 : 0xc9a874, 0, 0, 0, 0, 0); }
    if (chemin) return;  // chemin de ferme : pas de trafic
    const v3 = lisse.map((q, i) => new THREE.Vector3(q[0], haut(i) + .7, q[1])), long = [0]; for (let i = 1; i < v3.length; i++) long.push(long[i - 1] + v3[i].distanceTo(v3[i - 1]));
    for (let k = 0, n = benne ? clamp(Math.round(S.dec.camions / 6), 1, 6) : Math.max(1, Math.round(long.at(-1) / (acces ? 28 : 18))); k < n; k++) VEHIC.push({ pts: v3, long, s: k / n, sens: k % 2 ? 1 : -1, v: .8 + hache(k, n, 3) * .4, h: hache(k, VEHIC.length, 5), h2: hache(VEHIC.length, k, 6), acces, benne });  // vers un site de déchets : les camions de collecte
  };
  for (const [a, b] of liens) { const p = cheminRoute(a, b, reseau); if (p && p.length >= 2) tracer(p, false); }
  for (const u of ouvrages) { if (voisins(u.t).some(n => reseau.has(n)) || reseau.has(u.t)) continue; const p = cheminRoute(u.t, reseau, reseau); if (p && p.length >= 2) tracer(p, true, false, estDecU(u)); }
  // chemins de terre vers les fermes isolées
  for (const t of LISTE.filter(t => t.ferme && !t.occ && !t.ville)) { if (reseau.has(t) || voisins(t).some(n => reseau.has(n))) continue; const p = cheminRoute(t, reseau, reseau); if (p && p.length >= 2) tracer(p, true, true); }
  if (L.g.length) fige(L, ROUTES, MAT_SOL);
  majAmbiance();
}
function vehicules(ronde) {  // répartit routes et rondes de quartier entre les véhicules de l'époque
  const an = annee(S.min), n = {}, m = {};
  for (const c of [...VEHIC, ...ronde]) { c.genre = c.benne ? (an < 1925 ? 'char' : 'benne') : choixVeh(an, c.h, c.acces); c.vis = c.benne || c.h2 < mixVeh(an, c.acces)[1]; c.idx = n[c.genre] = (n[c.genre] || 0) + 1; c.idx--; }
  for (const k of Object.keys(VEH_GEO)) m['v_' + k] = instancesC(VEH_GEO[k], n[k] || 0, PAL_VEH[k](an));
  PHARES.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((VEHIC.length + ronde.length) * 3), 3));
  return m;
}
// instances : un maillage par sorte d'objet
function instances(geo, n, couleurs) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ gradientMap: degrade }), Math.max(1, n)); m.count = n; m.frustumCulled = false; m.castShadow = true;
  for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(couleurs[i % couleurs.length]));
  scene.add(m); return m;
}
const geoMerge = parts => mergeGeometries(parts.map(([g, x, y, z]) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.translate(x, y, z); return g; }));
// véhicules de chaque époque : couleurs de sommet (vitres, roues, bois), teintées par instance
const geoMergeC = parts => mergeGeometries(parts.map(([g, x, y, z, c]) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.translate(x, y, z); const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }));
const roue = (x, z, r = .38) => [cyl(r, r, .22, 8).rotateX(Math.PI / 2), x, r, z, 0x2a2622], VITRE = 0x3a4652, BL = 0xffffff;
const VEH_GEO = {
  char: geoMergeC([[boite(1.7, .3, 1), -.4, .75, 0, 0x9a6a3a], [boite(1.7, .35, .1), -.4, 1.05, .45, 0x7a4f2a], [boite(1.7, .35, .1), -.4, 1.05, -.45, 0x7a4f2a], roue(-.4, .55, .45), roue(-.4, -.55, .45), [boite(1.1, .55, .4), 1.2, 1.05, 0, 0x6b4226], [boite(.45, .4, .3), 1.85, 1.45, 0, 0x6b4226], [boite(.12, .75, .12), .8, .4, 0, 0x4a2e1a], [boite(.12, .75, .12), 1.6, .4, 0, 0x4a2e1a]]),
  ancienne: geoMergeC([[boite(1.9, .5, .95), 0, .65, 0, BL], [boite(.9, .75, .9), -.35, 1.3, 0, BL], [boite(.92, .3, .92), -.35, 1.35, 0, VITRE], [boite(.5, .35, .7), .75, 1.05, 0, BL], roue(.6, .5), roue(.6, -.5), roue(-.6, .5), roue(-.6, -.5)]),
  voiture: geoMergeC([[boite(2, .55, 1), 0, .6, 0, BL], [boite(1.15, .5, .9), -.1, 1.1, 0, BL], [boite(1.17, .25, .92), -.1, 1.12, 0, VITRE], roue(.6, .5, .3), roue(.6, -.5, .3), roue(-.6, .5, .3), roue(-.6, -.5, .3)]),
  benne: geoMergeC([[boite(.9, 1.05, 1.05), 1.35, 1, 0, BL], [boite(.92, .35, 1.07), 1.35, 1.25, 0, VITRE], [boite(2.4, 1.35, 1.12), -.4, 1.2, 0, BL], [boite(.5, 1.15, 1.08), -1.8, 1.05, 0, 0x6b6f75], roue(1.2, .55), roue(1.2, -.55), roue(-1, .55), roue(-1, -.55)]),
  camion: geoMergeC([[boite(.9, 1.05, 1.05), 1.25, 1, 0, BL], [boite(.92, .35, 1.07), 1.25, 1.25, 0, VITRE], [boite(2.3, 1.3, 1.1), -.45, 1.2, 0, 0xe9e3d3], roue(1.2, .55), roue(1.2, -.55), roue(-1, .55), roue(-1, -.55)]),
  bus: geoMergeC([[boite(3.4, 1.2, 1.05), 0, 1.1, 0, BL], [boite(3.42, .35, 1.07), 0, 1.35, 0, VITRE], roue(1.1, .55), roue(1.1, -.55), roue(-1.1, .55), roue(-1.1, -.55)]),
};
const PAL_VEH = {
  benne: a => (a < 1970 ? [0x5fae3e, 0x4a7a3a] : [0x7be08a, 0xf2f2f2]), char: () => [BL], ancienne: () => [0x2d2d2d, 0x2f4f3a, 0x6b2a2a, 0x23324a],
  voiture: a => (a < 2000 ? [0xd9573b, 0x3f7fb5, 0xf2c94c, 0xf6f2ea, 0x5fae3e, 0xe08a3c] : [0xf2f2f2, 0xb9bec4, 0x3a3a3a, 0x3f7fb5, 0xc8423a]),
  camion: a => (a < 1960 ? [0x4a5a3a, 0x6b3a2a, 0x34495e] : [0xd9573b, 0x3f7fb5, 0xf2f2f2, 0x5fae3e]), bus: a => (a < 1970 ? [0x3f6f9f, 0x9f3f3f] : [0x2f9e8f, 0xf2c94c, 0x3f7fb5]),
};
const VIT_VEH = { benne: 7, char: 4, ancienne: 8, voiture: 13, camion: 10, bus: 9 };
function mixVeh(a, acces) {  // part de chaque véhicule selon l'époque (les dessertes d'ouvrages voient passer les camions), et densité du trafic
  if (a < 1910) return [{ char: 1 }, .35];
  if (a < 1930) return [acces ? { char: .5, camion: .5 } : { char: .6, ancienne: .4 }, .45];
  if (a < 1955) return [acces ? { char: .1, camion: .9 } : { char: .08, ancienne: .62, camion: .2, bus: .1 }, .6];
  return [acces ? { camion: .75, voiture: .25 } : { voiture: .68, camion: .2, bus: .12 }, a < 1980 ? .85 : 1];
}
const choixVeh = (a, h, acces) => { const m = Object.entries(mixVeh(a, acces)[0]); let c = 0; for (const [k, p] of m) if (h < (c += p)) return k; return m.at(-1)[0]; };
function instancesC(geo, n, couleurs) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ gradientMap: degrade, vertexColors: true }), Math.max(1, n)); m.count = n; m.frustumCulled = false; m.castShadow = true;
  for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(couleurs[i % couleurs.length]));
  scene.add(m); return m;
}
// tache lumineuse ronde, pour les points (phares, flocons, fenêtres)
const TACHE = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), d = g.createRadialGradient(16, 16, 0, 16, 16, 16); d.addColorStop(0, '#fff'); d.addColorStop(.45, 'rgba(255,255,255,.75)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
// phares et lanternes la nuit
const PHARES = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: TACHE, size: 2.6, color: 0xfff1c4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
PHARES.frustumCulled = false; scene.add(PHARES);
const GEO_BATEAU = geoMerge([[boite(3.2, .7, 1.2), 0, .35, 0], [cone(1.2, 3.2, 3).scale(.25, 1, 1), 0, 2.3, 0]]);
// oiseau (goéland) : le corps suit le sens du vol (x) ; une aile part vers +z depuis l'épaule, la seconde est la même retournée
const GEO_OISEAU = geoMergeC([[boite(1.5, .32, .38), 0, 0, 0, 0xf4f1ea], [boite(.42, .3, .3), .9, .08, 0, 0xf4f1ea], [boite(.25, .08, .1), 1.2, .04, 0, 0xf2b33d], [boite(.5, .08, .5), -.95, .04, 0, 0xd9d6cf]]);
const GEO_AILE = geoMergeC([[boite(.75, .07, 1.1), .05, 0, .55, 0xd9d6cf], [boite(.5, .06, .8), -.12, 0, 1.45, 0x3b3b3b]]);
const GEO_VACHE = geoMerge([[boite(1.6, .8, .7), 0, .9, 0], [boite(.6, .55, .5), .95, 1.15, 0], [boite(.2, .5, .2), -.55, .3, .2], [boite(.2, .5, .2), .5, .3, -.2]]);
// faune des lisières : biche (et faon, la même en petit), cerf (la biche avec ses bois), sanglier (et marcassins), renard
const PATTES = (dx, dz, h, w, c) => [[-dx, -dz], [-dx, dz], [dx, -dz], [dx, dz]].map(([x, z]) => [boite(w, h, w), x, h / 2, z, c]);
const BICHE = [[boite(1.3, .55, .45), 0, 1.05, 0, 0x9a6a3a], [boite(1, .14, .4), 0, .78, 0, 0xe8dcc8], [boite(.28, .62, .26), .6, 1.45, 0, 0x9a6a3a], [boite(.5, .28, .26), .8, 1.8, 0, 0x8a5c32], [boite(.1, .2, .08), .68, 2.02, .1, 0x6b4a2a], [boite(.1, .2, .08), .68, 2.02, -.1, 0x6b4a2a], [boite(.12, .16, .14), -.7, 1.2, 0, 0xf4f1ea], ...PATTES(.45, .14, .8, .12, 0x6b4a2a)];
const GEO_BICHE = geoMergeC(BICHE);
const GEO_CERF = geoMergeC([...BICHE, ...[.13, -.13].flatMap(z => [[boite(.07, .55, .07), .66, 2.2, z, 0x5a4630], [boite(.32, .07, .07), .55, 2.35, z * 1.6, 0x5a4630], [boite(.07, .25, .07), .45, 2.45, z * 2, 0x5a4630]])]);
const GEO_SANGLIER = geoMergeC([[boite(1.3, .7, .62), 0, .75, 0, 0x4a3a30], [boite(1, .14, .22), 0, 1.15, 0, 0x2e241e], [boite(.5, .46, .46), .82, .68, 0, 0x3e3029], [boite(.2, .22, .26), 1.14, .58, 0, 0x8a6a5a], [boite(.06, .16, .05), 1.1, .52, .15, 0xf4f1ea], [boite(.06, .16, .05), 1.1, .52, -.15, 0xf4f1ea], [boite(.1, .16, .1), .72, .98, .16, 0x2e241e], [boite(.1, .16, .1), .72, .98, -.16, 0x2e241e], ...PATTES(.42, .18, .42, .15, 0x2e241e)]);
const GEO_RENARD = geoMergeC([[boite(1, .38, .32), 0, .66, 0, 0xd9622b], [boite(.8, .1, .28), 0, .48, 0, 0xf4f1ea], [boite(.38, .32, .3), .6, .82, 0, 0xd9622b], [boite(.2, .13, .15), .85, .74, 0, 0xf4f1ea], [boite(.08, .2, .08), .62, 1.06, .09, 0x2a1d14], [boite(.08, .2, .08), .62, 1.06, -.09, 0x2a1d14], [boite(.7, .22, .22), -.8, .76, 0, 0xd9622b], [boite(.2, .22, .22), -1.22, .8, 0, 0xf4f1ea], ...PATTES(.32, .1, .46, .08, 0x2a1d14)]);
const GEO_TRACT = geoMerge([[boite(1.6, .9, 1.1), 0, .8, 0], [boite(.8, .8, .9), -.4, 1.6, 0], [cyl(.55, .55, .3, 8).rotateX(Math.PI / 2), -.5, .55, .6], [cyl(.55, .55, .3, 8).rotateX(Math.PI / 2), -.5, .55, -.6]]);
function majAmbiance() {
  if (AMB) for (const m of Object.values(AMB.m)) { scene.remove(m); m.dispose(); }
  const mer = LISTE.filter(t => t.t === 'mer' && !voisins(t).some(n => n.brume) && voisins(t).every(n => estEau(n))), lacs = LISTE.filter(t => t.t === 'lac');
  const bateaux = [...mer.filter((t, i) => hache(t.q, t.r, 23) < .12).slice(0, 7), ...lacs.slice(0, 1)].map((t, i) => ({ t, r: 6 + hache(t.q, t.r, 3) * 8, ph: i * 1.7, v: .05 + hache(t.q, t.r, 5) * .05 }));
  const pres = LISTE.filter(t => t.ferme === 'elevage'), champs = LISTE.filter(t => t.ferme === 'culture' && hache(t.q, t.r, 37) < .5);
  const vaches = pres.flatMap(t => [0, 1, 2].map(k => ({ t, x: (hache(t.q, t.r, k + 40) - .5) * 8, z: (hache(t.q, t.r, k + 50) - .5) * 5 + 2, a: hache(t.q, t.r, k + 60) * 6, ph: k * 2.1 })));
  // les bêtes sortent à la lisière, côté prairie : sous les arbres, on ne les verrait pas d'en haut
  const lisieres = LISTE.filter(t => t.t === 'foret' && !t.brume && hache(t.q, t.r, 29) < .6).map(t => [t, voisins(t).find(n => !n.brume && !estEau(n) && !['foret', 'montagne'].includes(n.t))]).filter(([, n]) => n);
  const n = {}, faune = lisieres.flatMap(([t, pre], k) => {
    const h = hache(t.q, t.r, 31), groupe = h < .45 ? [['cerf', 2], ['biche', 1.8], ['biche', 1.1]] : h < .8 ? [['sanglier', 1.8], ['sanglier', .9], ['sanglier', .9], ['sanglier', .8]] : [['renard', 1.8]];
    const ex = -(pre.z - t.z), ez = pre.x - t.x, el = Math.hypot(ex, ez) || 1;  // la lisière, perpendiculaire à forêt → prairie
    return groupe.map(([esp, s], i) => ({ esp, s, t, pre, idx: (n[esp] = (n[esp] || 0) + 1) - 1, bx: t.x + (pre.x - t.x) * .55 + (i ? (hache(k, i, 33) - .5) * 3 : 0), bz: t.z + (pre.z - t.z) * .55 + (i ? (hache(k, i, 34) - .5) * 3 : 0), ex: ex / el, ez: ez / el, ph: k * 1.7 + i * .35, v: esp === 'renard' ? .35 : esp === 'sanglier' ? .3 : .18 }));
  });
  const tracts = champs.map((t, k) => ({ t, ph: k * 2.3 }));
  const hab = Math.max(1, VILLES.reduce((s, v) => s + v.hab, 0));  // les camions de collecte font la tournée des quartiers, au prorata des habitants
  const ronde = VILLES.flatMap(v => { const nb = Math.round(S.dec.camions * v.hab / hab / 2); return v.tuiles.filter(t => t.quartier !== 'hopital').map((t, k) => ({ t, ph: k * 1.9 + v.nom.length, v: .35 + hache(t.q, t.r, 9) * .2, h: hache(t.q, t.r, 11), h2: hache(t.q, t.r, 13) * .8, benne: k < nb })); });
  const oiseaux = [0, 1, 2, 3].flatMap(g => [0, 1, 2, 3, 4].map(k => ({ g, k })));
  AMB = { bateaux, vaches, faune, tracts, ronde, oiseaux, m: {
    ...vehicules(ronde), bat: instances(GEO_BATEAU, bateaux.length, [0xf6f2ea, 0xd9573b]),
    ois: instancesC(GEO_OISEAU, oiseaux.length, [BL]), aileA: instancesC(GEO_AILE, oiseaux.length, [BL]), aileB: instancesC(GEO_AILE, oiseaux.length, [BL]), vache: instances(GEO_VACHE, vaches.length, [0xf6f2ea, 0x8a5a3a, 0x2f2c2a]), cerf: instancesC(GEO_CERF, n.cerf || 0, [BL]), biche: instancesC(GEO_BICHE, n.biche || 0, [BL]), sanglier: instancesC(GEO_SANGLIER, n.sanglier || 0, [BL]), renard: instancesC(GEO_RENARD, n.renard || 0, [BL]),
    tract: instances(GEO_TRACT, tracts.length, [0xd9473a, 0x4f9a37]) } };
  for (const k of ['ois', 'aileA', 'aileB']) AMB.m[k].castShadow = false;  // à 50 m de haut, leur ombre tombait loin d'eux
}
const QA = new THREE.Quaternion(), EU = new THREE.Euler(), SC = new THREE.Vector3(), PO = new THREE.Vector3();
function poseI(m, i, x, y, z, ry, s = 1, cache = false) { EU.set(0, ry, 0); QA.setFromEuler(EU); SC.setScalar(cache ? 0 : s); PO.set(x, y, z); MD.compose(PO, QA, SC); m.setMatrixAt(i, MD); }
let tAmb = 0;
function animAmbiance(dt) {
  if (!AMB) return; if (DOUX) dt = 0; tAmb += dt;  // « réduire les animations » : chacun reste posé à sa place
  const A = AMB, nuit = soleil(S.min).el < -.05, fant = vue !== 'carte';
  // véhicules de l'époque sur les routes, et petite ronde dans chaque quartier ; phares la nuit
  const PH = PHARES.geometry.attributes.position, PA = PH && PH.array; let np = 0;
  const poser = (c, x, y, z, ry) => {
    const s = c.genre === 'char' ? 1.6 : 1.7, cache = !c.vis || (c.t && !c.t.ville); poseI(A.m['v_' + c.genre], c.idx, x, y, z, ry, s, cache);
    if (nuit && !cache && PA) { PA.set([x + Math.cos(ry) * 1.5 * s, y + .9, z - Math.sin(ry) * 1.5 * s], np * 3); np++; }
  };
  for (const c of VEHIC) {
    const tot = c.long.at(-1); c.s = ((c.s + dt * VIT_VEH[c.genre] * c.v * c.sens / tot) % 1 + 1) % 1; const d = c.s * tot;
    let k = 1; while (k < c.long.length - 1 && c.long[k] < d) k++;
    const P = c.pts[k - 1], Q = c.pts[k], u = (d - c.long[k - 1]) / ((c.long[k] - c.long[k - 1]) || 1), dx = Q.x - P.x, dz = Q.z - P.z, l = Math.hypot(dx, dz) || 1, cote = c.acces ? .5 : .8;
    poser(c, P.x + dx * u - dz / l * cote * c.sens, P.y - .5 + (Q.y - P.y) * u, P.z + dz * u + dx / l * cote * c.sens, Math.atan2(-dz * c.sens, dx * c.sens));
  }
  for (const c of A.ronde) { const t = c.t, a = tAmb * c.v * VIT_VEH[c.genre] / 11 + c.ph; poser(c, t.x + Math.cos(a) * 7.6, t.top + .25, t.z + Math.sin(a) * 7.6, -a - Math.PI / 2); }
  for (const k of Object.keys(VEH_GEO)) A.m['v_' + k].instanceMatrix.needsUpdate = true;
  if (PA) { PH.needsUpdate = true; PHARES.geometry.setDrawRange(0, np); } PHARES.visible = np > 0;
  A.bateaux.forEach((b, j) => { const a = tAmb * b.v + b.ph; poseI(A.m.bat, j, b.t.x + Math.cos(a) * b.r, -.85 + Math.sin(tAmb * 1.3 + j) * .12, b.t.z + Math.sin(a) * b.r, -a, 2.2); }); A.m.bat.instanceMatrix.needsUpdate = true;
  A.oiseaux.forEach((o, j) => { const g = o.g, L = OX * 2.2, x = ((tAmb * (6 + g) + g * 170) % L) - L / 2, ang = .4 + g * 1.3, row = o.k - 2;
    // vol en V : quelques battements, puis un plané ; les deux ailes battent en miroir autour du corps
    const plane = Math.sin(tAmb * .8 + g * 2 + o.k * .3) > .2, bat = plane ? .12 + Math.sin(tAmb * 2 + o.k) * .05 : Math.sin(tAmb * 9 + o.k * .7) * .6;
    PO.set(x * Math.cos(ang) - (g - 1.5) * 60 * Math.sin(ang) - Math.abs(row) * 3, 48 + g * 4 + Math.abs(row) + (plane ? 0 : Math.sin(tAmb * 9 + o.k * .7) * .15), x * Math.sin(ang) + (g - 1.5) * 60 * Math.cos(ang) + row * 3); SC.setScalar(nuit ? 0 : 1.3);
    for (const [m, roulis] of [[A.m.ois, 0], [A.m.aileA, -bat], [A.m.aileB, Math.PI + bat]]) { EU.set(roulis, -ang, 0, 'YXZ'); QA.setFromEuler(EU); MD.compose(PO, QA, SC); m.setMatrixAt(j, MD); }
  });
  EU.order = 'XYZ'; for (const m of [A.m.ois, A.m.aileA, A.m.aileB]) m.instanceMatrix.needsUpdate = true;
  A.vaches.forEach((c, j) => { const t = c.t, a = c.a + Math.sin(tAmb * .2 + c.ph) * .8; poseI(A.m.vache, j, t.x + c.x + Math.sin(tAmb * .15 + c.ph) * .8, t.top, t.z + c.z, a, 1.7, !!(t.occ || t.ville) || fant); }); A.m.vache.instanceMatrix.needsUpdate = true;
  // faune : va-et-vient le long de la lisière, avec des haltes pour brouter ; le renard trotte, les marcassins suivent la laie
  A.faune.forEach(c => {
    const p = tAmb * c.v + c.ph, u = Math.sin(p - .6 * Math.sin(p)) * 5, sens = Math.cos(p - .6 * Math.sin(p)) >= 0 ? 1 : -1;
    const saut = c.esp === 'renard' ? Math.abs(Math.sin(tAmb * 7 + c.ph)) * .25 : 0, cache = !!(c.t.occ || c.pre.occ || c.pre.ville) || nuit || fant;
    poseI(A.m[c.esp], c.idx, c.bx + c.ex * u, Math.max(c.t.top, c.pre.top) + saut, c.bz + c.ez * u, Math.atan2(-c.ez * sens, c.ex * sens), c.s, cache);
  });
  for (const k of ['cerf', 'biche', 'sanglier', 'renard']) A.m[k].instanceMatrix.needsUpdate = true;
  const mo = date(S.min).getUTCMonth(), saisonT = mo >= 2 && mo <= 8 && !nuit && annee(S.min) >= 1930;
  A.tracts.forEach((c, j) => { const t = c.t, u = Math.sin(tAmb * .25 + c.ph), sens = Math.cos(tAmb * .25 + c.ph) > 0 ? 0 : Math.PI; poseI(A.m.tract, j, t.x + u * 4.5, t.top + .2, t.z + 2.6, sens, 1.6, !saisonT || !!(t.occ || t.ville) || fant); }); A.m.tract.instanceMatrix.needsUpdate = true;
}
