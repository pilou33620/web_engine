"""Auto-vérification du générateur de cartes : python3 tests/test_generateur.py"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from moteur import cartes
from moteur.generateur import FORMES, REGLAGES, generer, lire_reglages
from moteur.monde import Monde


def dans(x, y, pts):
    d = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            d = not d
    return d


def altitude(c, x, y):
    r = c["relief"]
    return r["valeurs"][round(y / r["pas"])][round(x / r["pas"])]


# Description des réglages exploitable par une interface
for d in REGLAGES:
    assert {"id", "libelle", "groupe", "defaut"} <= d.keys(), d
    assert "choix" in d or {"min", "max", "pas"} <= d.keys(), d

# Entrées du joueur : types invalides et hors bornes
r = lire_reglages({"mer": 5, "rivieres": -3, "forme": "lune", "villes": "abc", "graine": float("nan"), "regions": True})
assert r["mer"] == 0.9 and r["rivieres"] == 0 and r["forme"] == "côte" and r["villes"] == 30 and r["graine"] == 1
assert r["regions"] == 8
assert lire_reglages(None) == lire_reglages({})
generer({"largeur_km": 1e9, "hauteur_km": -5, "altitude_max": "haut", "latitude": 99})

# Carte par défaut : temps et taille
t = time.perf_counter()
c = generer({})
duree = time.perf_counter() - t
taille = len(json.dumps(c, separators=(",", ":")).encode())
assert duree < 3, duree
assert taille < 1_500_000, taille
assert generer({}) == c, "même graine → même carte"
assert generer({"graine": 2}) != c

for forme in FORMES:
    for graine, mer in ((3, 0.3), (11, 0.6)):
        c = generer({"forme": forme, "graine": graine, "mer": mer})
        L, H = c["taille"]
        assert 2000 <= max(L, H) <= 4500, c["taille"]
        assert c["entites"][0]["style"] == "mer" and c["entites"][0]["calque"] == "sol"
        v = [a for ligne in c["relief"]["valeurs"] for a in ligne]
        assert len(c["relief"]["valeurs"]) <= 180 and len(c["relief"]["valeurs"][0]) <= 180
        part = v.count(0) / len(v)  # les lacs ont une altitude : 0 = mer seule
        assert abs(part - mer) <= 0.1, (forme, graine, part)
        assert 2 <= len(c["zones_climat"]) <= 3 and c["latitude"] == 45
        assert all(z["dt"] < 0 for z in c["zones_climat"] if z["nom"] == "Montagne")
        lacs = [e["points"] for e in c["entites"] if e["style"] == "lac"]
        regions = [e for e in c["entites"] if e["style"] == "departement"]
        assert regions and all(e.get("nom") or e["code"] for e in regions)
        assert any(e.get("ancre") for e in regions)
        for e in c["entites"]:
            if "points" in e:
                assert all(-1 <= x <= L + 1 and -1 <= y <= H + 1 for x, y in e["points"]), e["style"]
                if e["type"] == "zone":
                    assert len(e["points"]) >= 3, e
        for e in c["entites"]:
            if e["style"] == "riviere":
                x, y = e["points"][-1]
                assert altitude(c, x, y) == 0 or any(dans(x, y, p) or any(abs(x - a) + abs(y - b) < 3 * c["relief"]["pas"]
                                                                         for a, b in p) for p in lacs), e["nom"]
                assert e["largeur"] == sorted(e["largeur"]) and len(e["largeur"]) == len(e["points"])
                debut, fin = altitude(c, *e["points"][0]), altitude(c, x, y)
                assert debut >= fin, e["nom"]
        villes = [e for e in c["entites"] if e["style"] == "ville"]
        for e in villes:
            assert altitude(c, e["x"], e["y"]) > 0 and e["lumiere"] and e["nom"] and e["population"] > 0, e
        assert len({e["nom"] for e in villes}) == len(villes)
        assert sum(bool(e.get("prefecture")) for e in villes) <= len({e["code"] for e in regions})

# Application dans un vrai monde


class Vide:
    def initialiser(self, m): pass
    def tick(self, m, heures): pass
    def nouveau_jour(self, m): pass
    def action(self, m, nom, params): pass


m = Monde(Vide())
carte = generer({"forme": "îles", "graine": 5})
cartes.appliquer(m, carte)
assert m.taille == carte["taille"] and m.relief is carte["relief"] and len(m.climat.zones) == len(carte["zones_climat"])
assert len(m.entites) == len(carte["entites"])
m.carte()
m.avancer(30)

print(f"OK — générateur vérifié ({duree:.2f} s, {taille / 1000:.0f} ko par défaut, {len(FORMES)} formes)")
