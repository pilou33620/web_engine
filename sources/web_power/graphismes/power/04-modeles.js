"use strict";
// ============================================================ modèles 3D des installations et des quartiers
function maison(L, x, z, ry, s = 1) {
  put(L, boite(2.2 * s, 1.7 * s, 2 * s), [0xf6eedb, 0xf1e2c2, 0xfaf6ee][rnd() * 3 | 0], x, .85 * s, z, ry);
  toit(L, 2.5 * s, 2.2 * s, 1.3 * s, [0xd9573b, 0xe07a3a, 0xc4493a][rnd() * 3 | 0], x, 1.7 * s, z, ry);
}
function arbre(L, x, z, s = 1) { put(L, cyl(.25, .3, 1.2 * s, 5), 0x7a5233, x, .6 * s, z); put(L, sphere(1.3 * s, 0), 0x5fae3e, x, 2 * s, z); }
const sol = (L, col) => put(L, cyl(R * .9, R * .9, .25, 6), col, 0, .12, 0, 0, 0);
const TOUR = new THREE.LatheGeometry([[3.6, 0], [3.1, 3], [2.5, 7], [2.45, 9], [2.75, 12]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
function eolienne(L, ex, x, z, h = 13, base = 0) {
  if (base) { put(L, cyl(.9, .9, base, 8), 0xf2c94c, x, base / 2 - base + .6, z); }
  put(L, cyl(.6, .6, .5, 8), 0xc9c6bc, x, .25, z); put(L, cyl(.32, .58, h, 8), 0xf6f6f1, x, h / 2, z);
  put(L, boite(1.1, 1.1, 2.4), 0xf6f6f1, x, h + .3, z - .4); ex.rotors.push([x, h + .3, z + .95]);
}
const BAT = {
  solaire(L) {
    sol(L, 0xb3c27a);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const x = i * 3.1 + (j & 1) * .2, z = j * 2.9; if (Math.hypot(x, z) > 7.3) continue;
      const p = boite(2.7, .22, 1.9); p.rotateX(.5); put(L, p, 0x2d4f92, x, 1.1, z, 0, .16); put(L, boite(.2, .9, .2), 0x8d96a0, x, .45, z, 0, 0);
    }
    put(L, boite(1.5, 1.4, 1.2), 0xf1efe6, 6.2, .7, -1.5);
  },
  eolien(L, ex) { for (const [x, z] of [[-4, -3.4], [4.2, -2.2], [-.2, 3.8]]) eolienne(L, ex, x, z); },
  offshore(L, ex) { for (const [x, z] of [[-4.5, -3], [4, -3.5], [0, 2], [-5, 4.5], [5, 4]]) eolienne(L, ex, x, z, 15, 3); put(L, boite(3, 2, 3), 0xf2c94c, 0, 1, -6.5); },
  barrage(L) {
    put(L, boite(2.6, 7.5, 15), 0xd9d5c9, 0, 1.2, 0); put(L, boite(3.2, .7, 15.6), 0xbcb7aa, 0, 5.2, 0);
    const d = boite(4, .6, 3.6); d.rotateZ(-.75); put(L, d, 0xe9f6fb, 2.6, 1.4, 0, 0, .12);
    put(L, boite(3.4, 2.6, 3.8), 0xc9c4b6, 3.4, 1.3, 5.2); toit(L, 3.8, 4.2, 1.1, 0x5c6f82, 3.4, 2.6, 5.2, Math.PI / 2);
    put(L, cyl(.9, .9, 4, 8), 0xc9c4b6, 0, 6.8, -6.7); put(L, cyl(.9, .9, 4, 8), 0xc9c4b6, 0, 6.8, 6.7);
  },
  charbon(L, ex) {
    sol(L, 0xa9a394);
    put(L, boite(6.5, 4.2, 4.6), 0xb7634a, -1.2, 2.1, .6); put(L, boite(6.9, .5, 5), 0x5a4741, -1.2, 4.4, .6); put(L, boite(3.2, 6.8, 3.2), 0x9ea2a8, 3.3, 3.4, .2);
    put(L, cyl(1.05, 1.2, 5, 10), 0xd9573b, 4.5, 2.5, 4.2); put(L, cyl(.92, 1.05, 5, 10), 0xf6f2ea, 4.5, 7.5, 4.2); put(L, cyl(.82, .92, 4.5, 10), 0xd9573b, 4.5, 12.25, 4.2);
    ex.fum.push([4.5, 14.8, 4.2, false]); put(L, cone(2.8, 2.4, 7), 0x2f2c2a, -4.6, 1.2, -3.8);
    const conv = boite(.6, .5, 5.4); conv.rotateX(.4); put(L, conv, 0x6b6f75, -3, 2, -1.6, .9);
    put(L, TOUR.clone().scale(.82, .82, .82), 0xe2ded4, 1.5, 0, -4.6, 0, .3); ex.fum.push([1.5, 10.6, -4.6, true]);
  },
  gaz(L, ex) {
    sol(L, 0xb0ab9d);
    put(L, boite(7.4, 3.3, 3.8), 0xece8dd, -.6, 1.65, 1.8); put(L, boite(7.8, .45, 4.2), 0x3f7fb5, -.6, 3.5, 1.8);
    for (const x of [-2.6, 1.8]) { put(L, boite(2.4, 4.6, 2.8), 0xb7bcc2, x, 2.3, -2.4); put(L, cyl(.55, .65, 9.5, 10), 0xa9adb3, x, 4.75, -4.6); ex.fum.push([x, 9.7, -4.6, true]); }
    put(L, sphere(1.8, 1), 0xf4f3ee, 5.3, 2.4, -2.6); put(L, cyl(.25, .25, 1.6, 6), 0x8d96a0, 5.3, .8, -2.6);
  },
  tac(L, ex) {
    sol(L, 0xb0ab9d);
    put(L, boite(5.6, 2.6, 3), 0xe9e6dd, -1, 1.3, 1); put(L, boite(5.9, .4, 3.3), 0xe0607e, -1, 2.7, 1);
    for (const x of [-2.4, .6]) { put(L, cyl(.7, .8, 6, 10), 0xa9adb3, x, 3, -2.6); ex.fum.push([x, 6.2, -2.6, false]); }
    put(L, cyl(1.6, 1.6, 2.4, 12), 0xf4f3ee, 4.4, 1.2, -1.8);
  },
  biomasse(L, ex) {
    sol(L, 0xb8a98a);
    put(L, boite(5.6, 3.6, 4), 0x9c7a52, -.8, 1.8, .8); toit(L, 5.9, 4.3, 1.4, 0x5d7a3a, -.8, 3.6, .8, Math.PI / 2);
    put(L, cyl(.7, .85, 9, 10), 0xc9c4b6, 3.6, 4.5, 2.6); ex.fum.push([3.6, 9.2, 2.6, true]);
    for (let i = 0; i < 4; i++) { const b = cyl(.6, .6, 3.6, 8); b.rotateZ(Math.PI / 2); put(L, b, 0xa0703f, -4 + (i % 2) * .4, .6 + (i >> 1) * 1.15, -4 + (i % 2) * 1.2, .3); }
  },
  nucleaire(L, ex) {
    sol(L, 0xbab4a4);
    for (const [x, z] of [[-3.6, -2.4], [3.4, -3.3]]) { put(L, TOUR.clone(), 0xe5e1d7, x, 0, z, 0, .3); ex.fum.push([x, 12.6, z, true]); }
    put(L, cyl(2.3, 2.3, 3.4, 14), 0xf3f0e8, -1.6, 1.7, 4); put(L, new THREE.SphereGeometry(2.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf3f0e8, -1.6, 3.4, 4);
    put(L, boite(5, 2.8, 3), 0xe3dfd5, 3.6, 1.4, 3.8); put(L, boite(5.3, .4, 3.3), 0xd9573b, 3.6, 3, 3.8);
  },
  smr(L, ex) {
    sol(L, 0xbab4a4);
    for (const x of [-3, 2]) { put(L, cyl(1.6, 1.6, 2.6, 12), 0xf3f0e8, x, 1.3, -1.5); put(L, new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf3f0e8, x, 2.6, -1.5); }
    put(L, boite(6, 2.2, 2.6), 0xe3dfd5, -.5, 1.1, 3); put(L, boite(6.3, .35, 2.9), 0x7cc0f2, -.5, 2.4, 3);
    put(L, TOUR.clone().scale(.5, .55, .5), 0xe5e1d7, 5.2, 0, 1.8, 0, .25); ex.fum.push([5.2, 7, 1.8, true]);
  },
  fusion(L) {
    sol(L, 0xc6c2d6);
    const tor = new THREE.TorusGeometry(4, 1.8, 10, 24); tor.rotateX(Math.PI / 2); put(L, tor, 0xd9d4ec, 0, 2.6, 0);
    put(L, cyl(1.6, 1.6, 6, 14), 0xb08af0, 0, 3, 0); put(L, sphere(1.2, 1), 0xffe27a, 0, 6.6, 0);
  },
  batterie(L) {
    sol(L, 0xb8b2a2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { put(L, boite(4.2, 2, 1.7), 0xf3f3ef, (j - .5) * 5, 1, (i - 1) * 3); put(L, boite(4.25, .35, 1.75), 0x5fbf6b, (j - .5) * 5, 1.6, (i - 1) * 3, 0, 0); }
    put(L, boite(1.6, 1.6, 1.6), 0x8e9aa4, 0, .8, 5.8);
  },
  poste(L) {
    sol(L, 0xbdb6a6);
    for (const x of [-2.6, 2.6]) {
      put(L, boite(2.4, 2.2, 1.9), 0x8e9aa4, x, 1.1, .6);
      for (let k = -1; k <= 1; k++) put(L, boite(.22, 1.7, 2.3), 0x77838d, x + k * .7, .95, 1.85, 0, 0);
      for (let k = -1; k <= 1; k++) put(L, cyl(.16, .2, 1.1, 6), 0x8a5a3a, x + k * .7, 2.75, .2, 0, .12);
    }
    for (const x of [-5.6, 5.6]) put(L, boite(.4, 6, .4), 0x9aa3ad, x, 3, -3);
    put(L, boite(11.6, .4, .4), 0x9aa3ad, 0, 6, -3); put(L, boite(2.6, 1.8, 2), 0xf1efe6, 0, .9, 5);
  },
  frontiere(L) {
    BAT.poste(L);
    put(L, boite(.5, 9, .5), 0x6b6f75, 6.2, 4.5, 3.5); put(L, boite(4.2, 2.6, .3), 0xc3b0ea, 6.2, 8.2, 3.5); put(L, boite(1.2, .5, .32), 0xffc94d, 6.2, 8.2, 3.5, 0, 0);
  },
  grue(L) { // chantier : grue jaune et palissade
    put(L, boite(.7, 15, .7), 0xf2c94c, 5, 7.5, 5); put(L, boite(12, .7, .7), 0xf2c94c, 1, 15, 5); put(L, boite(1.6, 1.6, 1.6), 0x6b6f75, -4.2, 14, 5); put(L, boite(.2, 5, .2), 0x3a3a3a, 3, 12.3, 5, 0, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = boite(7.6, 1.2, .3); put(L, b, i % 2 ? 0xffffff : 0xff8a3a, Math.cos(a + Math.PI / 6) * 7.3, .6, Math.sin(a + Math.PI / 6) * 7.3, -(a + Math.PI / 6) + Math.PI / 2, .1); }
  },
};
// modèles des époques anciennes ; la grande centrale à charbon reprend le modèle d'origine
BAT.charbonG = BAT.charbon;
Object.assign(BAT, {
  usine(L, ex) {
    sol(L, 0xa9a394);
    put(L, boite(5.4, 3.4, 4), 0xa8553c, -1, 1.7, .4); toit(L, 5.7, 4.3, 1.6, 0x5a4741, -1, 3.4, .4, Math.PI / 2);
    for (let k = 0; k < 3; k++) put(L, boite(.8, 1.2, .1), 0xf2d27a, -2.6 + k * 1.6, 1.8, 2.45, 0, 0);
    put(L, cyl(.55, .8, 10, 8), 0x8a3f2c, 3.2, 5, 2.4); put(L, cyl(.7, .7, .5, 8), 0x5a2f24, 3.2, 10, 2.4); ex.fum.push([3.2, 10.6, 2.4, false]);
    put(L, cone(1.8, 1.6, 7), 0x2f2c2a, 3.4, .8, -3.4);
  },
  fil(L) {  // l'eau coule vers +x local
    put(L, boite(1.4, 1.6, 13), 0xbcb7aa, 0, .4, 0);
    put(L, boite(3.6, 2.8, 3.6), 0xd8cbb0, 2.2, 1.4, 3.6); toit(L, 4, 4, 1.3, 0x7a5a44, 2.2, 2.8, 3.6, Math.PI / 2);
    const d = boite(2.4, .4, 8); d.rotateZ(-.5); put(L, d, 0xe9f6fb, 1.4, .5, -2, 0, .1);
  },
  charbon(L, ex) {
    sol(L, 0xa9a394);
    put(L, boite(6, 4, 4.4), 0xb7634a, -1, 2, .6); put(L, boite(6.4, .5, 4.8), 0x5a4741, -1, 4.2, .6); put(L, boite(3, 6, 3), 0x9ea2a8, 3.2, 3, .2);
    put(L, cyl(.95, 1.1, 5, 10), 0xd9573b, 4.2, 2.5, 4); put(L, cyl(.85, .95, 5.5, 10), 0xf6f2ea, 4.2, 7.75, 4); ex.fum.push([4.2, 10.8, 4, false]);
    put(L, cone(2.4, 2.2, 7), 0x2f2c2a, -4.4, 1.1, -3.6);
  },
  fioul(L, ex) {
    sol(L, 0xb0ab9d);
    for (const z of [-3.6, .4]) { put(L, cyl(2.1, 2.1, 3, 14), 0xe9e6dd, -4, 1.5, z); put(L, cyl(2.15, 2.15, .3, 14), 0xa07850, -4, 3, z, 0, .1); }
    put(L, boite(5, 3.6, 3.8), 0xd8d4c8, 2, 1.8, -.4); put(L, boite(5.3, .4, 4.1), 0x6b4f3a, 2, 3.8, -.4);
    put(L, cyl(.75, .95, 11, 10), 0xc9c4b6, 3.4, 5.5, 4); put(L, cyl(.78, .78, 1, 10), 0xd9573b, 3.4, 10.5, 4, 0, .1); ex.fum.push([3.4, 11.4, 4, false]);
  },
});
// ouvrages de l'eau (le +x local regarde la rivière ou la mer)
Object.assign(BAT, {
  prise(L) {
    sol(L, 0xb9b4a4);
    put(L, boite(4.6, 3, 4.2), 0xe6e0d0, -2, 1.5, 0); toit(L, 5, 4.6, 1.5, 0x3f7fb5, -2, 3, 0, Math.PI / 2);
    put(L, boite(7, .6, 1.8), 0xbcb7aa, 3.6, 1, 0); put(L, boite(.5, 2.6, 3.6), 0x6b6f75, 7.2, .6, 0);
    const tu = cyl(.7, .7, 7, 8); tu.rotateZ(Math.PI / 2); put(L, tu, 0x3f9cff, 3.4, .6, 1.8, 0, .15);
  },
  potab(L) {
    sol(L, 0xc2bdae);
    for (const z of [-4.2, -.6]) { put(L, boite(7.4, 1.3, 3), 0xd5d0c4, -1.6, .65, z); put(L, boite(6.8, .2, 2.4), 0x6fb8a8, -1.6, 1.32, z, 0, 0); }
    put(L, boite(4.6, 3.2, 3.6), 0xf3efe6, -1.4, 1.6, 4); put(L, boite(4.9, .5, 3.9), 0x3f9cff, -1.4, 3.4, 4);
    put(L, cyl(1.1, 1.1, 2.8, 12), 0xf4f3ee, 4.8, 1.4, -2.6); put(L, cyl(1.15, 1.15, .5, 12), 0x7be08a, 4.8, 3, -2.6, 0, .1);
    put(L, cyl(1.1, 1.1, 2.8, 12), 0xf4f3ee, 4.8, 1.4, 1.2);
  },
  chateau(L) {
    sol(L, 0x9fc46a);
    put(L, cyl(1.3, 1.8, 9.5, 12), 0xe9e3d3, 0, 4.75, 0);
    const cuve = new THREE.LatheGeometry([[1.2, 0], [4.2, 2.4], [4.4, 4.4], [4, 5.1], [.01, 5.6]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
    put(L, cuve, 0xf3eee2, 0, 9.2, 0, 0, .3);
    put(L, cyl(4.45, 4.45, .8, 18), 0x3f9cff, 0, 12.6, 0, 0, .12);
    put(L, boite(1.4, 1.9, .5), 0x7a5233, 0, .95, 1.75, 0, 0); arbre(L, 5, 3); arbre(L, -5.2, -2, .9);
  },
  reservoir(L) {
    sol(L, 0x8fbf5a);
    const butte = sphere(5.6, 2); butte.scale(1, .34, 1); put(L, butte, 0x86b85a, 0, 0, 0, 0, .2);
    put(L, boite(2.2, 1, 2.2), 0xcfcac0, 0, 2, 0); put(L, boite(2.4, .25, 2.4), 0x3f9cff, 0, 2.6, 0, 0, .1);
    put(L, cyl(.35, .35, 1.6, 6), 0xcfcac0, 2.6, 1.4, 1.6, 0, .1);
  },
  forage(L) {
    sol(L, 0xb3c27a);
    put(L, boite(3.2, 2.4, 2.8), 0xe3ddcf, -2.6, 1.2, 1.4); toit(L, 3.6, 3, 1.2, 0xc4493a, -2.6, 2.4, 1.4);
    put(L, cyl(1.1, 1.1, 1.3, 10), 0x5c7184, 2.2, .65, -1.2);
    for (const x of [1, 3.4]) put(L, boite(.35, 5.6, .35), 0x9aa3ad, x, 2.8, -1.2, 0, .12);
    put(L, boite(3, .4, .4), 0x9aa3ad, 2.2, 5.6, -1.2, 0, .12);
    const tu = cyl(.45, .45, 4, 8); tu.rotateZ(Math.PI / 2); put(L, tu, 0x3f9cff, .1, .5, -1.2, 0, .12);
  },
  source(L) {
    put(L, cyl(R * .7, R * .8, .4, 6), 0x9aa77a, 0, .2, 0, 0, 0);
    put(L, boite(4.2, 2.2, 3.2), 0xb9ad94, 0, 1.1, -1); toit(L, 4.6, 3.6, 1.3, 0x8a7a64, 0, 2.2, -1);
    put(L, boite(.9, 1.4, .3), 0x5a4741, 0, .7, .65, 0, 0);
    put(L, cyl(1.8, 1.8, .6, 12), 0xb9ad94, 0, .3, 3.4); put(L, cyl(1.5, 1.5, .2, 12), 0x6fd0f0, 0, .62, 3.4, 0, 0);
  },
  pompage(L) {
    sol(L, 0xb8b2a2);
    put(L, boite(5, 3, 4), 0xe8e2d4, -1.2, 1.5, 0); toit(L, 5.4, 4.4, 1.4, 0x5c6f82, -1.2, 3, 0, Math.PI / 2);
    for (const z of [-1, 1]) { const tu = cyl(.7, .7, 5, 10); tu.rotateZ(Math.PI / 2); put(L, tu, 0x3f9cff, 3.6, .9, z * 1.3, 0, .14); }
    put(L, sphere(1.2, 1), 0xf4f3ee, 4.6, 2.6, 0);
  },
  step(L) {
    sol(L, 0xb3ad9e);
    for (const [x, z] of [[-3.3, -3], [3, -3.2]]) { put(L, cyl(2.8, 2.8, 1.4, 18), 0xcfcac0, x, .7, z); put(L, cyl(2.45, 2.45, .2, 18), 0x8f9a5c, x, 1.42, z, 0, 0); put(L, boite(5, .25, .35), 0x6b6f75, x, 1.7, z, 0, 0); }
    put(L, boite(7.6, 1.3, 3.2), 0xcfcac0, -1.4, .65, 3.4); put(L, boite(7, .2, 2.6), 0x7c8a52, -1.4, 1.32, 3.4, 0, 0);
    const oeuf = sphere(1.6, 2); oeuf.scale(1, 1.6, 1); put(L, oeuf, 0xd8d2c4, 5, 2.6, 3); put(L, cyl(.25, .25, 1, 6), 0x6b6f75, 5, 5.5, 3, 0, .1);
  },
  lagunage(L) {
    put(L, cyl(R * .82, R * .86, .3, 6), 0x9fbf63, 0, .15, 0, 0, 0);
    for (const [x, z, r] of [[-3, -2.4, 3], [3.2, -1.6, 2.6], [0, 3.6, 2.8]]) { put(L, cyl(r, r + .3, .6, 9), 0x9c8b62, x, .3, z); put(L, cyl(r - .4, r - .4, .2, 9), 0x6f9a6a, x, .62, z, 0, 0); }
    for (let i = 0; i < 7; i++) { const a = i * 2.1; put(L, cone(.3, 1.6, 4), 0x4f8a3a, Math.cos(a) * 6.6, .8, Math.sin(a) * 6.6, 0, .08); }
  },
  dessal(L) {
    sol(L, 0xc9c3b2);
    put(L, boite(8.4, 3, 4.2), 0xeef1f3, -1.4, 1.5, -1.6); put(L, boite(8.7, .45, 4.5), 0x3f9cff, -1.4, 3.2, -1.6);
    for (let i = 0; i < 4; i++) { const tu = cyl(.45, .45, 5.6, 8); tu.rotateZ(Math.PI / 2); put(L, tu, 0xd8dde2, -1.4, .6 + (i % 2) * 1, 2 + (i >> 1) * 1.1, 0, .1); }
    const tu = cyl(.7, .7, 6, 8); tu.rotateZ(Math.PI / 2); put(L, tu, 0x6b6f75, 5, .5, -1.6, 0, .14);
    put(L, cyl(1.3, 1.3, 2.4, 12), 0xf4f3ee, 4.6, 1.2, 3.4);
  },
});
BAT.forageP = L => { BAT.forage(L); put(L, cyl(1.5, 1.5, .5, 10), 0x3f7fb5, 2.2, .25, -1.2, 0, .1); };
// sites des déchets
Object.assign(BAT, {
  decharge(L) {
    put(L, cyl(R * .86, R * .9, .3, 6), 0x9c8b62, 0, .15, 0, 0, 0);
    const tas = sphere(5.4, 2); tas.scale(1, .36, .85); put(L, tas, 0x8a6f4a, -1, .3, -.6, 0, .2);
    for (const [x, z, c] of [[-3.2, -1.4, 0x5c7184], [.8, -2.8, 0xd9573b], [-.6, .6, 0xf2c94c], [1.8, -.2, 0x7be08a], [-2.4, 1.4, 0xe9e3d3], [-1.4, -3, 0x3f7fb5]]) put(L, boite(1, .55, .8), c, x, 1.9 - Math.hypot(x + 1, z + .6) * .3, z, x, .1);
    put(L, boite(2.2, 1, 1.4), 0xf2c94c, 4.4, .9, 3.4); put(L, boite(1, 1, 1.1), 0xf2c94c, 4, 1.9, 3.4); put(L, boite(.3, 1, 1.9), 0x6b6f75, 5.7, .6, 3.4, 0, .1);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; put(L, boite(.25, 1.2, .25), 0x8a6a4a, Math.cos(a) * 7.6, .6, Math.sin(a) * 7.6, 0, 0); }
  },
  decheterie(L) {
    sol(L, 0xb8b2a2);
    put(L, boite(9.4, 1.2, 2.2), 0xcfcac0, 0, .6, -2.4);
    for (const [x, c] of [[-3.5, 0x3f7fb5], [-1.15, 0xf2c94c], [1.2, 0x5fae3e], [3.55, 0x8d8f96]]) { put(L, boite(2.1, 1.3, 2.6), c, x, .65, .8); put(L, boite(2.2, .2, 2.7), 0x2f2c2a, x, 1.35, .8, 0, 0); }
    put(L, boite(2.6, 2, 2), 0xf3ead6, -3.6, 1, 5); toit(L, 2.9, 2.4, 1, 0x3f7fb5, -3.6, 2, 5);
    put(L, boite(.3, 2.4, .3), 0x6b6f75, 4.6, 1.2, 5, 0, .1); put(L, boite(2, .9, .2), 0xf0a35e, 4.6, 2.6, 5, 0, .1); arbre(L, 1, 5.4, .8);
  },
  compost(L) {
    put(L, cyl(R * .86, R * .9, .3, 6), 0xa9a07a, 0, .15, 0, 0, 0);
    for (const [z, c] of [[-4.2, 0x6d4c2f], [-1.2, 0x7a5a38], [1.8, 0x6f8a3a], [4.6, 0x86a24a]]) { const a = cyl(1.3, 1.3, 9, 8); a.rotateZ(Math.PI / 2); a.scale(1, .75, 1); put(L, a, c, -.6, .35, z, 0, .14); }
    put(L, boite(1.8, 1, 1.2), 0xf2c94c, 5.6, .8, -2.6); put(L, boite(.9, .9, 1), 0xf2c94c, 5.2, 1.7, -2.6); put(L, boite(.3, .7, 1.4), 0x6b6f75, 6.7, .5, -2.6, 0, .1);
  },
  tri(L) {
    sol(L, 0xbdb6a6);
    put(L, boite(8.6, 4, 6), 0xe8e2d4, -.8, 2, -.8); put(L, boite(9, .5, 6.4), 0x3987e5, -.8, 4.25, -.8);
    for (let k = 0; k < 3; k++) put(L, boite(1.4, 1.8, .1), 0x6b6f75, -3.6 + k * 2.6, .9, 2.25, 0, 0);
    const conv = boite(.8, .4, 5.2); conv.rotateX(-.4); put(L, conv, 0x6b6f75, 4.6, 2.3, -1.4, 0, .1);
    for (let i = 0; i < 6; i++) put(L, boite(1.3, 1.3, 1.3), [0xc98500, 0x3987e5, 0x8d8f96, 0xe9e3d3][i % 4], -3.4 + (i % 3) * 1.5, .65 + (i > 2 ? 1.3 : 0), 4.6, 0, .1);
  },
  dangereux(L) {
    sol(L, 0xbdb6a6);
    put(L, boite(6.4, 3.4, 4.4), 0xe3e0d6, -1.4, 1.7, -1.4); put(L, boite(6.7, .45, 4.7), 0xf2c94c, -1.4, 3.6, -1.4);
    for (let i = 0; i < 4; i++) put(L, boite(.5, 3.4, .1), i % 2 ? 0x2f2c2a : 0xf2c94c, -4 + i * .6, 1.7, .85, 0, 0);
    for (let i = 0; i < 6; i++) { put(L, cyl(.6, .6, 1.4, 10), 0xf2c94c, 1.6 + (i % 3) * 1.4, .7, 2.8 + (i > 2 ? 1.4 : 0)); put(L, cyl(.62, .62, .2, 10), 0x2f2c2a, 1.6 + (i % 3) * 1.4, .9, 2.8 + (i > 2 ? 1.4 : 0), 0, 0); }
    put(L, cyl(.5, .6, 7, 8), 0xc9c4b6, 4.6, 3.5, -3.6); put(L, cyl(.55, .55, .5, 8), 0xf2c94c, 4.6, 6.8, -3.6, 0, .1);
  },
  garage(L) {
    sol(L, 0xb8b2a2);
    put(L, boite(8, 3.4, 5), 0xe8e2d4, -1, 1.7, -1.8); put(L, boite(8.4, .4, 5.4), 0x5fae3e, -1, 3.6, -1.8);
    for (const x of [-3.6, -1, 1.6]) put(L, boite(2, 2.4, .1), 0x6b6f75, x, 1.2, .75, 0, 0);
    for (const [x, z] of [[-3, 3.4], [.4, 3.4], [3.8, 2.6]]) { put(L, boite(3, 1.4, 1.5), 0x7be08a, x, 1, z); put(L, boite(1.1, 1.2, 1.5), 0xf3efe6, x + 1.9, .9, z); }
  },
  quai(L) {
    sol(L, 0xbdb6a6);
    put(L, boite(9, 2, 4), 0xcfcac0, 0, 1, -1.8); const r = boite(4, .4, 3); r.rotateZ(.35); put(L, r, 0x8d8f96, -5.4, .8, -1.8, 0, .1);
    for (const [x, c] of [[-2.6, 0x3f7fb5], [.4, 0x8d8f96], [3.4, 0x5fae3e]]) put(L, boite(2.6, 1.6, 2.2), c, x, .8, 2.2);
    put(L, boite(5.4, 1.8, 1.8), 0xe9e3d3, 1, 3, -1.8); put(L, boite(1.4, 1.6, 1.8), 0xd9573b, 4.4, 2.9, -1.8);
  },
  metha(L, ex) {
    sol(L, 0xb3bba0);
    for (const [x, z] of [[-3.2, -2.4], [2.6, -2.8]]) { put(L, cyl(2.6, 2.6, 2.4, 14), 0xd8d4c8, x, 1.2, z); put(L, new THREE.SphereGeometry(2.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x86b85a, x, 2.4, z); }
    put(L, boite(4, 2.4, 2.6), 0xf3efe6, -1.6, 1.2, 3.6); put(L, boite(4.3, .35, 2.9), 0x7be08a, -1.6, 2.5, 3.6);
    put(L, cyl(.3, .4, 5, 8), 0x8d8f96, 4.6, 2.5, 3.2); put(L, cone(.5, .9, 6), 0xff9a4a, 4.6, 5.4, 3.2, 0, .1);
  },
  incin(L, ex) {
    sol(L, 0xb0ab9d);
    put(L, boite(7, 4.6, 5), 0xd8d4c8, -1.4, 2.3, .4); put(L, boite(7.3, .5, 5.3), 0xf0a35e, -1.4, 4.75, .4);
    put(L, boite(3.6, 6, 3.4), 0xc9c4b6, 3.2, 3, -1.8);
    put(L, cyl(.8, 1, 13, 10), 0xe9e6dd, 4.6, 6.5, 3.4); put(L, cyl(.85, .85, .9, 10), 0xd9573b, 4.6, 12.2, 3.4, 0, .1); ex.fum.push([4.6, 13.6, 3.4, false]);
    put(L, boite(2.4, 1.2, 1.6), 0x8d8f96, -4.6, .6, -3.8);
  },
});
// fermes : culture sur les plaines, élevage sur les prairies
function bFerme(L, elevage) {
  if (elevage) {
    put(L, boite(6, 2.2, 2.8), 0xb8453a, -1.5, 1.1, -3.4); toit(L, 6.4, 3.2, 1.3, 0x6b3a2e, -1.5, 2.2, -3.4, Math.PI / 2);
    put(L, boite(2.6, 1.8, 2.2), 0xf3ead6, 4, .9, -3.6); toit(L, 2.9, 2.5, 1.1, 0xc4493a, 4, 1.8, -3.6);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; put(L, boite(.25, .9, .25), 0x8a6a4a, Math.cos(a) * 7.4, .45, Math.sin(a) * 7.4 + 1, 0, 0); }
    put(L, new THREE.TorusGeometry(7.4, .1, 3, 28).rotateX(Math.PI / 2), 0x8a6a4a, 0, .75, 1, 0, 0);
    put(L, cyl(.9, 1, 1, 8), 0xe8c56a, 2.5, .5, 3.2, 0, .12); put(L, boite(1.8, .5, .8), 0x7d8a96, -3, .25, 2.4, 0, .1);
    return;
  }
  put(L, boite(3.2, 2, 2.6), 0xf3ead6, -3.4, 1, -3); toit(L, 3.6, 2.9, 1.4, 0xc4493a, -3.4, 2, -3);
  put(L, boite(3.6, 2.8, 4), 0xb8453a, 1.2, 1.4, -3.2); toit(L, 4, 4.4, 1.8, 0x6b3a2e, 1.2, 2.8, -3.2, Math.PI / 2); put(L, boite(1.3, 1.8, .2), 0xf3ead6, 1.2, .9, -1.15, 0, 0);
  put(L, cyl(1, 1, 4.8, 10), 0xd9d5c9, 4.3, 2.4, -1.4); put(L, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a9aa4, 4.3, 4.8, -1.4);
  const C = [0xe3c75b, 0xd6b24a, 0xa9c457, 0x9fbf4f];
  for (const [x, z, w, d] of [[-3.6, 2.6, 5, 3.4], [2.2, 3.4, 5.2, 2.8], [-.4, .3, 4, 1.6]]) { put(L, boite(w, .45, d), C[rnd() * 4 | 0], x, .22, z, 0, .12); for (let k = -1; k <= 1; k++) put(L, boite(w * .9, .12, .18), 0x8f7a3a, x, .5, z + k * d / 3.2, 0, 0); }
  put(L, cyl(.8, .9, .9, 8), 0xe8c56a, -5.6, .45, -.4, 0, .12); arbre(L, 5.8, 1.6, .8);
}
const QBAT = {
  centre(L) {
    sol(L, 0xe5d9bb);
    put(L, boite(4, 2.8, 3.2), 0xf3e6c8, 0, 1.4, 0); put(L, cyl(1.2, 1.2, 1.2, 10), 0xf3e6c8, 0, 3.4, 0);
    put(L, new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xffc94d, 0, 4, 0);
    for (const [x, z, h, c] of [[-5, -3, 8, 0x8fc1da], [-1.5, -5.6, 6, 0xf1e2c2], [3.2, -4.6, 10, 0x6aa9d1], [5.5, -.5, 5, 0xe7d3b0], [4, 4, 7, 0xf6eedb], [-.5, 5.5, 4.5, 0xe9c9a8], [-4.7, 3.6, 6.5, 0x9bc9a8], [-6, .5, 4, 0xf1e2c2]]) { put(L, boite(2.5, h, 2.5), c, x, h / 2, z); put(L, boite(2.7, .4, 2.7), 0x7d7268, x, h + .2, z, 0, 0); }
  },
  residentiel(L) { sol(L, 0x9fc46a); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rnd() * .3, l = i % 3 === 0 ? 2 : 5.6; maison(L, Math.cos(a) * l, Math.sin(a) * l, a + Math.PI / 2, entre(.95, 1.15)); } arbre(L, 3, 1.2); arbre(L, -2.5, -1.8, .9); },
  affaires(L) {
    sol(L, 0xd9d3c2);
    for (const [x, z, h, c] of [[-3, -2.6, 13, 0x5fa8d3], [2.4, -3.4, 16, 0x4a8fc4], [3.4, 2.6, 10, 0x7ec2de], [-2.8, 3.2, 8, 0x6aa9d1], [-6, 0, 6, 0x9fd0e4]]) { put(L, boite(3, h, 3), c, x, h / 2, z); put(L, boite(3.2, .7, 3.2), 0xe9f2f6, x, h + .35, z, 0, .2); }
    put(L, cyl(1.5, 1.5, 12, 12), 0x9fd0e4, 5.6, 6, -1.6);
  },
  industriel(L, ex) {
    sol(L, 0xb3ad9e);
    for (const [x, z] of [[-3.4, -2.8], [2.6, -3.2], [-2.4, 3]]) { put(L, boite(4.4, 2.2, 3.4), 0x9fb1bf, x, 1.1, z); for (let k = 0; k < 3; k++) { const s = cyl(.9, .9, 3.6, 3); s.rotateX(Math.PI / 2); s.rotateZ(Math.PI / 2 + .5); put(L, s, 0x5c7184, x - 1.45 + k * 1.45, 2.6, z, 0, .12); } }
    put(L, cyl(.6, .75, 9, 8), 0xb0644c, 4.4, 4.5, 2.6); ex.fum.push([4.4, 9.3, 2.6, false]); put(L, cyl(1.5, 1.5, 3, 12), 0xe8e4da, 1.6, 1.5, 4.6);
  },
  hopital(L) {
    sol(L, 0xd7dfcf);
    put(L, boite(6.4, 4, 3.4), 0xfbfaf6, -.8, 2, -1.6); put(L, boite(3, 2.6, 4.4), 0xfbfaf6, 2.6, 1.3, 2.4);
    put(L, boite(2.6, .35, .8), 0xe0453a, -.8, 4.2, -1.6, 0, .1); put(L, boite(.8, .35, 2.6), 0xe0453a, -.8, 4.2, -1.6, 0, .1);
    put(L, cyl(2, 2, .2, 16), 0x6b7078, -3.8, .3, 3.6, 0, .1); arbre(L, 5.2, -2.4);
  },
  village(L) {
    sol(L, 0xa9c66e);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .4; maison(L, Math.cos(a) * 4.8, Math.sin(a) * 4.8, a + Math.PI / 2, .95); }
    put(L, boite(2.2, 3, 3.6), 0xefe3c6, 0, 1.5, .3); toit(L, 2.6, 3.8, 1.3, 0x8a5a44, 0, 3, .3, Math.PI / 2);
    put(L, boite(1.3, 4.6, 1.3), 0xefe3c6, 0, 2.3, -2); put(L, cone(1.05, 2.8, 4), 0x5d6f80, 0, 6, -2, Math.PI / 4);
  },
};
const FUMEES = [], ROTORS = [], ANIMS = [];
function rotor() {
  const L = lot();
  for (let k = 0; k < 3; k++) { const p = boite(.55, 6, .22); p.translate(0, 3, 0); p.rotateZ(k * Math.PI * 2 / 3); put(L, p, 0xfbfbf7, 0, 0, 0, 0, .14); }
  put(L, sphere(.55, 1), 0xfbfbf7, 0, 0, 0, 0, .12);
  return fige(L, new THREE.Group());
}
function dessinerQuartier(t, anim) {
  semer(t); const L = lot(), ex = { fum: [] }, ry = (hache(t.q, t.r, 2) * 6 | 0) * Math.PI / 3;
  QBAT[t.quartier](L, ex); t.grpQ = fige(L); t.grpQ.position.set(t.x, t.top, t.z); t.grpQ.rotation.y = ry;
  for (const f of ex.fum) FUMEES.push({ p: new THREE.Vector3(f[0], f[1], f[2]).applyAxisAngle(AXEY, ry).add(t.grpQ.position), vap: f[3], tic: rnd() * 2, q: t });
  if (anim) pop(t.grpQ);
}
function pop(grp) { grp.scale.y = .01; ANIMS.push({ grp, t0: performance.now() }); }
