"""Fabrique cartes/france.json et cartes/aquitaine.json à partir de données ouvertes.

  python3 outils/creer_cartes_reelles.py [dossier_cache]

Sources (téléchargées dans le cache si absentes) :
  - départements : github.com/gregoiredavid/france-geojson (données IGN/INSEE, Licence Ouverte)
  - pays, fleuves, lacs : Natural Earth (domaine public)
Projection conique conforme de Lambert (paramètres de Lambert-93, sphère). Les contours sont simplifiés :
la carte est reconnaissable, pas exacte au mètre près. Le relief est approché par les grands massifs.
"""
import json
import math
import pathlib
import random
import sys
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / ".cache_geo"
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
SOURCES = {
    "departements.geojson": "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson",
    "pays.geojson": NE + "ne_10m_admin_0_countries.geojson",
    "fleuves.geojson": NE + "ne_10m_rivers_europe.geojson",
    "fleuves2.geojson": NE + "ne_10m_rivers_lake_centerlines.geojson",
    "lacs.geojson": NE + "ne_10m_lakes_europe.geojson",
}

# Préfectures (code : nom, latitude, longitude, population de la commune, arrondie)
PREFECTURES = {
    "01": ("Bourg-en-Bresse", 46.205, 5.226, 41000), "02": ("Laon", 49.564, 3.620, 25000), "03": ("Moulins", 46.566, 3.333, 20000),
    "04": ("Digne-les-Bains", 44.093, 6.236, 16000), "05": ("Gap", 44.559, 6.079, 41000), "06": ("Nice", 43.703, 7.266, 342000),
    "07": ("Privas", 44.735, 4.599, 8000), "08": ("Charleville-Mézières", 49.773, 4.720, 46000), "09": ("Foix", 42.965, 1.607, 9600),
    "10": ("Troyes", 48.297, 4.074, 61000), "11": ("Carcassonne", 43.212, 2.353, 46000), "12": ("Rodez", 44.350, 2.575, 24000),
    "13": ("Marseille", 43.296, 5.370, 870000), "14": ("Caen", 49.183, -0.370, 106000), "15": ("Aurillac", 44.926, 2.440, 25000),
    "16": ("Angoulême", 45.650, 0.160, 42000), "17": ("La Rochelle", 46.160, -1.151, 77000), "18": ("Bourges", 47.081, 2.399, 64000),
    "19": ("Tulle", 45.267, 1.772, 14500), "21": ("Dijon", 47.322, 5.041, 159000), "22": ("Saint-Brieuc", 48.514, -2.765, 44000),
    "23": ("Guéret", 46.171, 1.871, 13000), "24": ("Périgueux", 45.184, 0.721, 29000), "25": ("Besançon", 47.238, 6.024, 117000),
    "26": ("Valence", 44.933, 4.892, 64000), "27": ("Évreux", 49.024, 1.151, 47000), "28": ("Chartres", 48.446, 1.489, 38000),
    "29": ("Quimper", 47.996, -4.102, 63000), "2A": ("Ajaccio", 41.919, 8.738, 72000), "2B": ("Bastia", 42.697, 9.451, 48000),
    "30": ("Nîmes", 43.837, 4.360, 148000), "31": ("Toulouse", 43.605, 1.444, 498000), "32": ("Auch", 43.646, 0.586, 22000),
    "33": ("Bordeaux", 44.838, -0.579, 260000), "34": ("Montpellier", 43.611, 3.877, 299000), "35": ("Rennes", 48.117, -1.678, 222000),
    "36": ("Châteauroux", 46.810, 1.691, 43000), "37": ("Tours", 47.394, 0.684, 136000), "38": ("Grenoble", 45.188, 5.724, 158000),
    "39": ("Lons-le-Saunier", 46.675, 5.555, 17000), "40": ("Mont-de-Marsan", 43.890, -0.500, 30000), "41": ("Blois", 47.586, 1.335, 45000),
    "42": ("Saint-Étienne", 45.439, 4.387, 173000), "43": ("Le Puy-en-Velay", 45.043, 3.885, 19000), "44": ("Nantes", 47.218, -1.553, 320000),
    "45": ("Orléans", 47.903, 1.909, 117000), "46": ("Cahors", 44.448, 1.441, 19000), "47": ("Agen", 44.203, 0.616, 32000),
    "48": ("Mende", 44.518, 3.500, 12000), "49": ("Angers", 47.478, -0.563, 155000), "50": ("Saint-Lô", 49.116, -1.091, 19000),
    "51": ("Châlons-en-Champagne", 48.957, 4.363, 44000), "52": ("Chaumont", 48.111, 5.139, 22000), "53": ("Laval", 48.073, -0.770, 50000),
    "54": ("Nancy", 48.692, 6.184, 105000), "55": ("Bar-le-Duc", 48.773, 5.160, 15000), "56": ("Vannes", 47.658, -2.760, 54000),
    "57": ("Metz", 49.120, 6.176, 120000), "58": ("Nevers", 46.990, 3.159, 32000), "59": ("Lille", 50.629, 3.057, 236000),
    "60": ("Beauvais", 49.430, 2.081, 56000), "61": ("Alençon", 48.432, 0.091, 26000), "62": ("Arras", 50.291, 2.778, 41000),
    "63": ("Clermont-Ferrand", 45.778, 3.087, 147000), "64": ("Pau", 43.295, -0.371, 76000), "65": ("Tarbes", 43.233, 0.078, 41000),
    "66": ("Perpignan", 42.699, 2.896, 120000), "67": ("Strasbourg", 48.573, 7.752, 287000), "68": ("Colmar", 48.079, 7.358, 70000),
    "69": ("Lyon", 45.764, 4.836, 522000), "70": ("Vesoul", 47.622, 6.155, 15000), "71": ("Mâcon", 46.307, 4.828, 34000),
    "72": ("Le Mans", 48.006, 0.199, 145000), "73": ("Chambéry", 45.564, 5.918, 60000), "74": ("Annecy", 45.899, 6.129, 131000),
    "75": ("Paris", 48.857, 2.352, 2100000), "76": ("Rouen", 49.443, 1.099, 114000), "77": ("Melun", 48.540, 2.660, 41000),
    "78": ("Versailles", 48.804, 2.130, 85000), "79": ("Niort", 46.323, -0.459, 59000), "80": ("Amiens", 49.894, 2.296, 134000),
    "81": ("Albi", 43.928, 2.148, 49000), "82": ("Montauban", 44.018, 1.355, 61000), "83": ("Toulon", 43.124, 5.928, 180000),
    "84": ("Avignon", 43.949, 4.806, 91000), "85": ("La Roche-sur-Yon", 46.670, -1.426, 55000), "86": ("Poitiers", 46.580, 0.340, 89000),
    "87": ("Limoges", 45.834, 1.262, 130000), "88": ("Épinal", 48.173, 6.450, 32000), "89": ("Auxerre", 47.798, 3.567, 35000),
    "90": ("Belfort", 47.640, 6.863, 46000), "91": ("Évry-Courcouronnes", 48.629, 2.441, 67000), "92": ("Nanterre", 48.892, 2.207, 96000),
    "93": ("Bobigny", 48.908, 2.439, 54000), "94": ("Créteil", 48.790, 2.455, 92000), "95": ("Cergy", 49.036, 2.076, 66000),
}
# Autres villes notables (nom, latitude, longitude, population)
VILLES = [
    ("Le Havre", 49.494, 0.108, 170000), ("Reims", 49.258, 4.032, 180000), ("Brest", 48.390, -4.486, 140000),
    ("Mulhouse", 47.750, 7.336, 108000), ("Aix-en-Provence", 43.529, 5.447, 145000), ("Saint-Nazaire", 47.273, -2.213, 72000),
    ("Béziers", 43.344, 3.216, 79000), ("Cannes", 43.552, 7.017, 74000), ("Calais", 50.951, 1.858, 67000),
    ("Dunkerque", 51.034, 2.377, 87000), ("Lorient", 47.748, -3.370, 57000), ("Saint-Malo", 48.649, -2.026, 46000),
    ("Bayonne", 43.493, -1.475, 52000), ("Biarritz", 43.483, -1.559, 25000), ("Arcachon", 44.658, -1.168, 11000),
    ("Bergerac", 44.853, 0.483, 27000), ("Dax", 43.710, -1.054, 21000), ("Libourne", 44.915, -0.243, 25000),
    ("Sarlat-la-Canéda", 44.890, 1.216, 9000), ("Villeneuve-sur-Lot", 44.408, 0.705, 22000), ("Marmande", 44.500, 0.165, 18000),
    ("Oloron-Sainte-Marie", 43.194, -0.607, 10000), ("Langon", 44.553, -0.249, 7500), ("Lesparre-Médoc", 45.307, -0.938, 5700),
    ("Blaye", 45.128, -0.662, 5000), ("Nontron", 45.529, 0.662, 3000), ("Orthez", 43.488, -0.773, 10500),
    ("Lacanau", 45.000, -1.198, 5000), ("Biscarrosse", 44.394, -1.164, 15000), ("Coutras", 45.041, -0.128, 8500),
    ("Nérac", 44.136, 0.339, 7000), ("Ribérac", 45.250, 0.338, 4000),
]
# Grands massifs : (tracé en lon/lat, altitude du sommet en m, demi-largeur en km)
MASSIFS = [
    ([(-1.7, 43.1), (-0.5, 42.85), (0.6, 42.7), (1.7, 42.6), (2.6, 42.5), (3.1, 42.45)], 2700, 32),   # Pyrénées
    ([(7.4, 43.95), (6.9, 44.4), (6.7, 45.0), (6.9, 45.8), (6.9, 46.2)], 3200, 42),                   # Alpes
    ([(5.9, 44.2), (5.8, 45.2), (6.3, 46.0)], 1500, 28),                                              # Préalpes
    ([(5.8, 46.4), (6.6, 47.2)], 1300, 22),                                                            # Jura
    ([(7.0, 47.85), (7.25, 48.6)], 1200, 22),                                                          # Vosges
    ([(8.9, 41.8), (9.2, 42.6)], 2000, 22),                                                            # Corse
    ([(2.9, 45.4)], 1000, 110), ([(2.75, 45.1)], 1500, 28), ([(2.8, 45.55)], 1600, 25),                # Massif central
    ([(3.6, 44.3)], 1200, 45), ([(2.3, 43.45)], 900, 25), ([(4.0, 47.15)], 700, 30),                   # Cévennes, Montagne Noire, Morvan
    ([(-3.5, 48.3)], 300, 80), ([(4.8, 49.9)], 450, 35), ([(0.8, 45.2)], 250, 70),                     # Armorique, Ardennes, Périgord
]
CARTES = {
    "france": {"nom": "France", "echelle": 250, "bornes": (-5.6, 41.1, 10.0, 51.4), "latitude": 46.5, "region": None,
               "voisins": ["Belgium", "Luxembourg", "Germany", "Switzerland", "Italy", "Spain", "Andorra", "Monaco",
                           "United Kingdom", "Netherlands", "Austria", "Liechtenstein"]},
    "aquitaine": {"nom": "Aquitaine", "echelle": 100, "bornes": (-2.1, 42.6, 1.75, 45.95), "latitude": 44.5,
                  "region": {"24", "33", "40", "47", "64"}, "voisins": ["Spain"]},
}
NOMS_PAYS = {"Belgium": "Belgique", "Luxembourg": "Luxembourg", "Germany": "Allemagne", "Switzerland": "Suisse",
             "Italy": "Italie", "Spain": "Espagne", "Andorra": "Andorre", "Monaco": "Monaco", "United Kingdom": "Royaume-Uni",
             "Netherlands": "Pays-Bas", "Austria": "Autriche", "Liechtenstein": "Liechtenstein"}
# Noms mal encodés ou étrangers dans les sources
CORRECTIONS = {"Rhne": "Rhône", "Sane": "Saône", "Rhein": "Rhin", "Rhine": "Rhin", "Mosel": "Moselle", "Maas": "Meuse",
               "Schelde": "Escaut", "Donau": "Danube", "Ebro": "Èbre"}
COULEURS = ["#e6d3a3", "#d9c99a", "#e3c9a0", "#d6cfa0", "#e8d8b0", "#dcc497", "#d3c6a6", "#e4cf9c"]

# --- Projection conique conforme de Lambert (paramètres Lambert-93) ---
R = 6371000.0
P1, P2, P0, L0 = (math.radians(v) for v in (44, 49, 46.5, 3))
N = math.log(math.cos(P1) / math.cos(P2)) / math.log(math.tan(math.pi / 4 + P2 / 2) / math.tan(math.pi / 4 + P1 / 2))
F = math.cos(P1) * math.tan(math.pi / 4 + P1 / 2) ** N / N


def lambert(lon, lat):
    rho = R * F / math.tan(math.pi / 4 + math.radians(lat) / 2) ** N
    rho0 = R * F / math.tan(math.pi / 4 + P0 / 2) ** N
    t = N * (math.radians(lon) - L0)
    return rho * math.sin(t), rho0 - rho * math.cos(t)  # mètres, y vers le nord


def telecharger():
    CACHE.mkdir(exist_ok=True)
    for nom, url in SOURCES.items():
        if not (CACHE / nom).exists():
            print("téléchargement", url)
            urllib.request.urlretrieve(url, CACHE / nom)
    return {nom: json.loads((CACHE / nom).read_text(encoding="utf-8"))["features"] for nom in SOURCES}


def douglas(pts, tol):
    """Simplification de Douglas-Peucker (itérative). Un anneau fermé est coupé en deux au point le plus éloigné."""
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1]:
        pts = pts[:-1]
        k = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
        return douglas(pts[:k + 1], tol)[:-1] + douglas(pts[k:] + [pts[0]], tol)[:-1]
    garder, pile = {0, len(pts) - 1}, [(0, len(pts) - 1)]
    while pile:
        a, b = pile.pop()
        (xa, ya), (xb, yb) = pts[a], pts[b]
        dx, dy, lg = xb - xa, yb - ya, math.hypot(xb - xa, yb - ya) or 1e-9
        pire, ip = 0, None
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - xa) - dx * (pts[i][1] - ya)) / lg
            if d > pire:
                pire, ip = d, i
        if ip is not None and pire > tol:
            garder.add(ip)
            pile += [(a, ip), (ip, b)]
    return [pts[i] for i in sorted(garder)]


def decouper(anneau, x0, y0, x1, y1):
    """Découpe un polygone par le rectangle (Sutherland-Hodgman)."""
    def couper(pts, dedans, inter):
        sortie = []
        for i, p in enumerate(pts):
            q = pts[i - 1]
            if dedans(p):
                if not dedans(q):
                    sortie.append(inter(q, p))
                sortie.append(p)
            elif dedans(q):
                sortie.append(inter(q, p))
        return sortie

    def ix(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def iy(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    pts = anneau
    for dedans, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)),
                          (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        if not pts:
            break
        pts = couper(pts, dedans, inter)
    return pts


def anneaux(geometrie):
    """Anneaux extérieurs d'un Polygon / MultiPolygon (les trous sont ignorés)."""
    if geometrie["type"] == "Polygon":
        return [geometrie["coordinates"][0]]
    return [p[0] for p in geometrie["coordinates"]]


def lignes(geometrie):
    return [geometrie["coordinates"]] if geometrie["type"] == "LineString" else geometrie["coordinates"]


def dans(x, y, pts):
    d = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            d = not d
    return d


def aire_centre(pts):
    """Aire et centre de gravité d'un polygone (pour placer les noms)."""
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        c = x1 * y2 - x2 * y1
        a += c
        cx += (x1 + x2) * c
        cy += (y1 + y2) * c
    a /= 2
    return (abs(a), (cx / (6 * a), cy / (6 * a))) if a else (0, pts[0])


def fabriquer(cle, donnees):
    cfg = CARTES[cle]
    ech = cfg["echelle"]
    lo0, la0, lo1, la1 = cfg["bornes"]
    coins = [lambert(lo, la) for lo in (lo0, lo1) for la in (la0, la1)] + [lambert((lo0 + lo1) / 2, la1)]
    xmin, xmax = min(c[0] for c in coins[:4]), max(c[0] for c in coins[:4])
    ymin = min(c[1] for c in coins[:4])
    ymax = max(c[1] for c in coins)
    L, H = round((xmax - xmin) / ech), round((ymax - ymin) / ech)

    def proj(lon, lat):
        x, y = lambert(lon, lat)
        return [round((x - xmin) / ech, 1), round((ymax - y) / ech, 1)]  # unités, y vers le bas

    def contour(anneau, tol=1.2):
        pts = douglas([tuple(proj(lo, la)) for lo, la in anneau], tol)
        pts = decouper(pts, -50, -50, L + 50, H + 50)
        return [[round(x, 1), round(y, 1)] for x, y in pts] if len(pts) >= 3 else None

    entites = [{"type": "zone", "style": "mer", "calque": "sol", "x": -4000, "y": -4000, "w": L + 8000, "h": H + 8000,
                "nom": "Océan Atlantique", "ancre": list(proj(-3.6 if cle == "france" else -1.75, 46.2 if cle == "france" else 44.3))}]
    if cle == "france":
        for nom, lo, la in (("Mer Méditerranée", 5.0, 42.3), ("Manche", -1.8, 50.0)):  # noms seuls, sans surface
            entites.append({"type": "zone", "style": "mer", "calque": "sol", "x": 0, "y": 0, "w": 0, "h": 0, "nom": nom, "ancre": proj(lo, la)})
    terres, terres_region = [], []

    # Pays voisins
    for f in donnees["pays.geojson"]:
        nom = f["properties"].get("NAME") or f["properties"].get("ADMIN")
        if nom not in cfg["voisins"]:
            continue
        morceaux = [c for a in anneaux(f["geometry"]) if (c := contour(a, 2.5))]
        meilleur = max(morceaux, key=lambda c: aire_centre(c)[0], default=None)
        for c in morceaux:
            e = {"type": "zone", "style": "pays", "calque": "sol", "points": c}
            if c is meilleur:
                cx, cy = aire_centre(c)[1]
                e |= {"nom": NOMS_PAYS[nom], "ancre": [round(min(max(cx, 80), L - 80)), round(min(max(cy, 60), H - 60))]}
            entites.append(e)
            terres.append(c)

    # Départements : ceux de la région en couleur, les autres grisés comme des voisins
    for i, f in enumerate(donnees["departements.geojson"]):
        code, nom = f["properties"]["code"], f["properties"]["nom"]
        dans_region = cfg["region"] is None or code in cfg["region"]
        morceaux = [c for a in anneaux(f["geometry"]) if (c := contour(a, 1.0 if cle == "aquitaine" else 1.4))]
        if not morceaux:
            continue
        meilleur = max(morceaux, key=lambda c: aire_centre(c)[0])
        for c in morceaux:
            e = {"type": "zone", "style": "departement" if dans_region else "pays", "calque": "sol", "points": c}
            if dans_region:
                e |= {"code": code, "couleur": COULEURS[i % len(COULEURS)]}
            if c is meilleur:
                cx, cy = aire_centre(c)[1]
                if 0 < cx < L and 0 < cy < H:
                    e |= {"nom": nom, "ancre": [round(cx), round(cy)]} | ({"code": code} if dans_region else {})
            entites.append(e)
            terres.append(c)
            if dans_region:
                terres_region.append(c)

    # Lacs
    for f in donnees["lacs.geojson"]:
        for a in anneaux(f["geometry"]):
            if all(lo0 <= lo <= lo1 and la0 <= la <= la1 for lo, la in a[:5]) and (c := contour(a, 0.8)):
                if aire_centre(c)[0] > (40 if cle == "france" else 15):
                    nom = f["properties"].get("name_fr") or f["properties"].get("name")
                    entites.append({"type": "zone", "style": "lac", "calque": "eau", "points": c} | ({"nom": nom} if nom else {}))

    # Fleuves et rivières : un seul nom par cours d'eau (sur son plus long tronçon)
    troncons = []
    for f in donnees["fleuves.geojson"] + donnees["fleuves2.geojson"]:
        p = f["properties"]
        rang = p.get("scalerank") or 10  # 2 = très grand fleuve … 12 = petite rivière
        if cle == "france" and rang > 11:
            continue
        poids = max(0.3, (12 - rang) / 4)
        nom = p.get("name_fr") or p.get("name") or ""
        nom = CORRECTIONS.get(nom, nom)
        for l in lignes(f["geometry"]):
            if not any(lo0 <= lo <= lo1 and la0 <= la <= la1 for lo, la in l):
                continue
            pts = douglas([tuple(proj(lo, la)) for lo, la in l], 0.8)
            pts = [[round(x, 1), round(y, 1)] for x, y in pts if -100 <= x <= L + 100 and -100 <= y <= H + 100]
            if len(pts) >= 2:
                long = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
                troncons.append((nom, long, poids, pts))
    nomme = {}
    for nom, long, poids, pts in troncons:
        if nom and long > nomme.get(nom, (0,))[0]:
            nomme[nom] = (long, id(pts))
    for nom, long, poids, pts in troncons:
        e = {"type": "ligne", "style": "riviere", "calque": "eau", "points": pts,
             "largeur": round(min(14, 2 + poids * 5) * (100 / ech) ** 0.5, 1)}
        if nom and nomme[nom][1] == id(pts):
            e["nom"] = nom
        entites.append(e)

    # Villes
    region = cfg["region"]
    villes = [(n, la, lo, p, code) for code, (n, la, lo, p) in PREFECTURES.items() if region is None or code in region]
    villes += [(n, la, lo, p, None) for n, la, lo, p in VILLES]
    for nom, la, lo, pop, code in villes:
        x, y = proj(lo, la)
        if not (0 < x < L and 0 < y < H) or (cle == "france" and code is None and pop < 60000):
            continue
        if region and code is None and not any(dans(x, y, c) for c in terres_region):
            continue
        e = {"type": "batiment", "style": "ville", "calque": "batiments", "nom": nom, "x": x, "y": y,
             "population": pop, "taille": round(8 + math.sqrt(pop) / 25 * (100 / ech) ** 0.5), "lumiere": True}
        if code:
            e["prefecture"] = True
        entites.append(e)

    # Relief approché : massifs en crêtes gaussiennes + ondulation, 0 en mer
    rng = random.Random(7)
    pas = 25
    bruit = [[rng.random() for _ in range(L // 200 + 3)] for _ in range(H // 200 + 3)]
    massifs = [([proj(lo, la) for lo, la in trace], h, k * 1000 / ech) for trace, h, k in MASSIFS]
    boites = [(min(p[0] for p in c), min(p[1] for p in c), max(p[0] for p in c), max(p[1] for p in c), c) for c in terres]
    valeurs = []
    for y in range(0, H + 1, pas):
        ligne = []
        for x in range(0, L + 1, pas):
            if not any(b[0] <= x <= b[2] and b[1] <= y <= b[3] and dans(x, y, b[4]) for b in boites):
                ligne.append(0)
                continue
            alt = 60 + 90 * bruit[y // 200][x // 200]
            for trace, h, k in massifs:
                d = min([math.dist((x, y), trace[0])] + [dist_segment(x, y, a, b) for a, b in zip(trace, trace[1:])])
                alt += h * math.exp(-(d / k) ** 2)
            ligne.append(round(alt))
        valeurs.append(ligne)

    # Zones climatiques grossières (en unités de carte)
    if cle == "france":
        zones = [{"nom": "Méditerranée", "rect": [proj(3.0, 44.0)[0], proj(3.0, 44.0)[1], 1e9, 1e9], "dt": 2.5, "pluie": 0.8},
                 {"nom": "Nord", "rect": [-1e9, -1e9, 1e9, proj(2.0, 48.0)[1]], "dt": -2.0, "vent": 1.1},
                 {"nom": "Est", "rect": [proj(4.5, 46.0)[0], -1e9, 1e9, 1e9], "dt": -1.5, "vent": 0.9},
                 {"nom": "Ouest", "rect": [-1e9, -1e9, 1e9, 1e9]}]
    else:
        zones = [{"nom": "Pyrénées", "rect": [-1e9, proj(0, 43.35)[1], 1e9, 1e9], "dt": -3.0, "pluie": 1.4},
                 {"nom": "Côte", "rect": [-1e9, -1e9, proj(-0.95, 44.5)[0], 1e9], "pluie": 1.15, "vent": 1.5},
                 {"nom": "Intérieur", "rect": [-1e9, -1e9, 1e9, 1e9]}]
    return {"nom": cfg["nom"], "taille": [L, H], "echelle": ech, "latitude": cfg["latitude"],
            "relief": {"pas": pas, "valeurs": valeurs}, "zones_climat": zones, "entites": entites}


def dist_segment(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - a[0] - t * dx, py - a[1] - t * dy)


if __name__ == "__main__":
    donnees = telecharger()
    (RACINE / "cartes").mkdir(exist_ok=True)
    for cle in CARTES:
        carte = fabriquer(cle, donnees)
        texte = json.dumps(carte, ensure_ascii=False, separators=(",", ":"))
        (RACINE / "cartes" / f"{cle}.json").write_text(texte, encoding="utf-8")
        compte = {}
        for e in carte["entites"]:
            compte[e["style"]] = compte.get(e["style"], 0) + 1
        print(f"{cle}: {carte['taille']} unités ×{carte['echelle']} m, {len(texte) // 1024} Ko, {compte}")
