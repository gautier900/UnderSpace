// Jeu « Six degrés » : relier deux artistes par leurs featurings.
//   - Relier : on choisit deux artistes, le site trouve le chemin le plus court ;
//   - Défi   : deux artistes tirés au sort, à toi de trouver une chaîne de featurings.
import { icon } from './icons.js';
import { rappeurs } from './data/rappeurs.js';
import { byId, chemin, lienEntre, defiAleatoire, stats } from './graphe.js';

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
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]/g, '');
const idFromName = (txt) => rappeurs.find((r) => norm(r.nom) === norm(txt))?.id ?? null;
const dot = (r) => h('span', { class: 'six-dot', style: `--c1:${r.planete.couleurs[0]};--c2:${r.planete.couleurs[2]}` });

export function setupSixDegres({ onShowPath, onSelect }) {
  const btn = document.getElementById('six-btn');
  const panel = document.getElementById('six');
  let tab = 'relier';
  let defi = null; // { a, b, solution, chaine: [ids], fini, abandon }

  // liste d'autocomplétion partagée
  const datalist = h('datalist', { id: 'six-artistes' }, rappeurs.map((r) => h('option', { value: r.nom })));
  document.body.append(datalist);

  btn.addEventListener('click', () => (panel.hidden ? open() : close()));
  function open() {
    panel.hidden = false;
    render();
  }
  function close() {
    panel.hidden = true;
    onShowPath(null);
  }
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && document.activeElement?.tagName !== 'INPUT' && close());

  // Affichage d'une chaîne : artiste → lien → artiste …
  function chainView(ids, { proches = false } = {}) {
    const items = [];
    ids.forEach((id, i) => {
      const r = byId.get(id);
      items.push(
        h('li', { class: 'six-node' }, h('button', { type: 'button', onclick: () => onSelect(id) }, dot(r), r.nom)),
      );
      if (i < ids.length - 1) {
        const l = lienEntre(id, ids[i + 1], { proches: true });
        const feat = l.find((e) => e.type === 'feat');
        items.push(
          h(
            'li',
            { class: `six-edge${feat ? '' : ' proche'}` },
            feat
              ? (() => {
                  const chezLui = feat.de === id || feat.de === ids[i + 1];
                  const auteur = feat.de ? byId.get(feat.de)?.nom : feat.deNom;
                  return `${chezLui ? 'feat.' : 'ensemble'} sur « ${feat.titre} »${!chezLui && auteur ? ` de ${auteur}` : ''}${feat.projet || feat.annee ? ` (${[feat.projet, feat.annee].filter(Boolean).join(', ')})` : ''}`;
                })()
              : 'artistes proches selon Deezer',
          ),
        );
      }
    });
    return h('ol', { class: 'six-chain' }, items);
  }

  // --- Onglet « Relier » --------------------------------------------------------------
  const relierState = { a: '', b: '', proches: false, result: null };
  function renderRelier() {
    const inA = h('input', { type: 'text', list: 'six-artistes', placeholder: 'Premier artiste', value: relierState.a });
    const inB = h('input', { type: 'text', list: 'six-artistes', placeholder: 'Second artiste', value: relierState.b });
    const proches = h('input', { type: 'checkbox', checked: relierState.proches });
    const go = (e) => {
      e?.preventDefault();
      relierState.a = inA.value;
      relierState.b = inB.value;
      relierState.proches = proches.checked;
      const a = idFromName(inA.value);
      const b = idFromName(inB.value);
      if (!a || !b) {
        relierState.result = { erreur: 'Choisis deux artistes de la liste.' };
      } else {
        let p = chemin(a, b, { proches: relierState.proches });
        let auto = false;
        if (!p && !relierState.proches) {
          p = chemin(a, b, { proches: true });
          auto = !!p;
        }
        relierState.result = p ? { p, auto } : { erreur: 'Aucun chemin trouvé entre ces deux artistes.' };
        onShowPath(p);
      }
      render();
    };
    const res = relierState.result;
    return h(
      'form',
      { class: 'six-form', onsubmit: go },
      h('p', { class: 'muted small' }, `${stats.artistesRelies} artistes reliés par ${stats.feats} featurings dans la galaxie.`),
      inA,
      h('div', { class: 'six-swap' }, h('button', { type: 'button', title: 'Inverser', onclick: () => ([inA.value, inB.value] = [inB.value, inA.value]) }, '⇅')),
      inB,
      h('label', { class: 'six-check' }, proches, 'Passer aussi par les « artistes proches » (Deezer)'),
      h('div', { class: 'six-actions' }, h('button', { type: 'submit', class: 'six-go' }, icon('link'), ' Relier'), h('button', { type: 'button', onclick: () => {
        const ids = rappeurs.map((r) => r.id);
        inA.value = byId.get(ids[Math.floor(Math.random() * ids.length)]).nom;
        inB.value = byId.get(ids[Math.floor(Math.random() * ids.length)]).nom;
        go();
      } }, icon('dice'), ' Au hasard')),
      res?.erreur ? h('p', { class: 'six-msg error' }, res.erreur) : null,
      res?.p
        ? h(
            'div',
            { class: 'six-result' },
            h('p', { class: 'six-degres' }, res.p.length === 1 ? 'C’est le même artiste' : `${res.p.length - 1} degré${res.p.length > 2 ? 's' : ''}`),
            res.auto ? h('p', { class: 'muted small' }, 'Pas de chaîne de featurings : chemin trouvé grâce aux artistes proches.') : null,
            chainView(res.p),
          )
        : null,
    );
  }

  // --- Onglet « Défi » ----------------------------------------------------------------
  function nouveauDefi() {
    const d = defiAleatoire(3, 5);
    defi = d ? { ...d, chaine: [d.a], fini: false, abandon: false, msg: null } : null;
    onShowPath(defi ? [defi.a, defi.b] : null);
    render();
  }
  function renderDefi() {
    if (!defi) {
      return h(
        'div',
        { class: 'six-form' },
        h('p', {}, 'Deux artistes sont tirés au sort. Relie-les en enchaînant des artistes qui ont fait un featuring ensemble.'),
        h('p', { class: 'muted small' }, 'Plus ta chaîne est courte, mieux c’est !'),
        h('button', { type: 'button', class: 'six-go', onclick: nouveauDefi }, icon('dice'), ' Lancer un défi'),
      );
    }
    const last = defi.chaine[defi.chaine.length - 1];
    const optimal = defi.solution.length - 1;
    const input = h('input', { type: 'text', list: 'six-artistes', placeholder: 'Artiste suivant…', autocomplete: 'off' });
    const submit = (e) => {
      e.preventDefault();
      const id = idFromName(input.value);
      if (!id) defi.msg = { txt: 'Choisis un artiste de la liste.', err: true };
      else if (defi.chaine.includes(id)) defi.msg = { txt: `${byId.get(id).nom} est déjà dans ta chaîne.`, err: true };
      else if (!lienEntre(last, id).length) defi.msg = { txt: `Pas de featuring entre ${byId.get(last).nom} et ${byId.get(id).nom}.`, err: true };
      else {
        defi.chaine.push(id);
        defi.msg = null;
        if (id === defi.b) defi.fini = true;
        onShowPath(defi.fini ? defi.chaine : [...defi.chaine, defi.b]);
      }
      render();
      panel.querySelector('.six-defi-input')?.focus();
    };
    input.classList.add('six-defi-input');
    const steps = defi.chaine.length - 1;
    return h(
      'div',
      { class: 'six-form' },
      h('p', { class: 'six-goal' }, 'Relie ', h('strong', {}, byId.get(defi.a).nom), ' à ', h('strong', {}, byId.get(defi.b).nom)),
      h('p', { class: 'muted small' }, `Meilleur score possible : ${optimal} degré${optimal > 1 ? 's' : ''}.`),
      chainView(defi.chaine),
      defi.fini
        ? h(
            'div',
            { class: 'six-win' },
            h('p', { class: 'six-degres' }, defi.abandon ? 'Solution' : steps <= optimal ? `Parfait : ${steps} degrés !` : `Gagné en ${steps} degrés`),
            !defi.abandon && steps > optimal ? h('p', { class: 'muted small' }, `Le chemin le plus court en faisait ${optimal}.`) : null,
          )
        : h(
            'form',
            { class: 'six-defi-form', onsubmit: submit },
            h('p', { class: 'muted small' }, `Qui a fait un featuring avec ${byId.get(last).nom} ?`),
            input,
            defi.msg ? h('p', { class: `six-msg${defi.msg.err ? ' error' : ''}` }, defi.msg.txt) : null,
            h(
              'div',
              { class: 'six-actions' },
              h('button', { type: 'submit', class: 'six-go' }, 'Valider'),
              h('button', {
                type: 'button',
                onclick: () => {
                  const p = chemin(last, defi.b);
                  defi.msg = p ? { txt: `Indice : essaie un artiste dont le nom commence par « ${byId.get(p[1]).nom[0]} ».` } : { txt: 'Plus de chemin depuis ici : reviens en arrière avec « Recommencer ».', err: true };
                  render();
                },
              }, icon('bulb'), ' Indice'),
              h('button', {
                type: 'button',
                onclick: () => {
                  defi.chaine = defi.solution;
                  defi.fini = defi.abandon = true;
                  onShowPath(defi.solution);
                  render();
                },
              }, 'Solution'),
            ),
          ),
      h(
        'div',
        { class: 'six-actions' },
        h('button', { type: 'button', onclick: () => ((defi.chaine = [defi.a]), (defi.fini = defi.abandon = false), (defi.msg = null), onShowPath([defi.a, defi.b]), render()) }, '↺ Recommencer'),
        h('button', { type: 'button', onclick: nouveauDefi }, icon('dice'), ' Nouveau défi'),
      ),
    );
  }

  function render() {
    panel.replaceChildren(
      ...[
        h('button', { class: 'gx-close', type: 'button', 'aria-label': 'Fermer', onclick: close }, '×'),
        h('h2', {}, icon('link'), ' Six degrés'),
        h(
          'div',
          { class: 'six-tabs' },
          h('button', { type: 'button', class: tab === 'relier' ? 'on' : '', onclick: () => ((tab = 'relier'), onShowPath(relierState.result?.p ?? null), render()) }, 'Relier deux artistes'),
          h('button', { type: 'button', class: tab === 'defi' ? 'on' : '', onclick: () => ((tab = 'defi'), onShowPath(defi ? (defi.fini ? defi.chaine : [...defi.chaine, defi.b]) : null), render()) }, 'Défi'),
        ),
        tab === 'relier' ? renderRelier() : renderDefi(),
      ].filter(Boolean),
    );
  }
}
