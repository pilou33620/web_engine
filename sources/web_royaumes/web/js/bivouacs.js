// Les armées au repos (la nuit, ou hors des villes depuis un tour) : le bivouac de la bibliothèque (bivouacAncien, web_engine 2.12) à la place du bivouac simple de vie.js.
// vie.js garde la main (il cache l'armée la nuit et pose son bivouac sur sa matrice) : on réduit l'icône à presque rien pendant
// le repos, ce qui efface ce bivouac-là, et on pose le nouveau à la place, à la taille et dans l'orientation de l'armée.
import { THREE, scene, chaqueImage } from '../graphismes/rendu/scene.js';
import { listeArmees, couleurDe, palierRoyaume } from '../graphismes/rendu/monde.js';
import { climat } from '../graphismes/rendu/vie.js';
import { modele, animer } from '../graphismes/rendu/modernes.js';
import { bivouacAncien } from '../graphismes/rendu/animations.js';
import { jeter } from '../graphismes/rendu/toon.js';

const MINI = 1e-4, bivs = new Map(); // id de l'armée → { m, cle, s0 (échelle de l'icône avant le repos) }
const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
const arrivees = new Map(); // id de l'armée → { case, tour } : depuis quand elle se tient sur sa case
let campees = new Set();    // armées hors des villes restées au moins un tour entier sur leur case : bivouac de jour comme de nuit

/** À chaque nouvel état : les armées qui campent (ni sur un bâtiment, ni dans une enceinte, ni à un fort, ni à un siège, ni retranchées : leurs propres rendus). */
export function suivreArmees(etat) {
  const occupees = new Set([...etat.batiments.map(b => b.case), ...(etat.forts || []).map(f => f.case), ...etat.villes.flatMap(v => v.enceinte || [])]);
  campees = new Set();
  for (const a of etat.armees) {
    let r = arrivees.get(a.id);
    if (!r || r.case !== a.case || (a.chemin || []).length) arrivees.set(a.id, r = { case: a.case, tour: etat.tour });
    if (etat.tour > r.tour && !a.assiege && !a.retranche && !occupees.has(a.case)) campees.add(a.id);
  }
  for (const id of arrivees.keys()) if (!etat.armees.some(a => a.id === id)) arrivees.delete(id);
}

function oter(id, g) {
  const b = bivs.get(id); if (!b) return;
  if (g && g.scale.x < MINI * 10) g.scale.setScalar(b.s0); // monde.js ne l'a pas déjà remise à sa taille
  jeter(b.m.groupe); bivs.delete(id);
}

chaqueImage(() => {
  const vus = new Set();
  for (const a of listeArmees()) {
    const g = a.groupe; vus.add(a.id);
    if ((climat.heure !== 'nuit' && !campees.has(a.id)) || a.enMarche || !g.visible) { oter(a.id, g); continue; } // !visible : sur l'eau, à bord de sa flotte
    const cle = `${couleurDe(a.proprio)}|${palierRoyaume(a.proprio)}`;
    let b = bivs.get(a.id);
    if (b && b.cle !== cle) { oter(a.id, g); b = null; }
    if (!b) {
      g.updateWorldMatrix(true, false); g.matrixWorld.decompose(p, q, s);
      const m = modele(bivouacAncien(palierRoyaume(a.proprio), couleurDe(a.proprio)), a.id);
      m.groupe.position.copy(p); m.groupe.quaternion.copy(q); m.groupe.scale.copy(s);
      scene.add(m.groupe); animer(m);
      bivs.set(a.id, b = { m, cle, s0: g.scale.x });
    }
    if (g.scale.x >= MINI * 10) { b.s0 = g.scale.x; g.scale.setScalar(MINI); } // monde.js remet l'échelle à chaque mise à jour de l'état
  }
  for (const id of [...bivs.keys()]) if (!vus.has(id)) oter(id);
});
