# Assemble la maquette « Guerre et diplomatie » : scene.js + batiments.js + vie2.js + guerre.js + remparts.js dans page.html.
S = '/tmp/claude-0/-home-user-web-royaumes/aa7862c0-b04f-5a96-b006-81fd49c4941e/scratchpad'
D = f'{S}/guerre'
scene = open(f'{D}/scene.js').read().replace('fusionner(', 'fusionCouleurs(')
fin = 'construirePlateau(); construireBatiments();\nrequestAnimationFrame(image);\n'
FIN2 = 'construirePlateau(); construireBatiments(); construireAmbiance(); construireVie2(); construireGuerre(); majFenetres(); appliquerCiel();\nrequestAnimationFrame(image);\n'
assert scene.endswith(fin); scene = scene[:-len(fin)]
cam = '// ---------------------------------------------------------------- caméra'
assert scene.count(cam) == 1
scene = scene.replace(cam, open(f'{D}/vie2.js').read() + '\n' + open(f'{D}/guerre.js').read() + '\n' + open(f'{D}/remparts.js').read() + '\n' + open(f'{D}/forts.js').read() + '\n' + cam)
bat = '// ---------------------------------------------------------------- bâtiments, armée et pièces animées'
assert scene.count(bat) == 1
scene = scene.replace(bat, open(f'{D}/batiments.js').read() + '\n' + bat)
hache = '''function hache(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
'''
js = "import * as THREE from 'three';\n" + hache + scene + FIN2
page = open(f'{D}/page.html').read().replace('/*SCRIPT*/', js)
open(f'{S}/guerre.html', 'w').write(page)
# copie d'aperçu : three.js local (le CDN est bloqué ici) et accès pour les scripts de capture
ap = page.replace('https://cdn.jsdelivr.net/npm/three@0.170.0/', './npm3/package/').replace('setTimeout(() => d.remove(), 4500)', 'setTimeout(() => d.remove(), 30000)').replace('const dt = Math.min(0.05, (now - avant) / 1000)', 'const dt = window.__pause ? 0 : Math.min(0.3, (now - avant) / 1000)').replace(FIN2, 'window.__REMP = REMP; window.__FORTS = FORTS; window.__X = { CASES, PLAN, centre, voisins, at, enceinte, GUERRE: () => GUERRE, lignesRiviere, constr: construireRempartsCapitale }; window.__vue = vue; window.__voir = voir; window.__SC = SC; window.__G = () => G; window.__lieu = LIEU; window.__dbg = () => ({ b: bouffees.length, e: eclats.length, g: gerbes.length, tp: JSON.stringify(tauPrec), t, st: SC.t });\n' + FIN2)
open(f'{S}/guerre-apercu.html', 'w').write(ap)
print(len(page))
