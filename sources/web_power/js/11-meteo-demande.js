"use strict";
// ============================================================ temps, soleil, météo, demande
function soleil(m) {
  const doy = jourAn(m), decl = -23.44 * Math.cos(2 * Math.PI * (doy + 10) / 365) * Math.PI / 180, lat = 45.9 * Math.PI / 180, H = (heure(m) - 12.5) * 15 * Math.PI / 180;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  return { el, az };
}
function meteo(m) {
  const doy = jourAn(m), h = heure(m), e = S.evt, an = 2 * Math.PI * (doy - 15) / 365;
  let vent = Math.max(0, 6.6 + 1.6 * Math.cos(an) + 3.8 * Math.sin(m / 610 + .7) + 2.4 * Math.sin(m / 173 + 2.1) + Math.sin(m / 41));
  if (e.tempete > m) vent = 26.5 + 2 * Math.sin(m / 23);
  const neb = clamp(.5 + .1 * Math.cos(an) + .3 * Math.sin(m / 760 + 2) + .15 * Math.sin(m / 150 + 1) + (e.tempete > m ? .4 : 0), 0, 1);
  let temp = 11.5 - 8.5 * Math.cos(2 * Math.PI * (doy - 20) / 365) + 4 * Math.sin(2 * Math.PI * (h - 9) / 24) - 2.5 * neb + 2 * Math.sin(m / 2300);
  if (e.froid > m) temp -= 10; if (e.canicule > m) temp += 9;
  const debit = (1 + .35 * Math.sin(2 * Math.PI * (doy - 60) / 365) + .15 * Math.sin(m / 2000)) * (e.secheresse > m ? .45 : 1) + (e.tempete > m ? .3 : 0);
  return { vent, neb, temp, debit };
}
function profils(m) {
  const d = date(m), h = heure(m), we = d.getUTCDay() === 0 || d.getUTCDay() === 6, t = meteo(m).temp;
  const gs = (c, s) => Math.exp(-((((h - c + 36) % 24 - 12) / s) ** 2));
  const chauf = 1 + Math.max(0, 15 - t) * .028, clim = 1 + Math.max(0, t - 24) * .025;
  const pointe = 1 - (rd('v2g') ? .06 : 0) - (rd('tarifs') ? .04 : 0), gen = (rd('compteurs') ? .98 : 1) * (rd('ia') ? .97 : 1);
  return {
    res: (.42 + .3 * gs(8, 1.6) + .62 * pointe * gs(19.5, 2.1) + .12 * gs(13, 2)) * chauf * clim / 1.05 * gen,
    ter: (.35 + .65 * sstep(7, 9, h) * (1 - sstep(18, 20, h))) * (we ? .5 : 1) * clim * gen,
    ind: (we ? .72 : 1) * (S.effacement ? .92 : 1) * gen, crit: 1, chauf,
  };
}
function demande(m) {
  const P = profils(m), fd = facteurDemande(m), D = { res: 0, ter: 0, ind: 0, crit: 0, tot: 0, villes: [] };
  for (const v of VILLES) {
    const c = { v, tot: 0, res: 0, ter: 0, ind: 0, crit: 0 };
    for (const t of v.tuiles) { const q = QUART[t.quartier], val = q.mw * fd * P[q.cat] * (q.cat === 'res' && v.chaudK ? 1 - (1 - 1 / P.chauf) * .8 * v.chaudK : 1); c[q.cat] += val; c.tot += val; }  // le réseau de chaleur remplace le chauffage électrique
    c.ind += v.eauMW || 0; c.tot += v.eauMW || 0;  // pompage et traitement de l'eau
    D.villes.push(c); for (const k of ['res', 'ter', 'ind', 'crit', 'tot']) D[k] += c[k];
  }
  return D;
}
const courbeEol = v => (v < 3 || v > 25 ? 0 : v > 12 ? 1 : ((v - 3) / 9) ** 3);
function fatale(u, w, s) {
  const ty = TYPES[u.type];
  if (u.type === 'fil') return u.cap * clamp(.3 + .5 * w.debit, 0, 1);
  if (ty.mwhT) return Math.min(u.cap, (u.q || 0) * ty.mwhT / 24);  // incinérateur, méthaniseur : selon les tonnes traitées la veille
  if (ty.f === 'solaire') return u.cap * clamp(Math.sin(s.el) / .62, 0, 1) ** 1.2 * (1 - .8 * w.neb) * (.6 + u.t.soleil * .1) * (rd('bifacial') ? 1.15 : 1);
  if (ty.f === 'eolien') return u.cap * courbeEol(w.vent * u.t.vent / 6.2 * (u.type === 'offshore' ? 1.15 : 1)) * (rd('pales') ? 1.08 : 1) * (w.vent > 25 ? 0 : 1);
  return 0;
}
const co2An = a => (a < 2005 ? 0 : a < 2027 ? 20 + (a - 2005) * 65 / 22 : 85 + 8 * (a - 2027));  // quotas européens à partir de 2005
const prixCO2 = () => co2An(annee(S.min));
const prixVoisin = m => (60 + ((CARTE && CARTE.prixVol) || 1) * (22 * Math.cos(2 * Math.PI * (jourAn(m) - 15) / 365) + 18 * Math.sin(m / 900)) + 30 * Math.exp(-((((heure(m) - 19 + 36) % 24 - 12) / 2) ** 2)) + (S.evt.froid > m ? 70 : 0) + (S.evt.gaz > m ? 45 : 0) + .25 * co2An(annee(m))) * tarifEre(annee(m)) ** .5;  // le voisin émet ~250 g/kWh
const capImport = () => !busFront() || !COMP.has(busFront()) ? 0 : BR.filter(b => b.type === 'L' && actifB(b) && (b.ba === busFront() || b.bb === busFront())).reduce((a, b) => a + b.cap, 0) + (rd('hvdc') ? 600 : 0);
function capDispo(u) {
  const ty = TYPES[u.type]; let c = u.cap;
  const thermique = ['usine', 'charbon', 'charbonG', 'fioul', 'gaz', 'nucleaire', 'smr', 'biomasse'].includes(u.type);
  if (S.evt.canicule > S.min && thermique) c *= .72;
  if (S.evt.secheresse > S.min && thermique && bordEau(u.t) && S.eau.prioRiv !== 'centrales') c *= .7;  // sécheresse : moins d'eau pour refroidir, sauf si la rivière leur est réservée
  if (u.type === 'barrage') c = u.soc > .02 ? c : Math.min(c, 85 * meteo(S.min).debit);
  return c;
}
