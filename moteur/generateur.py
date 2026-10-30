"""Générateur procédural de cartes réalistes, au format commun de moteur/cartes.py.

  generer(reglages) -> carte : terres et mers, relief, lacs, rivières, régions, forêts, cultures, villes, climat.
  REGLAGES décrit chaque réglage (curseurs ou choix) pour l'interface.

Tout est calculé sur une grille d'au plus CELLULES cellules de côté (bibliothèque standard seulement :
le jeu tourne sur Raspberry Pi). Les contours sont tracés sur la grille puis simplifiés et lissés.
"""
import heapq
import math
import random
from collections import deque

from .cartes import urbaniser
from .routes import relier, reseaux

FORMES = ["continent", "côte", "îles", "isthme", "presqu'île"]

REGLAGES = [
    {"id": "largeur_km", "libelle": "Largeur (km)", "groupe": "Terres et mers", "min": 50, "max": 1000, "pas": 10, "defaut": 400},
    {"id": "hauteur_km", "libelle": "Hauteur (km)", "groupe": "Terres et mers", "min": 50, "max": 1000, "pas": 10, "defaut": 300},
    {"id": "forme", "libelle": "Forme des terres", "groupe": "Terres et mers", "choix": FORMES, "defaut": "côte"},
    {"id": "mer", "libelle": "Part de mer", "groupe": "Terres et mers", "min": 0.05, "max": 0.9, "pas": 0.05, "defaut": 0.4},
    {"id": "montagnes", "libelle": "Montagnes", "groupe": "Relief et rivières", "min": 0, "max": 1, "pas": 0.05, "defaut": 0.5},
    {"id": "collines", "libelle": "Collines", "groupe": "Relief et rivières", "min": 0, "max": 1, "pas": 0.05, "defaut": 0.4},
    {"id": "altitude_max", "libelle": "Altitude max (m)", "groupe": "Relief et rivières", "min": 100, "max": 5000, "pas": 100, "defaut": 2000},
    {"id": "rivieres", "libelle": "Rivières", "groupe": "Relief et rivières", "min": 0, "max": 30, "pas": 1, "defaut": 8},
    {"id": "regions", "libelle": "Régions", "groupe": "Régions et villes", "min": 1, "max": 40, "pas": 1, "defaut": 8},
    {"id": "villes", "libelle": "Villes", "groupe": "Régions et villes", "min": 0, "max": 200, "pas": 1, "defaut": 30},
    {"id": "taille_villes", "libelle": "Taille des villes", "groupe": "Régions et villes", "min": 0.25, "max": 4, "pas": 0.25, "defaut": 1},
    {"id": "forets", "libelle": "Forêts", "groupe": "Terrain et climat", "min": 0, "max": 0.8, "pas": 0.05, "defaut": 0.3},
    {"id": "cultures", "libelle": "Cultures et prairies", "groupe": "Terrain et climat", "min": 0, "max": 0.8, "pas": 0.05, "defaut": 0.2},
    {"id": "latitude", "libelle": "Latitude (°)", "groupe": "Terrain et climat", "min": -70, "max": 70, "pas": 0.5, "defaut": 45},
    {"id": "graine", "libelle": "Graine aléatoire", "groupe": "Terrain et climat", "min": 0, "max": 999999, "pas": 1, "defaut": 1},
]

CELLULES = 160          # cellules sur le plus grand côté de la grille
COULEURS = ["#efe3c4", "#dde8c8", "#f0d6c8", "#d9e2ee", "#ecdcea", "#e6eed6", "#f3e9cc", "#d8e9e4", "#eedada", "#e2dcef"]
INFINI = 10 ** 9

# --- Noms à consonance française ---
DEBUTS = ["Bel", "Mont", "Ro", "Vau", "Char", "Lan", "Mar", "Sau", "Ver", "Bour", "Pon", "Fon", "Cler", "Al", "Bri",
          "Cor", "Dam", "Es", "Gour", "Lor", "Mau", "Tor", "Val", "Bar", "Cas", "Fer", "Lu", "Mé", "Ri", "Sar",
          "Bau", "Cha", "Gué", "Jou", "Noy", "Pré", "Roche", "Thou", "Vil", "Aub"]
MILIEUX = ["", "", "", "e", "i", "a", "an", "er", "ou", "en"]
FINS_VILLE = ["ville", "court", "mont", "ac", "y", "ay", "eux", "ignac", "bourg", "sac", "ans", "ières", "ois",
              "ange", "é", "ieu", "ard", "on", "ès", "ac", "ignan", "elles", "oux", "in"]
FINS_RIVIERE = ["onne", "ise", "ette", "ine", "ance", "oire", "ure", "elle", "ère", "eine", "aine", "ize"]
SAINTS = ["Martin", "Jean", "Pierre", "André", "Germain", "Rémy", "Aubin", "Hilaire", "Front", "Avit", "Léger", "Marc"]


class Noms:
    def __init__(self, graine):
        self.rng, self.pris = random.Random(f"{graine}-noms"), set()

    def _unique(self, fabrique):
        for _ in range(30):
            n = fabrique()
            if n not in self.pris:
                break
        self.pris.add(n)
        return n

    def racine(self):
        return self.rng.choice(DEBUTS) + self.rng.choice(MILIEUX)

    def riviere(self):
        r = self.rng
        racine = self._unique(lambda: r.choice(DEBUTS).rstrip("e") + r.choice(FINS_RIVIERE))
        return racine, ("L'" if racine[0] in "AEIOUÉ" else "La ") + racine

    def ville(self, riviere=None, cotiere=False):
        r = self.rng

        def fabrique():
            base = (self.racine() + r.choice(FINS_VILLE)).replace("ee", "e").replace("aa", "a")
            t = r.random()
            if t < 0.12:
                return f"Saint-{r.choice(SAINTS)}" + (f"-sur-{riviere}" if riviere and r.random() < 0.5 else "")
            if riviere and t < 0.35:
                return f"{base}-sur-{riviere}"
            if cotiere and t < 0.5:
                return f"{base}-sur-Mer"
            if t < 0.55:
                return f"{base}-{r.choice(['le-Château', 'les-Bains', 'la-Forêt', 'le-Vieux', 'en-Val'])}"
            return base
        return self._unique(fabrique)

    def region(self, riviere, montagne, cotiere):
        r = self.rng

        def fabrique():
            x = riviere or r.choice(DEBUTS).rstrip("e") + r.choice(FINS_RIVIERE)
            if montagne and r.random() < 0.6:
                return r.choice([f"Hautes-{x}", f"Monts-de-{x}", f"Haute-{x}"])
            if cotiere and r.random() < 0.4:
                return r.choice([f"{x}-Maritime", f"Côtes-de-{x}", f"Basse-{x}"])
            y = r.choice(DEBUTS).rstrip("e") + r.choice(FINS_RIVIERE)
            return r.choice([x, x, f"{x}-et-{y}", f"Val-de-{x}"])
        return self._unique(fabrique)


# --- Réglages ---
def lire_reglages(reglages):
    """Valeurs du joueur validées : défaut si absente ou illisible, ramenée dans les bornes sinon."""
    reglages = reglages if isinstance(reglages, dict) else {}
    r = {}
    for d in REGLAGES:
        v = reglages.get(d["id"], d["defaut"])
        if "choix" in d:
            r[d["id"]] = v if isinstance(v, str) and v in d["choix"] else d["defaut"]
            continue
        try:
            if isinstance(v, bool):
                raise TypeError
            v = float(v)
            if not math.isfinite(v):
                raise ValueError
        except (TypeError, ValueError):
            v = d["defaut"]
        v = min(d["max"], max(d["min"], v))
        r[d["id"]] = int(round(v)) if float(d["pas"]).is_integer() else v
    return r


# --- Bruit de valeur sur la grille (séparable : on interpole les lignes du réseau puis les colonnes) ---
def _fondu(t):
    return t * t * (3 - 2 * t)


def _octave(rng, xs, ys, f):
    nx, ny = int(xs[-1] * f) + 2, int(ys[-1] * f) + 2
    reseau = [[rng.random() for _ in range(nx)] for _ in range(ny)]
    cols = [(int(x * f), _fondu(x * f - int(x * f))) for x in xs]
    out = []
    for y in ys:
        j = int(y * f)
        w = _fondu(y * f - j)
        ligne = [a + (b - a) * w for a, b in zip(reseau[j], reseau[j + 1])]
        out.extend(ligne[i] + (ligne[i + 1] - ligne[i]) * wx for i, wx in cols)
    return out


def _fbm(rng, xs, ys, f, octaves, crete=False):
    total, amp, somme = [0.0] * (len(xs) * len(ys)), 1.0, 0.0
    for _ in range(octaves):
        n = _octave(rng, xs, ys, f)
        if crete:
            n = [(1 - abs(2 * v - 1)) ** 2 for v in n]
        total = [t + amp * v for t, v in zip(total, n)]
        somme += amp
        amp, f = amp * 0.5, f * 2.03  # pas tout à fait 2 : évite que les réseaux des octaves s'alignent
    return [t / somme for t in total]


def _lisse(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _quantile(valeurs, q):
    v = sorted(valeurs)
    return v[min(len(v) - 1, max(0, int(q * len(v))))] if v else 0.0


# --- Géométrie ---
def _dp(pts, tol):
    """Douglas-Peucker (extrémités conservées)."""
    if len(pts) < 3:
        return pts
    garde = [False] * len(pts)
    garde[0] = garde[-1] = True
    pile = [(0, len(pts) - 1)]
    while pile:
        a, b = pile.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy)
        dmax, imax = -1.0, a
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / n if n else math.hypot(x - x1, y - y1)
            if d > dmax:
                dmax, imax = d, i
        if dmax > tol:
            garde[imax] = True
            pile += [(a, imax), (imax, b)]
    return [p for p, g in zip(pts, garde) if g]


def _chaikin(pts, tours):
    for _ in range(tours):
        nv = [pts[0]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            nv += [(0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2), (0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2)]
        nv.append(pts[-1])
        pts = nv
    return pts


def _aire(pts):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1])) / 2


class Grille:
    def __init__(self, L, H, pas):
        self.L, self.H, self.pas = L, H, pas
        self.nc, self.nl = L // pas + 1, H // pas + 1
        self.n = self.nc * self.nl
        nc, nl = self.nc, self.nl
        self.v4, self.v8 = [], []
        for j in range(nl):
            for i in range(nc):
                self.v4.append([(j + dj) * nc + i + di for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))
                                if 0 <= i + di < nc and 0 <= j + dj < nl])
                self.v8.append([(j + dj) * nc + i + di for di in (-1, 0, 1) for dj in (-1, 0, 1)
                                if (di or dj) and 0 <= i + di < nc and 0 <= j + dj < nl])

    def xy(self, k):
        return (k % self.nc) * self.pas, (k // self.nc) * self.pas

    def composantes(self, dans):
        """Composantes 4-connexes des cellules où dans[k] est vrai : liste de listes d'indices."""
        vu, comps = [False] * self.n, []
        for k in range(self.n):
            if dans[k] and not vu[k]:
                vu[k], file, comp = True, [k], []
                while file:
                    c = file.pop()
                    comp.append(c)
                    for v in self.v4[c]:
                        if dans[v] and not vu[v]:
                            vu[v] = True
                            file.append(v)
                comps.append(comp)
        return comps

    def distances(self, sources, passable):
        """Distance en cellules (BFS 4-connexe) depuis les sources, à travers les cellules passables."""
        d = [INFINI] * self.n
        file = deque()
        for k in sources:
            d[k] = 0
            file.append(k)
        while file:
            c = file.popleft()
            for v in self.v4[c]:
                if d[v] == INFINI and passable[v]:
                    d[v] = d[c] + 1
                    file.append(v)
        return d

    def contours(self, lab):
        """Polygones extérieurs de chaque étiquette (≥ 0) : {étiquette: [points]}.
        Les frontières communes sont lissées une seule fois, donc identiques des deux côtés (pas de jour)."""
        nc, nl, W = self.nc, self.nl, self.nc + 1

        def at(i, j):
            return lab[j * nc + i] if 0 <= i < nc and 0 <= j < nl else -1

        suivants = {}
        for j in range(nl):
            for i in range(nc):
                a = lab[j * nc + i]
                if a < 0:
                    continue
                c = j * W + i  # coin haut-gauche ; parcours horaire à l'écran
                if at(i, j - 1) != a:
                    suivants.setdefault((a, c), []).append(c + 1)
                if at(i + 1, j) != a:
                    suivants.setdefault((a, c + 1), []).append(c + 1 + W)
                if at(i, j + 1) != a:
                    suivants.setdefault((a, c + 1 + W), []).append(c + W)
                if at(i - 1, j) != a:
                    suivants.setdefault((a, c + W), []).append(c)

        def jonction(c):
            i, j = c % W, c // W
            hg, hd, bg, bd = at(i - 1, j - 1), at(i, j - 1), at(i - 1, j), at(i, j)
            s = {hg, hd, bg, bd}
            return len(s) >= 3 or (len(s) == 2 and hg == bd and hd == bg)

        L, H, pas = self.L, self.H, self.pas

        def coord(c):
            return (min(L, max(0.0, (c % W - 0.5) * pas)), min(H, max(0.0, (c // W - 0.5) * pas)))

        cache, polys = {}, {}

        def lisser(seg):
            cle = tuple(seg)
            if cle[::-1] in cache:
                return cache[cle[::-1]][::-1]
            if cle not in cache:
                pts = _dp([coord(c) for c in seg], 0.7 * pas)
                pts = _dp(_chaikin(pts, 3), 0.12 * pas)
                cache[cle] = [(round(x, 1), round(y, 1)) for x, y in pts]
            return cache[cle]

        while suivants:
            (a, c0), fins = next(iter(suivants.items()))
            boucle, prec, c = [c0], c0, fins.pop()
            if not fins:
                del suivants[(a, c0)]
            while c != c0:
                boucle.append(c)
                fins = suivants[(a, c)]
                if len(fins) > 1:  # col : on tourne à droite, ce qui sépare les cellules en diagonale
                    dx, dy = c % W - prec % W, c // W - prec // W
                    droite = c + (-dy) + dx * W
                    nxt = droite if droite in fins else fins[0]
                    fins.remove(nxt)
                else:
                    nxt = fins.pop()
                    del suivants[(a, c)]
                prec, c = c, nxt
            J = [i for i, c in enumerate(boucle) if jonction(c)]
            if J:
                boucle = boucle[J[0]:] + boucle[:J[0]]
                J = [i - J[0] for i in J]
            if len(J) < 2:  # boucle sans (ou avec une seule) jonction : on la coupe au point le plus éloigné
                x0, y0 = coord(boucle[0])
                J = [0, max(range(len(boucle)), key=lambda i: (coord(boucle[i])[0] - x0) ** 2 + (coord(boucle[i])[1] - y0) ** 2)]
                J = sorted(set(J))
            pts = []
            for d, f in zip(J, J[1:] + [len(boucle)]):
                pts += lisser(boucle[d:f] + [boucle[f % len(boucle)]])[:-1]
            if len(pts) >= 3 and _aire(pts) > 0.5 * pas * pas:  # aire > 0 : contour extérieur (pas un trou)
                polys.setdefault(a, []).append([list(p) for p in pts])
        return polys


# --- Génération ---
def generer(reglages=None):
    r = lire_reglages(reglages)
    rng = random.Random(r["graine"])
    noms = Noms(r["graine"])
    lkm, hkm = r["largeur_km"], r["hauteur_km"]
    echelle = 1000 * max(math.sqrt(lkm * hkm) / 3000, max(lkm, hkm) / 4500)
    L, H = round(lkm * 1000 / echelle), round(hkm * 1000 / echelle)
    g = Grille(L, H, math.ceil(max(L, H) / (CELLULES - 1)))
    n, pas, altmax = g.n, g.pas, r["altitude_max"]
    S = math.sqrt(L * H)
    xs = [i * pas / S for i in range(g.nc)]
    ys = [j * pas / S for j in range(g.nl)]

    # Terres et mers : masque de forme déformé par un bruit, mélangé à un bruit fractal
    bruit = _fbm(rng, xs, ys, 2.5, 6)
    def1, def2 = _fbm(rng, xs, ys, 1.8, 3), _fbm(rng, xs, ys, 1.8, 3)
    masque = _masque(r["forme"], rng, L / S, H / S)
    poids = 0.65 if r["forme"] == "îles" else 0.5
    entoure = r["forme"] in ("îles", "isthme")  # pas de terre coupée par le bord (le continent l'est déjà)
    lx, ly = xs[-1], ys[-1]
    h = [0.0] * n
    for k in range(n):
        x, y = xs[k % g.nc], ys[k // g.nc]
        h[k] = poids * masque(x + 0.5 * (def1[k] - 0.5), y + 0.5 * (def2[k] - 0.5)) + (1 - poids) * bruit[k]
        if entoure:
            h[k] -= 0.35 * (1 - _lisse(0.0, 0.1, min(x, lx - x, y, ly - y)))
    niveau = _quantile(h, r["mer"])
    terre = [v > niveau for v in h]
    for comp in g.composantes(terre):  # îlots d'une poignée de cellules : écume, pas des îles
        if len(comp) < 5:
            for k in comp:
                terre[k] = False
    lac = [False] * n
    bord = lambda k: k % g.nc in (0, g.nc - 1) or k // g.nc in (0, g.nl - 1)
    for comp in g.composantes([not t for t in terre]):
        if not any(bord(k) for k in comp):  # mer fermée : lac si assez grande, terre sinon
            for k in comp:
                terre[k], lac[k] = True, len(comp) >= 8

    # Relief : rampe depuis la côte + collines + chaînes de montagnes en crêtes
    hmax = max(h)
    cretes = _fbm(rng, xs, ys, 3.0, 5, crete=True)
    chaines = _fbm(rng, xs, ys, 1.3, 2)
    collines = _fbm(rng, xs, ys, 7.0, 3)
    rel = [0.0] * n
    for k in range(n):
        if terre[k]:
            t = max(0.0, (h[k] - niveau) / (hmax - niveau + 1e-9))
            rel[k] = (0.3 * t + r["collines"] * 0.35 * collines[k] * math.sqrt(t)
                      + r["montagnes"] * 1.3 * cretes[k] * _lisse(0.42, 0.62, chaines[k]) * _lisse(0.0, 0.35, t))
    m = max(rel) or 1.0
    alt = [max(1.0, v / m * altmax) if terre[k] else 0.0 for k, v in enumerate(rel)]

    # Écoulement : remplissage des cuvettes (priority-flood), lacs dans les cuvettes profondes, pente D8
    rempli, vu, tas = alt[:], [not t for t in terre], []
    for k in range(n):
        if not terre[k] and any(terre[v] for v in g.v8[k]):
            heapq.heappush(tas, (0.0, k))
    while tas:
        z, k = heapq.heappop(tas)
        for v in g.v8[k]:
            if not vu[v]:
                vu[v] = True
                rempli[v] = max(alt[v], z + 0.01)
                heapq.heappush(tas, (rempli[v], v))
    # Les autres cuvettes restent comblées (plaines alluviales) : un lac par cuvette serait trop
    seuil, budget = max(5.0, 0.04 * altmax), 0.015 * sum(terre)
    cuvettes = g.composantes([terre[k] and (lac[k] or rempli[k] - alt[k] > seuil) for k in range(n)])
    for comp in sorted(cuvettes, key=len, reverse=True):
        if any(lac[k] for k in comp) or (len(comp) >= 4 and len(comp) <= budget):
            budget -= len(comp)
            surface = max(rempli[k] for k in comp)
            for k in comp:
                lac[k], rempli[k] = True, surface
    aval, diag = [-1] * n, (g.nc - 1, g.nc + 1)
    for k in range(n):
        if terre[k] and not lac[k]:
            z = rempli[k]
            aval[k] = min(g.v8[k], key=lambda v: (rempli[v] - z) * (0.7071 if abs(v - k) in diag else 1))
    debit = [1.0 if terre[k] else 0.0 for k in range(n)]
    ordre = sorted((k for k in range(n) if terre[k] and not lac[k]), key=lambda k: -rempli[k])
    for k in ordre:
        if aval[k] >= 0:
            debit[aval[k]] += debit[k]

    eau = lambda k: not terre[k] or lac[k]
    amont = [[] for _ in range(n)]
    for k in ordre:
        amont[aval[k]].append(k)
    rivieres, cellules_riviere = [], set()
    embouchures = sorted((k for k in ordre if eau(aval[k])), key=lambda k: -debit[k])
    for k in embouchures[:r["rivieres"]]:
        if debit[k] < 25:
            break
        chemin = [aval[k], k]
        while True:
            terrestres = [v for v in amont[chemin[-1]] if not lac[v]]
            if not terrestres:
                break
            v = max(terrestres, key=lambda v: debit[v])
            if debit[v] < 3:
                break
            chemin.append(v)
        if len(chemin) < 6:
            continue
        chemin.reverse()  # de la source vers l'embouchure
        cellules_riviere.update(chemin[:-1])
        rivieres.append(chemin)

    # Régions : graines réparties (Lloyd), croissance par Dijkstra (les crêtes coûtent cher), îles rattachées
    terres = [k for k in range(n) if terre[k]]
    nreg = max(1, min(r["regions"], len(terres) // 40))
    graines = rng.sample(terres, nreg)
    sinuosite = [3 * v for v in _fbm(rng, xs, ys, 8.0, 3)]
    for _ in range(3):
        region = _croissance(g, graines, terre, rempli, altmax, sinuosite)
        sommes = [[0.0, 0.0, 0] for _ in graines]
        for k in terres:
            if region[k] >= 0:
                s = sommes[region[k]]
                s[0] += k % g.nc
                s[1] += k // g.nc
                s[2] += 1
        cibles = [(s[0] / s[2], s[1] / s[2]) if s[2] else None for s in sommes]
        graines = [min((k for k in terres if region[k] == i), key=lambda k: (k % g.nc - c[0]) ** 2 + (k // g.nc - c[1]) ** 2)
                   if c else graines[i] for i, c in enumerate(cibles)]
    region = _croissance(g, graines, terre, rempli, altmax, sinuosite)
    for comp in g.composantes([terre[k] and region[k] < 0 for k in range(n)]):
        cx = sum(k % g.nc for k in comp) / len(comp)
        cy = sum(k // g.nc for k in comp) / len(comp)
        proche = min(range(nreg), key=lambda i: (graines[i] % g.nc - cx) ** 2 + (graines[i] // g.nc - cy) ** 2)
        for k in comp:
            region[k] = proche
    _nettoyer_regions(g, region, nreg)

    # Distances utiles : à la mer, aux rivières
    d_mer = g.distances([k for k in range(n) if not terre[k]], [True] * n)
    d_riv = g.distances(list(cellules_riviere), [True] * n) if cellules_riviere else [INFINI] * n

    # Noms : rivières, régions (souvent d'après une rivière qui les traverse), mer
    noms_riv = [noms.riviere() for _ in rivieres]
    riv_de_region = {}
    for (racine, _), ch in zip(noms_riv, rivieres):
        for k in ch[:-1]:
            riv_de_region.setdefault(region[k], racine)
    taille_reg = [0] * nreg
    alt_reg = [0.0] * nreg
    cote_reg = [0] * nreg
    for k in terres:
        taille_reg[region[k]] += 1
        alt_reg[region[k]] += rempli[k]
        cote_reg[region[k]] += d_mer[k] == 1
    noms_reg = [noms.region(riv_de_region.get(i), alt_reg[i] / max(1, taille_reg[i]) > 0.4 * altmax, cote_reg[i] > 3)
                for i in range(nreg)]
    codes = {i: f"{c + 1:02d}" for c, i in enumerate(sorted(range(nreg), key=lambda i: noms_reg[i]))}
    couleurs = _colorier(g, region, nreg)

    # Villes : en plaine, près des rivières et des côtes, espacées ; une préfecture par région
    villes = _placer_villes(g, r, rng, region, nreg, terre, lac, rempli, d_mer, d_riv, altmax, len(terres), echelle)

    entites = [{"type": "zone", "style": "mer", "calque": "sol", "x": -L, "y": -H, "w": 3 * L, "h": 3 * H}]
    d_terre = g.distances([k for k in terres], [True] * n)
    centre_mer = max((k for k in range(n) if not terre[k]), key=lambda k: d_terre[k], default=None)
    entites[0]["nom"] = f"Mer {noms.rng.choice(['de ', 'des '])}{noms.racine()}{noms.rng.choice(['ois', 'ennes', 'ais', 'ines'])}"
    if centre_mer is not None:
        entites[0]["ancre"] = list(g.xy(centre_mer))

    # Polygones des régions (du plus grand au plus petit : une région enclavée reste visible)
    interieur = g.distances([k for k in terres if any(region[v] != region[k] for v in g.v4[k]) or bord(k)
                             or len(g.v4[k]) < 4], terre)
    ancres = {}
    for k in terres:
        if region[k] >= 0 and interieur[k] != INFINI and (region[k] not in ancres or interieur[k] > interieur[ancres[region[k]]]):
            ancres[region[k]] = k
    morceaux = sorted(((i, p) for i, ps in g.contours(region).items() for p in ps), key=lambda ip: -_aire(ip[1]))
    nomme = set()
    for i, p in morceaux:
        e = {"type": "zone", "style": "departement", "calque": "sol", "points": p, "code": codes[i],
             "couleur": couleurs[i], "region": noms_reg[i]}
        if i not in nomme:  # le nom sur le plus grand morceau seulement
            nomme.add(i)
            e["nom"], e["ancre"] = noms_reg[i], list(g.xy(ancres[i])) if i in ancres else p[0]
        entites.append(e)

    # Forêts, cultures et prairies : grille d'occupation du sol (dessinée en texture par les thèmes)
    occupation = _vegetation(g, r, rng, xs, ys, terre, lac, rempli, d_mer, villes, altmax, len(terres))

    for p in g.contours([0 if lac[k] else -1 for k in range(n)]).get(0, []):
        entites.append({"type": "zone", "style": "lac", "calque": "eau", "points": p})
    lacs = [e for e in entites if e["style"] == "lac"]
    if lacs:
        grand = max(lacs, key=lambda e: _aire(e["points"]))
        grand["nom"] = f"Lac {noms.rng.choice(['de ', 'du '])}{noms.racine()}{noms.rng.choice(['ay', 'ans', 'on'])}"

    dmax = max(debit) or 1
    for (_, nom), ch in zip(noms_riv, rivieres):
        pts = _dp(_chaikin([g.xy(k) for k in ch], 2), 0.15 * pas)
        larg, acc = [], 0.0
        for idx in range(len(pts)):
            acc = max(acc, debit[ch[min(len(ch) - 2, round(idx / max(1, len(pts) - 1) * (len(ch) - 1)))]])
            larg.append(round((40 + 360 * math.sqrt(acc / dmax)) / echelle, 2))  # vraie largeur : 40 à 400 m
        entites.append({"type": "ligne", "style": "riviere", "calque": "eau", "nom": nom,
                        "points": [[round(x, 1), round(y, 1)] for x, y in pts], "largeur": larg})

    riv_proche = {}
    for (racine, _), ch in zip(noms_riv, rivieres):
        for k in _voisinage(g, ch[:-1]):
            riv_proche.setdefault(k, racine)
    for v in villes:
        k = v.pop("k")
        riv = riv_proche.get(k)
        v["nom"] = noms.ville(riv, d_mer[k] <= 2)
        entites.append(v)

    def est_terre(x, y):  # case la plus proche de la grille
        i, j = round(x / g.pas), round(y / g.pas)
        return 0 <= i < g.nc and 0 <= j < g.nl and terre[j * g.nc + i] and not lac[j * g.nc + i]
    entites += relier(villes, est_terre, echelle, graine=r["graine"], taille=[L, H])
    entites += reseaux(villes, est_terre, echelle, graine=r["graine"], taille=[L, H])
    urbaniser(occupation, villes)

    valeurs = [[round(rempli[j * g.nc + i]) if terre[j * g.nc + i] else 0 for i in range(g.nc)] for j in range(g.nl)]
    capitale = max(villes, key=lambda v: v["population"])["nom"] if villes else noms_reg[0]
    return {"nom": f"Pays de {capitale}", "taille": [L, H], "echelle": round(echelle, 2), "latitude": r["latitude"],
            "relief": {"pas": pas, "valeurs": valeurs}, "occupation": occupation, "zones_climat": _climat(g, terre, rempli, altmax),
            "entites": entites, "reglages": r}


def _voisinage(g, chemin):
    s = set()
    for k in chemin:
        s.add(k)
        for v in g.v8[k]:
            s.add(v)
            s.update(g.v8[v])
    return s


def _masque(forme, rng, lx, ly):
    """Fonction (x, y) -> ~1 sur terre, ~0 en mer, en coordonnées normalisées (0..lx, 0..ly)."""
    cx, cy = lx / 2, ly / 2
    cote = rng.randrange(4)

    def le_long(x, y):  # 0 côté mer, 1 côté terre
        return (x / lx, 1 - x / lx, y / ly, 1 - y / ly)[cote]

    if forme == "continent":
        return lambda x, y: 1 - ((x - cx) / cx) ** 2 - ((y - cy) / cy) ** 2
    if forme == "côte":
        return lambda x, y: 1.4 * le_long(x, y)
    if forme == "îles":
        taches = [(rng.uniform(0.15, 0.85) * lx, rng.uniform(0.15, 0.85) * ly, rng.uniform(0.07, 0.16))
                  for _ in range(rng.randint(5, 9))]
        return lambda x, y: max(math.exp(-((x - a) ** 2 + (y - b) ** 2) / (s * s)) for a, b, s in taches)
    if forme == "isthme":
        long_x = lx >= ly
        a, b = (lx, ly) if long_x else (ly, lx)
        r = 0.32 * b

        def isthme(x, y):
            u, v = (x, y) if long_x else (y, x)
            bout = max(math.exp(-((u - 0.2 * a) ** 2 + (v - b / 2) ** 2) / r ** 2),
                       math.exp(-((u - 0.8 * a) ** 2 + (v - b / 2) ** 2) / r ** 2))
            pont = math.exp(-((v - b / 2 - 0.08 * b * math.sin(u / a * 6)) / (0.09 * b)) ** 2) if 0.2 * a < u < 0.8 * a else 0
            return max(bout, 0.9 * pont)
        return isthme
    # presqu'île : une côte d'où part une longue avancée vers le large
    lat = rng.uniform(0.35, 0.65)

    def presquile(x, y):
        t = le_long(x, y)
        travers = (y / ly if cote < 2 else x / lx) - lat
        return max(1.6 * t - 0.6, (0.4 + 0.6 * t) * math.exp(-(travers / 0.12) ** 2))
    return presquile


def _croissance(g, graines, terre, alt, altmax, sinuosite):
    region, cout, tas = [-1] * g.n, [math.inf] * g.n, []
    for i, k in enumerate(graines):
        cout[k] = 0.0
        heapq.heappush(tas, (0.0, k, i))
    while tas:
        c, k, i = heapq.heappop(tas)
        if region[k] >= 0:
            continue
        region[k] = i
        for v in g.v4[k]:
            if terre[v] and region[v] < 0:
                nc = c + 0.2 + sinuosite[v] + 12 * abs(alt[v] - alt[k]) / altmax
                if nc < cout[v]:
                    cout[v] = nc
                    heapq.heappush(tas, (nc, v, i))
    return region


def _nettoyer_regions(g, region, nreg):
    """Filtre majoritaire puis absorption des fragments détachés : pas de confettis."""
    for k in range(g.n):
        if region[k] >= 0:
            compte = {}
            for v in g.v8[k]:
                if region[v] >= 0:
                    compte[region[v]] = compte.get(region[v], 0) + 1
            meilleur = max(compte, key=compte.get, default=region[k])
            if compte.get(meilleur, 0) >= 6:
                region[k] = meilleur
    for i in range(nreg):
        comps = sorted(g.composantes([x == i for x in region]), key=len, reverse=True)
        for comp in comps[1:]:
            voisins = {}
            for k in comp:
                for v in g.v4[k]:
                    if region[v] not in (-1, i):
                        voisins[region[v]] = voisins.get(region[v], 0) + 1
            if voisins:  # fragment collé à une autre région ; une île isolée reste à la sienne
                autre = max(voisins, key=voisins.get)
                for k in comp:
                    region[k] = autre


def _colorier(g, region, nreg):
    voisins = [set() for _ in range(nreg)]
    for k in range(g.n):
        if region[k] >= 0:
            for v in g.v4[k]:
                if region[v] >= 0 and region[v] != region[k]:
                    voisins[region[k]].add(region[v])
    couleurs = {}
    for i in sorted(range(nreg), key=lambda i: -len(voisins[i])):
        pris = {couleurs.get(v) for v in voisins[i]}
        couleurs[i] = next((c for c in COULEURS if c not in pris), COULEURS[i % len(COULEURS)])
    return couleurs


def _placer_villes(g, r, rng, region, nreg, terre, lac, alt, d_mer, d_riv, altmax, nterre, echelle):
    score = [-1.0] * g.n
    for k in range(g.n):
        if terre[k] and not lac[k] and not any(lac[v] for v in g.v4[k]):
            pente = max(abs(alt[v] - alt[k]) for v in g.v4[k]) / max(1.0, 0.05 * altmax)
            score[k] = (1 - alt[k] / altmax) - 0.4 * min(1.0, pente) + 0.5 * (d_riv[k] <= 1) + 0.25 * (d_riv[k] <= 3) \
                + 0.35 * (d_mer[k] <= 2) + 0.3 * rng.random()
    candidats = sorted((k for k in range(g.n) if score[k] >= 0), key=lambda k: -score[k])
    total = max(r["villes"], nreg) if r["villes"] else 0
    ecart = 0.55 * math.sqrt(nterre / max(1, total))
    choisies, prefs = [], []

    def libre(k, e):
        x, y = k % g.nc, k // g.nc
        return all((x - c % g.nc) ** 2 + (y - c // g.nc) ** 2 >= e * e for c in choisies)

    if total:
        for i in range(nreg):
            k = next((k for k in candidats if region[k] == i and libre(k, ecart * 0.7)), None)
            if k is not None:
                choisies.append(k)
                prefs.append(k)
        for k in candidats:
            if len(choisies) >= total:
                break
            if k not in prefs and libre(k, ecart):
                choisies.append(k)
    choisies.sort(key=lambda k: -(score[k] + (1 if k in prefs else 0)))
    villes = []
    for rang, k in enumerate(choisies, 1):
        pop = max(200, round(r["taille_villes"] * 120000 / rang ** 1.05 * rng.uniform(0.75, 1.25), -1))
        x, y = g.xy(k)
        v = {"type": "batiment", "style": "ville", "calque": "batiments", "x": x, "y": y, "k": k,
             "population": pop, "taille": round(40 * math.sqrt(pop) / echelle, 1), "lumiere": True}
        if k in prefs:
            v["prefecture"] = True
        villes.append(v)
    return villes


def _vegetation(g, r, rng, xs, ys, terre, lac, alt, d_mer, villes, altmax, nterre):
    n = g.n
    champ, champ2, champ3 = _fbm(rng, xs, ys, 4.0, 4), _fbm(rng, xs, ys, 3.0, 3), _fbm(rng, xs, ys, 6.0, 2)
    pres_ville = g.distances([v["k"] for v in villes], [True] * n) if villes else [INFINI] * n
    limite = min(0.85 * altmax, 2100)  # limite des arbres
    libre = [terre[k] and not lac[k] and d_mer[k] >= 2 and pres_ville[k] >= 2 and alt[k] < limite for k in range(n)]
    sf = [champ[k] + 0.25 * alt[k] / altmax if libre[k] else -9 for k in range(n)]
    seuil_f = _quantile([s for s in sf if s > -9], 1 - r["forets"] * nterre / max(1, sum(libre))) if r["forets"] else 9
    lab = [0 if sf[k] > seuil_f else -1 for k in range(n)]
    sc = [champ2[k] + 0.6 * math.exp(-pres_ville[k] / 6) - 0.6 * alt[k] / altmax if libre[k] and lab[k] < 0 else -9
          for k in range(n)]
    reste = sum(s > -9 for s in sc)
    seuil_c = _quantile([s for s in sc if s > -9], 1 - r["cultures"] * nterre / max(1, reste)) if r["cultures"] and reste else 9
    for k in range(n):
        if sc[k] > seuil_c:
            lab[k] = 1 if champ3[k] > 0.5 else 2
    for etiquette in (0, 1, 2):
        for comp in g.composantes([x == etiquette for x in lab]):
            if len(comp) < 6:
                for k in comp:
                    lab[k] = -1
    # Format de moteur/cartes.py : une chaîne par ligne ; le reste des terres selon l'altitude
    def code(k):
        if not terre[k] or lac[k]:
            return "."
        if lab[k] >= 0:
            return "fcp"[lab[k]]
        if alt[k] >= limite:
            return "r"
        if alt[k] > 0.6 * limite:
            return "l"
        return "c" if champ3[k] > 0.45 else "p"
    return {"pas": g.pas, "decalage": -0.5,
            "lignes": ["".join(code(j * g.nc + i) for i in range(g.nc)) for j in range(g.nl)]}


def _climat(g, terre, alt, altmax):
    L, H = g.L, g.H
    zones = []
    hauts = [k for k in range(g.n) if terre[k] and alt[k] > 0.5 * altmax and alt[k] > 400]
    if len(hauts) >= 0.03 * sum(terre):
        x = sorted(g.xy(k)[0] for k in hauts)
        y = sorted(g.xy(k)[1] for k in hauts)
        moy = sum(alt[k] for k in hauts) / len(hauts)
        zones.append({"nom": "Montagne", "rect": [_quantile(x, 0.1), _quantile(y, 0.1), _quantile(x, 0.9) + g.pas, _quantile(y, 0.9) + g.pas],
                      "dt": round(-6.5 * moy / 1000, 1), "pluie": 1.3, "vent": 1.2})
    # Côte : la bande de bord la plus maritime
    bandes = {"ouest": lambda x, y: x < 0.22 * L, "est": lambda x, y: x > 0.78 * L,
              "nord": lambda x, y: y < 0.22 * H, "sud": lambda x, y: y > 0.78 * H}
    pts = [(g.xy(k), terre[k]) for k in range(g.n)]
    mer = {}
    for c, f in bandes.items():
        dedans = [t for xy, t in pts if f(*xy)]
        mer[c] = dedans.count(False) / max(1, len(dedans))
    c = max(mer, key=mer.get)
    cote, interieur = {"ouest": ([-INFINI, -INFINI, 0.22 * L, INFINI], [0.22 * L, -INFINI, INFINI, INFINI]),
                       "est": ([0.78 * L, -INFINI, INFINI, INFINI], [-INFINI, -INFINI, 0.78 * L, INFINI]),
                       "nord": ([-INFINI, -INFINI, INFINI, 0.22 * H], [-INFINI, 0.22 * H, INFINI, INFINI]),
                       "sud": ([-INFINI, 0.78 * H, INFINI, INFINI], [-INFINI, -INFINI, INFINI, 0.78 * H])}[c]
    zones.append({"nom": "Côte", "rect": [round(v) for v in cote], "pluie": 1.15, "vent": 1.4})
    zones.append({"nom": "Intérieur", "rect": [round(v) for v in interieur]})
    for z in zones:
        z["rect"] = [round(v) for v in z["rect"]]
    return zones
