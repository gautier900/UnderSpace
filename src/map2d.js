import { hasFeat } from "./graphe.js";
import * as THREE from "three";
import { badgesOf } from "./data/badges.js";
import { createPlanet, setPlanetDim } from "./planet.js";

// Taille d'affichage des planètes en 2D par rapport à la 3D (on les grossit pour qu'elles se voient sur la carte).
const DRAW_SCALE = 3.5;
// Les planètes flottent légèrement autour de leur place (en fraction de leur rayon).
const DRIFT = 0.12;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// Encombrement d'une planète sur la carte (anneaux compris).
const extent = (it) => it.r * (it.ring ? 1.7 : 1.15);

// Hasard reproductible : change LAYOUT_SEED pour une autre disposition de la carte.
const LAYOUT_SEED = 7;
// Espace moyen entre deux planètes sur la carte.
const SPACING = 150;

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Répartit les planètes dans un rectangle au format de l'écran.
// Algorithme du « meilleur candidat » : pour chaque planète on tire plusieurs
// emplacements au hasard et on garde celui le plus éloigné des autres.
// Résultat : réparti partout, sans trous ni amas, et sans motif qui se répète.
function layoutRect(items, aspect) {
  const rand = mulberry32(LAYOUT_SEED);
  const area = items.length * SPACING * SPACING;
  const W = Math.sqrt(area * aspect);
  const H = W / aspect;
  const placed = [];
  for (const it of items) {
    let best = null;
    let bestScore = -Infinity;
    const candidates = placed.length ? 14 : 1;
    for (let c = 0; c < candidates; c++) {
      const x = (rand() - 0.5) * W;
      const y = (rand() - 0.5) * H;
      let score = Infinity;
      for (const o of placed)
        score = Math.min(
          score,
          Math.hypot(x - o.x, y - o.y) - extent(o) - extent(it),
        );
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    [it.x, it.y] = best;
    placed.push(it);
  }
}

// Écarte les planètes qui se chevauchent une fois vues du dessus.
function relax(items) {
  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = extent(a) + extent(b) + 26;
        if (d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function makeStars() {
  const T = 1024;
  const cols = ["#ffffff", "#ffffff", "#7fe0d0", "#d8f07a", "#9fb8ff"];
  const layers = [
    [170, 0.04, 0.8],
    [90, 0.12, 1.3],
    [40, 0.25, 1.9],
  ].map(([n, f, size]) => ({
    f,
    pts: Array.from({ length: n }, () => ({
      x: Math.random() * T,
      y: Math.random() * T,
      r: size * (0.6 + Math.random() * 0.8),
      c: cols[(Math.random() * cols.length) | 0],
      ph: Math.random() * Math.PI * 2,
    })),
  }));
  return { T, layers };
}

function makeNebulae(items) {
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const cols = ["110, 70, 200", "50, 90, 190", "160, 70, 150", "40, 140, 150"];
  return Array.from({ length: 14 }, (_, k) => ({
    x: x0 + Math.random() * (x1 - x0),
    y: y0 + Math.random() * (y1 - y0),
    r: 200 + Math.random() * 300,
    c: cols[k % cols.length],
  }));
}

export function createMap2D({ planets, onSelect }) {
  // Trois couches superposées :
  //  1. fond (étoiles, nébuleuses) en canvas 2D,
  //  2. planètes en vraie 3D vue de face (WebGL, caméra orthographique) : elles tournent sur elles-mêmes,
  //  3. étiquettes + souris sur le canvas #map, transparent, tout en haut.
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const bgCanvas = document.createElement("canvas");
  bgCanvas.className = "map-layer";
  const bgCtx = bgCanvas.getContext("2d");
  bgCanvas.hidden = true;
  canvas.before(bgCanvas);
  let gl = null; // { renderer, scene, camera }
  let w = 0;
  let h = 0;
  let dpr = 1;

  const items = planets.map((g) => {
    const r = g.userData.rappeur;
    return {
      id: r.id,
      nom: r.nom,
      icons: badgesOf(r)
        .map((b) => b.icone)
        .join(""),
      group: g,
      x: g.position.x,
      y: g.position.z,
      r: g.userData.radius * DRAW_SCALE,
      ring: !!r.planete.anneaux,
      star: r.planete.type === "etoile",
      asteroid: r.planete.type === "asteroide",
      dot: r.planete.couleurs[2],
      glow: r.planete.couleurs[1],
      g2: null, // la planète 3D de la carte 2D
      ph: Math.random() * Math.PI * 2, // phase de la dérive
      ox: 0,
      oy: 0,
      dim: 0,
      dimTarget: 0,
      lit: false,
    };
  });
  // Format du rectangle = format de l'écran (sans la barre du haut).
  layoutRect(
    items,
    clamp(
      window.innerWidth / Math.max(window.innerHeight - 140, 200),
      0.6,
      2.4,
    ),
  );
  relax(items);
  const byId = new Map(items.map((i) => [i.id, i]));

  // Cadrage de la vue d'ensemble.
  const minX = Math.min(...items.map((i) => i.x - extent(i)));
  const maxX = Math.max(...items.map((i) => i.x + extent(i)));
  const minY = Math.min(...items.map((i) => i.y - extent(i)));
  const maxY = Math.max(...items.map((i) => i.y + extent(i)));
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const overviewZoom = () =>
    Math.min(w / (maxX - minX + 80), (h - 140) / (maxY - minY + 80));

  const stars = makeStars();
  const nebulae = makeNebulae(items);
  const cam = { x: center.x, y: center.y, zoom: 0.5 };
  let selected = null;
  let hovered = null;
  let filterOn = false;
  let pathItems = null; // Six degrés : chemin à tracer
  let constel = null; // collaborations de la planète sélectionnée { center, items, pairs, born }
  let flight = null;
  let active = false;
  let started = false;
  let raf = 0;
  let last = 0;

  // --- Planètes en 3D vue de face (créées une seule fois, au premier passage en 2D) ---
  function initGL() {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "map-layer";
    canvas.before(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
    camera.position.z = 1000;
    for (const it of items) {
      const g = createPlanet(it.group.userData.rappeur);
      g.remove(g.userData.labelObj);
      // le halo des étoiles est dessiné sur le fond (plus joli sur un canvas transparent)
      for (const c of g.children) if (c.isSprite) c.visible = false;
      g.userData.material.uniforms.uOrtho.value = 1;
      g.scale.setScalar(DRAW_SCALE);
      scene.add(g);
      it.g2 = g;
    }
    gl = { renderer, scene, camera };
  }

  // --- Repères ---
  const toScreen = (x, y) => [
    (x - cam.x) * cam.zoom + w / 2,
    (y - cam.y) * cam.zoom + h / 2,
  ];
  const toWorld = (sx, sy) => [
    (sx - w / 2) / cam.zoom + cam.x,
    (sy - h / 2) / cam.zoom + cam.y,
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    for (const c of [canvas, bgCanvas]) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    gl?.renderer.setPixelRatio(dpr);
    gl?.renderer.setSize(w, h);
  }

  function zoomAt(px, py, f) {
    const [wx, wy] = toWorld(px, py);
    cam.zoom = clamp(cam.zoom * f, overviewZoom() * 0.5, 6);
    cam.x = wx - (px - w / 2) / cam.zoom;
    cam.y = wy - (py - h / 2) / cam.zoom;
  }

  function pick(px, py) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const [sx, sy] = toScreen(it.x + it.ox, it.y + it.oy);
      if (Math.hypot(px - sx, py - sy) < it.r * cam.zoom + 4) return it;
    }
    return null;
  }

  // --- Voyage ---
  function flyToView(x, y, zoom) {
    const d = Math.hypot(x - cam.x, y - cam.y);
    flight = {
      x0: cam.x,
      y0: cam.y,
      z0: Math.log(cam.zoom),
      x1: x,
      y1: y,
      z1: Math.log(zoom),
      t: 0,
      dur: clamp(0.8 + d / 600, 0.8, 2.2),
      dip: clamp(Math.log(1 + (d * Math.min(cam.zoom, zoom)) / w), 0, 1.4),
    };
  }
  const focusZoom = (it) => clamp(110 / it.r, 0.4, 6);

  // --- Dessin ---
  function drawBackground(t) {
    bgCtx.fillStyle = "#1b1a33";
    bgCtx.fillRect(0, 0, w, h);

    for (const n of nebulae) {
      const [sx, sy] = toScreen(n.x, n.y);
      const rr = n.r * cam.zoom;
      if (sx + rr < 0 || sx - rr > w || sy + rr < 0 || sy - rr > h) continue;
      const g = bgCtx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(${n.c}, 0.16)`);
      g.addColorStop(1, `rgba(${n.c}, 0)`);
      bgCtx.fillStyle = g;
      bgCtx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    }

    const T = stars.T;
    for (const L of stars.layers) {
      const ox = (((-cam.x * cam.zoom * L.f) % T) + T) % T;
      const oy = (((-cam.y * cam.zoom * L.f) % T) + T) % T;
      for (let tx = ox - T; tx < w; tx += T) {
        for (let ty = oy - T; ty < h; ty += T) {
          for (const p of L.pts) {
            const x = tx + p.x;
            const y = ty + p.y;
            if (x < -3 || x > w + 3 || y < -3 || y > h + 3) continue;
            bgCtx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.3 + p.ph);
            bgCtx.fillStyle = p.c;
            bgCtx.beginPath();
            bgCtx.arc(x, y, p.r, 0, Math.PI * 2);
            bgCtx.fill();
          }
        }
      }
    }
    bgCtx.globalAlpha = 1;
  }

  function drawLabel(it, sx, sy, rr, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = "500 13px Futura, 'Futura PT', Jost, system-ui, sans-serif";
    const text = it.icons ? `${it.nom}  ${it.icons}` : it.nom;
    const tw = ctx.measureText(text).width;
    const pw = tw + 30;
    const ph = 24;
    const x0 = sx - pw / 2;
    const y0 = sy + rr * (it.ring ? 0.75 : 1.08) + 8;
    ctx.fillStyle = "#15132a";
    ctx.beginPath();
    ctx.roundRect(x0, y0 + 3, pw, ph, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeStyle = it === hovered || it === selected ? it.dot : "#2e2e33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x0, y0, pw, ph, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = it.dot;
    ctx.beginPath();
    ctx.arc(x0 + 13, y0 + ph / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f1ff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x0 + 22, y0 + ph / 2 + 1);
    ctx.globalAlpha = 1;
  }

  function draw(t, dt) {
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const visible = [];
    for (const it of items) {
      // dérive lente : chaque planète flotte autour de sa place, à son propre rythme
      const amp = it.r * DRIFT * it.group.userData.deplacement;
      it.ox = Math.sin(t * 0.35 + it.ph) * amp;
      it.oy = Math.cos(t * 0.27 + it.ph * 1.7) * amp;
      const g = it.g2;
      g.position.set(it.x + it.ox, -(it.y + it.oy), 0);
      g.userData.mesh.rotation.y += g.userData.spin * dt * 1.6;
      g.userData.material.uniforms.uTime.value = t;
      if (g.userData.dim !== it.dim) setPlanetDim(g, it.dim);

      const [sx, sy] = toScreen(it.x + it.ox, it.y + it.oy);
      const rr = it.r * cam.zoom;
      const s = rr * (it.ring ? 2.3 : 1.1);
      if (sx + s * 1.3 < 0 || sx - s * 1.3 > w || sy + s * 1.3 < 0 || sy - s * 1.3 > h + 30) continue;
      if (it.star) {
        bgCtx.globalAlpha = 1 - 0.8 * it.dim;
        const gr = bgCtx.createRadialGradient(sx, sy, rr * 0.8, sx, sy, rr * 2.6);
        gr.addColorStop(0, it.glow + "66");
        gr.addColorStop(1, it.glow + "00");
        bgCtx.fillStyle = gr;
        bgCtx.fillRect(sx - rr * 2.6, sy - rr * 2.6, rr * 5.2, rr * 5.2);
        bgCtx.globalAlpha = 1;
      }
      visible.push([it, sx, sy, rr]);
    }

    // caméra orthographique calée sur la vue 2D (l'axe y est inversé entre écran et 3D)
    const { renderer, scene, camera } = gl;
    camera.left = cam.x - w / 2 / cam.zoom;
    camera.right = cam.x + w / 2 / cam.zoom;
    camera.top = -(cam.y - h / 2 / cam.zoom);
    camera.bottom = -(cam.y + h / 2 / cam.zoom);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    // Six degrés : trait lumineux en pointillés animés entre les planètes du chemin
    if (pathItems) {
      ctx.save();
      ctx.strokeStyle = "#d8ff7a";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#d8ff7a";
      ctx.shadowBlur = 12;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      pathItems.forEach((it, i) => {
        const [x, y] = toScreen(it.x + it.ox, it.y + it.oy);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Constellation : rayons dorés vers chaque collaboration, fils bleutés entre collaborateurs
    if (constel) {
      const age = (performance.now() - constel.born) / 1000;
      const grow = Math.min(age / 0.8, 1);
      const ease3 = 1 - Math.pow(1 - grow, 3);
      const twinkle = 0.85 + 0.15 * Math.sin(t * 2.2);
      const pos = (it) => toScreen(it.x + it.ox, it.y + it.oy);
      const [cx, cy] = pos(constel.center);
      ctx.save();
      ctx.lineCap = "round";
      if (constel.pairs.length && age > 0.5) {
        ctx.globalAlpha = Math.min((age - 0.5) / 0.8, 1) * 0.45;
        ctx.strokeStyle = "#8fa8ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of constel.pairs) {
          const [ax, ay] = pos(a);
          const [bx, by] = pos(b);
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = twinkle;
      ctx.strokeStyle = "rgba(255, 217, 138, 0.8)";
      ctx.shadowColor = "#ffd98a";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const it of constel.items) {
        const [x, y] = pos(it);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (x - cx) * ease3, cy + (y - cy) * ease3);
      }
      ctx.stroke();
      // petites étoiles au bout de chaque rayon
      ctx.fillStyle = "#fff4d6";
      for (const it of constel.items) {
        const [x, y] = pos(it);
        const ex = cx + (x - cx) * ease3;
        const ey = cy + (y - cy) * ease3;
        const s = 2.2 + Math.sin(t * 3 + it.ph * 5) * 0.8;
        ctx.beginPath();
        ctx.moveTo(ex, ey - s * 2);
        ctx.lineTo(ex + s * 0.5, ey - s * 0.5);
        ctx.lineTo(ex + s * 2, ey);
        ctx.lineTo(ex + s * 0.5, ey + s * 0.5);
        ctx.lineTo(ex, ey + s * 2);
        ctx.lineTo(ex - s * 0.5, ey + s * 0.5);
        ctx.lineTo(ex - s * 2, ey);
        ctx.lineTo(ex - s * 0.5, ey - s * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (const [it, sx, sy, rr] of visible) {
      let a =
        it === selected || it === hovered || it.collab ? 1 : clamp((rr - 9) / 14, 0, 1);
      if (filterOn) a = it.lit || it.collab || it === selected || it === hovered ? 1 : 0;
      if (a > 0.02) drawLabel(it, sx, sy, rr, a);
    }
  }

  function frame(now) {
    if (!active) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (flight) {
      flight.t += dt / flight.dur;
      const k = Math.min(flight.t, 1);
      const e = ease(k);
      cam.x = flight.x0 + (flight.x1 - flight.x0) * e;
      cam.y = flight.y0 + (flight.y1 - flight.y0) * e;
      cam.zoom = Math.exp(
        flight.z0 +
          (flight.z1 - flight.z0) * e -
          flight.dip * Math.sin(Math.PI * e),
      );
      if (k >= 1) flight = null;
    }
    for (const it of items) {
      if (it.dim !== it.dimTarget) {
        it.dim += (it.dimTarget - it.dim) * Math.min(dt * 6, 1);
        if (Math.abs(it.dim - it.dimTarget) < 0.01) it.dim = it.dimTarget;
      }
    }
    draw(now / 1000, dt);
    raf = requestAnimationFrame(frame);
  }

  // --- Souris / tactile ---
  const pointers = new Map();
  let drag = null;
  let pinchDist = 0;

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    flight = null;
    if (pointers.size === 1)
      drag = {
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        moved: 0,
      };
    else {
      drag = null;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) {
      const hit = pick(e.clientX, e.clientY);
      if (hit !== hovered) {
        hovered = hit;
        canvas.style.cursor = hit ? "pointer" : "grab";
      }
      return;
    }
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      cam.x -= (e.clientX - prev.x) / 2 / cam.zoom;
      cam.y -= (e.clientY - prev.y) / 2 / cam.zoom;
      if (pinchDist > 0) zoomAt(mx, my, d / pinchDist);
      pinchDist = d;
    } else if (drag) {
      cam.x -= (e.clientX - drag.x) / cam.zoom;
      cam.y -= (e.clientY - drag.y) / cam.zoom;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = Math.max(
        drag.moved,
        Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy),
      );
      canvas.style.cursor = "grabbing";
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (e.type === "pointerup" && drag && drag.moved < 5 && e.button === 0) {
      const hit = pick(e.clientX, e.clientY);
      if (hit) onSelect(hit.id);
    }
    drag = null;
    pinchDist = 0;
    canvas.style.cursor = hovered ? "pointer" : "grab";
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => {
    if (!pointers.size) hovered = null;
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      flight = null;
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    if (active) resize();
  });

  // --- API ---
  return {
    activate(selectedId) {
      if (!gl) initGL();
      bgCanvas.hidden = gl.renderer.domElement.hidden = false;
      resize();
      active = true;
      const it = selectedId && byId.get(selectedId);
      selected = it || null;
      if (it) Object.assign(cam, { x: it.x, y: it.y, zoom: focusZoom(it) });
      else if (!started)
        Object.assign(cam, { x: center.x, y: center.y, zoom: overviewZoom() });
      started = true;
      flight = null;
      canvas.style.cursor = "grab";
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    deactivate() {
      active = false;
      bgCanvas.hidden = true;
      if (gl) gl.renderer.domElement.hidden = true;
      cancelAnimationFrame(raf);
    },
    select(id) {
      const it = byId.get(id);
      if (!it) return;
      selected = it;
      if (constel?.center !== it) return flyToView(it.x, it.y, focusZoom(it));
      // constellation : on cadre la planète et toutes ses collaborations, à gauche de la fiche
      const pts = [it, ...constel.items];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const panelPx = w > 640 ? Math.min(380, w - 32) : 0;
      const zoom = clamp(
        Math.min((w - panelPx - 80) / (x1 - x0 + 180), (h - 200) / (y1 - y0 + 180)),
        overviewZoom() * 0.6,
        focusZoom(it),
      );
      flyToView((x0 + x1) / 2 + panelPx / 2 / zoom, (y0 + y1) / 2, zoom);
    },
    clearSelection() {
      selected = null;
    },
    // ids = Set des artistes à mettre en avant, ou null pour tout afficher normalement.
    setFilter(ids) {
      filterOn = !!ids;
      for (const it of items) {
        it.lit = !!ids && ids.has(it.id);
        it.dimTarget = ids && !it.lit ? 1 : 0;
      }
    },
    // id = artiste sélectionné, ids = ses collaborateurs (null pour effacer)
    setConstellation(id, ids = []) {
      for (const it of items) it.collab = false;
      const center = id ? byId.get(id) : null;
      if (!center || !ids.length) {
        constel = null;
        return;
      }
      const list = ids.map((x) => byId.get(x)).filter(Boolean);
      list.forEach((it) => (it.collab = true));
      const pairs = [];
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) if (hasFeat(list[i].id, list[j].id)) pairs.push([list[i], list[j]]);
      constel = { center, items: list, pairs, born: performance.now() };
    },
    setPath(ids) {
      pathItems = ids ? ids.map((id) => byId.get(id)).filter(Boolean) : null;
    },
    fitPath() {
      if (!pathItems?.length) return;
      const xs = pathItems.map((i) => i.x);
      const ys = pathItems.map((i) => i.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const zoom = clamp(Math.min((w - 520) / (x1 - x0 + 200), (h - 220) / (y1 - y0 + 200)), overviewZoom() * 0.6, 2);
      flyToView((x0 + x1) / 2, (y0 + y1) / 2, zoom);
    },
    overview() {
      selected = null;
      flyToView(center.x, center.y, overviewZoom());
    },
  };
}
