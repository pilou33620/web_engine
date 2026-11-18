// Carte test (premier client de lib/) : une seule carte, une seule scène (le moteur de web_royaumes, avec sa nature, sa météo et ses animations),
// et tous les bâtiments de l'époque choisie sur la frise, de 1700 à 2035 :
//  - époques de web_royaumes : l'état de partie du moteur Rust, retouché (époque, saison…), passé au pipeline du jeu ;
//  - époques de web_power : ses quartiers, ses fermes et chacune de ses installations de l'époque, dessinés par ses propres
//    modèles (lib/rendu/modernes.js) et posés sur le même plateau, avec leurs fumées et leurs éoliennes.
import { THREE, scene, cam, posCase, voisins, viser, chaqueImage } from '../lib/rendu/scene.js';
import * as plateau from '../lib/rendu/plateau.js';
import { initMonde, synchroniser } from '../lib/rendu/monde.js';
import { majVie, bouffee } from '../lib/rendu/vie.js';
import { majQuartiers } from '../lib/rendu/quartiers.js';
import { majBrouillard } from '../lib/rendu/brouillard.js';
import { majMarine } from '../lib/rendu/marine.js';
import { majEspions } from '../lib/rendu/espions.js';
import { appliquerMeteo, forcerHeure, forcerMarche } from '../lib/rendu/meteo.js';
import { majRoutes, niveauRoutes } from '../lib/rendu/routes.js';
import { TECHS_PALIER } from '../lib/rendu/modeles.js';
import { jeter } from '../lib/rendu/toon.js';
import { BAT, QBAT, bFerme, modele, INSTALLATIONS, QUARTIERS, EPOQUES } from '../lib/rendu/modernes.js';


const $ = s => document.querySelector(s);
const charger = c => fetch(c).then(r => r.json());
const [R, carte, base] = await Promise.all([
  charger('../sources/web_royaumes/rust/royaumes/data/regles.json'),
  charger('../galerie/web_royaumes/donnees/carte.json'),
  charger('../galerie/web_royaumes/donnees/etat.json'),
]);

// ------------------------------------------------------------------ les époques des deux sources, bout à bout
const ERES = [
  ...R.epoques.map(e => ({ source: 'web_royaumes', cle: e.cle, an: e.debut, nom: e.nom, txt: '' })),
  ...EPOQUES.map(e => ({ source: 'web_power', an: e.an, nom: e.nom, txt: e.txt })),
];

// ------------------------------------------------------------------ la carte
initMonde(R);
plateau.construire(carte);
const N = carte.l * carte.h, ville = base.villes.find(v => v.capitale) || base.villes[0], cap = ville.case;
const terre = i => carte.terrain[i] >= 3 && carte.terrain[i] <= 5, eau = i => carte.terrain[i] <= 2;
const riviere = i => !!carte.riviere[i], foret = i => !!carte.foret[i];
const auBordDeLEau = i => voisins(i).some(eau);
// toutes les cases, rangées par éloignement de la capitale (parcours en largeur)
const dist = new Array(N).fill(-1), ordre = [cap]; dist[cap] = 0;
for (let k = 0; k < ordre.length; k++) for (const n of voisins(ordre[k])) if (dist[n] < 0) { dist[n] = dist[ordre[k]] + 1; ordre.push(n); }
/** La case libre la plus proche de la capitale qui convient ; sinon, en dernier recours, n'importe quelle terre libre. */
function placer(pris, ok) {
  const c = ordre.find(i => !pris.has(i) && ok(i)) ?? ordre.find(i => !pris.has(i) && terre(i) && !riviere(i));
  if (c != null) pris.add(c);
  return c;
}

// ------------------------------------------------------------------ époques de web_royaumes : l'état du moteur, retouché
const NOMS = Object.fromEntries(R.batiments.map(b => [b.cle, b.nom]));
const batimentsRoy = (() => {
  const pris = new Set(base.batiments.map(b => b.case)), liste = [...base.batiments];
  let id = 1000;
  for (const def of R.batiments) {
    if (def.cle === 'hotel') continue;
    const rive = ['port', 'pecheur'].includes(def.cle);
    const c = placer(pris, i => terre(i) && !riviere(i) && (rive ? auBordDeLEau(i) : !foret(i)));
    if (c != null) liste.push({ id: id++, cle: def.cle, proprio: 0, case: c, reste: 0, ouvriers: 0, etat: '', pause: false, file: [], face: (c % 6) * Math.PI / 3, ville: ville.id, produit: {}, arret: null });
  }
  return liste;
})();
const rayonRoy = Math.max(...batimentsRoy.map(b => dist[b.case])) + 1;
const proprioRoy = base.cases.proprio.map((p, i) => (dist[i] >= 0 && dist[i] <= rayonRoy && !eau(i) ? 0 : p));
const PALIER = { ancien: 1, lumieres: 2, empire: 3, industrie: 5 };  // uniformes et armes de l'armée
const FORTIF = { ancien: 2, lumieres: 3, empire: 3, industrie: 4 };   // shortcut: remparts fixés par époque ; un réglage s'il faut tous les voir à chaque époque

// ------------------------------------------------------------------ époques de web_power : ses modèles sur le même plateau
const moderne = new THREE.Group(); scene.add(moderne);
let fumees = [], rotors = [];
const MER_Y = -0.12;  // les modèles en mer de web_power sont posés sur l'eau
const LIEU = {        // où web_power autorise chaque installation (sinon : terre ferme, hors rivière et hors forêt)
  fil: i => terre(i) && riviere(i), barrage: i => terre(i) && riviere(i),
  offshore: i => eau(i) && voisins(i).some(terre), dessal: i => terre(i) && !riviere(i) && auBordDeLEau(i),
  prise: i => terre(i) && !riviere(i) && voisins(i).some(n => riviere(n) || eau(n)), step: i => terre(i) && !riviere(i) && voisins(i).some(n => riviere(n) || eau(n)),
};
function batimentsPower(an) {
  const q = (k, n = 1) => Array.from({ length: n }, () => ({ nom: QUARTIERS.find(q => q.cle === k).nom, groupe: 'Villes', dessin: L => QBAT[k](L, { fum: [] }) }));
  const villes = [...q('centre'), ...q('residentiel', 2), ...q('industriel'), ...(an >= 1930 ? q('hopital') : []), ...(an >= 1960 ? q('affaires') : []), ...q('village')];
  const fermes = [['Ferme céréalière', false], ['Ferme d’élevage', true]].map(([nom, e]) => ({ nom, groupe: 'Fermes', dessin: L => bFerme(L, e) }));
  const inst = INSTALLATIONS.filter(t => t.groupe !== 'Chantier' && t.an <= an && !(t.fin && t.fin < an))
    .map(t => ({ type: t.cle, nom: t.nom, groupe: t.groupe, dessin: (L, ex) => BAT[t.cle](L, ex) }));
  return [...villes, ...fermes, ...inst];
}
function poserPower(an) {
  const pris = new Set(), liste = [];
  batimentsPower(an).forEach((b, i) => {
    const c = i === 0 ? cap : placer(pris, LIEU[b.type] || (k => terre(k) && !riviere(k) && !foret(k)));
    if (c == null) return;
    pris.add(c);
    const m = modele(b.dessin, i), { x, z } = posCase(c);
    m.groupe.position.set(x, eau(c) ? MER_Y : plateau.dessus(c) - (b.type === 'barrage' ? 0.1 : 0), z);
    m.groupe.rotation.y = (c % 6) * Math.PI / 3;
    moderne.add(m.groupe); m.groupe.updateMatrixWorld(true);
    for (const [fx, fy, fz, vapeur] of m.fumees) fumees.push({ p: new THREE.Vector3(fx, fy, fz).applyMatrix4(m.groupe.matrixWorld), genre: vapeur ? 'blanche' : 'noire', t: Math.random() });
    rotors.push(...m.rotors);
    liste.push({ ...b, case: c });
  });
  return liste;
}
chaqueImage(dt => {
  for (const f of fumees) if ((f.t -= dt) < 0) { f.t = 0.3 + Math.random() * 0.2; bouffee(f.p.x, f.p.y, f.p.z, f.genre); }
  for (const r of rotors) r.rotation.z -= dt * 2;
});

// ------------------------------------------------------------------ appliquer une époque
const f = $('#choix'), MOIS = [1, 4, 7, 10], TEMP = [2, 12, 22, 12];
let ere = ERES[0], liste = [];
function etat() {
  const saison = +f.saison.value, genre = f.genre.value, roy = ere.source === 'web_royaumes', ep = roy ? ere.cle : 'industrie';
  const meteo = { ...base.meteo, genre, temperature: { neige: -2, gel: -6, canicule: 33 }[genre] ?? TEMP[saison], pluie: ['pluie', 'orage', 'tempete', 'neige'].includes(genre) ? 0.7 : 0, vent: genre === 'tempete' ? 1 : 0.4, neige_sol: f.neige.checked ? 1 : 0 };
  const commun = { ...base, annee: ere.an, mois: MOIS[saison], saison, meteo, explore: null, visible: null, epoque: { cle: ep, nom: ere.nom }, jour_marche: true };
  if (!roy) return { ...commun, batiments: [], villes: [], armees: [], routes: [], cases: { ...base.cases, proprio: base.cases.proprio.map(() => -1) } };
  const fortif = FORTIF[ep], enceinte = fortif >= 3 ? [cap, ...voisins(cap).filter(terre)] : [cap];
  return {
    ...commun, joueur: { ...base.joueur, techs: TECHS_PALIER.slice(1, PALIER[ep] + 1) },
    villes: base.villes.map(v => v.id !== ville.id ? v : { ...v, niveau: 5, jour_marche: true, eclairage: ep !== 'ancien', ecoles: 2, fortif, enceinte, travaux_fortif: null }),
    batiments: batimentsRoy, cases: { ...base.cases, proprio: proprioRoy },
  };
}
function appliquer(nouvelleEre) {
  if (nouvelleEre) {
    ere = nouvelleEre;
    jeter(moderne); scene.add(moderne); moderne.clear(); fumees = []; rotors = [];
    liste = ere.source === 'web_power' ? poserPower(ere.an)
      : batimentsRoy.map(b => ({ nom: b.cle === 'hotel' ? `${NOMS.hotel} niv. 5` : NOMS[b.cle], groupe: R.categories?.find?.(c => c.cle === R.batiments.find(d => d.cle === b.cle)?.cat)?.nom || 'Royaume', case: b.case }));
    plateau.degager(ere.source === 'web_power' ? liste.map(b => b.case) : []);
    afficherEre(); remplirListe();
  }
  const e = etat();
  forcerHeure(f.heure.value || null); forcerMarche(true);
  // même ordre que appliquer() dans main.js de web_royaumes
  plateau.majEtat(e);
  plateau.majSaison(e.saison, e.meteo.neige_sol);
  synchroniser(e);
  majBrouillard(e); majMarine(e); majEspions(e, null);
  niveauRoutes(e.joueur?.routes?.niveau || 1);
  majRoutes(e.routes);
  majVie(e, null);
  majQuartiers(e);
  appliquerMeteo(e.meteo, e.saison);
}

// ------------------------------------------------------------------ interface
const frise = $('#frise');
ERES.forEach((e, i) => {
  if (i && e.source !== ERES[i - 1].source) frise.append(Object.assign(document.createElement('span'), { className: 'separe' }));
  const b = document.createElement('button');
  b.type = 'button'; b.className = e.source === 'web_power' ? 'power' : 'royaumes';
  b.innerHTML = `<b>${e.an}</b>${e.nom}`; b.title = `${e.nom} (${e.source === 'web_power' ? 'bâtiments modernes' : 'bâtiments anciens'})`;
  b.onclick = () => choisir(e);
  frise.append(b); e.bouton = b;
});
function afficherEre() {
  $('#annee').textContent = ere.an; $('#ere').textContent = ere.nom;
  $('#source').textContent = `${ere.source === 'web_power' ? 'bâtiments modernes' : 'bâtiments anciens'} · ${liste.length} bâtiments`;
  $('#texte-ere').textContent = ere.txt;
  for (const e of ERES) e.bouton.setAttribute('aria-pressed', e === ere);
  history.replaceState(null, '', '#' + ere.an);
}
function remplirListe() {
  const el = $('#liste'); el.textContent = '';
  for (const [g, bs] of Map.groupBy(liste, b => b.groupe)) {
    el.append(Object.assign(document.createElement('h3'), { textContent: g }));
    for (const b of bs) {
      const bt = Object.assign(document.createElement('button'), { type: 'button', textContent: b.nom });
      bt.onclick = () => { const { x, z } = posCase(b.case); viser(x, z, 7); plateau.selection(b.case); };
      el.append(bt);
    }
  }
}
$('#voir-liste').onclick = e => { const l = $('#liste'); l.hidden = !l.hidden; e.currentTarget.setAttribute('aria-expanded', !l.hidden); };
function choisir(e) {
  $('#attente').hidden = false;
  setTimeout(() => { try { plateau.selection(null); appliquer(e); } finally { $('#attente').hidden = true; } }, 20);  // le message s'affiche avant le calcul
}
f.addEventListener('change', () => appliquer());

choisir(ERES.find(e => String(e.an) === location.hash.slice(1)) || ERES[0]);
const p = posCase(cap);
Object.assign(cam, { l: Math.sqrt(3) * carte.l, h: 1.5 * carte.h, x: p.x, z: p.z, cible: 18, d: 18, auto: true });
