"use strict";
// ============================================================ caméra et commandes
const cible = new THREE.Vector3(); let distc = 330;
const AXE = new THREE.Vector3(0, .83, .56).normalize(), LIM = { x: OX - 20, z: OZ - 10 };
function majCam() { cible.x = clamp(cible.x, -LIM.x, LIM.x); cible.z = clamp(cible.z, -LIM.z, LIM.z); cam.position.copy(cible).addScaledVector(AXE, distc); cam.lookAt(cible); }
let ZW = 1, ZH = 1;
function redim() { const r = zone.getBoundingClientRect(); ZW = Math.max(1, r.width); ZH = Math.max(1, r.height); renderer.setSize(ZW, ZH, false); cam.aspect = ZW / ZH; cam.updateProjectionMatrix(); }
new ResizeObserver(redim).observe(zone);
const ray = new THREE.Raycaster(), PL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), PT = new THREE.Vector3(), NDC = new THREE.Vector2();
function tuileSous(cx, cy) {
  const r = zone.getBoundingClientRect(); NDC.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(NDC, cam);
  let t = null, y = 0;
  for (let k = 0; k < 3; k++) { PL.constant = -y; if (!ray.ray.intersectPlane(PL, PT)) return null; t = versHex(PT.x, PT.z); if (!t) return null; y = Math.max(t.top, -.6); }
  return t;
}
const ptrs = new Map(); let glisse = false, dep0 = null, pinch0 = 0, dist0 = 0, fant = null, fantT = null, toucheT = null, selT = null;
toile.addEventListener('pointerdown', e => { toile.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dep0 = { x: e.clientX, y: e.clientY }; glisse = false; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = distc; } });
toile.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (p) {
    if (ptrs.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.values()]; distc = clamp(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 80, 560); majCam(); glisse = true; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (!glisse && Math.hypot(e.clientX - dep0.x, e.clientY - dep0.y) > 6) { glisse = true; toile.classList.add('glisse'); }
    if (glisse) { const upp = 2 * distc * Math.tan(cam.fov * Math.PI / 360) / ZH; cible.x -= dx * upp; cible.z -= dy * upp / AXE.y; majCam(); }
    return;
  }
  if (e.pointerType === 'mouse') survoler(tuileSous(e.clientX, e.clientY), e.clientX, e.clientY);
});
const finPtr = e => { const etait = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); toile.classList.remove('glisse'); if (etait && !glisse && e.type === 'pointerup' && ptrs.size === 0) cliquer(tuileSous(e.clientX, e.clientY), e); };
toile.addEventListener('pointerup', finPtr); toile.addEventListener('pointercancel', finPtr);
toile.addEventListener('pointerleave', () => survoler(null));
toile.addEventListener('wheel', e => { e.preventDefault(); distc = clamp(distc * Math.exp(e.deltaY * .0012), 80, 560); majCam(); }, { passive: false });
