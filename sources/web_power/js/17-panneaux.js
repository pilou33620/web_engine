"use strict";
// ============================================================ panneaux
const TITRES = { dechets: 'Gestion des déchets', eau: 'Gestion de l’eau', accueil: 'Région de Valmont', dispatch: 'Dispatching électrique', construire: 'Construire', reseau: 'Réseau', meteo: 'Météo et prévisions', economie: 'Économie', rd: 'Recherche et développement', journal: 'Journal', hex: 'Hexagone' };
function kpi(k, v, unite, part, couleur) { return `<div class="kpi"><span class="k">${k}</span><span class="v">${v} <small>${unite}</small></span><div class="jauge"><i style="width:${clamp(part, 0, 1) * 100}%;background:${couleur}"></i></div></div>`; }
function etatFreq(f) { return f < 49 ? ['Critique · délestage', '#ff6b5a', 'critique'] : f < 49.5 || f > 50.5 ? ['Dégradé', '#ff9a4a', 'critique'] : f < 49.8 || f > 50.2 ? ['Alerte', '#ffc94d', 'alerte'] : ['Normal', '#7be08a', '']; }
const OBJ = [
  ['Électricité bas carbone', r => r.bas >= 90, r => `${nf(r.bas)} % / 90 %`],
  ['Coupure par habitant', r => r.coupure <= (CARTE.coupureMax || 30), r => `${nf(r.coupure)} min / ${CARTE.coupureMax || 30} min par an`],
  ['Satisfaction', r => r.sat >= 50, r => `${nf(r.sat)} % / 50 %`],
  ['Trésorerie positive', () => S.argent >= 0, () => `${nf(S.argent / 1e6)} M€`],
  ['Eau potable servie et conforme', r => (r.eauServi ?? 0) >= 97 && (r.eauConf ?? 0) >= 97, r => `${nf(r.eauServi ?? 0)} % servie · ${nf(r.eauConf ?? 0)} % conforme`],
  ['Déchets valorisés, dont recyclés', r => (r.decVal ?? 0) >= 65 && (r.decRec ?? 0) >= 30, r => `${nf(r.decVal ?? 0)} % / 65 % · ${nf(r.decRec ?? 0)} % / 30 % recyclés`],
];
function anCourant() { const a = S.an, e = Math.max(1, a.e); return { bas: a.bas / e * 100, coupure: a.coupure, sat: S.sat, co2: a.co2 / e, ...statsAnEau(a), ...statsAnDec(a) }; }
function panneauAccueil() {
  const r = anCourant(), j = S.jourPrec || S.jour, prix = S.hist.reduce((a, h) => a + h.spot, 0) / Math.max(1, S.hist.length);
  return `<div class="encart"><h3>${ere().an} · ${ere().nom}</h3><p>${ere().txt}${ERES[ERES.indexOf(ere()) + 1] ? ` Prochaine époque en ${ERES[ERES.indexOf(ere()) + 1].an} : ${ERES[ERES.indexOf(ere()) + 1].nom}.` : ''}</p></div>
    <div class="encart"><h3>Objectif 2050 · ${DIFF[S.diff].nom}</h3><p>${CARTE.sous}. Électrifier la région à mesure qu’elle se peuple, puis rendre son électricité bas carbone sans coupure ni faillite. Le charbon doit avoir fermé avant 2032.</p>
    ${OBJ.map(([n, ok, v]) => `<div class="barre-l"><span style="width:auto;flex:1">${ok(r) ? '✓' : '✕'} ${n}</span><span style="width:auto;color:${ok(r) ? 'var(--vert)' : 'var(--rouge)'}">${v(r)}</span></div>`).join('')}
    <p class="verrou">${2050 - annee(S.min)} ans restants · année en cours depuis le 1er janvier</p></div>
    ${S.mandat ? `<div class="encart"><h3>Mandat de ${S.mandat.maire} · ${S.mandat.debut}–${S.mandat.fin}</h3><p>Priorité du mandat : « ${prioDe(S.mandat.prio).nom} » : ${prioDe(S.mandat.prio).txt.toLowerCase()}. Tenue aux élections de ${S.mandat.fin} : prime de ${euros(primeMandat())} et habitants satisfaits ; sinon, ils seront déçus.</p><div class="barre-l"><span style="width:auto;flex:1">${prioDe(S.mandat.prio).ok() ? '✓ Objectif tenu aujourd’hui' : '✕ Objectif pas encore tenu'}</span></div></div>` : `<p class="verrou">Premières élections municipales le 1er mars 1902.</p>`}
    <div class="encart"><h3>Plan de crise</h3><p>Camions de réserve, groupes électrogènes, citernes d’eau, équipes d’astreinte : ${euros(coutCrise())} par an. Grèves, tempêtes, pollutions, coupures d’hôpital et coupures en cascade comptent deux fois moins.</p><button type="button" class="btn ${S.crise ? '' : 'secondaire'}" data-act="crise">${S.crise ? 'Plan de crise actif' : 'Préparer un plan de crise'}</button></div>
    ${prochainesFetes(S.min).length ? `<div class="section">Fêtes et vacances</div><div class="chips">${prochainesFetes(S.min).map(x => `<span class="chip ${dansFete(x.f, S.min) ? 'or' : ''}">${x.f.nom} · ${dansFete(x.f, S.min) ? 'en cours' : dateTxt(x.debut)}</span>`).join('')}</div><p class="verrou">Plus de déchets et plus d’eau à ces dates : prévoyez des renforts (onglet Déchets).</p>` : ''}
    <div class="kpis">
      ${kpi('Trésorerie', nf(S.argent / 1e6), 'M€', S.argent / 1500e6, 'var(--or)')}${kpi('Dette', nf(S.dette / 1e6), 'M€', S.dette / 2000e6, 'var(--rouge)')}
      ${kpi('Satisfaction', nf(S.sat), '%', S.sat / 100, 'var(--vert)')}${kpi('Coupure cette année', nf(r.coupure), 'min', r.coupure / 60, 'var(--orange)')}
      ${kpi('Émissions', nf(r.co2), 'gCO₂/kWh', r.co2 / 600, '#8d8f96')}${kpi('Bas carbone', nf(r.bas), '%', r.bas / 100, '#7cc0f2')}
      ${kpi('Prix spot moyen', nf(prix), '€/MWh', prix / 200, '#f08a6c')}${kpi('Pointe de l’année', nf(S.an.pointe), 'MW', S.an.pointe / 1000, '#c3b0ea')}
    </div>
    <div class="section">Villes</div>
    ${VILLES.map(v => `<div class="ligne"><span class="pastille" style="background:${v.couleur}"></span><div class="txt"><div class="t1">${v.nom} · ${nf(v.hab)} habitants</div><div class="t2">${v.tuiles.length} hexagone${v.tuiles.length > 1 ? 's' : ''} · ${{ capitale: 'Capitale', ville: 'Ville', village: 'Village' }[v.rang]} fondée en ${v.fondee || 1900} · prochaine extension en ${v.prochaine}</div></div><div class="val">${nf(v.dem || 0)}<small>MW · ${v.servie ? 'alimentée' : 'coupée'}</small></div></div>`).join('')}
    <div class="section">Alertes</div>
    ${alertes().map(([g, t]) => `<div class="journal-l ${g}"><span class="d">${g === 'mauvais' ? 'CRITIQUE' : g === 'alerte' ? 'ATTENTION' : 'INFO'}</span><span class="t">${t}</span></div>`).join('') || '<p class="vide">Aucune alerte.</p>'}
    ${S.rapports.length ? `<div class="section">Bilans annuels</div><table class="tab"><thead><tr><th>Année</th><th>Bas carbone</th><th>Coupure</th><th>Résultat</th></tr></thead><tbody>${S.rapports.slice(-6).reverse().map(r => `<tr><td>${r.an}</td><td>${nf(r.bas)} %</td><td>${nf(r.coupure)} min</td><td>${nf(r.res / 1e6)} M€</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="section">Journal</div>${S.journal.slice(0, 12).map(e => `<div class="journal-l ${e.genre}"><span class="d">${jourTxt(e.m).split(' ').slice(1).join(' ')} ${hhmm(e.m)}</span><span class="t">${e.t}</span></div>`).join('')}
    <div class="btns"><button type="button" class="btn secondaire petit" data-act="onglet" data-id="journal">Tout le journal</button></div>`;
}
let N1C = [], N1T = 0;
function n1Cache() { if (performance.now() - N1T > 1500) { N1C = n1(); N1T = performance.now(); } return N1C; }
function alertes() {
  const a = [];
  if (S.evt.cyber > S.min) return [['mauvais', `Cyberattaque : la supervision est tombée jusqu’au ${dateTxt(S.evt.cyber)}. Plus d’alertes ni de prévisions.`]];
  if (S.evt.secheresse > S.min) a.push(['alerte', `Sécheresse : la rivière manque d’eau pour les prises d’eau et pour refroidir les centrales. Arbitrez dans l’onglet Eau (priorité ${S.eau.prioRiv === 'centrales' ? 'aux centrales' : 'à l’eau potable'}).`]);
  if (S.evt.canicule > S.min) a.push(['alerte', 'Canicule : centrales bridées, demande d’eau en hausse, odeurs des déchets et bacs qui fermentent. Les trois réseaux sont sous tension.']);
  { const arret = UNITES.filter(u => !u.fin && alimente(u) < 1); if (arret.length) a.push(['mauvais', `Coupure en cascade : ${arret.length} ouvrage${arret.length > 1 ? 's' : ''} d’eau ou de déchets ${S.crise ? 'au ralenti' : 'à l’arrêt'} faute d’électricité.`]); }
  if ((S.dec.dd || 0) > 100) a.push(['alerte', `${nf(S.dec.dd)} t de déchets dangereux industriels stockés sur place : risque de fuite vers la rivière.`]);
  for (const v of VILLES) if (!v.servie) a.push(['mauvais', `${v.nom} n’est reliée à aucune source : tirez une ligne 63 kV depuis un poste.`]);
  if (S.delestage > 1) a.push(['mauvais', `Délestage en cours : ${nf(S.delestage)} MW coupés.`]);
  for (const u of UNITES) if (u.panne > S.min) a.push(['mauvais', `${u.nom} en panne jusqu’au ${dateTxt(u.panne)}.`]);
  for (const u of UNITES) if (!u.fin && TYPES[u.type].mw && !raccordee(u)) a.push(['alerte', `${u.nom} n’est pas raccordée au réseau.`]);
  for (const b of BR) if (actifB(b) && b.taux > .8) a.push([b.taux > 1 ? 'mauvais' : 'alerte', `${b.type === 'T' ? b.nom : 'Ligne ' + b.nom} chargée à ${nf(b.taux * 100)} %.`]);
  for (const r of n1Cache().slice(0, 4)) a.push(['alerte', `N-1 : perte de « ${r.el} » → ${r.cons}.`]);
  if (annee(S.min) >= 2030 && UNITES.some(estCharbon)) a.push(['alerte', annee(S.min) >= 2032 ? 'Charbon encore en service : 40 M€ d’amende par an.' : `Sortie du charbon obligatoire avant le 1er janvier 2032.`]);
  for (const [k, f] of Object.entries(S.evt)) if (f > S.min) a.push(['alerte', `${NOM_EVT[k]} jusqu’au ${dateTxt(f)}.`]);
  const an = annee(S.min);
  for (const v of VILLES) if (!v.res && an >= 1920) a.push([an >= 1950 ? 'mauvais' : 'alerte', `${v.nom} n’a pas de réseau d’eau : reliez un captage avec l’outil Conduite (vue Eau).`]);
  if (S.eau.acc && S.eau.acc.fin > S.min) a.push(['mauvais', `${S.eau.acc.nom} près de ${S.eau.acc.lieu} : captages touchés à couper (vue Eau).`]);
  for (const c of (S.eau.crises || []).filter(c => c.fin > S.min)) a.push(['mauvais', `${c.nom} à ${c.v} jusqu’au ${dateTxt(c.fin)}.`]);
  for (const C of RESEAUX) { if (!C.conf) a.push(['mauvais', `Eau non conforme à ${C.villes.map(v => v.nom).join(', ')} : ${C.defauts.join(', ')}.`]); if (C.taux < .95) a.push(['alerte', `Pénurie d’eau à ${C.villes.map(v => v.nom).join(', ')} : ${pc(C.taux)} des besoins servis.`]); }
  if (S.eau.nappe < .3) a.push(['alerte', `La nappe baisse (${pc(S.eau.nappe)}) : les forages produisent moins.`]);
  if (besoinCamions() > S.dec.camions + .3) a.push(['alerte', `Pas assez de camions de collecte : ${S.dec.camions} pour un besoin de ${nf(Math.ceil(besoinCamions()))} (onglet Déchets).`]);
  if (S.dec.greve > S.min) a.push(['mauvais', `Grève de la collecte des déchets jusqu’au ${dateTxt(S.dec.greve)}.`]);
  for (const v of VILLES) if (v.deborde) a.push(['alerte', `Les poubelles de ${v.nom} débordent.`]);
  { const de = etatDecharges(); if (de.reste <= 0) a.push(['mauvais', 'Décharges pleines : export d’urgence des déchets.']); else if (de.ans < 2) a.push(['alerte', `Les décharges seront pleines dans ${nf(de.ans * 12)} mois.`]); }
  if (an >= 1970 && (S.eau.epure ?? 1) < .8) a.push(['alerte', `Seulement ${pc(S.eau.epure ?? 0)} des eaux usées sont épurées : la rivière se dégrade${an >= 1992 ? ' et les amendes tombent' : ''}.`]);
  return a;
}
function marge() { return UNITES.filter(u => actifU(u) && !TYPES[u.type].fatal && TYPES[u.type].mw).reduce((a, u) => a + capDispo(u) - Math.max(0, u.p), 0) + Math.max(0, (IMP.cap || 0) - IMP.p); }
function panneauDispatch() {
  const [et, coul] = etatFreq(S.f), prod = PROD();
  const batt = UNITES.filter(u => u.type === 'batterie' && !u.fin);
  return `<div class="encart"><div class="freq"><span class="hz" style="color:${coul}">${nf(S.f, 2)} Hz</span><span class="etat" style="background:${coul}">${et}</span></div>
    <canvas id="g-freq" class="graphe" height="56"></canvas>
    <div class="stat"><span>Demande + pertes</span><b>${nf(S.charge + S.pertes)} MW</b><span>Production locale</span><b>${nf(prod - IMP.p)} MW</b><span>${IMP.p >= 0 ? 'Import' : 'Export'} région voisine</span><b>${nf(Math.abs(IMP.p))} / ${nf(IMP.cap || 0)} MW</b><span>Marge de réserve</span><b>${nf(marge())} MW</b><span>Prix spot</span><b>${nf(S.spot)} €/MWh</b>${S.ecretement > 1 ? `<span>Écrêtement</span><b>${nf(S.ecretement)} MW</b>` : ''}${S.delestage > 1 ? `<span>Délestage</span><b class="neg">${nf(S.delestage)} MW</b>` : ''}</div></div>
    <div class="section">Courbe de charge et production · 24 h</div>
    <canvas id="g-charge" class="graphe" height="200"></canvas>
    <div class="leg">${Object.entries(FIL).map(([, [n, c]]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}<span><i style="background:#fff"></i>Demande</span></div>
    <div class="section">Production fatale</div>
    ${UNITES.filter(u => TYPES[u.type].fatal && !u.fin).map(u => ligneUnite(u)).join('') || '<p class="vide">Aucune.</p>'}
    <div class="section">Ordre d’appel (merit order)</div>
    ${S.ordre.map((id, i) => { const u = unite(id); return u ? ligneUnite(u, i) : ''; }).join('')}
    <div class="btns"><button type="button" class="btn secondaire petit" data-act="trier" ${S.ordreManuel ? '' : 'disabled'}>${S.ordreManuel ? 'Revenir à l’ordre automatique' : 'Ordre automatique par coût marginal'}</button></div>
    <div class="section">Stockage et flexibilité</div>
    ${batt.map(u => `<div class="encart"><h3>${u.nom} · ${nf(u.p)} MW</h3><div class="barre-l"><span>Charge</span><div class="jauge"><i style="width:${u.soc * 100}%;background:var(--vert)"></i></div><span>${nf(u.soc * (u.mwh || 200))} MWh</span></div>
      <div class="onglets">${[['auto', 'Auto'], ['charge', 'Charger'], ['decharge', 'Décharger'], ['arret', 'Arrêt']].map(([k, n]) => `<button type="button" data-act="batt" data-id="${u.id}" data-mode="${k}" class="${u.mode === k ? 'actif' : ''}">${n}</button>`).join('')}</div></div>`).join('') || `<p class="vide">${rd('li') ? 'Aucune batterie construite.' : 'Batteries : recherche « Batteries lithium-ion » nécessaire.'}</p>`}
    ${UNITES.filter(u => u.type === 'barrage' && !u.fin).map(u => `<div class="barre-l"><span>${u.nom.replace('Barrage ', '')}</span><div class="jauge"><i style="width:${u.soc * 100}%;background:#4f8fe0"></i></div><span>lac ${nf(u.soc * 100)} %</span></div>`).join('')}
    <div class="encart"><h3>Effacement industriel</h3><p>Contrats avec les industriels : −8 % de demande industrielle pendant les tensions.</p>
      ${rd('effac') ? `<button type="button" class="btn ${S.effacement ? '' : 'secondaire'}" data-act="effacement">${S.effacement ? 'Effacement actif : arrêter' : 'Activer l’effacement'}</button>` : '<p class="verrou">Recherche « Effacement industriel » nécessaire.</p>'}</div>`;
}
function ligneUnite(u, i = -1) {
  const ty = u === IMP ? { f: 'import', ramp: 50 } : TYPES[u.type], c = FIL[ty.f][1], cap = u === IMP ? (IMP.cap || 0) : u.cap;
  const etat = u === IMP ? '' : u.panne > S.min ? ' · en panne' : !u.dispo ? ' · à l’arrêt' : !raccordee(u) ? ' · non raccordée' : '';
  return `<div class="ligne"><span class="pastille" style="background:${c}"></span><div class="txt"><div class="t1">${i >= 0 ? i + 1 + '. ' : ''}${u.nom}</div><div class="t2">${i >= 0 ? `${nf(coutMarginal(u))} €/MWh · ` : ''}rampe ${ty.ramp >= 99 ? 'instantanée' : ty.ramp + ' MW/min'}${ty.min ? ' · min ' + ty.min + ' MW' : ''}${etat}</div>
    <div class="barre-l"><span>${actifU(u) ? 'Production' : 'Arrêt'}</span><div class="jauge"><i style="width:${clamp(Math.abs(u.p) / Math.max(1, cap), 0, 1) * 100}%;background:${c}"></i></div><span>${nf(u.p)} / ${nf(cap)}</span></div></div>
    ${i >= 0 ? `<div class="btns-col"><button type="button" class="btn mini secondaire" data-act="ordre" data-id="${u.id}" data-dir="-1" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="btn mini secondaire" data-act="ordre" data-id="${u.id}" data-dir="1" aria-label="Descendre" ${i === S.ordre.length - 1 ? 'disabled' : ''}>▼</button></div>` : ''}</div>`;
}
let catOnglet = 'production';
function panneauConstruire() {
  const liste = Object.entries(TYPES).filter(([, t]) => !t.cache && t.groupe === catOnglet);
  return `<div class="onglets">${[['production', 'Production'], ['reseau', 'Réseau'], ['stockage', 'Stockage'], ['eau', 'Eau'], ['dechets', 'Déchets']].map(([k, n]) => `<button type="button" data-act="cat" data-id="${k}" class="${catOnglet === k ? 'actif' : ''}">${n}</button>`).join('')}</div>
    ${liste.filter(([k, t]) => !(t.fin && annee(S.min) > t.fin)).map(([k, t]) => { const futur = t.an > annee(S.min), verrou = futur || (t.rd && !rd(t.rd)); return `<div class="ligne"><span class="pastille" style="background:${t.f ? FIL[t.f][1] : t.r === 'eau' ? '#38b6ff' : t.r === 'dechets' ? '#f0a35e' : '#d6dccb'}"></span><div class="txt"><div class="t1">${t.nom}${t.mw ? ' · ' + nf(t.mw) + ' MW' : t.r && capTexte(t) ? ' · ' + capTexte(t) : ''}</div>
      <div class="t2">${t.non}${t.co2 !== undefined && t.mw ? ` · ${nf(t.co2)} gCO₂/kWh` : ''}${t.cout || k === 'fioul' ? ` · ${nf(prixCombustible(k, annee(S.min)))} €/MWh` : ''}${t.reseau ? ` · raccordement ${t.reseau} kV` : ''}</div>
      <div class="t3">${prixM(coutType(k))} M€ · chantier ${delaiType(k)} mois${t.opex ? ` · ${nf(t.opex)} k€/MW/an` : ''}${t.opexE ? ` · ${nf(t.opexE)} k€/an` : ''}${t.opexT ? ` · ${nf(t.opexT * kDec())} €/t` : ''}</div></div>
      ${verrou ? `<button type="button" class="btn petit" disabled>${futur ? t.an : 'R&D'}</button>` : `<button type="button" class="btn petit" data-act="placer" data-id="${k}">Placer</button>`}</div>`; }).join('')}
    ${catOnglet === 'reseau' ? Object.entries(KV).map(([k, v]) => `<div class="ligne"><span class="pastille" style="background:${k == 15 ? '#cfcabd' : k == 63 ? '#c3b0ea' : k == 225 ? '#f08a6c' : '#ff5a4a'}"></span><div class="txt"><div class="t1">Ligne ${v.nom} · ${nf(v.cap)} MW</div><div class="t2">${k == 15 ? 'Poteaux en bois : villes et petites usines proches' : k == 63 ? 'Postes 225/63 kV, villes et petites centrales' : k == 225 ? 'Centrales, postes et interconnexion' : 'Grosses centrales et grands postes'}</div><div class="t3">${nf(v.cout, 1)} M€ par hexagone · ${v.delai} mois</div></div>
      ${v.an > annee(S.min) ? `<button type="button" class="btn petit" disabled>${v.an}</button>` : `<button type="button" class="btn petit" data-act="tracer" data-id="${k}">Tracer</button>`}</div>`).join('') + '<p class="verrou">Au début du siècle, les usines alimentent directement les villes en 15 kV. Plus tard : centrale → 225 kV → poste 225/63 kV → 63 kV → ville.</p>' : ''}
    ${catOnglet === 'eau' ? [['conduite', 'Conduite d’eau potable', 'Captage → usine → château d’eau → ville', COUT_TUYAU.p], ['egout', 'Égout', 'Ville → station d’épuration ou lagunage', COUT_TUYAU.a]].map(([k, n, d, c]) => `<div class="ligne"><span class="pastille" style="background:${k === 'egout' ? '#b07f4c' : '#3f9cff'}"></span><div class="txt"><div class="t1">${n}</div><div class="t2">${d}</div><div class="t3">${nf(c, 2)} M€ par hexagone · immédiat</div></div><button type="button" class="btn petit" data-act="placer" data-id="${k}">Tracer</button></div>`).join('') + '<p class="verrou">Une ville sans réseau boit l’eau des puits : de plus en plus mal vu au fil du siècle. La rivière doit être traitée avant d’être bue ; les eaux usées non épurées polluent l’aval.</p>' : ''}`;
}
function schemaReseau() {
  const xs = LISTE.filter(t => !t.brume), minX = Math.min(...xs.map(t => t.x)), maxX = Math.max(...xs.map(t => t.x)), minZ = Math.min(...xs.map(t => t.z)), maxZ = Math.max(...xs.map(t => t.z));
  const W = 400, H = W * (maxZ - minZ) / (maxX - minX) + 20, P = t => [10 + (t.x - minX) / (maxX - minX) * (W - 20), 10 + (t.z - minZ) / (maxZ - minZ) * (H - 20)], o = [];
  for (const l of LIGNES) { const pts = l.tuiles.map(P).map(p => p.join(',')).join(' '); o.push(`<polyline points="${pts}" fill="none" stroke="${coulTaux(l)}" stroke-width="${l.kv === 63 ? 2 : l.kv === 225 ? 3 : 4.5}" stroke-linejoin="round"${l.fin || l.hs > S.min ? ' stroke-dasharray="4 3"' : ''}><title>${l.nom} · ${nf(Math.abs(l.f))} MW</title></polyline>`); }
  for (const v of VILLES) { const [x, y] = P(v.centre); o.push(`<circle cx="${x}" cy="${y}" r="7" fill="${v.couleur}" stroke="#0f130e" stroke-width="2"/><text x="${x + 10}" y="${y + 3}">${v.nom}</text>`); }
  for (const u of UNITES.filter(u => !TYPES[u.type].r)) { const [x, y] = P(u.t), c = TYPES[u.type].f ? FIL[TYPES[u.type].f][1] : '#d6dccb'; o.push(u.type === 'poste' || u.type === 'frontiere' ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${u.type === 'frontiere' ? '#c3b0ea' : '#d6dccb'}" stroke="#0f130e" stroke-width="2"${u.fin ? ' opacity=".5"' : ''}/>` : `<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#0f130e" stroke-width="2"${u.fin ? ' opacity=".5"' : ''}><title>${u.nom}</title></circle>`); }
  return `<svg class="schema" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schéma géographique du réseau">${o.join('')}</svg>`;
}
function panneauReseau() {
  const def = n1Cache(), pn = S.pertesNiv, dem = Math.max(1, S.charge);
  const groupe = (titre, liste) => liste.length ? `<div class="section">${titre}</div>` + liste.map(l => { const hs = l.hs > S.min, c = coulTaux(l); return `<div class="ligne"><span class="pastille" style="background:${c}"></span><div class="txt"><div class="t1">${l.nom}</div><div class="t2">${l.type === 'T' ? '2 × 250 MVA' : `${KV[l.kv].nom} · ${l.len} hex. · ${nf(l.cap)} MW`} · ${l.fin ? `chantier jusqu’au ${dateTxt(l.fin)}` : hs ? 'déclenchée' : `transit ${nf(Math.abs(l.f))} MW`}</div>
    <div class="barre-l"><span>Charge</span><div class="jauge"><i style="width:${Math.min(1, l.taux) * 100}%;background:${c}"></i></div><span>${l.fin ? '—' : hs ? 'HS' : nf(l.taux * 100) + ' %'}</span></div></div>${l.type === 'L' ? `<button type="button" class="btn mini secondaire" data-act="demolir-ligne" data-id="${l.id}" aria-label="Démonter">✕</button>` : ''}</div>`; }).join('') : '';
  return `<div class="encart"><h3>Sécurité N-1</h3><p>${def.length ? `${def.length} ouvrage${def.length > 1 ? 's' : ''} ne respecte${def.length > 1 ? 'nt' : ''} pas le critère : leur perte provoque une coupure ou une surcharge.` : 'Le réseau supporte la perte de n’importe quelle ligne ou transformateur.'}</p>
    ${def.slice(0, 8).map(r => `<div class="journal-l alerte"><span class="d">N-1</span><span class="t">Perte de « ${r.el} » : ${r.cons}.</span></div>`).join('')}
    <div class="chips"><span class="chip ${def.length ? 'rouge' : 'vert'}">N-1 : ${def.length} défaut${def.length > 1 ? 's' : ''}</span><span class="chip">${LIGNES.length} lignes</span><span class="chip">${UNITES.filter(u => u.type === 'poste').length} postes</span><span class="chip">Import max ${nf(IMP.cap || 0)} MW</span></div></div>
    <div class="section">Schéma du réseau</div>${schemaReseau()}
    <div class="leg"><span><i style="background:#7be08a"></i>Normal</span><span><i style="background:#ffc94d"></i>Au-delà de 80 %</span><span><i style="background:#ff5a4a"></i>Surcharge</span><span>┄ Chantier ou déclenchée</span></div>
    <div class="section">Pertes en ligne · ${nf(S.pertes, 1)} MW (${nf(S.pertes / dem * 100, 1)} %)</div>
    <div class="stat"><span>400 kV</span><b>${nf(pn[400] || 0, 2)} MW</b><span>225 kV</span><b>${nf(pn[225] || 0, 2)} MW</b><span>63 kV</span><b>${nf(pn[63] || 0, 2)} MW</b><span>Transformateurs</span><b>${nf(pn.tr || 0, 2)} MW</b></div>
    ${groupe('Transport 400 et 225 kV', LIGNES.filter(l => l.kv > 63))}${groupe('Postes 225/63 kV', BR.filter(b => b.type === 'T'))}${groupe('Répartition 63 kV', LIGNES.filter(l => l.kv === 63))}
    <div class="section">Délestage automatique</div>
    <div class="stat"><span>1. Résidentiel</span><b>sous 49,0 Hz</b><span>2. Tertiaire</span><b>sous 48,8 Hz</b><span>3. Industrie</span><b>sous 48,5 Hz</b><span>Hôpitaux</span><b>jamais</b></div>`;
}
function panneauMeteo() {
  const w = meteo(S.min), s = soleil(S.min), err = rd('previ') ? .5 : 1;
  const eol = UNITES.filter(u => TYPES[u.type].f === 'eolien' && !u.fin).reduce((a, u) => a + u.cap, 0);
  const jours = [1, 2, 3].map(k => { const m = S.min + k * 1440, ws = []; for (let h = 0; h < 24; h += 3) ws.push(meteo(m - heure(S.min) * 60 + h * 60)); return { m, vm: ws.reduce((a, x) => a + x.vent, 0) / 8, nm: ws.reduce((a, x) => a + x.neb, 0) / 8, tm: [Math.min(...ws.map(x => x.temp)), Math.max(...ws.map(x => x.temp))], err: [.1, .18, .28][k - 1] * err }; });
  return `<div class="encart"><h3>En ce moment · ${hhmm(S.min)} · ${saison(S.min)}</h3><div class="chips"><span class="chip">Vent ${nf(w.vent, 1)} m/s</span><span class="chip">Nébulosité ${nf(w.neb * 100)} %</span><span class="chip">${nf(w.temp, 1)} °C</span><span class="chip">Débit ×${nf(w.debit, 2)}</span><span class="chip">Soleil ${nf(Math.max(0, s.el * 180 / Math.PI))}°</span></div></div>
    <div class="section">Vent prévu · 72 h · fourchette d’incertitude</div><canvas id="g-meteo" class="graphe" height="150"></canvas>
    <div class="section">Prévisions J+1 à J+3</div>
    ${S.evt.cyber > S.min ? '<p class="vide">Prévisions indisponibles : cyberattaque en cours.</p>' : ''}<table class="tab"${S.evt.cyber > S.min ? ' hidden' : ''}><thead><tr><th>Jour</th><th>Vent</th><th>Nuages</th><th>Temp.</th><th>Éolien</th></tr></thead><tbody>
    ${jours.map(j => `<tr><td>${jourTxt(j.m)}</td><td>${nf(j.vm, 1)} <small>±${nf(j.vm * j.err, 1)}</small></td><td>${nf(j.nm * 100)} %</td><td>${nf(j.tm[0])} à ${nf(j.tm[1])} °C</td><td>${nf(eol * courbeEol(j.vm) * 24)} <small>MWh</small></td></tr>`).join('')}</tbody></table>
    <p class="verrou">${rd('previ') ? 'Prévisions fines actives : incertitude divisée par deux.' : 'Recherche « Prévisions météo fines » pour réduire l’incertitude.'}</p>`;
}
function panneauEconomie() {
  const j = S.jour, res = j.ventes + j.exp - j.comb - j.carbone - j.imp - j.opex - j.rd - j.prets - j.amendes, an = S.anPrec;
  return `<div class="encart"><h3>Aujourd’hui depuis minuit</h3><div class="stat">
    <span>Ventes d’électricité</span><b class="pos">+${euros(j.ventes)}</b><span>Export vers l’Est</span><b class="pos">+${euros(j.exp)}</b>
    <span>Combustibles</span><b class="neg">−${euros(j.comb)}</b><span>Taxe carbone (${nf(prixCO2())} €/t)</span><b class="neg">−${euros(j.carbone)}</b>
    <span>Achats d’import</span><b class="neg">−${euros(j.imp)}</b><span>Exploitation, réseau et personnel</span><b class="neg">−${euros(j.opex)}</b>
    <span>Recherche</span><b class="neg">−${euros(j.rd)}</b><span>Remboursement des prêts</span><b class="neg">−${euros(j.prets)}</b>${j.amendes ? `<span>Amende charbon</span><b class="neg">−${euros(j.amendes)}</b>` : ''}
    <span><b>Résultat</b></span><b class="${res < 0 ? 'neg' : 'pos'}">${res < 0 ? '−' : '+'}${euros(Math.abs(res))}</b></div></div>
    ${an ? `<p class="verrou">Année précédente : ${nf((an.ventes + an.exp - an.comb - an.carbone - an.imp - an.opex - an.rd - an.prets - an.amendes) / 1e6)} M€ de résultat, ${nf(an.capex / 1e6)} M€ investis.</p>` : ''}
    <div class="section">Tarifs de vente</div>
    ${[['res', 'Résidentiel', 'Au-delà de 170 €/MWh, la satisfaction baisse'], ['ter', 'Tertiaire et services', 'Au-delà de 150 €/MWh, la satisfaction baisse'], ['ind', 'Industriel', 'Tarif négocié avec les usines']].map(([k, n, d]) => `<div class="ligne"><div class="txt"><div class="t1">${n}</div><div class="t2">${d}</div></div><button type="button" class="btn mini secondaire" data-act="tarif" data-id="${k}" data-dir="-2" aria-label="Baisser">−</button><span class="val">${S.tarif[k]}<small>€/MWh</small></span><button type="button" class="btn mini secondaire" data-act="tarif" data-id="${k}" data-dir="2" aria-label="Augmenter">+</button></div>`).join('')}
    <div class="section">Marché</div>
    <div class="chips"><span class="chip or">Spot ${nf(S.spot)} €/MWh</span><span class="chip">Voisin Est ${nf(prixVoisin(S.min))} €/MWh</span><span class="chip">CO₂ ${nf(prixCO2())} €/t</span>${S.evt.gaz > S.min ? '<span class="chip rouge">Gaz +60 %</span>' : ''}</div>
    <canvas id="g-spot" class="graphe" height="90" style="margin-top:8px"></canvas>
    <div class="section">Financement · dette ${nf(S.dette / 1e6)} M€</div>
    ${S.prets.map(p => `<div class="ligne"><div class="txt"><div class="t1">Prêt de ${nf(p.capital / 1e6)} M€ à ${nf(p.taux * 100, 1)} %</div><div class="t2">Annuité ${nf(p.annuite / 1e6, 1)} M€ · encore ${p.reste} ans</div></div></div>`).join('') || '<p class="vide">Aucun prêt en cours.</p>'}
    <div class="btns"><button type="button" class="btn petit" data-act="emprunt" data-id="${taillePret()}" data-duree="20" ${S.dette > detteMax() * .9 ? 'disabled' : ''}>Emprunter ${nf(taillePret())} M€ sur 20 ans</button><button type="button" class="btn petit secondaire" data-act="emprunt" data-id="${taillePret() * 5}" data-duree="25" ${S.dette > detteMax() * .5 ? 'disabled' : ''}>Emprunter ${nf(taillePret() * 5)} M€ sur 25 ans</button></div>`;
}
function panneauRD() {
  const c = S.rd.cours ? RDI[S.rd.cours] : null;
  return `<div class="encart"><h3>${c ? `En cours : ${c.nom}` : 'Aucune recherche en cours'}</h3>
    ${c ? `<div class="barre-l"><span>Avancement</span><div class="jauge"><i style="width:${S.rd.avance / c.cout * 100}%;background:var(--or)"></i></div><span>${nf(S.rd.avance, 1)} / ${c.cout} M€</span></div><p>Fin estimée : ${dateTxt(S.min + (c.cout - S.rd.avance) / S.rd.budget * 365 * 1440)}.</p>` : '<p>Choisissez une technologie disponible ci-dessous.</p>'}
    <div class="onglets">${[5, 10, 25, 50].map(b => `<button type="button" data-act="budget" data-id="${b}" class="${S.rd.budget === b ? 'actif' : ''}">${b} M€/an</button>`).join('')}</div></div>
    ${BRANCHES.map((bn, bi) => `<div class="section">${bn}</div>${RD.filter(r => r.b === bi).map(r => { const ok = rd(r.id), cours = S.rd.cours === r.id, dispo = rdDispo(r); return `<div class="ligne"><div class="txt"><div class="t1">${r.nom}</div><div class="t2">${r.effet} · ${r.cout} M€${r.an ? ` · à partir de ${r.an}` : ''}</div>
      <div class="etapes">${[1, 2, 3, 4, 5].map(k => `<span class="${k < r.niv || (k === r.niv && ok) ? 'ok' : k === r.niv && cours ? 'cours' : ''}"></span>`).join('')}</div>${!ok && !dispo && r.pre ? `<div class="t3">Prérequis : ${r.pre.map(p => RDI[p].nom).join(', ')}</div>` : ''}</div>
      ${ok ? '<span class="chip vert">Acquise</span>' : cours ? `<span class="chip or">${nf(S.rd.avance / r.cout * 100)} %</span>` : `<button type="button" class="btn petit" ${dispo ? `data-act="rd" data-id="${r.id}"` : 'disabled'}>${dispo ? 'Lancer' : annee(S.min) < (r.an || 0) ? `En ${r.an}` : 'Verrouillée'}</button>`}</div>`; }).join('')}`).join('')}`;
}
function panneauJournal() { return S.journal.map(e => `<div class="journal-l ${e.genre}"><span class="d">${jourTxt(e.m).split(' ').slice(1).join(' ')} ${hhmm(e.m)}</span><span class="t">${e.t}</span></div>`).join('') || '<p class="vide">Rien pour l’instant.</p>'; }
let confirmer = null;
function panneauHex() {
  const t = selT; if (!t) return '<p class="vide">Cliquez sur un hexagone de la carte.</p>';
  let h = `<p class="verrou" style="margin-top:0">Hexagone ${t.col + 1}·${t.row + 1}${t.terr ? ` · territoire de ${t.terr.nom}` : ''} · ${t.ville ? 'Ville' : TERR[t.brume ? 'brume' : t.t].nom}</p>`;
  if (t.ville) {
    const v = t.ville;
    h += `<div class="encart"><h3>${v.nom} · ${nf(v.hab)} habitants</h3><div class="stat"><span>Demande</span><b>${nf(v.dem || 0)} MW</b><span>Alimentation</span><b style="color:var(${v.servie ? '--vert' : '--rouge'})">${v.servie ? 'Raccordée' : 'Coupée'}</b></div>
      ${v.tuiles.map(x => `<div class="barre-l"><span style="width:auto;flex:1">${x === t ? '▸ ' : ''}${QUART[x.quartier].nom}</span><span>${nf(QUART[x.quartier].mw * facteurDemande(), 1)} MW</span></div>`).join('')}</div>
      <p class="verrou">Les villes se raccordent en 63 kV sur leur centre. Elles s’étendent sur les hexagones libres voisins au fil des années.</p>${blocVilleEau(v)}${blocVilleDec(v)}`;
  } else if (t.occ) {
    const u = t.occ, ty = TYPES[u.type];
    h += `<div class="encart"><h3>${u.nom}</h3><div class="chips">${ty.f ? `<span class="chip" style="background:${FIL[ty.f][1]};color:var(--trait)">${FIL[ty.f][0]}</span>` : ''}<span class="chip">${u.fin ? 'Chantier' : u.panne > S.min ? 'En panne' : !u.dispo ? 'À l’arrêt' : ty.r || raccordee(u) ? 'En service' : 'Non raccordée'}</span></div>
      ${u.fin ? `<div class="barre-l"><span>Chantier</span><div class="jauge"><i style="width:${avancement(u) * 100}%;background:var(--or)"></i></div><span>${nf(avancement(u) * 100)} %</span></div><p>Mise en service le ${dateTxt(u.fin)}.</p>` : ''}
      ${ty.mw ? `<div class="barre-l"><span>Puissance</span><div class="jauge"><i style="width:${clamp(Math.abs(u.p) / u.cap, 0, 1) * 100}%;background:${FIL[ty.f][1]}"></i></div><span>${nf(u.p)} / ${nf(u.cap)}</span></div>` : ''}
      <div class="stat">${ty.mw ? `<span>Coût marginal</span><b>${nf(coutMarginal(u))} €/MWh</b><span>Émissions</span><b>${nf(co2U(u))} gCO₂/kWh</b><span>Rampe</span><b>${ty.ramp >= 99 ? 'instantanée' : ty.ramp + ' MW/min'}</b>` : ''}${ty.min ? `<span>Minimum technique</span><b>${ty.min} MW</b>` : ''}${u.type === 'poste' ? '<span>Transformation</span><b>2 × 250 MVA</b>' : ''}${ty.reseau ? `<span>Raccordement conseillé</span><b>${ty.reseau} kV</b>` : ''}${u.type === 'barrage' || u.type === 'batterie' ? `<span>Réserve</span><b>${nf(u.soc * 100)} %</b>` : ''}</div></div>
      ${u.type === 'frontiere' ? '' : `<div class="btns">${ty.mw && !u.fin && !ty.fatal ? `<button type="button" class="btn ${u.dispo ? 'secondaire' : ''} petit" data-act="arret" data-id="${u.id}">${u.dispo ? 'Mettre à l’arrêt' : 'Recoupler'}</button>` : ''}
        </div>${estEauU(u) ? blocEauHex(u) : estDecU(u) ? blocDecHex(u) : ''}${blocAmelio(u)}${blocAge(u)}${alimente(u) < 1 ? `<p class="verrou" style="color:var(--rouge)">Ville voisine privée d’électricité : ${alimente(u) ? 'tourne au ralenti sur les groupes du plan de crise' : 'à l’arrêt (coupure en cascade)'}.</p>` : ''}${CHALEUR[u.type] && !u.fin ? `<p class="verrou">Source de chaleur : ${nf(CHALEUR[u.type](u), 1)} MW thermiques ${CHAUD.some(C => C.unites.includes(u)) ? 'pour le réseau de chaleur' : 'perdus : reliez-la à une ville avec l’outil Chaleur'}.</p>` : ''}<div class="btns"><button type="button" class="btn danger petit" data-act="demolir" data-id="${u.id}">${confirmer === u.id ? `Confirmer : ${estCharbon(u) ? `fermeture ${nf(Math.max(.5, u.cap * .07), 1)} M€` : 'démolir'}` : estCharbon(u) ? 'Fermer définitivement' : 'Démolir'}</button></div>`}`;
  }
  const ls = LIGNES.filter(l => l.a === bout(t) || l.b === bout(t));
  if (ls.length) h += `<div class="section">Lignes raccordées</div>` + ls.map(l => `<div class="ligne"><span class="pastille" style="background:${coulTaux(l)}"></span><div class="txt"><div class="t1">${KV[l.kv].nom} · ${l.nom}</div><div class="t2">${l.fin ? 'chantier' : l.hs > S.min ? 'déclenchée' : `${nf(Math.abs(l.f))} MW · ${nf(l.taux * 100)} %`}</div></div><button type="button" class="btn mini secondaire" data-act="demolir-ligne" data-id="${l.id}" aria-label="Démonter">✕</button></div>`).join('');
  if (!t.brume && !t.ville && !t.occ) {
    h += `<div class="section">Potentiel du site</div>
      <div class="barre-l"><span>Soleil</span><div class="jauge"><i style="width:${(t.soleil - 1) / 4 * 100}%;background:#ffb340"></i></div><span>${nf(900 + t.soleil * 110)} h</span></div>
      <div class="barre-l"><span>Vent</span><div class="jauge"><i style="width:${(t.vent - 3) / 7 * 100}%;background:#4f9be0"></i></div><span>${nf(t.vent, 1)} m/s</span></div>
      <div class="barre-l"><span>Acceptation</span><div class="jauge"><i style="width:${t.accept}%;background:${t.accept > 35 ? '#7be08a' : '#ff8a7a'}"></i></div><span>${nf(t.accept)} %</span></div>
      <div class="barre-l"><span>Nappe</span><div class="jauge"><i style="width:${t.nappe * 100}%;background:#38b6ff"></i></div><span>${pc(t.nappe)}</span></div>
      <div class="barre-l"><span>Nitrates</span><div class="jauge"><i style="width:${t.nitr * 100}%;background:#b4560f"></i></div><span>${t.nitr > .6 ? 'sensible' : 'faible'}</span></div>
      ${t.ferme ? `<p class="verrou">Ferme ${t.ferme === 'culture' ? 'céréalière' : 'd’élevage'} : construire ici la fera disparaître.${t.ferme === 'culture' && t.dr <= 2 ? ' Elle irrigue l’été en prélevant dans la rivière.' : ''}</p>` : ''}
      ${recours(t) ? `<p class="verrou">${textesRecours[recours(t)]}.</p>` : ''}
      <div class="section">Ce qu’on peut poser ici</div><div class="regles">${(vue === 'eau' ? ORDRE_EAU : vue === 'elec' ? ORDRE_BARRE : vue === 'dechets' ? ORDRE_DEC : [...ORDRE_BARRE, ...ORDRE_EAU, ...ORDRE_DEC]).map(k => { const r = raison(t, k); return `<div class="regle${r ? '' : ' ok'}">${r ? '✕' : '✓'} ${TYPES[k].court}${r ? `<small>${r}</small>` : ''}</div>`; }).join('')}</div>`;
  } else if (t.brume) h += '<p class="vide">Ces terres sont hors de la région concédée.</p>';
  return h;
}
// ------------------------------------------------------------ panneaux de l'eau
const pc = (x, d = 0) => nf(x * 100, d) + ' %';
function statsEau() {
  const j = S.jourPrec || S.jour, E = S.eau, a = annee(S.min);
  const vol = RESEAUX.reduce((s, c) => s + (c.vol || 0), 0), dem = VILLES.reduce((s, v) => s + (v.m3d || 0), 0) * 96;
  const ar = [...ARETES.values()].filter(e => e.f === 'p'), age = ar.length ? ar.reduce((s, e) => s + a - e.an, 0) / ar.length : 0;
  const fuite = RESEAUX.length ? RESEAUX.reduce((s, c) => s + c.fuite * c.dem, 0) / Math.max(1, RESEAUX.reduce((s, c) => s + c.dem, 0)) : 0;
  return { j, vol, dem, age, rend: 1 - fuite, prod: RESEAUX.reduce((s, c) => s + (c.prod || 0), 0) * 96, reserve: dem > 0 ? vol / dem : 0, prix: E.tarif * kEau(a) };
}
function panneauEau() {
  const E = S.eau, st = statsEau(), a = annee(S.min), w = meteo(S.min), nm = POLL.filter(p => a >= p[4]);
  const jours = [1, 2, 3, 4, 5, 6, 7].map(k => { const m = S.min + k * 1440 - heure(S.min) * 60, ws = [9, 15].map(h => meteo(m + h * 60)); return { m, t: Math.max(...ws.map(x => x.temp)), q: ws[0].debit }; });
  return `<div class="kpis">
      ${kpi('Besoins servis', pc(E.taux ?? 1), '', E.taux ?? 1, (E.taux ?? 1) > .97 ? 'var(--vert)' : 'var(--orange)')}${kpi('Eau conforme', pc(E.conf ?? 1), '', E.conf ?? 1, (E.conf ?? 1) > .97 ? 'var(--vert)' : 'var(--rouge)')}
      ${kpi('Réserve', nf(st.reserve * 24, 1), 'h', st.reserve, 'var(--eau)')}${kpi('Rendement du réseau', pc(st.rend), '', st.rend, st.rend > .8 ? 'var(--vert)' : 'var(--orange)')}
      ${kpi('Eaux usées épurées', pc(E.epure ?? 0), '', E.epure ?? 0, (E.epure ?? 0) > .9 ? 'var(--vert)' : 'var(--orange)')}${kpi('Âge moyen des conduites', nf(st.age), 'ans', st.age / 80, st.age > 50 ? 'var(--rouge)' : 'var(--eau)')}
    </div>
    ${S.eau.acc && S.eau.acc.fin > S.min ? `<div class="journal-l mauvais"><span class="d">POLLUTION</span><span class="t">${S.eau.acc.nom} près de ${S.eau.acc.lieu}, jusqu’au ${dateTxt(S.eau.acc.fin)}. ${S.eau.acc.genre === 'riviere' ? 'Prises d’eau en aval touchées' : 'Captage contaminé'}${rd('alerte') ? ' : coupure automatique.' : ' : coupez les captages touchés depuis leur fiche.'}</span></div>` : ''}
    ${(S.eau.crises || []).filter(c => c.fin > S.min).map(c => `<div class="journal-l mauvais"><span class="d">CRISE</span><span class="t">${c.nom} à ${c.v}, jusqu’au ${dateTxt(c.fin)}.</span></div>`).join('')}
    <div class="encart"><h3>Ressource</h3>
      ${RIV.length ? `<div class="barre-l"><span>Rivière</span><div class="jauge"><i style="width:${clamp(w.debit / 1.6, 0, 1) * 100}%;background:var(--eau)"></i></div><span>${nf(debitRiv(RIV.length * .6, w), 1)} m³/s</span></div>` : ''}
      <div class="barre-l"><span>Nappe</span><div class="jauge"><i style="width:${E.nappe * 100}%;background:${E.nappe < .35 ? 'var(--orange)' : 'var(--eau)'}"></i></div><span>${pc(E.nappe)}</span></div>
      ${a >= 1955 ? `<div class="barre-l"><span>Nappe profonde</span><div class="jauge"><i style="width:${E.profonde * 100}%;background:var(--eau)"></i></div><span>${pc(E.profonde)}</span></div>` : ''}
      <div class="stat"><span>Production</span><b>${nf(st.prod)} m³/j</b><span>Demande</span><b>${nf(st.dem)} m³/j</b><span>Prix du m³ (eau et assainissement)</span><b>${nf(st.prix, 2)} €</b>${rd('reut') ? `<span>Eaux usées réutilisées</span><b>${nf((E.reutQ || 0) * 96)} m³/j</b>` : ''}</div></div>
    ${S.evt.secheresse > S.min ? `<div class="encart"><h3>Sécheresse : à qui la rivière ?</h3><p>La rivière ne suffit pas pour tout le monde. Priorité à l’eau potable : les centrales au bord de l’eau perdent 30 % de puissance. Priorité aux centrales : les prises d’eau perdent 40 %.</p><div class="onglets"><button type="button" data-act="prio-riv" data-id="eau" class="${S.eau.prioRiv !== 'centrales' ? 'actif' : ''}">Eau potable</button><button type="button" data-act="prio-riv" data-id="centrales" class="${S.eau.prioRiv === 'centrales' ? 'actif' : ''}">Centrales</button></div></div>` : ''}
    <div class="section">Prévisions à 7 jours</div>
    ${S.evt.cyber > S.min ? '<p class="vide">Prévisions indisponibles : cyberattaque en cours.</p>' : ''}<table class="tab"${S.evt.cyber > S.min ? ' hidden' : ''}><thead><tr><th>Jour</th><th>Temp. max</th><th>Débit</th></tr></thead><tbody>${jours.map(j => `<tr><td>${jourTxt(j.m)}</td><td>${nf(j.t)} °C</td><td>×${nf(j.q, 2)}</td></tr>`).join('')}</tbody></table>
    <div class="section">Réseaux d’eau potable</div>
    ${RESEAUX.map(C => `<div class="ligne"><span class="pastille" style="background:${C.conf ? (C.taux > .97 ? 'var(--vert)' : 'var(--orange)') : 'var(--rouge)'}"></span><div class="txt"><div class="t1">${C.villes.map(v => v.nom).join(', ')}</div>
      <div class="t2">${C.unites.length} ouvrage${C.unites.length > 1 ? 's' : ''} · ${nf((C.dispo || 0) * 96)} m³/j disponibles · fuites ${pc(C.fuite || 0)}${C.pression ? '' : ' · pression faible : construisez un château d’eau'}</div>
      ${C.volMax ? `<div class="barre-l"><span>Stock</span><div class="jauge"><i style="width:${(C.vol / C.volMax) * 100}%;background:var(--eau)"></i></div><span>${nf(C.vol)} m³</span></div>` : ''}
      ${C.conf ? '' : `<div class="t3" style="color:var(--rouge)">Non conforme : ${C.defauts.join(', ')}</div>`}</div><div class="val">${pc(C.taux || 0)}<small>servi</small></div></div>`).join('') || '<p class="vide">Aucun réseau : reliez un captage à une ville avec l’outil Conduite.</p>'}
    ${VILLES.filter(v => !v.res).map(v => `<div class="journal-l ${a >= 1930 ? 'mauvais' : 'alerte'}"><span class="d">SANS RÉSEAU</span><span class="t">${v.nom} boit l’eau des puits.</span></div>`).join('')}
    <div class="section">Normes en vigueur</div>
    <div class="chips">${nm.map(([, n, u, v]) => `<span class="chip">${n} ≤ ${nf(v)} ${u}</span>`).join('')}${POLL.filter(p => a < p[4]).slice(0, 2).map(([, n, , , an]) => `<span class="chip" style="opacity:.6">${n} en ${an}</span>`).join('')}</div>
    <div class="section">Gestion</div>
    <div class="ligne"><div class="txt"><div class="t1">Prix de l’eau</div><div class="t2">Au-delà de ${nf(3.6 * kEau(a), 2)} €/m³, la satisfaction baisse</div></div><button type="button" class="btn mini secondaire" data-act="tarif-eau" data-dir="-0.1" aria-label="Baisser">−</button><span class="val">${nf(st.prix, 2)}<small>€/m³</small></span><button type="button" class="btn mini secondaire" data-act="tarif-eau" data-dir="0.1" aria-label="Augmenter">+</button></div>
    <div class="encart"><h3>Restrictions d’usage</h3><p>Arrosage et lavage interdits : −15 % de demande, irrigation divisée par deux, mais les habitants n’aiment pas ça.</p><button type="button" class="btn ${E.restriction ? '' : 'secondaire'}" data-act="restriction">${E.restriction ? 'Lever les restrictions' : 'Imposer des restrictions'}</button></div>
    <div class="encart"><h3>Renouvellement des conduites</h3><p>${vieilles().length} tronçons ont plus de 30 ans. Les vieilles conduites fuient et cassent plus souvent.</p><button type="button" class="btn secondaire" data-act="renouveler" ${vieilles().length ? '' : 'disabled'}>Renouveler pour ${nf(coutRenouv() / 1e6, 1)} M€</button></div>`;
}
function blocEauHex(u) {
  const ty = TYPES[u.type], C = u.res, a = annee(S.min);
  let h = `<div class="stat"><span>Capacité</span><b>${capTexte(ty)}</b>`;
  if (ty.role === 'captage') h += `<span>Production</span><b>${nf((u.q || 0) * 96)} m³/j</b>${ty.qual === 'riviere' ? `<span>Débit de la rivière</span><b>${nf(debitRiv(u.rivI || 0, meteo(S.min)), 2)} m³/s</b>` : ''}${ty.qual === 'nappe' ? `<span>Niveau de la nappe</span><b>${pc(S.eau.nappe)}</b>` : ''}`;
  if (ty.role === 'stock') h += `<span>Niveau</span><b>${pc(u.niv ?? 0)}</b>`;
  if (ty.role === 'traitement') h += `<span>Eau traitée</span><b>${nf((u.q || 0) * 96)} m³/j</b>`;
  if (ty.role === 'epuration') h += `<span>Charge</span><b>${C ? pc(C.charge || 0) : '—'}</b><span>Boues de toutes les stations</span><b>${nf(bouesJour(), 1)} t/j</b>${u.reut ? `<span>Réutilisation</span><b>${nf(REUT[u.type][0])} m³/j</b>` : ''}`;
  if (S.eau.acc && touche0(u)) h += `<span>Pollution</span><b style="color:var(--rouge)">${S.eau.acc.nom}${u.dispo === false ? ' · captage coupé' : rd('alerte') ? ' · coupé automatiquement' : ''}</b>`;
  h += `<span>Réseau</span><b style="color:var(${C ? '--vert' : '--rouge'})">${C ? C.villes.map(v => v.nom).join(', ') : ty.role === 'epuration' ? 'Reliez-la à une ville avec l’outil Égout' : 'Reliez-le à une ville avec l’outil Conduite'}</b></div>`;
  if (u.type === 'potab' && !u.fin) {
    const et = u.etapes || ['sable'], dispo = Object.entries(ETAPES).filter(([k]) => !et.includes(k) && etapeOk(k)), futur = Object.entries(ETAPES).filter(([k]) => !et.includes(k) && !etapeOk(k));
    h += `<div class="section">Chaîne de traitement</div><div class="chaine">${et.map(k => `<span class="etape">${ETAPES[k].nom}</span>`).join('<span class="fleche">→</span>')}${futur.map(([, e]) => `<span class="fleche">+</span><span class="etape verrou">${e.nom} · ${a < e.an ? e.an : 'R&D'}</span>`).join('')}</div>
      <div class="btns">${dispo.map(([k, e]) => `<button type="button" class="btn petit secondaire" data-act="etape" data-id="${u.id}" data-k="${k}">+ ${e.nom} · ${e.cout} M€</button>`).join('')}</div>`;
  }
  if (ty.role === 'captage' && !u.fin) h += `<div class="btns"><button type="button" class="btn ${u.dispo === false ? '' : 'secondaire'} petit" data-act="arret" data-id="${u.id}">${u.dispo === false ? 'Rouvrir le captage' : 'Couper le captage'}</button></div>`;
  if (REUT[u.type] && !u.fin && !u.reut) h += `<div class="btns"><button type="button" class="btn petit secondaire" data-act="reut" data-id="${u.id}" ${rd('reut') ? '' : 'disabled'}>${rd('reut') ? `Équiper pour la réutilisation · ${nf(REUT[u.type][1], 1)} M€` : 'Réutilisation : recherche nécessaire'}</button></div>`;
  if (C && C.qual && ty.role !== 'epuration') h += `<div class="section">Qualité de l’eau distribuée</div>${POLL.map(([k, n, un, nor, an]) => { const v = C.qual[k], act = a >= an; return `<div class="barre-l"><span style="width:110px">${n}</span><div class="jauge"><i style="width:${clamp(v / nor / 2, 0, 1) * 100}%;background:${!act ? '#6b6f68' : v > nor ? 'var(--rouge)' : 'var(--eau)'}"></i></div><span>${act ? (v > nor ? 'hors norme' : 'conforme') : 'pas de norme'}</span></div>`; }).join('')}<p class="verrou">La barre marque la norme à mi-longueur.</p>`;
  return h;
}
function blocVilleEau(v) {
  const C = v.res;
  return `<div class="encart"><h3>Eau de ${v.nom}</h3><div class="stat"><span>Besoin</span><b>${nf((v.m3d || 0) * 96)} m³/j</b><span>Servi</span><b style="color:var(${!C ? '--rouge' : C.taux > .97 ? '--vert' : '--orange'})">${C ? pc(C.taux || 0) : 'puits (pas de réseau)'}</b>${C ? `<span>Qualité</span><b style="color:var(${C.conf ? '--vert' : '--rouge'})">${C.conf ? 'conforme' : C.defauts.join(', ')}</b><span>Pression</span><b>${C.pression ? 'bonne' : 'faible'}</b>` : ''}<span>Eaux usées épurées</span><b>${v.usees ? pc(v.traite / v.usees) : '—'}</b></div></div>`;
}
// ------------------------------------------------------------ panneaux des déchets
function panneauDechets() {
  const D = S.dec, t = tauxDec(30), de = etatDecharges(), n = Math.max(1, Math.min(30, D.jours.length)), sv = sauvageTotal(), a = annee(S.min), K = kDec(a);
  const hab = Math.max(1, VILLES.reduce((s, v) => s + v.hab, 0)), besoin = besoinCamions(), manque = surJ(7, 'manque');
  const flotte = besoin > D.camions + .3 ? ['mauvais', `Il manque des camions : ${nf(manque)} t sont restées dans les bacs cette semaine. Les bacs débordent, les ordures finissent dans la rue.`]
    : D.camions > besoin * 1.4 + 1 ? ['alerte', `Flotte surdimensionnée : environ ${nf(D.camions - Math.ceil(besoin * 1.15))} camions tournent à moitié vides et coûtent ${euros((D.camions - Math.ceil(besoin * 1.15)) * coutCamion())} par an.`] : null;
  const modes = ['res', 'verre', 'emb', 'bio'].map(f => { const md = MODES_D[f], fr = D.modes[f];
    return `<div class="ligne"><span class="pastille" style="background:${COUL_FLUX_D[f]}"></span><div class="txt"><div class="t1">${NOM_FLUX_D[f]}</div><div class="t2">${md.nom}${fr ? ' · passages par semaine' : a < md.an ? ` · à partir de ${md.an}` : md.rd && !rd(md.rd) ? ` · recherche : ${RDI[md.rd].nom}` : ''}</div>
      ${fr ? `<div class="onglets">${[1, 2, 3, 6].map(k => `<button type="button" data-act="freq-dec" data-id="${f}" data-k="${k}" class="${fr === k ? 'actif' : ''}">${k}</button>`).join('')}</div>` : ''}</div>
      ${fr ? '' : `<button type="button" class="btn petit" data-act="mode-dec" data-id="${f}" ${modeDispo(f) ? '' : 'disabled'}>${modeDispo(f) ? `Déployer · ${euros(coutMode(f))}` : 'Verrouillé'}</button>`}</div>`; }).join('');
  const sites = UNITES.filter(estDecU);
  return `<div class="kpis">
      ${kpi('Produit', nf(surJ(30, 'prod') / n, 1), 't/j', 1, 'var(--dechets)')}${kpi('Collecté', nf(surJ(30, 'collecte') / n, 1), 't/j', surJ(30, 'collecte') / Math.max(1, surJ(30, 'prod')), 'var(--vert)')}
      ${kpi('Valorisé', pc(t.valorisation), '', t.valorisation, t.valorisation >= .65 ? 'var(--vert)' : 'var(--orange)')}${kpi('Recyclé et composté', pc(t.recyclage), '', t.recyclage, t.recyclage >= .3 ? 'var(--vert)' : 'var(--orange)')}
      ${kpi('Décharges', de.ans === Infinity ? '—' : nf(de.ans, 1), 'ans', clamp(de.ans / 10, 0, 1), de.ans < 2 ? 'var(--rouge)' : 'var(--dechets)')}${kpi('Dépôts sauvages', nf(sv), 't', sv / (hab / 1000 * 2), 'var(--rouge)')}
    </div>
    ${D.greve > S.min ? `<div class="journal-l mauvais"><span class="d">GRÈVE</span><span class="t">Plus aucune collecte jusqu’au ${dateTxt(D.greve)}.</span></div>` : ''}
    ${de.reste <= 0 ? '<div class="journal-l mauvais"><span class="d">SATURATION</span><span class="t">Les décharges sont pleines : export d’urgence à prix d’or. Ouvrez une décharge ou un incinérateur.</span></div>' : ''}
    <div class="encart"><h3>Flotte de collecte</h3>
      <p>${D.camions} ${nomCamion()} · ${nf(capCamion(), 1)} t par camion et par jour, du lundi au samedi. Trop peu : les bacs débordent. Trop : chaque camion coûte ${euros(coutCamion())} par an. Les camions qui ont fini leur tournée ramassent les dépôts sauvages.</p>
      <div class="barre-l"><span>Besoin</span><div class="jauge"><i style="width:${clamp(besoin / Math.max(1, D.camions), 0, 1) * 100}%;background:${besoin > D.camions ? 'var(--rouge)' : 'var(--vert)'}"></i></div><span>${nf(Math.ceil(besoin))} / ${D.camions}</span></div>
      ${flotte ? `<div class="journal-l ${flotte[0]}"><span class="d">${flotte[0] === 'mauvais' ? 'CAMIONS' : 'COÛT'}</span><span class="t">${flotte[1]}</span></div>` : ''}
      <div class="btns"><button type="button" class="btn petit secondaire" data-act="camion" data-id="-1" ${D.camions <= 1 ? 'disabled' : ''}>− 1 camion</button><button type="button" class="btn petit" data-act="camion" data-id="1">+ 1 camion · ${euros(achatCamion())}</button><button type="button" class="btn petit secondaire" data-act="camion" data-id="5">+ 5</button></div></div>
    <div class="encart"><h3>Trajets des camions</h3><p>Les camions partent du dépôt, collectent, puis vident au site de traitement ou à un quai de transfert plus proche. Plus c’est loin, moins ils collectent.</p>
      ${VILLES.map(v => { const tr = trajetVille(v); return `<div class="barre-l"><span style="width:auto;flex:1">${v.nom} · dépôt ${UNITES.some(u => u.type === 'garage' && !u.fin) ? `à ${tr.dg} hex.` : 'absent'} · vidage à ${tr.vide} hex.${tr.quai ? ' (quai)' : ''}</span><span style="width:auto;color:var(${tr.eff < .7 ? '--orange' : '--vert'})">${pc(tr.eff)}</span></div>`; }).join('')}
      <p class="verrou">Pourcentage de sa capacité qu’un camion remplit chaque jour. Posez un dépôt près des villes${a >= 1970 ? ', et un quai de transfert quand le site de traitement est loin' : ''}.</p></div>
    <div class="encart"><h3>Équipages et horaires</h3>
      <div class="barre-l"><span>Usure</span><div class="jauge"><i style="width:${D.usure * 100}%;background:${D.usure > .6 ? 'var(--rouge)' : D.usure > .35 ? 'var(--orange)' : 'var(--vert)'}"></i></div><span>${pc(D.usure)}</span></div>
      <p>Des tournées trop chargées et le travail de nuit fatiguent les équipages : plus ils sont usés, plus ils font grève. Ajoutez des camions${rd('ergonomie') ? '' : ' ou passez aux bennes ergonomiques (recherche)'}.</p>
      ${a >= 1960 ? `<div class="ligne"><div class="txt"><div class="t1">Collecte de nuit</div><div class="t2">Plus de bruit le jour pour les habitants, mais camions 25 % plus chers et équipages plus vite usés</div></div><button type="button" class="btn petit ${D.nuit ? '' : 'secondaire'}" data-act="nuit-dec">${D.nuit ? 'De nuit' : 'De jour'}</button></div>` : ''}</div>
    <div class="section">Collecte par flux</div>${modes}
    <p class="verrou">Plus de passages : bacs moins pleins, mais des camions moins remplis. Un seul passage d’ordures par semaine mécontente.</p>
    <div class="section">Flux de matière sur 30 jours</div>${sankeyDec()}
    <p class="verrou">Survolez un flux pour lire son tonnage. Une installation saturée est cerclée de rouge : c’est le goulot.</p>
    <div class="section">Marché des matières recyclées</div>
    ${Object.entries(MATIERES_D).map(([k, [nom, base]]) => { const p = D.prix[k] * K, v = D.prix[k] / base - 1; return `<div class="ligne"><div class="txt"><div class="t1">${nom}</div><div class="t2">${nf(p)} €/t · <span style="color:var(${v < 0 ? '--rouge' : '--vert'})">${v < 0 ? '▼' : '▲'} ${pc(Math.abs(v))}</span> par rapport au cours moyen${D.stock[k] > .5 ? ` · stock ${nf(D.stock[k])} t` : ''}</div>
      <div class="onglets"><button type="button" data-act="vendre-dec" data-id="${k}" data-k="1" class="${D.vendre[k] ? 'actif' : ''}">Vendre</button><button type="button" data-act="vendre-dec" data-id="${k}" data-k="0" class="${D.vendre[k] ? '' : 'actif'}">Stocker</button></div></div>
      ${D.stock[k] > .5 ? `<button type="button" class="btn petit secondaire" data-act="solder-dec" data-id="${k}">Vendre · ${euros(D.stock[k] * p)}</button>` : ''}</div>`; }).join('')}
    <p class="verrou">Quand un cours s’effondre, stockez et revendez plus tard (5 000 t au plus).</p>
    <div class="section">Gestion</div>
    <div class="ligne"><div class="txt"><div class="t1">Redevance d’enlèvement</div><div class="t2">Au-delà de ${nf(110 * K)} € par habitant et par an, la satisfaction baisse</div></div><button type="button" class="btn mini secondaire" data-act="tarif-dec" data-dir="-5" aria-label="Baisser">−</button><span class="val">${nf(D.tarif * K)}<small>€/hab/an</small></span><button type="button" class="btn mini secondaire" data-act="tarif-dec" data-dir="5" aria-label="Augmenter">+</button></div>
    <div class="ligne"><div class="txt"><div class="t1">Brigade de propreté</div><div class="t2">${euros(brigadeCout())} par an : ramasse ${nf(cantonniers() * 3)} t/j de dépôts sauvages de plus que les cantonniers (${nf(cantonniers())} t/j)</div></div><button type="button" class="btn petit ${D.brigade ? '' : 'secondaire'}" data-act="brigade">${D.brigade ? 'Active' : 'Activer'}</button></div>
    ${a >= 1960 ? `<div class="ligne"><div class="txt"><div class="t1">Campagne d’information</div><div class="t2">Un an : les habitants trient mieux, moins de refus de tri</div></div>${D.campagne > S.min ? `<span class="chip or">jusqu’au ${dateTxt(D.campagne)}</span>` : `<button type="button" class="btn petit" data-act="campagne-dec">${euros(.2e6 * K)}</button>`}</div>` : ''}
    <div class="section">Sites</div>
    ${sites.map(u => `<div class="ligne"><span class="pastille" style="background:var(--dechets)"></span><div class="txt"><div class="t1">${u.nom}</div><div class="t2">${u.fin ? `chantier, mise en service le ${dateTxt(u.fin)}` : texteEtiDec(u)[0]}</div></div></div>`).join('') || '<p class="vide">Aucun site : posez une décharge depuis la barre du bas.</p>'}
    <div class="encart"><h3>Fêtes et vacances</h3><p>${fetesEnCours(S.min).length ? `En cours : ${fetesEnCours(S.min).map(f => f.nom.toLowerCase()).join(', ')}.` : `Prochaine : ${prochainesFetes(S.min)[0] ? `${prochainesFetes(S.min)[0].f.nom.toLowerCase()} le ${dateTxt(prochainesFetes(S.min)[0].debut)}` : '—'}.`} Louez des camions de renfort (+30 %) et des bacs en plus (+50 %) pour 30 jours.</p>${D.renfort > S.min ? `<span class="chip or">Renforts jusqu’au ${dateTxt(D.renfort)}</span>` : `<button type="button" class="btn petit" data-act="renfort">Renforts 30 jours · ${euros(renfortsCout())}</button>`}</div>
    ${a >= 1930 ? `<div class="encart"><h3>Déchets dangereux de l’industrie</h3><div class="stat"><span>Produits</span><b>${nf(ddJour(), 1)} t/j</b><span>Traités hier</span><b>${nf(D.jours.at(-1)?.dd || 0, 1)} t</b><span>Stockés sur place</span><b style="color:var(${(D.dd || 0) > 100 ? '--rouge' : '--vert'})">${nf(D.dd || 0)} t</b></div><p>Ils se traitent à part, dans un centre de traitement des déchets dangereux${a < TYPES.dangereux.an ? ` (${TYPES.dangereux.an})` : ''}. Stockés trop longtemps, les fûts fuient vers la rivière${a >= 1990 ? ', et les amendes tombent' : ''}.</p></div>` : ''}
    ${(S.suivis || []).some(s => s.fin > a) ? `<p class="verrou">${(S.suivis || []).filter(s => s.fin > a).length} décharge(s) fermée(s) sous surveillance : ${euros(coutSuivis())} par an.</p>` : ''}
    <div class="section">Liens avec l’eau et l’électricité</div>
    <div class="stat"><span>Boues d’épuration reçues</span><b>${nf((D.jours.at(-1)?.boues) || 0, 1)} t/j${partSechage() > 0 ? ` · ${pc(partSechage())} déshydratées` : ''}</b>
      <span>Décharges qui polluent la rivière</span><b style="color:var(${UNITES.some(u => u.type === 'decharge' && !u.fin && u.rempli && !amel(u, 'casiers') && rivProche(u.t) !== null) ? '--rouge' : '--vert'})">${UNITES.filter(u => u.type === 'decharge' && !u.fin && u.rempli && !amel(u, 'casiers') && rivProche(u.t) !== null).length}</b>
      <span>Électricité des déchets</span><b>${nf(UNITES.filter(u => TYPES[u.type].mwhT).reduce((s, u) => s + (actifU(u) ? u.p : 0), 0), 1)} MW injectés</b>
      <span>Chaleur livrée par les réseaux de chaleur</span><b>${nf(CHAUD.reduce((s, C) => s + Math.min(C.cap || 0, C.besoin || 0), 0), 1)} MW</b></div>
    <p class="verrou">Les stations d’épuration envoient leurs boues ici. Les jus des décharges proches de la rivière la polluent, jusqu’aux prises d’eau. L’incinérateur et le méthaniseur produisent de l’électricité s’ils sont reliés au réseau par une ligne.</p>
    <div class="section">Finances des déchets</div>
    <div class="stat"><span>Redevance et ventes, hier</span><b class="pos">+${euros(S.jourPrec?.decV ?? S.jour.decV)}</b><span>Collecte et traitement, hier</span><b class="neg">−${euros(S.jourPrec?.decO ?? S.jour.decO)}</b>${t.sortie ? `<span>Coût complet par tonne</span><b>${nf(surJ(30, 'depenses') / t.sortie)} €/t</b>` : ''}${a >= 1999 ? `<span>Taxe sur l’enfouissement</span><b>${nf(tgap(a))} €/t</b>` : ''}</div>`;
}
// diagramme des flux en trois colonnes : flux à la source → installations → devenir
const NOEUDS_D = [
  ...[...FLUX_D, 'boues'].map(f => ({ id: f, nom: NOM_FLUX_D[f], col: 0, coul: COUL_FLUX_D[f] })),
  ...[['tri', 'Centre de tri'], ['verrier', 'Verrier'], ['metha', 'Méthaniseur'], ['compost', 'Compostage'], ['decheterie', 'Déchèterie'], ['incin', 'Incinérateur'], ['decharge', 'Décharge'], ['export', 'Export d’urgence'], ['sauvage', 'Dépôts sauvages']].map(([id, nom]) => ({ id, nom, col: 1, coul: '#a9b39a' })),
  ...[['recycle', 'Recyclé'], ['composte', 'Composté'], ['energie', 'Énergie'], ['enfoui', 'Enfoui'], ['noncollecte', 'Dans la rue']].map(([id, nom]) => ({ id, nom, col: 2, coul: '#a9b39a' })),
];
function sankeyDec() {
  const L = {}; for (const j of S.dec.liens) for (const k in j) L[k] = (L[k] || 0) + j[k];
  const sIn = Object.entries(L).reduce((s, [k, v]) => s + (k.endsWith('>sauvage') ? v : k.startsWith('sauvage>') ? -v : 0), 0);
  if (sIn > .5) L['sauvage>noncollecte'] = sIn;
  const liens = Object.entries(L).map(([k, v]) => { const [a, b] = k.split('>'); return { a, b, v }; }).filter(l => l.v > .05);
  const val = id => Math.max(liens.filter(l => l.a === id).reduce((s, l) => s + l.v, 0), liens.filter(l => l.b === id).reduce((s, l) => s + l.v, 0));
  const nd = NOEUDS_D.map(x => ({ ...x, v: val(x.id) })).filter(x => x.v > .05);
  if (!nd.length) return '<p class="vide">Pas encore de données : revenez demain.</p>';
  const W = 360, H = 380, nw = 12, gap = 9, cx = [0, 160, W - nw];
  const k = Math.min(...[0, 1, 2].map(c => { const ns = nd.filter(x => x.col === c); return ns.length ? (H - gap * (ns.length - 1)) / ns.reduce((s, x) => s + x.v, 0) : Infinity; }));
  for (const c of [0, 1, 2]) { let y = 0; for (const x of nd.filter(x => x.col === c)) { Object.assign(x, { y, h: Math.max(2, x.v * k), x: cx[c], oOut: 0, oIn: 0 }); y += x.h + gap; } }
  const N = Object.fromEntries(nd.map(x => [x.id, x])), sat = id => UNITES.some(u => u.type === id && !u.fin && (u.util ?? 0) > .97);
  let h = `<svg id="sankey" viewBox="-2 -2 ${W + 4} ${H + 4}" width="100%" role="img" aria-label="Flux de déchets sur 30 jours">`;
  for (const l of liens) {
    const p = N[l.a], q = N[l.b]; if (!p || !q) continue;
    const e = l.v * k, y0 = p.y + p.oOut + e / 2, y1 = q.y + q.oIn + e / 2, x0 = p.x + nw, x1 = q.x, xm = (x0 + x1) / 2; p.oOut += e; q.oIn += e;
    h += `<path class="lien" d="M${x0} ${y0}C${xm} ${y0} ${xm} ${y1} ${x1} ${y1}" stroke="${p.col === 0 ? p.coul : l.b === 'enfoui' || l.b === 'noncollecte' ? '#7a6a5a' : '#6f8f6a'}" stroke-width="${Math.max(1, e)}"><title>${p.nom} → ${q.nom} : ${nf(l.v)} t</title></path>`;
  }
  for (const x of nd) {
    const goulot = x.col === 1 && (sat(x.id) || x.id === 'export' || x.id === 'sauvage'), tx = x.col === 2 ? x.x - 5 : x.x + nw + 5, an = x.col === 2 ? 'end' : 'start';
    h += `<rect x="${x.x}" y="${x.y}" width="${nw}" height="${x.h}" rx="3" fill="${x.coul}" stroke="${goulot ? '#ff8a7a' : '#0f130e'}" stroke-width="${goulot ? 3 : 1.5}"><title>${x.nom} : ${nf(x.v)} t</title></rect>`;
    h += `<text x="${tx}" y="${x.y + x.h / 2 - (x.h > 24 ? 5 : 0)}" text-anchor="${an}" dominant-baseline="middle">${x.nom}</text>`;
    if (x.h > 24) h += `<text x="${tx}" y="${x.y + x.h / 2 + 8}" text-anchor="${an}" dominant-baseline="middle" style="fill:var(--doux);font-weight:700">${nf(x.v)} t</text>`;
  }
  return h + '</svg>';
}
function blocDecHex(u) {
  const ty = TYPES[u.type], a = annee(S.min), K = kDec(a), proches = VILLES.filter(v => Math.min(...v.tuiles.map(x => dist(x, u.t))) <= 3).map(v => v.nom);
  let h = '<div class="stat">';
  if (ty.tj) h += `<span>Capacité</span><b>${nf(capDec(u))} t/j</b><span>Traité hier</span><b>${nf(u.q || 0, 1)} t</b>`;
  if (u.type === 'decharge') { const r = (u.rempli || 0) / ty.volume; h += `<span>Remplissage</span><b>${nf((u.rempli || 0) / 1000, 1)} / ${nf(ty.volume / 1000)} kt</b><span>Coût d’enfouissement</span><b>${nf(ty.opexT * K + tgap(a))} €/t</b>`; h += `</div><div class="barre-l"><span>Rempli</span><div class="jauge"><i style="width:${r * 100}%;background:${r > .9 ? 'var(--rouge)' : 'var(--dechets)'}"></i></div><span>${pc(r)}</span></div><div class="stat">`; }
  if (u.type === 'decheterie') h += `<span>Apports</span><b>${nf(VILLES.reduce((s, v) => s + (v.versDech || 0), 0), 1)} t/j</b><span>Fonctionnement</span><b>${euros(ty.fixe * K)} par an</b><span>Rôle</span><b>encombrants, déchets verts</b>`;
  if (ty.opexT && u.type !== 'decharge') h += `<span>Coût de traitement</span><b>${nf(ty.opexT * K)} €/t</b>`;
  if (u.type === 'incin') h += `<span>Chaleur vendue</span><b>${rd('chaleur') ? nf(25 * K) + ' €/t' : 'recherche nécessaire'}</b>`;
  if (u.type === 'decharge') h += `<span>Jus de décharge</span><b style="color:var(${rivProche(u.t) !== null && !amel(u, 'casiers') ? '--rouge' : '--vert'})">${rivProche(u.t) === null ? 'loin de la rivière' : amel(u, 'casiers') ? 'captés et traités' : 'polluent la rivière'}</b>`;
  if (ty.mwhT) h += `<span>Électricité</span><b>${raccordee(u) ? `${nf(u.p, 1)} MW injectés` : 'non raccordé : tirez une ligne 15 ou 63 kV'}</b>`;
  if (u.type === 'garage') h += `<span>Camions basés ici</span><b>${S.dec.camions} au total</b>`;
  if (u.type === 'quai') h += `<span>Rôle</span><b>vidage rapproché, transport par gros porteurs</b><span>Fonctionnement</span><b>${euros(ty.fixe * K)} par an</b>`;
  h += `<span>Riverains gênés</span><b>${ty.nuis ? proches.join(', ') || 'aucun' : 'aucun'}</b></div>`;
  if (ty.tj) h += `<div class="barre-l"><span>Utilisation</span><div class="jauge"><i style="width:${clamp(u.util ?? 0, 0, 1) * 100}%;background:${(u.util ?? 0) > .97 ? 'var(--rouge)' : 'var(--dechets)'}"></i></div><span>${pc(u.util ?? 0)}</span></div>`;
  return h;
}
function blocAge(u) {  // vieillissement : rénover ou démanteler
  if (u.fin || ['frontiere', 'poste'].includes(u.type)) return '';
  const [e, c] = etatU(u);
  return `<div class="section">État du bâtiment</div><div class="barre-l"><span>Âge</span><div class="jauge"><i style="width:${clamp(usureU(u), 0, 1) * 100}%;background:var(${c})"></i></div><span>${nf(ageU(u))} / ${dureeU(u)} ans</span></div>
    <div class="ligne"><div class="txt"><div class="t1">${e[0].toUpperCase() + e.slice(1)}</div><div class="t2">Un bâtiment usé tombe plus souvent en panne et gêne davantage ses voisins. Rénové, il repart à neuf.${u.type === 'decharge' ? ' Fermée, une décharge reste sous surveillance 30 ans.' : ['nucleaire', 'smr'].includes(u.type) ? ' Arrêté, un réacteur se démantèle (30 % de son coût).' : ''}</div></div><button type="button" class="btn petit ${usureU(u) > .7 ? '' : 'secondaire'}" data-act="renover" data-id="${u.id}">Rénover · ${prixM(coutRenov(u))} M€</button></div>`;
}
function blocAmelio(u) {  // malus du bâtiment et équipements qui les réduisent
  const ks = amelPour(u); if (!ks.length) return '';
  return '<div class="section">Malus et améliorations</div>' + ks.map(k => { const A = AMELIO[k], ok = amel(u, k), dispo = amelDispo(k);
    return `<div class="ligne"><div class="txt"><div class="t1">${A.nom}</div><div class="t2">${ok ? A.effet : `Malus : ${A.malus}. ${A.effet}.`}</div></div>${ok ? '<span class="chip vert">Équipé</span>' : `<button type="button" class="btn petit" ${dispo && !u.fin ? `data-act="amelio" data-id="${u.id}" data-k="${k}"` : 'disabled'}>${dispo ? `${prixM(A.cout(u))} M€` : A.rd && !rd(A.rd) ? 'R&D' : `En ${A.an}`}</button>`}</div>`; }).join('') +
    (ks.some(k => !amelDispo(k) && AMELIO[k].rd) ? `<p class="verrou">Recherche : ${ks.filter(k => !amelDispo(k) && AMELIO[k].rd).map(k => RDI[AMELIO[k].rd].nom).join(', ')}.</p>` : '');
}
function blocVilleDec(v) {
  bacs(v);
  const C = CHAUD.find(C => C.villes.includes(v)), hop = v.tuiles.some(t => t.quartier === 'hopital'), ind = v.tuiles.some(t => t.quartier === 'industriel'), cen = v.tuiles.some(t => t.quartier === 'centre');
  return `<div class="encart"><h3>Attentes des quartiers</h3><div class="stat">${cen ? `<span>Centre-ville</span><b>collecte fréquente (3 passages et plus), sans bruit</b>` : ''}${hop ? `<span>Hôpital</span><b>aucune coupure d’électricité</b>` : ''}${ind ? `<span>Zone industrielle</span><b>déchets dangereux à traiter à part</b>` : ''}<span>Chauffage urbain</span><b>${C ? `${pc(C.taux || 0)} des besoins servis` : 'non raccordée'}</b></div></div><div class="encart"><h3>Déchets de ${v.nom}</h3><div class="stat"><span>Production</span><b>${nf(v.decProd || 0, 1)} t/j</b><span>Bacs</span><b style="color:var(${v.deborde ? '--rouge' : '--vert'})">${v.deborde ? 'débordent' : pc(Math.min(1, remplissage(v)))}</b><span>Dépôts sauvages</span><b>${nf(v.sauvage)} t</b><span>Nuisances des sites</span><b>${nuisVille(v) > .5 ? nf(nuisVille(v), 1) : 'aucune'}</b></div></div>`;
}
const PANNEAUX = { dechets: panneauDechets, eau: panneauEau, accueil: panneauAccueil, dispatch: panneauDispatch, construire: panneauConstruire, reseau: panneauReseau, meteo: panneauMeteo, economie: panneauEconomie, rd: panneauRD, journal: panneauJournal, hex: panneauHex };
function ouvrir(id, garder = false) {
  if (id === 'carte') { $('#panneau').classList.remove('ouvert'); S.onglet = 'carte'; majNav(); return; }
  if (id !== S.onglet) confirmer = null;
  S.onglet = id; $('#panneau').classList.add('ouvert');
  $('#titre-panneau').textContent = id === 'hex' && selT ? nomTuile(selT) : id === 'accueil' ? CARTE.nom : TITRES[id];
  const c = $('#contenu-panneau'), sc = c.scrollTop; c.innerHTML = PANNEAUX[id](); c.scrollTop = garder ? sc : 0;
  graphes(); majNav();
}
function majNav() { document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('actif', b.dataset.id === S.onglet)); }

// graphes (canvas 2D)
function prep(id) { const c = document.getElementById(id); if (!c) return null; const r = devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height'); c.width = w * r; c.height = h * r; c.style.height = h + 'px'; const g2 = c.getContext('2d'); g2.scale(r, r); return [g2, w, h]; }
const ORDRE_PILE = ['nucleaire', 'hydro', 'charbon', 'fioul', 'biomasse', 'dechets', 'gaz', 'eolien', 'solaire', 'stockage', 'import', 'tac'];
function graphes() {
  let p = prep('g-charge');
  if (p) {
    const [c, w, h] = p, H0 = S.hist, maxY = Math.max(200, ...H0.map(e => e.dem)) * 1.15, x0 = 34, y0 = h - 20, sx = (w - x0 - 8) / 144, sy = (y0 - 8) / maxY, pas = maxY > 800 ? 200 : maxY > 400 ? 100 : 50;
    c.font = '700 10px Nunito, sans-serif'; c.fillStyle = '#a9b39a'; c.strokeStyle = 'rgba(255,255,255,.07)';
    for (let v = 0; v <= maxY; v += pas) { const y = y0 - v * sy; c.beginPath(); c.moveTo(x0, y); c.lineTo(w - 8, y); c.stroke(); c.fillText(v, 4, y + 3); }
    let base = H0.map(() => 0);
    for (const f of ORDRE_PILE) {
      c.beginPath(); H0.forEach((e, i) => c.lineTo(x0 + i * sx, y0 - (base[i] + Math.max(0, e.prod[f] || 0)) * sy));
      for (let i = H0.length - 1; i >= 0; i--) c.lineTo(x0 + i * sx, y0 - base[i] * sy);
      c.closePath(); c.fillStyle = FIL[f][1]; c.fill(); base = H0.map((e, i) => base[i] + Math.max(0, e.prod[f] || 0));
    }
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); H0.forEach((e, i) => c.lineTo(x0 + i * sx, y0 - e.charge * sy)); c.stroke();
    const xn = x0 + (H0.length - 1) * sx; c.setLineDash([4, 4]); c.beginPath();
    for (let k = 0; k <= 48; k++) c.lineTo(xn + k * sx, y0 - demande(S.min + k * 15).tot * 1.03 * sy); c.stroke();
    c.strokeStyle = '#ffc94d'; c.beginPath(); c.moveTo(xn, 6); c.lineTo(xn, y0); c.stroke(); c.setLineDash([]);
    // les libellés de l'axe ne se chevauchent pas : « −24 h » et « prévision » s'effacent devant « maintenant »
    const lm = c.measureText('maintenant').width, lp = c.measureText('prévision +12 h').width, xm = clamp(xn - lm / 2, x0, w - 8 - lm);
    c.fillStyle = '#ffc94d'; c.fillText('maintenant', xm, y0 + 14); c.fillStyle = '#a9b39a';
    if (xm > x0 + c.measureText('−24 h').width + 8) c.fillText('−24 h', x0, y0 + 14);
    if (xm + lm + 8 < w - 8 - lp) c.fillText('prévision +12 h', w - 8 - lp, y0 + 14);
  }
  p = prep('g-freq');
  if (p) {
    const [c, w, h] = p, y = f => h / 2 - (f - 50) * (h / 2 - 4) / .8;
    c.fillStyle = 'rgba(123,224,138,.12)'; c.fillRect(0, y(50.2), w, y(49.8) - y(50.2));
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(0, y(50)); c.lineTo(w, y(50)); c.stroke();
    c.strokeStyle = etatFreq(S.f)[1]; c.lineWidth = 2; c.beginPath(); S.fhist.forEach((f, i) => c.lineTo(i / 199 * w, y(clamp(f, 49.2, 50.8)))); c.stroke();
    c.font = '700 10px Nunito, sans-serif'; c.fillStyle = '#a9b39a'; c.fillText('50,2', 4, y(50.2) - 2); c.fillText('49,8', 4, y(49.8) + 10);
  }
  p = prep('g-meteo');
  if (p) {
    const [c, w, h] = p, x0 = 28, sx = (w - x0 - 6) / 72, sy = (h - 22) / 30, y0 = h - 16, pts = [], err = rd('previ') ? .5 : 1;
    for (let k = 0; k <= 72; k++) { const m = S.min + k * 60, v = meteo(m).vent; pts.push([x0 + k * sx, v, v * (.05 + .25 * k / 72) * err]); }
    c.fillStyle = 'rgba(124,192,242,.25)'; c.beginPath(); pts.forEach(([x, v, e]) => c.lineTo(x, y0 - Math.min(30, v + e) * sy)); for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0], y0 - Math.max(0, pts[i][1] - pts[i][2]) * sy); c.fill();
    c.strokeStyle = '#7cc0f2'; c.lineWidth = 2; c.beginPath(); pts.forEach(([x, v]) => c.lineTo(x, y0 - Math.min(30, v) * sy)); c.stroke();
    c.setLineDash([3, 3]); c.strokeStyle = '#ff8a7a'; c.beginPath(); c.moveTo(x0, y0 - 25 * sy); c.lineTo(w - 6, y0 - 25 * sy); c.stroke(); c.setLineDash([]);
    c.font = '700 10px Nunito, sans-serif'; c.fillStyle = '#a9b39a'; for (const v of [0, 10, 20]) c.fillText(v, 6, y0 - v * sy + 3); c.fillStyle = '#ff8a7a'; c.fillText('arrêt 25 m/s', w - 70, y0 - 25 * sy - 4);
    c.fillStyle = '#a9b39a'; ['J+1', 'J+2', 'J+3'].forEach((t, i) => c.fillText(t, x0 + (i * 24 + 10) * sx, h - 3));
  }
  p = prep('g-spot');
  if (p) {
    const [c, w, h] = p, v = S.hist.map(e => e.spot), mx = 250, y = s => h - 6 - clamp(s, 0, mx) / mx * (h - 12);
    c.strokeStyle = '#f08a6c'; c.lineWidth = 2; c.beginPath(); v.forEach((s, i) => c.lineTo(i / 95 * w, y(s))); c.stroke();
    c.font = '700 10px Nunito, sans-serif'; c.fillStyle = '#a9b39a'; c.fillText('Prix spot 24 h · 0 à 250 €/MWh', 6, 12);
  }
}
