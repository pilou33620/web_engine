//! Royaumes des Rives : moteur du jeu (tour par tour, un mois par tour, 1700-1850) et serveur local.
//! L'interface est une page web (dossier web/) servie par `serveur`.

// l'état envoyé à l'interface est un seul gros `json!` (vue.rs)
#![recursion_limit = "256"]

pub mod carte;
pub mod cite;
pub mod choix;
pub mod commandes;
pub mod espions;
pub mod forts;
pub mod hasard;
pub mod ia;
pub mod marine;
pub mod meteo;
pub mod partie;
pub mod regles;
pub mod serveur;
pub mod sieges;
pub mod tour;
pub mod vue;
