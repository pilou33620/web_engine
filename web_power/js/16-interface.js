"use strict";
// ============================================================ interface : barre de construction, survol, clics
let toastT;
function toast(t, genre = '') { if (BANC_ON) return; const el = $('#toast'); el.textContent = t; el.className = 'toast ' + genre; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3800); }
function log(t, genre = '') { if (!t) return; S.journal.unshift({ m: S.min, t, genre }); S.journal.length = Math.min(S.journal.length, 80); }
const ICONES = {
  usine: '<rect x="4" y="15" width="18" height="13" rx="1.5" fill="#b7634a" stroke="#0f130e" stroke-width="2.5"/><path d="M4 15l6-4v4l6-4v4" fill="#b7634a" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/><rect x="23" y="5" width="5" height="23" fill="#8a3f2c" stroke="#0f130e" stroke-width="2.2"/><circle cx="27" cy="4" r="2.6" fill="#c9c6bc"/>',
  fil: '<path d="M2 26q4-3 8 0t8 0 8 0 8 0" stroke="#46a9dd" stroke-width="3" fill="none"/><rect x="8" y="10" width="16" height="12" rx="1.5" fill="#d8cbb0" stroke="#0f130e" stroke-width="2.5"/><path d="M6 11l10-6 10 6" fill="#7a5a44" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/>',
  charbon: '<rect x="4" y="14" width="16" height="14" rx="1.5" fill="#b7634a" stroke="#0f130e" stroke-width="2.5"/><rect x="22" y="4" width="6" height="24" fill="#f6f2ea" stroke="#0f130e" stroke-width="2.2"/><path d="M22 10h6M22 18h6" stroke="#d9573b" stroke-width="3"/><path d="M6 28l4-6 4 6z" fill="#2f2c2a"/>',
  charbonG: '<path d="M3 29c2-6 2-10 0-16h10c-2 6-2 10 0 16z" fill="#e2ded4" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/><rect x="15" y="14" width="10" height="15" fill="#b7634a" stroke="#0f130e" stroke-width="2.2"/><rect x="26" y="3" width="5" height="26" fill="#f6f2ea" stroke="#0f130e" stroke-width="2"/><path d="M26 9h5M26 17h5" stroke="#d9573b" stroke-width="2.6"/>',
  fioul: '<rect x="3" y="15" width="11" height="13" rx="5" fill="#e9e6dd" stroke="#0f130e" stroke-width="2.4"/><rect x="15" y="12" width="11" height="16" rx="1.5" fill="#d8d4c8" stroke="#0f130e" stroke-width="2.4"/><rect x="27" y="4" width="4" height="24" fill="#c9c4b6" stroke="#0f130e" stroke-width="2"/><path d="M6 21h5" stroke="#a07850" stroke-width="3"/>',
  solaire: '<rect x="5" y="12" width="24" height="14" rx="2" fill="#2d4f92" stroke="#0f130e" stroke-width="2.5"/><path d="M5 19h24M13 12v14M21 12v14" stroke="#9cc3ff" stroke-width="1.6"/><circle cx="27" cy="7" r="4" fill="#ffc94d" stroke="#0f130e" stroke-width="2"/>',
  eolien: '<path d="M17 15v16" stroke="#0f130e" stroke-width="4"/><path d="M17 15v16" stroke="#f6f6f1" stroke-width="2"/><path d="M17 14 16 3l3 0zM17 14l10 5-1 2.4zM17 14 7 19.6 8.4 22z" fill="#f6f6f1" stroke="#0f130e" stroke-width="1.8" stroke-linejoin="round"/><circle cx="17" cy="14" r="2.2" fill="#ffc94d" stroke="#0f130e" stroke-width="1.5"/>',
  offshore: '<path d="M2 28q4-3 8 0t8 0 8 0 8 0" stroke="#46a9dd" stroke-width="3" fill="none"/><path d="M17 13v13" stroke="#0f130e" stroke-width="4"/><path d="M17 13v13" stroke="#f6f6f1" stroke-width="2"/><path d="M17 12 16 2l3 0zM17 12l9 5-1 2zM17 12l-9 5 1.4 2z" fill="#f6f6f1" stroke="#0f130e" stroke-width="1.6" stroke-linejoin="round"/>',
  barrage: '<path d="M4 9h26v5c-5 1-7 5-7 16H11c0-11-2-15-7-16z" fill="#d9d5c9" stroke="#0f130e" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 24c2-2 6-2 8 0" stroke="#46a9dd" stroke-width="2.5" fill="none"/>',
  biomasse: '<path d="M6 28h22" stroke="#0f130e" stroke-width="2.5"/><circle cx="11" cy="23" r="4.5" fill="#a0703f" stroke="#0f130e" stroke-width="2.2"/><circle cx="21" cy="23" r="4.5" fill="#a0703f" stroke="#0f130e" stroke-width="2.2"/><path d="M17 15c-6-2-7-8-5-12 5 1 8 5 5 12z" fill="#7be08a" stroke="#0f130e" stroke-width="2" stroke-linejoin="round"/>',
  tac: '<rect x="5" y="14" width="18" height="13" rx="2" fill="#e9e6dd" stroke="#0f130e" stroke-width="2.5"/><rect x="24" y="6" width="5" height="21" rx="1.5" fill="#a9adb3" stroke="#0f130e" stroke-width="2.2"/><path d="M9 20h10" stroke="#e0607e" stroke-width="3"/>',
  gaz: '<path d="M17 4c5 6 9 9 9 16a9 9 0 0 1-18 0c0-4 2-7 4-9 0 3 1 5 3 6-1-5 0-9 2-13z" fill="#f08a6c" stroke="#0f130e" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 18c2 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-4 4-6z" fill="#ffc94d"/>',
  nucleaire: '<path d="M8 30c3-7 3-12 0-20h14c-3 8-3 13 0 20z" fill="#e5e1d7" stroke="#0f130e" stroke-width="2.5" stroke-linejoin="round"/><circle cx="21" cy="7" r="4" fill="#fff" stroke="#0f130e" stroke-width="2"/><circle cx="27" cy="5" r="3" fill="#fff" stroke="#0f130e" stroke-width="2"/>',
  smr: '<rect x="5" y="17" width="24" height="11" rx="2" fill="#e3dfd5" stroke="#0f130e" stroke-width="2.5"/><path d="M9 17a5 5 0 0 1 10 0z" fill="#f3f0e8" stroke="#0f130e" stroke-width="2.2"/><path d="M21 17a4 4 0 0 1 7 0z" fill="#f3f0e8" stroke="#0f130e" stroke-width="2"/><circle cx="17" cy="7" r="3" fill="#7cc0f2" stroke="#0f130e" stroke-width="2"/>',
  fusion: '<ellipse cx="17" cy="19" rx="13" ry="7" fill="#d9d4ec" stroke="#0f130e" stroke-width="2.5"/><ellipse cx="17" cy="19" rx="5" ry="2.5" fill="#1b211a"/><circle cx="17" cy="8" r="4" fill="#ffe27a" stroke="#0f130e" stroke-width="2"/>',
  batterie: '<rect x="5" y="9" width="22" height="18" rx="3" fill="#f3f3ef" stroke="#0f130e" stroke-width="2.5"/><rect x="27" y="14" width="3" height="8" rx="1" fill="#0f130e"/><rect x="8" y="12" width="11" height="12" rx="1.5" fill="#5fbf6b"/>',
  poste: '<rect x="6" y="12" width="22" height="16" rx="3" fill="#8e9aa4" stroke="#0f130e" stroke-width="2.5"/><path d="m18 14-5 7h5l-3 6" stroke="#ffc94d" stroke-width="2.6" fill="none" stroke-linejoin="round"/><path d="M10 12V6M24 12V6M7 6h20" stroke="#0f130e" stroke-width="2.5"/>',
  ligne: '<path d="M17 3 10 31M17 3l7 28M8 10h18M11 17h12M13 24h8" stroke="#0f130e" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M2 12q7 6 6 0M26 12q6 6 6 0" stroke="#ffc94d" stroke-width="2" fill="none"/>',
  prise: '<path d="M2 24c4-3 8 3 12 0s8-3 12 0 6 2 6 2v6H2z" fill="#46a9dd" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/><rect x="5" y="8" width="13" height="12" rx="2" fill="#e6e0d0" stroke="#0f130e" stroke-width="2.4"/><path d="M18 15h12" stroke="#3f9cff" stroke-width="3.4"/>',
  forage: '<path d="M11 4h12M13 4l-3 26M21 4l3 26" stroke="#0f130e" stroke-width="2.6" fill="none"/><rect x="12" y="20" width="10" height="8" rx="2" fill="#5c7184" stroke="#0f130e" stroke-width="2.2"/><path d="M17 28v4" stroke="#3f9cff" stroke-width="3"/>',
  source: '<path d="M3 30 13 10l6 8 4-5 8 17z" fill="#a2b65a" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 4c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#6fd0f0" stroke="#0f130e" stroke-width="2"/>',
  potab: '<rect x="3" y="16" width="13" height="7" rx="1.5" fill="#6fb8a8" stroke="#0f130e" stroke-width="2.2"/><rect x="3" y="24" width="13" height="6" rx="1.5" fill="#6fb8a8" stroke="#0f130e" stroke-width="2.2"/><rect x="18" y="10" width="13" height="20" rx="2" fill="#f3efe6" stroke="#0f130e" stroke-width="2.4"/><path d="M24.5 14c2 3 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="#3f9cff"/>',
  chateau: '<path d="M14 18h6l1 13h-8z" fill="#e9e3d3" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 10c0-5 22-5 22 0v3c0 4-22 4-22 0z" fill="#f3eee2" stroke="#0f130e" stroke-width="2.4"/><path d="M6.5 12.5c5 2 16 2 21 0" stroke="#3f9cff" stroke-width="2.4" fill="none"/>',
  reservoir: '<path d="M2 28c4-12 26-12 30 0z" fill="#86b85a" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><rect x="13" y="14" width="8" height="5" fill="#cfcac0" stroke="#0f130e" stroke-width="2"/><path d="M13 14h8" stroke="#3f9cff" stroke-width="2.4"/>',
  pompage: '<rect x="3" y="11" width="15" height="17" rx="2" fill="#e8e2d4" stroke="#0f130e" stroke-width="2.4"/><circle cx="10.5" cy="19.5" r="4" fill="#5c7184" stroke="#0f130e" stroke-width="2"/><path d="M18 16h13M18 23h13" stroke="#3f9cff" stroke-width="3.2"/>',
  step: '<circle cx="11" cy="12" r="7" fill="#8f9a5c" stroke="#0f130e" stroke-width="2.4"/><circle cx="24" cy="12" r="6" fill="#8f9a5c" stroke="#0f130e" stroke-width="2.4"/><rect x="4" y="22" width="26" height="7" rx="2" fill="#7c8a52" stroke="#0f130e" stroke-width="2.4"/><path d="M5 12h12" stroke="#0f130e" stroke-width="1.6"/>',
  lagunage: '<ellipse cx="11" cy="13" rx="8" ry="5" fill="#6f9a6a" stroke="#0f130e" stroke-width="2.2"/><ellipse cx="22" cy="24" rx="9" ry="5.5" fill="#6f9a6a" stroke="#0f130e" stroke-width="2.2"/><path d="M27 6v8M30 8v6M24 9v5" stroke="#4f8a3a" stroke-width="2.2"/>',
  dessal: '<path d="M2 26c4-3 7 3 11 0s7-3 11 0" stroke="#1d5a86" stroke-width="3" fill="none"/><rect x="9" y="8" width="20" height="13" rx="2" fill="#eef1f3" stroke="#0f130e" stroke-width="2.4"/><path d="M12 12h14M12 16h14" stroke="#3f9cff" stroke-width="2"/>',
  chaleur: '<path d="M3 22h10c4 0 4-10 8-10h10" stroke="#0f130e" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="M3 22h10c4 0 4-10 8-10h10" stroke="#ff7a3a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M12 6c-2 2 2 3 0 5M18 4c-2 2 2 3 0 5" stroke="#ff9a4a" stroke-width="2" fill="none" stroke-linecap="round"/>',
  conduite: '<path d="M3 22h10c4 0 4-10 8-10h10" stroke="#0f130e" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="M3 22h10c4 0 4-10 8-10h10" stroke="#3f9cff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="9" cy="22" r="1.6" fill="#fff"/><circle cx="24" cy="12" r="1.6" fill="#fff"/>',
  egout: '<path d="M3 12h10c4 0 4 10 8 10h10" stroke="#0f130e" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="M3 12h10c4 0 4 10 8 10h10" stroke="#b07f4c" stroke-width="4" fill="none" stroke-linecap="round"/>',
  forageP: '<path d="M11 4h12M13 4l-3 26M21 4l3 26" stroke="#0f130e" stroke-width="2.6" fill="none"/><rect x="12" y="20" width="10" height="8" rx="2" fill="#3f7fb5" stroke="#0f130e" stroke-width="2.2"/><path d="M17 28v4" stroke="#3f9cff" stroke-width="3"/>',
  decharge: '<path d="M2 28c4-10 9-14 15-14s11 4 15 14z" fill="#b07a4a" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 23l4-2M17 19l5 1M13 26l6-1" stroke="#6d4c2f" stroke-width="2"/><path d="M24 9h6v5h-6z" fill="#ffc94d" stroke="#0f130e" stroke-width="2"/><path d="M20 14h4" stroke="#0f130e" stroke-width="2"/>',
  decheterie: '<rect x="3" y="14" width="13" height="12" rx="1.5" fill="#ffc94d" stroke="#0f130e" stroke-width="2.4"/><rect x="18" y="14" width="13" height="12" rx="1.5" fill="#5fb3ff" stroke="#0f130e" stroke-width="2.4"/><path d="M3 18h13M18 18h13" stroke="#0f130e" stroke-width="1.8"/><path d="M5 10h24" stroke="#0f130e" stroke-width="2.4" stroke-linecap="round"/>',
  compost: '<path d="M2 28c3-8 9-8 12 0zM12 28c3-9 10-9 13 0zM22 28c2-6 8-6 10 0z" fill="#8a6a3a" stroke="#0f130e" stroke-width="2.2" stroke-linejoin="round"/><path d="M17 13c-5-1-6-6-4-9 4 1 6 4 4 9z" fill="#7be08a" stroke="#0f130e" stroke-width="2" stroke-linejoin="round"/>',
  tri: '<path d="M3 30V14l14-8 14 8v16z" fill="#e8e2d4" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 20h12l-3-3M25 25H13l3 3" stroke="#3987e5" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  incin: '<rect x="3" y="16" width="18" height="13" rx="1.5" fill="#d8d4c8" stroke="#0f130e" stroke-width="2.4"/><rect x="23" y="6" width="6" height="23" fill="#c9c4b6" stroke="#0f130e" stroke-width="2.2"/><path d="M23 10h6" stroke="#f0a35e" stroke-width="2.6"/><path d="M9 25c0-3 3-4 3-7 2 2 3 4 3 7z" fill="#ff9a4a" stroke="#0f130e" stroke-width="1.6"/><circle cx="27" cy="3.5" r="2.4" fill="#c9c6bc"/>',
  dangereux: '<rect x="8" y="6" width="18" height="24" rx="4" fill="#f2c94c" stroke="#0f130e" stroke-width="2.4"/><path d="M8 12h18M8 24h18" stroke="#0f130e" stroke-width="2"/><path d="M17 14l4 7h-8z" fill="#2f2c2a" stroke="#0f130e" stroke-width="1.2" stroke-linejoin="round"/>',
  garage: '<path d="M3 30V13l14-7 14 7v17z" fill="#e8e2d4" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><rect x="9" y="18" width="16" height="12" fill="#6b6f75" stroke="#0f130e" stroke-width="2"/><path d="M9 22h16M9 26h16" stroke="#0f130e" stroke-width="1.4"/><path d="M3 13l14-7 14 7" stroke="#5fae3e" stroke-width="2.6" fill="none"/>',
  quai: '<path d="M2 24h20v6H2z" fill="#cfcac0" stroke="#0f130e" stroke-width="2.2"/><rect x="4" y="15" width="8" height="9" rx="1" fill="#3f7fb5" stroke="#0f130e" stroke-width="2"/><rect x="13" y="15" width="8" height="9" rx="1" fill="#5fae3e" stroke="#0f130e" stroke-width="2"/><path d="M22 30l10-8" stroke="#0f130e" stroke-width="2.4"/><path d="M24 12h7l-3-3M31 12l-3 3" stroke="#f0a35e" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  metha: '<path d="M3 28v-8a6 6 0 0 1 12 0v8z" fill="#86b85a" stroke="#0f130e" stroke-width="2.4"/><path d="M16 28v-9a6.5 6.5 0 0 1 13 0v9z" fill="#86b85a" stroke="#0f130e" stroke-width="2.4"/><path d="M2 28h30" stroke="#0f130e" stroke-width="2.4"/><path d="M30 12c0-3 2-4 2-7 1.5 2 2 3.5 2 5a2 2 0 0 1-4 2z" fill="#ff9a4a" stroke="#0f130e" stroke-width="1.4"/>',
  camion: '<rect x="3" y="11" width="17" height="13" rx="2" fill="#7be08a" stroke="#0f130e" stroke-width="2.4"/><path d="M20 15h6l4 5v4H20z" fill="#f3efe6" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><circle cx="9" cy="26" r="3" fill="#2a2622" stroke="#0f130e" stroke-width="1.6"/><circle cx="25" cy="26" r="3" fill="#2a2622" stroke="#0f130e" stroke-width="1.6"/><path d="M8 15v5M12 15v5M16 15v5" stroke="#0f130e" stroke-width="1.6"/>',
  bac: '<path d="M8 10h18l-2 19H10z" fill="#5c7184" stroke="#0f130e" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 10h22M13 7h8" stroke="#0f130e" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="30" r="2" fill="#2a2622"/><circle cx="22" cy="30" r="2" fill="#2a2622"/>',
};
const prixM = c => nf(c, c < 10 ? 1 : 0);
function majBarre() {
  if (vue === 'carte') { $('#chantier').innerHTML = '<div class="vide-chantier">Pour construire, passez en vue Électricité (2), Eau (3) ou Déchets (4).</div>'; return; }
  if (vue === 'eau') return majBarreEau();
  if (vue === 'dechets') return majBarreDec();
  const a = annee(S.min), dispo = ORDRE_BARRE.filter(k => dispoType(k)), bientot = ORDRE_BARRE.filter(k => TYPES[k].an > a).sort((x, y) => TYPES[x].an - TYPES[y].an).slice(0, 3);
  const kvs = Object.entries(KV).filter(([, v]) => v.an <= a).map(([k]) => k).join(' · ');
  $('#chantier').innerHTML = [...dispo, ...bientot].map(k => { const ty = TYPES[k], futur = ty.an > a, verrou = futur || (ty.rd && !rd(ty.rd));
    return `<button type="button" class="carte-c${mode === k ? ' actif' : ''}" data-act="mode" data-id="${k}" ${verrou ? 'disabled' : ''} title="${futur ? `Disponible en ${ty.an}` : ty.rd && !rd(ty.rd) ? 'Recherche : ' + RDI[ty.rd].nom : ty.nom + ' · ' + ty.non}"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES[k] || ICONES.charbon}</svg><b>${ty.court}</b><span>${futur ? `en ${ty.an}` : verrou ? 'R&D' : `${ty.mw ? nf(ty.mw) + ' MW · ' : ''}${nf(coutType(k))} M€`}</span></button>`; }).join('') +
    `<button type="button" class="carte-c${mode === 'ligne' ? ' actif' : ''}" data-act="mode" data-id="ligne" title="Relier deux ouvrages"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES.ligne}</svg><b>Ligne</b><span>${kvs} kV</span></button>` + carteChaleur();
}
const carteChaleur = () => (annee(S.min) >= 1925 ? `<button type="button" class="carte-c${mode === 'chaleur' ? ' actif' : ''}" data-act="mode" data-id="chaleur" title="Réseau de chaleur : d’une centrale thermique, d’un incinérateur ou d’un méthaniseur vers une ville"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES.chaleur}</svg><b>Chaleur</b><span>${nf(COUT_TUYAU.c, 2)} M€ / hex.</span></button>` : '');
function majBarreEau() {
  const a = annee(S.min), dispo = ORDRE_EAU.filter(k => dispoType(k)), bientot = ORDRE_EAU.filter(k => TYPES[k].an > a).sort((x, y) => TYPES[x].an - TYPES[y].an).slice(0, 2);
  $('#chantier').innerHTML = [...dispo, ...bientot].map(k => { const ty = TYPES[k], futur = ty.an > a;
    return `<button type="button" class="carte-c${mode === k ? ' actif' : ''}" data-act="mode" data-id="${k}" ${futur ? 'disabled' : ''} title="${futur ? `Disponible en ${ty.an}` : ty.nom + ' · ' + ty.non}"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES[k] || ICONES.forage}</svg><b>${ty.court}</b><span>${futur ? `en ${ty.an}` : `${capTexte(ty)} · ${prixM(coutType(k))} M€`}</span></button>`; }).join('') +
    [['conduite', 'Conduite', `${nf(COUT_TUYAU.p, 2)} M€ / hex.`], ['egout', 'Égout', `${nf(COUT_TUYAU.a, 2)} M€ / hex.`]].map(([k, n, c]) => `<button type="button" class="carte-c${mode === k ? ' actif' : ''}" data-act="mode" data-id="${k}" title="Relier deux ouvrages"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES[k]}</svg><b>${n}</b><span>${c}</span></button>`).join('');
}
function majBarreDec() {
  const a = annee(S.min), dispo = ORDRE_DEC.filter(k => dispoType(k)), bientot = ORDRE_DEC.filter(k => TYPES[k].an > a).sort((x, y) => TYPES[x].an - TYPES[y].an).slice(0, 2);
  $('#chantier').innerHTML = `<button type="button" class="carte-c" data-act="camion" data-id="1" title="Acheter un camion de collecte (${euros(coutCamion())} par an ensuite)"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES.camion}</svg><b>Camion</b><span>${S.dec.camions} · +${euros(achatCamion())}</span></button>` +
    [...dispo, ...bientot].map(k => { const ty = TYPES[k], futur = ty.an > a, verrou = futur || (ty.rd && !rd(ty.rd));
    return `<button type="button" class="carte-c${mode === k ? ' actif' : ''}" data-act="mode" data-id="${k}" ${verrou ? 'disabled' : ''} title="${futur ? `Disponible en ${ty.an}` : verrou ? 'Recherche : ' + RDI[ty.rd].nom : ty.nom + ' · ' + ty.non}"><svg viewBox="0 0 34 34" aria-hidden="true">${ICONES[k]}</svg><b>${ty.court}</b><span>${futur ? `en ${ty.an}` : verrou ? 'R&D' : `${capTexte(ty) ? capTexte(ty) + ' · ' : ''}${prixM(coutType(k))} M€`}</span></button>`; }).join('') + carteChaleur();
}
function majAide() {
  const a = $('#aide'); a.hidden = !mode;
  if (TRACES[mode]) { a.innerHTML = `<span>${mode === 'egout' ? 'Égout : reliez une ville à une épuration.' : mode === 'chaleur' ? 'Chaleur : reliez une centrale thermique, un incinérateur ou un méthaniseur à une ville.' : 'Conduite : reliez un captage, une usine ou un château d’eau à une ville.'} ${depart ? 'Cliquez sur l’arrivée.' : 'Cliquez sur le départ.'}</span><button type="button" data-act="mode" data-id="${mode}">Annuler</button>`; return; }
  if (mode === 'ligne') a.innerHTML = `<span>${depart ? `Départ : ${nomCourt(depart)}. Cliquez sur l’arrivée.` : 'Cliquez sur l’ouvrage de départ.'}</span>${Object.entries(KV).map(([k, v]) => `<button type="button" data-act="kv" data-id="${k}" class="${+k === kvMode ? 'actif' : ''}" ${v.an > annee(S.min) ? 'disabled' : ''}>${v.nom} · ${nf(v.cap)} MW</button>`).join('')}<button type="button" data-act="mode" data-id="ligne">Annuler</button>`;
  else if (mode) a.innerHTML = `<span>${TYPES[mode].nom} : posez-la sur un hexagone vert. Plus il est foncé, meilleur est le site.</span><button type="button" data-act="mode" data-id="${mode}">Annuler</button>`;
}
function choisirMode(m) {
  mode = m; depart = null; apercu = null; depR.visible = false; enleverFantome();
  majBarre(); majAide(); majLentille(); couleurCables();
}
function enleverFantome() { if (fant) { jeter(fant); fant = null; fantT = null; } }
const nomTuile = t => (t.brume ? 'Terres inexplorées' : t.ville ? `${t.ville.nom} · ${QUART[t.quartier].nom}` : t.occ ? t.occ.nom : t.riviere !== undefined ? `${TERR[t.t].nom} avec rivière` : TERR[t.t].nom);
const potTexte = (t, k) => (k === 'vent' ? `vent ${nf(t.vent, 1)} m/s` : k === 'soleil' ? `${nf(900 + t.soleil * 110)} kWh/kWc/an` : k === 'eau' ? 'débit moyen 38 m³/s' : `acceptation ${nf(t.accept)} %`);
const textesRecours = ['', 'Opposition locale : recours, chantier +50 %', 'Forte opposition : recours, chantier doublé'];
function survoler(t, cx, cy) {
  placeAnneau(survolR, t);
  const bul = $('#bulle');
  if (!t) { bul.hidden = true; enleverFantome(); return; }
  let h;
  if (t.brume) h = '<b>Terres inexplorées</b><br>Hors de la région concédée';
  else if (mode && mode !== 'ligne') {
    const r = raison(t, mode);
    if (fantT !== t) { enleverFantome(); if (!r) { fant = modele(t, mode, FANT); fantT = t; } }
    h = `<b>${nomTuile(t)}</b><br>${r ? `<span class="non">✕ ${r}</span>` : `<span class="oui">✓ ${TYPES[mode].nom}</span> · ${potTexte(t, TYPES[mode].pot)}${recours(t) ? `<br><span class="non">${textesRecours[recours(t)]}</span>` : ''}`}`;
  } else if (mode === 'ligne') {
    const r = finValide(t, kvMode);
    if (depart && bout(t) !== depart) { apercu = r ? null : chemin(depart, bout(t)); majLentille(); }
    h = `<b>${nomTuile(bout(t))}</b><br>${r ? `<span class="non">✕ ${r}</span>` : depart ? (apercu ? `<span class="oui">✓ ${apercu.length - 1} hexagones · ${nf(poidsChemin(apercu) * KV[kvMode].cout, 1)} M€</span>` : '<span class="non">✕ Pas de tracé : la ligne évite l’eau, la montagne, les villes et les ouvrages</span>') : '<span class="oui">✓ Départ possible</span>'}`;
  } else if (TRACES[mode]) {
    const f = TRACES[mode], r = finEau(t, f);
    if (depart && t !== depart) { apercu = r ? null : cheminEau(depart, t, f); majLentille(); }
    h = `<b>${nomTuile(t)}</b><br>${r ? `<span class="non">✕ ${r}</span>` : depart ? (apercu ? `<span class="oui">✓ ${apercu.length - 1} hexagones · ${nf((apercu.length - 1) * COUT_TUYAU[f], 2)} M€</span>` : '<span class="non">✕ Pas de tracé : la conduite évite la mer, la montagne et les autres ouvrages</span>') : '<span class="oui">✓ Départ possible</span>'}`;
  } else if (vue === 'eau') h = `<b>${nomTuile(t)}</b><br>${t.occ && estEauU(t.occ) ? (t.occ.fin ? `Chantier ${nf(avancement(t.occ) * 100)} %` : texteEtiEau(t.occ)[0]) : t.quartier ? `${nf((t.ville.m3d || 0) * 96)} m³/j pour toute la ville` : `Nappe ${pc(t.nappe)} · nitrates ${pc(t.nitr)}${t.ferme ? ` · ferme ${t.ferme === 'culture' ? 'céréalière' : 'd’élevage'}` : ''}`}`;
  else if (vue === 'dechets') h = `<b>${nomTuile(t)}</b><br>${t.occ && estDecU(t.occ) ? (t.occ.fin ? `Chantier ${nf(avancement(t.occ) * 100)} %` : texteEtiDec(t.occ)[0]) : t.quartier ? `${nf(t.ville.decProd || 0, 1)} t/j pour toute la ville · bacs ${pc(Math.min(1, remplissage(t.ville)))}${t.ville.sauvage > 1 ? ` · ${nf(t.ville.sauvage)} t de dépôts sauvages` : ''}` : `Acceptation ${nf(t.accept)} %${nuisHex(t) > .5 ? ` · nuisances des sites ${nf(nuisHex(t), 1)}` : ''}`}`;
  else h = `<b>${nomTuile(t)}</b><br>${t.occ ? (t.occ.fin ? `Chantier ${nf(avancement(t.occ) * 100)} %` : `${nf(Math.max(0, t.occ.p))} MW`) : t.quartier ? `${nf(t.ville.dem || 0)} MW pour toute la ville` : `Vent ${nf(t.vent, 1)} m/s · Soleil ${nf(t.soleil, 1)}/5 · Acceptation ${nf(t.accept)} %`}`;
  bul.innerHTML = h;
  if (cx !== undefined) { bul.hidden = false; bul.style.left = Math.min(cx + 16, innerWidth - 270) + 'px'; bul.style.top = Math.min(cy + 18, innerHeight - 80) + 'px'; }
}
const avancement = u => (u.fin ? clamp((S.min - u.debut) / Math.max(1, u.fin - u.debut), 0, 1) : 1);
// achats communs au joueur et au banc : renvoient l'ouvrage, ou un message d'erreur
// enquête publique avant un gros chantier : passer en force, concerter (plus lent) ou indemniser la commune (plus cher)
const ENQUETE = ['decharge', 'incin', 'nucleaire', 'smr', 'barrage', 'dangereux'];
const STRAT_ENQ = { force: ['Passer en force', 'Délai normal, mais les riverains se fâchent et peuvent attaquer en justice (chantier suspendu 9 mois)'], concerter: ['Concerter', 'Réunions publiques : chantier 40 % plus long, aucun recours, aucune colère'], indemniser: ['Indemniser la commune', 'Coût +15 % versé à la commune : délai normal, aucun recours'] };
const enqueteRequise = type => ENQUETE.includes(type) && annee(S.min) >= 1960;
function acheterUnite(t, type, strat = null) {
  const r = raison(t, type); if (r) return r;
  const c = coutType(type) * 1e6 * (strat === 'indemniser' ? 1.15 : 1); if (c > S.argent + 200e6) return 'Trésorerie insuffisante : empruntez depuis l’onglet Économie.';
  const rc = strat === 'concerter' || strat === 'indemniser' ? 0 : recours(t), proces = strat === 'force' && rc > 0 && alea() < .25 * rc;
  const mois = delaiType(type) * [1, 1.5, 2][rc] * (strat === 'concerter' ? 1.4 : 1) + (proces ? 9 : 0);
  S.argent -= c; S.an.capex += c; S.nimby += strat === 'concerter' ? 0 : strat === 'indemniser' ? 1 : [0, 3, 6][rc] + (strat === 'force' ? 2 : 0) + (proces ? 4 : 0);
  const u = creerUnite(t, type, { fin: S.min + mois * MOIS_MIN }); u.mois = mois; u.recours = rc;
  log(`Chantier lancé : ${u.nom}, ${nf(c / 1e6)} M€, mise en service prévue le ${dateTxt(u.fin)}.${strat ? ` Enquête publique : ${STRAT_ENQ[strat][0].toLowerCase()}.` : ''}${rc ? ' ' + textesRecours[rc] + '.' : ''}${proces ? ' Les riverains attaquent en justice : chantier suspendu 9 mois.' : ''}`, rc || proces ? 'alerte' : '');
  majAcceptation(); return u;
}
function acheterLigne(a, b, kv) {
  a = bout(a); b = bout(b);
  if (KV[kv].rd && !rd(KV[kv].rd)) return 'Recherche nécessaire : Très haute tension 400 kV';
  const r = finValide(a, kv) || finValide(b, kv); if (r) return r;
  if (a === b) return 'Choisissez deux ouvrages différents.';
  const p = chemin(a, b); if (!p) return 'Aucun tracé : la ligne évite l’eau, la montagne, les villes et les ouvrages.';
  const c = poidsChemin(p) * KV[kv].cout * 1e6; if (c > S.argent + 200e6) return 'Trésorerie insuffisante.';
  S.argent -= c; S.an.capex += c; S.nimby += p.filter(x => x.accept < 30).length * .4;
  const l = tracerLigne(a, b, kv, { chemin: p }); l.cout = c;
  log(`Chantier de ligne ${KV[kv].nom} ${l.nom} lancé : ${p.length - 1} hexagones, ${nf(c / 1e6, 1)} M€, mise sous tension dans ${KV[kv].delai} mois.`);
  return l;
}
// les montants suivent la taille du réseau : quelques M€ en 1900, des milliards en 2050
const arrondiJoli = x => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
const taillePret = () => arrondiJoli(Math.max(5, pointeEstimee() * .5));
const detteMax = () => Math.max(60e6, pointeEstimee() * 5e6);
const seuilFaillite = () => Math.max(20e6, pointeEstimee() * .75e6);
function emprunter(mEUR, duree = 20) {
  const cap = mEUR * 1e6, taux = .035 + S.dette / 1e9 * .01, annuite = cap * taux / (1 - (1 + taux) ** -duree);
  S.prets.push({ capital: cap, taux, duree, reste: duree, annuite }); S.argent += cap; S.dette += cap;
  log(`Emprunt de ${nf(mEUR)} M€ sur ${duree} ans à ${nf(taux * 100, 1)} %.`, 'alerte');
}
function fermer(u) {
  const ch = estCharbon(u), c = ch ? Math.max(.5, u.cap * .07) * 1e6 : TYPES[u.type].capex * .05e6; S.argent -= c;
  log(`${u.nom} ${ch ? 'fermée définitivement' : 'démolie'} (${nf(c / 1e6, 1)} M€).`, ch ? 'bon' : 'alerte');
  finDeVie(u); demolir(u);
}
function cliquer(t, e) {
  if (!t) return;
  if (e.pointerType === 'touch' && mode && toucheT !== t) { toucheT = t; survoler(t, e.clientX, e.clientY); return; }
  toucheT = null;
  if (mode === 'ligne') {
    const tb = bout(t), r = finValide(tb, kvMode); if (r) return toast(r);
    if (!depart) { depart = tb; placeAnneau(depR, tb); majAide(); return; }
    if (tb === depart) return;
    const l = acheterLigne(depart, tb, kvMode); if (typeof l === 'string') return toast(l);
    toast(`Ligne ${KV[kvMode].nom} lancée (${nf(l.cout / 1e6, 1)} M€). Mise sous tension dans ${KV[kvMode].delai} mois.`, 'ok');
    choisirMode(null); selectionner(tb); return;
  }
  if (TRACES[mode]) {
    const f = TRACES[mode], r = finEau(t, f); if (r) return toast(r);
    if (!depart) { depart = t; placeAnneau(depR, t); majAide(); return; }
    if (t === depart) return;
    const p = cheminEau(depart, t, f); if (!p) return toast('Aucun tracé possible entre ces deux hexagones.');
    const c = (p.length - 1) * COUT_TUYAU[f] * 1e6; if (c > S.argent + 200e6) return toast('Trésorerie insuffisante.');
    const ty = f === 'c' ? 'chaleur' : f === 'a' ? 'usee' : [depart, t].some(x => x.occ?.type === 'prise') && [depart, t].some(x => x.occ?.type === 'potab') ? 'brute' : 'potable';
    S.argent -= c; S.an.capex += c; poserConduite(null, null, ty, p);
    const nomT = { a: ['Collecteur d’eaux usées', 'Égout'], c: ['Réseau de chaleur', 'Réseau de chaleur'], p: ['Conduite d’eau', 'Conduite'] }[f];
    log(`${nomT[0]} posé sur ${p.length - 1} hexagones (${nf(c / 1e6, 2)} M€).`); toast(`${nomT[1]} posé (${nf(c / 1e6, 2)} M€).`, 'ok');
    choisirMode(null); selectionner(t); return;
  }
  if (mode) {
    if (enqueteRequise(mode)) { const r = raison(t, mode); if (r) return toast(r); return enquete(t, mode); }
    const u = acheterUnite(t, mode); if (typeof u === 'string') return toast(u);
    toast(`${u.nom} : chantier lancé, ${Math.round(u.mois)} mois.${u.recours ? ' Recours des riverains.' : ''}`, u.recours ? 'info' : 'ok');
    choisirMode(null); selectionner(t); return;
  }
  selectionner(t);
}
let ENQ = null;
function enquete(t, type) {
  ENQ = { t, type }; const rc = recours(t), c = coutType(type);
  modale(`<h2 id="modale-titre">Enquête publique</h2><p>${TYPES[type].nom} ${('près de ' + lieu(t)).replace('de les ', 'des ').replace('de le ', 'du ')} : acceptation des habitants ${nf(t.accept)} %.${rc ? ` ${textesRecours[rc]} si vous passez en force.` : ' Peu d’opposition attendue.'}</p>
    ${Object.entries(STRAT_ENQ).map(([k, [n, d]]) => `<button type="button" class="btn ${k === 'concerter' ? '' : 'secondaire'}" data-act="enquete" data-id="${k}">${n} · ${prixM(c * (k === 'indemniser' ? 1.15 : 1))} M€<small style="display:block;font-weight:700;opacity:.85">${d}</small></button>`).join('')}
    <button type="button" class="btn secondaire petit" data-act="fermer-modale">Renoncer</button>`);
}
function selectionner(t) { selT = t; placeAnneau(selR, t); ouvrir('hex'); }
