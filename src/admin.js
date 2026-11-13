// Menu administrateur (local) : modifier, ajouter et supprimer des artistes et leurs planètes.
// Les modifications sont enregistrées dans src/data/rappeurs.json via le petit serveur
// de scripts/admin-plugin.js, qui n'existe que pendant `npm run dev`.
import { icon } from './icons.js';
import * as THREE from 'three';
import { createPlanet, TYPE_LABELS } from './planet.js';
import './style.css';
import './admin.css';

const TODAY = new Date().toISOString().slice(0, 10);
const TYPES = Object.keys(TYPE_LABELS);
const PALETTES = {
  toxique: ['#5b3a9e', '#8f63d9', '#c3a2ff'],
  lave: ['#7a1f24', '#d9452b', '#ffa04a'],
  gazeuse: ['#2f6fb5', '#5aa6e6', '#bfe6ff'],
  glace: ['#8fc6ec', '#c9e8fb', '#ffffff'],
  etoile: ['#ff8a00', '#ffc23d', '#fff1a8'],
  rocheuse: ['#6a3a5a', '#a35a86', '#e09ac0'],
  asteroide: ['#5e3a2a', '#8f5e42', '#b9845c'],
  continents: ['#3a7bd5', '#5cae3a', '#b4e05a'],
};

// --- Petits utilitaires -----------------------------------------------------------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's');
const slug = (s) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artiste';

function toast(msg, kind = 'ok') {
  const t = document.getElementById('ad-toast');
  t.textContent = msg;
  t.className = `ad-toast ${kind}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3500);
}

// --- État ----------------------------------------------------------------------------
let saved = []; // version enregistrée
let data = []; // copie de travail
let selectedId = sessionStorage.getItem('underspace-admin-selection');
let serverOk = false;

const dirty = () => JSON.stringify(saved) !== JSON.stringify(data);
const current = () => data.find((r) => r.id === selectedId);

function refreshTop() {
  const changed = dirty();
  const save = document.getElementById('ad-save');
  save.disabled = !changed || !serverOk;
  save.textContent = changed ? 'Enregistrer les modifications' : 'Enregistré ✓';
  document.getElementById('ad-undo').disabled = !changed;
  document.getElementById('ad-count').textContent = `${data.length} artistes`;
}

// --- Liste ---------------------------------------------------------------------------
function renderList() {
  const q = norm(document.getElementById('ad-search').value);
  const ul = document.getElementById('ad-list');
  const savedById = new Map(saved.map((r) => [r.id, JSON.stringify(r)]));
  ul.replaceChildren(
    ...data
      .filter((r) => norm(r.nom).includes(q))
      .map((r) => {
        const modified = savedById.get(r.id) !== JSON.stringify(r);
        const icons = [
          r.badges?.includes('coup-de-coeur') ? '❤️' : '',
          r.badges?.includes('pepite') ? '💎' : '',
          r.ajouteLe ? '✨' : '',
        ].join('');
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `ad-item${r.id === selectedId ? ' on' : ''}`,
              onclick: () => select(r.id),
            },
            h('span', { class: 'ad-swatch', style: `--c1:${r.planete.couleurs[0]};--c2:${r.planete.couleurs[2]}` }),
            h('span', { class: 'ad-item-name' }, r.nom),
            icons ? h('span', { class: 'ad-item-icons' }, icons) : null,
            modified ? h('span', { class: 'ad-dot', title: 'Modifié, pas encore enregistré' }) : null,
          ),
        );
      }),
  );
}

function select(id) {
  selectedId = id;
  sessionStorage.setItem('underspace-admin-selection', id ?? '');
  renderList();
  renderEditor();
}

// Toute modification passe par ici : met à jour la copie de travail et l'aperçu.
function change(fn, { rerender = false } = {}) {
  const r = current();
  if (!r) return;
  fn(r);
  refreshTop();
  renderList();
  if (rerender) renderEditor();
  else updatePreview();
}

// --- Éditeur -------------------------------------------------------------------------
function field(label, input, help) {
  return h('label', { class: 'ad-field' }, h('span', {}, label), input, help ? h('small', { class: 'muted' }, help) : null);
}
function text(value, onInput, attrs = {}) {
  return h('input', { type: 'text', value: value ?? '', oninput: (e) => onInput(e.target.value), ...attrs });
}
function range(value, min, max, step, onInput, fmt = (v) => v) {
  const out = h('output', {}, fmt(value));
  const input = h('input', {
    type: 'range',
    min,
    max,
    step,
    value,
    oninput: (e) => {
      out.textContent = fmt(Number(e.target.value));
      onInput(Number(e.target.value));
    },
  });
  return h('div', { class: 'ad-range' }, input, out);
}
function color(value, onInput) {
  return h('input', { type: 'color', value, oninput: (e) => onInput(e.target.value) });
}
const setOrDelete = (obj, key, v) => {
  if (v === '' || v == null) delete obj[key];
  else obj[key] = v;
};

let preview = null;

function renderEditor() {
  const ed = document.getElementById('ad-editor');
  const r = current();
  if (!r) {
    ed.replaceChildren(h('div', { class: 'card ad-empty' }, h('p', { class: 'muted' }, '← Choisis un artiste dans la liste, ou ajoute-en un.')));
    preview?.dispose();
    preview = null;
    return;
  }
  const p = r.planete;
  const badges = new Set(r.badges ?? []);
  const toggleBadge = (id, on) =>
    change((a) => {
      const s = new Set(a.badges ?? []);
      on ? s.add(id) : s.delete(id);
      if (s.size) a.badges = [...s];
      else delete a.badges;
    });

  // --- Identité ---
  const identite = h(
    'section',
    { class: 'card ad-card' },
    h('h2', {}, 'Identité'),
    h(
      'div',
      { class: 'ad-grid' },
      field('Nom', text(r.nom, (v) => change((a) => (a.nom = v)))),
      field('Identifiant (adresse de la page)', h('input', { type: 'text', value: r.id, disabled: true }), 'Fixé à la création.'),
      field('Ville', text(r.ville, (v) => change((a) => setOrDelete(a, 'ville', v.trim())))),
      field('Collectif / label', text(r.collectif, (v) => change((a) => setOrDelete(a, 'collectif', v.trim())))),
      field(
        'Styles (tags)',
        text((r.tags ?? []).join(', '), (v) =>
          change((a) => (a.tags = v.split(',').map((t) => t.trim()).filter(Boolean))),
        ),
        'Séparés par des virgules : trap, cloud, drill…',
      ),
      field(
        'Lien Spotify (profil artiste)',
        text(r.liens?.spotify, (v) =>
          change((a) => {
            a.liens ??= {};
            setOrDelete(a.liens, 'spotify', v.trim());
            if (!Object.keys(a.liens).length) delete a.liens;
          }),
        ),
        'Sert au lecteur de la page artiste.',
      ),
    ),
    field(
      'Résumé',
      h('textarea', { rows: 4, value: r.description ?? '', oninput: (e) => change((a) => (a.description = e.target.value)) }),
    ),
  );

  // --- Badges ---
  const nouveau = h(
    'div',
    { class: 'ad-nouveau' },
    h('label', { class: 'ad-check' }, h('input', { type: 'checkbox', checked: !!r.ajouteLe, onchange: (e) => change((a) => (e.target.checked ? (a.ajouteLe = TODAY) : delete a.ajouteLe), { rerender: true }) }), '✨ Nouveau'),
    r.ajouteLe
      ? h(
          'span',
          { class: 'muted' },
          ' depuis le ',
          h('input', { type: 'date', value: r.ajouteLe, onchange: (e) => change((a) => (a.ajouteLe = e.target.value)) }),
          ' (affiché 30 jours)',
        )
      : h('span', { class: 'muted' }, ' — non affiché'),
  );
  const badgesCard = h(
    'section',
    { class: 'card ad-card' },
    h('h2', {}, 'Badges'),
    h(
      'div',
      { class: 'ad-badges' },
      h('label', { class: 'ad-check' }, h('input', { type: 'checkbox', checked: badges.has('coup-de-coeur'), onchange: (e) => toggleBadge('coup-de-coeur', e.target.checked) }), '❤️ Coup de cœur'),
      h('label', { class: 'ad-check' }, h('input', { type: 'checkbox', checked: badges.has('pepite'), onchange: (e) => toggleBadge('pepite', e.target.checked) }), '💎 Pépite'),
      nouveau,
    ),
    h('p', { class: 'muted small' }, '« Nouvelle sortie » s’affiche tout seul selon la date des sorties.'),
  );

  // --- Planète ---
  const canvas = h('canvas', { class: 'ad-preview' });
  const planete = h(
    'section',
    { class: 'card ad-card ad-planet' },
    h('h2', {}, 'Planète'),
    h(
      'div',
      { class: 'ad-planet-body' },
      h('div', { class: 'ad-preview-wrap' }, canvas, h('p', { class: 'muted small' }, 'Aperçu en direct')),
      h(
        'div',
        { class: 'ad-grid ad-planet-fields' },
        field(
          'Type',
          h(
            'select',
            {
              onchange: (e) =>
                change(
                  (a) => {
                    a.planete.type = e.target.value;
                    if (confirm('Appliquer aussi les couleurs typiques de ce type ?')) a.planete.couleurs = [...PALETTES[e.target.value]];
                    if (a.planete.type === 'etoile') delete a.planete.anneaux;
                  },
                  { rerender: true },
                ),
            },
            TYPES.map((t) => h('option', { value: t, selected: t === p.type }, TYPE_LABELS[t])),
          ),
        ),
        field(
          'Couleurs (base · secondaire · accent)',
          h('div', { class: 'ad-colors' }, [0, 1, 2].map((i) => color(p.couleurs[i], (v) => change((a) => (a.planete.couleurs[i] = v))))),
        ),
        field('Liseré lumineux', h('div', { class: 'ad-colors' }, color(p.atmosphere ?? p.couleurs[2], (v) => change((a) => (a.planete.atmosphere = v))))),
        field(
          'Anneaux',
          h(
            'div',
            { class: 'ad-colors' },
            h('label', { class: 'ad-check' }, h('input', { type: 'checkbox', checked: !!p.anneaux, disabled: p.type === 'etoile', onchange: (e) => change((a) => (e.target.checked ? (a.planete.anneaux = a.planete.couleurs[2]) : delete a.planete.anneaux), { rerender: true }) }), 'avec anneaux'),
            p.anneaux ? color(p.anneaux, (v) => change((a) => (a.planete.anneaux = v))) : null,
          ),
        ),
        field('Taille', range(p.taille ?? 3, 2, 6, 0.1, (v) => change((a) => (a.planete.taille = v)), (v) => v.toFixed(1))),
        field('Relief (grandes formes ↔ détails)', range(p.relief ?? 2, 1, 4, 0.1, (v) => change((a) => (a.planete.relief = v)), (v) => v.toFixed(1))),
        field('Vitesse de rotation', range(p.vitesse ?? 1, 0, 3, 0.1, (v) => change((a) => (a.planete.vitesse = v)), (v) => (v === 0 ? 'immobile' : `×${v.toFixed(1)}`))),
        field('Rayon de déplacement', range(p.deplacement ?? 1, 0, 3, 0.1, (v) => change((a) => (a.planete.deplacement = v)), (v) => (v === 0 ? 'fixe' : `×${v.toFixed(1)}`)), 'Distance à laquelle la planète flotte autour de sa place.'),
      ),
    ),
  );

  // --- Zone dangereuse ---
  const danger = h(
    'section',
    { class: 'card ad-card ad-danger' },
    h('div', {}, h('h2', {}, 'Supprimer'), h('p', { class: 'muted small' }, 'Retire l’artiste de la galaxie (une sauvegarde est gardée à chaque enregistrement).')),
    h(
      'button',
      {
        type: 'button',
        class: 'ad-delete',
        onclick: () => {
          if (!confirm(`Supprimer « ${r.nom} » de UnderSpace ?\nLa suppression ne sera définitive qu’après « Enregistrer ».`)) return;
          const i = data.findIndex((a) => a.id === r.id);
          data.splice(i, 1);
          select(data[Math.min(i, data.length - 1)]?.id ?? null);
          refreshTop();
          toast(`« ${r.nom} » supprimé — pense à enregistrer.`, 'warn');
        },
      },
      icon('trash'), ' Supprimer cet artiste',
    ),
  );

  ed.replaceChildren(
    h(
      'div',
      { class: 'ad-editor-head' },
      h('h1', {}, r.nom || 'Sans nom'),
      h('a', { class: 'btn', href: `artiste.html?id=${encodeURIComponent(r.id)}`, target: '_blank' }, 'Voir la page ↗'),
    ),
    identite,
    badgesCard,
    planete,
    danger,
  );

  preview?.dispose();
  preview = createPreview(canvas);
  updatePreview();
}

// --- Aperçu 3D de la planète --------------------------------------------------------
function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  let planet = null;
  let alive = true;
  const clock = new THREE.Clock();
  const resize = () => renderer.setSize(canvas.clientWidth, canvas.clientWidth, false);
  resize();
  function loop() {
    if (!alive) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (planet) {
      planet.userData.mesh.rotation.y += planet.userData.spin * dt * 2;
      planet.userData.material.uniforms.uTime.value = clock.elapsedTime;
      // la planète flotte comme dans la galaxie, selon le « rayon de déplacement »
      const amp = 0.35 * planet.userData.radius * planet.userData.deplacement;
      planet.position.set(Math.sin(clock.elapsedTime * 0.6) * amp, Math.cos(clock.elapsedTime * 0.45) * amp * 0.6, 0);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return {
    set(r) {
      if (planet) scene.remove(planet);
      planet = createPlanet(r);
      planet.remove(planet.userData.labelObj);
      scene.add(planet);
      const ext = r.planete.anneaux ? 2.4 : r.planete.type === 'etoile' ? 1.8 : 1.5;
      camera.position.z = (planet.userData.radius * ext) / Math.tan(THREE.MathUtils.degToRad(15)) + 4;
    },
    dispose() {
      alive = false;
      renderer.dispose();
    },
  };
}
let previewTimer = 0;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => current() && preview?.set(clone(current())), 60);
}

// --- Ajout d'un artiste ---------------------------------------------------------------
function openAdd() {
  const dialog = document.getElementById('ad-add-dialog');
  const nom = h('input', { type: 'text', class: 'connect-input', placeholder: 'Nom de l’artiste', required: true });
  const spotify = h('input', { type: 'text', class: 'connect-input', placeholder: 'https://open.spotify.com/artist/… (optionnel)' });
  const status = h('p', { class: 'connect-status' });
  dialog.replaceChildren(
    h(
      'form',
      {
        method: 'dialog',
        onsubmit: (e) => {
          e.preventDefault();
          const n = nom.value.trim();
          if (!n) return;
          if (data.some((a) => norm(a.nom) === norm(n))) {
            status.textContent = 'Cet artiste existe déjà.';
            status.classList.add('error');
            return;
          }
          let id = slug(n);
          for (let k = 2; data.some((a) => a.id === id); k++) id = `${slug(n)}-${k}`;
          const type = TYPES[Math.floor(Math.random() * TYPES.length)];
          const artiste = {
            id,
            nom: n,
            ajouteLe: TODAY,
            description: '',
            tags: [],
            ...(spotify.value.trim() ? { liens: { spotify: spotify.value.trim() } } : {}),
            planete: { type, couleurs: [...PALETTES[type]], taille: 3.5, relief: 1.6, atmosphere: PALETTES[type][2] },
          };
          data.push(artiste);
          dialog.close();
          select(id);
          refreshTop();
          toast(`« ${n} » ajouté — personnalise sa planète puis enregistre.`);
        },
      },
      h('h2', {}, 'Ajouter un artiste'),
      h('p', { class: 'connect-help' }, 'Une planète au hasard lui est donnée : tu pourras la modifier juste après. Le badge « Nouveau » est activé automatiquement.'),
      nom,
      h('div', { style: 'height:10px' }),
      spotify,
      status,
      h('div', { class: 'connect-actions' }, h('button', { type: 'button', onclick: () => dialog.close() }, 'Annuler'), h('button', { type: 'submit', class: 'connect-go' }, 'Ajouter')),
      h('p', { class: 'connect-note' }, 'Ses projets, singles et « artistes proches » pourront être complétés ensuite (les liens de recommandation sont recalculés automatiquement à l’enregistrement).'),
    ),
  );
  dialog.showModal();
  nom.focus();
}

// --- Enregistrement ---------------------------------------------------------------------
async function save() {
  const btn = document.getElementById('ad-save');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';
  try {
    const res = await fetch('/__admin/rappeurs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'Erreur');
    saved = clone(data);
    refreshTop();
    renderList();
    toast(out.nouveaux?.length ? `Enregistré ✓ — liens calculés pour ${out.nouveaux.length} nouvel(s) artiste(s).` : 'Enregistré ✓ — la galaxie est à jour.');
  } catch (e) {
    toast(`Impossible d’enregistrer : ${e.message}`, 'error');
    refreshTop();
  }
}

// --- Démarrage ---------------------------------------------------------------------------
async function init() {
  const pill = document.getElementById('ad-server');
  try {
    serverOk = (await fetch('/__admin/ping').then((r) => r.json())).ok === true;
  } catch {
    serverOk = false;
  }
  pill.textContent = serverOk ? '● Enregistrement local actif' : '● Lecture seule : lance « npm run dev » pour enregistrer';
  pill.classList.toggle('ok', serverOk);

  saved = await fetch('/src/data/rappeurs.json', { cache: 'no-store' }).then((r) => r.json());
  data = clone(saved);
  if (!data.some((r) => r.id === selectedId)) selectedId = data[0]?.id ?? null;

  document.getElementById('ad-search').addEventListener('input', renderList);
  document.getElementById('ad-add').addEventListener('click', openAdd);
  document.getElementById('ad-save').addEventListener('click', save);
  document.getElementById('ad-undo').addEventListener('click', () => {
    if (!confirm('Annuler toutes les modifications non enregistrées ?')) return;
    data = clone(saved);
    if (!data.some((r) => r.id === selectedId)) selectedId = data[0]?.id ?? null;
    refreshTop();
    renderList();
    renderEditor();
  });
  document.getElementById('ad-clear-new').addEventListener('click', () => {
    const n = data.filter((r) => r.ajouteLe).length;
    if (!n) return toast('Aucun artiste n’a le badge « Nouveau ».');
    if (!confirm(`Retirer le badge « Nouveau » des ${n} artistes qui l’ont ?`)) return;
    for (const r of data) delete r.ajouteLe;
    refreshTop();
    renderList();
    renderEditor();
    toast(`Badge « Nouveau » retiré de ${n} artistes — pense à enregistrer.`, 'warn');
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (dirty() && serverOk) save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty()) e.preventDefault();
  });

  refreshTop();
  renderList();
  renderEditor();
}

init();
