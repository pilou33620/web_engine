# Maquettes

L'atelier graphique : chaque maquette est une page autonome qui montre un rendu avant son intégration dans un jeu,
puis dans la bibliothèque (`lib/`). Ce dossier appartient à web_engine.

- **Mise à jour depuis les jeux :** `outils/synchroniser.sh` y **ajoute ou met à jour** les maquettes des jeux et des branches suivies, sans jamais rien supprimer. Un jeu peut donc retirer les siennes : elles restent ici.
- **Nouvelles maquettes :** elles se créent directement ici, dans le dossier du jeu concerné ou dans un nouveau dossier.
- **L'accueil** (`index.html`, onglet « Maquettes ») les liste toutes, via `sources/SOURCES.json`.

| Dossier | Contenu |
|---|---|
| `web_royaumes/` | armées par technologie, guerre et diplomatie, vie des quartiers, rendu façon web_power ; `source/` : leurs fichiers sources et générateurs |
| `web_power/` | maquette des déchets |
| `web_engine/` | maquettes faites ici : la carte complète (tous les nouveaux rendus, choix de l'époque) ; tous les bâtiments modernes sur une petite carte ; Gaulois et Romains (bâtiments et armées) ; arbres et montagnes (avant et propositions ; la proposition 1 est retenue : plateau royaumes en lib 1.3.0, plateau power en 1.4.0) |
| `web_power-heliosphere/` | Héliosphère, conquête du système solaire (branche `claude/jolly-meitner-cjshzu` de web_power, non fusionnée) |

**Les générateurs** `web_royaumes/source/*/gen.py` sont gardés tels qu'ils ont été écrits. Ils contiennent les chemins absolus de leur espace de travail d'origine : un ancien dossier temporaire pour `guerre`, `web_royaumes/web/js/rendu` pour `quartiers`, qui correspond aujourd'hui à `lib/rendu`. Pour régénérer une maquette, il faut d'abord adapter ces chemins.
