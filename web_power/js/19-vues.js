"use strict";
// ============================================================ quatre vues : carte, électricité, eau, déchets
// Dans la vue d'un réseau, ses ouvrages ont un contour coloré et un anneau, ceux de l'autre réseau deviennent des fantômes.
const TEINTE = { carte: new THREE.Color(0xffffff), elec: new THREE.Color(0x77756c), eau: new THREE.Color(0x7a8a8f), dechets: new THREE.Color(0x7a7a70) };
const HALO_M = { eau: new THREE.MeshBasicMaterial({ color: 0x38b6ff, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }), elec: new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }), dechets: new THREE.MeshBasicMaterial({ color: 0xf0a35e, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }) };
const GEO_HALO = (() => { const p = [], o = { x: 0, z: 0 }; for (let i = 0; i < 6; i++) { const a1 = coin(o, i, .99), b1 = coin(o, (i + 1) % 6, .99), a2 = coin(o, i, .84), b2 = coin(o, (i + 1) % 6, .84); p.push(a1[0], 0, a1[1], a2[0], 0, a2[1], b1[0], 0, b1[1], b1[0], 0, b1[1], a2[0], 0, a2[1], b2[0], 0, b2[1]); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; })();
const reseauU = u => TYPES[u.type].r || 'elec';
function etatVue(r) { return vue === 'carte' ? 'normal' : r === vue ? 'vif' : 'fantome'; }
function appliquer(grp, etat, r) {
  if (!grp) return;
  grp.traverse(m => {
    if (!m.isMesh) return; if (m.userData.m0 === undefined) m.userData.m0 = m.material; const m0 = m.userData.m0, cont = m0 === CONT;
    if (etat === 'fantome') { m.material = GHOST; m.visible = !cont; m.castShadow = false; }
    else { m.visible = m.userData.cache ? false : true; m.material = cont && etat === 'vif' ? CONT_V[r] : m0; m.castShadow = m0 === MAT; }
  });
}
function stylerU(u) {
  const r = reseauU(u), e = etatVue(r);
  appliquer(u.grp, e, r); appliquer(u.grue, e === 'vif' ? 'normal' : e, r);
  if (!u.halo) { u.halo = new THREE.Mesh(GEO_HALO, HALO_M[r]); u.halo.renderOrder = 3; scene.add(u.halo); }
  u.halo.position.set(u.t.x, surf(u.t) - .05, u.t.z); u.halo.visible = e === 'vif';
}
const stylerL = l => appliquer(l.grp, etatVue('elec') === 'fantome' ? 'fantome' : 'normal', 'elec');
const LENT_VUE = {
  carte: [['relief', 'Relief', '#86c552'], ['accept', 'Acceptation', '#ff8a7a']],
  elec: [['relief', 'Réseau', '#ffc94d'], ['charge', 'Charge réseau', '#7be08a'], ['vent', 'Vent', '#4f9be0'], ['soleil', 'Soleil', '#ffb340'], ['accept', 'Acceptation', '#ff8a7a']],
  eau: [['relief', 'Réseau', '#3f9cff'], ['nappe', 'Nappes', '#1d64b8'], ['nitr', 'Nitrates', '#b4560f'], ['vetuste', 'Vétusté des conduites', '#e5533f']],
  dechets: [['relief', 'Sites', '#f0a35e'], ['bacs', 'Remplissage des bacs', '#e5533f'], ['nuis', 'Nuisances', '#b4560f'], ['accept', 'Acceptation', '#ff8a7a']],
};
function choisirVue(v) {
  if (!LENT_VUE[v]) return;
  vue = v; document.body.dataset.vue = v; if (mode) choisirMode(null);
  document.querySelectorAll('[data-act=vue]').forEach(b => b.classList.toggle('actif', b.dataset.id === v));
  if (!LENT_VUE[v].some(([k]) => k === S.lentille)) S.lentille = 'relief';
  for (const u of UNITES) stylerU(u); for (const l of LIGNES) stylerL(l);
  EAU_G.visible = v === 'eau';
  majBarre(); majLentilles(); majLentille(); couleurCables(); majVetuste(); dessinerMini(); hud();
  const PANV = { elec: 'dispatch', eau: 'eau', dechets: 'dechets' };  // chaque vue réseau ouvre son panneau à la place de celui d'un autre réseau
  if (!portrait() && S.enJeu && PANV[v] && Object.values(PANV).includes(S.onglet)) ouvrir(PANV[v]);
}
