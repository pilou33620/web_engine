"use strict";
// teinte du sol selon le mois (SAISONS de 24-ciel.js) et neige (NEIGE_E × 0,3)
const SAISONS_SOL = { 0: 0xe2e9f2, 3: 0xeefde6, 6: 0xfff4d8, 9: 0xffd8a8 }, NEIGE_SOL = new THREE.Color(0xcfd9e6).multiplyScalar(.3);
const GROUPES = { production: 'Production', stockage: 'Stockage', reseau: 'Réseau', eau: 'Eau', dechets: 'Déchets' };
const QUARTIERS = Object.entries(QUART).map(([k, q]) => ({ id: 'q-' + k, nom: q.nom, groupe: 'Villes et fermes', dessin: L => QBAT[k](L, { fum: [] }) }))
  .concat([['culture', 'Ferme céréalière', false], ['elevage', 'Ferme d’élevage', true]].map(([k, nom, e]) => ({ id: 'f-' + k, nom, groupe: 'Villes et fermes', sol: true, dessin: L => bFerme(L, e) })));
const f = $('#choix'), groupe = new THREE.Group(), etiq = $('#etiquettes'), PAS = 26;
scene.add(groupe); eau.visible = false;
for (const e of ERES) f.ere.add(new Option(`${e.an} · ${e.nom}`, e.an));
f.ere.value = 2020;

function liste(an) {
  const inst = Object.entries(TYPES).filter(([k, t]) => BAT[k] && !t.cache && t.an <= an && !(t.fin && t.fin < an))
    .map(([k, t]) => ({ id: k, nom: t.nom, groupe: GROUPES[t.groupe] || t.groupe, dessin: (L, ex) => BAT[k](L, ex) }));
  return inst.concat(QUARTIERS);
}
let poses = [], rotors = [];
function afficher() {
  const an = +f.ere.value, choisi = f.bat.value, tout = liste(an);
  // liste des bâtiments de l'époque, par groupe
  f.bat.length = 1;
  const parG = Map.groupBy(tout, b => b.groupe);
  for (const [g, bs] of parG) { const og = document.createElement('optgroup'); og.label = g; for (const b of bs) og.append(new Option(b.nom, b.id)); f.bat.append(og); }
  f.bat.value = tout.some(b => b.id === choisi) ? choisi : '';
  const vus = f.bat.value ? tout.filter(b => b.id === f.bat.value) : tout;
  for (const o of [...groupe.children]) jeter(o);
  etiq.textContent = ''; poses = []; rotors = [];
  const cols = Math.ceil(Math.sqrt(vus.length));
  vus.forEach((b, i) => {
    const x = ((i % cols) - (cols - 1) / 2) * PAS, z = (Math.floor(i / cols) - (Math.ceil(vus.length / cols) - 1) / 2) * PAS;
    const T = lot(); put(T, cyl(R * .965, R, 2, 6), TERR.prairie.col, x, -1, z, 0, 0); fige(T, groupe, MAT_SOL);
    semer({ q: i, r: 7 }); const L = lot(), ex = { rotors: [], fum: [] }; b.dessin(L, ex);
    const g = fige(L, groupe, b.sol ? MAT_SOL : MAT); g.position.set(x, 0, z);
    for (const r of ex.rotors) { const rg = rotor(); rg.position.set(...r); g.add(rg); rotors.push(rg); }
    const el = document.createElement('span'); el.textContent = b.nom; etiq.append(el);
    poses.push({ el, p: new THREE.Vector3(x, 0, z + R * .7) });
  });
  distc = Math.min(560, Math.max(110, cols * PAS * 1.5)); cible.set(0, 0, 0); placer();
  const s = +f.saison.value;
  MAT_SOL.color.setHex(SAISONS_SOL[s]);
  MAT_SOL.emissive.copy(NEIGE_SOL).multiplyScalar(f.neige.checked ? 1 : 0);
}
// caméra : même axe de vue que 15-camera.js
const cible = new THREE.Vector3(), AXE = new THREE.Vector3(0, .83, .56).normalize(); let distc = 330;
function placer() { cam.position.copy(cible).addScaledVector(AXE, distc); cam.lookAt(cible); }
function redim() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', redim); redim();
let p0 = null;
toile.addEventListener('pointerdown', e => { toile.setPointerCapture(e.pointerId); p0 = { x: e.clientX, y: e.clientY }; });
toile.addEventListener('pointermove', e => {
  if (!p0) return;
  const upp = 2 * distc * Math.tan(cam.fov * Math.PI / 360) / innerHeight;
  cible.x -= (e.clientX - p0.x) * upp; cible.z -= (e.clientY - p0.y) * upp / AXE.y; p0 = { x: e.clientX, y: e.clientY }; placer();
});
toile.addEventListener('pointerup', () => { p0 = null; });
toile.addEventListener('wheel', e => { e.preventDefault(); distc = clamp(distc * Math.exp(e.deltaY * .0012), 40, 900); placer(); }, { passive: false });
f.addEventListener('change', afficher);
const V = new THREE.Vector3();
(function boucle() {
  requestAnimationFrame(boucle);
  for (const r of rotors) r.rotation.z -= .03;
  for (const { el, p } of poses) { V.copy(p).project(cam); el.hidden = distc > 400 || V.z > 1; el.style.transform = `translate(${(V.x + 1) / 2 * innerWidth}px, ${(1 - V.y) / 2 * innerHeight}px) translate(-50%, -50%)`; }
  renderer.render(scene, cam);
})();
afficher();
