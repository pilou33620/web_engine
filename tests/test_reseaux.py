"""Auto-vérification des réseaux par époque (voies romaines, voies ferrées, LGV, autoroutes) : python3 tests/test_reseaux.py
Sur les cartes France et Aquitaine et sur une carte générée : années cohérentes, voies raccordées, jamais en mer."""
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from moteur import cartes
from moteur.generateur import generer

PERIODES = {"voie_romaine": (-52, 499), "voie_ferree": (1842, 1885), "lgv": (1981, 2017), "autoroute": (1960, 1992)}


def verifier(c, complet=True):
    o, pas, (L, H) = c["occupation"], c["occupation"]["pas"], c["taille"]
    eau = lambda x, y: o["lignes"][min(len(o["lignes"]) - 1, int(y // pas))][min(len(o["lignes"][0]) - 1, int(x // pas))] == "."
    villes = {}  # deux villes peuvent porter le même nom (Valence, Valence-d'Agen…)
    for e in c["entites"]:
        if e["style"] == "ville":
            villes.setdefault(e["nom"], []).append((e["x"], e["y"]))
    voies = [e for e in c["entites"] if e["style"] in PERIODES]
    for style in PERIODES if complet else ("voie_romaine", "voie_ferree"):  # carte générée : pas forcément de très grande ville
        assert any(e["style"] == style for e in voies), (c["nom"], style)
    for e in voies:
        a, b = PERIODES[e["style"]]
        assert a <= e["depuis"] <= b, e
        if "jusqua" in e:
            assert e["depuis"] < e["jusqua"] and (e["style"] != "voie_ferree" or 1938 <= e["jusqua"] <= 1972), e
        # raccordée : chaque bout nommé est sur sa ville, l'autre au bord de la carte (vers la capitale hors carte)
        for bout, cle in ((e["points"][0], "de"), (e["points"][-1], "a")):
            if cle in e:
                assert min(math.dist(bout, v) for v in villes[e[cle]]) < 0.5, e
            else:
                assert min(bout[0], bout[1], L - bout[0], H - bout[1]) < 1, e
        # pas en mer : au plus une brève coupure (pont sur un fleuve, un étang étroit)
        pts = e["points"]
        long = sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
        mouille = sum(math.dist(p, q) / 20 for p, q in zip(pts, pts[1:]) for k in range(20)
                      if eau(p[0] + (q[0] - p[0]) * k / 20, p[1] + (q[1] - p[1]) * k / 20))
        assert mouille < 0.03 * long + 3 * pas, (e.get("de"), e.get("a"), e["style"], mouille, long)
    return len(voies)


total = sum(verifier(cartes.lire(nom)) for nom in ("france", "aquitaine"))
verifier(generer({"graine": 4}), False)
print(f"OK — réseaux vérifiés ({total} voies sur les cartes réelles)")
