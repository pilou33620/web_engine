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


# --- Réseaux par époque : voies romaines, chemins de fer, lignes à grande vitesse, autoroutes ---
# Chefs-lieux de cités gallo-romaines (noms actuels) : ce sont eux que relient les voies romaines
ANTIQUES = {v.strip() for v in """Paris, Lyon, Marseille, Narbonne, Nîmes, Arles, Vienne, Fréjus, Toulouse, Bordeaux, Saintes, Poitiers, Limoges,
Périgueux, Agen, Cahors, Rodez, Albi, Auch, Dax, Bazas, Lectoure, Eauze, Bourges, Clermont-Ferrand, Autun, Sens, Auxerre,
Troyes, Langres, Besançon, Reims, Soissons, Amiens, Beauvais, Rouen, Évreux, Lisieux, Bayeux, Chartres, Orléans, Tours,
Le Mans, Angers, Nantes, Rennes, Vannes, Metz, Toul, Verdun, Strasbourg, Grenoble, Valence, Orange, Avignon, Apt,
Aix-en-Provence, Antibes, Nice, Béziers, Carcassonne, Lescar, Oloron-Sainte-Marie, Bayonne, Angoulême, Senlis, Meaux, Arras,
Cambrai, Boulogne-sur-Mer, Chalon-sur-Saône, Mâcon, Nevers, Coutances, Avranches, Mende, Le Puy-en-Velay, Tarbes,
Saint-Lizier, Saint-Bertrand-de-Comminges, Aire-sur-l'Adour, Libourne, Mont-de-Marsan, Bergerac, Villeneuve-sur-Lot, Pau""".split(",")}


def _hash(*cles):
    return random.Random("|".join(map(str, cles))).random()


def _rng_aretes(dist, idx, portee, sur_terre):
    """Graphe des voisins relatifs entre les nœuds idx (aucun nœud plus proche des deux), arêtes sur la terre ferme.
    sur_terre(i, j) dit si l'arête est possible ; portee=None pour une arête qui la dépasse quand même (bord de carte)."""
    aretes = []
    for a, i in enumerate(idx):
        for j in idx[a + 1:]:
            d = dist(i, j)
            if (portee(i, j) and d > portee(i, j)) or any(max(dist(i, k), dist(j, k)) < d for k in idx if k not in (i, j)):
                continue
            if sur_terre(i, j):
                aretes.append((i, j))
    return aretes


def _arbre_radial(dist, idx, racine, portee, poids=0.8):
    """Étoile ferroviaire : chaque nœud (du plus proche au plus loin de la racine) se raccorde au nœud déjà relié qui
    minimise d(nœud, parent) + poids × d(parent, racine) ; rend [(enfant, parent)] dans l'ordre de construction."""
    relies, res = [racine], []
    for i in sorted((k for k in idx if k != racine), key=lambda k: dist(k, racine)):
        choix = [(dist(i, p) + poids * dist(p, racine), p) for p in relies if not portee(i, p) or dist(i, p) <= portee(i, p)]
        if choix:
            res.append((i, min(choix)[1]))
            relies.append(i)
    return res


def _gares(pts, a, b, candidats, largeur):
    """Villes près du segment a→b (dans un fuseau de `largeur` × longueur au milieu), dans l'ordre du parcours."""
    (xa, ya), (xb, yb) = a, b
    d2 = (xb - xa) ** 2 + (yb - ya) ** 2 or 1
    l = math.sqrt(d2)
    res = []
    for k in candidats:
        t = ((pts[k][0] - xa) * (xb - xa) + (pts[k][1] - ya) * (yb - ya)) / d2
        if 0.06 < t < 0.94 and abs((pts[k][0] - xa) * (yb - ya) - (pts[k][1] - ya) * (xb - xa)) / l < largeur * l * min(t, 1 - t) * 2:
            res.append((t, k))
    return [k for _, k in sorted(res)]


def _onduler(trace, rng, ampleur):
    """Ajoute un coude au milieu de chaque tronçon, décalé d'au plus ampleur × sa longueur."""
    pts = [trace[0]]
    for a, b in zip(trace, trace[1:]):
        d = math.dist(a, b) or 1
        dec = (rng.random() - 0.5) * 2 * ampleur * d
        pts += [((a[0] + b[0]) / 2 - (b[1] - a[1]) / d * dec, (a[1] + b[1]) / 2 + (b[0] - a[0]) / d * dec), b]
    return pts


def reseaux(villes, est_terre, echelle, graine=5, taille=None, pole=None):
    """Voies des époques, en entités « ligne » datées (`depuis`, `jusqua` : années) :
      voie_romaine (-52 à 499) : presque droite entre chefs-lieux antiques ;
      voie_ferree (`rang` 1 grande ligne depuis 1842–1860, 2 ligne secondaire depuis 1858–1885, parfois fermée 1938–1972) ;
      lgv (1981–2017) entre très grandes villes ; autoroute (1960–1992) entre les plus grandes, tracé direct.
    Chaque entité porte `de` et `a` (noms des villes aux bouts, absent pour un bout au bord de la carte).
    pole (x, y) : la capitale ; si elle est hors de la carte (Paris pour l'Aquitaine), les voies qui y mènent sortent
    par le bord de la carte, dans sa direction."""
    rng = random.Random(graine)
    km = 1000 / echelle
    L, H = taille or (max(v["x"] for v in villes) + 1, max(v["y"] for v in villes) + 1)
    ordre = sorted(villes, key=lambda v: -v["population"])
    pts = [(v["x"], v["y"]) for v in ordre]
    noms = [v.get("nom", "") for v in ordre]
    pops = [v["population"] for v in ordre]
    n = len(pts)
    if n < 2:
        return []
    racine = 0
    dehors = pole and not (0 <= pole[0] <= L and 0 <= pole[1] <= H)
    if dehors:
        racine = n  # nœud fictif : la capitale hors carte

    def dist(i, j):
        if i == j:
            return 0
        if racine == n and n in (i, j):
            return math.dist(pts[i + j - n], pole)
        return math.dist(pts[i], pts[j])

    def point(k, autre):
        """Position d'un bout de voie ; pour la capitale hors carte, sortie au bord sur la droite ville → capitale."""
        if k < n:
            return pts[k]
        (x, y), (px, py) = pts[autre], pole
        t = min([(b - x) / (px - x) for b in (0.5, L - 0.5) if px != x and 0 < (b - x) / (px - x)]
                + [(b - y) / (py - y) for b in (0.5, H - 0.5) if py != y and 0 < (b - y) / (py - y)])
        return (x + (px - x) * t, y + (py - y) * t)

    terre = lambda a, b: _sur_terre(a, b, est_terre, 0.5 * km)
    terre_ij = lambda i, j: terre(point(i, j), point(j, i))
    portee = lambda p: (lambda i, j: None if n in (i, j) else p)  # vers la capitale hors carte : pas de limite
    entites = []

    def ligne(style, trace, i, j, ampleur, tours=2, **attributs):
        trace = _onduler(trace, rng, ampleur)
        trace = [(_borne(x, L), _borne(y, H)) for x, y in (_chaikin(trace, tours) if tours else trace)]
        if not all(terre(a, b) for a, b in zip(trace, trace[1:])):
            return False
        e = {"type": "ligne", "style": style, "calque": "reseaux" if style in ("voie_ferree", "lgv") else "routes",
             "points": [[round(x, 1), round(y, 1)] for x, y in trace], **attributs}
        for cle, k in (("de", i), ("a", j)):
            if k < n and noms[k]:
                e[cle] = noms[k]
        entites.append(e)
        return True

    # Voies romaines : chefs-lieux antiques (à défaut, le quart le plus peuplé), en ligne presque droite
    antiques = [k for k in range(n) if noms[k] in ANTIQUES] or list(range(max(3, n // 4)))
    for i, j in _rng_aretes(dist, antiques, portee(220 * km), terre_ij):
        ligne("voie_romaine", [pts[i], pts[j]], i, j, 0.012, 0, depuis=-52, jusqua=499)

    # Grandes lignes : étoile depuis la capitale, par les villes du couloir ; les plus proches de la capitale d'abord
    tronc = sorted(set(range(min(n, max(6, n // 20)))) | {racine})
    candidats = list(range(n // 4))
    desservies, relies = [], set()
    # vers la capitale hors carte : seulement des villes à moins de 150 km du bord (les autres passent par elles)
    portee_tronc = lambda i, j: 300 * km if n not in (i, j) else 1e12 if math.dist(pts[i + j - n], point(n, i + j - n)) < 150 * km else -1
    # (distance à la capitale hors carte comptée depuis le bord, + 200 km : les villes du bord y vont tout droit)
    dist_tronc = lambda i, j: dist(i, j) if n not in (i, j) or i == j else math.dist(pts[i + j - n], point(n, i + j - n)) + 200 * km
    for i, p in _arbre_radial(dist_tronc, tronc, racine, portee_tronc):
        a, b = point(p, i), point(i, p)
        gares = [k for k in _gares(pts, a, b, candidats, 0.06) if k not in (i, p)]
        an = round(1842 + 18 * min(1, dist(i, racine) / km / 800) + 2 * _hash(graine, i, p))
        if ligne("voie_ferree", [a] + [pts[k] for k in gares] + [b], p, i, 0.025, rang=1, depuis=an) or \
                ligne("voie_ferree", [a, b], p, i, 0.02, rang=1, depuis=an):
            desservies.append({p, i, *gares})
            relies.add((min(p, i), max(p, i)))

    # Lignes secondaires : maillage des villes moyennes, hors des tronçons déjà desservis par une grande ligne
    second = list(range(min(n, max(12, int(n * 0.3)))))
    for i, j in _rng_aretes(dist, second, portee(90 * km), terre_ij):
        if (i, j) in relies or any(i in g and j in g for g in desservies):
            continue
        e = {"rang": 2, "depuis": round(1858 + 27 * _hash(graine, "s", i, j))}
        if min(pops[i], pops[j]) < pops[second[len(second) // 3]] and _hash(graine, "f", i, j) < 0.4:
            e["jusqua"] = round(1938 + 34 * _hash(graine, "j", i, j))  # petite ligne fermée (concurrence de la route)
        ligne("voie_ferree", [pts[i], pts[j]], i, j, 0.05, **e)

    # Lignes à grande vitesse : très grandes villes, depuis la capitale, en larges courbes
    grandes = [k for k in range(min(n, 12)) if pops[k] >= 150_000] + ([racine] if dehors else [])
    if len(grandes) >= 2:
        arbre = _arbre_radial(dist, grandes, racine, lambda i, j: 520 * km)
        debut = 2005 if dehors else 1981  # la grande vitesse atteint les régions éloignées de la capitale plus tard
        for k, (i, p) in enumerate(arbre):
            ligne("lgv", [point(p, i), point(i, p)], p, i, 0.03, depuis=round(debut + (2017 - debut) * k / max(1, len(arbre) - 1)))

    # Autoroutes : maillage direct des plus grandes villes ; celles qui touchent les plus grandes villes d'abord
    hautes = sorted(set(range(min(n, max(4, int(n * 0.035))))) | {racine})
    for i, j in _rng_aretes(dist, hautes, portee(350 * km), terre_ij):
        rangs = (min(i, n) + min(j, n)) / 2 / len(hautes)
        ligne("autoroute", [point(i, j), point(j, i)], i, j, 0.03, depuis=round(1960 + 29 * min(1, rangs) + 3 * _hash(graine, "a", i, j)))
    return entites

if __name__ == "__main__":
    # Auto-vérification : un détroit coupe la carte en deux, aucune route ne doit le traverser
    villes = [{"x": x, "y": y, "population": 1000 + 100 * k} for k, (x, y) in
              enumerate([(100, 100), (300, 120), (200, 300), (700, 100), (800, 300), (650, 250)])]
    routes = relier(villes, lambda x, y: not 450 < x < 550, 100)
    assert routes and all(all(p[0] < 450 for p in r["points"]) or all(p[0] > 550 for p in r["points"]) for r in routes)
    assert {r["style"] for r in routes} <= {"route", "chemin"}
    print(f"OK — routes vérifiées ({len(routes)} tronçons)")
