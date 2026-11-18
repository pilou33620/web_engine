"use strict";
// appareil : le téléphone se joue en portrait, la tablette et l'ordinateur en paysage
(function () {
  const d = document.documentElement, plat = navigator.platform || navigator.userAgent;
  const tactile = matchMedia('(pointer: coarse)').matches || (/Mac/.test(plat) && navigator.maxTouchPoints > 1);  // l'iPad se déclare « Mac »
  d.dataset.appareil = tactile && Math.min(screen.width, screen.height) < 600 ? 'telephone' : tactile ? 'tablette' : 'pc';
  window.majFormat = () => {
    const tel = d.dataset.appareil === 'telephone', pays = matchMedia('(orientation: landscape)').matches;
    d.dataset.format = tel || innerWidth < 900 ? 'portrait' : 'paysage';  // un ordinateur en fenêtre étroite passe aussi en portrait
    d.dataset.tourner = d.dataset.ignorer ? '' : tel && pays ? 'portrait' : d.dataset.appareil === 'tablette' && !pays ? 'paysage' : '';
  };
  majFormat(); addEventListener('resize', majFormat);
})();
