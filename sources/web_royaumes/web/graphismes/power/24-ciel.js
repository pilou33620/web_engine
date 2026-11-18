"use strict";
// ============================================================ ciel : jour et nuit, nuages, pluie, neige, brouillard, saisons
const COUL = h => new THREE.Color(h);
const SOL_J = COUL(0xfff0d4), SOL_OR = COUL(0xff9f5a), SOL_LUNE = COUL(0x8ea6ff), HEMI_J = COUL(0xeef7ff), HEMI_N = COUL(0x4d5c8a);
const FOND_J = COUL(0x1b211a), FOND_OR = COUL(0x3b2717), FOND_N = COUL(0x090d1a), BRUME = COUL(0x9aa4a8), NEIGE_E = COUL(0xcfd9e6), BLANC = COUL(0xffffff), GRIS_N = COUL(0x8d939c);
// teinte du sol mois par mois : hiver froid, printemps vert, été doré, automne roux
const SAISONS = [0xe2e9f2, 0xe6edf2, 0xf0fbe8, 0xeefde6, 0xf2ffe8, 0xfffbe6, 0xfff4d8, 0xfff0cc, 0xffeacc, 0xffd8a8, 0xffd2a4, 0xe8edf2].map(COUL);
scene.fog = new THREE.Fog(FOND_J, 1e4, 2e4);  // toujours présent : l'ajouter en cours de partie recompilerait tous les matériaux
// nuages : leur nombre suit la nébulosité, ils dérivent avec le vent et leur ombre court sur la carte
const M_NUAGE = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: degrade, transparent: true, opacity: .45, depthWrite: false });
const NUAGES = Array.from({ length: 18 }, (_, i) => {
  const n = 3 + (i % 3), parts = [];
  for (let k = 0; k < n; k++) parts.push(new THREE.IcosahedronGeometry(9 + hache(i, k, 71) * 9, 1).scale(1, .55, 1).translate((k - n / 2) * 11 + hache(i, k, 72) * 5, hache(i, k, 73) * 4, (hache(i, k, 74) - .5) * 14));
  const m = new THREE.Mesh(mergeGeometries(parts), M_NUAGE); m.castShadow = true; m.rotation.y = hache(i, 0, 78) * Math.PI;
  m.position.set((hache(i, 0, 75) - .5) * 2 * (OX + 80), 70 + hache(i, 0, 76) * 15, (hache(i, 0, 77) - .5) * 2 * (OZ + 60)); scene.add(m); return m;
});
// pluie (traits), neige et feuilles mortes (points) dans une boîte qui suit la caméra
const N_GOUTTES = 1500, GOUT = Float32Array.from({ length: N_GOUTTES * 3 }, Math.random);
const PLUIE = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_GOUTTES * 6), 3)), new THREE.LineBasicMaterial({ color: 0xe4f0ff, transparent: true, opacity: .7, depthWrite: false }));
const FLOCONS = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_GOUTTES * 3), 3)), new THREE.PointsMaterial({ map: TACHE, size: 2.4, transparent: true, depthWrite: false }));
// fenêtres et réverbères la nuit : seules les villes alimentées s'allument
const LUM = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: TACHE, size: 5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
for (const o of [PLUIE, FLOCONS, LUM]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
let lumCle = '', lumTic = 0, neigeSol = 0, minPrec = null, eclair = 0, tEclair = 4;
function majLumieres() {
  const cle = VILLES.map(v => v.nom + v.tuiles.length + v.servie).join();
  if (cle === lumCle) return; lumCle = cle;
  const pos = [], col = [];
  for (const v of VILLES) if (v.servie) for (const t of v.tuiles) for (let k = 0; k < 5; k++) {
    pos.push(t.x + (hache(t.q, t.r, 80 + k) - .5) * 14, t.top + 1.5 + hache(t.q, t.r, 90 + k) * 5, t.z + (hache(t.q, t.r, 100 + k) - .5) * 12);
    col.push(1, k % 3 ? .74 : .9, k % 3 ? .36 : .65);
  }
  LUM.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); LUM.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
const CT = new THREE.Color();
function animCiel(dt, kt) {
  const sl = soleil(S.min), w = meteo(S.min), mo = date(S.min).getUTCMonth(), h = heure(S.min);
  const jour = clamp((sl.el + .08) / .3, 0, 1), dore = Math.exp(-(((sl.el - .04) / .1) ** 2)), el = Math.max(.12, sl.el);
  const orage = S.evt && S.evt.tempete > S.min, pluieK = orage ? 1 : clamp((w.neb - .72) / .25, 0, 1), neige = w.temp < 1.5;
  // lumière : lune bleutée la nuit, soleil doré à l'aube et au crépuscule, voilé par les nuages
  soleilL.position.set(-Math.sin(sl.az) * 300 * Math.cos(el), 300 * Math.sin(el) + 60, Math.cos(sl.az) * 300 * Math.cos(el));
  soleilL.color.copy(SOL_LUNE).lerp(SOL_J, jour).lerp(SOL_OR, dore * .7);
  soleilL.intensity = (.5 + 2.1 * jour) * (1 - .35 * w.neb * jour) * (1 - .35 * pluieK);
  if (orage && !DOUX && (tEclair -= dt) < 0) { eclair = 1; tEclair = 3 + Math.random() * 8; }  // pas d'éclairs avec « réduire les animations »
  eclair = Math.max(0, eclair - dt * 5);
  ciel.color.copy(HEMI_N).lerp(HEMI_J, jour); ciel.intensity = .75 + .75 * jour + eclair * 1.6;
  scene.background.copy(FOND_N).lerp(FOND_J, jour).lerp(FOND_OR, dore * .6).lerp(HEMI_J, eclair * .2);
  // brouillard : pluie, neige, ou matin calme d'automne et d'hiver
  const matin = (mo >= 9 || mo <= 1) && h > 4.5 && h < 9.5 && w.vent < 5 ? Math.sin((h - 4.5) / 5 * Math.PI) : 0, brume = Math.max(pluieK * .7, matin * .8);
  scene.fog.color.copy(BRUME).multiplyScalar(.25 + .75 * jour);
  scene.fog.near = distc * (1.6 - brume * 1.2); scene.fog.far = scene.fog.near + distc * (6 - brume * 5.3);
  // saisons : teinte du sol, neige qui tient au sol puis fond (en minutes de jeu)
  const dm = minPrec === null ? 0 : clamp(S.min - minPrec, 0, 1440); minPrec = S.min;
  neigeSol = clamp(neigeSol + (neige ? dm / 720 * pluieK : -dm / 1440 * clamp((w.temp - 1.5) / 4, 0, 1)), 0, 1);
  CT.copy(TEINTE[vue]).multiply(SAISONS[mo]); MAT_SOL.color.lerp(CT, kt);
  MAT_SOL.emissive.copy(NEIGE_E).multiplyScalar(neigeSol * .3 * (vue === 'carte' ? 1 : .3) * (.4 + .6 * jour));
  // nuages
  const ang = .5 + .5 * Math.sin(S.min / 4000), vx = Math.cos(ang) * w.vent, vz = Math.sin(ang) * w.vent, nVis = w.neb * 21 - 2;
  M_NUAGE.opacity = .45 * clamp((distc - 140) / 160, 0, 1) * (.35 + .65 * jour);  // de près, on voit sous les nuages : il ne reste que leur ombre
  M_NUAGE.color.copy(BLANC).lerp(GRIS_N, pluieK);
  NUAGES.forEach((m, i) => {
    m.visible = i < nVis; if (DOUX) return;
    m.position.x += vx * dt * .8; m.position.z += vz * dt * .8;
    if (m.position.x > OX + 100) m.position.x -= 2 * (OX + 100); if (m.position.z > OZ + 80) m.position.z -= 2 * (OZ + 80);
  });
  // précipitations
  const tombe = !DOUX && pluieK > 0, feuilles = !DOUX && !tombe && (mo === 9 || mo === 10) && w.vent > 6 && jour > 0;
  PLUIE.visible = tombe && !neige; FLOCONS.visible = (tombe && neige) || feuilles;
  if (PLUIE.visible || FLOCONS.visible) {
    const hx = distc * .9, hz = distc * .7, H = 110, n = Math.round(N_GOUTTES * (feuilles ? .2 : pluieK)), vit = PLUIE.visible ? 150 : feuilles ? 8 : 13, t = performance.now() / 1000;
    const P = (PLUIE.visible ? PLUIE : FLOCONS).geometry.attributes.position, A = P.array;
    for (let i = 0; i < n; i++) {
      const j = i * 3; let y = GOUT[j + 1] - dt * vit * (.8 + .08 * (i % 5)) / H; if (y < 0) y += 1; GOUT[j + 1] = y;
      GOUT[j] = (GOUT[j] + dt * vx * .5 / (2 * hx) + 1) % 1; GOUT[j + 2] = (GOUT[j + 2] + dt * vz * .5 / (2 * hz) + 1) % 1;
      const x = cible.x + (GOUT[j] - .5) * 2 * hx, z = cible.z + (GOUT[j + 2] - .5) * 2 * hz, yy = y * H;
      if (PLUIE.visible) A.set([x, yy, z, x - vx * .35, yy + 6, z - vz * .35], i * 6);
      else { const s = Math.sin(t * (feuilles ? 2.2 : 1.1) + i) * (feuilles ? 3 : 1.4); A.set([x + s, yy, z + Math.cos(t * .9 + i) * (feuilles ? 2 : .8)], j); }
    }
    P.needsUpdate = true; PLUIE.geometry.setDrawRange(0, n * 2); FLOCONS.geometry.setDrawRange(0, n);
    PLUIE.material.opacity = .75 * (vue === 'carte' ? 1 : .5);
    FLOCONS.material.color.set(feuilles ? 0xd9772e : 0xffffff); FLOCONS.material.size = feuilles ? 2.8 : 2.4; FLOCONS.material.opacity = vue === 'carte' ? .95 : .5;
  }
  // lumières des villes
  if ((lumTic -= dt) < 0) { lumTic = .5; majLumieres(); }
  LUM.material.opacity = clamp(1 - jour * 1.5, 0, 1); LUM.visible = LUM.material.opacity > .01;
}
