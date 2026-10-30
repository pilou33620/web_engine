// Module de l'Atlas : choisir une carte toute faite ou en générer une avec des réglages.
// Branché par app.js comme les modules du moteur (installer(ctx)).

import { ANNEES } from "/moteur/themes/epoque.js";

const NOMS = { france: "France", aquitaine: "Aquitaine" };
const libelleAnnee = (a) => (a < 0 ? `${-a} av. J.-C.` : String(a));

export async function installer(ctx) {
  const { esc } = ctx;
  const res = await ctx.api("/api/action", { nom: "liste_cartes", params: {} });
  const groupes = Map.groupBy ? Map.groupBy(res.reglages, (r) => r.groupe) : grouper(res.reglages);

  const section = document.createElement("section");
  section.className = "atlas";
  section.innerHTML = `<h3>Carte</h3>
    <div class="choix">${res.cartes.map((c) => `<button data-carte="${esc(c)}">${esc(NOMS[c] ?? c)}</button>`).join("")}</div>
    <h3>Époque : <output id="atlas-annee">${ctx.carte?.annee ?? 1790}</output></h3>
    <input type="range" id="atlas-curseur" min="0" max="${ANNEES.length - 1}" step="1"
      value="${Math.max(0, ANNEES.indexOf(ctx.carte?.annee ?? 1790))}" style="width:100%;accent-color:var(--accent)">
    ${res.reglages.length ? `<details><summary>Générer une carte</summary>
      ${[...groupes].map(([groupe, liste]) => `<fieldset><legend>${esc(groupe ?? "")}</legend>${liste.map(champ).join("")}</fieldset>`).join("")}
      <div class="choix"><button data-generer="hasard">🎲 Au hasard</button><button data-generer="oui">Générer</button></div>
    </details>` : ""}`;
  ctx.$("menu-extensions").append(section);
  const style = document.createElement("style");
  style.textContent = `.atlas details { margin-top: 10px; } .atlas summary { cursor: pointer; padding: 8px 0; }
    .atlas fieldset { border: 1px solid var(--fond2); border-radius: 8px; margin: 8px 0; padding: 6px 10px; }
    .atlas legend { color: var(--doux); font-size: .85rem; } .atlas label { display: block; margin: 6px 0; font-size: .9rem; }
    .atlas input[type=range], .atlas select { width: 100%; accent-color: var(--accent); }
    .atlas select { background: var(--fond2); color: var(--texte); border: 0; border-radius: 6px; padding: 6px; }
    .atlas output { float: right; color: var(--accent); }`;
  document.head.append(style);

  function champ(r) {
    const id = `atlas-${r.id}`;
    if (r.choix) {
      return `<label for="${id}">${esc(r.libelle)}<select id="${id}" data-reglage="${esc(r.id)}">
        ${r.choix.map((c) => `<option ${c === r.defaut ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>`;
    }
    return `<label for="${id}">${esc(r.libelle)} <output>${r.defaut}</output>
      <input id="${id}" type="range" data-reglage="${esc(r.id)}" min="${r.min}" max="${r.max}" step="${r.pas ?? 1}" value="${r.defaut}"></label>`;
  }

  // Curseur d'année (sans Moyen Âge) : affichage en direct, envoi au serveur quand on lâche
  const curseur = section.querySelector("#atlas-curseur"), sortieAnnee = section.querySelector("#atlas-annee");
  sortieAnnee.textContent = libelleAnnee(ANNEES[curseur.value]);
  curseur.addEventListener("input", () => (sortieAnnee.textContent = libelleAnnee(ANNEES[curseur.value])));
  curseur.addEventListener("change", () => ctx.action("annee", { valeur: ANNEES[curseur.value] }));

  ctx.surCarte((carte) => {
    const i = ANNEES.indexOf(carte.annee);
    if (i >= 0) curseur.value = i;
    sortieAnnee.textContent = libelleAnnee(carte.annee);
  });

  section.addEventListener("input", (e) => {
    if (e.target === curseur) return;
    const sortie = e.target.parentElement.querySelector("output");
    if (sortie) sortie.textContent = e.target.value;
  });

  let recentrer = false;
  ctx.surCarte(() => {
    if (recentrer) ctx.rendu.recentrer();
    recentrer = false;
  });

  async function changer(source, reglages = {}) {
    recentrer = true;
    ctx.toast(source === "generee" ? "Génération de la carte…" : "Chargement…");
    if (!(await ctx.action("changer_carte", { source, reglages }))) recentrer = false;
  }

  section.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.carte) return changer(b.dataset.carte);
    if (b.dataset.generer === "hasard") {
      const graine = section.querySelector('[data-reglage="graine"]');
      if (graine) graine.value = Math.floor(Math.random() * Number(graine.max || 99999));
      graine?.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (b.dataset.generer) {
      const reglages = {};
      for (const el of section.querySelectorAll("[data-reglage]")) {
        reglages[el.dataset.reglage] = el.tagName === "SELECT" ? el.value : Number(el.value);
      }
      changer("generee", reglages);
    }
  });
}

function grouper(liste) {
  const m = new Map();
  for (const r of liste) m.set(r.groupe, [...(m.get(r.groupe) ?? []), r]);
  return m;
}
