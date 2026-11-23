// La nuit et l'eau qui brille, toutes automatiques (elles suivent climat, posé par meteo.js, ou par eclairage() sans meteo.js) :
// étoiles et lune (qui change de phase d'une nuit à l'autre) ; lucioles les nuits d'été près des bois et des prés ;
// reflet du soleil (le jour) ou de la lune (la nuit) sur la mer, face au regard ; lumières des villes dans les rivières la nuit ;
// taches de lumière au sol sous les lanternes et devant les phares (lueur()) ; halo orangé au-dessus des grandes villes ;
// feux des phares (feuPhare()) : lanterne qui brille et deux faisceaux qui balaient la mer, la nuit et au crépuscule.
import { THREE, scene, chaqueImage, hache, cam, camera, posCase, qualite, lumiere } from './scene.js';
import { carte, hauteur, hauteurEn, TERRE, pointsRiviere, casesBaties } from './plateau.js';
import { climat } from './vie.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const MER = -0.15;
const plat = n => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const additif = (couleur, op = 1) => new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.renderOrder = 3; scene.add(m); return m; };
const disque = (r = 32) => { const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d'), d = g.createRadialGradient(r, r, 0, r, r, r); d.addColorStop(0, '#fff'); d.addColorStop(0.35, 'rgba(255,255,255,.7)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, r * 2, r * 2); return new THREE.CanvasTexture(c); };
const TACHE = disque();

// ------------------------------------------------------------------ l'éclairage de chaque heure (couleurs de la maquette), partagé avec meteo.js
export const LUMIERE = {
  jour: { sol: 0xfff0d4, sI: 2.6, hemi: 0xeef7ff, hI: 1.5, fond: 0x1b211a, el: 1 },
  aube: { sol: 0xff9f5a, sI: 1.9, hemi: 0xd8d4e8, hI: 1.15, fond: 0x3b2717, el: 0.25 },
  // le crépuscule, plus rosé que l'aube (maquette « vie des quartiers »)
  crep: { sol: 0xff7f6a, sI: 1.75, hemi: 0xcdbde0, hI: 1.1, fond: 0x2c1b2a, el: 0.22 },
  // nuit : lune bleutée, mais la carte reste lisible (hemi pas sous 0,9)
  nuit: { sol: 0x8ea6ff, sI: 0.6, hemi: 0x7484b4, hI: 0.95, fond: 0x090d1a, el: 0.6 },
};
for (const L of Object.values(LUMIERE)) { L.sol = new THREE.Color(L.sol); L.hemi = new THREE.Color(L.hemi); L.fond = new THREE.Color(L.fond); }
/** L'éclairage d'une heure fixe, sans meteo.js : pour un jeu qui pilote lui-même son heure (et sa caméra). heure : 'jour', 'aube',
 *  'crepuscule' ou 'nuit', ou des poids { jour, aube, nuit, phase } (par exemple { aube: 1, nuit: 0.2, phase: 'crepuscule' } pour un
 *  soir). Pose climat (jour, aube, nuit, heure, phase : les fenêtres, les lueurs, les feux des phares, les étoiles s'allument) et
 *  les consignes de lumière de la scène (soleil, ciel, hauteur du soleil), vers lesquelles la boucle de scene.js va en douceur.
 *  À rappeler quand l'heure change (rien ne tourne tout seul) ; avec meteo.js, c'est son cycle (ou forcerHeure) qui décide. */
export function eclairage(heure) {
  const h = typeof heure === 'string' ? { jour: +(heure === 'jour'), aube: +(heure === 'aube' || heure === 'crepuscule'), nuit: +(heure === 'nuit'), phase: heure } : heure || {};
  const j = h.jour || 0, a = h.aube || 0, n = h.nuit || 0, phase = h.phase || (j >= a && j >= n ? 'jour' : n > a ? 'nuit' : 'aube'), tot = j + a + n || 1;
  Object.assign(climat, { jour: j, aube: a, nuit: n, heure: j >= a && j >= n ? 'jour' : n > a ? 'nuit' : 'aube', phase });
  const L = { ...LUMIERE, aube: phase === 'crepuscule' ? LUMIERE.crep : LUMIERE.aube }, k = c => (L.jour[c] * j + L.aube[c] * a + L.nuit[c] * n) / tot;
  const mix = (c, cible) => { cible.setRGB(0, 0, 0); for (const [x, w] of [[L.jour, j], [L.aube, a], [L.nuit, n]]) cible.r += x[c].r * w / tot, cible.g += x[c].g * w / tot, cible.b += x[c].b * w / tot; };
  lumiere.soleil = k('sI'); lumiere.hemi = k('hI'); lumiere.hauteurSoleil = k('el');
  mix('sol', lumiere.couleurSoleil); mix('hemi', lumiere.couleurHemi); mix('fond', lumiere.ciel);
}

// ------------------------------------------------------------------ étoiles : un ciel autour du regard, qui s'efface sous les nuages
const NE = 600, posE = new Float32Array(NE * 3);
for (let i = 0; i < NE; i++) { const a = hache(i, 1, 90) * Math.PI * 2, h = 0.08 + hache(i, 2, 91) * 0.9, r = 1; posE.set([Math.cos(a) * Math.cos(h) * r, Math.sin(h) * r, Math.sin(a) * Math.cos(h) * r], i * 3); }
const geoE = new THREE.BufferGeometry(); geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
const M_ETOILE = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
const ETOILES = new THREE.Points(geoE, M_ETOILE); ETOILES.frustumCulled = false; ETOILES.renderOrder = -1; scene.add(ETOILES);

// ------------------------------------------------------------------ lune : huit phases, une par nuit
const PHASES = Array.from({ length: 8 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fdf6dc'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  // l'ombre : un disque sombre décalé (nouvelle lune au 0, pleine lune au 4)
  const u = k / 8, dx = (u < 0.5 ? 1 - u * 4 : (u - 0.5) * 4 - 1) * 58;
  if (k !== 4) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(32 + (u < 0.5 ? dx : -dx), 32, 28, 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
});
const M_LUNE = new THREE.SpriteMaterial({ map: PHASES[4], transparent: true, opacity: 0, depthWrite: false, fog: false });
const LUNE = new THREE.Sprite(M_LUNE); LUNE.renderOrder = -1; scene.add(LUNE);
let nuitN = 0, etaitNuit = false;
/** La phase de la lune (0 nouvelle, 4 pleine, de 0 à 7) ; elle avance d'un huitième à chaque nuit. */
export const phaseLune = () => nuitN % 8;

// ------------------------------------------------------------------ reflet du soleil ou de la lune sur la mer : une traînée de paillettes
const NR = 60, M_REFLET = additif(0xfff2c8, 0.5); M_REFLET.map = TACHE;
const REFLET = inst(plat(), M_REFLET, NR);

// ------------------------------------------------------------------ lumières des villes dans les rivières, la nuit
const NV = 300, M_VILLE = additif(0xffb54a, 0.55); M_VILLE.map = TACHE;
const VILLES = inst(plat(), M_VILLE, NV);
let lueurs = [], sigLueurs = '';
function poserLueurs() {
  const R = pointsRiviere(), B = casesBaties(), C = carte(); lueurs = [];
  if (!R || !B || !C) return;
  for (const [i, pts] of R) {
    const q = posCase(i), pres = B.has(i) || [...B].some(b => { const p = posCase(b); return (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < 1.2; });
    if (!pres) continue;
    pts.forEach(([x, z], k) => { if (k % 2 === 0 && lueurs.length < NV) lueurs.push({ x, z, y: hauteur(i) + 0.016, ph: hache(i, k, 95) * 6, s: 0.05 + hache(i, k, 96) * 0.05 }); });
  }
}

// ------------------------------------------------------------------ taches de lumière au sol : demandées à chaque image par lueur()
const NG = 400, M_LUEUR = additif(0xffc870, 0.5); M_LUEUR.map = TACHE;
const LUEURS = inst(plat(), M_LUEUR, NG);
const aPoser = [];
/** Une tache de lumière au sol cette image-ci (repère du plateau) : sous une lanterne allumée, devant les phares d'une voiture.
 *  r : son rayon ; allongement : étirée vers cap (radians, 0 = +x), pour un faisceau de phares. */
export function lueur(x, y, z, r = 0.1, allongement = 1, cap = 0) { if (aPoser.length < NG * 6) aPoser.push(x, y, z, r, allongement, cap); }

// ------------------------------------------------------------------ feux des phares : demandés à chaque image par feuPhare()
// (monde.js pour les bâtiments posés, modernes.js pour leurs pièces mobiles : une même lanterne demandée deux fois ne compte qu'une fois)
const NPH = 32, LG_F = 2.2;
const GEO_FAISCEAU = (() => {  // deux cônes couchés, opposés : clairs à la lanterne, éteints au bout (en mélange additif, le noir n'ajoute rien)
  const un = a => {
    const g = new THREE.ConeGeometry(0.3, LG_F, 10, 1, true).toNonIndexed().translate(0, -LG_F / 2, 0).rotateZ(Math.PI / 2 - 0.05).rotateY(a);
    const P = g.attributes.position, C = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const f = (1 - Math.hypot(P.getX(i), P.getZ(i)) / LG_F) ** 1.6; C.set([f, f, f], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
  };
  const a = un(0), b = un(Math.PI), g = new THREE.BufferGeometry();
  for (const k of ['position', 'color']) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array([...a.attributes[k].array, ...b.attributes[k].array]), 3));
  return g;
})();
const M_FAISCEAU = new THREE.MeshBasicMaterial({ color: 0xfff0b8, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const FAISCEAUX = inst(GEO_FAISCEAU, M_FAISCEAU, NPH);
const M_LANTERNE = additif(0xffffff, 0); M_LANTERNE.map = TACHE;
const LANTERNES = inst(new THREE.PlaneGeometry(1, 1), M_LANTERNE, NPH);  // halos face à la caméra
const C_LAMPE = new THREE.Color(0xfff2c0), C_BRASIER = new THREE.Color(0xff9a3a);
const phares = [];
/** Le feu d'un phare cette image-ci (repère du plateau) : halo de la lanterne et, si faisceau, deux faisceaux tournants
 *  (sans faisceau : le brasier de 1700, un halo orangé). Visible la nuit et au crépuscule, discret le jour ; en qualité légère, ni grand
 *  halo ni taches du faisceau sur l'eau : la lanterne seule brille. */
export function feuPhare(x, y, z, faisceau = true) {
  for (let k = 0; k < phares.length; k += 4) if (Math.abs(phares[k] - x) + Math.abs(phares[k + 1] - y) + Math.abs(phares[k + 2] - z) < 0.05) return;
  if (phares.length < NPH * 4) phares.push(x, y, z, faisceau ? 1 : 0);
}
function dessinerPhares(t) {
  const k = Math.min(1, (climat.nuit || 0) + (climat.aube || 0) * 0.75), halo = qualite.niveau !== 'leger';
  let nf = 0, nh = 0;
  for (let i = 0; i < phares.length; i += 4) {
    const x = phares[i], y = phares[i + 1], z = phares[i + 2], a = t * 1.1 + x * 3 + z * 7;
    if (phares[i + 3]) {
      FAISCEAUX.setMatrixAt(nf++, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_v.set(0, 1, 0), a), _s.set(1, 1, 1)));
      if (halo && k > 0.2 && carte()) for (const s of [1, -1]) {  // la tache du faisceau sur l'eau (ou la côte)
        const ex = x + Math.cos(a) * s * LG_F * 0.7, ez = z - Math.sin(a) * s * LG_F * 0.7;
        lueur(ex, Math.max(MER, hauteurEn(ex, ez)) + 0.012, ez, 0.22, 2.6, a);
      }
    }
    const r = (halo ? 0.5 + 0.25 * k : 0.34) * (phares[i + 3] ? 1 : 0.8);  // en qualité légère, la lanterne seule brille (sans grand halo)
    LANTERNES.setMatrixAt(nh, _m.compose(_p.set(x, y, z), camera.quaternion, _s.setScalar(r))); LANTERNES.setColorAt(nh++, phares[i + 3] ? C_LAMPE : C_BRASIER);
  }
  M_FAISCEAU.opacity = 0.06 + 0.5 * k; M_LANTERNE.opacity = 0.2 + 0.75 * k;
  FAISCEAUX.count = nf; FAISCEAUX.visible = nf > 0; FAISCEAUX.instanceMatrix.needsUpdate = true;  // (sans phare : pas d'appel de dessin)
  LANTERNES.count = nh; LANTERNES.visible = nh > 0; LANTERNES.instanceMatrix.needsUpdate = true; if (LANTERNES.instanceColor) LANTERNES.instanceColor.needsUpdate = true;
  phares.length = 0;
}

// ------------------------------------------------------------------ halo orangé au-dessus des grandes villes, la nuit
const M_HALO = new THREE.SpriteMaterial({ map: TACHE, color: 0xff9a40, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
let halos = [], sigHalos = '';
function poserHalos() {  // le centre des amas de cases bâties (au moins 6 cases bâties à moins de deux cases)
  for (const h of halos) scene.remove(h.s); halos = [];
  const B = [...(casesBaties() || [])].map(i => posCase(i)), pris = [];
  for (const a of B) {
    const n = B.filter(b => (b.x - a.x) ** 2 + (b.z - a.z) ** 2 < 4).length;
    if (n >= 6 && !pris.some(p => (p.x - a.x) ** 2 + (p.z - a.z) ** 2 < 9)) pris.push({ ...a, n });
  }
  for (const p of pris) { const s = new THREE.Sprite(M_HALO); s.position.set(p.x, 0.9, p.z); s.scale.setScalar(1.2 + Math.min(4, p.n * 0.25)); s.renderOrder = 4; scene.add(s); halos.push({ s }); }
}

// ------------------------------------------------------------------ lucioles : les nuits d'été, près des bois et des prés
const NL = 120, M_LUCIOLE = additif(0xd8ff6a, 0.9); M_LUCIOLE.map = TACHE;
const LUCIOLES = inst(plat(), M_LUCIOLE, NL), lucioles = [];
function placerLuciole(f) {
  const C = carte(), R = Math.max(3, cam.d * 0.35);
  for (let essai = 0; essai < 6; essai++) {
    const x = cam.x + (Math.random() - 0.5) * 2 * R, z = cam.z + (Math.random() - 0.5) * 2 * R, h = hauteurEn(x, z);
    if (h < 0) continue;
    return Object.assign(f, { x, z, y: h + 0.05 + Math.random() * 0.15, ph: Math.random() * 6, v: 0.5 + Math.random(), vie: 6 + Math.random() * 8 });
  }
  return Object.assign(f, { vie: 0 });
}
for (let k = 0; k < NL; k++) lucioles.push({ vie: 0 });

chaqueImage((dt, t) => {
  dessinerPhares(t);  // (même sans plateau : les vitrines de bâtiments)
  const C = carte(); if (!C) return;
  const nuit = Math.min(1, (climat.nuit || 0) + (climat.aube || 0) * 0.3), couvert = Math.min(1, (climat.nuages || 0) / 12);
  if (climat.heure === 'nuit' && !etaitNuit) nuitN++;
  etaitNuit = climat.heure === 'nuit';
  // étoiles et lune : un ciel lointain, centré sur la caméra
  ETOILES.position.copy(camera.position); ETOILES.scale.setScalar(Math.max(60, cam.d * 4));
  M_ETOILE.opacity = nuit * (1 - couvert) * 0.9;
  ETOILES.visible = M_ETOILE.opacity > 0.02;
  const lune = phaseLune() !== 0 && nuit > 0.1 && couvert < 0.8;
  M_LUNE.opacity += ((lune ? nuit * (1 - couvert * 0.7) : 0) - M_LUNE.opacity) * Math.min(1, dt * 2);
  LUNE.visible = M_LUNE.opacity > 0.02;
  if (LUNE.visible) {
    M_LUNE.map = PHASES[phaseLune()];
    _v.set(cam.x - camera.position.x, 0, cam.z - camera.position.z).normalize();  // au loin, devant le regard, haut dans le ciel
    const k = cam.d * 2.2; LUNE.position.set(cam.x + _v.x * k - _v.z * k * 0.3, cam.d * 0.9, cam.z + _v.z * k + _v.x * k * 0.3); LUNE.scale.setScalar(cam.d * 0.18);
  }
  // reflet : le jour, le soleil (au nord-ouest, comme la lumière de scene.js) ; la nuit, la lune
  const astre = climat.heure === 'jour' ? 1 - couvert * 0.8 : LUNE.visible ? M_LUNE.opacity * 0.8 : 0;
  let nr = 0;
  if (astre > 0.05) {
    M_REFLET.color.setHex(climat.heure === 'jour' ? 0xfff2c8 : 0xcfdcff);
    const ax = cam.x - 0.6 * cam.d * 0.35, az = cam.z - 0.45 * cam.d * 0.35;  // entre le regard et l'astre
    for (let k = 0; k < NR * Math.min(1, qualite.part); k++) {
      const u = hache(k, 3, 97), x = ax + (cam.x - ax) * u * 1.2 + (hache(k, 4, 98) - 0.5) * 0.35 * (1 + u), z = az + (cam.z - az) * u * 1.2 + (hache(k, 5, 99) - 0.5) * 0.25 * (1 + u);
      if (hauteurEn(x, z) > MER) continue;  // seulement sur la mer
      const b = Math.max(0, Math.sin(t * (2 + hache(k, 6, 100) * 3) + k)), s = (0.08 + 0.12 * b) * (cam.d / 8);
      REFLET.setMatrixAt(nr++, _m.compose(_p.set(x, MER + 0.01, z), _q.identity(), _s.set(s * 1.8, 1, s * 0.6)));
    }
    M_REFLET.opacity = 0.55 * astre;
  }
  REFLET.count = nr; REFLET.instanceMatrix.needsUpdate = true;
  // lumières des villes dans les rivières
  const sig = (pointsRiviere()?.size || 0) + ':' + (casesBaties()?.size || 0);
  if (sig !== sigLueurs) { sigLueurs = sig; poserLueurs(); }
  let nv = 0;
  if (nuit > 0.3) for (const l of lueurs) {
    const s = l.s * (0.8 + 0.3 * Math.sin(t * 3 + l.ph));
    VILLES.setMatrixAt(nv++, _m.compose(_p.set(l.x, l.y, l.z), _q.identity(), _s.set(s * 0.6, 1, s * 1.8)));
  }
  M_VILLE.opacity = 0.6 * nuit; VILLES.count = nv; VILLES.instanceMatrix.needsUpdate = true;
  // taches de lumière demandées depuis l'image précédente
  let ng = 0;
  for (let k = 0; k < aPoser.length && nuit > 0.2; k += 6) {
    const r = aPoser[k + 3];
    LUEURS.setMatrixAt(ng++, _m.compose(_p.set(aPoser[k], aPoser[k + 1], aPoser[k + 2]), _q.setFromAxisAngle(_v.set(0, 1, 0), aPoser[k + 5]), _s.set(r * aPoser[k + 4], 1, r)));
  }
  aPoser.length = 0; M_LUEUR.opacity = 0.55 * nuit; LUEURS.count = ng; LUEURS.instanceMatrix.needsUpdate = true;
  // halos des grandes villes
  const sigH = casesBaties()?.size || 0;
  if (sigH !== sigHalos) { sigHalos = sigH; poserHalos(); }
  M_HALO.opacity = 0.35 * nuit * (1 - couvert * 0.4);
  // lucioles
  let nl = 0;
  if (climat.saison === 2 && nuit > 0.5 && !climat.pluie) for (let k = 0; k < NL * Math.min(1, qualite.part); k++) {
    const f = lucioles[k];
    if ((f.vie -= dt) <= 0) placerLuciole(f);
    if (f.vie <= 0) continue;
    f.x += Math.sin(t * f.v + f.ph) * 0.05 * dt; f.z += Math.cos(t * f.v * 0.8 + f.ph) * 0.05 * dt;
    const b = Math.max(0, Math.sin(t * 2.2 * f.v + f.ph * 3)), s = 0.055 * b;
    if (s > 0.004) LUCIOLES.setMatrixAt(nl++, _m.compose(_p.set(f.x, f.y + Math.sin(t + f.ph) * 0.02, f.z), _q.identity(), _s.set(s, 1, s)));
  }
  LUCIOLES.count = nl; LUCIOLES.instanceMatrix.needsUpdate = true;
});
