# Assemble la maquette « Vie des quartiers » en une page autonome :
# toon.js du jeu, modeles.js du jeu (tel quel, avec quelques relevés : fenêtres, portes, toits), puis quartiers.js.
import re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
JEU = '/home/user/web_royaumes/web/js/rendu'
def sans_modules(s):
    s = re.sub(r'^import .*\n', '', s, flags=re.M)
    return s.replace('export function', 'function').replace('export const', 'const').replace('export { degrade };', '')
toon = sans_modules(open(f'{JEU}/toon.js').read())
TOON = 'const { degrade, MAT, CONT, toon, boite, cyl, cone, sphere, couleur, contour, fusion, lot, put, fige, jeter } = (() => {\n' + toon + '\n  return { degrade, MAT, CONT, toon, boite, cyl, cone, sphere, couleur, contour, fusion, lot, put, fige, jeter };\n})();\n'
mod = sans_modules(open(f'{JEU}/modeles.js').read())
def remplace(a, b):
    global mod
    assert mod.count(a) == 1, a
    mod = mod.replace(a, b)
# relevés pour la maquette (EXC = l'assemblage en cours) ; hors maquette, EXC reste null et rien ne change
remplace("function toit(L, w, d, h, col, x, y, z, ry = 0) {\n", "function toit(L, w, d, h, col, x, y, z, ry = 0) {\n  EXC?.toits.push({ w, d, h, col, x, y, z, ry });\n")
remplace("put(L, boite(0.45 * s, 0.8 * s, 0.08), BOIS, px, 0.4 * s, pz, ry, 0);",
         "put(L, boite(0.45 * s, 0.8 * s, 0.08), BOIS, px, 0.4 * s, pz, ry, 0); EXC?.portes.push({ x: px, z: pz, ry, w: 0.45 * s, h: 0.8 * s });")
remplace("put(L, boite(0.4 * s, 0.4 * s, 0.08), VITRE, wx, h * 0.55, wz, ry, 0);\n    if (E.volets) for",
         "put(L, boite(0.4 * s, 0.4 * s, 0.08), VITRE, wx, h * 0.55, wz, ry, 0);\n    EXC?.fen.push({ x: wx, y: h * 0.55, z: wz, ry: ry + (f < 0 ? Math.PI : 0), w: 0.4 * s, h: 0.4 * s, volet: E.volets ? (toitC === 0xc9a14f ? 0x5c7a4a : 0x4a6a7a) : 0, toitC });\n    if (E.volets && !EXC) for")
remplace("put(L, boite(0.45, 0.6, 0.08), o.vitre ?? VITRE, fx, y, fz, ry, 0);\n    if (E.volets && !o.vitre) for",
         "put(L, boite(0.45, 0.6, 0.08), o.vitre ?? VITRE, fx, y, fz, ry, 0);\n    if (!o.vitre) EXC?.fen.push({ x: fx, y, z: fz, ry: ry + (f < 0 ? Math.PI : 0), w: 0.45, h: 0.6, volet: E.volets ? 0x4a6a7a : 0 });\n    if (E.volets && !o.vitre && !EXC) for")
remplace("put(L, boite(0.8, 1.3, 0.08), BOIS, px, 0.65, pz, ry, 0); }",
         "put(L, boite(0.8, 1.3, 0.08), BOIS, px, 0.65, pz, ry, 0); EXC?.portes.push({ x: px, z: pz, ry, w: 0.8, h: 1.3 }); }")
MOD = '''// ================= modeles.js du jeu (tel quel, plus les relevés EXC?.…)
const MOD = (() => {
  let EXC = null;
''' + mod + '''
  /** Assemble un bâtiment du jeu et relève ses fenêtres, portes, toits et cheminées (coordonnées locales de web_power). */
  function construire(cle, epoque, saison, neige, niveau = 3) {
    SAISON = saison; NEIGE = neige; EPOQUE = epoque; ROYAUME = '#2f5fa8'; CLE = cle; NIVEAU = niveau;
    const L = lot(), ex = { fum: [], ailes: [], drap: [], fen: [], portes: [], toits: [] };
    let i = 0; const g = graine(cle); rnd = () => hache(g, i++, 77);
    EXC = ex; BATR[cle](L, ex, EPOQUES[epoque]); EXC = null;
    return { L, ex, E: EPOQUES[epoque] };
  }
  return { construire, EPOQUES, toit, rondins: (L, x, z, n, ry) => rondins(L, x, z, n, ry), reverbere };
})();
'''
hache = open(f'{JEU}/scene.js').read()
m = re.search(r'export function hache\(.*?\n}\n', hache, flags=re.S)
HACHE = m.group(0).replace('export ', '')
js = "import * as THREE from 'three';\nconst SQ3 = Math.sqrt(3);\n" + HACHE + TOON + MOD + open(f'{D}/quartiers.js').read()
page = open(f'{D}/page.html').read().replace('/*SCRIPT*/', js)
sortie = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, '..', 'quartiers.html')
open(sortie, 'w').write(page)
print(sortie, len(page))
