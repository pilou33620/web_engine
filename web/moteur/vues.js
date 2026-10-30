// Module « vues » : cartes de données fournies par les règles (VUES), coloriées en surimpression sur les zones.
import { melange } from "./climat.js";

const P = window.PIXI;
const RAFRAICHIR = 2000;  // ms entre deux lectures de /api/vue
// Du rouge (0) au vert (1) en passant par le jaune, lisible sur les deux thèmes
const couleur = (v) => (v < 0.5 ? melange(0xd73027, 0xfee08b, v * 2) : melange(0xfee08b, 0x1a9850, v * 2 - 1));

export function installer(ctx) {
  const { rendu, $, esc } = ctx;
  // Au-dessus de la végétation et du relief, sous les routes
  const calque = rendu.monde.addChildAt(new P.Graphics(), rendu.monde.getChildIndex(rendu.calques.routes));
  calque.alpha = 0.55;
  const section = $("menu-extensions").appendChild(document.createElement("section"));
  const legende = document.body.appendChild(document.createElement("div"));
  legende.className = "legende-vue";
  legende.hidden = true;
  let vues = [], active = null, valeurs = {}, derniere = 0, enCours = false;

  function dessiner() {
    calque.clear();
    if (!active) return;
    // shortcut: un seul Graphics redessiné en entier toutes les 2 s ; découper par tuile si les cartes dépassent quelques milliers de zones
    for (const e of ctx.carte?.entites ?? []) {
      const v = valeurs[e.id];
      if (e.type !== "zone" || v == null) continue;
      (e.points ? calque.poly(e.points.flat()) : calque.rect(e.x, e.y, e.w, e.h)).fill(couleur(Math.min(1, Math.max(0, v))));
    }
  }

  async function lire() {
    if (!active || enCours) return;
    enCours = true;
    derniere = performance.now();
    const id = active.id;
    try {
      const r = await ctx.api(`/api/vue?id=${encodeURIComponent(id)}`);
      if (active?.id === id) valeurs = r.valeurs;
    } catch (e) {
      ctx.toast(e.message, true);
      choisir(null);
    }
    enCours = false;
    dessiner();
  }

  function choisir(id) {
    active = vues.find((v) => v.id === id) ?? null;
    valeurs = {};
    for (const b of section.querySelectorAll("button")) b.classList.toggle("actif", (b.dataset.vue || null) === (active?.id ?? null));
    legende.hidden = !active;
    if (active) legende.innerHTML = `<b>${esc(active.libelle)}</b><span class="echelle"><small>${esc(active.min ?? "")}</small>
      <i></i><small>${esc(active.max ?? "")}</small></span><button aria-label="Enlever la vue">✕</button>`;
    dessiner();
    lire();
  }

  section.onclick = (e) => e.target.dataset.vue !== undefined && choisir(e.target.dataset.vue || null);
  legende.onclick = (e) => e.target.closest("button") && choisir(null);

  ctx.surCarte((carte) => {
    const liste = JSON.stringify(carte.vues ?? []);
    if (liste !== JSON.stringify(vues)) {
      vues = carte.vues ?? [];
      section.hidden = !vues.length;
      section.innerHTML = `<h3>Vue</h3><div class="choix vues"><button data-vue="">Aucune</button>${vues.map((v) =>
        `<button data-vue="${esc(v.id)}">${esc(v.libelle)}</button>`).join("")}</div>`;
      choisir(vues.some((v) => v.id === active?.id) ? active.id : null);
    } else dessiner();
  });
  ctx.surEtat(() => { if (active && performance.now() - derniere > RAFRAICHIR) lire(); });
}
