import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { noiseGLSL } from "./noise.js";
import { badgesOf } from "./data/badges.js";

const TYPES = {
  rocheuse: 0,
  gazeuse: 1,
  lave: 2,
  glace: 3,
  etoile: 4,
  toxique: 5,
  asteroide: 6,
  continents: 7,
};

export const TYPE_LABELS = {
  rocheuse: "Planète à cratères",
  gazeuse: "Géante gazeuse",
  lave: "Planète de lave",
  glace: "Planète de glace",
  etoile: "Étoile",
  toxique: "Planète toxique",
  asteroide: "Astéroïde",
  continents: "Planète à continents",
};

// Lumière venant d'en haut à gauche (repère caméra) : ombre en croissant en bas à droite.
const LIGHT_DIR = new THREE.Vector3(-0.55, 0.55, 0.65).normalize();

const planetVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;
void main(){
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const planetFragment = /* glsl */ `
uniform float uTime;
uniform float uType;
uniform float uScale;
uniform vec3 uSeed;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uRim;
uniform vec3 uLight;
uniform float uDim;
uniform float uOrtho; // 1 = caméra orthographique (vue 2D) : direction de vue fixe
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;
${noiseGLSL}

vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float worley(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + hash3(i + g) * 0.85 - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
// Marche nette mais anti-aliasée : c'est ce qui donne l'aspect "aplat cartoon".
float band(float x, float e){
  float w = fwidth(x) * 0.8 + 1e-4;
  return smoothstep(e - w, e + w, x);
}

void main(){
  vec3 p = normalize(vPos);
  float t = uTime;
  vec3 col;
  float emissive = 0.0;
  vec3 N = normalize(vNormal);
  vec3 V = uOrtho > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);

  if (uType < 0.5 || (uType > 5.5 && uType < 6.5)) {        // cratères (rocheuse / astéroïde)
    vec3 q = p * uScale + uSeed;
    float n = fbm3(q * 0.7);
    col = mix(uB, mix(uB, uA, 0.5), band(n, 0.1));
    col = mix(col, uC, band(n, 0.42) * 0.6);
    float s = uScale * 1.3;
    float d  = worley(p * s + uSeed);
    float d2 = worley((p + vec3(-0.05, 0.05, 0.0)) * s + uSeed);
    float crater = 1.0 - band(d, 0.34);
    float lip = (1.0 - band(d, 0.42)) * band(d, 0.34);
    col = mix(col, uC, lip * 0.55);
    col = mix(col, uA, crater);
    col = mix(col, uA * 0.6, crater * band(d2, 0.34));
    float ds = worley(p * s * 2.8 + uSeed * 2.0);
    col = mix(col, uA * 0.85, 1.0 - band(ds, 0.2));
  } else if (uType < 1.5) {                                   // gazeuse : bandes
    float w = fbm3(p * vec3(1.2, 3.0, 1.2) * uScale + uSeed + vec3(t * 0.02, 0.0, 0.0));
    float b = sin(p.y * uScale * 5.0 + w * 1.4);
    col = uA;
    col = mix(col, uB, band(b, -0.25));
    col = mix(col, uC, band(b, 0.6) * 0.9);
    float streak = sin(p.y * uScale * 20.0 + w * 7.0);
    col = mix(col, vec3(1.0), band(streak, 0.9) * band(w, 0.0) * 0.5);
  } else if (uType < 2.5) {                                   // lave : marbrures + fissures
    vec3 q = p * uScale + uSeed;
    float w = fbm3(q + fbm3(q + vec3(t * 0.03)) * 1.5);
    col = mix(uA, uB, band(w, -0.08));
    col = mix(col, mix(uB, uC, 0.45), band(w, 0.22));
    float r = 1.0 - abs(snoise(q * 1.2 + vec3(0.0, t * 0.05, 0.0)));
    float crack = band(r, 0.94);
    col = mix(col, uC * 1.3, crack);
    emissive = crack;
  } else if (uType < 3.5) {                                   // glace : marbrures claires
    vec3 q = p * uScale + uSeed;
    float w = fbm3(q + fbm3(q) * 1.2);
    col = mix(uA, uB, band(w, 0.0));
    col = mix(col, uC, band(w, 0.3));
    float line = abs(fbm3(q * 1.6 + 3.0));
    col = mix(col, uC, (1.0 - band(line, 0.035)) * 0.8);
  } else if (uType < 4.5) {                                   // étoile : anneaux de couleur
    float wav = snoise(p * uScale + vec3(t * 0.25)) * 0.07;
    float f = dot(N, V) + wav;
    col = uA;
    col = mix(col, uB, band(f, 0.5));
    col = mix(col, uC, band(f, 0.8));
    emissive = 1.0;
  } else if (uType < 5.5) {                                   // toxique : tourbillons
    vec3 q = p * uScale + uSeed + vec3(0.0, t * 0.03, 0.0);
    float w = fbm3(q * 0.75 + fbm3(q * 0.9) * 1.1);
    col = mix(uA, uB, band(w, -0.1));
    col = mix(col, uC, band(w, 0.28));
  } else {                                                    // continents
    vec3 q = p * uScale + uSeed;
    float n = fbm3(q);
    float swirl = abs(fbm3(q * 2.0 + 7.0));
    vec3 ocean = mix(uA, mix(uA, vec3(1.0), 0.25), 1.0 - band(swirl, 0.05));
    col = mix(ocean, uB, band(n, 0.1));
    col = mix(col, uC, band(n, 0.27));
  }

  // --- Cel-shading ---
  float diff = dot(N, uLight);
  float lit = band(diff, 0.2);
  vec3 shaded = mix(col * 0.66, col, lit);
  shaded = mix(shaded, col * 1.12, band(diff, 0.7) * 0.6);
  float fres = 1.0 - max(dot(N, V), 0.0);
  shaded = mix(shaded, col * 0.42, band(fres, 0.8) * (1.0 - lit));
  // liseré lumineux côté droit
  float rimL = band(fres, 0.86) * band(N.x - N.y * 0.3, 0.3);
  shaded = mix(shaded, uRim, rimL * 0.9);
  // reflet brillant (point + arc)
  vec3 H = normalize(uLight + V);
  float s = dot(N, H);
  float spot = band(s, 0.994);
  float arc = band(s, 0.972) * (1.0 - band(s, 0.978));
  shaded = mix(shaded, vec3(1.0), (spot * 0.4 + arc * 0.22) * (1.0 - emissive));

  gl_FragColor = vec4(mix(shaded, col, emissive) * (1.0 - 0.82 * uDim), 1.0);
  #include <colorspace_fragment>
}
`;

const ringVertex = /* glsl */ `
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIn;
uniform float uOut;
uniform float uDim;
varying vec3 vPos;
float band(float x, float e){ float w = fwidth(x) * 0.8 + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  float t = (length(vPos.xy) - uIn) / (uOut - uIn);
  float b = sin(t * 26.0 + sin(t * 9.0) * 2.0);
  vec3 col = mix(uColor * 0.72, uColor, band(b, 0.0));
  col = mix(col, mix(uColor, vec3(1.0), 0.5), band(b, 0.85));
  float a = band(t, 0.02) * (1.0 - band(t, 0.98));
  a *= 1.0 - band(t, 0.55) * (1.0 - band(t, 0.62)) * 0.85;
  gl_FragColor = vec4(col * (1.0 - 0.82 * uDim), a * (1.0 - 0.6 * uDim));
  #include <colorspace_fragment>
}
`;

let glowTexture;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.8)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.25)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

// Forme de patate pour les astéroïdes.
function asteroidGeometry(radius, seed) {
  let geo = new THREE.IcosahedronGeometry(radius, 24);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const s = seed * 50;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k =
      1 +
      0.16 * Math.sin(v.x * 2.6 + s) * Math.sin(v.y * 2.1 + s * 0.7) +
      0.09 * Math.sin(v.z * 4.3 + s * 1.3) * Math.sin(v.x * 3.7 - s) +
      0.05 * Math.sin(v.y * 7.1 + s * 2.1);
    v.multiplyScalar(radius * k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createPlanet(rappeur) {
  const cfg = rappeur.planete;
  const radius = cfg.taille ?? 3;
  const seed = hash(rappeur.id);
  const [a, b, c] = cfg.couleurs.map((h) => new THREE.Color(h));
  const rim = new THREE.Color(cfg.atmosphere ?? cfg.couleurs[2]).lerp(
    new THREE.Color("#ffffff"),
    0.3,
  );
  const group = new THREE.Group();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uType: { value: TYPES[cfg.type] ?? 0 },
      uScale: { value: cfg.relief ?? 2.5 },
      uSeed: { value: new THREE.Vector3(seed * 100, seed * 37, seed * 59) },
      uA: { value: a },
      uB: { value: b },
      uC: { value: c },
      uRim: { value: rim },
      uLight: { value: LIGHT_DIR },
      uDim: { value: 0 },
      uOrtho: { value: 0 },
    },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
  });
  const geo =
    cfg.type === "asteroide"
      ? asteroidGeometry(radius, seed)
      : new THREE.SphereGeometry(radius, 96, 64);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = (seed - 0.5) * 0.8;
  mesh.userData.group = group;
  group.add(mesh);

  let glowMat = null;
  let ringMat = null;
  if (cfg.type === "etoile") {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: b,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sprite.scale.setScalar(radius * 4.5);
    glowMat = sprite.material;
    group.add(sprite);
  }

  if (cfg.anneaux) {
    const inner = radius * 1.35;
    const outer = radius * 2.2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 160),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(cfg.anneaux) },
          uIn: { value: inner },
          uOut: { value: outer },
          uDim: { value: 0 },
        },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ringMat = ring.material;
    ring.rotation.x = -Math.PI / 2 + 0.35;
    ring.rotation.y = (seed - 0.5) * 0.6;
    group.add(ring);
  }

  const el = document.createElement("div");
  el.className = "label";
  el.textContent = rappeur.nom;
  const badges = badgesOf(rappeur);
  if (badges.length) {
    const icons = document.createElement("span");
    icons.className = "label-badges";
    icons.textContent = badges.map((b) => b.icone).join("");
    icons.title = badges.map((b) => b.label).join(" · ");
    el.append(icons);
  }
  el.dataset.id = rappeur.id;
  el.style.setProperty("--dot", cfg.couleurs[2]);
  const label = new CSS2DObject(el);
  label.position.set(0, radius * 1.4 + 0.8, 0);
  group.add(label);

  group.userData = {
    rappeur,
    radius,
    mesh,
    label: el,
    labelObj: label,
    material: mat,
    ringMat,
    glowMat,
    dim: 0,
    dimTarget: 0,
    highlight: false,
    // réglables dans le menu admin : vitesse de rotation et rayon de déplacement
    spin: (0.05 + seed * 0.12) * (cfg.vitesse ?? 1),
    deplacement: cfg.deplacement ?? 1,
    phase: seed * Math.PI * 2,
  };
  return group;
}

// Assombrit plus ou moins une planète (0 = normale, 1 = presque éteinte).
export function setPlanetDim(group, d) {
  const u = group.userData;
  u.dim = d;
  u.material.uniforms.uDim.value = d;
  if (u.ringMat) u.ringMat.uniforms.uDim.value = d;
  if (u.glowMat) u.glowMat.opacity = 1 - 0.85 * d;
}
