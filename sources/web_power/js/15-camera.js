"use strict";
// ============================================================ caméra et commandes
// Celles du moteur : glisser, pincer, tourner (clic droit ou deux doigts), molette, clavier (ZQSD, flèches, E et R).
// Le jeu garde son regard (cible, distc) en ses unités : majCam() l'envoie au moteur, suivreCam() le relit à chaque image.
const cam = MOTEUR.camera, CAM = MOTEUR.cam;
const cible = new THREE.Vector3(); let distc = 330;
function majCam() { MOTEUR.viser((cible.x + OX) / R, (cible.z + OZ) / R, distc / R); CAM.d = CAM.cible; }
function suivreCam() { cible.set(CAM.x * R - OX, 0, CAM.z * R - OZ); distc = CAM.d * R; }
let ZW = 1, ZH = 1;
function redim() { ZW = Math.max(1, toile.clientWidth); ZH = Math.max(1, toile.clientHeight); }
new ResizeObserver(redim).observe(toile);
const ray = new THREE.Raycaster(), PL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), PT = new THREE.Vector3(), NDC = new THREE.Vector2();
/** Après ray.setFromCamera : le point du jeu (unités de 10) où le rayon touche le plan horizontal de hauteur y, dans PT. */
function auSol(y) { PL.constant = -y / R; if (!ray.ray.intersectPlane(PL, PT)) return null; return PT.set(PT.x * R - OX, y, PT.z * R - OZ); }
/** La position à l'écran (en pixels du canevas, dans VA) d'un point du jeu ; VA.z > 1 : derrière la caméra. */
function ecran(x, y, z) { VA.set((x + OX) / R, y / R, (z + OZ) / R).project(cam); VA.x = (VA.x + 1) / 2 * ZW; VA.y = (1 - VA.y) / 2 * ZH; return VA; }
function tuileSous(cx, cy) {
  const r = toile.getBoundingClientRect(); NDC.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(NDC, cam);
  let t = null, y = 0;
  for (let k = 0; k < 3; k++) { if (!auSol(y)) return null; t = versHex(PT.x, PT.z); if (!t) return null; y = Math.max(t.top, MER_Y); }
  return t;
}
let fant = null, fantT = null, toucheT = null, selT = null;
MOTEUR.surTap((i, e) => cliquer(tuileSous(e.clientX, e.clientY), e));
MOTEUR.surClicDroit((i, e) => cliquer(tuileSous(e.clientX, e.clientY), e));
toile.addEventListener('pointermove', e => {
  toile.classList.toggle('glisse', !!e.buttons);
  if (e.pointerType === 'mouse' && !e.buttons) survoler(tuileSous(e.clientX, e.clientY), e.clientX, e.clientY);
});
toile.addEventListener('pointerup', () => toile.classList.remove('glisse'));
toile.addEventListener('pointerleave', () => survoler(null));
