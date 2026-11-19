"use strict";
// ============================================================ actions
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const { act, id } = b.dataset;
  if (act === 'onglet') ouvrir(id === S.onglet && portrait() ? 'carte' : id);
  else if (act === 'vitesse') { const i = +id; if (i === 0) S.pause = !S.pause; else { S.pause = false; S.vit = i; } hud(); }
  else if (act === 'lentille') { S.lentille = id; majLentilles(); majLentille(); couleurCables(); }
  else if (act === 'mode') { choisirMode(mode === id ? null : id); if (portrait() && mode) ouvrir('carte'); }
  else if (act === 'kv') { kvMode = +id; depart = null; depR.visible = false; apercu = null; majAide(); majLentille(); }
  else if (act === 'placer') { choisirMode(id); if (portrait()) ouvrir('carte'); }
  else if (act === 'tracer') { kvMode = +id; choisirMode('ligne'); if (portrait()) ouvrir('carte'); }
  else if (act === 'cat') { catOnglet = id; ouvrir('construire', true); }
  else if (act === 'ordre') { S.ordreManuel = true; const i = S.ordre.indexOf(id), j = i + +b.dataset.dir; [S.ordre[i], S.ordre[j]] = [S.ordre[j], S.ordre[i]]; dispatch(S.min); ouvrir('dispatch', true); }
  else if (act === 'trier') { S.ordreManuel = false; trierOrdre(); dispatch(S.min); ouvrir('dispatch', true); }
  else if (act === 'batt') { unite(id).mode = b.dataset.mode; dispatch(S.min); ouvrir('dispatch', true); }
  else if (act === 'effacement') { S.effacement = !S.effacement; log(S.effacement ? 'Effacement industriel activé.' : 'Fin de l’effacement industriel.', 'alerte'); dispatch(S.min); ouvrir('dispatch', true); }
  else if (act === 'reut') { equiperReut(unite(id)); ouvrir('hex', true); }
  else if (act === 'arret') { const u = unite(id); u.dispo = !u.dispo; log(estEauU(u) ? `${u.nom} ${u.dispo ? 'rouvert' : 'coupé'}.` : `${u.nom} ${u.dispo ? 'recouplée au réseau' : 'mise à l’arrêt'} sur ordre du dispatcheur.`, u.dispo ? 'bon' : 'alerte'); dispatch(S.min); ouvrir('hex', true); }
  else if (act === 'demolir') {
    const u = unite(id); if (confirmer !== id) { confirmer = id; return ouvrir('hex', true); }
    confirmer = null; toast(`${u.nom} ${estCharbon(u) ? 'fermée' : 'démolie'}.`, 'info'); fermer(u); ouvrir('hex', true);
  }
  else if (act === 'demolir-ligne') { const l = LIGNES.find(x => x.id === id); if (l) { demolirLigne(l); ouvrir(S.onglet, true); } }
  else if (act === 'tarif') { S.tarif[id] = clamp(S.tarif[id] + +b.dataset.dir, 60, 240); ouvrir('economie', true); }
  else if (act === 'emprunt') { emprunter(+id, +b.dataset.duree); ouvrir('economie', true); }
  else if (act === 'rd') { S.rd.cours = id; S.rd.avance = 0; log(`R&D : lancement de « ${RDI[id].nom} ».`, 'bon'); ouvrir('rd', true); }
  else if (act === 'budget') { S.rd.budget = +id; ouvrir('rd', true); }
  else if (act === 'vue') choisirVue(id);
  else if (act === 'tarif-eau') { S.eau.tarif = clamp(Math.round((S.eau.tarif + +b.dataset.dir / kEau()) * 100) / 100, .5, 8); ouvrir('eau', true); }
  else if (act === 'restriction') { S.eau.restriction = !S.eau.restriction; log(S.eau.restriction ? 'Restrictions d’eau : arrosage et lavage interdits.' : 'Fin des restrictions d’eau.', 'alerte'); ouvrir('eau', true); }
  else if (act === 'renouveler') { const r = renouveler(); if (r) toast(r); else toast('Conduites renouvelées.', 'ok'); ouvrir('eau', true); }
  else if (act === 'etape') { const r = ajouterEtape(unite(id), b.dataset.k); if (r) toast(r); ouvrir('hex', true); }
  else if (act === 'camion') { changerCamions(S.dec.camions + +id); if (vue === 'dechets') majBarre(); ouvrir(S.onglet === 'carte' ? 'carte' : S.onglet, true); }
  else if (act === 'freq-dec') { S.dec.modes[id] = +b.dataset.k; ouvrir('dechets', true); }
  else if (act === 'mode-dec') { const r = deployerMode(id); if (r) toast(r); else toast(`${NOM_FLUX_D[id]} : collecte déployée.`, 'ok'); ouvrir('dechets', true); }
  else if (act === 'vendre-dec') { S.dec.vendre[id] = b.dataset.k === '1'; ouvrir('dechets', true); }
  else if (act === 'solder-dec') { const D = S.dec, x = D.stock[id] * D.prix[id] * kDec(); S.argent += x; S.an.ventes += x; S.an.decV += x; D.L.vendu += D.stock[id]; D.stock[id] = 0; toast(`Stock vendu : ${euros(x)}.`, 'ok'); ouvrir('dechets', true); }
  else if (act === 'tarif-dec') { S.dec.tarif = clamp(S.dec.tarif + +b.dataset.dir, 30, 200); ouvrir('dechets', true); }
  else if (act === 'enquete') { $('#modale').hidden = true; if (!ENQ) return; const u = acheterUnite(ENQ.t, ENQ.type, id); ENQ = null; if (typeof u === 'string') return toast(u); toast(`${u.nom} : chantier lancé, ${Math.round(u.mois)} mois.`, 'ok'); choisirMode(null); selectionner(u.t); }
  else if (act === 'crise') { S.crise = !S.crise; log(S.crise ? `Plan de crise préparé (${euros(coutCrise())} par an) : réserves de camions, groupes électrogènes, citernes et équipes d’astreinte.` : 'Plan de crise abandonné.', 'alerte'); ouvrir(S.onglet, true); }
  else if (act === 'renfort') { S.dec.renfort = S.min + 30 * 1440; log(`Renforts saisonniers pour 30 jours : camions loués et bacs en plus (${euros(renfortsCout())}).`, 'bon'); ouvrir('dechets', true); }
  else if (act === 'prio-riv') { S.eau.prioRiv = id; log(id === 'centrales' ? 'Sécheresse : la rivière est réservée d’abord au refroidissement des centrales.' : 'Sécheresse : la rivière est réservée d’abord à l’eau potable.', 'alerte'); dispatch(S.min); ouvrir('eau', true); }
  else if (act === 'renover') { const r = renover(unite(id)); if (r) toast(r); else toast('Bâtiment rénové.', 'ok'); ouvrir('hex', true); }
  else if (act === 'amelio') { const r = ameliorer(unite(id), b.dataset.k); if (r) toast(r); else toast('Bâtiment équipé.', 'ok'); ouvrir('hex', true); }
  else if (act === 'nuit-dec') { S.dec.nuit = !S.dec.nuit; log(S.dec.nuit ? 'La collecte des déchets passe de nuit.' : 'La collecte des déchets repasse de jour.', 'alerte'); ouvrir('dechets', true); }
  else if (act === 'brigade') { S.dec.brigade = !S.dec.brigade; log(S.dec.brigade ? 'Brigade de propreté en service.' : 'Brigade de propreté dissoute.', 'alerte'); ouvrir('dechets', true); }
  else if (act === 'campagne-dec') { const c = .2e6 * kDec(); S.argent -= c; S.an.capex += c; S.dec.campagne = S.min + 365 * 1440; log(`Campagne d’information sur le tri lancée pour un an (${euros(c)}).`, 'bon'); ouvrir('dechets', true); }
  else if (act === 'tuto-partie') lancerGuide();
  else if (act === 'guide-suivant') { const e = GUIDE[S.tuto.i]; S.tuto.i++; if (e?.fin) S.tuto = null; majGuide(); }
  else if (act === 'guide-montrer') { GUIDE[S.tuto.i]?.bouton?.[1](); majGuide(); }
  else if (act === 'guide-quitter') { S.tuto = null; majGuide(); toast('Tutoriel quitté : la partie continue.', 'info'); }
  else if (act === 'menu') menu();
  else if (act === 'fermer-modale') { $('#modale').hidden = true; if (S.enJeu && S.pauseModale) { S.pause = false; S.pauseModale = false; } hud(); }
  else if (act === 'diff') { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b)); diffChoisie = id; }
  else if (act === 'nouvelle') {
    nouvellePartie(diffChoisie, carteDef(carteChoisie, graineAlea)); $('#modale').hidden = true;
    let vu = true; try { vu = !!localStorage.getItem('gridmaster-tuto'); localStorage.setItem('gridmaster-tuto', '1'); } catch (e) { /* stockage indisponible : pas de tuto automatique */ }
    if (!vu) { S.pause = true; S.pauseModale = true; tuto('elec', 0); }  // première partie sur cet appareil : le tuto s'ouvre, partie en pause
  }
  else if (act === 'carte') { carteChoisie = id; menu(); }
  else if (act === 'graine') { graineAlea = 1 + Math.floor(Math.random() * 99998); carteChoisie = 'aleatoire'; menu(); }
  else if (act === 'tuto') { const [k, n] = id.split(':'); tuto(k, +n); }
  else if (act === 'banc') menuBanc();
  else if (act === 'banc-sel') { const l = bancSel[b.dataset.k]; l.includes(id) ? l.splice(l.indexOf(id), 1) : l.push(id); menuBanc(); }
  else if (act === 'banc-go') lancerBanc();
  else if (act === 'banc-voir') voirBanc();
  else if (act === 'banc-copier') { const txt = JSON.stringify(bancRes, null, 1); navigator.clipboard?.writeText(txt).then(() => toast('Résultats copiés.', 'ok'), () => toast('Copie refusée par le navigateur.')); }
  else if (act === 'exporter') exporterPartie();
  else if (act === 'importer') importerPartie();
  else if (act === 'continuer') { if (charger()) $('#modale').hidden = true; }
  else if (act === 'continuer-apres') { $('#modale').hidden = true; S.fini = 'continue'; S.pause = false; }
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (mode) choisirMode(null); else if (!$('#modale').hidden && S.enJeu) document.querySelector('[data-act=fermer-modale]')?.click(); }
  if (e.key === ' ' && e.target === document.body && S.enJeu) { S.pause = !S.pause; hud(); e.preventDefault(); }
  if (['1', '2', '3', '4'].includes(e.key) && !e.target.closest('input, textarea, select') && $('#modale').hidden) choisirVue(['carte', 'elec', 'eau', 'dechets'][+e.key - 1]);
});
let diffChoisie = 'normal', carteChoisie = 'valmont', graineAlea = 1 + Math.floor(Math.random() * 99998);
function modale(html) { $('#modale-contenu').innerHTML = html; $('#modale').hidden = false; }
function menu() {
  const sv = lireSauvegarde();
  if (S.enJeu && !S.pause) { S.pause = true; S.pauseModale = true; }
  const cartes = [...Object.entries(CARTES), ['aleatoire', { nom: 'Carte aléatoire', sous: `Graine ${graineAlea}` }]];
  modale(`<h2 class="logo" id="modale-titre">GridMaster</h2><p style="text-align:center">Électricité, eau et déchets d’une région qui grandit, de 1900 à 2050. Sans coupure ni faillite, avec en 2050 une électricité bas carbone, une eau potable conforme et des déchets valorisés.</p>
    ${S.enJeu ? '<button type="button" class="btn" data-act="fermer-modale">Reprendre la partie</button>' : ''}
    ${sv && !S.enJeu ? `<button type="button" class="btn" data-act="continuer">Continuer · ${sv.carte.nom} · ${dateTxt(sv.S.min)} · ${DIFF[sv.S.diff].nom}</button>` : ''}
    <div class="section" style="margin-top:4px">Nouvelle partie · carte</div>
    <div class="choix-l cartes">${cartes.map(([k, c]) => `<button type="button" data-act="carte" data-id="${k}" class="${k === carteChoisie ? 'actif' : ''}">${c.nom}<small>${c.sous}</small></button>`).join('')}</div>
    ${carteChoisie === 'aleatoire' ? '<button type="button" class="btn secondaire petit" data-act="graine">Tirer une autre graine</button>' : ''}
    <div class="section" style="margin-top:4px">Difficulté</div>
    <div class="choix-l">${Object.entries(DIFF).map(([k, d]) => `<button type="button" data-act="diff" data-id="${k}" class="${k === diffChoisie ? 'actif' : ''}">${d.nom}<small>${nf(d.argent)} M€ · croissance ${d.croit < 1 ? 'lente' : d.croit > 1 ? 'rapide' : 'normale'}</small></button>`).join('')}</div>
    <button type="button" class="btn ${S.enJeu || sv ? 'secondaire' : ''}" data-act="nouvelle">Nouvelle campagne · 1900 → 2050</button>
    <div class="encart"><h3>Quatre vues</h3><p>Carte (touche 1) montre toute la région. Électricité (2) montre les centrales, les lignes et le courant. Eau (3) montre les captages, les usines, les châteaux d’eau, les conduites et l’eau qui y coule. Déchets (4) montre les décharges, les centres de tri, les incinérateurs et les camions de collecte. On construit dans la vue de chaque réseau.</p></div>
    <div class="encart"><h3>Comment jouer</h3><p>Posez centrales et postes sur les hexagones (barre du bas), puis reliez-les avec l’outil Ligne : centrale → 225 kV → poste 225/63 kV → 63 kV → ville. Une centrale non reliée ne produit rien. Surveillez la fréquence, la charge des lignes (lentille « Charge réseau ») et le critère N-1 dans l’onglet Réseau. Accélérez le temps en haut à gauche.</p></div>
    <button type="button" class="btn secondaire" data-act="tuto-partie">Partie tutoriel guidée · les trois réseaux pas à pas</button>
    <button type="button" class="btn secondaire petit" data-act="tuto" data-id="elec:0">Tutoriel en fiches · électricité, eau, déchets, territoire</button>
    <button type="button" class="btn secondaire petit" data-act="banc">Banc d’équilibrage</button>
    <div style="display:flex;gap:8px">${S.enJeu || sv ? '<button type="button" class="btn secondaire petit" style="flex:1" data-act="exporter">Exporter la partie</button>' : ''}<button type="button" class="btn secondaire petit" style="flex:1" data-act="importer">Importer une partie</button></div>
    <p class="verrou">La partie est enregistrée automatiquement dans ce navigateur chaque jour de jeu. Exportez-la dans un fichier pour en garder plusieurs ou la reprendre sur un autre appareil.</p>`);
}
// tutoriel : la chaîne de chaque réseau, étape par étape (les ouvrages concernés s'allument)
const TUTO_IC = {
  ville: '<path d="M4 30V17l7-6 7 6v13z" fill="#f3efe6" stroke="#0f130e" stroke-width="2.2"/><path d="M18 30V9h11v21z" fill="#d9573b" stroke="#0f130e" stroke-width="2.2"/><path d="M9 30v-6h4v6M21 13h5M21 18h5M21 23h5" stroke="#0f130e" stroke-width="2"/>',
  transfo: '<circle cx="13" cy="17" r="8" fill="none" stroke="#0f130e" stroke-width="2.8"/><circle cx="21" cy="17" r="8" fill="none" stroke="#ffc94d" stroke-width="2.8"/>',
  riviere: '<path d="M3 12q4-4 8 0t8 0 8 0 4-1M3 19q4-4 8 0t8 0 8 0 4-1M3 26q4-4 8 0t8 0 8 0 4-1" stroke="#38b6ff" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
};
const icT = k => TUTO_IC[k] || ICONES[k];
// n : [icône, nom, classe] ; f : [texte de la flèche, couleur]
const CH_ELEC = [['nucleaire', 'Centrale'], ['transfo', 'Transfo élévateur', 'inclus'], ['225 / 400 kV'], ['poste', 'Poste 225/63 kV'], ['63 kV'], ['transfo', 'Poste source', 'inclus'], ['ville', 'Ville']];
const CH_PION = [['usine', 'Usine'], ['15 kV'], ['ville', 'Ville']];
const CH_DEC = [['ville', 'Ville'], ['bac', 'Bacs'], ['camion', 'Camions'], ['tri', 'Tri, compost'], ['matières', '#7be08a'], ['incin', 'Incinérateur'], ['decharge', 'Décharge']];
const CH_TER = [['nucleaire', 'Centrale'], ['chaleur', '#ff7a3a'], ['ville', 'Ville'], ['bac', 'Bacs'], ['camion', 'Camions'], ['incin', 'Incinérateur']];
const CH_EAU = [['prise', 'Captage'], ['eau brute', '#3ad1c4'], ['potab', 'Potabili­sation'], ['potable', '#3f9cff'], ['chateau', 'Château d’eau'], ['ville', 'Ville'], ['eaux usées', '#b07f4c'], ['step', 'Épuration'], ['épurée', '#9fe0b5'], ['riviere', 'Rivière']];
const chaine = (ch, on) => `<div class="tuto-ch" aria-hidden="true">${ch.map((e, i) => e.length === 1 || e[1]?.startsWith('#') ? `<span class="tuto-fl"><i style="--c:${e[1] || 'var(--or)'}"></i>${e[0]}</span>` : `<span class="tuto-n${on.includes(i) ? ' on' : ''}${e[2] ? ' ' + e[2] : ''}"><svg viewBox="0 0 34 34">${icT(e[0])}</svg><b>${e[1]}</b></span>`).join('')}</div>`;
const TOUT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const TUTO = {
  elec: [
    { t: 'La chaîne de l’électricité', ch: CH_ELEC, on: TOUT, l: ['On produit loin des villes, dans les centrales.', 'On élève la tension pour transporter : en très haute tension, les pertes sont faibles.', 'On l’abaisse dans un poste, puis dans le poste source de la ville, avant de servir les foyers.', 'Dans le jeu : centrale → 225/400 kV → poste 225/63 kV → 63 kV → ville. Le transfo élévateur est compris dans la centrale, le poste source dans la ville.'] },
    { t: '1900 : les pionniers', ch: CH_PION, on: [0, 2], l: ['Au début, une petite usine (10 MW) alimente la ville voisine en 15 kV, sur des poteaux en bois.', 'Une ligne 15 kV porte 15 MW au plus : gardez les usines près des villes.', 'Le 63 kV arrive en 1920 (150 MW par ligne) : il relie encore directement usines et villes.'] },
    { t: '1. Produire', ch: CH_ELEC, on: [0, 1], l: ['Posez une centrale dans la vue Électricité (touche 2). Chaque type a ses terrains : barrage sur rivière, nucléaire au bord de l’eau…', 'Sa fiche indique la tension de raccordement conseillée.', 'Une centrale non reliée ne produit rien.', 'Au-delà de 150 MW, une centrale part en 225 ou 400 kV. Le 400 kV est réservé aux centrales de 400 MW et plus, et aux postes.'] },
    { t: '2. Transporter', ch: CH_ELEC, on: [1, 3], l: ['Le 225 kV arrive en 1935 (450 MW par ligne), le 400 kV en 1960 (1 600 MW).', 'Tirez la ligne avec l’outil Ligne : cliquez sur la centrale, puis sur le poste.', 'Le poste 225/63 kV a deux autotransformateurs de 250 MVA : c’est le seul ouvrage qui change de tension.', 'Une centrale raccordée en 225 kV ne peut donc pas repartir en 63 kV vers une ville : il faut passer par un poste.'] },
    { t: '3. Distribuer', ch: CH_ELEC, on: [3, 5, 6], l: ['Une ville se raccorde en 15 ou 63 kV, jamais en très haute tension.', 'Reliez chaque ville à un poste en 63 kV.', 'Les petites centrales (éolien, solaire, biomasse, batteries, turbines) peuvent aller directement en 63 kV vers un poste ou une ville.'] },
    { t: '4. Tenir le réseau', ch: CH_ELEC, on: TOUT, l: ['Doublez les liaisons : avec deux lignes 63 kV, une ville reste alimentée si l’une tombe (critère N-1, onglet Réseau).', 'Surveillez la lentille « Charge réseau » : une ligne au-delà de 130 % pendant 45 minutes déclenche.', 'À partir de 1938, une ligne 225 kV vers la frontière permet d’importer et d’exporter.'] },
    { t: '5. Usure et malus des centrales', ch: CH_ELEC, on: [0], l: ['Chaque centrale vieillit : passé 70 % de sa durée de vie, elle tombe plus souvent en panne. Sa fiche permet de la rénover (40 % de son prix).', 'Les centrales au charbon et au fioul enfument les riverains : la recherche « Dépoussiérage et désulfuration » (1970) débloque l’équipement qui supprime ce malus. Pour le gaz : brûleurs bas NOx (1990).', 'L’incinérateur et le méthaniseur produisent aussi de l’électricité, s’ils sont reliés au réseau.'] },
  ],
  eau: [
    { t: 'Le cycle de l’eau', ch: CH_EAU, on: TOUT, l: ['On capte l’eau, on la rend potable, on la stocke en hauteur, puis on la distribue.', 'Les eaux usées repartent par les égouts vers une station d’épuration, qui rend une eau propre à la rivière.', 'Dans le jeu, tout se construit dans la vue Eau (touche 3) : les ouvrages travaillent ensemble s’ils sont sur le même réseau de conduites.'] },
    { t: '1. Capter', ch: CH_EAU, on: [0], l: ['Captage de source : eau propre, mais petit débit (collines).', 'Forage en nappe : sur une nappe (lentille Nappes), attention aux nitrates.', 'Prise d’eau en rivière : beaucoup d’eau, mais sale.', 'Plus tard : forage profond (1955), dessalement sur la côte (1985).'] },
    { t: '2. Rendre potable', ch: CH_EAU, on: [0, 2], l: ['L’usine de potabilisation arrive en 1905 avec un filtre à sable et du chlore.', 'La conduite entre la prise d’eau et l’usine transporte de l’eau brute (turquoise).', 'Les normes se durcissent au fil du siècle : ajoutez les étapes depuis la fiche de l’usine (charbon actif, ozonation, dénitratation, ultrafiltration).'] },
    { t: '3. Stocker et distribuer', ch: CH_EAU, on: [2, 4, 5], l: ['Le château d’eau (ou le réservoir sur colline) donne la pression et couvre les pointes du matin et du soir.', 'Sans château d’eau ni station de pompage, la ville n’est servie qu’à 80 %.', 'Tirez une conduite (bleue) jusqu’à la ville : la distribution se dessine toute seule dans les quartiers.', 'Les conduites fuient en vieillissant : renouvelez-les depuis l’onglet Eau.'] },
    { t: '4. Assainir', ch: CH_EAU, on: [5, 7, 9], l: ['L’outil Égout trace un collecteur (marron) de la ville vers une épuration.', 'Lagunage dès 1900 pour une petite ville (5 000 habitants). Station d’épuration en 1950, au bord d’une rivière ou de la mer.', 'Les eaux non épurées polluent la rivière en aval et les prises d’eau qui s’y trouvent. Elles coûtent des amendes à partir de 1992.'] },
    { t: '5. Réutiliser', ch: CH_EAU, on: [7, 5], l: ['Avec la recherche, une épuration peut être équipée pour la réutilisation (à partir de 2010).', 'Des conduites vertes portent l’eau traitée vers les fermes, puis vers l’industrie.', 'Autant d’eau potable et de prélèvements en rivière économisés.'] },
    { t: '6. Liens et malus', ch: CH_EAU, on: [5, 7, 9], l: ['Sans électricité, les pompes et les épurations s’arrêtent (coupure en cascade) : un groupe électrogène de secours, dans la fiche, l’évite.', 'Les épurations produisent des boues, qui partent dans les flux de déchets ; la déshydratation des boues les divise par trois. Leurs odeurs gênent les villes voisines : couverture et désodorisation.', 'En sécheresse, l’onglet Eau demande à qui va la rivière : l’eau potable ou le refroidissement des centrales.'] },
  ],
  dechets: [
    { t: 'La chaîne des déchets', ch: CH_DEC, on: TOUT, l: ['Chaque ville remplit ses poubelles : environ 120 kg par habitant et par an en 1900, plus de 500 kg en 2000.', 'Les camions de collecte vident les bacs du lundi au samedi et portent les tonnes vers les sites de traitement.', 'Tout se construit dans la vue Déchets (touche 4) ; la flotte, la collecte et le marché se règlent dans l’onglet Déchets.'] },
    { t: '1. Collecter', ch: CH_DEC, on: [0, 1, 2], l: ['Le nombre de camions est le premier levier : trop peu, les bacs débordent et les ordures finissent dans la rue ; trop, chaque camion coûte cher pour rien.', 'L’onglet Déchets compare la flotte au besoin. Les tombereaux à cheval de 1900 portent 2,5 t par jour, les camions 5 t, puis la benne tasseuse (recherche) bien plus.', 'Choisissez le nombre de passages par semaine : deux pour les ordures, c’est le minimum pour que les habitants soient contents.'] },
    { t: '2. Enfouir, puis brûler', ch: CH_DEC, on: [5, 6], l: ['Au début, tout part à la décharge. Elle se remplit : anticipez la suivante, loin des habitations et de la rivière.', 'L’incinérateur (1960) brûle les résiduels ; avec la recherche, il vend sa chaleur. Les riverains n’aiment ni l’un ni l’autre.', 'Décharges pleines : les déchets partent en export d’urgence, à prix d’or. La taxe sur l’enfouissement arrive en 1999 et monte chaque année.'] },
    { t: '3. Trier et recycler', ch: CH_DEC, on: [1, 3, 4], l: ['Colonnes à verre (1974), déchèterie (1985) pour les encombrants et les déchets verts, compostage (1980).', 'Collecte sélective (recherche, 1992) : le bac jaune alimente le centre de tri (1990), qui vend papier, plastiques et métaux.', 'Les cours des matières bougent : quand l’un s’effondre, stockez et revendez plus tard.'] },
    { t: '4. Dépôts, horaires, liens', ch: CH_DEC, on: [1, 2, 6], l: ['Les camions partent d’un dépôt : plus il est loin des villes, moins ils collectent. Un quai de transfert (1970) rapproche le vidage quand le site de traitement est loin.', 'Collecte de nuit : moins de bruit pour les habitants, mais plus chère, et les équipages s’usent. Des équipages usés font grève.', 'Les boues des stations d’épuration arrivent dans vos flux ; les jus des décharges polluent la rivière. L’incinérateur et le méthaniseur produisent de l’électricité si on les relie au réseau.'] },
    { t: '5. Malus et améliorations', ch: CH_DEC, on: TOUT, l: ['Beaucoup de bâtiments ont un malus : fumées des centrales, odeurs des stations et des décharges, jus de décharge, boues…', 'La fiche de chaque bâtiment liste ses malus et l’équipement qui les réduit : désulfuration, désodorisation, déshydratation des boues, casiers étanches, captage du biogaz, traitement des fumées.', 'Chaque équipement est débloqué par une recherche.'] },
    { t: '6. Objectif 2050', ch: CH_DEC, on: TOUT, l: ['Valoriser 65 % des déchets (recyclage, compost et énergie), dont 30 % de recyclage et de compost.', 'Brûler ne suffit pas : il faut aussi trier. Les biodéchets (recherche, 2000) et la redevance incitative aident.', 'Le diagramme des flux de l’onglet Déchets montre où va chaque tonne et où ça coince.'] },
  ],
  territoire: [
    { t: 'Le territoire', ch: CH_TER, on: TOUT, l: ['Les trois réseaux partagent la même région, les mêmes habitants et la même météo.', 'Ce qui se passe dans l’un touche les autres : coupures en cascade, boues, jus de décharge, chaleur des centrales, sécheresse et canicule.', 'Les habitants votent, ont des attentes selon leur quartier et n’aiment pas certains voisins.'] },
    { t: '1. Réseau de chaleur', ch: CH_TER, on: [0, 1, 2], l: ['L’outil Chaleur (vues Électricité et Déchets, à partir de 1925) trace un tuyau orange d’une centrale thermique, d’un incinérateur ou d’un méthaniseur vers une ville.', 'La chaleur se vend et remplace une partie du chauffage électrique l’hiver : la pointe baisse.'] },
    { t: '2. Enquête publique', ch: CH_TER, on: [0, 2], l: ['Avant une décharge, un incinérateur, un centre de déchets dangereux, une centrale nucléaire ou un barrage (à partir de 1960), choisissez :', 'Passer en force : rapide, mais les riverains se fâchent et peuvent attaquer en justice. Concerter : 40 % plus long, sans recours. Indemniser la commune : 15 % plus cher, sans recours.'] },
    { t: '3. Quartiers et élections', ch: CH_TER, on: [2], l: ['Le centre-ville veut 3 passages de collecte par semaine et pas de bruit. La zone industrielle produit des déchets dangereux à traiter à part. L’hôpital ne supporte aucune coupure.', 'Tous les 6 ans, les élections municipales fixent une priorité de mandat (onglet Région). Tenue : prime et habitants contents.', 'Fêtes et vacances font bondir déchets et eau à date fixe : prévoyez des renforts.'] },
    { t: '4. Crises', ch: CH_TER, on: TOUT, l: ['Le plan de crise (onglet Région) coûte chaque année, mais grèves, tempêtes, pollutions et coupures comptent deux fois moins.', 'À partir de 2010, une cyberattaque coupe alertes et prévisions quelques jours : recherche « Cybersécurité ».', 'Une décharge fermée doit être surveillée 30 ans ; un réacteur se démantèle.'] },
  ],
};
// partie tutoriel guidée : une vraie partie, étape par étape, de l'électricité à l'eau puis aux déchets
const usine2 = () => UNITES.find(u => u.type === 'usine' && u.id !== S.tuto?.u0);
const GUIDE = [
  { r: 'Bienvenue', t: 'Bienvenue dans la vallée', l: 'Vous gérez l’électricité, l’eau et les déchets d’une région qui grandit. En haut : la date, les vues, la fréquence du réseau, l’état de l’eau et des déchets, la satisfaction et la trésorerie. Le temps est en pause : prenez votre temps.', suivant: true },
  { r: 'Électricité', t: 'Passez en vue Électricité', l: 'Cliquez sur « Électricité » en haut, ou appuyez sur la touche 2. Les centrales s’allument en doré, le courant circule dans les lignes.', ok: () => vue === 'elec', bouton: ['Passer en vue Électricité', () => choisirVue('elec')] },
  { r: 'Électricité', t: 'Construisez une usine électrique', l: 'Valmont va grandir et demander plus de courant. Dans la barre du bas, choisissez « Usine », puis posez-la sur un hexagone vert près de la ville.', ok: () => !!usine2() },
  { r: 'Électricité', t: 'Reliez-la à la ville', l: 'Une centrale non reliée ne produit rien. Prenez l’outil « Ligne » (15 kV), cliquez sur la nouvelle usine, puis sur Valmont.', ok: () => { const u = usine2(); return !!u && LIGNES.some(l => l.a === u.t || l.b === u.t); } },
  { r: 'Électricité', t: 'Accélérez le temps', l: 'Un chantier prend plusieurs mois. Lancez le temps en haut à gauche (« 1 sem » ou « 1 mois ») et attendez la mise en service de l’usine.', ok: () => { const u = usine2(); return !!u && !u.fin && raccordee(u); } },
  { r: 'Eau', t: 'Passez en vue Eau', l: 'La ville boit l’eau d’un forage et d’un château d’eau. Mais ses eaux usées partent à la rivière sans être épurées. Passez en vue Eau (touche 3).', ok: () => vue === 'eau', bouton: ['Passer en vue Eau', () => choisirVue('eau')] },
  { r: 'Eau', t: 'Posez un lagunage', l: 'Le lagunage épure les eaux usées d’une petite ville. Choisissez « Lagunage » dans la barre du bas et posez-le sur un terrain plat près de Valmont.', ok: () => UNITES.some(u => u.type === 'lagunage') },
  { r: 'Eau', t: 'Tracez l’égout', l: 'Prenez l’outil « Égout », cliquez sur Valmont, puis sur le lagunage. Les eaux usées y couleront dès sa mise en service.', ok: () => !!VILLES[0]?.egout },
  { r: 'Eau', t: 'Regardez l’onglet Eau', l: 'L’onglet Eau résume tout : besoins servis, qualité, eaux usées épurées, prix du m³. Ouvrez-le.', ok: () => S.onglet === 'eau', bouton: ['Ouvrir l’onglet Eau', () => ouvrir('eau')] },
  { r: 'Déchets', t: 'Passez en vue Déchets', l: 'Chaque jour, Valmont remplit ses poubelles. Passez en vue Déchets (touche 4) : la décharge, le dépôt des camions, et bientôt les centres de tri.', ok: () => vue === 'dechets', bouton: ['Passer en vue Déchets', () => choisirVue('dechets')] },
  { r: 'Déchets', t: 'Il manque des camions', l: 'La flotte est trop petite : les bacs débordent et les ordures finissent dans la rue. Dans l’onglet Déchets, achetez des camions jusqu’à couvrir le besoin. Attention : trop de camions coûtent cher pour rien.', debut: () => { S.dec.camions = Math.max(2, Math.floor(besoinCamions() * .6)); majBarre(); }, ok: () => S.dec.camions >= Math.ceil(besoinCamions()), bouton: ['Ouvrir l’onglet Déchets', () => ouvrir('dechets')] },
  { r: 'Déchets', t: 'Satisfaites le centre-ville', l: 'Le centre-ville veut une collecte fréquente. Dans l’onglet Déchets, passez les ordures résiduelles à 3 passages par semaine.', ok: () => S.dec.modes.res >= 3, bouton: ['Ouvrir l’onglet Déchets', () => ouvrir('dechets')] },
  { r: 'Malus', t: 'Regardez les malus d’un bâtiment', l: 'Chaque bâtiment a ses malus : fumées, odeurs, jus de décharge… Cliquez sur la décharge pour ouvrir sa fiche : vous y verrez ses malus, les équipements qui les réduisent, et son âge.', ok: () => S.onglet === 'hex' && selT?.occ?.type === 'decharge' },
  { r: 'Ensemble', t: 'Les trois réseaux sont liés', l: 'Une ville sans électricité arrête ses pompes et ses sites de déchets (coupure en cascade). Les boues des épurations deviennent des déchets. Les jus de décharge polluent la rivière. Plus tard : réseau de chaleur, enquêtes publiques, élections, plan de crise.', suivant: true },
  { r: 'Fin', t: 'À vous de jouer', l: 'Vous savez gérer les trois réseaux. Continuez cette partie librement jusqu’en 2050, ou lancez une campagne depuis le menu. Le tutoriel en fiches reste dans le menu.', suivant: true, fin: true },
];
function lancerGuide() {
  nouvellePartie('facile', carteDef('valmont')); $('#modale').hidden = true;
  S.tuto = { i: 0, u0: UNITES.find(u => u.type === 'usine')?.id }; S.argent = 80e6; S.pause = true;  // de la marge pour apprendre sans risquer la faillite
  log('Partie tutoriel : suivez les étapes de la fiche en bas à gauche.', 'bon'); majGuide();
}
function majGuide() {
  const g = $('#guide'); if (!g) return;
  if (!S.tuto || BANC_ON) { g.hidden = true; return; }
  const e = GUIDE[S.tuto.i]; if (!e) { g.hidden = true; return; }
  if (S.tuto.vu !== S.tuto.i) { S.tuto.vu = S.tuto.i; e.debut?.(); }  // la situation de l'étape se met en place quand on y arrive
  if (e.ok && e.ok()) { S.tuto.i++; toast(`Étape réussie : ${e.t}.`, 'ok'); return majGuide(); }
  const html = `<span class="g-etape">Tutoriel · ${e.r} · ${S.tuto.i + 1}/${GUIDE.length}</span><h3>${e.t}</h3><p>${e.l}</p><div class="jauge"><i style="width:${S.tuto.i / (GUIDE.length - 1) * 100}%"></i></div>
    <div class="btns">${e.bouton ? `<button type="button" class="btn petit" data-act="guide-montrer">${e.bouton[0]}</button>` : ''}${e.suivant ? `<button type="button" class="btn petit" data-act="guide-suivant">${e.fin ? 'Terminer' : 'Suivant'}</button>` : ''}<button type="button" class="btn petit secondaire" data-act="guide-quitter">Quitter le tutoriel</button></div>`;
  if (g.dataset.h !== html) { g.innerHTML = html; g.dataset.h = html; }
  g.hidden = false;
}
function tuto(sujet = 'elec', i = 0) {
  const L = TUTO[sujet], e = L[i];
  modale(`<h2 id="modale-titre">Tutoriel</h2>
    <button type="button" class="btn" data-act="tuto-partie">Apprendre en jouant : partie tutoriel guidée</button>
    <div class="choix-l" style="grid-template-columns:1fr 1fr">${[['elec', 'Électricité'], ['eau', 'Eau'], ['dechets', 'Déchets'], ['territoire', 'Territoire']].map(([k, n]) => `<button type="button" data-act="tuto" data-id="${k}:0" class="${k === sujet ? 'actif' : ''}">${n}</button>`).join('')}</div>
    <div class="section" style="margin-top:0">${e.t}</div>
    ${chaine(e.ch, e.on)}
    <ul class="tuto-l">${e.l.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="tuto-pts" role="img" aria-label="Étape ${i + 1} sur ${L.length}">${L.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
    <div style="display:flex;gap:8px"><button type="button" class="btn secondaire" style="flex:1" data-act="tuto" data-id="${sujet}:${i - 1}" ${i ? '' : 'disabled'}>Précédent</button>${i < L.length - 1 ? `<button type="button" class="btn" style="flex:1" data-act="tuto" data-id="${sujet}:${i + 1}">Suivant</button>` : sujet === 'elec' ? '<button type="button" class="btn" style="flex:1" data-act="tuto" data-id="eau:0">Passer à l’eau</button>' : sujet === 'eau' ? '<button type="button" class="btn" style="flex:1" data-act="tuto" data-id="dechets:0">Passer aux déchets</button>' : sujet === 'dechets' ? '<button type="button" class="btn" style="flex:1" data-act="tuto" data-id="territoire:0">Passer au territoire</button>' : ''}</div>
    <button type="button" class="btn secondaire petit" data-act="${S.enJeu ? 'fermer-modale' : 'menu'}">${S.enJeu ? 'Reprendre la partie' : 'Retour au menu'}</button>`);
}
function rapportAnnuel(r, er) {
  const fin = r.an === 2049;
  if (BANC_ON) { if (fin) S.fini = OBJ.every(([, f]) => f(r)) ? 'victoire' : 'echec'; return; }
  if (!fin && !er) return toast(`Bilan ${r.an} : ${nf(r.pointe, r.pointe < 50 ? 1 : 0)} MW à la pointe, ${nf(r.coupure)} min de coupure, ${nf(r.res / 1e6, 1)} M€.`, 'info');
  S.pause = true; S.pauseModale = !fin;
  const ok = OBJ.map(([n, f, v]) => [n, f(r), v(r)]), gagne = ok.every(o => o[1]);
  if (fin) S.fini = gagne ? 'victoire' : 'echec';
  const suiv = er && ERES[ERES.indexOf(er) + 1], neufs = er ? [...Object.values(TYPES).filter(t => !t.cache && t.an >= er.an && t.an < (suiv?.an || 2100)).map(t => `${t.nom} (${t.an})`), ...Object.values(KV).filter(k => k.an >= er.an && k.an < (suiv?.an || 2100)).map(k => `Lignes ${k.nom} (${k.an})`)] : [];
  modale(`<h2 id="modale-titre">${fin ? (gagne ? 'Objectif 2050 atteint !' : 'Objectif 2050 manqué') : `${er.an} · ${er.nom}`}</h2>
    ${fin ? `<p>${gagne ? `${CARTE.nom} produit une électricité bas carbone, fiable et abordable. Bravo, dispatcheur.` : 'La région n’a pas atteint tous ses objectifs. Vous pouvez continuer à jouer pour les remplir.'}</p>` : `<p>${er.txt}</p>${neufs.length ? `<div class="chips">${neufs.map(n => `<span class="chip or">${n}</span>`).join('')}</div>` : ''}`}
    <div class="section" style="margin-top:0">Bilan de ${r.an}</div>
    <div class="stat"><span>Villes</span><b>${VILLES.length} · ${nf(VILLES.reduce((a, v) => a + v.hab, 0))} habitants</b><span>Énergie livrée</span><b>${nf(r.e / 1e3, r.e < 1e4 ? 1 : 0)} GWh</b><span>Pointe</span><b>${nf(r.pointe, r.pointe < 50 ? 1 : 0)} MW</b><span>Émissions</span><b>${nf(r.co2)} gCO₂/kWh</b><span>Coupure</span><b>${nf(r.coupure)} min</b><span>Eau servie · conforme</span><b>${nf(r.eauServi ?? 0)} % · ${nf(r.eauConf ?? 0)} %</b><span>Déchets valorisés · recyclés</span><b>${nf(r.decVal ?? 0)} % · ${nf(r.decRec ?? 0)} %</b>${r.impot > 0 ? `<span>Impôt et dividende</span><b>${nf(r.impot / 1e6, 1)} M€</b>` : ''}<span>Résultat</span><b class="${r.res < 0 ? 'neg' : 'pos'}">${nf(r.res / 1e6, 1)} M€</b></div>
    ${fin ? `<div class="section">Objectifs 2050</div>${ok.map(([n, b, v]) => `<div class="barre-l"><span style="width:auto;flex:1">${b ? '✓' : '✕'} ${n}</span><span style="width:auto;color:${b ? 'var(--vert)' : 'var(--rouge)'}">${v}</span></div>`).join('')}` : ''}
    <button type="button" class="btn" data-act="${fin ? 'continuer-apres' : 'fermer-modale'}">${fin ? 'Continuer à jouer' : 'Continuer'}</button>`);
}
function finPartie(cause) {
  S.fini = cause; S.pause = true; if (BANC_ON) return;
  modale(`<h2 id="modale-titre">${cause === 'faillite' ? 'Faillite' : 'Révocation'}</h2><p>${cause === 'faillite' ? 'La trésorerie est passée sous −300 M€ : les banques reprennent la gestion du réseau.' : 'La satisfaction des habitants est restée sous 15 % pendant quatre mois : le conseil régional vous retire la concession.'}</p>
    <div class="choix-l">${Object.entries(DIFF).map(([k, d]) => `<button type="button" data-act="diff" data-id="${k}" class="${k === diffChoisie ? 'actif' : ''}">${d.nom}<small>${nf(d.argent)} M€</small></button>`).join('')}</div>
    <button type="button" class="btn" data-act="nouvelle">Recommencer</button>`);
}
