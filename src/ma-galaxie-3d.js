// Vue « Ma galaxie » : un système solaire personnel.
//   - au centre : l'étoile de l'utilisateur (photo Deezer) ;
//   - ses 10 artistes UnderSpace les plus écoutés (plus il les écoute, plus ils sont proches) ;
//   - orbite lointaine : les artistes recommandés ;
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { rappeurs } from './data/rappeurs.js';
import { liens } from './data/liens.js';
import { createPlanet } from './planet.js';
import { createStarfield, createNebula } from './space.js';
import { perso, NB_RECOS } from './perso.js';

const byId = new Map(rappeurs.map((r) => [r.id, r]));

// Taille d'affichage d'une planète dans cette vue (on les réduit pour que tout tienne).
const PLANET_SCALE = 0.55;

export function createMaGalaxie({ container, onPick }) {
  const W = () => container.clientWidth;
  const H = () => container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  container.append(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(W(), H());
  labelRenderer.domElement.className = 'labels mg-labels';
  container.append(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 6000);
  camera.position.set(0, 46, 78);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 14;
  controls.maxDistance = 220;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.6, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const nebula = createNebula();
  const stars = createStarfield(5000);
  scene.add(nebula, stars);

  // Plan des orbites légèrement incliné, comme un vrai système solaire.
  const system = new THREE.Group();
  system.rotation.x = 0.12;
  scene.add(system);

  // --- L'étoile centrale : toi ---------------------------------------------------
  const sun = createPlanet({
    id: 'moi',
    nom: perso.profil?.user.nom ?? 'Toi',
    planete: { type: 'etoile', couleurs: ['#7a2cff', '#a238ff', '#f2d6ff'], taille: 5.5, relief: 3 },
  });
  sun.remove(sun.userData.labelObj);
  system.add(sun);
  const avatar = document.createElement('div');
  avatar.className = 'mg-me';
  if (perso.profil?.user.image) {
    const img = document.createElement('img');
    img.src = perso.profil.user.image;
    img.alt = '';
    avatar.append(img);
  } else {
    avatar.textContent = '🪐';
  }
  const meName = document.createElement('span');
  meName.textContent = perso.profil?.user.nom ?? 'Toi';
  avatar.append(meName);
  const avatarObj = new CSS2DObject(avatar);
  avatarObj.position.set(0, 0, 0);
  system.add(avatarObj);

  // --- Orbites --------------------------------------------------------------------
  const bodies = []; // { obj, radius, angle, speed, y, spin? }
  const orbitLine = (radius, color, dashed) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.45, dashSize: 1.6, gapSize: 1.2 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    system.add(line);
  };
  // Vitesse angulaire : plus on est loin, plus on est lent (comme Kepler, en plus doux).
  const speedFor = (radius) => 2.2 / Math.pow(radius, 1.15);

  function placeRing(objs, radius, opts = {}) {
    const n = objs.length;
    objs.forEach((obj, i) => {
      const angle = (i / n) * Math.PI * 2 + (opts.offset ?? 0);
      const y = Math.sin(i * 2.3) * (opts.wobble ?? 1.2);
      obj.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      system.add(obj);
      bodies.push({ obj, radius, angle, speed: speedFor(radius) * (opts.dir ?? 1), y });
    });
  }

  const planets = []; // groupes cliquables
  function planetFor(rid, kind) {
    const r = byId.get(rid);
    const g = createPlanet(r);
    g.scale.setScalar(PLANET_SCALE);
    g.userData.rid = rid;
    g.userData.mesh.userData.group = g;
    const label = g.userData.label;
    label.classList.add('mg-label', kind === 'reco' ? 'mg-reco' : 'mg-ecoute');
    // Les étiquettes du groupe sont réduites avec lui : on remonte l'étiquette pour compenser.
    g.userData.labelObj.position.y = (g.userData.radius * 1.4 + 0.8) / 1;
    const reco = perso.recoOf.get(rid);
    label.title = kind === 'reco' && reco ? `Recommandé : ${reco.raisons.join(' · ')}` : 'Déjà écouté';
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      onPick(rid, kind);
    });
    planets.push(g);
    return g;
  }

  // 1) Tes 10 artistes UnderSpace les plus écoutés, sans orbite dessinée :
  //    chacun a sa propre distance — plus tu l'écoutes, plus il est proche de toi.
  const NB_FAVORIS = 10;
  const FAV_R0 = 12; // distance du plus écouté
  const FAV_PAS = 2.6; // écart entre deux rangs
  const poidsOf = (rid) => perso.profil?.artistes.find((a) => a.id === liens[rid]?.deezerId)?.poids ?? 1;
  const ecoutes = [...perso.ecoutes.keys()].filter((id) => byId.has(id)).sort((a, b) => poidsOf(b) - poidsOf(a));
  const favoris = ecoutes.slice(0, NB_FAVORIS);
  favoris.forEach((id, i) => {
    // angle de départ « nombre d'or » : les planètes ne s'alignent jamais
    placeRing([planetFor(id, 'ecoute')], FAV_R0 + i * FAV_PAS, { offset: i * 2.39996, wobble: 0.8 });
  });

  // 2) Recommandations, sur une orbite pointillée juste au-delà.
  const recos = perso.recos.slice(0, NB_RECOS).map((r) => r.id);
  const RECO_R = favoris.length ? FAV_R0 + (favoris.length - 1) * FAV_PAS + 10 : 22;
  if (recos.length) {
    orbitLine(RECO_R, 0xc6f06a, true);
    placeRing(recos.map((id) => planetFor(id, 'reco')), RECO_R, { offset: 0.2, dir: 1 });
  }

  // --- Clic sur une planète -------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planets.map((g) => g.userData.mesh), false)[0];
    const g = hit?.object.userData.group;
    if (g) onPick(g.userData.rid, g.userData.label.classList.contains('mg-reco') ? 'reco' : 'ecoute');
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planets.map((g) => g.userData.mesh), false)[0];
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    controls.autoRotate = !hit;
  });

  // --- Boucle -------------------------------------------------------------------
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
  window.addEventListener('resize', () => running && resize());

  return {
    counts: { favoris: favoris.length, recos: recos.length },
    start() {
      if (running) return;
      running = true;
      resize();
      clock.getDelta();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
  };
}
