"use strict";
// ============================================================ boucle
S = etatInitial('normal');
genererCarte(carteDef('valmont'));
let avant = performance.now(), rafraichi = 0, fEch = 0, image = 0;
function tic(maintenant) {
  requestAnimationFrame(tic);
  const dt = Math.min((maintenant - avant) / 1000, .05); avant = maintenant;
  if (BANC_ON) return;
  if (S.enJeu && !S.pause) {
    let dm = dt * VITESSES[S.vit][0], prochain = Math.floor(S.min / 15 + 1) * 15;
    let n = 0; while (dm > 1e-9 && n < 400) { const d = Math.min(dm, prochain - S.min); S.imb = integrer(d); S.min += d; dm -= d; if (S.min >= prochain - 1e-6) { S.min = prochain; pas(S.min); prochain += 15; n++; if (S.pause) break; } }  // la simulation ralentit si l'ordinateur ne suit pas
  }
  const k = 1.9 / Math.max(150, S.charge) * (rd('gridf') ? .5 : 1) * (rd('volants') ? .75 : 1);
  const cibleF = 50 + clamp(S.imb || 0, -400, 400) * k - (S.delestage > 1 ? .85 + Math.min(.4, S.delestage / Math.max(1, S.charge)) : 0) + (DOUX ? 0 : .012 * Math.sin(maintenant / 700) + .006 * Math.sin(maintenant / 230));
  S.f = lerp(S.f, cibleF, 1 - Math.exp(-dt * 4));
  if ((fEch += dt) > .1) { fEch = 0; S.fhist.push(S.f); S.fhist.shift(); }
  for (const r of ROTORS) if (actifU(r.u) && r.u.p > .5) r.g.rotation.z -= dt * r.v * 2 * Math.min(1, .3 + r.u.p / r.u.cap);
  for (let i = ANIMS.length - 1; i >= 0; i--) { const a = ANIMS[i], q = Math.min(1, (maintenant - a.t0) / 650); a.grp.scale.y = q < 1 ? 1 + Math.sin(q * Math.PI * 1.5) * (1 - q) * .5 - (1 - q) ** 3 : 1; if (q >= 1) ANIMS.splice(i, 1); }
  if (fant) FANT.opacity = .6 + Math.sin(maintenant / 220) * .15;
  const kt = Math.min(1, dt * 6); animCiel(dt, kt); MAT_RIV.color.lerp(vue === 'elec' || vue === 'dechets' ? TEINTE[vue] : TEINTE.carte, kt);
  HALO_M.eau.opacity = HALO_M.elec.opacity = HALO_M.dechets.opacity = DOUX ? .8 : .55 + Math.sin(maintenant / 330) * .3;
  animParticules(dt); animEau(dt); animAmbiance(dt); animFumees(dt); placerEtiquettes();
  if (image++ % 8 === 0) majMini();
  if ((rafraichi += dt) > .25) {
    rafraichi = 0; hud(); couleurCables(); if (routesSale) { routesSale = false; dessinerRoutes(); }
    if (S.onglet !== 'carte' && !document.querySelector('#contenu-panneau :hover') && !document.querySelector('#contenu-panneau :focus')) ouvrir(S.onglet, true);
  }
  renderer.render(scene, cam);
}
majBarre(); majLentilles(); majLentille();
cible.set(VILLES[0].centre.x + 30, 0, VILLES[0].centre.z + 20); majCam(); redim();
requestAnimationFrame(tic);
menu();
window.GM = { get AMB() { return AMB; }, __routes: () => dessinerRoutes(), __cam(t, d) { cible.set(t.x, 0, t.z + 12); distc = d; majCam(); }, topoEau, get ARETES() { return ARETES; }, get RESEAUX() { return RESEAUX; }, choisirVue, poserConduite, cheminEau, botEau, pasEau, accidentEau, crisesEau, demolir, botPollution, blocEauHex, panneauEau, panneauRD, panneauDechets, jourDechets, bilanDec, changerCamions, deployerMode, botDechets, equiperReut, etapeOk, bancPartie, botMois, STRATS, carteDef, CARTES, get CARTE() { return CARTE; }, get S() { return S; }, UNITES: () => UNITES, LIGNES: () => LIGNES, get VILLES() { return VILLES; }, get T() { return T; }, get LISTE() { return LISTE; }, TYPES, nouvellePartie, raison, finValide, chemin, n1, creerUnite, tracerLigne, terminer, pas, integrer, choisirMode, cliquer: (t, e = {}) => cliquer(t, e), avancer(jours) { S.min = Math.ceil(S.min / 15) * 15; const fin = S.min + jours * 1440; while (S.min < fin) { S.imb = integrer(15); S.min += 15; pas(S.min); } } };
