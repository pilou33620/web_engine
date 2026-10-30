"""Lance un jeu : python3 lancer.py [nom_du_jeu] [port]"""
import importlib
import sys

from moteur.serveur import servir

nom = sys.argv[1] if len(sys.argv) > 1 else "demo"
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
servir(importlib.import_module(f"jeux.{nom}.regles").Regles(), nom, port)
