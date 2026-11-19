// Les crises et les grands ouvrages qui vivent, communs aux jeux modernes (repère du plateau : une case de 1) :
//   panache(cle, x, y, z, { genre, force })  la vapeur d'une tour de refroidissement, la fumée noire d'un accident ;
//   chute(cle, A, B, { debit, larg })        l'eau qui tombe d'un déversoir (de A à B), l'écume et les embruns au pied ;
//   reflets(groupe, points)                  l'éclat du soleil sur des panneaux solaires, selon le soleil et le regard ;
//   blackout(x, z) / retablir() / eteint(x, z)  la carte qui s'éteint par vagues depuis le point de défaillance, puis se rallume.
// panache et chute s'appellent à chaque image (ou presque) avec une clé : sans nouvel appel pendant une seconde, ils s'éteignent seuls.
import { THREE, scene, chaqueImage, cam, camera, soleil, pres, hache, qualite } from './scene.js';
import { climat, bouffee } from './vie.js';
import { sillage } from './eau.js';

const maintenant = () => performance.now() / 1000;

// ------------------------------------------------------------------ panaches : des bouffées serrées et grosses, qui suivent le vent
const PANACHES = new Map();
/** genre 'vapeur' (blanche, ample, lente) ou 'noire' (accident : épaisse et rapide) ; force de 0 à 1 (la puissance de la centrale). */
export function panache(cle, x, y, z, { genre = 'vapeur', force = 1 } = {}) {
  const p = PANACHES.get(cle) || { tic: 0 };
  Object.assign(p, { x, y, z, genre, force: Math.max(0, Math.min(1, force)), vu: maintenant() });
  PANACHES.set(cle, p);
}

// ------------------------------------------------------------------ chutes d'eau des barrages : des filets qui tombent en arc, de l'écume au pied
const NCH = 400, GOUTTE = new THREE.BoxGeometry(0.012, 0.05, 0.012);
const CHUTES_M = new THREE.InstancedMesh(GOUTTE, new THREE.MeshBasicMaterial({ color: 0xe6f4fb, transparent: true, opacity: 0.8, depthWrite: false }), NCH);
CHUTES_M.count = 0; CHUTES_M.frustumCulled = false; scene.add(CHUTES_M);
const CHUTES = new Map();
/** A, B : le haut et le pied de la chute (THREE.Vector3, repère du plateau) ; debit de 0 à 1 ; larg : la largeur du déversoir. */
export function chute(cle, A, B, { debit = 0.5, larg = 0.3 } = {}) {
  const c = CHUTES.get(cle) || { tic: 0 };
  Object.assign(c, { A: A.clone(), B: B.clone(), debit: Math.max(0, Math.min(1, debit)), larg, vu: maintenant() });
  CHUTES.set(cle, c);
}

// ------------------------------------------------------------------ reflets du soleil sur les panneaux (inclinés de 0,5 rad vers +z, comme BAT.solaire)
const TACHE = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), d = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  d.addColorStop(0, '#fff'); d.addColorStop(0.25, 'rgba(255,255,240,.7)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const M_REFLET = new THREE.PointsMaterial({ map: TACHE, size: 0.32, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const REFLETS = [];
/** points : [[x, y, z]] dans le repère local du groupe (un par panneau) ; l'éclat est ajouté au groupe et le suit. */
export function reflets(groupe, points) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(points.length * 3).fill(0), 3));
  const o = new THREE.Points(geo, M_REFLET); o.frustumCulled = false; o.renderOrder = 3; groupe.add(o);
  REFLETS.push(o);
  return o;
}

// ------------------------------------------------------------------ blackout : une onde qui éteint, puis une onde qui rallume
const VITESSE = 2.5;  // cases par seconde
let panne = null;
/** La carte s'éteint par vagues depuis (x, z) ; sans effet si un blackout est déjà en cours. */
export function blackout(x, z) { if (!panne || panne.retour !== null) panne = { x, z, t: maintenant(), retour: null }; }
/** Le courant revient, par une vague partie du même point. */
export function retablir() { if (panne && panne.retour === null) panne.retour = maintenant(); }
/** Le point (x, z) est-il dans le noir en ce moment ? (fenêtres, réverbères : le jeu et modernes.js le demandent) */
export function eteint(x, z) {
  if (!panne) return false;
  const d = Math.hypot(x - panne.x, z - panne.z), t = maintenant();
  if (d > (t - panne.t) * VITESSE) return false;
  return panne.retour === null || d > (t - panne.retour) * VITESSE;
}
export const enBlackout = () => !!panne && panne.retour === null;
const ONDE = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
ONDE.visible = false; ONDE.renderOrder = 3; scene.add(ONDE);

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3(), _v = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
chaqueImage((dt, t) => {
  const now = maintenant();
  // panaches
  for (const [cle, p] of PANACHES) {
    if (now - p.vu > 1) { PANACHES.delete(cle); continue; }
    if (!pres(p.x, p.z) || p.force <= 0.02) continue;
    const vap = p.genre === 'vapeur';
    if ((p.tic -= dt) > 0) continue;
    p.tic = (vap ? 0.2 : 0.12) / (0.4 + p.force * 0.6);
    const j = 0.04 + p.force * 0.04;
    bouffee(p.x + (Math.random() - 0.5) * j, p.y + Math.random() * 0.03, p.z + (Math.random() - 0.5) * j, vap ? 'blanche' : 'noire', vap ? 2 + p.force * 2 : 2.4 + p.force * 2.2);
  }
  // chutes
  let n = 0;
  for (const [cle, c] of CHUTES) {
    if (now - c.vu > 1) { CHUTES.delete(cle); continue; }
    if (!pres(c.A.x, c.A.z) || c.debit <= 0.02) continue;
    const d = _v.subVectors(c.B, c.A), dir = Math.atan2(d.x, d.z), px = Math.cos(dir), pz = -Math.sin(dir);  // perpendiculaire horizontale
    const nb = Math.round(10 + c.debit * 40 * Math.min(1, qualite.part + 0.3)), h = hache(c.A.x * 10, c.A.z * 10, 3);
    for (let k = 0; k < nb && n < NCH; k++) {
      const u = (t * (0.9 + c.debit * 0.6) + k * 0.618 + h) % 1, w = (((k * 0.377 + h) % 1) - 0.5) * c.larg;
      _p.set(c.A.x + d.x * u + px * w, c.A.y + d.y * u * u + 0.02 * Math.sin(u * Math.PI), c.A.z + d.z * u + pz * w);  // l'eau accélère en tombant
      _q.setFromUnitVectors(_Y, _r.set(d.x, d.y * 2 * u, d.z).normalize());  // le filet suit sa trajectoire
      CHUTES_M.setMatrixAt(n++, _m.compose(_p, _q, _s.set(1, 1 + c.debit * 1.5, 1)));
    }
    // écume et embruns au pied
    if ((c.tic -= dt) < 0) {
      c.tic = 0.25 / (0.3 + c.debit);
      const w = (Math.random() - 0.5) * c.larg;
      sillage(c.B.x + px * w, c.B.y, c.B.z + pz * w, 0.03 + c.debit * 0.05);
      if (Math.random() < 0.3 + c.debit * 0.5) bouffee(c.B.x + px * w, c.B.y + 0.02, c.B.z + pz * w, 'blanche', 0.3 + c.debit * 0.5);
    }
  }
  CHUTES_M.count = n; CHUTES_M.instanceMatrix.needsUpdate = true;
  // reflets : la direction du soleil réfléchie par chaque panneau, comparée au regard (les panneaux suivent le soleil en oscillant, comme leur pièce)
  const jour = Math.max(0, 1 - climat.nuit - climat.aube * 0.6) * (climat.pluie ? 0.15 : 1 - Math.min(0.7, (climat.nuages || 0) * 0.08));
  _l.subVectors(soleil.position, soleil.target.position).normalize();
  const tilt = 0.5 + Math.sin(now * 0.3) * 0.25;
  for (let i = REFLETS.length - 1; i >= 0; i--) {
    const o = REFLETS[i];
    if (!o.parent || !o.parent.parent) { REFLETS.splice(i, 1); o.geometry.dispose(); continue; }
    o.visible = jour > 0.05; if (!o.visible) continue;
    o.parent.getWorldQuaternion(_q);
    _n.set(0, Math.cos(tilt), Math.sin(tilt)).applyQuaternion(_q);
    _r.copy(_n).multiplyScalar(2 * _n.dot(_l)).sub(_l);  // la lumière réfléchie
    const pos = o.geometry.attributes.position, col = o.geometry.attributes.color;
    for (let k = 0; k < pos.count; k++) {
      o.localToWorld(_p.fromBufferAttribute(pos, k));
      _v.subVectors(camera.position, _p).normalize();
      const e = Math.max(0, _r.dot(_v)) ** 12 * 1.6 + Math.max(0, Math.sin(now * 2.3 + k * 1.7)) ** 30 * 0.5;  // l'éclat, et un scintillement de temps en temps
      const a = Math.min(1, e) * jour; col.setXYZ(k, a, a, a * 0.9);
    }
    col.needsUpdate = true;
  }
  // blackout : l'onde bleue qui éteint, puis dorée qui rallume
  if (panne) {
    const t0 = panne.retour ?? panne.t, r = (now - t0) * VITESSE;
    if (panne.retour !== null && r > 80) { panne = null; ONDE.visible = false; }
    else {
      ONDE.visible = r < 40; ONDE.position.set(panne.x, 0.06, panne.z); ONDE.scale.setScalar(Math.max(0.01, r));
      ONDE.material.color.setHex(panne.retour === null ? 0x9fd0ff : 0xffd27a); ONDE.material.opacity = 0.7 * Math.max(0, 1 - r / 40);
    }
  }
});
