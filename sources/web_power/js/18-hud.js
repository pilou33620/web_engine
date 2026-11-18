"use strict";
// ============================================================ HUD, étiquettes, mini-carte
const PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const VITESSES = [[0, PAUSE, 'Pause'], [6, '1×', '6 minutes par seconde'], [60, '1 h', '1 heure par seconde'], [360, '6 h', '6 heures par seconde'], [1440, '1 j', '1 jour par seconde'], [10080, '1 sem', '1 semaine par seconde'], [43800, '1 mois', '1 mois par seconde']];
function hud() {
  const w = meteo(S.min);
  $('#date').innerHTML = `${jourTxt(S.min)} ${annee(S.min)} · ${hhmm(S.min)}<small>${ere().nom} · ${saison(S.min)} · vent ${nf(w.vent)} m/s · ${nf(w.temp)} °C · ${S.evt.tempete > S.min ? (w.temp < 1.5 ? 'tempête de neige' : 'orage') : w.neb > .72 ? (w.temp < 1.5 ? 'neige' : 'pluie') : w.neb > .7 ? 'couvert' : w.neb > .35 ? 'nuageux' : 'dégagé'}</small>`;
  const [, , cls] = etatFreq(S.f); $('#p-freq').className = 'pill ' + cls; $('#freq').textContent = nf(S.f, 2) + ' Hz';
  const te = S.eau.taux ?? 1, ce = S.eau.conf ?? 1; $('#p-eau').className = 'pill cache ' + (te < .8 || ce < .9 ? 'critique' : te < .97 || ce < .99 ? 'alerte' : ''); $('#eau-txt').textContent = pc(te);
  const tv = tauxDec(30).valorisation, sv = sauvageTotal() / Math.max(1, VILLES.reduce((s, v) => s + v.hab, 0) / 1000), deb = VILLES.some(v => v.deborde); $('#p-dec').className = 'pill cache ' + (sv > 2 || S.dec.greve > S.min ? 'critique' : deb || sv > .5 ? 'alerte' : ''); $('#dec-txt').textContent = pc(tv);
  $('#sat').textContent = nf(S.sat) + ' %'; $('#argent').textContent = nf(S.argent / 1e6, 1) + ' M€'; $('#argent').classList.toggle('neg', S.argent < 0);
  const ev = Object.entries(S.evt).filter(([, f]) => f > S.min).map(([k]) => NOM_EVT[k]); $('#p-evt').hidden = !ev.length; $('#p-evt').textContent = ev.join(' · ');
  const prod = PROD(), dem = S.charge + S.pertes, mx = Math.max(dem, prod, 1) * 1.15;
  $('#carte-eq').innerHTML = `<div class="haut"><span class="nomp">Équilibre</span><small>Réserve ${nf(marge())} MW</small></div>
    <div class="barre-l"><span>Demande</span><div class="jauge"><i style="width:${dem / mx * 100}%;background:#fff"></i></div><span>${nf(dem)} MW</span></div>
    <div class="barre-l"><span>Production</span><div class="jauge"><i style="width:${(prod - IMP.p) / mx * 100}%;background:var(--vert)"></i></div><span>${nf(prod - IMP.p)} MW</span></div>
    <div class="barre-l"><span>${IMP.p >= 0 ? 'Import' : 'Export'}</span><div class="jauge"><i style="width:${Math.abs(IMP.p) / mx * 100}%;background:#c3b0ea"></i></div><span>${nf(Math.abs(IMP.p))} MW</span></div>
    ${S.delestage > 1 || S.demIlot > 1 ? `<small style="color:var(--rouge)">Coupé : ${nf(S.delestage + S.demIlot)} MW</small>` : ''}`;
  const vt = $('#temps'), html = VITESSES.map(([v, n, a], i) => `<button type="button" data-act="vitesse" data-id="${i}" class="${(i === 0 ? S.pause : !S.pause && S.vit === i) ? 'actif' : ''}" aria-label="${a}" title="${a}">${n}</button>`).join('');
  if (vt.dataset.h !== html) { vt.innerHTML = html; vt.dataset.h = html; }
  majBanderoles(); majGuide();
}
const ETI = $('#etiquettes');
function majBanderoles() {
  for (const v of VILLES) {
    if (!v.el) { v.el = document.createElement('div'); v.el.className = 'ban'; v.el.style.setProperty('--c', v.couleur); ETI.appendChild(v.el); }
    const C = v.res, eauOk = C && C.taux > .95 && C.conf, decOk = !v.deborde && (v.sauvage || 0) < v.hab / 1000, ko = vue === 'eau' ? !eauOk : vue === 'elec' ? !v.servie : vue === 'dechets' ? !decOk : !v.servie || !eauOk;
    const txt = vue === 'dechets' ? `${nf(v.decProd || 0, 1)} t/j · ${v.deborde ? 'bacs pleins' : `bacs ${pc(Math.min(1, remplissage(v)))}`}${(v.sauvage || 0) > 1 ? ` · ${nf(v.sauvage)} t dehors` : ''}` : vue === 'eau' ? `${nf((v.m3d || 0) * 96)} m³/j · ${C ? (C.conf ? pc(C.taux) + ' servi' : 'non conforme') : 'puits'}` : vue === 'elec' ? `${nf(v.dem || 0)} MW · ${v.servie ? 'alimentée' : 'non desservie'}` : `Électricité ${v.servie ? '✓' : '✕'} · Eau ${eauOk ? '✓' : C ? '!' : '✕'} · Déchets ${decOk ? '✓' : '!'}`;
    const html = `<span class="pop">${v.hab >= 1000 ? nf(v.hab / 1000) + 'k' : nf(v.hab)}</span><span class="nom">${v.nom}<small>${txt}</small></span>`;
    if (v.el.dataset.h !== html) { v.el.innerHTML = html; v.el.dataset.h = html; v.el.classList.toggle('ko', ko); }
  }
  for (const u of UNITES) {
    const ty = TYPES[u.type];
    if (!ty.mw && !u.fin && !ty.r) { u.eti?.remove(); u.eti = null; continue; }
    if (!u.eti) { u.eti = document.createElement('div'); u.eti.className = 'eti'; ETI.appendChild(u.eti); }
    const ee = ty.r && !u.fin ? (ty.r === 'eau' ? texteEtiEau(u) : texteEtiDec(u)) : null;
    const cls = 'eti' + (u.fin ? ' chant' : ee ? (ty.r === 'eau' ? ' eau' : ' dec') + (ee[1] ? ' alerte' : '') : !actifU(u) ? ' arret' : ''), txt = u.fin ? `Chantier ${nf(avancement(u) * 100)} %` : ee ? ee[0] : !raccordee(u) ? 'Non raccordée' : u.panne > S.min ? 'Panne' : !u.dispo ? 'Arrêt' : `${nf(u.p)} MW`;
    if (u.eti.textContent !== txt) u.eti.textContent = txt; if (u.eti.className !== cls) u.eti.className = cls;
    u.eti.style.background = ty.f ? FIL[ty.f][1] : '#d6dccb';
  }
}
function texteEtiEau(u) {  // [texte, alerte]
  const ty = TYPES[u.type], C = u.res;
  if (!C) return ['Non relié', true];
  if (ty.role === 'captage') return [`${nf((u.q || 0) * 96)} m³/j`, ty.qual === 'nappe' && S.eau.nappe < .3];
  if (ty.role === 'stock') return [`${pc(u.niv ?? 0)}`, (u.niv ?? 0) < .25];
  if (ty.role === 'traitement') return [`${nf((u.q || 0) * 96)} m³/j · ${C.conf ? 'conforme' : 'non conforme'}`, !C.conf];
  if (ty.role === 'epuration') return [`${pc(C.charge || 0)} de charge`, (C.charge || 0) > 1];
  return ['Pression', false];
}
function texteEtiDec(u) {  // [texte, alerte]
  if (u.panne > S.min) return ['Incendie', true];
  if (u.type === 'decharge') { const r = (u.rempli || 0) / TYPES.decharge.volume; return [`${pc(r)} pleine`, r > .9]; }
  if (u.type === 'decheterie') return [`${nf(VILLES.reduce((s, v) => s + (v.versDech || 0), 0), 1)} t/j`, false];
  if (u.type === 'garage') return [`${S.dec.camions} camions`, S.dec.usure > .6];
  if (u.type === 'quai') return ['Transfert', false];
  if (TYPES[u.type].mwhT && raccordee(u)) return [`${nf(u.q || 0)} t/j · ${nf(u.p, 1)} MW`, (u.util ?? 0) > .97];
  return [`${nf(u.q || 0, 1)} / ${nf(capDec(u))} t/j`, (u.util ?? 0) > .97];
}
function placerEtiquettes() {
  const s = clamp(240 / distc, .7, 1.15), proche = distc < 430;
  for (const v of VILLES) { if (!v.el) continue; VA.set(v.centre.x, v.centre.top + 19, v.centre.z).project(cam); v.el.style.transform = `translate(${(VA.x + 1) / 2 * ZW}px, ${(1 - VA.y) / 2 * ZH}px) translate(-50%, -100%) scale(${s})`; v.el.style.display = VA.z < 1 ? '' : 'none'; }
  for (const u of UNITES) { if (!u.eti) continue; VA.set(u.t.x, Math.max(u.t.top, 0) + 17, u.t.z).project(cam); u.eti.style.display = proche && VA.z < 1 && reseauU(u) === vue ? '' : 'none'; u.eti.style.transform = `translate(${(VA.x + 1) / 2 * ZW}px, ${(1 - VA.y) / 2 * ZH}px) translate(-50%, -100%)`; }
}
const mini = $('#mini'), mctx = mini.getContext('2d'), fondMini = document.createElement('canvas'); fondMini.width = mini.width; fondMini.height = mini.height;
const MX = OX + R * SQ3, MZ = OZ + R * 1.5, ech = Math.min(mini.width / (2 * MX), mini.height / (2 * MZ));
const versMini = (x, z) => [mini.width / 2 + x * ech, mini.height / 2 + z * ech];
const hexCss = c => '#' + new THREE.Color(c).getHexString();
function dessinerMini() {
  const c = fondMini.getContext('2d'); c.fillStyle = '#1b211a'; c.fillRect(0, 0, fondMini.width, fondMini.height);
  for (const t of LISTE) {
    c.beginPath(); for (let i = 0; i < 6; i++) { const [x, z] = coin(t, i, 1.02), [a, b] = versMini(x, z); i ? c.lineTo(a, b) : c.moveTo(a, b); }
    c.fillStyle = t.brume ? '#6e6248' : t.ville ? t.ville.couleur : hexCss(estEau(t) ? (t.t === 'mer' ? 0x2c78ad : 0x56b2db) : TERR[t.t].col); c.fill();
  }
  if (vue === 'eau') for (const e of ARETES.values()) { c.strokeStyle = hexCss(TUYAU[e.type][0]); c.lineWidth = 2; c.beginPath(); c.moveTo(...versMini(e.a.x, e.a.z)); c.lineTo(...versMini(e.b.x, e.b.z)); c.stroke(); }
  for (const t of LISTE) if (t.occ) {
    const r = reseauU(t.occ), [a, b] = versMini(t.x, t.z);
    c.fillStyle = vue === 'carte' ? '#fff' : r === vue ? ({ eau: '#38b6ff', dechets: '#f0a35e' }[r] || '#ffc94d') : '#5d6458';
    c.beginPath(); c.arc(a, b, 3, 0, 7); c.fill(); c.strokeStyle = '#0f130e'; c.lineWidth = 1.5; c.stroke();
  }
}
function majMini() {
  mctx.drawImage(fondMini, 0, 0); mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 3; mctx.beginPath();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], i) => { NDC.set(x, y); ray.setFromCamera(NDC, cam); PL.constant = 0; if (!ray.ray.intersectPlane(PL, PT)) PT.copy(cible); const [a, b] = versMini(PT.x, PT.z); i ? mctx.lineTo(a, b) : mctx.moveTo(a, b); });
  mctx.closePath(); mctx.stroke();
}
mini.addEventListener('pointerdown', e => { const r = mini.getBoundingClientRect(); cible.x = ((e.clientX - r.left) / r.width * mini.width - mini.width / 2) / ech; cible.z = ((e.clientY - r.top) / r.height * mini.height - mini.height / 2) / ech - 30; majCam(); });
function majLentilles() { $('#lentilles').innerHTML = LENT_VUE[vue].map(([k, n, c]) => `<button type="button" data-act="lentille" data-id="${k}" class="${S.lentille === k ? 'actif' : ''}"><i style="--c:${c}"></i>${n}</button>`).join(''); }
