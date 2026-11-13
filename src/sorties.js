// « La galaxie des sorties » : les artistes qui ont sorti un projet ou un single récemment
// gravitent autour d'une étoile, avec leurs pochettes en lunes. Les plus récents sont au plus près.
import { icon } from './icons.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { rappeurs } from './data/rappeurs.js';
import { createPlanet } from './planet.js';
import { createStarfield, createNebula } from './space.js';

const PERIODES = { 7: '7 derniers jours', 30: '30 derniers jours' };
const PLANET_SCALE = 0.55;
const byId = new Map(rappeurs.map((r) => [r.id, r]));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

// Dates en heure locale (« 2026-11-06 » = le 6 novembre chez toi, pas en UTC).
const jour = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const auj = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const DAY = 86400000;
const fmtJour = (iso) => {
  const diff = Math.round((auj() - jour(iso)) / DAY);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff === -1) return 'Demain';
  return jour(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Toutes les sorties datées : { r, s, kind: 'Single' | type du projet, date }
function toutesSorties() {
  const out = [];
  for (const r of rappeurs) {
    for (const s of r.projets ?? []) if (s.date) out.push({ r, s, kind: s.type ?? 'Projet', date: s.date });
    for (const s of r.singles ?? []) if (s.date) out.push({ r, s, kind: 'Single', date: s.date });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// Pochette : celle des données, sinon celle de Spotify (service oEmbed officiel), sinon rien.
async function pochette(s) {
  if (s.cover) return s.cover;
  if (!/^https:\/\/open\.spotify\.com\//.test(s.lien ?? '')) return null;
  const key = `underspace-cover:${s.lien}`;
  try {
    const c = localStorage.getItem(key);
    if (c) return c;
  } catch {}
  try {
    const url = (await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(s.lien)}`).then((r) => r.json())).thumbnail_url;
    if (url) localStorage.setItem(key, url);
    return url ?? null;
  } catch {
    return null;
  }
}
function coverEl(s, cls) {
  const el = h('span', { class: `${cls} so-nocover` }, '♪');
  pochette(s).then((url) => {
    if (!url) return;
    const img = h('img', { src: url, alt: '' });
    img.addEventListener('load', () => {
      el.classList.remove('so-nocover');
      el.replaceChildren(img);
    });
  });
  return el;
}

// --- Scène 3D -----------------------------------------------------------------------------
function createScene(container, groupes, onPick) {
  const W = () => container.clientWidth;
  const H = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'labels mg-labels';
  container.append(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 14;
  controls.maxDistance = 260;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const nebula = createNebula();
  const stars = createStarfield(5000);
  scene.add(nebula, stars);
  const system = new THREE.Group();
  system.rotation.x = 0.12;
  scene.add(system);

  // étoile centrale : « la semaine »
  const sun = createPlanet({ id: 'sorties', nom: 'Sorties', planete: { type: 'etoile', couleurs: ['#ff5a1f', '#ffa040', '#fff0c0'], taille: 5.5, relief: 3 } });
  sun.remove(sun.userData.labelObj);
  system.add(sun);

  const n = groupes.length;
  const pas = n > 16 ? 1.9 : 2.6;
  const bodies = [];
  const planets = [];
  const moons = [];
  groupes.forEach((g, i) => {
    const p = createPlanet(g.r);
    p.scale.setScalar(PLANET_SCALE);
    p.userData.rid = g.r.id;
    p.userData.mesh.userData.group = p;
    const label = p.userData.label;
    label.classList.add('mg-label');
    label.addEventListener('click', (e) => (e.stopPropagation(), onPick(g.r.id)));
    system.add(p);
    planets.push(p);
    const radius = 12 + i * pas;
    bodies.push({ obj: p, radius, angle: i * 2.39996, speed: 2.2 / Math.pow(radius, 1.15), y: Math.sin(i * 2.3) * 0.8 });
    // pochettes en lunes autour de la planète
    g.sorties.slice(0, 4).forEach((x, k) => {
      const el = coverEl(x.s, 'so-moon');
      el.title = `${x.s.titre} — ${x.kind}`;
      el.addEventListener('click', () => onPick(g.r.id));
      const obj = new CSS2DObject(el);
      system.add(obj);
      moons.push({ obj, host: p, angle: (k / Math.min(g.sorties.length, 4)) * Math.PI * 2, dist: p.userData.radius * PLANET_SCALE + 2.2 });
    });
  });

  // clic sur une planète
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let down = null;
  const toPtr = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObjects(planets.map((p) => p.userData.mesh), false)[0]?.object.userData.group;
  };
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const g = toPtr(e);
    if (g) onPick(g.userData.rid);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const g = toPtr(e);
    renderer.domElement.style.cursor = g ? 'pointer' : 'grab';
    controls.autoRotate = !g;
  });

  const far = 12 + Math.max(n - 1, 0) * pas;
  camera.position.set(0, far * 0.75 + 30, far * 1.25 + 40);
  const clock = new THREE.Clock();
  let running = false;
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    for (const b of bodies) {
      b.angle += b.speed * dt;
      b.obj.position.set(Math.cos(b.angle) * b.radius, b.y + Math.sin(t * 0.6 + b.angle) * 0.4, Math.sin(b.angle) * b.radius);
    }
    for (const m of moons) {
      m.angle += dt * 0.8;
      m.obj.position.set(m.host.position.x + Math.cos(m.angle) * m.dist, m.host.position.y + 0.6, m.host.position.z + Math.sin(m.angle) * m.dist);
    }
    for (const g of [sun, ...planets]) {
      g.userData.mesh.rotation.y += g.userData.spin * dt;
      g.userData.material.uniforms.uTime.value = t;
    }
    stars.material.uniforms.uTime.value = t;
    stars.position.copy(camera.position);
    nebula.position.copy(camera.position);
    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function resize() {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
    composer.setSize(W(), H());
    bloom.setSize(W(), H());
    labelRenderer.setSize(W(), H());
  }
  const onResize = () => running && resize();
  window.addEventListener('resize', onResize);
  return {
    start() {
      running = true;
      resize();
      clock.getDelta();
      requestAnimationFrame(frame);
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}

// --- Interface ----------------------------------------------------------------------------
export function setupSorties({ onSelect, onPause = () => {} }) {
  const btn = document.getElementById('sorties-btn');
  const overlay = document.getElementById('sorties');
  const card = document.getElementById('so-card');
  const pick = document.getElementById('so-pick');
  const sceneEl = document.getElementById('so-scene');
  let periode = 7;
  let scene3d = null;

  function donnees() {
    const today = auj();
    const debut = new Date(today - (periode - 1) * DAY);
    const all = toutesSorties();
    const recentes = all.filter((x) => jour(x.date) <= today && jour(x.date) >= debut);
    const bientot = all.filter((x) => jour(x.date) > today && jour(x.date) <= new Date(+today + 30 * DAY)).reverse();
    // regroupées par artiste, l'artiste à la sortie la plus récente en premier
    const parArtiste = new Map();
    for (const x of recentes) {
      if (!parArtiste.has(x.r.id)) parArtiste.set(x.r.id, { r: x.r, sorties: [] });
      parArtiste.get(x.r.id).sorties.push(x);
    }
    return { recentes, bientot, groupes: [...parArtiste.values()] };
  }

  function releaseRow(x) {
    return h(
      'button',
      { type: 'button', class: 'so-row', onclick: () => showPick(x.r.id) },
      coverEl(x.s, 'so-cover'),
      h('span', { class: 'so-row-text' }, h('strong', {}, x.s.titre), h('small', {}, `${x.r.nom} · ${x.kind}`)),
    );
  }

  function renderCard(d) {
    const parJour = new Map();
    for (const x of d.recentes) {
      if (!parJour.has(x.date)) parJour.set(x.date, []);
      parJour.get(x.date).push(x);
    }
    card.replaceChildren(
      ...[
        h(
          'div',
          { class: 'gx-head' },
          h('div', {}, h('h2', {}, 'Sorties'), h('p', { class: 'muted' }, `${d.recentes.length} sortie${d.recentes.length > 1 ? 's' : ''} · ${d.groupes.length} artiste${d.groupes.length > 1 ? 's' : ''} · ${PERIODES[periode]}`)),
        ),
        d.recentes.length
          ? [...parJour].map(([date, list]) => h('section', { class: 'gx-section' }, h('h3', { class: 'so-day' }, fmtJour(date)), list.map(releaseRow)))
          : h('p', { class: 'muted' }, 'Aucune sortie sur cette période. Essaie « 30 jours », ou lance « npm run maj » pour récupérer les dernières sorties.'),
        d.bientot.length
          ? h('section', { class: 'gx-section' }, h('h3', {}, 'Bientôt'), d.bientot.map((x) => h('div', { class: 'so-soon' }, releaseRow(x), h('small', { class: 'muted' }, fmtJour(x.date)))))
          : null,
      ].flat().filter(Boolean),
    );
  }

  function showPick(rid) {
    const r = byId.get(rid);
    const d = donnees();
    const list = (d.groupes.find((g) => g.r.id === rid)?.sorties ?? []).concat(d.bientot.filter((x) => x.r.id === rid));
    pick.style.setProperty('--accent', r.planete.couleurs[2]);
    pick.replaceChildren(
      ...[
        h('button', { class: 'gx-close', type: 'button', 'aria-label': 'Fermer', onclick: () => (pick.hidden = true) }, '×'),
        h('p', { class: 'mg-pick-kind' }, 'Nouvelle sortie'),
        h('h3', {}, r.nom),
        list.map((x) =>
          h(
            'div',
            { class: 'so-pick-rel' },
            coverEl(x.s, 'so-cover'),
            h('span', { class: 'so-row-text' }, h('strong', {}, x.s.titre), h('small', {}, `${x.kind} · ${fmtJour(x.date)}`)),
            x.s.lien ? h('a', { class: 'so-play', href: x.s.lien, target: '_blank', rel: 'noopener', title: 'Écouter', 'aria-label': 'Écouter' }, icon('play')) : null,
          ),
        ),
        h(
          'div',
          { class: 'mg-pick-actions' },
          h('a', { class: 'connect-go mg-pick-go', href: `artiste.html?id=${encodeURIComponent(rid)}` }, "Page de l'artiste"),
          h('button', { type: 'button', onclick: () => (close(), onSelect(rid)) }, 'Voir dans la galaxie'),
        ),
      ].flat().filter(Boolean),
    );
    pick.hidden = false;
  }

  function build() {
    scene3d?.dispose();
    const d = donnees();
    renderCard(d);
    document.querySelectorAll('#so-periodes button').forEach((b) => b.classList.toggle('on', Number(b.dataset.p) === periode));
    scene3d = createScene(sceneEl, d.groupes, showPick);
    scene3d.start();
  }

  function open() {
    overlay.hidden = false;
    overlay.classList.remove('fade-in');
    void overlay.offsetWidth;
    overlay.classList.add('fade-in');
    onPause(true);
    build();
  }
  function close() {
    scene3d?.dispose();
    scene3d = null;
    overlay.hidden = true;
    pick.hidden = true;
    onPause(false);
  }

  btn.addEventListener('click', open);
  document.getElementById('so-close').addEventListener('click', close);
  document.getElementById('so-card-toggle').addEventListener('click', () => overlay.classList.toggle('card-collapsed'));
  document.querySelectorAll('#so-periodes button').forEach((b) =>
    b.addEventListener('click', () => {
      periode = Number(b.dataset.p);
      pick.hidden = true;
      build();
    }),
  );
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || overlay.hidden) return;
    if (!pick.hidden) pick.hidden = true;
    else close();
  });

  // petit compteur sur le bouton
  const nb = donnees().recentes.length;
  if (nb) btn.append(h('span', { class: 'so-count' }, String(nb)));
}
