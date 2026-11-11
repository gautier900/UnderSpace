import { TYPE_LABELS } from "./planet.js";
import { BADGES, badgesOf } from "./data/badges.js";
import { perso } from "./perso.js";

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\$/g, "s")
    .replace(/[\s._'!-]+/g, "");

export function setupUI({ rappeurs, onSelect, onOverview, onClose, onFilter }) {
  const input = document.getElementById("search");
  const list = document.getElementById("results");
  const filtersEl = document.getElementById("filters");
  const panel = document.getElementById("panel");
  let current = [];
  let active = 0;
  let filter = null; // { kind: 'badge' | 'tag', id, label }

  // --- Filtre par badge / tag ---------------------------------------------
  const badgeIds = new Map(
    rappeurs.map((r) => [r.id, new Set(badgesOf(r).map((b) => b.id))]),
  );
  const matches = (r) => {
    if (!filter) return true;
    if (filter.kind === "badge") return badgeIds.get(r.id).has(filter.id);
    return (r.tags ?? []).some((t) => norm(t) === norm(filter.id));
  };

  const countFor = (o) => {
    const prev = filter;
    filter = o;
    const n = rappeurs.filter(matches).length;
    filter = prev;
    return n;
  };
  const isOn = (o) => filter?.kind === o.kind && filter?.id === o.id;

  function chip(o, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.style.setProperty("--chip", o.couleur);
    btn.disabled = count === 0;
    btn.title =
      count === 0
        ? "Aucun artiste avec ce badge pour l’instant"
        : `${count} artiste${count > 1 ? "s" : ""}`;
    btn.append(
      o.label,
      Object.assign(document.createElement("span"), { className: "chip-count", textContent: count }),
    );
    btn.classList.toggle("on", isOn(o));
    btn.addEventListener("click", () => {
      closeStyles();
      setFilter(isOn(o) ? null : o);
    });
    return btn;
  }

  // Les styles (tags libres) : regroupés dans un menu déroulant pour ne pas envahir l'écran.
  const tagOptions = (() => {
    const tags = new Map();
    for (const r of rappeurs) for (const t of r.tags ?? []) if (!tags.has(norm(t))) tags.set(norm(t), t);
    return [...tags.values()]
      .map((t) => ({ kind: "tag", id: t, label: `# ${t}`, couleur: "#a9a4cf" }))
      .map((o) => ({ o, n: countFor(o) }))
      .sort((a, b) => b.n - a.n || a.o.id.localeCompare(b.o.id, "fr"));
  })();

  const stylesPanel = document.createElement("div");
  stylesPanel.className = "styles-panel";
  stylesPanel.hidden = true;
  const stylesSearch = Object.assign(document.createElement("input"), {
    type: "text",
    className: "styles-search",
    placeholder: "Chercher un style…",
    autocomplete: "off",
  });
  const stylesList = document.createElement("div");
  stylesList.className = "styles-list";
  stylesPanel.append(stylesSearch, stylesList);
  filtersEl.after(stylesPanel);

  function renderStyles() {
    const q = norm(stylesSearch.value);
    const items = tagOptions.filter(({ o }) => norm(o.id).includes(q));
    stylesList.replaceChildren(
      ...(items.length
        ? items.map(({ o, n }) => chip(o, n))
        : [Object.assign(document.createElement("p"), { className: "styles-empty", textContent: "Aucun style trouvé" })]),
    );
  }
  function openStyles() {
    list.hidden = true;
    stylesPanel.hidden = false;
    stylesSearch.value = "";
    renderStyles();
    stylesSearch.focus();
    buildFilters();
  }
  function closeStyles() {
    if (stylesPanel.hidden) return;
    stylesPanel.hidden = true;
    buildFilters();
  }
  stylesSearch.addEventListener("input", renderStyles);
  stylesSearch.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStyles();
    if (e.key === "Enter") stylesList.querySelector(".chip:not(:disabled)")?.click();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!stylesPanel.hidden && !stylesPanel.contains(e.target) && !filtersEl.contains(e.target)) closeStyles();
  });

  function buildFilters() {
    const badges = Object.entries(BADGES)
      .filter(([, b]) => !b.perso || perso.connecte || perso.ecoutes.size)
      .map(([id, b]) => ({
      kind: "badge",
      id,
      label: `${b.icone} ${b.label}`,
      couleur: b.couleur,
    }));
    const children = badges.map((o) => chip(o, countFor(o)));

    if (tagOptions.length) {
      const tagActive = filter?.kind === "tag";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "chip chip-styles";
      toggle.style.setProperty("--chip", "#a9a4cf");
      toggle.classList.toggle("on", tagActive);
      toggle.classList.toggle("open", !stylesPanel.hidden);
      toggle.setAttribute("aria-expanded", String(!stylesPanel.hidden));
      toggle.append(
        tagActive ? filter.label : "# Styles",
        Object.assign(document.createElement("span"), {
          className: "chip-count",
          textContent: tagActive ? "✕" : stylesPanel.hidden ? "▾" : "▴",
        }),
      );
      toggle.title = tagActive ? "Retirer ce filtre" : `${tagOptions.length} styles`;
      toggle.addEventListener("click", () => {
        if (tagActive) setFilter(null);
        else if (stylesPanel.hidden) openStyles();
        else closeStyles();
      });
      children.push(toggle);
    }
    filtersEl.replaceChildren(...children);
  }

  function setFilter(f) {
    filter = f;
    buildFilters();
    onFilter?.(
      filter ? new Set(rappeurs.filter(matches).map((r) => r.id)) : null,
    );
    if (filter) {
      input.placeholder = `Rechercher parmi : ${filter.label}`;
      input.focus();
      renderResults();
    } else {
      input.placeholder = "Rechercher un rappeur…   ( / )";
      list.hidden = true;
    }
  }

  // --- Recherche -----------------------------------------------------------
  function renderResults() {
    const q = norm(input.value);
    list.replaceChildren();
    if (!q && !filter) {
      list.hidden = true;
      return;
    }
    current = rappeurs.filter((r) => matches(r) && norm(r.nom).includes(q));
    if (!filter) current = current.slice(0, 8);
    active = 0;
    if (!current.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = filter
        ? "Aucun rappeur avec ce filtre"
        : "Aucun rappeur trouvé";
      list.append(li);
    }
    current.forEach((r, i) => {
      const li = document.createElement("li");
      li.textContent = r.nom;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = r.planete.couleurs[2];
      li.prepend(swatch);
      const icons = badgesOf(r)
        .map((b) => b.icone)
        .join("");
      if (icons)
        li.append(
          Object.assign(document.createElement("span"), {
            className: "result-badges",
            textContent: icons,
          }),
        );
      if (i === active) li.classList.add("active");
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(r);
      });
      list.append(li);
    });
    list.hidden = false;
  }

  function highlight() {
    [...list.children].forEach((li, i) =>
      li.classList.toggle("active", i === active),
    );
    list.children[active]?.scrollIntoView({ block: "nearest" });
  }

  function choose(r) {
    if (!r) return;
    input.value = "";
    list.hidden = true;
    input.blur();
    onSelect(r.id);
  }

  input.addEventListener("input", renderResults);
  input.addEventListener("focus", () => filter && renderResults());
  input.addEventListener("blur", () =>
    setTimeout(() => (list.hidden = true), 100),
  );
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      active = Math.min(active + 1, current.length - 1);
      highlight();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      active = Math.max(active - 1, 0);
      highlight();
      e.preventDefault();
    } else if (e.key === "Enter") {
      choose(current[active]);
    } else if (e.key === "Escape") {
      input.value = "";
      list.hidden = true;
      input.blur();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    } else if (e.key === "Escape" && document.activeElement !== input) {
      hidePanel();
      onClose?.();
    }
  });

  document.getElementById("overview").addEventListener("click", () => {
    hidePanel();
    onOverview();
  });
  document.getElementById("panel-close").addEventListener("click", () => {
    hidePanel();
    onClose?.();
  });

  // --- Fiche ---------------------------------------------------------------
  function showPanel(r) {
    document.getElementById("panel-type").textContent =
      TYPE_LABELS[r.planete.type] ?? "";
    document.getElementById("panel-name").textContent = r.nom;
    const desc = document.getElementById("panel-desc");
    desc.textContent =
      r.description ||
      "Pas encore de description. Ajoute-la dans src/data/rappeurs.json.";
    desc.classList.toggle("muted", !r.description);
    const tags = document.getElementById("panel-tags");
    tags.replaceChildren(
      ...r.tags.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }),
    );
    document.getElementById("panel-badges").replaceChildren(
      ...badgesOf(r).map((b) => {
        const li = document.createElement("li");
        li.textContent = `${b.icone} ${b.label}`;
        li.style.setProperty("--badge", b.couleur);
        return li;
      }),
    );
    // Infos personnelles : pourquoi cet artiste est recommandé, ou déjà écouté.
    const persoEl = document.getElementById("panel-perso");
    const reco = perso.recoOf.get(r.id);
    const ecoute = perso.ecoutes.get(r.id);
    // (l'info « déjà écouté » est déjà donnée par le badge ✅, pas besoin de capsule)
    persoEl.hidden = !reco || !!ecoute;
    persoEl.textContent = reco && !ecoute ? `🧭 Pour toi : ${reco.raisons.join(" · ")}` : "";
    document.getElementById("panel-link").href =
      `artiste.html?id=${encodeURIComponent(r.id)}`;
    panel.style.setProperty("--accent", r.planete.couleurs[2]);
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  function hidePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  buildFilters();
  return { showPanel, hidePanel };
}
