// Module « tutoriel » : bulle guidée « n / N » (ctx.carte.tutoriel), flèche vers la cible et halo.
const ATTENTE = 800;  // laisser les autres modules remplir leurs éléments (#outils…)

export function installer(ctx) {
  let etapes = [], index = -1, cle = "", lance = false;
  const bulle = document.createElement("div"), halo = document.createElement("div");
  bulle.className = "tuto-bulle";
  bulle.setAttribute("role", "dialog");
  halo.className = "tuto-halo";
  bulle.hidden = halo.hidden = true;
  document.body.append(halo, bulle);

  const vu = () => { try { return localStorage.getItem(cle) === "fini"; } catch { return false; } };
  const memoriser = () => { try { localStorage.setItem(cle, "fini"); } catch { /* stockage indisponible */ } };

  function cible() {
    const s = etapes[index]?.cible, el = s && document.querySelector(s);
    if (!el || !(el.children.length || el.textContent.trim())) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" ? r : null;
  }

  function placer() {
    if (index < 0) return;
    for (const el of [bulle, halo]) el.classList.toggle("en-retrait", !!ctx.outil);
    const r = cible(), l = bulle.offsetWidth, h = bulle.offsetHeight, marge = 12;
    bulle.classList.toggle("centree", !r);
    halo.hidden = !r;
    if (!r) {
      bulle.style.left = `${(innerWidth - l) / 2}px`;
      bulle.style.top = `${(innerHeight - h) / 2}px`;
      return;
    }
    Object.assign(halo.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    const dessous = r.bottom + 14 + h < innerHeight - marge;
    const x = Math.min(Math.max(r.left + r.width / 2 - l / 2, marge), innerWidth - l - marge);
    bulle.style.left = `${x}px`;
    bulle.style.top = `${dessous ? r.bottom + 14 : Math.max(r.top - 14 - h, marge)}px`;
    bulle.classList.toggle("dessus", !dessous);
    bulle.style.setProperty("--fleche", `${Math.min(Math.max(r.left + r.width / 2 - x, 18), l - 18)}px`);
  }

  function montrer(i) {
    index = i;
    if (i >= etapes.length) return fermer();
    const derniere = i === etapes.length - 1;
    bulle.innerHTML = `<small>${i + 1} / ${etapes.length}</small><p>${ctx.esc(etapes[i].texte)}</p><div class="tuto-boutons">
      ${derniere ? "" : '<button data-tuto="passer">Passer</button>'}
      <button class="bouton-or" data-tuto="suivant">${derniere ? "Terminer" : "Suivant"}</button></div>`;
    bulle.hidden = false;
    placer();
  }

  function fermer() {
    index = -1;
    bulle.hidden = halo.hidden = true;
    memoriser();
  }

  bulle.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (b?.dataset.tuto === "passer") fermer();
    else if (b) montrer(index + 1);
  });
  addEventListener("resize", placer);
  ctx.surEtat(placer);  // les cibles se remplissent ou bougent au fil des mises à jour

  ctx.surCarte((carte) => {
    if (lance) return;
    lance = true;
    etapes = carte.tutoriel ?? [];
    cle = `tutoriel:${carte.titre ?? ""}`;
    if (!etapes.length) return;
    const section = document.createElement("section");
    section.innerHTML = '<h3>Aide</h3><div class="choix"><button data-tuto="revoir">Revoir le tutoriel</button></div>';
    section.querySelector("button").onclick = () => { ctx.$("menu").hidden = true; montrer(0); };
    ctx.$("menu-extensions").append(section);
    if (!vu()) setTimeout(() => index < 0 && montrer(0), ATTENTE);
  });
}
