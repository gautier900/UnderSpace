// Interface « Ma galaxie » : relier son profil Deezer, voir ses recommandations et ses favoris.
import { icon } from './icons.js';
import { rappeurs } from './data/rappeurs.js';
import { perso, NB_RECOS } from './perso.js';
import { parseProfile, fetchProfile, saveProfile, clearProfile } from './deezer.js';
import { createMaGalaxie } from './ma-galaxie-3d.js';

const byId = new Map(rappeurs.map((r) => [r.id, r]));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

function depuis(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 48) return `il y a ${hrs} h`;
  return `il y a ${Math.round(hrs / 24)} jours`;
}

export function setupMoi({ onSelect, onPause = () => {} }) {
  const btn = document.getElementById('moi-btn');
  const drawer = document.getElementById('galaxie');
  const dialog = document.getElementById('connect-dialog');

  // --- Bouton du haut ---------------------------------------------------------
  if (perso.connecte) {
    btn.replaceChildren(
      h('span', { class: 'hb-ico' }, perso.profil.user.image ? h('img', { class: 'moi-avatar', src: perso.profil.user.image, alt: '' }) : icon('planet')),
      h('span', { class: 'hb-txt' }, 'Ma galaxie'),
    );
    btn.title = `Profil Deezer : ${perso.profil.user.nom}`;
  } else if (perso.ecoutes.size) {
    btn.querySelector('.hb-txt').textContent = 'Ma galaxie';
  }
  btn.addEventListener('click', () => (perso.connecte || perso.ecoutes.size ? toggleDrawer() : openDialog()));

  // --- Fenêtre de connexion ----------------------------------------------------
  function openDialog() {
    const input = h('input', {
      type: 'text',
      class: 'connect-input',
      placeholder: 'https://www.deezer.com/fr/profile/123456789',
      autocomplete: 'off',
    });
    const status = h('p', { class: 'connect-status', role: 'status' });
    const go = h('button', { class: 'connect-go', type: 'submit' }, 'Relier mon Deezer');
    const form = h(
      'form',
      {
        method: 'dialog',
        onsubmit: async (e) => {
          e.preventDefault();
          status.classList.remove('error');
          let id;
          try {
            id = parseProfile(input.value);
          } catch (err) {
            status.textContent = err.message;
            status.classList.add('error');
            return;
          }
          go.disabled = input.disabled = true;
          try {
            const profil = await fetchProfile(id, (msg) => (status.textContent = msg));
            saveProfile(profil);
            status.textContent = `Bienvenue ${profil.user.nom} ! Calcul de ta galaxie…`;
            setTimeout(() => location.reload(), 600);
          } catch (err) {
            status.textContent = err.message;
            status.classList.add('error');
            go.disabled = input.disabled = false;
          }
        },
      },
      h('h2', {}, 'Relier mon Deezer'),
      h(
        'p',
        { class: 'connect-help' },
        'Colle le lien de ton profil Deezer. UnderSpace lit seulement tes favoris publics (artistes, albums, titres et playlists) : aucun mot de passe, rien ne quitte ton navigateur.',
      ),
      h(
        'details',
        { class: 'connect-how' },
        h('summary', {}, 'Où trouver ce lien ?'),
        h(
          'ol',
          {},
          h('li', {}, 'Sur deezer.com, clique sur ta photo de profil puis sur « Mon profil ».'),
          h('li', {}, "Copie l'adresse de la page : elle ressemble à deezer.com/fr/profile/123456789."),
          h('li', {}, 'Ton profil doit être public (Paramètres → Confidentialité).'),
        ),
      ),
      input,
      status,
      h(
        'div',
        { class: 'connect-actions' },
        h('button', { type: 'button', class: 'connect-cancel', onclick: () => dialog.close() }, 'Annuler'),
        go,
      ),
      h(
        'p',
        { class: 'connect-note' },
        'Pourquoi pas une vraie connexion ? Deezer n’accepte plus de nouvelles applications pour la connexion par mot de passe.',
      ),
    );
    dialog.replaceChildren(form);
    dialog.showModal();
    input.focus();
  }

  // --- Tiroir « Ma galaxie » ---------------------------------------------------
  // --- Vue plein écran « Ma galaxie » (système solaire 3D + carte d'infos) ---------
  const overlay = document.getElementById('ma-galaxie');
  const pick = document.getElementById('mg-pick');
  let scene3d = null;

  function toggleDrawer(force) {
    const open = force ?? overlay.hidden;
    if (open === !overlay.hidden) return;
    if (open) {
      if (!drawer.childElementCount) renderDrawer();
      overlay.hidden = false;
      overlay.classList.remove('fade-in');
      void overlay.offsetWidth;
      overlay.classList.add('fade-in');
      onPause(true);
      scene3d ??= createMaGalaxie({ container: document.getElementById('mg-scene'), onPick: showPick });
      scene3d.start();
    } else {
      scene3d?.stop();
      overlay.hidden = true;
      pick.hidden = true;
      onPause(false);
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || overlay.hidden) return;
    if (!pick.hidden) pick.hidden = true;
    else toggleDrawer(false);
  });
  document.getElementById('mg-close').addEventListener('click', () => toggleDrawer(false));
  document.getElementById('mg-card-toggle').addEventListener('click', () => overlay.classList.toggle('card-collapsed'));

  // Petite fiche quand on clique une planète du système.
  function showPick(rid, kind) {
    const r = byId.get(rid);
    const reco = perso.recoOf.get(rid);
    pick.style.setProperty('--accent', r.planete.couleurs[2]);
    pick.replaceChildren(...[
      h('button', { class: 'gx-close', type: 'button', 'aria-label': 'Fermer', onclick: () => (pick.hidden = true) }, '×'),
      h('p', { class: 'mg-pick-kind' }, kind === 'reco' ? 'Recommandé pour toi' : perso.ecoutes.get(rid) === 'manuel' ? 'Coché comme écouté' : 'Dans tes favoris Deezer'),
      h('h3', {}, r.nom),
      kind === 'reco' && reco ? h('p', { class: 'mg-pick-why' }, reco.raisons.join(' · ')) : null,
      r.description ? h('p', { class: 'mg-pick-desc' }, r.description.length > 180 ? r.description.slice(0, 177) + '…' : r.description) : null,
      h(
        'div',
        { class: 'mg-pick-actions' },
        h('a', { class: 'connect-go mg-pick-go', href: `artiste.html?id=${encodeURIComponent(rid)}` }, "Page de l'artiste"),
      ),
    ].filter(Boolean)); // les éléments absents (null) ne doivent pas s'afficher en texte
    pick.hidden = false;
  }

  function planetRow(r, sub, extra) {
    return h(
      'button',
      {
        class: 'gx-row',
        type: 'button',
        onclick: () => {
          toggleDrawer(false);
          onSelect(r.id);
        },
      },
      h('span', { class: 'gx-dot', style: `--c1:${r.planete.couleurs[0]};--c2:${r.planete.couleurs[2]}` }),
      h('span', { class: 'gx-row-text' }, h('strong', {}, r.nom), sub ? h('small', {}, sub) : null),
      extra ?? null,
    );
  }

  function renderDrawer() {
    const p = perso.profil;
    const ecoutes = [...perso.ecoutes.keys()].map((id) => byId.get(id)).filter(Boolean);
    const recos = perso.recos.slice(0, NB_RECOS);

    const header = p
      ? h(
          'div',
          { class: 'gx-head' },
          p.user.image ? h('img', { class: 'gx-avatar', src: p.user.image, alt: '' }) : null,
          h('div', {}, h('h2', {}, 'Ma galaxie'), h('p', { class: 'muted' }, `${p.user.nom} · Deezer · mis à jour ${depuis(p.majLe)}`)),
        )
      : h('div', { class: 'gx-head' }, h('div', {}, h('h2', {}, 'Ma galaxie'), h('p', { class: 'muted' }, 'D’après les artistes que tu as cochés')));

    const stats = h(
      'div',
      { class: 'gx-stats' },
      h('div', {}, h('strong', {}, String(ecoutes.length)), h('span', {}, `/ ${rappeurs.length} artistes UnderSpace écoutés`)),
      p ? h('div', {}, h('strong', {}, String(p.artistes.length)), h('span', {}, 'artistes dans tes favoris')) : null,
    );

    const recoSection = h(
      'section',
      { class: 'gx-section' },
      h('h3', {}, 'Recommandés pour toi'),
      recos.length
        ? recos.map((reco) => planetRow(byId.get(reco.id), reco.raisons.join(' · ')))
        : h('p', { class: 'muted' }, 'Pas encore assez d’infos : ajoute des favoris sur Deezer ou coche des artistes que tu connais.'),
    );

    const ecouteSection = h(
      'section',
      { class: 'gx-section' },
      h('h3', {}, 'Tes artistes UnderSpace'),
      ecoutes.length
        ? h(
            'div',
            { class: 'gx-chips' },
            ecoutes.map((r) =>
              h(
                'button',
                { class: 'gx-chip', type: 'button', onclick: () => (toggleDrawer(false), onSelect(r.id)) },
                r.nom,
                perso.ecoutes.get(r.id) === 'manuel' ? h('small', { class: 'muted' }, ' · coché') : null,
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'Aucun artiste UnderSpace trouvé dans tes favoris pour l’instant.'),
    );

    const favSection = p
      ? h(
          'section',
          { class: 'gx-section' },
          h('h3', {}, 'Tes artistes favoris'),
          h('p', { class: 'muted small' }, 'Classés selon tes favoris Deezer (artistes, albums, titres, playlists). Deezer ne partage pas le nombre d’écoutes.'),
          h(
            'ol',
            { class: 'gx-top' },
            p.artistes.slice(0, 10).map((a) =>
              h('li', {}, a.image ? h('img', { src: a.image, alt: '', loading: 'lazy' }) : h('span', { class: 'gx-noimg' }), a.nom),
            ),
          ),
        )
      : null;

    const albumSection =
      p && p.albums.length
        ? h(
            'section',
            { class: 'gx-section' },
            h('h3', {}, 'Tes albums favoris'),
            h(
              'div',
              { class: 'gx-albums' },
              p.albums.slice(0, 12).map((al) =>
                h(
                  'a',
                  { class: 'gx-album', href: `https://www.deezer.com/album/${al.id}`, target: '_blank', rel: 'noopener', title: `${al.titre} — ${al.artiste}` },
                  h('img', { src: al.cover, alt: '', loading: 'lazy' }),
                  h('span', {}, al.titre),
                ),
              ),
            ),
          )
        : null;

    const actions = h(
      'div',
      { class: 'gx-actions' },
      p
        ? h(
            'button',
            {
              type: 'button',
              onclick: async (e) => {
                e.target.disabled = true;
                e.target.textContent = 'Mise à jour…';
                try {
                  saveProfile(await fetchProfile(p.user.id, (m) => (e.target.textContent = m)));
                  location.reload();
                } catch (err) {
                  e.target.textContent = err.message;
                }
              },
            },
            '↻ Actualiser',
          )
        : h('button', { type: 'button', onclick: () => (toggleDrawer(false), openDialog()) }, icon('headphones'), ' Relier Deezer'),
      p
        ? h(
            'button',
            {
              type: 'button',
              class: 'gx-logout',
              onclick: () => {
                clearProfile();
                location.reload();
              },
            },
            'Délier Deezer',
          )
        : null,
    );

    drawer.replaceChildren(
      ...[header, stats, recoSection, ecouteSection, favSection, albumSection, actions].filter(Boolean),
    );
  }
}
