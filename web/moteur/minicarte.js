// Module « minicarte » : vue d'ensemble de la carte, rectangle de la vue courante, toucher pour s'y rendre.
const LARGEUR = 160;  // px CSS (le CSS la réduit sur téléphone)
const CALQUES = ["base", "sol", "occupation", "eau", "routes"];

export function installer(ctx) {
  const { rendu, app } = ctx;
  const bloc = document.body.appendChild(document.createElement("div"));
  bloc.className = "minicarte";
  bloc.innerHTML = `<canvas></canvas><button class="replier" aria-label="Minicarte"></button>`;
  const toile = bloc.querySelector("canvas"), c2d = toile.getContext("2d");
  // Repliée d'office sur téléphone
  bloc.classList.toggle("repliee", innerWidth < 600);
  bloc.querySelector("button").onclick = () => bloc.classList.toggle("repliee");
  let fond = null, cle = "";

  ctx.surCarte((carte) => {
    const [L, H] = carte.taille, d = Math.min(devicePixelRatio, 2);
    toile.style.aspectRatio = `${L} / ${H}`;
    toile.width = Math.round(LARGEUR * d);
    toile.height = Math.round(((LARGEUR * H) / L) * d);
    try { fond = rendu.instantane(CALQUES, toile.width); } catch (e) { fond = null; console.warn(e); }
    cle = "";
  });

  // Rectangle de la vue, redessiné seulement quand la caméra bouge
  app.ticker.add(() => {
    if (!rendu.carte || bloc.classList.contains("repliee")) return;
    const { width: w, height: h } = app.screen, a = rendu.versMonde(0, 0), b = rendu.versMonde(w, h);
    const k = `${a.x}|${a.y}|${b.x}|${b.y}|${fond ? 1 : 0}`;
    if (k === cle) return;
    cle = k;
    const [L, H] = rendu.carte.taille, sx = toile.width / L, sy = toile.height / H;
    c2d.clearRect(0, 0, toile.width, toile.height);
    if (fond) c2d.drawImage(fond, 0, 0, toile.width, toile.height);
    c2d.lineWidth = 2 * Math.min(devicePixelRatio, 2);
    c2d.strokeStyle = "#fff";
    c2d.strokeRect(a.x * sx, a.y * sy, (b.x - a.x) * sx, (b.y - a.y) * sy);
  });

  const viser = (e) => {
    if (!rendu.carte) return;
    const r = toile.getBoundingClientRect(), [L, H] = rendu.carte.taille;
    rendu.viser(((e.clientX - r.left) / r.width) * L, ((e.clientY - r.top) / r.height) * H);
  };
  toile.addEventListener("pointerdown", (e) => { toile.setPointerCapture(e.pointerId); viser(e); });
  toile.addEventListener("pointermove", (e) => toile.hasPointerCapture(e.pointerId) && viser(e));
}
