"""Banc d'essai de l'interface dans Chrome (format téléphone) : accueil, nouvelle partie, construction,
déplacement d'une armée, plusieurs fins de mois, saisons et météo forcées. Le serveur doit tourner
(./target/debug/royaumes --no-browser --no-update --local). Captures dans /tmp/royaumes-*.png.
   python3 tests/navigateur.py [url]"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8795/'
JS_ECRAN = """(i)=>{const J=window.__jeu;const l=J.carte.l;const c=i%l,r=(i/l)|0;const x=Math.sqrt(3)*(c+0.5*(r&1)),z=1.5*r;
 return [x,z]}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 402, 'height': 874})
    erreurs = []
    pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'fonts' not in m.text and erreurs.append(m.text))
    pg.route('**/*', lambda r: r.abort() if 'fonts.g' in r.request.url else r.continue_())
    pg.goto(URL)
    pg.wait_for_timeout(4000)
    pg.screenshot(path='/tmp/royaumes-1-accueil.png')
    pg.click('#btn-fonder')
    pg.wait_for_timeout(3500)
    pg.screenshot(path='/tmp/royaumes-2-bienvenue.png')
    pg.click('#modale-boite button')
    pg.wait_for_timeout(1500)
    pg.screenshot(path='/tmp/royaumes-3-depart.png')
    # construire un bûcheron par l'interface
    pg.click('#bas .nb >> nth=0'); pg.wait_for_timeout(400)
    pg.click("text=Ressources"); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/royaumes-4-construire.png')
    pg.click(".fiche:has-text('Bûcheron')"); pg.wait_for_timeout(1200)
    mode = pg.evaluate("window.__jeu.mode && window.__jeu.mode.genre")
    print('mode :', mode)
    i = pg.evaluate("(()=>{const J=window.__jeu;const cap=J.etat.villes.find(v=>v.proprio===0).case;const l=J.carte.l;const d=(a,b)=>{const q=i=>{const c=i%l,r=(i/l)|0;const x=c-(r-(r&1))/2;return[x,-x-r,r]};const A=q(a),B=q(b);return Math.max(...A.map((v,k)=>Math.abs(v-B[k])))};return [...J.mode.cases].sort((a,b)=>d(a,cap)-d(b,cap))[0]})()")
    x, z = pg.evaluate(JS_ECRAN, i)
    sx, sy = pg.evaluate("([x,z])=>{const v=new (window.__jeu.etat?Object:Object)();return null}", [x, z]) or (None, None)
    # projection écran via la caméra du module (exposée par un import dynamique)
    sx, sy = pg.evaluate("""async ([x,z,i])=>{const m=await import('/graphismes/rendu/scene.js');const p=await import('/graphismes/rendu/plateau.js');
       const v=new m.THREE.Vector3(x,p.dessus(i),z).project(m.camera);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]}""", [x, z, i])
    pg.mouse.click(sx, sy); pg.wait_for_timeout(1200)
    print('bâtiments du joueur :', pg.evaluate("window.__jeu.etat.batiments.filter(b=>b.proprio===0).map(b=>b.cle+(b.reste?'*':'')).join(',')"))
    pg.screenshot(path='/tmp/royaumes-5-pose.png')
    # quelques constructions directes puis des mois
    pg.evaluate("""async()=>{const api=(await import('/js/api.js')).api;for(const k of ['pecheur','ferme','carriere','scierie','caserne','cabane']){const r=await api.cmd({action:'cases_valides',cle:k});if(r.cases&&r.cases.length)await api.cmd({action:'construire',cle:k,case:r.cases[0]});}}""")
    for n in range(3):
        pg.evaluate("document.querySelector('#modale').classList.contains('ouverte') && document.querySelector('#modale-boite button').click()")
        pg.click('#fin-tour'); pg.wait_for_timeout(4200)
    pg.screenshot(path='/tmp/royaumes-6-recap.png')
    pg.evaluate("document.querySelector('#feuille-fermer').click()")
    # avancer vers l'été via l'API puis recharger l'état
    pg.evaluate("""async()=>{const api=(await import('/js/api.js')).api;for(let k=0;k<4;k++){const r=await api.finTour();for(const pr of r.etat.propositions)await api.cmd({action:'repondre',proposition:pr.id,accepte:false});}}""")
    pg.reload(); pg.wait_for_timeout(3500); pg.click('#btn-reprendre'); pg.wait_for_timeout(3500)
    pg.evaluate("document.querySelector('#modale').classList.contains('ouverte') && document.querySelector('#modale-boite button').click()")
    pg.wait_for_timeout(800)
    pg.screenshot(path='/tmp/royaumes-7-ete.png')
    # météo forcée côté rendu : neige puis orage
    for g, t in [('neige', -3), ('orage', 22), ('brouillard', 9)]:
        pg.evaluate(f"""async()=>{{const m=await import('/graphismes/rendu/meteo.js');const pl=await import('/graphismes/rendu/plateau.js');const s={0 if g=='neige' else 2};m.appliquerMeteo({{genre:'{g}',temperature:{t},vent:0.7,direction:0.4,pluie:0.8,neige_sol:{1 if g=='neige' else 0}}},s);pl.majSaison(s,{1 if g=='neige' else 0});}}""")
        pg.wait_for_timeout(3500)
        pg.screenshot(path=f'/tmp/royaumes-8-{g}.png')
    # vie des quartiers : de près sur la capitale, la nuit, les vraies vitres s'allument et le veilleur fait sa ronde
    pg.evaluate("""async()=>{const s=await import('/graphismes/rendu/scene.js'),m=await import('/graphismes/rendu/meteo.js');const J=window.__jeu,p=s.posCase(J.etat.villes.find(v=>v.proprio===0).case);s.viser(p.x,p.z,7);m.forcerHeure('nuit');}""")
    pg.wait_for_timeout(3000)
    q = pg.evaluate("""async()=>(await import('/graphismes/rendu/quartiers.js')).etatQuartiers()""")
    print('quartiers :', q)
    assert q['proches'] > 0 and q['fenetres'] > 0, 'la vie des quartiers ne s\'est pas installée près de la capitale'
    pg.screenshot(path='/tmp/royaumes-8-quartiers-nuit.png')
    pg.evaluate("""async()=>{const m=await import('/graphismes/rendu/meteo.js');m.forcerHeure(null);}""")
    pg.evaluate("""async()=>{const m=await import('/graphismes/rendu/scene.js');m.cam.cible=50;}""")
    pg.wait_for_timeout(2500)
    pg.screenshot(path='/tmp/royaumes-9-loin.png')
    print('erreurs :', erreurs[:10])
    b.close()
