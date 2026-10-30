"""Réseau de routes entre les villes d'une carte (cartes réelles et générées).

relier(villes, est_terre, echelle) → entités « ligne » de style "route" (grands axes) ou "chemin" (dessertes).
Chaque ville est reliée à ses voisines naturelles (graphe des voisins relatifs, sur les 7 plus proches), sans
traverser la mer ; le tracé ondule un peu, comme une vraie route qui suit le terrain.
"""
import math
import random


def _borne(v, maxi):
    return v if maxi is None else min(maxi, max(0, v))


def _chaikin(pts, tours=2):
    for _ in range(tours):
        nouveau = [pts[0]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            nouveau += [(0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2), (0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2)]
        pts = nouveau + [pts[-1]]
    return pts


def _sur_terre(a, b, est_terre, pas):
    """Le segment reste sur la terre ferme (une brève coupure est tolérée : un fleuve, un étang étroit)."""
    d = math.dist(a, b)
    n = max(2, int(d / pas))
    eau = 0
    for k in range(1, n):
        t = k / n
        if not est_terre(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t):
            eau += 1
            if eau * pas > 1.5 * pas + 0.03 * d:
                return False
        else:
            eau = 0
    return True


def relier(villes, est_terre, echelle, graine=3, taille=None):
    """villes : [{"x", "y", "population", "prefecture"?}] ; est_terre(x, y) en unités ; echelle : m par unité ;
    taille [L, H] : les tracés restent dans la carte."""
    rng = random.Random(graine)
    km = 1000 / echelle
    portee = 60 * km  # au-delà de 60 km, deux villes ne sont pas voisines directes
    pts = [(v["x"], v["y"]) for v in villes]
    n = len(pts)
    voisins = []
    for i in range(n):
        proches = sorted((math.dist(pts[i], pts[j]), j) for j in range(n) if j != i)[:7]
        voisins.append([j for d, j in proches if d < portee])
    rang = sorted(range(n), key=lambda i: -villes[i]["population"])
    grandes = set(rang[:max(3, n // 2)]) | {i for i, v in enumerate(villes) if v.get("prefecture")}  # la moitié la plus peuplée
    aretes = set()
    for i in range(n):
        for j in voisins[i]:
            if (min(i, j), max(i, j)) in aretes:
                continue
            d = math.dist(pts[i], pts[j])
            # voisins relatifs : aucune ville plus proche des deux à la fois (sinon on passe par elle)
            if any(max(math.dist(pts[i], pts[k]), math.dist(pts[j], pts[k])) < d for k in voisins[i] + voisins[j] if k not in (i, j)):
                continue
            if _sur_terre(pts[i], pts[j], est_terre, 0.5 * km):
                aretes.add((min(i, j), max(i, j)))
    entites = []
    for i, j in sorted(aretes):
        a, b = pts[i], pts[j]
        d = math.dist(a, b)
        nx, ny = -(b[1] - a[1]) / d, (b[0] - a[0]) / d
        trace = [a]
        for k in range(1, 4):  # trois coudes, décalés d'au plus 4 % de la longueur
            t, dec = k / 4, (rng.random() - 0.5) * 0.08 * d
            trace.append((a[0] + (b[0] - a[0]) * t + nx * dec, a[1] + (b[1] - a[1]) * t + ny * dec))
        trace.append(b)
        style = "route" if i in grandes and j in grandes else "chemin"
        entites.append({"type": "ligne", "style": style, "calque": "routes",
                        "points": [[round(_borne(x, taille and taille[0]), 1), round(_borne(y, taille and taille[1]), 1)]
                                   for x, y in _chaikin(trace)]})
    return entites


if __name__ == "__main__":
    # Auto-vérification : un détroit coupe la carte en deux, aucune route ne doit le traverser
    villes = [{"x": x, "y": y, "population": 1000 + 100 * k} for k, (x, y) in
              enumerate([(100, 100), (300, 120), (200, 300), (700, 100), (800, 300), (650, 250)])]
    routes = relier(villes, lambda x, y: not 450 < x < 550, 100)
    assert routes and all(all(p[0] < 450 for p in r["points"]) or all(p[0] > 550 for p in r["points"]) for r in routes)
    assert {r["style"] for r in routes} <= {"route", "chemin"}
    print(f"OK — routes vérifiées ({len(routes)} tronçons)")
