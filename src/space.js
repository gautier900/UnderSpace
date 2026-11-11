import * as THREE from "three";
import { noiseGLSL } from "./noise.js";

const pointsVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uAttenuate;
varying vec3 vColor;
void main(){
  float tw = 0.7 + 0.3 * sin(uTime * 1.3 + position.x * 0.13 + position.z * 0.07);
  vColor = aColor * tw;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float s = aSize * uPixelRatio;
  if (uAttenuate > 0.5) s *= 120.0 / -mv.z;
  gl_PointSize = min(s, 24.0);
  gl_Position = projectionMatrix * mv;
}
`;
const pointsFragment = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor * a, a);
}
`;

function pointsMaterial(attenuate) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAttenuate: { value: attenuate ? 1 : 0 },
    },
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

// Étoiles lointaines : suivent la caméra pour paraître infiniment loin.
export function createStarfield(count = 7000) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const palette = ["#ffffff", "#ffffff", "#7fe0d0", "#d8f07a", "#9fb8ff"].map(
    (h) => new THREE.Color(h),
  );
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(1500 + Math.random() * 900);
    v.toArray(pos, i * 3);
    const c = palette[(Math.random() * palette.length) | 0];
    const k = 0.35 + Math.random() * 0.5;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
    size[i] =
      Math.random() < 0.97 ? 1.5 + Math.random() * 1.5 : 3 + Math.random() * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(geo, pointsMaterial(false));
  pts.renderOrder = -1;
  pts.frustumCulled = false;
  return pts;
}

// Poussière galactique proche : donne la sensation de mouvement (parallaxe).
export function createDust(count = 2500, radius = 320) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const colors = ["#5fd0c0", "#c8e86a", "#9fb8ff", "#ffffff"].map(
    (h) => new THREE.Color(h),
  );
  for (let i = 0; i < count; i++) {
    const r = radius * Math.sqrt(Math.random());
    const arm = (i % 3) * ((Math.PI * 2) / 3);
    const a = arm + r * 0.018 + (Math.random() - 0.5) * 0.9;
    const spread = (Math.random() - 0.5) * (8 + r * 0.06);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = spread;
    pos[i * 3 + 2] = Math.sin(a) * r;
    const c = colors[(Math.random() * colors.length) | 0];
    const k = 0.2 + Math.random() * 0.4;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
    size[i] = 1.5 + Math.random() * 2.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  return new THREE.Points(geo, pointsMaterial(true));
}

// Nébuleuse en fond (sphère inversée avec du bruit).
export function createNebula() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${noiseGLSL}
      void main(){
        vec3 d = normalize(vDir);
        float n = fbm(d * 1.5);
        float n2 = fbm(d * 3.0 + 3.0);
        vec3 c = vec3(0.012, 0.011, 0.032);
        c = mix(c, vec3(0.022, 0.016, 0.050), smoothstep(-0.1, 0.4, n));
        c = mix(c, vec3(0.010, 0.022, 0.048), smoothstep(0.1, 0.5, n2) * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 32), mat);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  return mesh;
}
