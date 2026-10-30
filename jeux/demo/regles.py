"""Jeu de démonstration : une petite région avec parcelles, rivière, villes, tracteurs et régiments.
Le même monde s'affiche dans le thème « Ferme » (vue aérienne) ou « Carte » (stratégique)."""
import math

VILLES = [("Castelvert", 300, 300, 1650), ("Les Aubiers", 1100, 230, 320),
          ("Port-Vallon", 1700, 820, 980), ("Ferrière", 650, 1230, 450)]
TYPES_SOL = (("chaume", 30), ("culture", 20), ("prairie", 15), ("labour", 15), ("foret", 12))
COUT_SEMIS = 800
VITESSE_TRACTEUR = 300   # m/h de jeu (ralentie pour rester lisible)
VITESSE_REGIMENT = 400   # m/h de jeu
ECART_PASSES = 30        # m entre deux passes de tracteur
POSTE = (-70, -50)       # où un régiment stationne par rapport au centre d'une ville
# Trois zones climatiques sur les normales de Bordeaux : côte venteuse, intérieur, coteaux plus frais et arrosés
CLIMAT = {"latitude": 44.8, "zones": [
    {"nom": "Côte", "rect": [-1e9, -1e9, 600, 1e9], "pluie": 1.15, "vent": 1.5},
    {"nom": "Intérieur", "rect": [600, -1e9, 1400, 1e9]},
    {"nom": "Coteaux", "rect": [1400, -1e9, 1e9, 1e9], "dt": -1.5, "pluie": 1.25, "vent": 1.1}]}


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


class Regles:
    CLIMAT = CLIMAT

    def initialiser(self, m):
        rng = m.rng
        m.ressource("argent", 95000)
        m.ressource("ble", 1200)
        m.ressource("bois", 600)
        L, H = m.taille
        # Parcelles sur une grille irrégulière, séparées par des chemins
        x = 0
        while x < L:
            w = rng.randint(140, 280)
            y = 0
            while y < H:
                h = rng.randint(110, 230)
                sol = rng.choices([t for t, _ in TYPES_SOL], [p for _, p in TYPES_SOL])[0]
                p = m.ajouter("parcelle", x=x + 4, y=y + 4, w=min(w, L - x) - 8, h=min(h, H - y) - 8,
                              sol=sol, sens=rng.randint(0, 1), calque="sol")
                if sol != "foret":
                    if rng.random() < 0.3:
                        m.ajouter("haie", points=[[p["x"], p["y"] + p["h"] + 4], [p["x"] + p["w"], p["y"] + p["h"] + 4]], calque="haies")
                    if rng.random() < 0.3:
                        m.ajouter("haie", points=[[p["x"] + p["w"] + 4, p["y"]], [p["x"] + p["w"] + 4, p["y"] + p["h"]]], calque="haies")
                y += h
            x += w

        m.ajouter("riviere", calque="eau", points=[
            [x, 620 + 80 * math.sin(x / 300) + 25 * math.sin(x / 90)] for x in range(-40, L + 80, 40)])
        m.ajouter("route", calque="routes", points=[[-20, 1050], [L + 20, 1050]])
        m.ajouter("route", calque="routes", points=[[900, 1050], [900, H + 20]])
        m.ajouter("frontiere", calque="frontieres", couleur="#9b4dca", points=[
            [1350 + 60 * math.sin(y / 200), y] for y in range(-20, H + 40, 40)])
        for nom, vx, vy, pop in VILLES:
            m.ajouter("ville", nom=nom, x=vx, y=vy, population=pop, calque="villes")
        m.ressource("population", sum(v[3] for v in VILLES))

        candidates = [p for p in m.de_type("parcelle") if p["sol"] in ("chaume", "labour")]
        for i, couleur in enumerate(("#3f8f3a", "#c0392b", "#2f6fb5")):
            p = candidates[i * 7 % len(candidates)]
            px, py, angle = position_tracteur(p, 0)
            m.ajouter("tracteur", mobile=True, parcelle=p["id"], distance=0.0,
                      x=px, y=py, angle=angle, couleur=couleur, calque="unites")
        for i, nom in enumerate(("1er régiment", "Dragons de Vallon")):
            depart = VILLES[i]
            m.ajouter("regiment", mobile=True, nom=nom, x=depart[1] + POSTE[0], y=depart[2] + POSTE[1],
                      cible=(i + 2) % len(VILLES), effectif=300 - i * 60, calque="unites")

        for r in m.ressources.values():
            r["delta"] = 0
        m.annoncer("Bienvenue ! Touchez une parcelle pour la voir, ▶ pour lancer le temps.")

    def tick(self, m, heures):
        for t in m.de_type("tracteur"):
            p = m.entites[t["parcelle"]]
            t["distance"] += VITESSE_TRACTEUR * heures
            t["x"], t["y"], t["angle"] = position_tracteur(p, t["distance"])
        for r in m.de_type("regiment"):
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

    def nouveau_jour(self, m):
        parcelles = m.de_type("parcelle")
        m.ressource("ble", round(2 * sum(pousse(m, p) for p in parcelles if p["sol"] in ("culture", "colza"))))
        m.ressource("bois", sum(p["sol"] == "foret" for p in parcelles))
        m.ressource("argent", round(40 * sum(pousse(m, p) for p in parcelles if p["sol"] == "prairie")))
        if m.rng.random() < 0.08:
            ville = m.rng.choice(VILLES)[0]
            m.ressource("argent", 500)
            m.annoncer(f"Foire à {ville} : +500 €.", "bonne")

    def action(self, m, nom, params):
        if nom != "semer":
            raise ValueError(f"action inconnue : {nom}")
        p = m.entites.get(params.get("id"))
        if not p or p["type"] != "parcelle" or p["sol"] != "labour":
            raise ValueError("Seule une parcelle labourée peut être semée.")
        if m.ressources["argent"]["valeur"] < COUT_SEMIS:
            raise ValueError("Pas assez d'argent.")
        m.ressource("argent", -COUT_SEMIS)
        m.modifier(p["id"], sol="colza")
        m.annoncer(f"Colza semé (−{COUT_SEMIS} €).")
        return {"message": "Colza semé."}
