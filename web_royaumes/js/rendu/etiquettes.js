// Étiquettes HTML posées sur la carte : bannières des villes (rang + nom, comme sur la vidéo),
// effectifs des armées, effets (⚔️, 🔨, 🎉…).
import { THREE, camera, apresCamera, cam } from './scene.js';

const calque = document.getElementById('etiquettes');
const v = new THREE.Vector3();
const items = new Map();   // clé → { el, x, y, z, dy, loin }
const effets = [];

function poser(el, x, y, z, dy = 0) {
  v.set(x, y, z).project(camera);
  if (v.z > 1 || v.x < -1.25 || v.x > 1.25 || v.y < -1.25 || v.y > 1.25) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px,${(1 - v.y) / 2 * innerHeight + dy}px) translate(-50%,-100%)`;
}

export function etiquette(cle, html, x, y, z, opts = {}) {
  let it = items.get(cle);
  if (!it) {
    const el = document.createElement('div');
    el.className = 'lbl';
    calque.appendChild(el);
    it = { el, html: '' };
    items.set(cle, it);
  }
  if (it.html !== html) { it.el.innerHTML = html; it.html = html; }
  Object.assign(it, { x, y, z, dy: opts.dy || 0, loin: opts.loin ?? 999, vu: true });
  return it;
}
export function deplacer(cle, x, y, z) { const it = items.get(cle); if (it) { it.x = x; it.y = y; it.z = z; } }
/** Retire les étiquettes non revues depuis le dernier balayage. */
export function balayer(prefixe) {
  for (const [k, it] of items) {
    if (!k.startsWith(prefixe)) continue;
    if (!it.vu) { it.el.remove(); items.delete(k); } else it.vu = false;
  }
}
export function toutEffacer() { for (const [, it] of items) it.el.remove(); items.clear(); }

export function effet(x, y, z, emoji, duree = 1800) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<div class="fx">${emoji}</div>`;
  calque.appendChild(el);
  effets.push({ el, x, y, z, fin: performance.now() + duree });
}

apresCamera(() => {
  for (const [, it] of items) {
    if (cam.d > it.loin) { it.el.style.display = 'none'; continue; }
    poser(it.el, it.x, it.y, it.z, it.dy);
  }
  const t = performance.now();
  for (let i = effets.length - 1; i >= 0; i--) {
    const f = effets[i];
    if (t > f.fin) { f.el.remove(); effets.splice(i, 1); continue; }
    poser(f.el, f.x, f.y, f.z);
  }
});

export function banniere(ville, couleur) {
  return `<div class="ban" style="--c:${couleur}"><b>${ville.niveau}</b>${ville.capitale ? '👑 ' : ''}${echapper(ville.nom)}</div><div class="barres">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= ville.niveau ? 'on' : ''}"></i>`).join('')}</div>`;
}
export function echapper(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
