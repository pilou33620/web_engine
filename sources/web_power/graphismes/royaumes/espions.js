// L'espionnage (maquettes/guerre.html) : l'espion en cape à l'écharpe du royaume, tricorne et lanterne (1700, Lumières),
// bicorne et sacoche (Empire), haut-de-forme (Industrie), un anneau à ses pieds, grossi quand on dézoome ; il se faufile
// par bonds et s'accroupit pour guetter. Missions en cours (d'après l'état) : renseignement (longue-vue, onde dorée sur
// la ville), vol et sabotage (il entre dans la ville et en ressort, avec le rouleau de plans pour le vol). Issues du mois
// (d'après les événements du rapport) : renseignements obtenus, plans volés, bâtiment incendié ou saboté, espion démasqué
// (« ! », trois gardes sortent de la ville, la cage tombe).
import { THREE, scene, posCase, chaqueImage, hache, cam } from './scene.js';
import { MAT, CONT, lot, put, fusion, boite, cyl, cone, sphere } from './toon.js';
import { palierDe } from './modeles.js';
import { solEn, dessus } from './plateau.js';
import { bouffee, climat } from './vie.js';
import { lisse, capX, capVers, versMonde, cheminLisse, feu, oublierFeu, pastille, rond, tache, soldat } from './guerre_commun.js';

const ECH_ESPION = 0.08, PEAU = 0xf0c9a0, NOIR = 0x1f1f1f;
const groupe = new THREE.Group();
scene.add(groupe);

// ------------------------------------------------------------------ modèles (unités de web_power, face à +x)
const cache = new Map();
function enCache(cle, f) {
  let r = cache.get(cle);
  if (!r) { const L = lot(); f(L); r = { g: fusion(L.g), o: fusion(L.o) }; cache.set(cle, r); }
  const g = new THREE.Group(); g.add(new THREE.Mesh(r.g, MAT), new THREE.Mesh(r.o, CONT));
  return g;
}
function modeleEspion(L, roy, epoque) {
  const ep = 0.07;
  for (const dz of [-0.15, 0.15]) put(L, boite(0.22, 0.85, 0.26), 0x2b2b30, 0, 0.42, dz, 0, ep);
  put(L, cone(0.66, 1.6, 8), 0x2f3542, 0, 1.45, 0, 0, ep); // la cape
  put(L, cyl(0.31, 0.35, 0.16, 8), roy, 0, 2.0, 0, 0, 0); // écharpe aux couleurs du royaume
  put(L, sphere(0.27, 1), PEAU, 0.03, 2.26, 0, 0, ep);
  if (epoque === 'empire') put(L, boite(0.32, 0.36, 0.98), NOIR, 0, 2.5, 0, 0, 0.05); // bicorne
  else if (epoque === 'industrie') { put(L, cyl(0.48, 0.48, 0.05, 12), NOIR, 0, 2.42, 0, 0, 0.04); put(L, cyl(0.25, 0.27, 0.6, 10), NOIR, 0, 2.72, 0, 0, 0.05); } // haut-de-forme
  else put(L, cone(0.6, 0.32, 3), NOIR, 0, 2.5, 0, Math.PI, 0.05); // tricorne
  if (epoque === 'ancien' || epoque === 'lumieres') { put(L, boite(0.24, 0.3, 0.24), 0xffd36a, 0.38, 1.18, 0.34, 0, 0.04); put(L, boite(0.06, 0.25, 0.06), 0x2b2b30, 0.38, 1.45, 0.34, 0, 0); } // lanterne
  else { put(L, boite(0.36, 0.42, 0.2), 0x7a4a24, -0.05, 1.2, 0.62, 0, 0.04); put(L, boite(0.06, 0.06, 0.9), 0x5a3418, 0.18, 1.7, 0.3, 0, 0); } // sacoche
}
const longueVue = L => { const lv = cyl(0.09, 0.15, 1.3, 8); lv.rotateZ(-Math.PI / 2 + 0.25); put(L, lv, 0xc9a24a, 0.75, 2.34, 0.12, 0, 0.04); };
const plans = L => { const r = cyl(0.13, 0.13, 0.95, 10); r.rotateX(Math.PI / 2); put(L, r, 0xf2e6c4, 0, 3.05, 0, 0, 0.04); put(L, cyl(0.145, 0.145, 0.14, 10).rotateX(Math.PI / 2), 0xb8322a, 0, 3.05, 0, 0, 0); put(L, boite(0.1, 0.7, 0.1), PEAU, 0, 2.55, 0.25, 0, 0.03); };
function cage(L) {
  const fer = 0x3a3a40;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; put(L, cyl(0.05, 0.05, 2.9, 5), fer, Math.cos(a) * 0.8, 1.45, Math.sin(a) * 0.8, 0, 0.03); }
  put(L, cyl(0.9, 0.9, 0.12, 12), fer, 0, 0.06, 0, 0, 0.04); put(L, cyl(0.9, 0.9, 0.12, 12), fer, 0, 2.9, 0, 0, 0.04); put(L, cone(0.95, 0.5, 12), fer, 0, 3.2, 0, 0, 0.04);
}
const geoAnneau = new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2);
const matsAnneau = new Map();
const matAnneau = roy => { let m = matsAnneau.get(roy); if (!m) { m = new THREE.MeshBasicMaterial({ color: roy, transparent: true, opacity: 0.9, depthWrite: false }); matsAnneau.set(roy, m); } return m; };
const geoOnde = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);
const MAT_LUEUR = new THREE.PointsMaterial({ map: tache, size: 0.22, color: 0xffc86a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const ALERTE = g => { rond(g, '#ffb02e'); g.fillStyle = '#24180f'; g.fillRect(41, 20, 14, 36); g.beginPath(); g.arc(48, 70, 8, 0, 7); g.fill(); };
const ETOILE = g => { rond(g, '#fff2b8'); g.fillStyle = '#2f5fa8'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', 48, 52); };
const lanterne = ep => ep === 'ancien' || ep === 'lumieres';

/** Un espion posé : son corps (mis à l'échelle selon le zoom), sa longue-vue, ses plans, son anneau, sa lanterne. */
function creerEspion(roy, epoque) {
  const g = new THREE.Group();
  const corps = enCache(`espion|${roy}|${epoque}`, L => modeleEspion(L, roy, epoque));
  const lv = enCache('longue-vue', longueVue), pl = enCache('plans', plans);
  corps.add(lv, pl); lv.visible = pl.visible = false;
  g.add(corps); groupe.add(g);
  const anneau = new THREE.Mesh(geoAnneau, matAnneau(roy)); groupe.add(anneau);
  const lueur = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), MAT_LUEUR);
  lueur.visible = false; lueur.frustumCulled = false; groupe.add(lueur);
  return { g, corps, lv, pl, anneau, lueur, epoque, ph: Math.random() * 10 };
}
function oterEspion(o) { groupe.remove(o.g, o.anneau, o.lueur); o.lueur.geometry.dispose(); }
const zoom = () => Math.min(3, Math.max(1.25, cam.d / 8)); // reste lisible de loin

/** Pose l'espion : position, cap (face à +x), accroupi ou non, caché ou non. */
function poserEspion(o, x, z, cap, { accroupi = false, cache = false, saut = 0 } = {}) {
  const y = solEn(x, z), k = zoom();
  o.g.position.set(x, y + saut, z);
  o.g.rotation.set(0, cap, accroupi ? -0.25 : 0);
  o.corps.scale.set(ECH_ESPION * k, ECH_ESPION * k * (accroupi ? 0.8 : 1), ECH_ESPION * k);
  o.g.visible = o.anneau.visible = !cache;
  o.anneau.position.set(x, y + 0.036, z); o.anneau.scale.setScalar(k);
  const lant = lanterne(o.epoque) && climat.heure !== 'jour' && !cache;
  o.lueur.visible = lant;
  if (lant) { const q = versMonde(o.corps, 0.46, 1.2, 0.56); o.lueur.geometry.attributes.position.setXYZ(0, q.x, q.y, q.z); o.lueur.geometry.attributes.position.needsUpdate = true; }
}

// ------------------------------------------------------------------ état
const espions = new Map(); // id → { o, cle, case, mission, ville, anim, couleur }
const scenes = [];         // issues du mois : { maj(now, dt, t) → false quand c'est fini }
let E = null, dernierTour = -1;
const couleurDe = id => E?.royaumes.find(r => r.id === id)?.couleur || (id === 99 ? '#4b4b4b' : '#888');
const palierRoy = id => { const r = E?.royaumes.find(x => x.id === id); return r ? palierDe(r.joueur ? E.joueur?.techs : r.techs_liste) : 0; };
/** Où se tient un espion sur sa case : au bord, à l'écart des maisons et des armées (du côté de la ville visée s'il en a une). */
function place(id, c, vers = null) {
  const p = posCase(c), q = vers != null && vers !== c ? posCase(vers) : null;
  const a = q ? Math.atan2(q.z - p.z, q.x - p.x) + (hache(id, 12) - 0.5) * 0.8 : hache(id, 11) * 6.28;
  return { x: p.x + Math.cos(a) * 0.66, z: p.z + Math.sin(a) * 0.66 };
}

/** Met les espions d'accord avec l'état ; avec le rapport du mois, joue les issues des missions (une fois par mois). */
export function majEspions(etat, rapport) {
  E = etat = etat || { espions: [], villes: [], royaumes: [] }; // sans partie (accueil) : plus d'espions
  const epoque = etat.epoque?.cle || 'ancien', vus = new Set();
  for (const e of etat.espions || []) {
    vus.add(e.id);
    const roy = couleurDe(e.proprio), cle = `${roy}|${epoque}`;
    let v = espions.get(e.id);
    if (v && v.cle !== cle) { oterEspion(v.o); v = null; }
    if (!v) { v = { o: creerEspion(roy, epoque), cle, anim: null }; espions.set(e.id, v); }
    if (v.anim && performance.now() > v.anim.t0 + v.anim.duree) v.anim = null;
    v.case = e.case; v.mission = e.mission; v.proprio = e.proprio; v.chemin = e.chemin || [];
    v.ville = e.ville != null ? etat.villes.find(x => x.id === e.ville) : null;
    v.repos = place(e.id, e.case, v.ville?.case);
  }
  for (const [id, v] of espions) if (!vus.has(id)) { oterEspion(v.o); espions.delete(id); }
  if (rapport && rapport.tour !== dernierTour) { dernierTour = rapport.tour; issues(rapport); }
}

/** À appeler avec jouerMois de monde.js (mêmes rapport, état suivant et durée) : nos espions avancent par bonds. */
export function jouerMoisEspions(rapport, apres, duree = 2800) {
  if (!E) return;
  const t0 = performance.now();
  for (const e of apres.espions || []) {
    const v = espions.get(e.id);
    if (!v || v.case === e.case) continue;
    const i = v.chemin.indexOf(e.case), cases = [v.case, ...(i >= 0 ? v.chemin.slice(0, i + 1) : [e.case])];
    const pts = cases.map((c, k) => { const p = k === cases.length - 1 ? place(e.id, c) : k === 0 ? v.repos : posCase(c); return [p.x, p.z]; });
    v.anim = { route: cheminLisse(pts, 1), t0, duree };
  }
}

// ------------------------------------------------------------------ issues des missions (événements du rapport)
const villeA = c => E.villes.find(v => v.case === c);
// shortcut: les issues sont reconnues au début du texte des événements (espions.rs) ; à remplacer par un champ « genre » si le moteur en donne un
function issues(rapport) {
  for (const ev of rapport.evenements || []) {
    const t = ev.texte || '', c = ev.case;
    if (c == null) continue;
    if (t.startsWith('🕵️') && t.includes('démasqué')) {
      const auteur = t.startsWith('🕵️ Votre') ? 0 : E.royaumes.find(r => r.id !== 0 && t.includes(r.nom))?.id;
      scenes.push(sceneDemasque(c, auteur ?? 99));
    } else if (t.startsWith('🔎')) scenes.push(sceneOnde(c, 9));
    else if (t.startsWith('📜')) scenes.push(scenePlans(c));
    else if (t.startsWith('🔥') && t.includes('incendi')) scenes.push(sceneFeu(c, 10, 0.45));
    else if (t.startsWith('💣')) scenes.push(sceneFeu(c, 6, 0.3));
  }
}
const finir = objs => { for (const o of objs) o.parent?.remove(o); return false; };
// onde dorée : trois anneaux qui s'élargissent sur la région révélée
function sceneOnde(c, duree, suivre = null) {
  const p = posCase(c), y = dessus(c) + 0.03, t0 = performance.now();
  const ondes = [0, 1, 2].map(() => { const m = new THREE.Mesh(geoOnde, new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); groupe.add(m); return m; });
  return {
    maj(now) {
      const u = (now - t0) / 1000;
      if (u > duree || (suivre && !suivre())) { for (const m of ondes) m.material.dispose(); return finir(ondes); }
      ondes.forEach((m, i) => { const w = ((u + i) % 3) / 3; m.position.set(p.x, y, p.z); m.scale.setScalar(0.3 + w * 2.6); m.material.opacity = (1 - w) * 0.85 * Math.min(1, (duree - u) / 1.5); });
      return true;
    },
  };
}
// plans volés : l'étoile et le rouleau montent au-dessus de la ville
function scenePlans(c) {
  const p = posCase(c), y = dessus(c), t0 = performance.now();
  const et = pastille(ETOILE, 0.16); et.visible = true; groupe.add(et);
  const rouleau = enCache('plans', plans); rouleau.scale.setScalar(ECH_ESPION * 1.6); groupe.add(rouleau);
  return {
    maj(now, dt, t) {
      const u = (now - t0) / 1000;
      if (u > 5) { et.material.map.dispose(); et.material.dispose(); return finir([et, rouleau]); }
      const h = y + 0.5 + lisse(0, 1.5, u) * 0.4;
      et.position.set(p.x, h + 0.22, p.z); rouleau.position.set(p.x, h - 0.2, p.z); rouleau.rotation.y = t * 1.5;
      return true;
    },
  };
}
// incendie ou sabotage : les flammes et la fumée noire sur la ville
function sceneFeu(c, duree, s) {
  const p = posCase(c), y = dessus(c), t0 = performance.now(), a = hache(c, 9) * 6.28;
  const x = p.x + Math.cos(a) * 0.35, z = p.z + Math.sin(a) * 0.35, f = feu(groupe, x, y + 0.05, z, s); f.visible = true;
  return {
    maj(now, dt) {
      const u = (now - t0) / 1000;
      if (u > duree) { oublierFeu(f); return finir([f]); }
      f.scale.setScalar(s * Math.min(1, u * 2, (duree - u) / 1.5));
      if (Math.random() < dt * 6) bouffee(x, y + 0.25, z, 'noire', 1.2);
      return true;
    },
  };
}
// démasqué : « ! », trois gardes sortent de la ville et l'entourent, la cage tombe
function sceneDemasque(c, auteur) {
  const V = villeA(c), p = posCase(c), t0 = performance.now(), epoque = E.epoque?.cle || 'ancien';
  // au bord de la case, du côté de la caméra (un peu de biais : l'armée de la ville se range devant)
  const a = Math.atan2(Math.cos(cam.lacet), Math.sin(cam.lacet)) + 0.9, porte = { x: p.x + Math.cos(a) * 0.35, z: p.z + Math.sin(a) * 0.35 }, ici = { x: p.x + Math.cos(a) * 0.78, z: p.z + Math.sin(a) * 0.78 };
  const o = creerEspion(couleurDe(auteur), epoque);
  const gardeC = couleurDe(V ? V.proprio : 99), pal = palierRoy(V ? V.proprio : 99);
  const gardes = [0, 1, 2].map(() => soldat(groupe, gardeC, pal));
  const alerte = pastille(ALERTE); groupe.add(alerte);
  const cg = enCache('cage', cage); cg.visible = false; groupe.add(cg);
  const cap = capX(ici.x - p.x, ici.z - p.z);
  return {
    maj(now, dt, t) {
      const u = (now - t0) / 1000, k = zoom();
      if (u > 9) { oterEspion(o); alerte.material.map.dispose(); alerte.material.dispose(); return finir([...gardes, alerte, cg]); }
      poserEspion(o, ici.x, ici.z, cap + Math.PI, { accroupi: u < 0.3 });
      const y = solEn(ici.x, ici.z);
      alerte.visible = u > 0.3 && u < 6; alerte.position.set(ici.x, y + 0.3 * k + Math.abs(Math.sin(t * 6)) * 0.02, ici.z);
      gardes.forEach((g, i) => {
        const b = cap + Math.PI / 2 + (i - 1) * 1.6, cible = { x: ici.x + Math.cos(b) * 0.13, z: ici.z - Math.sin(b) * 0.13 }, f = lisse(0.6, 3 + i * 0.3, u);
        const x = porte.x + (cible.x - porte.x) * f, z = porte.z + (cible.z - porte.z) * f;
        g.visible = u > 0.6;
        g.position.set(x, solEn(x, z) + (f < 1 ? Math.abs(Math.sin(t * 10 + i)) * 0.006 : 0), z);
        g.rotation.y = f < 1 ? capVers(cible.x - porte.x, cible.z - porte.z) : capVers(ici.x - x, ici.z - z);
      });
      cg.visible = u > 3.6; if (cg.visible) { const f = lisse(3.6, 4.2, u); cg.position.set(ici.x, y + (1 - f) * 0.5, ici.z); cg.scale.setScalar(ECH_ESPION * k); }
      return true;
    },
  };
}

// ------------------------------------------------------------------ chaque image
const PAS = 0.95; // un bond : 1,1 s de marche, 0,7 s accroupi à guetter
chaqueImage((dt, t) => {
  const now = performance.now();
  for (const [id, v] of espions) {
    const o = v.o;
    o.lv.visible = false; o.pl.visible = false;
    if (v.anim) { // en route, par bonds
      const a = v.anim, k = Math.min(1, (now - a.t0) / a.duree), L = a.route.long, nb = Math.max(1, Math.round(L / PAS)), f = k * nb, n = Math.floor(f), w = f - n;
      const sd = Math.min(L, (n + Math.min(1, w / 0.6)) * L / nb), p = a.route.en(sd), marche = w < 0.6 && k < 1;
      poserEspion(o, p.x, p.z, p.cap, { accroupi: !marche, saut: marche ? Math.abs(Math.sin(t * 8)) * 0.005 : 0 });
      if (k >= 1) { v.anim = null; }
      continue;
    }
    const r = v.repos, ph = o.ph + id;
    if (v.mission && v.ville) { // en mission sur la ville visée
      const V = posCase(v.ville.case), vers = capX(V.x - r.x, V.z - r.z) || 0;
      if (v.mission === 'renseignement') {
        o.lv.visible = true;
        poserEspion(o, r.x, r.z, vers + Math.sin(t * 0.4 + ph) * 0.25, { accroupi: (t + ph) % 6 > 4.5 });
        if (!v.onde) { v.onde = sceneOnde(v.ville.case, 1e9, () => espions.get(id) === v && v.mission === 'renseignement'); scenes.push(v.onde); }
      } else { // vol ou sabotage : il se glisse dans la ville, y reste, puis ressort (avec les plans s'il vole)
        const u = (t + ph) % 9, porte = { x: V.x + (r.x - V.x) * 0.35, z: V.z + (r.z - V.z) * 0.35 };
        const f = lisse(0.5, 1.8, u) - lisse(6, 7.3, u), x = r.x + (porte.x - r.x) * f, z = r.z + (porte.z - r.z) * f;
        const cache = u > 1.9 && u < 5.9, retour = u >= 5.9;
        o.pl.visible = v.mission === 'vol' && retour && u < 8.5;
        poserEspion(o, x, z, retour ? vers + Math.PI : vers, { cache, accroupi: u > 7.6, saut: (u > 0.5 && u < 1.8) || (u > 6 && u < 7.3) ? Math.abs(Math.sin(t * 8)) * 0.005 : 0 });
        if (v.mission === 'sabotage' && u > 5.9 && u - dt <= 5.9) bouffee(porte.x, solEn(porte.x, porte.z) + 0.1, porte.z, 'noire', 0.8);
      }
      continue;
    }
    v.onde = null;
    // au repos : il guette, s'accroupit de temps en temps, regarde alentour
    const u = (t + ph) % 7;
    poserEspion(o, r.x, r.z, hache(id, 3) * 6.28 + Math.sin(t * 0.35 + ph) * 0.6, { accroupi: u > 5.2 && u < 6.4 });
  }
  for (let i = scenes.length - 1; i >= 0; i--) if (!scenes[i].maj(now, dt, t)) scenes.splice(i, 1);
});
