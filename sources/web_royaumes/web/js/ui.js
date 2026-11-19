// L'interface : barre du haut, panneaux (construire, diplomatie, armées, royaume, menu), fiche d'une case
// (ville, bâtiment, armées, flottes, espions, fort, siège), récapitulatif du mois, événements à choix, annonces.
import { echapper as e } from '../graphismes/rendu/etiquettes.js';
import { voisins } from '../graphismes/rendu/scene.js';

const $ = s => document.querySelector(s);
let J = null, A = null;
const SAISON_ICONE = ['❄️', '🌸', '☀️', '🍂'];
const ICONE_METEO = { soleil: '☀️', nuages: '⛅', pluie: '🌧️', orage: '⛈️', brouillard: '🌫️', neige: '🌨️', gel: '🥶', canicule: '🥵', tempete: '🌪️' };
const NOM_METEO = { soleil: 'Ensoleillé', nuages: 'Nuageux', pluie: 'Pluvieux', orage: 'Orageux', brouillard: 'Brumeux', neige: 'Neigeux', gel: 'Grand froid', canicule: 'Canicule', tempete: 'Tempête' };
const STATUT = { guerre: '⚔️ Guerre', neutre: '😐 Neutre', paix: '🕊️ Paix', alliance: '🤝 Alliance' };

export function installerUI(jeu, actions) {
  J = jeu; A = actions;
  $('#feuille-fermer').onclick = fermerFeuille;
  $('#feuille').addEventListener('pointerdown', () => (tenue = performance.now() + 1500));
  $('#annuler-mode').onclick = () => A.annulerMode();
  $('#fin-tour').onclick = () => A.finTour();
  $('#ressources').onclick = ev => panneau(ev.target.closest('[data-p]')?.dataset.p || 'royaume');
  $('#date').onclick = () => panneau('royaume');
  $('#meteo').onclick = panneauMeteo;
  $('#quete').onclick = () => $('#quete').classList.toggle('replie');
  document.querySelectorAll('#bas .nb').forEach(b => (b.onclick = () => { A.annulerMode(); panneau(b.dataset.panneau); }));
  addEventListener('keydown', ev => { if (ev.key === 'Escape') { A.annulerMode(); fermerFeuille(); } if (ev.key === 'Enter' && !$('#modale').classList.contains('ouverte') && J.etat) A.finTour(); });
}

// ------------------------------------------------------------------ utilitaires
const R = () => J.R;
const res = cle => R().ressources.find(r => r.cle === cle) || { nom: cle, icone: '' };
const bat = cle => R().batiments.find(b => b.cle === cle);
const unite = cle => R().unites.find(u => u.cle === cle);
const tech = cle => R().techs.find(t => t.cle === cle);
const nomNiveau = n => R().niveaux.find(x => x.niveau === n)?.nom || '';
const fmt = n => (Math.abs(n) >= 10000 ? Math.round(n / 1000) + 'k' : Math.floor(n));
const roy = id => J.etat.royaumes.find(r => r.id === id) || { nom: 'Brigands', couleur: '#4b4b4b' };
const pastille = id => `<span class="pastille" style="--c:${roy(id).couleur}"></span>`;
function couts(cout, mult = 1) {
  const st = J.etat.joueur.stock;
  return Object.entries(cout || {}).map(([r, n]) => { const v = Math.ceil(r === 'or' ? n * mult : n); return `<span class="cout ${(st[r] || 0) < v ? 'non' : ''}">${res(r).icone}${v}</span>`; }).join('');
}
// la vie des villes (moteur : cite.rs) : ce qu'elle rapporte ou coûte en or, et les lignes de bonheur qui en viennent
const VIE = ['Jour de marché', 'Marché déserté', 'Ignorance', 'Éclairage public', 'Chauffage'];
const signe = v => `${v > 0 ? '+' : ''}${Math.round(v)}`;
const vieBonheur = j => (j.detail_bonheur || []).filter(([k, v]) => v && VIE.some(x => k.startsWith(x)));
function vieOr(j) {
  const rv = j.revenus || {};
  return [rv.marche >= 0.5 && `🧺 jour de marché +${Math.round(rv.marche)}`, rv.delinquance >= 0.5 && `🦹 délinquance −${Math.round(rv.delinquance)}`, rv.eclairage && `🏮 éclairage −${Math.round(rv.eclairage)}`].filter(Boolean);
}
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const prochainMarche = () => { const n = R().jour_marche.tous_les, m = J.etat.mois; return MOIS_NOMS[Math.min((Math.floor(m / n) + 1) * n, 12) % 12]; };
const peutPayer = (cout, mult = 1) => Object.entries(cout || {}).every(([r, n]) => (J.etat.joueur.stock[r] || 0) >= (r === 'or' ? n * mult : n) - 1e-9);

export function annonce(msg, genre = '') {
  const d = document.createElement('div');
  d.className = 'annonce ' + genre;
  d.textContent = msg;
  const box = $('#annonces');
  box.prepend(d);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => d.remove(), 4300);
}

// ------------------------------------------------------------------ barre du haut
export function majHUD() {
  const E = J.etat, j = E.joueur, st = j.stock, b = j.bilan || {};
  const delta = r => (b[r] ? `<small class="${b[r] > 0 ? 'p' : 'm'}">${b[r] > 0 ? '+' : ''}${Math.round(b[r])}</small>` : '');
  const puce = (icone, val, cls = '', titre = '', d = '', p = '') => `<div class="puce ${cls}" title="${titre}"${p ? ` data-p="${p}"` : ''}>${icone} ${val}${d}</div>`;
  const mesVilles = E.villes.filter(v => v.proprio === 0), rv = j.revenus || {};
  const nourr = R().nourriture.reduce((s, r) => s + (st[r] || 0), 0);
  const rs = r => puce(res(r).icone, fmt(st[r] || 0), (st[r] || 0) >= (j.capacite[r] || 1e9) - 0.5 ? 'plein' : (st[r] || 0) < 3 ? 'bas' : '', res(r).nom, delta(r));
  $('#ressources').innerHTML =
    (mesVilles.some(v => v.assiegee) ? puce('🏰', 'Siège !', 'bas', 'Une de vos villes est assiégée', '', 'armees') : '') +
    (mesVilles.some(v => v.blocus) ? puce('⚓', 'Blocus', 'bas', 'Un de vos ports est bloqué par une flotte ennemie', '', 'armees') : '') +
    puce('🪙', fmt(st.or), '', `Or — impôts +${Math.round(rv.impots || 0)}, commerce +${Math.round((rv.commerce || 0) + (j.commerce_mer || 0))} (dont mer ${Math.round(j.commerce_mer || 0)}), entretien −${Math.round(rv.entretien || 0)} (flotte et espions ${Math.round(j.entretien_flotte || 0)}, forts ${Math.round(j.entretien_forts || 0)})${vieOr(j).length ? ' — dont ' + vieOr(j).join(', ') : ''}`, delta('or')) +
    puce('👥', `${j.pop}/${j.logement}`, j.pop >= j.logement ? 'plein' : '', 'Habitants / logements') +
    puce(j.bonheur >= 60 ? '😊' : j.bonheur >= 35 ? '😐' : '😠', Math.round(j.bonheur) + '%', j.bonheur < 35 ? 'bas' : '', e(`Bonheur — ${(j.detail_bonheur || []).filter(([, v]) => v).map(([k, v]) => `${k} ${signe(v)}`).join(', ')}`)) +
    puce('🍽️', fmt(nourr), j.famine ? 'bas' : '', 'Nourriture') +
    ['bois', 'planches', 'pierre', 'outils', 'ble', 'farine', 'pain', 'poisson', 'minerai', 'charbon', 'fer', 'armes', 'biere', 'vin', 'laine', 'tissu'].map(rs).join('');
  $('#date').textContent = `${SAISON_ICONE[E.saison]} ${E.date} · ${E.epoque.nom}`;
  $('#meteo').textContent = `${ICONE_METEO[E.meteo.genre] || '🌤️'} ${NOM_METEO[E.meteo.genre] || ''} ${Math.round(E.meteo.temperature)}°C`;
  const q = j.quete;
  $('#quete').innerHTML = q ? `<div class="q1">📜 OBJECTIF ${q.n}</div><div class="q2">${e(q.texte)}${q.prime ? ` <span style="color:#ffd56b">+${q.prime} 🪙</span>` : ''}</div>` : '';
  const mois = R && E ? E.mois_nom : '';
  $('#fin-tour-mois').textContent = `${mois} → ${['Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier'][E.mois]}`;
  $('#nb-diplo').classList.toggle('alerte', E.royaumes.some(r => !r.joueur && r.vivant && r.statut === 'guerre'));
  $('#nb-armees').classList.toggle('alerte', E.armees.some(a => a.proprio !== 0 && a.chemin.length && estEnnemi(a.proprio)) || E.sieges.some(s => s.proprio === 0) || mesVilles.some(v => v.blocus));
  $('#nb-royaume').classList.toggle('alerte', !j.recherche && R().techs.some(t => !j.techs.includes(t.cle) && t.annee <= E.annee));
  if (sheet && sheet.vivante && performance.now() > tenue) rafraichir();
}
const estEnnemi = id => id === 99 || roy(id).statut === 'guerre';

// ------------------------------------------------------------------ feuille
let sheet = null, tenue = 0;
export function ouvrirFeuille(titre, fn, vivante = true) {
  sheet = { fn, vivante };
  $('#feuille-titre').innerHTML = titre;
  rafraichir();
  $('#feuille').classList.add('ouverte');
  document.body.classList.add('feuille');
  $('#feuille-corps').scrollTop = 0;
}
export function rafraichir() {
  if (!sheet) return;
  const c = $('#feuille-corps'), sc = c.scrollTop, h = sheet.fn();
  if (h == null) { fermerFeuille(); return; }
  c.innerHTML = h;
  c.scrollTop = sc;
  c.querySelectorAll('[data-a]').forEach(el => (el.onclick = ev => { ev.stopPropagation(); clic(el); }));
}
export function fermerFeuille() { sheet = null; $('#feuille').classList.remove('ouverte'); document.body.classList.remove('feuille'); A?.surFermeture?.(); }
export const feuilleOuverte = () => !!sheet;

// ------------------------------------------------------------------ modale (rend une promesse)
const fileModale = [];
export function modale(titre, html, boutons, genre = '') {
  return new Promise(res => {
    fileModale.push({ titre, html, boutons, res, genre });
    if (fileModale.length === 1) montrerModale();
  });
}
function montrerModale() {
  const m = fileModale[0];
  if (!m) return;
  $('#modale-boite').className = m.genre;
  $('#modale-boite').innerHTML = `<h3>${m.titre}</h3>${m.html}<div class="btns" style="justify-content:flex-end;margin-top:12px">${m.boutons.map((b, i) => `<button class="btn ${b.c || ''}" data-i="${i}" ${b.d ? 'disabled' : ''}>${b.l}</button>`).join('')}</div>`;
  $('#modale').classList.add('ouverte');
  $('#modale-boite').querySelectorAll('button[data-i]').forEach(el => (el.onclick = () => {
    const b = m.boutons[+el.dataset.i];
    $('#modale').classList.remove('ouverte');
    fileModale.shift();
    m.res(b.v);
    setTimeout(montrerModale, 60);
  }));
}
export const modaleOuverte = () => fileModale.length > 0;

// ------------------------------------------------------------------ actions des boutons
async function clic(el) {
  const d = el.dataset, a = d.a;
  const envoyer = async (cmd, ok) => { const r = await A.cmd(cmd); if (r.ok) { if (r.msg) annonce(r.msg, 'bon'); rafraichir(); ok && ok(r); } else if (r.msg) annonce('❌ ' + r.msg, 'guerre'); return r; };
  switch (a) {
    case 'cat': ongletConstruire = d.v; rafraichir(); break;
    case 'bat': A.modeConstruire(d.v); break;
    case 'ici': await envoyer({ action: 'construire', cle: d.v, case: +d.c }, () => fermerFeuille()); break;
    case 'demolir': if (await modale('Démolir ?', '<p>La moitié des matériaux sera récupérée.</p>', [{ l: 'Démolir', c: 'rouge', v: true }, { l: 'Annuler', c: 'b2', v: false }])) await envoyer({ action: 'demolir', case: +d.c }, () => fermerFeuille()); break;
    case 'pause': await envoyer({ action: 'pause', batiment: +d.v }); break;
    case 'recruter': await envoyer({ action: 'recruter', batiment: +d.b, unite: d.v }); break;
    case 'ameliorer': await envoyer({ action: 'ameliorer', ville: +d.v }); break;
    case 'armee': A.choisirArmee(+d.v); break;
    case 'deplacer': A.modeDeplacer(+d.v); break;
    case 'halte': await envoyer({ action: 'halte', armee: +d.v }); break;
    case 'centrer': A.centrer(+d.v); break;
    case 'case': A.inspecter(+d.c); break;
    case 'viser': A.viserCase(+d.c); break;
    case 'fortifier': await envoyer({ action: 'fortifier', ville: +d.v }); break;
    case 'eclairer': await envoyer({ action: 'eclairer', ville: +d.v, actif: d.s === '1' }); break;
    case 'retrancher': await envoyer({ action: 'retrancher', armee: +d.v }); break;
    case 'fort': await envoyer({ action: 'construire_fort', armee: +d.v }); break;
    case 'amfort': await envoyer({ action: 'ameliorer_fort', fort: +d.v }); break;
    case 'flotte': A.choisirFlotte(+d.v); break;
    case 'naviguer': A.modeFlotte(+d.v); break;
    case 'mouiller': await envoyer({ action: 'deplacer_flotte', flotte: +d.v, case: +d.c }); break;
    case 'embarquer': await envoyer({ action: 'embarquer', flotte: +d.f, armee: +d.v }, () => A.choisirFlotte(+d.f)); break;
    case 'debarquer': A.modeDebarquer(+d.v); break;
    case 'commerce': await envoyer({ action: 'commerce_flotte', flotte: +d.v, actif: d.s === '1' }); break;
    case 'espion': A.choisirEspion(+d.v); break;
    case 'filer': A.modeEspion(+d.v); break;
    case 'terrer': await envoyer({ action: 'deplacer_espion', espion: +d.v, case: +d.c }); break;
    case 'mission': await envoyer({ action: 'mission', espion: +d.v, genre: d.g, ville: +d.c }); break;
    case 'assaut': assaut(+d.v); break;
    case 'diviser': diviser(+d.v); break;
    case 'diplo': if (d.v === 'guerre' && !await modale('Déclarer la guerre ?', `<p>Vous allez entrer en guerre contre <b>${e(roy(+d.r).nom)}</b>. ${trahison(roy(+d.r)) || 'Les autres royaumes vous jugeront belliqueux.'}</p>`, [{ l: '⚔️ Guerre !', c: 'rouge', v: true }, { l: 'Annuler', c: 'b2', v: false }])) break;
      if (d.v === 'rompre' && !await modale('Rompre l\'alliance ?', `<p><b>${e(roy(+d.r).nom)}</b> y verra une trahison, et s'en souviendra longtemps.</p>`, [{ l: '💔 Rompre', c: 'rouge', v: true }, { l: 'Annuler', c: 'b2', v: false }])) break;
      await envoyer({ action: 'diplo', royaume: +d.r, acte: d.v }); break;
    case 'aide': await envoyer({ action: 'diplo', royaume: +d.r, acte: 'aide', contre: +d.c }); break;
    case 'repondre': await envoyer({ action: 'repondre', proposition: +d.v, accepte: d.s === '1' }); break;
    case 'marche': marcheDe = +d.r; rafraichir(); break;
    case 'retour': marcheDe = null; rafraichir(); break;
    case 'echange': await envoyer({ action: 'echanger', royaume: +d.r, ressource: d.v, achat: d.s === '1' }); break;
    case 'ktab': ongletRoyaume = d.v; rafraichir(); break;
    case 'impots': await envoyer({ action: 'impots', niveau: d.v }); break;
    case 'tech': await envoyer({ action: 'rechercher', tech: d.v }); break;
    case 'routes': await envoyer({ action: 'ameliorer_routes' }); break;
    case 'menu': A.menu(d.v); break;
  }
}

// ------------------------------------------------------------------ panneaux
export function panneau(nom) {
  if (!J.etat) return;
  if (nom === 'construire') ouvrirFeuille('🏗️ Construire', vueConstruire);
  if (nom === 'diplomatie') { marcheDe = null; ouvrirFeuille('🤝 Diplomatie', vueDiplomatie); }
  if (nom === 'armees') ouvrirFeuille('⚔️ Armées', vueArmees);
  if (nom === 'royaume') ouvrirFeuille('📊 Royaume', vueRoyaume);
  if (nom === 'menu') ouvrirFeuille('☰ Menu', vueMenu, false);
}

let ongletConstruire = 'habitat';
function dispo(b) {
  const j = J.etat.joueur;
  if (b.niveau > j.niveau_capitale) return `🔒 ${nomNiveau(b.niveau)}`;
  if (b.tech && !j.techs.includes(b.tech)) return `🔒 ${tech(b.tech)?.nom || b.tech}`;
  return '';
}
function metaBat(b) {
  return [b.ouvriers ? `👷${b.ouvriers}` : '', b.logement ? `👥+${b.logement}` : '', Object.entries(b.prod || {}).map(([r, v]) => `${res(r).icone}${v}/mois`).join(' '),
    Object.keys(b.conso || {}).length ? '← ' + Object.keys(b.conso).map(r => res(r).icone).join('') : '', b.duree ? `⏳${b.duree} mois` : ''].filter(Boolean).join(' · ');
}
function vueConstruire() {
  let h = `<div class="onglets">${R().categories.map(c => `<button class="onglet ${c.cle === ongletConstruire ? 'on' : ''}" data-a="cat" data-v="${c.cle}">${c.icone} ${c.nom}</button>`).join('')}</div><div class="grille-cartes">`;
  for (const b of R().batiments) {
    if (b.cat !== ongletConstruire) continue;
    const v = dispo(b);
    h += `<div class="fiche ${v ? 'verrou' : ''}" data-a="bat" data-v="${b.cle}">${v ? `<div class="verrou-t">${v}</div>` : ''}<div class="fi">${b.icone}</div><div class="fn">${e(b.nom)}</div><div class="fd">${e(b.desc)}</div><div class="couts">${couts(b.cout)}</div><div class="meta">${metaBat(b)}</div></div>`;
  }
  return h + `</div><p class="mini" style="margin-top:10px">Capitale : <b>${nomNiveau(J.etat.joueur.niveau_capitale)}</b> · ${J.etat.epoque.nom}. Les travaux avancent d'un mois à chaque tour.</p>`;
}

// --- fiche d'une case
const NOM_T = ['🌊 Océan', '🌊 Haut-fond', '💧 Lac', '🏖️ Plage', '🌿 Plaine', '⛰️ Colline', '🏔️ Montagne'];
const connue = i => !!J.etat.explore?.[i];
const ligne = (k, v) => `<div class="ligne"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const virgule = x => String(x).replace('.', ',');
const lieuDe = i => { const v = J.etat.villes.find(x => x.case === i); return v ? '🏰 ' + e(v.nom) : NOM_T[J.carte.terrain[i]]; };
// tout ce qui se trouve sur une case (le brouillard est déjà appliqué par le moteur)
export function surCase(i) {
  const E = J.etat;
  return { armees: E.armees.filter(x => x.case === i), flottes: E.flottes.filter(x => x.case === i), espions: E.espions.filter(x => x.case === i), fort: E.forts.find(x => x.case === i), siege: E.sieges.find(x => x.case === i), batiment: E.batiments.find(x => x.case === i) };
}
export function titreCase(i) {
  const E = J.etat, b = E.batiments.find(x => x.case === i), f = E.forts.find(x => x.case === i);
  if (!connue(i)) return '❔ Terre inconnue';
  if (b) { const v = b.cle === 'hotel' && E.villes.find(x => x.case === i); return v ? `🏰 ${e(v.nom)}` : `${bat(b.cle).icone} ${e(bat(b.cle).nom)}`; }
  if (f) return `${f.icone || '🏗️'} ${e(majuscule(f.lieu || f.nom))}`;
  return NOM_T[J.carte.terrain[i]];
}
const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1);
export function vueCase(i) {
  const E = J.etat, C = J.carte, j = E.joueur;
  if (!connue(i)) return `<div class="boite"><div class="mini">Aucun de vos sujets n'a encore exploré ces terres : on n'en sait rien et l'on ne peut rien y bâtir. Envoyez-y une armée, un navire ou un espion pour les découvrir.</div></div>`;
  const o = surCase(i), b = o.batiment, pr = E.cases.proprio[i];
  let h = E.visible?.[i] ? '' : `<div class="mini brume">👁️ Hors de vue : dernier état connu.</div>`;
  h += `<div class="boite">${ligne('Terrain', `${NOM_T[C.terrain[i]]}${C.riviere[i] ? ' · rivière' : ''}${C.fertile[i] ? ' · fertile' : ''}`)}`;
  if (C.gisement[i]) h += ligne('Gisement', { pierre: '🪨 Pierre', fer: '⛏️ Fer', or: '💰 Or', charbon: '⚫ Charbon' }[C.gisement[i]]);
  if (C.poissons[i]) h += ligne('Ressource', '🐟 Banc de poissons');
  if (E.cases.foret[i]) h += ligne('Bois sur pied', `🪵 ${E.cases.bois[i]}`);
  h += ligne('Territoire', pr >= 0 ? pastille(pr) + e(roy(pr).nom) : 'Terres libres') + '</div>';
  if (o.siege) h += vueSiege(o.siege);
  if (o.fort) h += vueFort(o.fort);
  for (const a of o.armees) {
    h += `<div class="boite"><h4>${pastille(a.proprio)}${a.proprio === 0 ? 'Votre armée' : 'Armée — ' + e(roy(a.proprio).nom)} · ${a.effectif} soldats</h4><div class="mini">${unitesTexte(a.unites)}${a.retranche ? ` · ${retranche(a.retranche)}` : ''}</div>${a.proprio === 0 ? `<div class="btns"><button class="btn" data-a="armee" data-v="${a.id}">Commander</button></div>` : ''}</div>`;
  }
  for (const f of o.flottes) {
    h += `<div class="boite"><h4>${pastille(f.proprio)}${f.proprio === 0 ? 'Votre flotte' : 'Flotte — ' + e(roy(f.proprio).nom)}</h4><div class="mini">${unitesTexte(f.navires)}${f.armee ? ` · 🎖️ ${f.armee.effectif} soldats à bord` : ''}</div>${f.proprio === 0 ? `<div class="btns"><button class="btn" data-a="flotte" data-v="${f.id}">Commander</button></div>` : ''}</div>`;
  }
  for (const x of o.espions) {
    h += x.proprio === 0 ? `<div class="boite"><h4>🕵️ Votre espion</h4><div class="mini">${ordresEspion(x)}</div><div class="btns"><button class="btn" data-a="espion" data-v="${x.id}">Commander</button></div></div>`
      : `<div class="boite"><h4>🕵️ Espion démasqué — ${pastille(x.proprio)}${e(roy(x.proprio).nom)}</h4><div class="mini">Vos gardes l'ont repéré.</div></div>`;
  }
  if (!b) {
    if (pr === 0 && C.terrain[i] >= 3 && C.terrain[i] !== 6 && !o.fort) h += `<div class="mini">Choisissez un bâtiment dans 🏗️ Construire pour voir où le poser.</div>`;
    return h;
  }
  const d = bat(b.cle), mien = b.proprio === 0;
  if (b.cle === 'hotel') return h + vueVille(E.villes.find(v => v.case === i));
  if (b.reste > 0) {
    const f = 1 - b.reste / Math.max(1, d.duree);
    return h + `<div class="boite"><h4>🏗️ En construction</h4><div class="jauge"><i style="width:${Math.round(f * 100)}%"></i></div><div class="mini" style="margin-top:4px">${b.reste} mois restant(s)</div></div>` + (mien ? `<div class="btns"><button class="btn rouge" data-a="demolir" data-c="${i}">Annuler (50 % remboursés)</button></div>` : '');
  }
  h += `<div class="boite"><div class="mini" style="margin-bottom:5px">${e(d.desc)}</div>`;
  // arrêté : pillé ou saboté (b.arret), ou faubourg d'une ville assiégée (hors de l'enceinte)
  const faubourg = E.sieges.some(s => s.faubourgs.some(x => x.id === b.id && !x.pille));
  if (b.arret) h += ligne('État', `<span style="color:#f98">🔥 Endommagé : remis en état dans ${b.arret - E.tour} mois</span>`);
  else if (faubourg) h += ligne('État', `<span style="color:#f98">⛔ Arrêté : faubourg d'une ville assiégée</span>`);
  if (!mien) return h + ligne('Propriétaire', pastille(b.proprio) + e(roy(b.proprio).nom)) + '</div>';
  if (d.ouvriers) h += ligne('Ouvriers', `👷 ${b.ouvriers}/${d.ouvriers}`);
  if (b.etat) h += ligne('Ce mois', e(b.etat));
  if (d.logement) h += ligne('Logements', `👥 ${d.logement}`);
  if (d.saison) h += ligne('Saison', `${['Hiver', 'Printemps', 'Été', 'Automne'][E.saison]} · météo ×${E.meteo.cultures.toFixed(2)}`);
  // la halle et l'école : leurs effets du moment (jour de marché, vacances, ateliers de la ville)
  const vb = E.villes.find(x => x.id === b.ville);
  const rouge = t => `<span style="color:#f98">${t}</span>`;
  if (b.cle === 'marche' && vb) h += ligne('Marché', !E.jour_marche ? `Prochain jour de marché : ${prochainMarche()}` : vb.jour_marche ? `🧺 Jour de marché ce mois-ci : impôts +${Math.round(R().jour_marche.impots * 100)} %, bonheur +${R().jour_marche.bonheur}` : vb.assiegee || vb.blocus ? rouge('Pas de marché : la ville est assiégée ou bloquée') : j.famine ? rouge(`Marché déserté : la disette (bonheur ${R().jour_marche.disette})`) : rouge('Pas de marché : la halle manque d\'ouvriers'));
  if (b.cle === 'ecole' && vb) h += ligne('Effets', `${E.saison === 2 ? `🏖️ Vacances : savoir ÷${Math.round(1 / R().ecoles.ete)} · ` : ''}ateliers de ${e(vb.nom)} +${Math.round((vb.ateliers || 0) * 100)} %`);
  h += '</div>';
  if ((d.unites || []).length) {
    h += `<div class="boite"><h4>Recrutement (2 par mois)</h4>`;
    const ok = j.unites_dispo[b.cle] || [];
    for (const u of d.unites) {
      const ud = unite(u), prix = j.prix_unites?.[u] || ud.cout;
      if (!ok.includes(u)) continue;
      const stats = ud.genre === 'espion' ? '🚶' + ud.vitesse : `⚔${ud.att} 🛡${ud.def}${ud.siege ? ' · siège ×' + ud.siege : ''}${ud.transport ? ' · ⛵' + ud.transport + ' soldats' : ''} · ${ud.genre === 'marine' ? '🧭' : '🚶'}${ud.vitesse}`;
      h += `<div class="ligne"><span>${ud.icone} <b>${e(ud.nom)}</b> <span class="mini">${stats}</span><br><span class="couts" style="display:inline-flex">${couts(prix)}</span></span><button class="btn" data-a="recruter" data-b="${b.id}" data-v="${u}" ${peutPayer(prix) ? '' : 'disabled'}>Recruter</button></div>`;
    }
    const verrou = d.unites.filter(u => !ok.includes(u)).map(u => unite(u)).filter(Boolean);
    if (verrou.length) h += `<div class="mini">🔒 Plus tard : ${verrou.map(u => u.icone + ' ' + e(u.nom)).join(', ')}</div>`;
    h += `<div class="mini">File : ${b.file.map(u => unite(u).icone).join(' ') || 'vide'}${b.cle === 'port' ? ' · les navires sortent au mouillage, à côté du port' : ''}</div></div>`;
  }
  return h + `<div class="btns">${d.ouvriers ? `<button class="btn b2" data-a="pause" data-v="${b.id}">${b.pause ? '▶ Reprendre' : '⏸ Pause'}</button>` : ''}<button class="btn rouge" data-a="demolir" data-c="${i}">🗑 Démolir</button></div>`;
}
function vueVille(v) {
  const E = J.etat;
  let h = `<div class="boite">${ligne('Rang', `${v.niveau} · ${e(v.rang)}${v.capitale ? ' 👑' : ''}`)}${ligne('Royaume', pastille(v.proprio) + e(roy(v.proprio).nom))}${ligne('Défense', `🛡 ${v.defense}${v.murs ? ` · 🧱 murs ${v.murs}` : ''}`)}${ligne('Fortifications', e(v.fortif_nom))}${ligne('Rayon du territoire', `${2 + v.niveau} cases`)}${v.assiegee ? ligne('Situation', '<span style="color:#f98">🏰 Assiégée</span>') : ''}${v.blocus ? ligne('Port', '<span style="color:#f98">⚓ Bloqué : plus de commerce par mer</span>') : ''}${v.jour_marche ? ligne('Marché', '🧺 Jour de marché ce mois-ci') : ''}${v.eclairage ? ligne('La nuit', '🏮 Réverbères allumés') : ''}`;
  if (v.proprio === 0) {
    const ec = R().ecoles;
    h += ligne('Écoles', v.ecoles ? `📚 ${v.ecoles} · ateliers +${Math.round(v.ateliers * 100)} %${E.saison === 2 ? ' · vacances' : ''}` : v.ignorance ? `<span style="color:#f98">Aucune : l'ignorance (−${ec.ignorance_savoir} 💡, −${ec.ignorance_bonheur} 😊 par mois)</span>` : 'Aucune');
  }
  h += '</div>';
  if (v.proprio === 0) {
    const nx = R().niveaux.find(n => n.niveau === v.niveau + 1);
    if (nx) {
      const ok = E.joueur.pop >= nx.pop && peutPayer(nx.cout) && (v.capitale || v.niveau < E.joueur.niveau_capitale);
      h += `<div class="boite"><h4>⬆️ Passer au rang ${e(nx.nom)}</h4><div class="ligne"><span class="k">Habitants</span><span class="v" style="color:${E.joueur.pop >= nx.pop ? '#8f8' : '#f98'}">${E.joueur.pop}/${nx.pop}</span></div><div class="couts">${couts(nx.cout)}</div><div class="mini" style="margin-top:4px">Débloque des bâtiments et agrandit le territoire.</div><div class="btns"><button class="btn" data-a="ameliorer" data-v="${v.id}" ${ok ? '' : 'disabled'}>Améliorer</button></div></div>`;
    } else h += `<div class="boite"><h4>🌟 Rang maximal</h4></div>`;
    const fs = v.fortif_suivante;
    h += `<div class="boite"><h4>🏰 Fortifications : ${e(v.fortif_nom)}</h4>`;
    if (v.travaux_fortif) h += `<div class="mini">🏗️ Travaux en cours : encore ${v.travaux_fortif} mois.</div>`;
    h += `<div class="mini">${v.enceinte.length ? `Enceinte : ${v.enceinte.length} case(s) à l'abri des murs ; les autres bâtiments de la ville sont des faubourgs, arrêtés et pillés pendant un siège.` : v.fortif ? 'Les murs ne protègent que la mairie : pendant un siège, les autres bâtiments de la ville (faubourgs) sont arrêtés et pillés.' : 'Ville ouverte : un ennemi la prend d\'une seule bataille.'}</div>`;
    if (fs) {
      h += `<div class="ligne"><span>${fs.icone} <b>${e(fs.nom)}</b> <span class="mini">murs ${fs.murs} · défense ×${virgule(fs.defense)} · ⏳ ${fs.duree} mois</span></span></div><div class="couts">${couts(fs.cout)}</div>
      <div class="btns"><button class="btn" data-a="fortifier" data-v="${v.id}" ${fs.possible ? '' : 'disabled'}>${fs.icone} Fortifier : ${e(fs.nom)}</button></div>${fs.verrou ? `<div class="mini">🔒 ${e(fs.verrou)}</div>` : fs.possible ? '' : '<div class="mini">Ressources insuffisantes.</div>'}`;
    } else h += `<div class="mini">🌟 Fortifications au niveau maximal.</div>`;
    h += '</div>';
    // l'éclairage public : un réglage de la ville, payé chaque mois
    const l = R().eclairage;
    h += `<div class="boite"><h4>🏮 Éclairage public : ${v.eclairage ? 'allumé' : 'éteint'}</h4><div class="mini">Réverbères et veilleur de nuit : ${l.entretien} 🪙 par mois, risque d'incendie ×${virgule(l.incendie)}, +${l.bonheur} de bonheur.${v.delinquance ? ` <span style="color:#f98">Sans éclairage, la délinquance coûte ${Math.round(l.delinquance * 100)} % d'impôts.</span>` : ''}</div>
    <div class="btns"><button class="btn" data-a="eclairer" data-v="${v.id}" data-s="${v.eclairage ? 0 : 1}" ${v.eclairage || !v.eclairage_verrou ? '' : 'disabled'}>🏮 ${v.eclairage ? 'Éteindre les réverbères' : 'Allumer les réverbères'}</button></div>${!v.eclairage && v.eclairage_verrou ? `<div class="mini">🔒 ${e(v.eclairage_verrou)}</div>` : ''}</div>`;
  } else {
    const r = roy(v.proprio);
    h += `<div class="boite"><h4>Relations</h4>${relation(r)}<div class="btns"><button class="btn b2" data-a="menu" data-v="diplomatie">🤝 Diplomatie</button></div></div>`;
  }
  return h;
}
const unitesTexte = u => Object.entries(u).filter(([, n]) => n > 0).map(([k, n]) => `${unite(k)?.icone || ''} ${n} ${e(unite(k)?.nom || k)}`).join(' · ') || '—';

// --- sièges : la même fiche pour l'assiégeant et l'assiégé
function vueSiege(s) {
  const E = J.etat, moi = s.assiegeant === 0, defend = s.proprio === 0, rs = R().siege;
  const nom = e(s.nom || '?'), qui = e(roy(s.assiegeant).nom);
  const titre = moi ? `⚔️ Vous assiégez ${nom}` : defend ? `🏰 ${majuscule(nom)} assiégé${s.fort ? '' : 'e'} par ${qui}` : `🏰 Siège de ${nom} par ${qui}`;
  const soldats = s.armees.reduce((t, id) => t + (E.armees.find(a => a.id === id)?.effectif || 0), 0);
  const faim = s.vivres > 0 ? `🍞 ${Math.ceil(s.vivres)} mois de vivres` : `<span style="color:#f98">💀 Famine : ${s.faim}/${rs.reddition_faim} mois avant la reddition</span>`;
  let h = `<div class="boite siege"><h4>${titre}</h4>
    ${ligne('Durée', `${s.mois} mois`)}
    <div class="ligne"><span class="k">Murs</span><span class="v">🧱 ${Math.round(s.murs)}/${Math.round(s.murs_max)} (${s.murs_pct} %)${s.murs <= 0 ? ' · brèche ouverte !' : ''}</span></div><div class="jauge murs"><i style="width:${s.murs_pct}%"></i></div>
    ${ligne('Vivres de la place', faim)}
    ${ligne('Garnison', `🛡 ${s.garnison} soldats`)}${ligne('Assiégeants', `⚔ ${soldats || '?'} soldats`)}
    ${ligne('Assaut', `${s.force_assaut} contre ${s.defense_assaut} · ~${s.chance_assaut} % de réussite`)}`;
  // faubourgs : tous arrêtés ; on nomme ceux qui ont été pillés
  const pilles = s.faubourgs.filter(f => f.pille);
  if (s.faubourgs.length) h += `<div class="mini" style="margin-top:4px">Faubourgs hors les murs : ⛔ ${s.faubourgs.length - pilles.length} arrêté(s)${pilles.length ? ` · 🔥 pillé(s) : ${pilles.map(f => `<span class="faub pille">${bat(f.cle)?.icone || ''} ${e(bat(f.cle)?.nom || f.cle)}</span>`).join(' ')}` : ''}</div>`;
  if (s.pillage) h += `<div class="mini">🔥 Dernier pillage : ${e(s.pillage.nom || s.pillage.batiment)}.</div>`;
  if (moi) {
    h += s.assaut ? `<div class="mini" style="color:#ffd56b;margin-top:4px">⚔️ Assaut ordonné : il sera donné à la fin du mois.</div>`
      : `<div class="btns"><button class="btn rouge" data-a="assaut" data-v="${s.ville}">⚔️ Donner l'assaut</button></div><div class="mini">Chaque mois, le canon et la sape usent les murs et la faim gagne la garnison : la place se rend d'elle-même. Un assaut va plus vite, mais coûte cher s'il échoue.</div>`;
  } else if (defend) h += `<div class="mini" style="margin-top:4px">Tenez bon : quand les vivres manquent, la place se rend. Envoyez une armée de secours chasser les assiégeants, ou faites la paix.</div>`;
  return h + '</div>';
}
async function assaut(id) {
  const s = J.etat.sieges.find(x => x.ville === id && x.assiegeant === 0);
  if (!s) return;
  const oui = await modale('⚔️ Donner l\'assaut ?', `<p>Vos troupes monteront à l'assaut de <b>${e(s.nom)}</b> à la fin du mois : forces <b>${s.force_assaut}</b> contre <b>${s.defense_assaut}</b>, environ <b>${s.chance_assaut} %</b> de réussite.</p><p>Les murs tiennent encore à ${s.murs_pct} %. Un assaut repoussé coûte beaucoup d'hommes : attendre la brèche, ou que la faim fasse son œuvre, est plus sûr.</p>`, [{ l: '⚔️ À l\'assaut !', c: 'rouge', v: true }, { l: 'Attendre', c: 'b2', v: false }]);
  if (!oui) return;
  const r = await A.cmd(s.fort ? { action: 'assaut', fort: s.ville } : { action: 'assaut', ville: s.ville });
  annonce(r.ok ? r.msg : '❌ ' + r.msg, r.ok ? 'bon' : 'guerre');
  rafraichir();
}

// --- forts d'armée
function vueFort(f) {
  const mien = f.proprio === 0, n = f.suivant;
  let h = `<div class="boite"><h4>${f.icone || '🏗️'} ${e(f.nom)}${f.lieu ? ` — ${e(f.lieu)}` : ''}</h4>${ligne('Royaume', pastille(f.proprio) + e(roy(f.proprio).nom))}${f.niveau ? ligne('Niveau', `${f.niveau}/3 · 🧱 murs ${f.murs} · défense ×${virgule(f.defense)}`) : ''}${ligne('Garnison', f.garnison ? '🛡 Une armée tient le fort' : '<span style="color:#f98">Aucune armée</span>')}`;
  if (f.travaux) h += ligne('Travaux', `🏗️ encore ${f.travaux} mois${f.suspendu ? ' <span style="color:#f98">· suspendus</span>' : ''}`);
  if (f.suspendu) h += `<div class="mini">Les travaux n'avancent que si une de vos armées garde la case, hors siège.</div>`;
  if (f.assiege) h += ligne('Situation', '<span style="color:#f98">🏰 Assiégé</span>');
  if (mien && f.entretien) h += ligne('Entretien', `🪙 ${f.entretien}/mois`);
  if (mien && n) {
    h += `<div class="ligne"><span>${n.icone} <b>${e(n.nom)}</b> <span class="mini">murs ${n.murs} · défense ×${virgule(n.defense)} · 👁️${n.vision} · ⏳ ${n.duree} mois · 🪙${n.entretien}/mois</span></span></div><div class="couts">${couts(n.cout)}</div>
    <div class="btns"><button class="btn" data-a="amfort" data-v="${f.id}" ${n.possible ? '' : 'disabled'}>${n.icone} Améliorer : ${e(n.nom)}</button></div>${n.verrou ? `<div class="mini">🔒 ${e(n.verrou)}</div>` : n.possible ? '' : '<div class="mini">Ressources insuffisantes.</div>'}`;
  } else if (mien && f.niveau >= 3) h += `<div class="mini">🌟 Fort au niveau maximal.</div>`;
  return h + '</div>';
}

// --- armées
const retranche = r => (r === 'pret' ? `🛡️ retranchée (défense ×${virgule(R().retranchement.defense)})` : '⛏️ se retranche (prête le mois prochain)');
// l'armée peut-elle monter sur la flotte ? (sur la côte voisine, ou dans la ville de son port) — le moteur tranche
function accostable(a, f) {
  const E = J.etat, pres = c => c === f.case || voisins(c).includes(f.case);
  if (J.carte.terrain[a.case] >= 3 && pres(a.case)) return true;
  const v = E.villes.find(x => x.case === a.case);
  return !!v && E.batiments.some(b => b.cle === 'port' && b.proprio === 0 && !b.reste && b.ville === v.id && pres(b.case));
}
export function vueArmee(id) {
  const E = J.etat, a = E.armees.find(x => x.id === id);
  if (!a) return null;
  const eau = J.carte.terrain[a.case] < 3, s = E.sieges.find(x => x.case === a.case && x.assiegeant === 0);
  const ordres = eau ? '⚓ Débarque à la fin du mois' : a.chemin.length ? `🚶 En marche : ${a.chemin.length} cases, ~${a.mois} mois` : s ? '🏰 Assiège la place' : '⛺ Stationnée';
  let h = `<div class="boite">${ligne('Position', lieuDe(a.case))}${ligne('Effectif', `${a.effectif} soldats`)}${ligne('Puissance', `⚔ ${Math.round(a.att)} · 🛡 ${Math.round(a.def)}`)}${ligne('Ordres', ordres)}${a.retranche ? ligne('Retranchement', retranche(a.retranche)) : ''}<div class="mini" style="margin-top:4px">${unitesTexte(a.unites)}</div></div>`;
  if (s) h += vueSiege(s);
  const fort = E.forts.find(f => f.case === a.case && f.proprio === 0);
  if (fort) h += vueFort(fort);
  const flottes = E.flottes.filter(f => f.proprio === 0 && !f.armee && f.capacite > 0 && accostable(a, f));
  if (flottes.length) h += `<div class="boite"><h4>⛵ Embarquer</h4>${flottes.map(f => `<div class="ligne"><span>${unitesTexte(f.navires)} <span class="mini">· ${f.capacite} places</span></span><button class="btn" data-a="embarquer" data-f="${f.id}" data-v="${a.id}" ${a.effectif > f.capacite ? 'disabled' : ''}>Embarquer</button></div>${a.effectif > f.capacite ? '<div class="mini">Trop de soldats pour ces navires : divisez l\'armée.</div>' : ''}`).join('')}</div>`;
  if (!eau) {
    const fd = R().forts.niveaux[0];
    h += `<div class="boite"><h4>⛏️ Ouvrages de campagne</h4><div class="btns" style="margin-top:0"><button class="btn b2" data-a="retrancher" data-v="${a.id}" ${a.retrancher_verrou ? 'disabled' : ''}>⛏️ Se retrancher</button><button class="btn b2" data-a="fort" data-v="${a.id}" ${a.fort_verrou || !peutPayer(fd.cout) ? 'disabled' : ''}>${fd.icone} Construire un fort</button></div>
    <div class="mini" style="margin-top:4px">${a.retrancher_verrou ? '⛏️ ' + e(a.retrancher_verrou) : `⛏️ ${R().retranchement.duree} mois de travaux : défense ×${virgule(R().retranchement.defense)} tant que l'armée ne bouge pas.`}</div>
    <div class="mini">${fd.icone} ${e(fd.nom)} : <span class="couts" style="display:inline-flex;margin:0">${couts(fd.cout)}</span> · ⏳ ${fd.duree} mois · 🪙${fd.entretien}/mois${a.fort_verrou ? `<br>🔒 ${e(a.fort_verrou)}` : ''}</div></div>`;
  }
  return h + `<div class="btns"><button class="btn" data-a="deplacer" data-v="${a.id}">🚩 Donner une destination</button><button class="btn b2" data-a="diviser" data-v="${a.id}">✂️ Diviser</button><button class="btn b2" data-a="centrer" data-v="${a.id}">🎯</button>${a.chemin.length && !eau ? `<button class="btn rouge" data-a="halte" data-v="${a.id}">✋ Halte</button>` : ''}</div>
  <p class="mini">Les armées marchent à la fin du mois (neige : moitié moins vite, boue sous la pluie). Une armée sur une ville la défend ; sur une ville ennemie fortifiée, elle l'assiège. 🌊 Une armée ne marche pas sur l'eau : embarquez-la sur des flûtes marchandes (ou un navire à vapeur) depuis la côte ou la ville d'un port, puis débarquez-la.</p>`;
}

// --- flottes
export function vueFlotte(id) {
  const E = J.etat, f = E.flottes.find(x => x.id === id);
  if (!f) return null;
  const ordres = f.chemin.length ? `⛵ En mer : ${f.chemin.length} cases, ~${f.mois} mois` : f.commerce ? '⚖️ Commerce par mer' : '⚓ Au mouillage';
  let h = `<div class="boite">${ligne('Position', `${NOM_T[J.carte.terrain[f.case]]}${f.a_quai ? ' · à quai' : ''}`)}${ligne('Navires', unitesTexte(f.navires))}${ligne('Puissance', `⚔ ${Math.round(f.att)} · 🛡 ${Math.round(f.def)}${f.guerre ? '' : ' · sans navire de guerre'}`)}${ligne('Transport', f.capacite ? `🎖️ ${f.armee ? f.armee.effectif : 0}/${f.capacite} soldats` : 'aucun')}${ligne('Ordres', ordres)}</div>`;
  if (f.armee) h += `<div class="boite"><h4>🎖️ Armée à bord · ${f.armee.effectif} soldats</h4><div class="mini">${unitesTexte(f.armee.unites)}</div><div class="btns"><button class="btn" data-a="debarquer" data-v="${f.id}">⚓ Débarquer</button></div><div class="mini">Elle descend sur une case de terre voisine (pas une montagne) et touche terre à la fin du mois.</div></div>`;
  else if (f.capacite) {
    const armees = E.armees.filter(a => a.proprio === 0 && J.carte.terrain[a.case] >= 3 && accostable(a, f));
    h += `<div class="boite"><h4>⛵ Embarquer une armée</h4>${armees.map(a => `<div class="ligne"><span>${lieuDe(a.case)} · ${a.effectif} soldats</span><button class="btn" data-a="embarquer" data-f="${f.id}" data-v="${a.id}" ${a.effectif > f.capacite ? 'disabled' : ''}>Embarquer</button></div>`).join('') || '<div class="mini">Aucune armée à côté : amenez-en une sur la côte voisine, ou dans la ville du port.</div>'}${armees.some(a => a.effectif > f.capacite) ? `<div class="mini">${f.capacite} places : divisez les armées trop nombreuses.</div>` : ''}</div>`;
  } else h += `<div class="mini" style="margin-bottom:8px">Pour transporter une armée, il faut des flûtes marchandes ou un navire à vapeur.</div>`;
  if (f.flutes) h += `<div class="boite"><h4>⚖️ Commerce par mer</h4>${f.commerce ? `<div class="mini">Les flûtes commercent : le gain tombe à la fin du mois${E.joueur.commerce_mer ? ` (${Math.round(E.joueur.commerce_mer)} 🪙 le mois dernier, toutes flottes comprises)` : ''}. Un blocus ennemi l'arrête.</div><div class="btns"><button class="btn b2" data-a="commerce" data-v="${f.id}" data-s="0">Cesser le commerce</button></div>`
    : f.a_quai && !f.armee ? `<div class="btns"><button class="btn vert" data-a="commerce" data-v="${f.id}" data-s="1">⚖️ Commercer</button></div>` : '<div class="mini">Ramenez la flotte à quai, à côté d\'un de vos ports et sans armée à bord, pour commercer.</div>'}</div>`;
  return h + `<div class="btns"><button class="btn" data-a="naviguer" data-v="${f.id}">🧭 Naviguer</button>${f.chemin.length ? `<button class="btn rouge" data-a="mouiller" data-v="${f.id}" data-c="${f.case}">✋ Mouiller ici</button>` : ''}<button class="btn b2" data-a="viser" data-c="${f.case}">🎯</button></div>
  <p class="mini">Corvettes, frégates et vaisseaux livrent bataille aux flottes ennemies et bloquent leurs ports : un port bloqué ne commerce plus. La tempête cloue les navires au port. Entretien de la marine et des espions : ${Math.round(E.joueur.entretien_flotte || 0)} 🪙 par mois.</p>`;
}

// --- espions
function ordresEspion(x) {
  const m = R().espionnage.missions.find(k => k.cle === x.mission);
  return m ? `${m.icone} ${e(m.nom)} à ${e(x.nom_ville || '?')} : encore ${x.reste} mois` : x.chemin.length ? `🚶 En route : ${x.chemin.length} cases` : '👁️ Aux aguets';
}
export function vueEspion(id) {
  const E = J.etat, x = E.espions.find(k => k.id === id && k.proprio === 0);
  if (!x) return null;
  const academie = E.batiments.some(b => b.proprio === 0 && b.cle === 'academie' && !b.reste), M = R().espionnage;
  let h = `<div class="boite">${ligne('Position', lieuDe(x.case))}${ligne('Ordres', ordresEspion(x))}</div>`;
  if (!x.mission && !x.chemin.length) {
    h += `<div class="boite"><h4>🎯 Missions</h4>${x.missions.map(m => `<div class="ligne"><span>${m.icone} <b>${e(m.nom)}</b> · ${e(m.nom_ville)}<br><span class="mini">~${m.chance} % de réussite · ⏳ ${m.duree} mois</span></span><button class="btn" data-a="mission" data-v="${x.id}" data-g="${m.genre}" data-c="${m.ville}">Lancer</button></div>`).join('') || '<div class="mini">Menez l\'espion dans une ville étrangère, ou juste à côté, pour lui confier une mission.</div>'}
    <div class="mini" style="margin-top:4px">${M.missions.map(m => `${m.icone} ${e(m.desc)}`).join('<br>')}</div></div>`;
  }
  h += `<div class="mini" style="margin-bottom:6px">${academie ? `🎓 Votre académie forme vos agents : +${Math.round(M.academie * 100)} % de réussite.` : `🎓 Une Académie des sciences donnerait +${Math.round(M.academie * 100)} % de réussite.`} Les villes bien défendues démasquent plus souvent les espions : un espion pris est pendu et le royaume visé vous en veut.</div>`;
  return h + `<div class="btns">${x.mission ? '' : `<button class="btn" data-a="filer" data-v="${x.id}">🚶 Déplacer</button>`}${x.chemin.length ? `<button class="btn rouge" data-a="terrer" data-v="${x.id}" data-c="${x.case}">✋ Halte</button>` : ''}<button class="btn b2" data-a="viser" data-c="${x.case}">🎯</button></div>`;
}

function vueArmees() {
  const E = J.etat, j = E.joueur, mien = E.armees.filter(a => a.proprio === 0), menaces = E.armees.filter(a => a.proprio !== 0 && estEnnemi(a.proprio) && a.chemin.length);
  let h = '';
  for (const s of E.sieges.filter(x => x.assiegeant === 0 || x.proprio === 0)) h += `<div class="boite" style="border-color:${s.proprio === 0 ? '#c0392b' : '#c8932f'}"><div class="ligne"><span>${s.assiegeant === 0 ? '⚔️ Vous assiégez' : `🏰 ${pastille(s.assiegeant)}${e(roy(s.assiegeant).nom)} assiège`} <b>${e(s.nom || '?')}</b> · ${s.mois} mois · murs ${s.murs_pct} %</span><button class="btn b2" data-a="case" data-c="${s.case}">Voir</button></div></div>`;
  h += mien.length ? '' : '<p class="mini">Aucune armée. Construisez une Caserne pour recruter.</p>';
  for (const a of mien) {
    h += `<div class="boite"><h4>${lieuDe(a.case)} · ${a.effectif} soldats</h4><div class="mini">${unitesTexte(a.unites)}</div><div class="mini">${a.chemin.length ? `🚶 En marche (~${a.mois} mois)` : a.assiege ? '🏰 Assiège' : 'Stationnée'}${a.retranche ? ' · ' + retranche(a.retranche) : ''} · ⚔ ${Math.round(a.att)} 🛡 ${Math.round(a.def)}</div><div class="btns"><button class="btn" data-a="armee" data-v="${a.id}">Commander</button><button class="btn b2" data-a="centrer" data-v="${a.id}">🎯</button></div></div>`;
  }
  const flottes = E.flottes.filter(f => f.proprio === 0), espions = E.espions.filter(x => x.proprio === 0), forts = E.forts.filter(f => f.proprio === 0);
  if (flottes.length) h += `<div class="boite"><h4>⛵ Flottes</h4>${flottes.map(f => `<div class="ligne"><span>${unitesTexte(f.navires)}${f.armee ? ` · 🎖️ ${f.armee.effectif}` : ''}<br><span class="mini">${f.chemin.length ? `En mer (~${f.mois} mois)` : f.commerce ? '⚖️ Commerce' : 'Au mouillage'}</span></span><button class="btn" data-a="flotte" data-v="${f.id}">Commander</button></div>`).join('')}</div>`;
  if (espions.length) h += `<div class="boite"><h4>🕵️ Espions</h4>${espions.map(x => `<div class="ligne"><span class="mini">${lieuDe(x.case)} · ${ordresEspion(x)}</span><button class="btn" data-a="espion" data-v="${x.id}">Commander</button></div>`).join('')}</div>`;
  if (forts.length) h += `<div class="boite"><h4>🛡️ Forts</h4>${forts.map(f => `<div class="ligne"><span>${f.icone || '🏗️'} ${e(f.nom)}${f.travaux ? ` <span class="mini">· travaux ${f.travaux} mois</span>` : ''}</span><button class="btn b2" data-a="case" data-c="${f.case}">Voir</button></div>`).join('')}</div>`;
  if (menaces.length) h += `<div class="boite" style="border-color:#c0392b"><h4>⚠️ Menaces en approche</h4>${menaces.map(a => { const fin = a.chemin[a.chemin.length - 1], v = E.villes.find(x => x.case === fin); return `<div class="ligne"><span>${pastille(a.proprio)}${e(roy(a.proprio).nom)} · ${a.effectif} soldats → ${v ? e(v.nom) : '?'} (~${a.mois} mois)</span><button class="btn b2" data-a="centrer" data-v="${a.id}">🎯</button></div>`; }).join('')}</div>`;
  return h + `<p class="mini">Solde : ${(j.soldats * 0.5).toFixed(0)} 🪙 par mois pour ${j.soldats} soldats · marine et espions ${Math.round(j.entretien_flotte || 0)} 🪙 · forts ${Math.round(j.entretien_forts || 0)} 🪙. Navires au Port, espions à la Taverne.</p>`;
}
let partage = {};
async function diviser(id) {
  const a = J.etat.armees.find(x => x.id === id);
  if (!a) return;
  partage = {};
  for (const u in a.unites) partage[u] = Math.floor(a.unites[u] / 2);
  const html = `<p>Unités de la nouvelle armée :</p>${Object.keys(a.unites).map(u => `<div class="ligne"><span>${unite(u).icone} ${e(unite(u).nom)} <span class="mini">(${a.unites[u]})</span></span><span class="pas"><button data-u="${u}" data-d="-1">−</button><b id="pt_${u}">${partage[u]}</b><button data-u="${u}" data-d="1">+</button></span></div>`).join('')}`;
  const p = modale('✂️ Diviser l\'armée', html, [{ l: 'Former', v: true }, { l: 'Annuler', c: 'b2', v: false }]);
  setTimeout(() => document.querySelectorAll('#modale-boite .pas button').forEach(b => (b.onclick = () => { const u = b.dataset.u; partage[u] = Math.max(0, Math.min(a.unites[u], partage[u] + +b.dataset.d)); document.getElementById('pt_' + u).textContent = partage[u]; })), 20);
  if (!await p) return;
  const r = await A.cmd({ action: 'diviser', armee: id, unites: partage });
  if (!r.ok) return annonce('❌ ' + r.msg, 'guerre');
  annonce(r.msg, 'bon');
  A.choisirArmee(r.armee);
  A.modeDeplacer(r.armee);
}

// --- diplomatie
let marcheDe = null;
function relation(r) { const p = (r.relation + 100) / 2; return `<div class="relation"><i style="left:calc(${p}% - 2px)"></i></div><div class="mini">Relation : <b>${Math.round(r.relation)}</b> · ${e(r.caractere)}</div>`; }
// la diplomatie du moteur (ia_diplomatie.rs) : souverains, traités entre royaumes, coalitions, mémoire
const TRAITS = [['agressivite', '⚔️ Agressivité'], ['fidelite', '🤝 Fidélité'], ['avidite', '💰 Avidité'], ['prudence', '🛡️ Prudence']];
const points = v => '●'.repeat(Math.round(v * 5)) + '○'.repeat(5 - Math.round(v * 5));
const noms = ids => ids.map(i => `${pastille(i)}${e(roy(i).nom)}`).join(', ');
function trahison(r) {
  if (r.statut === 'alliance') return '<b>C\'est votre allié</b> : rompre l\'alliance par la guerre est une trahison dont tous se souviendront.';
  if (r.diplo?.treve) return `<b>Une trêve court encore ${r.diplo.treve} mois</b> : la rompre est une trahison dont tous se souviendront.`;
  return '';
}
const TITRE_PROPOSITION = { echange: '⚖️ Échange', alliance: '🤝 Alliance', paix: '🕊️ Paix', tribut: '💰 Ultimatum', marchand: '🧳 Colporteur', aide: '🆘 Demande d\'aide' };
function vuePropositions(E) {
  const ps = E.propositions || [];
  if (!ps.length) return '';
  return `<div class="boite propositions"><h4>✉️ Propositions en attente</h4>${ps.map(p => `<div class="evt">${p.de > 0 ? pastille(p.de) : ''}<b>${p.manche ? '↩️ Contre-proposition' : TITRE_PROPOSITION[p.genre] || 'Proposition'}</b> · ${e(p.texte)}
    <div class="btns"><button class="btn vert" data-a="repondre" data-v="${p.id}" data-s="1">${p.genre === 'tribut' ? 'Payer' : p.genre === 'aide' ? '⚔️ Entrer en guerre' : 'Accepter'}</button><button class="btn ${p.genre === 'tribut' ? 'rouge' : 'b2'}" data-a="repondre" data-v="${p.id}" data-s="0">${p.genre === 'tribut' ? 'Refuser' : 'Décliner'}</button></div></div>`).join('')}
    <div class="mini">Sans réponse à la fin du mois, une proposition est refusée.</div></div>`;
}
function vueCoalitions(E) {
  return (E.coalitions || []).map(c => `<div class="boite coalition"><h4>⚔️ Coalition contre ${c.cible === 0 ? 'vous' : pastille(c.cible) + e(roy(c.cible).nom)}</h4><div class="mini">${noms(c.membres)} · depuis ${Math.max(0, E.tour - c.depuis)} mois</div></div>`).join('');
}
function vueSouverain(r) {
  const d = r.diplo || {}, s = d.souverain;
  if (!d.connu) return '<div class="mini">❔ Royaume pas encore rencontré : son souverain et ses alliances vous sont inconnus.</div>';
  let h = s ? `<div class="mini">👑 <b>${e(s.nom)}</b> · ${e(s.caractere)} · ${s.age} ans · règne depuis ${s.regne ? s.regne + ' an' + (s.regne > 1 ? 's' : '') : 'peu'}</div><div class="traits">${TRAITS.map(([k, n]) => `<span>${n} <b>${points(s.traits[k])}</b></span>`).join('')}</div>` : '';
  const liens = [d.guerres?.length && `⚔️ en guerre contre ${noms(d.guerres)}`, d.allies?.length && `🤝 allié de ${noms(d.allies)}`, d.routes?.length && `🛤️ commerce avec ${noms(d.routes)}`].filter(Boolean);
  if (liens.length) h += `<div class="mini">${liens.join(' · ')}</div>`;
  if (d.coalition) h += `<div class="mini" style="color:#f98">⚔️ Une coalition le combat : ${noms(d.coalition)}</div>`;
  if (d.souvenir) h += `<div class="mini souvenir">« ${e(d.souvenir)} »</div>`;
  return h;
}
function vueDiplomatie() {
  const E = J.etat;
  if (marcheDe != null) return vueMarche(roy(marcheDe));
  const P = E.royaumes[0].puissance, com = E.joueur.comptoir || E.joueur.port;
  let h = `<p class="mini">Votre puissance : <b>${P}</b>. ${com ? '⚖️ Commerce possible.' : 'Construisez un Comptoir de commerce pour commercer.'}</p>` + vuePropositions(E) + vueCoalitions(E);
  // vos ennemis : un allié peut entrer en guerre contre eux à vos côtés
  const ennemis = E.royaumes.filter(x => !x.joueur && x.vivant && x.statut === 'guerre');
  for (const r of E.royaumes.filter(x => !x.joueur)) {
    if (!r.vivant) { h += `<div class="boite" style="opacity:.5"><h4>${pastille(r.id)}${e(r.nom)}</h4><div class="mini">☠️ Anéanti</div></div>`; continue; }
    const villes = E.villes.filter(v => v.proprio === r.id), d = r.diplo || {};
    const statut = r.statut === 'paix' && d.treve ? `🕊️ Trêve ${d.treve} mois` : STATUT[r.statut] || r.statut;
    const aides = r.statut === 'alliance' ? ennemis.filter(x => x.id !== r.id && !(d.guerres || []).includes(x.id)) : [];
    h += `<div class="boite"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><h4 style="margin:0">${pastille(r.id)}${e(r.nom)}</h4><span class="statut ${r.statut}">${statut}</span></div>${vueSouverain(r)}${relation(r)}
    <div class="mini">🏰 ${villes.map(v => `${e(v.nom)} (${v.niveau})`).join(', ')} · 👥 ~${r.population} · ⚔ ${r.puissance}${r.puissance > P * 1.3 ? ' <span style="color:#f98">(plus fort)</span>' : r.puissance < P * 0.7 ? ' <span style="color:#8f8">(plus faible)</span>' : ''} · 💡 ${r.techs} techs${r.commerce ? ' · 🛤️ route' : ''}</div>
    <div class="mini">Vend bon marché : ${r.surplus.map(x => res(x).icone).join(' ') || '—'} · Achète cher : ${r.demande.map(x => res(x).icone).join(' ') || '—'}</div>
    <div class="btns"><button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="cadeau">🎁 Cadeau 100🪙</button>
    ${r.statut === 'guerre' ? `<button class="btn vert" data-a="diplo" data-r="${r.id}" data-v="paix">🕊️ Paix</button><button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="paix_ville">🏰 Paix contre une ville</button><button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="paix_or">💰 Paix contre réparations</button>` : `<button class="btn rouge" data-a="diplo" data-r="${r.id}" data-v="guerre">⚔️ Guerre</button>`}
    ${r.statut !== 'guerre' && r.statut !== 'alliance' ? `<button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="alliance">🤝 Alliance</button>` : ''}
    ${r.statut === 'alliance' ? `<button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="rompre">💔 Rompre</button>` : ''}
    ${aides.map(x => `<button class="btn" data-a="aide" data-r="${r.id}" data-c="${x.id}">🆘 Son aide contre ${e(x.nom)}</button>`).join('')}
    ${r.statut !== 'guerre' && !r.commerce ? `<button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="route">🛤️ Route 150🪙</button>` : ''}
    ${r.statut !== 'guerre' ? `<button class="btn" data-a="marche" data-r="${r.id}">⚖️ Marché</button>` : ''}
    <button class="btn b2" data-a="diplo" data-r="${r.id}" data-v="tribut">💰 Tribut</button></div></div>`;
  }
  return h;
}
function vueMarche(r) {
  const E = J.etat;
  let h = `<div class="btns" style="margin-bottom:8px"><button class="btn b2" data-a="retour">← Retour</button></div><div class="mini" style="margin-bottom:6px">${pastille(r.id)}<b>${e(r.nom)}</b> · trésor ${r.tresor} 🪙 · lots de 10</div>`;
  if (!E.joueur.comptoir && !E.joueur.port) return h + '<p>Il vous faut un <b>Comptoir de commerce</b> ou un <b>Port</b>.</p>';
  for (const [k, [achat, vente]] of Object.entries(r.prix)) {
    const tag = r.surplus.includes(k) ? ' 🟢' : r.demande.includes(k) ? ' 🔴' : '';
    h += `<div class="ligne"><span>${res(k).icone} ${e(res(k).nom)}${tag} <span class="mini">(${Math.floor(E.joueur.stock[k] || 0)})</span></span><span style="display:flex;gap:5px"><button class="btn b2" data-a="echange" data-r="${r.id}" data-v="${k}" data-s="1">Acheter ${achat}🪙</button><button class="btn" data-a="echange" data-r="${r.id}" data-v="${k}" data-s="0">Vendre +${vente}🪙</button></span></div>`;
  }
  return h + '<p class="mini">🟢 surplus (achat avantageux) · 🔴 demande (vente avantageuse). De bonnes relations améliorent les prix.</p>';
}

// --- royaume
let ongletRoyaume = 'apercu';
function vueRoyaume() {
  const E = J.etat, j = E.joueur, rv = j.revenus || {};
  let h = `<div class="onglets">${[['apercu', '👑 Aperçu'], ['sciences', '💡 Sciences'], ['stocks', '📦 Stocks'], ['victoire', '🏆 Victoire'], ['journal', '📜 Journal']].map(([k, n]) => `<button class="onglet ${ongletRoyaume === k ? 'on' : ''}" data-a="ktab" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (ongletRoyaume === 'apercu') {
    h += `<div class="boite"><h4>👥 Population</h4><div class="ligne"><span class="k">Habitants / logements</span><span class="v">${j.pop} / ${j.logement}</span></div><div class="ligne"><span class="k">Ouvriers libres</span><span class="v">👷 ${j.ouvriers_libres}</span></div><div class="ligne"><span class="k">Soldats</span><span class="v">🛡 ${j.soldats}</span></div><div class="ligne"><span class="k">Consommation</span><span class="v">🍽️ ${(j.pop * 0.3).toFixed(1)}/mois · variété ${j.variete}</span></div>${j.chauffage ? `<div class="ligne"><span class="k">Chauffage (ce mois)</span><span class="v">🪵 ${j.chauffage.toFixed(1)}${E.epoque.cle === 'industrie' ? ' (⚫ charbon d\'abord)' : ''}</span></div>` : ''}</div>`;
    h += `<div class="boite"><h4>${j.bonheur >= 60 ? '😊' : j.bonheur >= 35 ? '😐' : '😠'} Bonheur ${Math.round(j.bonheur)} %</h4>${(j.detail_bonheur || []).map(([k, v]) => `<div class="ligne"><span class="k">${e(k)}</span><span class="v" style="color:${v > 0 ? '#8f8' : v < 0 ? '#f98' : '#ccc'}">${v > 0 ? '+' : ''}${Math.round(v)}</span></div>`).join('') || '<div class="mini">Calculé à la fin du premier mois.</div>'}</div>`;
    h += `<div class="boite"><h4>🪙 Finances du mois</h4><div class="ligne"><span class="k">Impôts</span><span class="v">+${(rv.impots || 0).toFixed(0)}</span></div><div class="ligne"><span class="k">Routes commerciales</span><span class="v">+${(rv.commerce || 0).toFixed(0)}</span></div><div class="ligne"><span class="k">Commerce maritime</span><span class="v">+${(rv.commerce_mer || 0).toFixed(0)}</span></div><div class="ligne"><span class="k">Entretien</span><span class="v">−${(rv.entretien || 0).toFixed(0)}</span></div><div class="ligne"><span class="k">dont marine et espions · forts</span><span class="v">−${(j.entretien_flotte || 0).toFixed(0)} · −${(j.entretien_forts || 0).toFixed(0)}</span></div>${vieOr(j).length ? `<div class="ligne"><span class="k">Vie des villes</span><span class="v">${vieOr(j).join(' · ')}</span></div>` : ''}<div class="ligne"><span class="k">Taux d'imposition</span><span class="v btns" style="margin:0">${[['bas', 'Bas'], ['normal', 'Normal'], ['eleve', 'Élevé']].map(([k, n]) => `<button class="onglet ${j.impots === k ? 'on' : ''}" data-a="impots" data-v="${k}">${n}</button>`).join('')}</span></div></div>`;
    const rt = j.routes;
    h += `<div class="boite"><h4>🛤️ ${e(rt.nom)} (niveau ${rt.niveau}/3)</h4><div class="mini">${rt.segments} tronçons tracés tout seuls entre vos bâtiments et vos villes. ${['', 'Sentiers de terre battue.', 'Pavées : production +5 %, marches plus rapides.', 'Routes royales bordées d\'arbres : production +10 %, marches deux fois plus rapides.'][rt.niveau]}</div>${rt.cout ? `<div class="couts">${couts(rt.cout)}</div><div class="btns"><button class="btn" data-a="routes" ${rt.verrou || !peutPayer(rt.cout) ? 'disabled' : ''}>${rt.verrou ? '🔒 ' + e(rt.verrou) : rt.niveau === 1 ? 'Paver les routes' : 'Passer aux routes royales'}</button></div>` : ''}</div>`;
  } else if (ongletRoyaume === 'sciences') {
    const cours = j.recherche ? tech(j.recherche) : null;
    h += `<div class="boite"><div class="ligne"><span class="k">Savoir accumulé</span><span class="v">💡 ${Math.floor(j.savoir)} (+${j.savoir_mois.toFixed(1)}/mois)</span></div>${cours ? `<div class="mini">Recherche : <b>${e(cours.nom)}</b> — ${Math.floor(j.savoir)}/${cours.cout}</div><div class="jauge"><i style="width:${Math.min(100, j.savoir / cours.cout * 100)}%"></i></div>` : '<div class="mini">Choisissez une technologie : le savoir vient de la population, des écoles et des académies.</div>'}</div>`;
    for (const t of R().techs) {
      const a = j.techs.includes(t.cle), tot = E.annee < t.annee, enc = j.recherche === t.cle;
      h += `<div class="tech ${a ? 'acquise' : ''} ${enc ? 'en-cours' : ''}"><span><b>${a ? '✅' : tot ? '⏳' : '💡'} ${e(t.nom)}</b> <span class="mini">(${t.annee})</span><br><span class="mini">${e(t.desc)}</span></span>${a ? '' : tot ? `<span class="mini">dès ${t.annee}</span>` : enc ? '<span class="mini">en cours</span>' : `<button class="btn b2" data-a="tech" data-v="${t.cle}">${t.cout} 💡</button>`}</div>`;
    }
  } else if (ongletRoyaume === 'stocks') {
    h += `<div class="boite">${R().ressources.map(r => `<div class="ligne"><span>${r.icone} ${e(r.nom)}</span><span class="v">${Math.floor(j.stock[r.cle] || 0)}${r.cle === 'or' ? '' : ' / ' + Math.floor(j.capacite[r.cle])}${j.bilan[r.cle] ? ` <small style="color:${j.bilan[r.cle] > 0 ? '#8f8' : '#f98'}">${j.bilan[r.cle] > 0 ? '+' : ''}${Math.round(j.bilan[r.cle])}</small>` : ''}</span></div>`).join('')}</div><p class="mini">Entrepôts : +200 par ressource · Greniers : +300 de vivres. Les fermes ne produisent rien l'hiver : stockez !</p>`;
  } else if (ongletRoyaume === 'victoire') {
    const ais = E.royaumes.filter(r => !r.joueur), vivants = ais.filter(r => r.vivant);
    h += `<div class="boite"><h4>⚔️ Conquête</h4><div class="mini">Anéantir tous les rivaux : ${ais.length - vivants.length}/${ais.length}</div></div>
    <div class="boite"><h4>👑 Prospérité</h4><div class="mini">Capitale au rang Cité (${j.niveau_capitale}/5) · Palais royal ${E.batiments.some(b => b.proprio === 0 && b.cle === 'palais' && !b.reste) ? '✅' : '❌'} · 400 habitants (${j.pop})</div></div>
    <div class="boite"><h4>🤝 Diplomatie</h4><div class="mini">Alliance avec tous les survivants : ${vivants.filter(r => r.statut === 'alliance').length}/${vivants.length}</div></div>
    <div class="boite"><h4>⏳ 1850</h4><div class="mini">En décembre 1850, le royaume le plus puissant l'emporte.</div></div>`;
  } else h += `<div class="boite mini">${E.journal.map(l => `<div class="evt">${e(l)}</div>`).join('') || 'Rien à signaler.'}</div>`;
  return h;
}

// --- menu
function vueMenu() {
  return `<div class="btns" style="flex-direction:column">
    <button class="btn" data-a="menu" data-v="sauver">💾 Sauvegarder la partie</button>
    <button class="btn b2" data-a="menu" data-v="charger">📂 Charger une partie</button>
    <button class="btn b2" data-a="menu" data-v="nouvelle">🗺️ Nouvelle partie (régler la carte)</button>
    <button class="btn b2" data-a="menu" data-v="ombres">🌗 Ombres : ${J.ombres ? 'oui' : 'non'}</button>
    <button class="btn b2" data-a="menu" data-v="aide">❓ Comment jouer</button>
    <button class="btn b2" data-a="menu" data-v="reseau">📱 Jouer depuis un autre appareil</button></div>
    <p class="mini" style="margin-top:10px">Clavier : ZQSD / flèches = déplacer · E / R = tourner · Entrée = fin du mois · Échap = annuler. Version ${e(J.info?.version || '')}. ${e(J.info?.maj || '')}</p>`;
}

// --- météo
function panneauMeteo() {
  const E = J.etat, m = E.meteo;
  ouvrirFeuille(`${ICONE_METEO[m.genre]} ${E.date}`, () => `<div class="boite"><div class="ligne"><span class="k">Temps du mois</span><span class="v">${ICONE_METEO[m.genre]} ${NOM_METEO[m.genre]}</span></div><div class="ligne"><span class="k">Température</span><span class="v">${m.temperature.toFixed(1)} °C</span></div><div class="ligne"><span class="k">Vent</span><span class="v">${m.vent > 0.8 ? 'Violent' : m.vent > 0.5 ? 'Fort' : m.vent > 0.25 ? 'Modéré' : 'Faible'}</span></div><div class="ligne"><span class="k">Neige au sol</span><span class="v">${Math.round(m.neige_sol * 100)} %</span></div>${m.secheresse > 0.6 ? `<div class="ligne"><span class="k">Sécheresse</span><span class="v">${m.secheresse > 1 ? 'grave' : 'menace'}</span></div>` : ''}</div>
  ${m.historique ? `<div class="boite"><h4>📜 Histoire</h4><div class="mini">${e(m.historique)}</div></div>` : ''}
  <div class="boite"><h4>Effets ce mois-ci</h4>${(m.effets || []).map(x => `<div class="evt">${e(x)}</div>`).join('') || '<div class="mini">Aucun effet notable.</div>'}<div class="mini">Récoltes ×${m.cultures.toFixed(2)} (en plus de la saison) · marches ×${m.mouvement.toFixed(2)}</div></div>
  <div class="boite"><h4>Prévisions du mois prochain</h4><div class="prev">${E.previsions.map(p => `<span>${ICONE_METEO[p.genre]} ${p.pourcent} %</span>`).join('')}</div></div>`);
}

// --- récapitulatif du mois
export function recap(rapport, etat) {
  const b = rapport.bilan || {}, j = etat.joueur;
  const lignes = Object.entries(b).filter(([, v]) => Math.abs(v) >= 1).sort((x, y) => y[1] - x[1]);
  ouvrirFeuille(`📜 ${e(rapport.date)} — bilan`, () => `${rapport.effets_meteo?.length ? `<div class="boite"><h4>${ICONE_METEO[rapport.meteo?.genre] || ''} ${NOM_METEO[rapport.meteo?.genre] || ''}</h4>${rapport.effets_meteo.map(x => `<div class="evt meteo">${e(x)}</div>`).join('')}</div>` : ''}
    <div class="boite"><h4>Événements</h4>${rapport.evenements.map(ev => `<div class="evt ${ev.genre}">${e(ev.texte)}${ev.case != null ? ` <button class="mini-btn" data-a="viser" data-c="${ev.case}" aria-label="Voir sur la carte">🎯</button>` : ''}</div>`).join('') || '<div class="mini">Un mois paisible.</div>'}</div>
    ${etat.sieges.some(s => s.assiegeant === 0 || s.proprio === 0) ? `<div class="boite"><h4>🏰 Sièges</h4>${etat.sieges.filter(s => s.assiegeant === 0 || s.proprio === 0).map(s => `<div class="ligne"><span>${s.assiegeant === 0 ? '⚔️' : '🛡️'} ${e(s.nom || '?')} · ${s.mois} mois · murs ${s.murs_pct} % · ${s.vivres > 0 ? Math.ceil(s.vivres) + ' mois de vivres' : 'famine'}</span><button class="btn b2" data-a="case" data-c="${s.case}">Voir</button></div>`).join('')}</div>` : ''}
    <div class="boite"><h4>Stocks</h4><div class="prev">${lignes.map(([r, v]) => `<span style="color:${v > 0 ? '#9f9' : '#f99'}">${res(r).icone} ${v > 0 ? '+' : ''}${Math.round(v)}</span>`).join('') || '<span>—</span>'}</div>
    <div class="mini" style="margin-top:6px">👥 ${rapport.pop_avant} → ${rapport.pop_apres} habitants · bonheur ${Math.round(j.bonheur)} %</div>
    <div class="mini">🪙 Impôts +${Math.round(j.revenus?.impots || 0)} · commerce +${Math.round(j.revenus?.commerce || 0)} · par mer +${Math.round(j.commerce_mer || 0)} · entretien −${Math.round(j.revenus?.entretien || 0)} (marine et espions ${Math.round(j.entretien_flotte || 0)}, forts ${Math.round(j.entretien_forts || 0)})</div>
    ${vieOr(j).length || vieBonheur(j).length ? `<div class="mini">🏘️ Vie des villes : ${[...vieOr(j), ...vieBonheur(j).map(([k, v]) => `${e(k)} ${signe(v)} 😊`)].join(' · ')}</div>` : ''}</div>
    <div class="boite"><h4>${ICONE_METEO[etat.meteo.genre]} ${e(etat.date)} : ${NOM_METEO[etat.meteo.genre]}, ${Math.round(etat.meteo.temperature)} °C</h4>${(etat.meteo.effets || []).map(x => `<div class="evt">${e(x)}</div>`).join('') || '<div class="mini">Pas d\'effet particulier.</div>'}</div>`, false);
}

// --- événement à choix : la carte de la maquette (illustration, titre, date, texte, options et leurs effets) ;
// rend l'indice de l'option choisie. Les options trop chères sont grisées ; la dernière ne coûte rien.
const ILLUSTRE = ['inventeur', 'philosophe', 'disette'];
const EFFET = { savoir: n => `${n > 0 ? '+' : ''}${n} 💡`, bonheur: n => `${n > 0 ? '+' : ''}${n} 😊`, pop: n => `${n > 0 ? '+' : ''}${n} 👥`, relation: n => `relation ${n > 0 ? '+' : ''}${n}`, tech: () => '💡 une technologie', gisement: () => '⛏️ un gisement' };
function effetsOption(o, d) {
  const t = Object.entries(o.cout || {}).map(([r, n]) => `−${n} ${res(r).icone}`);
  for (const [k, n] of Object.entries(d?.effets || {})) t.push(EFFET[k] ? EFFET[k](n) : `${n > 0 ? '+' : ''}${n} ${res(k).icone}`);
  for (const [u, n] of Object.entries(d?.unites || {})) t.push(`+${n} ${unite(u)?.icone || u}`);
  if (o.risque) t.push(`⚠️ ${Math.round(o.risque * 100)} % de risque`);
  return t.join(' ');
}
export function carteChoix(c) {
  const E = J.etat, def = R().evenements_choix?.find(d => d.cle === c.cle);
  const illus = ILLUSTRE.includes(c.cle) ? `<img src="graphismes/rendu/img/evenement-${c.cle}.svg" alt="">` : `<span>${c.icone}</span>`;
  const n = c.options.length;
  return modale(`${c.icone} ${e(c.titre)}`, `<div class="illus">${illus}</div><p class="mini">${e(E.date)} · ${e(E.epoque.nom)}</p><p>${e(c.texte)}</p>`,
    c.options.map((o, i) => { const fx = effetsOption(o, def?.options[i]); return { l: `${e(o.texte)}${fx ? ` · ${fx}` : ''}`, c: i === n - 1 ? 'rouge' : i === 0 ? 'vert' : 'b2', v: i, d: !o.possible }; }), 'choix');
}
