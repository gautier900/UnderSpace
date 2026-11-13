// Blind test : un extrait de 30 s d'un titre populaire, 4 planètes au choix.
// Les extraits viennent de l'API publique Deezer (sans compte).
import { icon } from './icons.js';
import { rappeurs } from './data/rappeurs.js';
import { liens } from './data/liens.js';
import { jsonp } from './deezer.js';
import { perso } from './perso.js';

const MANCHES = 10;
const DUREE = 15; // secondes pour répondre (l'extrait dure 30 s)
const RECORD_KEY = 'underspace-blindtest-record';
const EXCLURE_RE = /\bnigg/i;

const byId = new Map(rappeurs.map((r) => [r.id, r]));
const idByDeezer = new Map(Object.entries(liens).map(([rid, l]) => [l.deezerId, rid]));
const jouables = rappeurs.filter((r) => liens[r.id]?.deezerId).map((r) => r.id);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
const melange = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const record = () => {
  try {
    return Number(localStorage.getItem(RECORD_KEY)) || 0;
  } catch {
    return 0;
  }
};

// Un titre jouable (avec extrait) au hasard parmi les 15 plus écoutés de l'artiste.
const cacheTop = new Map();
async function titreAuHasard(rid) {
  if (!cacheTop.has(rid)) {
    const d = await jsonp(`artist/${liens[rid].deezerId}/top`, { limit: 15 }).catch(() => ({ data: [] }));
    // seulement les titres où l'artiste est l'artiste principal
    cacheTop.set(rid, (d.data ?? []).filter((t) => t.preview && t.artist?.id === liens[rid].deezerId && !EXCLURE_RE.test(t.title)));
  }
  const list = cacheTop.get(rid);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

// 3 mauvaises réponses : des artistes proches en mode difficile, sinon au hasard.
function leurres(rid, difficile) {
  const pool = new Set();
  if (difficile) {
    for (const [did] of liens[rid]?.proches ?? []) {
      const other = idByDeezer.get(did);
      if (other && other !== rid) pool.add(other);
    }
  }
  const choix = melange([...pool]).slice(0, 3);
  for (const id of melange(jouables)) {
    if (choix.length >= 3) break;
    if (id !== rid && !choix.includes(id)) choix.push(id);
  }
  return choix;
}

export function setupBlindTest({ onSelect }) {
  const btn = document.getElementById('bt-btn');
  const dialog = document.getElementById('bt');
  const audio = new Audio();
  audio.preload = 'auto';
  let partie = null;
  let timer = 0;
  let options = { difficile: false, mesArtistes: false };

  btn.addEventListener('click', () => {
    accueil();
    dialog.showModal();
  });
  dialog.addEventListener('close', stop);
  function stop() {
    audio.pause();
    cancelAnimationFrame(timer);
    partie = null;
  }

  const fermer = () => dialog.close();
  const entete = (...extra) =>
    h('div', { class: 'bt-head' }, h('h2', {}, icon('headphones'), ' Blind test'), ...extra, h('button', { class: 'gx-close', type: 'button', 'aria-label': 'Fermer', onclick: fermer }, '×'));

  // --- Écran d'accueil ------------------------------------------------------------------
  function accueil() {
    stop();
    const mesIds = [...perso.ecoutes.keys()].filter((id) => liens[id]?.deezerId);
    const peutMes = mesIds.length >= 4;
    if (!peutMes) options.mesArtistes = false;
    dialog.replaceChildren(
      entete(),
      h(
        'div',
        { class: 'bt-body bt-accueil' },
        h('div', { class: 'bt-disc' }, h('span', {}, '♪')),
        h('p', { class: 'bt-intro' }, `${MANCHES} extraits, 4 planètes à chaque fois : trouve l'artiste le plus vite possible !`),
        h(
          'div',
          { class: 'bt-options' },
          h(
            'label',
            { class: 'bt-opt' },
            h('input', { type: 'checkbox', checked: options.difficile || null, onchange: (e) => (options.difficile = e.target.checked) }),
            h('span', {}, h('strong', {}, 'Mode difficile'), h('small', {}, 'Les mauvaises réponses sont des artistes proches du bon')),
          ),
          h(
            'label',
            { class: `bt-opt${peutMes ? '' : ' off'}` },
            h('input', { type: 'checkbox', checked: options.mesArtistes || null, disabled: !peutMes || null, onchange: (e) => (options.mesArtistes = e.target.checked) }),
            h(
              'span',
              {},
              h('strong', {}, 'Mes artistes'),
              h('small', {}, peutMes ? `Seulement tes ${mesIds.length} artistes UnderSpace` : 'Relie ton Deezer ou coche au moins 4 artistes pour l’activer'),
            ),
          ),
        ),
        h('button', { type: 'button', class: 'bt-go', onclick: () => demarrer(peutMes && options.mesArtistes ? mesIds : jouables) }, icon('play'), ' Jouer'),
        record() ? h('p', { class: 'muted small' }, `Ton record : ${record()} points`) : null,
      ),
    );
  }

  // --- Partie --------------------------------------------------------------------------
  async function demarrer(pool) {
    partie = { pool: melange(pool), index: 0, score: 0, serie: 0, resultats: [], prochaine: null };
    await manche();
  }

  async function preparer() {
    // tire un artiste encore non joué qui a un extrait disponible
    while (partie && partie.pool.length) {
      const rid = partie.pool.shift();
      const t = await titreAuHasard(rid);
      if (t) {
        const choix = melange([rid, ...leurres(rid, options.difficile)]);
        return { rid, t, choix };
      }
    }
    return null;
  }

  async function manche() {
    if (!partie) return;
    dialog.replaceChildren(entete(), h('div', { class: 'bt-body' }, h('div', { class: 'bt-disc spin' }, h('span', {}, '♪')), h('p', { class: 'muted' }, 'Chargement de l’extrait…')));
    const m = await (partie.prochaine ?? preparer());
    partie && (partie.prochaine = null);
    if (!partie) return;
    if (!m || partie.index >= MANCHES) return fin();
    partie.courante = m;
    partie.prochaine = partie.index + 1 < MANCHES ? preparer() : null; // on prépare la suivante pendant qu'on joue

    audio.src = m.t.preview;
    audio.currentTime = 0;
    audio.play().catch(() => {});

    const barre = h('div', { class: 'bt-bar' }, h('i'));
    const boutons = m.choix.map((rid) => {
      const r = byId.get(rid);
      return h(
        'button',
        { type: 'button', class: 'bt-choice', onclick: () => repondre(rid) },
        h('span', { class: 'bt-planet', style: `--c1:${r.planete.couleurs[0]};--c2:${r.planete.couleurs[1]};--c3:${r.planete.couleurs[2]}` }),
        r.nom,
      );
    });
    dialog.replaceChildren(
      entete(h('span', { class: 'bt-score' }, `Manche ${partie.index + 1}/${MANCHES} · ${partie.score} pts`)),
      h(
        'div',
        { class: 'bt-body' },
        h('div', { class: 'bt-disc spin playing' }, h('span', {}, '♪')),
        barre,
        h('p', { class: 'bt-question' }, 'Qui est cet artiste ?'),
        h('div', { class: 'bt-choices' }, boutons),
      ),
    );

    // compte à rebours
    const debut = performance.now();
    const tick = () => {
      const reste = Math.max(0, DUREE - (performance.now() - debut) / 1000);
      barre.firstChild.style.width = `${(reste / DUREE) * 100}%`;
      barre.classList.toggle('urgent', reste < 4);
      if (reste <= 0) return repondre(null);
      timer = requestAnimationFrame(tick);
    };
    partie.debut = debut;
    timer = requestAnimationFrame(tick);
  }

  function repondre(rid) {
    if (!partie?.courante) return;
    cancelAnimationFrame(timer);
    const m = partie.courante;
    partie.courante = null;
    const reste = Math.max(0, DUREE - (performance.now() - partie.debut) / 1000);
    const bon = rid === m.rid;
    let gain = 0;
    if (bon) {
      partie.serie++;
      gain = 50 + Math.round((50 * reste) / DUREE) + (partie.serie >= 2 ? 10 * (partie.serie - 1) : 0);
      partie.score += gain;
    } else partie.serie = 0;
    partie.resultats.push({ rid: m.rid, t: m.t, bon, gain });
    partie.index++;

    // révélation
    const r = byId.get(m.rid);
    dialog.querySelectorAll('.bt-choice').forEach((b, i) => {
      b.disabled = true;
      const id = m.choix[i];
      if (id === m.rid) b.classList.add('good');
      else if (id === rid) b.classList.add('bad');
    });
    dialog.querySelector('.bt-question')?.replaceWith(
      h(
        'div',
        { class: `bt-reveal ${bon ? 'good' : 'bad'}` },
        h('img', { src: m.t.album?.cover_medium ?? '', alt: '' }),
        h(
          'div',
          {},
          h('p', { class: 'bt-verdict' }, bon ? `Bien vu ! +${gain} pts${partie.serie >= 2 ? ` (série ×${partie.serie})` : ''}` : rid ? 'Raté !' : 'Temps écoulé !'),
          h('p', {}, h('strong', {}, m.t.title), ' — ', r.nom),
          h('a', { href: `artiste.html?id=${encodeURIComponent(m.rid)}`, target: '_blank' }, 'Découvrir sa page ↗'),
        ),
      ),
    );
    dialog.querySelector('.bt-body').append(
      h('button', { type: 'button', class: 'bt-go', onclick: () => manche() }, partie.index >= MANCHES ? 'Voir mon score' : 'Manche suivante →'),
    );
    dialog.querySelector('.bt-score').textContent = `Manche ${partie.index}/${MANCHES} · ${partie.score} pts`;
    dialog.querySelector('.bt-disc')?.classList.remove('playing');
  }

  function fin() {
    audio.pause();
    const p = partie;
    if (!p) return;
    const bons = p.resultats.filter((x) => x.bon).length;
    const ancien = record();
    const nouveauRecord = p.score > ancien;
    if (nouveauRecord) {
      try {
        localStorage.setItem(RECORD_KEY, String(p.score));
      } catch {}
    }
    const texte = `Blind test UnderSpace : ${p.score} pts (${bons}/${p.resultats.length} bonnes réponses)${options.difficile ? ' en mode difficile' : ''} ! Tu fais mieux ?`;
    dialog.replaceChildren(
      entete(),
      h(
        'div',
        { class: 'bt-body bt-fin' },
        h('p', { class: 'bt-final' }, `${p.score} pts`),
        h('p', {}, `${bons} bonne${bons > 1 ? 's' : ''} réponse${bons > 1 ? 's' : ''} sur ${p.resultats.length}`),
        nouveauRecord ? h('p', { class: 'bt-record' }, 'Nouveau record !') : ancien ? h('p', { class: 'muted small' }, `Ton record : ${ancien} pts`) : null,
        h(
          'ol',
          { class: 'bt-recap' },
          p.resultats.map((x) =>
            h(
              'li',
              { class: x.bon ? 'good' : 'bad' },
              h('img', { src: x.t.album?.cover_small ?? '', alt: '' }),
              h('span', {}, h('strong', {}, byId.get(x.rid).nom), h('small', {}, x.t.title)),
              h('em', {}, x.bon ? `+${x.gain}` : '✗'),
              h('button', { type: 'button', title: 'Voir sa planète', onclick: () => (fermer(), onSelect(x.rid)) }, icon('planet')),
            ),
          ),
        ),
        h(
          'div',
          { class: 'bt-actions' },
          h('button', { type: 'button', class: 'bt-go', onclick: accueil }, '↺ Rejouer'),
          h(
            'button',
            {
              type: 'button',
              onclick: async (e) => {
                try {
                  await navigator.clipboard.writeText(texte);
                  e.target.textContent = 'Copié ✓';
                } catch {
                  e.target.textContent = 'Copie impossible';
                }
              },
            },
            icon('copy'), ' Copier mon score',
          ),
        ),
      ),
    );
    partie = null;
  }
}
