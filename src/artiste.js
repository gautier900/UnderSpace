import * as THREE from "three";
import { rappeurs } from "./data/rappeurs.js";
import { exemple } from "./data/artiste-exemple.js";
import { createPlanet, TYPE_LABELS } from "./planet.js";
import { bestPlayer } from "./player.js";
import { badgesOf } from "./data/badges.js";
import { perso, toggleManuel } from "./perso.js";
import "./style.css";
import "./artiste.css";

// --- Petit utilitaire pour créer des éléments sans risque d'injection HTML ---
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const LIENS = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  deezer: "Deezer",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const all = [...rappeurs, exemple];
const byName = new Map(all.map((r) => [norm(r.nom), r]));
const pageUrl = (r) => `artiste.html?id=${encodeURIComponent(r.id)}`;
const sortKey = (x) => x.date || String(x.annee ?? 0);
const byDateDesc = (a, b) => sortKey(b).localeCompare(sortKey(a));

const id = new URLSearchParams(location.search).get("id");
const artiste = all.find((r) => r.id === id);
const page = document.getElementById("page");

if (!artiste) {
  document.title = "Artiste introuvable · UnderSpace";
  page.append(
    h(
      "section",
      { class: "card empty-page" },
      h("h1", {}, "Artiste introuvable"),
      h(
        "p",
        { class: "muted" },
        "Cette planète n'existe pas (encore) dans la galaxie.",
      ),
      h("a", { class: "btn", href: "./" }, "Retour à la galaxie"),
    ),
  );
} else {
  render(artiste);
}

function render(a) {
  const [c1, c2, c3] = a.planete.couleurs;
  document.title = `${a.nom} · UnderSpace`;
  document.body.style.setProperty("--c1", c1);
  document.body.style.setProperty("--c2", c2);
  document.body.style.setProperty("--accent", c3);
  if (a.id !== "exemple")
    document.getElementById("back").href = `./#${encodeURIComponent(a.id)}`;

  const projets = [...(a.projets ?? [])].sort(byDateDesc);
  const singles = [...(a.singles ?? [])].sort(byDateDesc);
  const sorties = [...projets, ...singles].sort(byDateDesc);
  const annees = sorties.map((s) => s.annee).filter(Boolean);
  const debut = a.debut ?? (annees.length ? Math.min(...annees) : null);
  const derniere = sorties[0];
  const liens = Object.entries(a.liens ?? {}).filter(([, url]) => url);
  const meta = [a.ville, a.collectif, debut && `actif depuis ${debut}`].filter(
    Boolean,
  );
  const player = bestPlayer(a);

  // --- En-tête ---
  const canvas = h("canvas", {
    class: "hero-planet",
    "aria-label": `Planète de ${a.nom}`,
  });
  page.append(
    h(
      "section",
      { class: "hero" },
      h("div", { class: "hero-visual" }, canvas),
      h(
        "div",
        { class: "hero-info" },
        h(
          "div",
          { class: "hero-badges" },
          h(
            "span",
            { class: "badge" },
            TYPE_LABELS[a.planete.type] ?? "Planète",
          ),
          badgesOf(a).map((b) =>
            h(
              "span",
              { class: "badge badge-special", style: `--badge:${b.couleur}` },
              `${b.icone} ${b.label}`,
            ),
          ),
        ),
        h("h1", {}, a.nom),
        meta.length
          ? h("p", { class: "meta" }, meta.join(" · "))
          : h(
              "p",
              { class: "meta muted" },
              "Ville, collectif, début de carrière : à compléter",
            ),
        a.tags?.length
          ? h(
              "ul",
              { class: "tags" },
              a.tags.map((t) => h("li", {}, t)),
            )
          : null,
        player || liens.length
          ? h(
              "div",
              { class: "links" },
              player
                ? h(
                    "a",
                    { class: "btn btn-play", href: "#ecouter" },
                    "▶ Écouter",
                  )
                : null,
              liens.map(([k, url]) =>
                h(
                  "a",
                  {
                    class: "btn",
                    href: url,
                    target: "_blank",
                    rel: "noopener",
                  },
                  LIENS[k] ?? k,
                ),
              ),
            )
          : null,
        persoBlock(a),
      ),
    ),
  );

  // --- Chiffres clés ---
  page.append(
    h(
      "section",
      { class: "stats" },
      stat(projets.length, projets.length > 1 ? "projets" : "projet"),
      stat(singles.length, singles.length > 1 ? "singles" : "single"),
      stat(debut ?? "—", "débuts"),
      stat(derniere ? derniere.titre : "—", "dernière sortie", true),
    ),
  );

  // --- Lecteur : le son le plus connu ---
  page.append(playerSection(player));

  // --- Résumé ---
  page.append(
    section(
      "Résumé",
      a.description
        ? h("p", { class: "bio" }, a.description)
        : empty(
            "Pas encore de résumé. Ajoute un champ « description » à cet artiste dans src/data/rappeurs.json.",
          ),
    ),
  );

  // --- Projets ---
  page.append(
    section(
      `Projets${projets.length ? ` (${projets.length})` : ""}`,
      projets.length
        ? h(
            "div",
            { class: "projects" },
            projets.map((p) => projectCard(p, a)),
          )
        : empty(
            "Aucun projet renseigné. Ajoute une liste « projets » (albums, mixtapes, EP).",
          ),
    ),
  );

  // --- Singles ---
  page.append(
    section(
      `Singles${singles.length ? ` (${singles.length})` : ""}`,
      singles.length
        ? h("ol", { class: "singles" }, singles.map(singleRow))
        : empty("Aucun single renseigné. Ajoute une liste « singles »."),
    ),
  );

  page.append(
    h(
      "footer",
      { class: "foot muted" },
      "Une info manque ou est fausse ? Tout se complète dans src/data/rappeurs.json.",
    ),
  );

  heroPlanet(canvas, a);
}

function playerSection(player) {
  const block = h("section", {
    class: "card block player-block",
    id: "ecouter",
  });
  if (!player) {
    block.append(
      h("h2", {}, "À écouter en premier"),
      empty(
        "Aucun lecteur pour l’instant. Ajoute le lien du profil Spotify dans « liens.spotify » : ses titres les plus populaires s’afficheront automatiquement. Tu peux aussi choisir un son précis avec « titrePhare ».",
      ),
    );
    return block;
  }
  const title = player.titre
    ? `Le son phare : ${player.titre}`
    : player.auto
      ? "Ses sons les plus connus"
      : "À écouter en premier";
  const caption = player.auto
    ? `Classement des titres les plus écoutés, mis à jour automatiquement par ${player.source}.`
    : `Lecteur ${player.source}`;
  const frame = h("iframe", {
    class: `player player-${player.source.toLowerCase()}`,
    src: player.src,
    title: `Lecteur ${player.source}`,
    loading: "lazy",
    allow:
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    allowfullscreen: "",
    style: player.height ? `height:${player.height}px` : null,
  });
  block.append(
    h("h2", {}, title),
    h("div", { class: "player-wrap" }, frame),
    h("p", { class: "player-caption muted" }, caption),
  );
  return block;
}

function stat(value, label, small = false) {
  return h(
    "div",
    { class: "card stat" },
    h("strong", { class: small ? "small" : "" }, String(value)),
    h("span", {}, label),
  );
}

function section(title, content) {
  return h("section", { class: "card block" }, h("h2", {}, title), content);
}

function empty(text) {
  return h("p", { class: "empty muted" }, text);
}

// Pochette d'un projet à partir de son lien Spotify (oEmbed officiel, sans clé).
// La fausse pochette reste affichée tant que l'image n'est pas chargée, ou si ça échoue.
async function loadSpotifyCover(p, placeholder) {
  if (!/^https:\/\/open\.spotify\.com\//.test(p.lien ?? "")) return;
  const key = `underspace-cover:${p.lien}`;
  let url = null;
  try {
    url = localStorage.getItem(key);
  } catch {}
  if (!url) {
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(p.lien)}`);
      url = (await res.json()).thumbnail_url;
      if (url) localStorage.setItem(key, url);
    } catch {}
  }
  if (!url) return;
  const img = h("img", { class: "cover", src: url, alt: `Pochette de ${p.titre}` });
  img.addEventListener("load", () => placeholder.replaceWith(img), { once: true });
}

function projectCard(p, a) {
  const initials = p.titre
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const cover = p.cover
    ? h("img", {
        class: "cover",
        src: p.cover,
        alt: `Pochette de ${p.titre}`,
        loading: "lazy",
      })
    : h(
        "div",
        {
          class: "cover cover-fallback",
          style: `--seed:${(p.titre.length * 37) % 360}deg`,
        },
        h("span", {}, initials),
      );
  // Pas de pochette renseignée ? On récupère la vraie via le service officiel de Spotify.
  if (!p.cover) loadSpotifyCover(p, cover);
  const infos = [p.type, p.annee, p.titres && `${p.titres} titres`]
    .filter(Boolean)
    .join(" · ");
  const body = h(
    "div",
    { class: "project-body" },
    h("h3", {}, p.titre),
    h("p", { class: "muted" }, infos),
  );
  return p.lien
    ? h(
        "a",
        {
          class: "project",
          href: p.lien,
          target: "_blank",
          rel: "noopener",
          title: `Écouter ${p.titre} (${a.nom})`,
        },
        cover,
        body,
      )
    : h("div", { class: "project" }, cover, body);
}

function singleRow(s) {
  const feats = (s.featurings ?? []).map((name, i, arr) => {
    const other = byName.get(norm(name));
    const node = other ? h("a", { href: pageUrl(other) }, name) : name;
    return i < arr.length - 1 ? [node, ", "] : [node];
  });
  return h(
    "li",
    { class: "single" },
    h("span", { class: "year" }, s.annee ?? "—"),
    h(
      "span",
      { class: "single-title" },
      s.titre,
      feats.length
        ? h("span", { class: "feat muted" }, " feat. ", feats.flat())
        : null,
    ),
    s.lien
      ? h(
          "a",
          {
            class: "btn btn-small",
            href: s.lien,
            target: "_blank",
            rel: "noopener",
          },
          "Écouter",
        )
      : h("span"),
  );
}

// --- Planète 3D qui tourne dans l'en-tête ---
// --- « Déjà écouté » + raison de la recommandation ---
function persoBlock(a) {
  if (a.id === "exemple") return null;
  const reco = perso.recoOf.get(a.id);
  const src = perso.ecoutes.get(a.id);
  const btn = h("button", { class: "btn btn-ecoute", type: "button" });
  const paint = (state) => {
    btn.classList.toggle("on", !!state);
    btn.disabled = state === "deezer";
    btn.textContent =
      state === "deezer"
        ? "✅ Dans tes favoris Deezer"
        : state
          ? "✅ Déjà écouté"
          : "☐ Je connais déjà";
    btn.title =
      state === "deezer"
        ? "Détecté automatiquement depuis ton profil Deezer"
        : "Coche si tu as déjà écouté cet artiste (enregistré dans ce navigateur)";
  };
  paint(src);
  btn.addEventListener("click", () => paint(toggleManuel(a.id) ? "manuel" : null));
  return h(
    "div",
    { class: "perso-block" },
    btn,
    !src && reco
      ? h("p", { class: "perso-reco" }, `🧭 Recommandé pour toi : ${reco.raisons.join(" · ")}`)
      : null,
  );
}

function heroPlanet(canvas, a) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const planet = createPlanet(a);
  planet.remove(planet.userData.labelObj);
  scene.add(planet);
  const r = planet.userData.radius;
  const ext = a.planete.anneaux
    ? 2.3
    : a.planete.type === "etoile"
      ? 1.6
      : 1.15;
  camera.position.z = (r * ext) / Math.tan(THREE.MathUtils.degToRad(15));

  const resize = () => {
    const s = canvas.clientWidth;
    renderer.setSize(s, s, false);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // On peut faire tourner la planète à la souris.
  let drag = null;
  let spinBoost = 0;
  canvas.addEventListener("pointerdown", (e) => {
    drag = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag == null) return;
    spinBoost = (e.clientX - drag) * 0.01;
    planet.userData.mesh.rotation.y += spinBoost;
    drag = e.clientX;
  });
  canvas.addEventListener("pointerup", () => (drag = null));

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    spinBoost *= 0.95;
    if (drag == null)
      planet.userData.mesh.rotation.y +=
        planet.userData.spin * dt * 2 + spinBoost;
    planet.userData.material.uniforms.uTime.value = clock.elapsedTime;
    renderer.render(scene, camera);
  });
}
