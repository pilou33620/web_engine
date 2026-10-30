"""Jeu de démonstration : une petite région côtière avec parcelles, rivière, étang, villes, unités,
constructions (routes, réseaux, éoliennes), vues de données, décisions et tutoriel.
Le même monde s'affiche dans le thème « Vue aérienne » ou « Carte »."""
import math

TITRE = "Démo"
VILLES = [("Castelvert", 330, 300, 1650), ("Les Aubiers", 1100, 230, 320),
          ("Port-Vallon", 1700, 820, 980), ("Ferrière", 700, 1230, 450)]
CULTURES = (("chaume", 30), ("culture", 20), ("prairie", 15), ("labour", 15), ("foret", 12))
NOMS = {"chaume": "Chaume", "culture": "Blé en herbe", "prairie": "Prairie", "labour": "Labour",
        "colza": "Colza", "foret": "Forêt"}
COUT_SEMIS, COUT_DIGUES = 800, 600
VITESSE_TRACTEUR = 300   # m/h de jeu (ralentie pour rester lisible)
VITESSE_REGIMENT = 400   # m/h de jeu
ECART_PASSES = 30        # m entre deux passes de tracteur
POSTE = (-70, -50)       # où un régiment stationne par rapport au centre d'une ville
ETANG = (520, 900, 95, 55)  # centre x, y, demi-axes

# Trois zones climatiques sur les normales de Bordeaux : côte venteuse, intérieur, coteaux plus frais et arrosés
CLIMAT = {"latitude": 44.8, "zones": [
    {"nom": "Côte", "rect": [-1e9, -1e9, 600, 1e9], "pluie": 1.15, "vent": 1.5},
    {"nom": "Intérieur", "rect": [600, -1e9, 1400, 1e9]},
    {"nom": "Coteaux", "rect": [1400, -1e9, 1e9, 1e9], "dt": -1.5, "pluie": 1.25, "vent": 1.1}]}

CONSTRUCTIONS = [
    {"id": "route", "libelle": "Route", "type": "ligne", "style": "route", "calque": "routes", "cout": 2000, "icone": "🛣️"},
    {"id": "ligne_electrique", "libelle": "Ligne électrique", "type": "ligne", "style": "ligne_electrique",
     "calque": "reseaux", "cout": 1500, "icone": "⚡"},
    {"id": "canal", "libelle": "Canalisation", "type": "ligne", "style": "canalisation", "calque": "reseaux",
     "cout": 1200, "icone": "🚰"},
    {"id": "eolienne", "libelle": "Éolienne", "type": "batiment", "style": "eolienne", "calque": "batiments",
     "cout": 4000, "rayon": 25, "icone": "🌀"},
    {"id": "poste", "libelle": "Poste électrique", "type": "batiment", "style": "transformateur", "calque": "batiments",
     "cout": 2500, "rayon": 15, "icone": "🔌"},
    {"id": "hangar", "libelle": "Hangar", "type": "batiment", "style": "hangar", "calque": "batiments",
     "cout": 6000, "rayon": 35, "icone": "🏚️"},
]
VUES = [{"id": "humidite", "libelle": "Humidité du sol", "min": "sec", "max": "humide"},
        {"id": "rendement", "libelle": "Rendement", "min": "nul", "max": "bon"}]
TUTORIEL = [
    {"texte": "Bienvenue ! En haut : la date et vos ressources.", "cible": "#ressources"},
    {"texte": "La météo de chaque zone climatique. Touchez-en une pour le détail.", "cible": "#zones"},
    {"texte": "Lancez ou arrêtez le temps, et changez sa vitesse.", "cible": "#lecture"},
    {"texte": "Construisez routes, lignes électriques, canalisations et éoliennes.", "cible": "#outils"},
    {"texte": "Touchez une parcelle, une ville ou une construction pour voir sa fiche.", "cible": None},
    {"texte": "Dans ☰ : thème graphique, temps réel ou tour par tour, calques et vues de données.", "cible": "#menu-btn"},
]


def cote(y):
    """Abscisse du trait de côte à la hauteur y."""
    return 150 + 40 * math.sin(y / 170) + 20 * math.sin(y / 53)


def riviere_y(x):
    return 620 + 80 * math.sin(x / 300) + 25 * math.sin(x / 90)


def dans_polygone(x, y, pts):
    dedans = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            dedans = not dedans
    return dedans


def position_tracteur(p, distance):
    """Parcours en aller-retour (boustrophédon) dans le rectangle de la parcelle."""
    nb = max(1, int(p["h"] // ECART_PASSES))
    distance %= nb * p["w"]
    passe, avance = divmod(distance, p["w"])
    aller = int(passe) % 2 == 0
    x = p["x"] + (avance if aller else p["w"] - avance)
    y = p["y"] + ECART_PASSES / 2 + int(passe) * ECART_PASSES
    return x, y, 0.0 if aller else math.pi


def pousse(m, p):
    """Croissance du jour (0 à 1) : manque d'eau, gel ou neige la freinent."""
    z = m.climat.zone_de(p["x"] + p["w"] / 2, p["y"] + p["h"] / 2)
    return 0.0 if z.drapeaux["gel"] or z.neige > 1 else min(1.0, z.sol / 40)


def puissance_eolienne(m, e):
    """kW produits : ½·ρ·S·v³·Cp, vent à 10 m porté à hauteur de moyeu, bridé à 2 MW, arrêt au-delà de 25 m/s."""
    v = m.climat.zone_de(e["x"], e["y"]).vent * 1.3
    if v < 3 or v > 25:
        return 0.0
    return min(2000.0, 0.5 * 1.225 * math.pi * 45 ** 2 * v ** 3 * 0.4 / 1000)


def relief(m):
    """Altitudes (m) sur une grille de 100 m : monte vers l'est, vallée de la rivière, zéro en mer."""
    rng, (L, H), pas = m.rng, m.taille, 100
    gros = [[rng.random() for _ in range(7)] for _ in range(6)]

    def bruit(x, y):
        gx, gy = x / L * 5, y / H * 4
        i, j = int(gx), int(gy)
        fx, fy = gx - i, gy - j
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        haut = gros[j][i] * (1 - fx) + gros[j][i + 1] * fx
        bas = gros[j + 1][i] * (1 - fx) + gros[j + 1][i + 1] * fx
        return haut * (1 - fy) + bas * fy

    valeurs = []
    for y in range(0, H + 1, pas):
        ligne = []
        for x in range(0, L + 1, pas):
            if x < cote(y) or ((x - ETANG[0]) / ETANG[2]) ** 2 + ((y - ETANG[1]) / ETANG[3]) ** 2 < 1:
                ligne.append(0)
                continue
            alt = 20 + 160 * max(0, x - 200) / (L - 200) + 70 * bruit(x, y)
            alt -= 50 * math.exp(-((y - riviere_y(x)) / 140) ** 2)
            ligne.append(round(max(2, alt)))
        valeurs.append(ligne)
    return {"pas": pas, "valeurs": valeurs}


class Regles:
    TITRE, CLIMAT, CONSTRUCTIONS, VUES, TUTORIEL = TITRE, CLIMAT, CONSTRUCTIONS, VUES, TUTORIEL

    def initialiser(self, m):
        rng = m.rng
        L, H = m.taille
        for nom, qte in (("argent", 95000), ("ble", 1200), ("bois", 600), ("energie", 0)):
            m.ressource(nom, qte)

        cote_pts = [[cote(y), y] for y in range(0, H + 1, 20)]
        # La mer déborde largement de la carte pour remplir l'écran côté ouest
        m.ajouter("zone", "mer", calque="eau", nom="Océan", ancre=[70, H / 2],
                  points=[[-3000, -3000], [cote(0), -3000], *cote_pts, [cote(H), H + 3000], [-3000, H + 3000]])
        ex, ey, ea, eb = ETANG
        marais = m.ajouter("zone", "prairie", calque="sol", x=ex - ea - 40, y=ey - eb - 40, w=2 * ea + 80, h=2 * eb + 80, sens=0)

        # Parcelles sur une grille irrégulière, séparées par des chemins
        x = 230
        while x < L:
            w = rng.randint(140, 280)
            y = 0
            while y < H:
                h = rng.randint(110, 230)
                px, py, pw, ph = x + 4, y + 4, min(w, L - x) - 8, min(h, H - y) - 8
                y += h
                if (px < marais["x"] + marais["w"] and px + pw > marais["x"]
                        and py < marais["y"] + marais["h"] and py + ph > marais["y"]):
                    continue
                style = rng.choices([t for t, _ in CULTURES], [p for _, p in CULTURES])[0]
                p = m.ajouter("zone", style, calque="sol", x=px, y=py, w=pw, h=ph, sens=rng.randint(0, 1), parcelle=True)
                if style != "foret":
                    if rng.random() < 0.3:
                        m.ajouter("ligne", "haie", calque="vegetation", points=[[px, py + ph + 4], [px + pw, py + ph + 4]])
                    if rng.random() < 0.3:
                        m.ajouter("ligne", "haie", calque="vegetation", points=[[px + pw + 4, py], [px + pw + 4, py + ph]])
            x += w

        m.ajouter("zone", "lac", calque="eau", nom="Étang de Castelvert", points=[
            [ex + ea * math.cos(a / 20 * math.pi), ey + eb * math.sin(a / 20 * math.pi)] for a in range(40)])
        m.ajouter("ligne", "riviere", calque="eau", nom="La Garonnelle", points=[
            [x, riviere_y(x)] for x in range(int(cote(riviere_y(150))) - 20, L + 80, 40)])
        m.ajouter("ligne", "route", calque="routes", points=[[cote(1050) + 10, 1050], [L + 20, 1050]])
        m.ajouter("ligne", "route", calque="routes", points=[[900, 1050], [900, H + 20]])
        m.ajouter("ligne", "frontiere", calque="frontieres", couleur="#9b4dca", points=[
            [1350 + 60 * math.sin(y / 200), y] for y in range(-20, H + 40, 40)])
        for nom, vx, vy, pop in VILLES:
            m.ajouter("batiment", "ville", calque="batiments", nom=nom, x=vx, y=vy, taille=60 + pop / 40,
                      population=pop, lumiere=True)
        m.ressource("population", sum(v[3] for v in VILLES))
        m.relief = relief(m)

        candidates = m.de_style("chaume", "labour")
        for i, couleur in enumerate(("#3f8f3a", "#c0392b", "#2f6fb5")):
            p = candidates[i * 7 % len(candidates)]
            px, py, angle = position_tracteur(p, 0)
            m.ajouter("unite", "tracteur", mobile=True, parcelle=p["id"], distance=0.0, x=px, y=py, angle=angle,
                      couleur=couleur, effet="poussiere", calque="unites")
        for i, nom in enumerate(("1er régiment", "Dragons de Vallon")):
            v = VILLES[i]
            m.ajouter("unite", "regiment", mobile=True, nom=nom, x=v[1] + POSTE[0], y=v[2] + POSTE[1],
                      cible=(i + 2) % len(VILLES), effectif=300 - i * 60, calque="unites")
        for r in m.ressources.values():
            r["delta"] = 0
        m.proposer("Foire de Castelvert", "Les marchands demandent votre soutien pour la grande foire d'automne.",
                   [("Financer (−1 000 €, +50 habitants)", "foire", {}), ("Refuser", None, {})])

    def tick(self, m, heures):
        for t in m.de_style("tracteur"):
            p = m.entites[t["parcelle"]]
            t["distance"] += VITESSE_TRACTEUR * heures
            t["x"], t["y"], t["angle"] = position_tracteur(p, t["distance"])
        for r in m.de_style("regiment"):
            nom, cx, cy, _ = VILLES[r["cible"]]
            dx, dy = cx + POSTE[0] - r["x"], cy + POSTE[1] - r["y"]
            dist, pas = math.hypot(dx, dy), VITESSE_REGIMENT * heures
            if dist <= pas:
                r["x"], r["y"] = cx + POSTE[0], cy + POSTE[1]
                r["cible"] = (r["cible"] + 1) % len(VILLES)
                m.annoncer(f"{r['nom']} arrive à {nom}.")
            else:
                r["x"] += dx / dist * pas
                r["y"] += dy / dist * pas
        mwh = sum(puissance_eolienne(m, e) for e in m.de_style("eolienne")) * heures / 1000
        if mwh:
            m.ressource("energie", round(mwh, 2))

    def nouveau_jour(self, m):
        cultures = [p for p in m.de_type("zone") if p.get("parcelle")]
        m.ressource("ble", round(2 * sum(pousse(m, p) for p in cultures if p["style"] in ("culture", "colza"))))
        m.ressource("bois", sum(p["style"] == "foret" for p in cultures))
        m.ressource("argent", round(40 * sum(pousse(m, p) for p in cultures if p["style"] == "prairie")))
        crue = next((z for z in m.climat.zones if z.drapeaux["crue"]), None)
        if crue and not any(d["titre"].startswith("Crue") for d in m.decisions.values()):
            m.proposer("Crue de la Garonnelle", f"La rivière sort de son lit ({crue.nom}). Les champs bas sont menacés.",
                       [(f"Renforcer les digues (−{COUT_DIGUES} €)", "digues", {}),
                        ("Laisser faire (−20 % de blé)", "laisser_inonder", {})])

    def peut_construire(self, m, modele, geometrie):
        if modele["type"] == "batiment":
            for eau in m.de_style("mer", "lac"):
                if dans_polygone(geometrie["x"], geometrie["y"], eau["points"]):
                    raise ValueError("Impossible de construire sur l'eau.")

    def info(self, m, e):
        if e.get("parcelle"):
            ha = f"{e['w'] * e['h'] / 10000:.1f}".replace(".", ",")
            lignes = [f"Parcelle de {ha} ha"]
            if e["style"] != "foret":
                lignes.append(f"Pousse du jour : {round(pousse(m, e) * 100)} %")
            actions = [{"libelle": f"Semer du colza ({COUT_SEMIS} €)", "nom": "semer", "params": {"id": e["id"]}}] \
                if e["style"] == "labour" else []
            return {"titre": NOMS.get(e["style"], e["style"]), "lignes": lignes, "actions": actions}
        if e["style"] == "ville":
            return {"lignes": [f"Population : {e['population']}"]}
        if e["style"] == "eolienne":
            z = m.climat.zone_de(e["x"], e["y"])
            return {"lignes": [f"Production : {round(puissance_eolienne(m, e))} kW",
                               f"Vent : {round(z.vent * 3.6)} km/h"]}
        return None

    def vue(self, m, id):
        cultures = [p for p in m.de_type("zone") if p.get("parcelle")]
        if id == "humidite":
            return {p["id"]: round(m.climat.zone_de(p["x"] + p["w"] / 2, p["y"] + p["h"] / 2).sol / 100, 3) for p in cultures}
        return {p["id"]: round(pousse(m, p), 3) for p in cultures if p["style"] != "foret"}

    def action(self, m, nom, params):
        if nom == "semer":
            p = m.entites.get(params.get("id"))
            if not p or p["style"] != "labour":
                raise ValueError("Seule une parcelle labourée peut être semée.")
            self._payer(m, COUT_SEMIS)
            m.modifier(p["id"], style="colza")
            m.annoncer(f"Colza semé (−{COUT_SEMIS} €).")
            return {"message": "Colza semé."}
        if nom == "digues":
            self._payer(m, COUT_DIGUES)
            m.annoncer("Les digues tiennent, les champs sont saufs.", "bonne")
        elif nom == "laisser_inonder":
            perte = round(m.ressources["ble"]["valeur"] * 0.2)
            m.ressource("ble", -perte)
            m.annoncer(f"Champs inondés : −{perte} de blé.", "alerte")
        elif nom == "foire":
            self._payer(m, 1000)
            m.ressource("population", 50)
            m.annoncer("La foire attire de nouveaux habitants (+50).", "bonne")
        else:
            raise ValueError(f"action inconnue : {nom}")

    @staticmethod
    def _payer(m, somme):
        if m.ressources["argent"]["valeur"] < somme:
            raise ValueError("Pas assez d'argent.")
        m.ressource("argent", -somme)
