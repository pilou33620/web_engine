"""Constructions du joueur : lignes tracées à la main (routes, réseaux…) et bâtiments placés.

Un jeu déclare ce qui se construit dans Regles.CONSTRUCTIONS :
  {"id", "libelle", "type": "ligne"|"batiment", "style", "calque", "cout", "rayon" (m, bâtiments),
   "ressource" (défaut "argent"), "icone"}
Pour une ligne, "cout" est par km. Les règles peuvent refuser avec peut_construire(monde, modele, geometrie)
(lever ValueError) et réagir avec construit(monde, entite) / demoli(monde, entite).
"""
import math

MAX_POINTS = 200


def _nombre(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError("Coordonnée invalide.")
    return float(v)


def _dans_carte(m, x, y):
    L, H = m.taille
    if not (0 <= x <= L and 0 <= y <= H):
        raise ValueError("Hors de la carte.")


def construire(m, params):
    modele = next((c for c in getattr(m.regles, "CONSTRUCTIONS", []) if c["id"] == params.get("modele")), None)
    if modele is None:
        raise ValueError("Construction inconnue.")
    if modele["type"] == "ligne":
        pts = params.get("points")
        if not isinstance(pts, list) or not 2 <= len(pts) <= MAX_POINTS:
            raise ValueError(f"Une ligne a de 2 à {MAX_POINTS} points.")
        if not all(isinstance(p, list) and len(p) == 2 for p in pts):
            raise ValueError("Points invalides.")
        pts = [[_nombre(x), _nombre(y)] for x, y in pts]
        for x, y in pts:
            _dans_carte(m, x, y)
        longueur = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        if longueur < 1:
            raise ValueError("Ligne trop courte.")
        cout, geometrie = modele["cout"] * longueur / 1000, {"points": pts}
    else:
        x, y = _nombre(params.get("x")), _nombre(params.get("y"))
        _dans_carte(m, x, y)
        rayon = modele.get("rayon", 20)
        for b in m.de_type("batiment"):
            if math.hypot(b["x"] - x, b["y"] - y) < rayon + b.get("taille", 20):
                raise ValueError("Trop près d'un autre bâtiment.")
        cout, geometrie = modele["cout"], {"x": x, "y": y, "taille": rayon}
    cout = round(cout)
    nom_res = modele.get("ressource", "argent")
    if m.ressources.get(nom_res, {"valeur": 0})["valeur"] < cout:
        raise ValueError(f"Pas assez de ressources : {cout} nécessaires.")
    if hasattr(m.regles, "peut_construire"):
        m.regles.peut_construire(m, modele, geometrie)
    m.ressource(nom_res, -cout)
    e = m.ajouter(modele["type"], modele["style"], calque=modele.get("calque", "batiments"),
                  constructible=True, nom=modele["libelle"], **geometrie)
    if hasattr(m.regles, "construit"):
        m.regles.construit(m, e)
    m.annoncer(f"{modele['libelle']} construit (−{cout} {modele.get('unite', '€')}).")
    return {"message": f"{modele['libelle']} construit.", "id": e["id"]}


def demolir(m, id):
    e = m.entites.get(id)
    if e is None or not e.get("constructible"):
        raise ValueError("Impossible de démolir ceci.")
    m.supprimer(id)
    if hasattr(m.regles, "demoli"):
        m.regles.demoli(m, e)
    m.annoncer(f"{e.get('nom', e['style'])} démoli.")
    return {"message": "Démoli."}
