"use strict";
// ============================================================ dispatch : merit order, stockage, import, délestage
function dispatch(m) {
  const mm = m + 7.5, D = demande(mm), w = meteo(mm), s = soleil(mm), h = heure(mm);
  topologie();
  for (const c of D.villes) c.v.dem = c.tot;
  const servie = D.villes.filter(c => c.v.servie).reduce((a, c) => a + c.tot, 0);
  S.demTot = D.tot; S.demServie = servie; S.demIlot = D.villes.filter(c => !c.v.servie && !(c.v.grace > m)).reduce((a, c) => a + c.tot, 0); S.D = D;  // une ville nouvelle a un an pour être raccordée
  let reste = servie + S.pertes;
  for (const u of UNITES) { u.c = 0; if (actifU(u) && TYPES[u.type].fatal) { u.c = fatale(u, w, s); reste -= u.c; } }
  // batteries : charge la nuit ou quand il y a du surplus, décharge à la pointe du soir
  for (const u of UNITES) if (u.type === 'batterie' && actifU(u)) {
    const mwh = TYPES.batterie.mwh * (rd('b4h') ? 2 : 1), mode = u.mode === 'auto' ? (reste < 0 || h < 5.5 ? 'charge' : h >= 17 && h < 22 ? 'decharge' : 'arret') : u.mode;
    u.c = mode === 'charge' && u.soc < .98 ? -Math.min(u.cap, reste < 0 ? -reste : u.cap * .5) : mode === 'decharge' && u.soc > .03 ? Math.min(u.cap, Math.max(0, reste)) : 0;
    u.mwh = mwh; reste -= u.c;
  }
  IMP.cap = capImport(); let dernier = null;
  if (!S.ordreManuel) trierOrdre();  // ordre économique recalculé à chaque pas (la valeur de l'eau varie avec le lac)
  for (const id of S.ordre) {
    const u = unite(id); if (!u) continue;
    if (!actifU(u)) { u.c = 0; continue; }
    const cap = u === IMP ? IMP.cap : capDispo(u), mn = u === IMP ? 0 : Math.min(TYPES[u.type].min || 0, cap);
    u.c = clamp(reste, mn, cap); reste -= u.c;
    if (u.c > mn + .5) dernier = u;
  }
  S.ecretement = 0;
  if (reste < 0) {
    const ex = Math.max(-IMP.cap - IMP.c, reste); IMP.c += ex; reste -= ex;
    if (reste < 0 && rd('reversible')) for (const u of UNITES) if (u.type === 'barrage' && actifU(u) && reste < 0 && u.soc < .98) { const pompe = Math.max(reste, -u.cap * .8); u.c += pompe; reste -= pompe; }
    if (reste < -.5) { const fat = UNITES.filter(u => actifU(u) && TYPES[u.type].fatal && u.c > 0), tot = fat.reduce((a, u) => a + u.c, 0); const k = clamp(1 + reste / Math.max(1, tot), 0, 1); for (const u of fat) u.c *= k; S.ecretement = tot * (1 - k); reste += S.ecretement; }
    // encore trop de production (minimums techniques sans export possible) : on arrête les groupes les plus chers
    for (const id of [...S.ordre].reverse()) { if (reste >= -.5) break; const u = unite(id); if (!u || u === IMP || !(u.c > 0)) continue; const r = Math.min(u.c, -reste); u.c -= r; reste += r; }
  }
  S.delestage = Math.max(0, reste);
  const kd = servie > 0 ? clamp(1 - S.delestage / servie, 0, 1) : 1;
  for (const c of D.villes) c.v.charge = c.v.servie ? c.tot * kd : 0;
  S.charge = VILLES.reduce((a, v) => a + v.charge, 0);
  S.spot = dernier ? coutMarginal(dernier) : 10;
}
const PROD = () => UNITES.reduce((a, u) => a + (actifU(u) ? u.p : 0), 0) + IMP.p;
function integrer(dm) {
  for (const u of [...UNITES, IMP]) {
    if (!actifU(u) || (u !== IMP && !TYPES[u.type].mw)) { u.p = 0; continue; }
    const r = (u === IMP ? 50 : TYPES[u.type].ramp) * dm; u.p += clamp(u.c - u.p, -r, r);
    if (u.type === 'batterie') u.soc = clamp(u.soc - (u.p > 0 ? u.p / .92 : u.p * .92) * dm / 60 / (u.mwh || 200), 0, 1);
    if (u.type === 'barrage') u.soc = clamp(u.soc + (85 * meteo(S.min).debit - u.p) * dm / 60 / TYPES.barrage.stock, 0, 1);
  }
  S.charge = VILLES.reduce((a, v) => a + (v.charge || 0), 0); reseau();
  return PROD() - S.charge - S.pertes;
}
