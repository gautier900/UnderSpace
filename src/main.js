import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { rappeurs } from "./data/rappeurs.js";
import { createPlanet, setPlanetDim } from "./planet.js";
import { createStarfield, createDust, createNebula } from "./space.js";
import { setupUI } from "./ui.js";
import { createMap2D } from "./map2d.js";
import { setupMoi } from "./moi-ui.js";
import "./style.css";

let mode = "3d"; // '3d' ou '2d'
let paused = false; // vrai pendant que « Ma galaxie » est affichée (économise le GPU)
  
// --- Scène -----------------------------------------------------------------
const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
container.append(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.className = "labels";
container.append(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  6000,
);
const OVERVIEW_CAM = new THREE.Vector3(0, 980, 560);
camera.position.copy(OVERVIEW_CAM);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.zoomToCursor = true;
controls.screenSpacePanning = true;
controls.minDistance = 4;
controls.maxDistance = 1600;
controls.rotateSpeed = 0.6;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,
  0.5,
  0.92,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const nebula = createNebula();
const starfield = createStarfield();
const dust = createDust(5000, 620);
scene.add(nebula, starfield, dust);

// --- Planètes --------------------------------------------------------------
// Placement aléatoire mais toujours identique (graine fixe) : change SEED pour une autre disposition.
const SEED = 2026;
const GALAXY_RADIUS = 520; // taille de la zone
const MIN_GAP = 48; // espace minimum entre deux planètes (en plus de leurs rayons)
const VERTICAL_SPREAD = 70; // épaisseur de la galaxie

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const planets = [];
for (const r of rappeurs) {
  const p = createPlanet(r);
  if (r.position) p.position.fromArray(r.position);
  else {
    const size = p.userData.radius;
    let gap = MIN_GAP;
    for (let tries = 0; ; tries++) {
      // Distribution uniforme dans un disque, un peu plus dense vers le centre.
      const d = GALAXY_RADIUS * Math.pow(rand(), 0.6);
      const a = rand() * Math.PI * 2;
      const y =
        (rand() + rand() + rand() - 1.5) *
        VERTICAL_SPREAD *
        (1 - (d / GALAXY_RADIUS) * 0.5);
      p.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
      const ok = planets.every(
        (o) =>
          o.position.distanceTo(p.position) > gap + size + o.userData.radius,
      );
      if (ok) break;
      if (tries % 200 === 199) gap *= 0.9; // si ça coince, on assouplit un peu
    }
  }
  p.userData.base = p.position.clone(); // place « de repos » autour de laquelle la planète flotte
  scene.add(p);
  planets.push(p);
}
const byId = new Map(planets.map((p) => [p.userData.rappeur.id, p]));
const meshes = planets.map((p) => p.userData.mesh);

// --- Voyage de la caméra ---------------------------------------------------
let flight = null;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function flyToPoint(camTo, targetTo) {
  const dist = camera.position.distanceTo(camTo);
  flight = {
    camFrom: camera.position.clone(),
    camTo,
    tFrom: controls.target.clone(),
    tTo: targetTo,
    t: 0,
    dur: THREE.MathUtils.clamp(dist / 70, 1.1, 3),
    lift: Math.min(dist * 0.12, 35),
  };
  controls.enabled = false;
}

function flyToPlanet(group) {
  const target = group.position.clone();
  const dir = camera.position.clone().sub(target);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
  dir.normalize();
  dir.y += 0.2;
  dir.normalize();
  flyToPoint(
    target.clone().add(dir.multiplyScalar(group.userData.radius * 4.5)),
    target,
  );
}

// --- Sélection -------------------------------------------------------------
let selected = null;
const ui = setupUI({
  rappeurs,
  onSelect: select,
  onOverview: () => {
    setSelected(null);
    if (mode === "2d") map.overview();
    else flyToPoint(OVERVIEW_CAM.clone(), new THREE.Vector3());
  },
  onClose: () => {
    setSelected(null);
    map.clearSelection();
  },
  onFilter: applyFilter,
});

// Filtre par badge : les planètes concernées restent allumées, les autres s'assombrissent.
let filterIds = null;
function applyFilter(ids) {
  filterIds = ids;
  for (const p of planets) {
    const on = !ids || ids.has(p.userData.rappeur.id);
    p.userData.dimTarget = on ? 0 : 1;
    p.userData.highlight = !!ids && on;
  }
  map.setFilter(ids);
}

function setSelected(group) {
  selected?.userData.label.classList.remove("selected");
  selected = group;
  group?.userData.label.classList.add("selected");
}

function select(id) {
  const g = byId.get(id);
  if (!g) return;
  setSelected(g);
  if (mode === "2d") map.select(id);
  else flyToPlanet(g);
  ui.showPanel(g.userData.rappeur);
}

for (const p of planets) {
  p.userData.label.addEventListener("click", () =>
    select(p.userData.rappeur.id),
  );
}

// « Ma galaxie » : profil Deezer relié, recommandations, favoris.
setupMoi({ onSelect: select, onPause: (v) => (paused = v) });

// --- Survol / clic sur une planète -----------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let hovered = null;
let downAt = null;

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? hit.object.userData.group : null;
}

renderer.domElement.addEventListener("pointermove", (e) => {
  pointer.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
});
renderer.domElement.addEventListener("pointerleave", () =>
  pointer.set(-10, -10),
);
renderer.domElement.addEventListener(
  "pointerdown",
  (e) => (downAt = { x: e.clientX, y: e.clientY, b: e.button }),
);
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || downAt.b !== 0) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const g = pick();
  if (g) select(g.userData.rappeur.id);
});

// --- Boucle ----------------------------------------------------------------
const clock = new THREE.Clock();
const occluder = new THREE.Raycaster();
const toPlanet = new THREE.Vector3();
const screenUp = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  if (paused) {
    requestAnimationFrame(tick);
    return;
  }
  if (mode === "2d") {
    requestAnimationFrame(tick);
    return;
  }

  if (flight) {
    flight.t += dt / flight.dur;
    const k = Math.min(flight.t, 1);
    const e = ease(k);
    camera.position.lerpVectors(flight.camFrom, flight.camTo, e);
    camera.position.y += Math.sin(Math.PI * e) * flight.lift;
    controls.target.lerpVectors(
      flight.tFrom,
      flight.tTo,
      ease(Math.min(k * 1.3, 1)),
    );
    if (k >= 1) {
      flight = null;
      controls.enabled = true;
    }
  }
  controls.update();

  // Les étiquettes restent au-dessus des planètes à l'écran, quel que soit l'angle de vue.
  screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  for (const p of planets) {
    p.userData.labelObj.position
      .copy(screenUp)
      .multiplyScalar(p.userData.radius * 1.4 + 0.8);
    p.userData.mesh.rotation.y += p.userData.spin * dt;
    // dérive lente autour de sa place (rayon réglable dans le menu admin)
    const amp = p.userData.radius * 0.45 * p.userData.deplacement;
    const ph = p.userData.phase;
    p.position.set(
      p.userData.base.x + Math.sin(time * 0.3 + ph) * amp,
      p.userData.base.y + Math.sin(time * 0.23 + ph * 2) * amp * 0.6,
      p.userData.base.z + Math.cos(time * 0.27 + ph * 1.5) * amp,
    );
    p.userData.material.uniforms.uTime.value = time;
    if (p.userData.dim !== p.userData.dimTarget) {
      const nd =
        p.userData.dim +
        (p.userData.dimTarget - p.userData.dim) * Math.min(dt * 6, 1);
      setPlanetDim(
        p,
        Math.abs(nd - p.userData.dimTarget) < 0.01 ? p.userData.dimTarget : nd,
      );
    }
    const d = camera.position.distanceTo(p.position);
    let o =
      p === selected || p === hovered
        ? 1
        : THREE.MathUtils.clamp(1.8 - d / 380, 0.3, 1);
    if (filterIds)
      o = p.userData.highlight || p === selected || p === hovered ? 1 : 0;
    // Cache l'étiquette si une autre planète est devant.
    occluder.set(
      camera.position,
      toPlanet.subVectors(p.position, camera.position).normalize(),
    );
    occluder.far = d - p.userData.radius;
    if (
      occluder
        .intersectObjects(meshes, false)
        .some((h) => h.object !== p.userData.mesh)
    )
      o = 0;
    p.userData.label.style.opacity = o;
    p.userData.label.style.pointerEvents = o === 0 ? "none" : "";
  }
  starfield.material.uniforms.uTime.value = time;
  dust.material.uniforms.uTime.value = time;
  starfield.position.copy(camera.position);
  nebula.position.copy(camera.position);

  const h = flight ? null : pick();
  if (h !== hovered) {
    hovered?.userData.label.classList.remove("hover");
    hovered = h;
    hovered?.userData.label.classList.add("hover");
    renderer.domElement.style.cursor = hovered ? "pointer" : "";
  }

  composer.render();
  labelRenderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  labelRenderer.setSize(w, h);
});

// --- Bascule 2D / 3D (clic sur le logo UnderSpace) --------------------------
const map = createMap2D({ planets, onSelect: select });
const mapCanvas = document.getElementById("map");
const badge = document.getElementById("mode-badge");
const hint = document.getElementById("hint");
const HINTS = {
  "3d": "Clic gauche : tourner · Clic droit : se déplacer · Molette : zoomer · Clic sur une planète : y voyager · Clic sur UnderSpace : mode 2D",
  "2d": "Glisser : se déplacer · Molette : zoomer · Clic sur une planète : y aller · Clic sur UnderSpace : mode 3D",
};

function setMode(next) {
  mode = next;
  const is2d = mode === "2d";
  container.hidden = is2d;
  mapCanvas.hidden = !is2d;
  (is2d ? mapCanvas : container).classList.remove("fade-in");
  void (is2d ? mapCanvas : container).offsetWidth;
  (is2d ? mapCanvas : container).classList.add("fade-in");
  badge.textContent = is2d ? "2D" : "3D";
  hint.textContent = HINTS[mode];
  document.getElementById("brand").title = is2d
    ? "Passer en 3D"
    : "Passer en 2D";
  if (is2d) map.activate(selected?.userData.rappeur.id);
  else {
    map.deactivate();
    clock.getDelta();
    if (selected) flyToPlanet(selected);
  }
  try {
    localStorage.setItem("underspace-mode", mode);
  } catch {}
}
document
  .getElementById("brand")
  .addEventListener("click", () => setMode(mode === "2d" ? "3d" : "2d"));
let savedMode = "3d";
try {
  savedMode = localStorage.getItem("underspace-mode") || "3d";
} catch {}
setMode(savedMode === "2d" ? "2d" : "3d");

// Lien direct : /#jeune-morty
if (location.hash)
  setTimeout(() => select(decodeURIComponent(location.hash.slice(1))), 300);
window.addEventListener("hashchange", () =>
  select(decodeURIComponent(location.hash.slice(1))),
);
