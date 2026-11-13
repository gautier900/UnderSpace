"""Collecte les featurings morceau par morceau depuis l'API Deezer, pour Six degrés et les constellations.

    python3 scripts/build-feats.py           → traite seulement les projets pas encore vus
    python3 scripts/build-feats.py --tout    → recommence tout
    python3 scripts/build-feats.py luvbfk 32 → seulement ces artistes (identifiants)
    python3 scripts/build-feats.py --local   → sans Deezer : régénère seulement le fichier du site
                                               (utile après avoir ajouté ou renommé un artiste)

Pourquoi : les fiches ne gardent que les featurings des singles de l'artiste. Il manquait :
  - les feats cachés dans ses albums (ex. 32 sur « DUBAI&CHOCOLAT », dans HATEBFK de LuvBFK) ;
  - ses apparitions chez des artistes HORS galaxie (ex. Huntrill et Tedax Max sur « tarif groupé »,
    dans REPLICA 2 de Hologram Lo'), et ses singles au-delà des 30 gardés dans la fiche.

Deux fichiers :
  - scripts/feats-cache.json (COMPLET, lu seulement par ce script, jamais chargé par le site) :
    tous les morceaux à plusieurs artistes, y compris ceux hors galaxie. Si on ajoute un jour un
    artiste (ex. JeanJass), ses feats passés sont déjà connus : rien à relire sur Deezer.
  - src/data/feats.json (ALLÉGÉ, chargé par le site) : seulement les morceaux qui relient au moins
    deux artistes de la galaxie. Il est régénéré à chaque passage du script.

Format du cache, deux sortes d'entrées (clé = id de la sortie Deezer) :
  - projet de l'artiste : { "rid", "projet", "annee", "morceaux": [[titre, [[idDeezer, nom] des invités]]] }
  - apparition / autre sortie : { "principal": [idDeezer, nom], "projet"?, "annee",
                                  "morceaux": [[titre, [[idDeezer, nom] de TOUS les artistes du morceau]]] }
On ne garde que les morceaux à plusieurs artistes. Les titres listés dans « sortiesIgnorees »
(homonymes mélangés dans certains profils Deezer) ne sont jamais lus.
Utilise src/data/liens.js (identifiants Deezer, générés par scripts/build-liens.py).
"""
import json, os, re, sys, threading, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src/data/rappeurs.json')
LIENS = os.path.join(ROOT, 'src/data/liens.js')
OUT = os.path.join(ROOT, 'scripts/feats-cache.json')       # complet (script uniquement)
COMPACT = os.path.join(ROOT, 'src/data/feats.json')         # allégé (chargé par le site)
ANCIEN = os.path.join(ROOT, 'src/data/feats-projets.json')  # ancien nom du cache
FEAT_RE = re.compile(r'\s*[\(\[](?:feat\.?|ft\.?|featuring|with|avec)\s+(?:[^()\[\]]|\([^()]*\))*[\)\]]', re.I)


def norm(s):
    s = FEAT_RE.sub('', s or '')
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s.replace('$', 's'))


# Deezer tolère ~50 requêtes / 5 s : on espace les appels (toutes les tâches confondues).
_lock = threading.Lock()
_next = [0.0]
def get(path, **params):
    url = 'https://api.deezer.com/' + path + ('?' + urllib.parse.urlencode(params) if params else '')
    for _ in range(5):
        with _lock:
            wait = _next[0] - time.time()
            _next[0] = max(_next[0], time.time()) + 0.115
        if wait > 0:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                d = json.load(r)
            if isinstance(d, dict) and d.get('error'):
                if d['error'].get('code') == 4:  # quota dépassé : on patiente
                    time.sleep(5)
                    continue
                return None
            return d
        except Exception:
            time.sleep(2)
    return None


def all_albums(did):
    out, index = [], 0
    while index < 400:
        d = get(f'artist/{did}/albums', limit=100, index=index) or {}
        out += d.get('data', [])
        if not d.get('next'):
            break
        index += 100
    return out


ERREUR = object()  # lecture ratée (réseau, quota) : rien n'est mémorisé, on réessaiera la prochaine fois


def lire_album(al, did, rid, projet):
    det = get(f"album/{al['id']}")
    if det is None:
        return ERREUR
    if (det.get('artist') or {}).get('id') != did:
        return None  # l'artiste n'est pas l'artiste principal
    morceaux = []
    for t in (det.get('tracks') or {}).get('data', []):
        tr = get(f"track/{t['id']}")
        if tr is None:
            return ERREUR
        invites = [[c['id'], c['name']] for c in tr.get('contributors', []) if c.get('id') != did and c.get('name')]
        if invites:
            morceaux.append([FEAT_RE.sub('', t.get('title') or '').strip(), invites[:6]])
    return {'rid': rid, 'projet': projet['titre'], 'annee': projet.get('annee'), 'morceaux': morceaux}


def lire_sortie(al):
    """Toute autre sortie où l'artiste apparaît (single, album d'un autre artiste…)."""
    det = get(f"album/{al['id']}")
    if det is None:
        return ERREUR
    morceaux = []
    for t in (det.get('tracks') or {}).get('data', [])[:40]:
        tr = get(f"track/{t['id']}")
        if tr is None:
            return ERREUR
        tous = [[c['id'], c['name']] for c in tr.get('contributors', []) if c.get('name')]
        if len(tous) >= 2:
            morceaux.append([FEAT_RE.sub('', t.get('title') or '').strip(), tous[:8]])
    princ = det.get('artist') or {}
    out = {'principal': [princ.get('id'), princ.get('name')], 'annee': int((det.get('release_date') or '0')[:4]) or None, 'morceaux': morceaux}
    if det.get('record_type') != 'single':
        out['projet'] = det.get('title')
    return out


def compacter(res, data, liens):
    """Fichier du site : [titre, année, projet, idAuteur | null, nomAuteur | null, [ids UnderSpace]]."""
    par_deezer = {l['deezerId']: rid for rid, l in liens.items() if l.get('deezerId')}
    par_nom = {norm(r['nom']): r['id'] for r in data}
    ids_valides = {r['id'] for r in data}
    idof = lambda a: par_deezer.get(a[0]) or par_nom.get(norm(a[1]))
    out, deja = [], set()
    for al in res['albums'].values():
        rid = al.get('rid') if al.get('rid') in ids_valides else None
        if al.get('rid') and not rid:
            continue  # artiste retiré de la galaxie
        auteur = rid or idof(al.get('principal') or [None, ''])
        nom_auteur = None if auteur else (al.get('principal') or [None, None])[1]
        for titre, artistes in al.get('morceaux', []):
            ids = sorted({x for x in ([rid] if rid else []) + [idof(a) for a in artistes] if x})
            if len(ids) < 2:
                continue
            cle = (norm(titre), tuple(ids))
            if cle in deja:
                continue  # même morceau en single et sur l'album : une seule fois
            deja.add(cle)
            out.append([titre, al.get('annee'), al.get('projet'), auteur, nom_auteur, ids])
    out.sort(key=lambda m: (-(m[1] or 0), norm(m[0])))
    with open(COMPACT, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    return len(out)


def main():
    tout = '--tout' in sys.argv
    if not os.path.exists(OUT) and os.path.exists(ANCIEN):
        os.replace(ANCIEN, OUT)  # migration depuis l'ancien emplacement
    cibles = {a for a in sys.argv[1:] if not a.startswith('--')}
    data = json.load(open(DATA))
    txt = open(LIENS).read()
    liens = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    res = {'albums': {}}
    if os.path.exists(OUT) and not tout:
        res = json.load(open(OUT))
    # anciennes entrées vides (projet d'un autre artiste) : on les relit avec la nouvelle méthode
    for k in [k for k, v in res['albums'].items() if not v.get('rid') and not v.get('principal')]:
        del res['albums'][k]
    vus = set(res['albums'])
    if '--local' in sys.argv:
        n = compacter(res, data, liens)
        print(f"{n} morceaux entre artistes UnderSpace → {os.path.relpath(COMPACT, ROOT)}")
        return

    # 1. on repère, pour chaque artiste, les albums Deezer qui correspondent à ses projets
    taches = []
    artistes = [r for r in data if (liens.get(r['id']) or {}).get('deezerId') and (not cibles or r['id'] in cibles)]
    for i, r in enumerate(artistes, 1):
        did = liens[r['id']]['deezerId']
        projets = {norm(p['titre']): p for p in r.get('projets', [])}
        ignorees = {norm(t) for t in r.get('sortiesIgnorees', [])}
        trouves = set()
        for al in all_albums(did):
            cle = norm(al.get('title'))
            if cle in ignorees or str(al['id']) in vus:
                continue
            if al.get('record_type') != 'single' and cle in projets:
                trouves.add(cle)
                taches.append((al, did, r['id'], projets[cle]))
            else:
                taches.append((al,))  # apparition, single, album d'un autre artiste…
            vus.add(str(al['id']))
        # La liste des albums d'un artiste renvoyée par Deezer en oublie parfois :
        # on cherche les projets manquants un par un (même artiste, même titre).
        for cle, p in projets.items():
            if cle in trouves or cle in ignorees:
                continue
            for al in (get('search/album', q=f"{r['nom']} {p['titre']}", limit=10) or {}).get('data', []):
                if norm(al.get('title')) == cle and (al.get('artist') or {}).get('id') == did and al.get('record_type') != 'single':
                    if str(al['id']) not in vus:
                        taches.append((al, did, r['id'], p))
                        vus.add(str(al['id']))
                    break
        print(f'\r[{i}/{len(artistes)}] {len(taches)} sortie(s) à lire', end='', flush=True)
    print()

    # 2. on lit les morceaux (plusieurs albums en parallèle, débit limité par get())
    fait = erreurs = 0
    def run(t):
        return t[0]['id'], (lire_album(*t) if len(t) > 1 else lire_sortie(t[0]))
    with ThreadPoolExecutor(max_workers=6) as ex:
        for alid, out in ex.map(run, taches):
            fait += 1
            if out is ERREUR:
                erreurs += 1
                continue
            # un album écarté (autre artiste principal) est mémorisé sans morceaux, pour ne pas le relire
            res['albums'][str(alid)] = out or {'morceaux': []}
            if fait % 10 == 0 or fait == len(taches):
                print(f'\r{fait}/{len(taches)} sorties lues', end='', flush=True)
                with open(OUT, 'w') as f:  # sauvegarde régulière : on peut interrompre et reprendre
                    json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    print()
    with open(OUT, 'w') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    n = sum(len(a['morceaux']) for a in res['albums'].values())
    print(f"{len(res['albums'])} sorties connues, {n} morceaux à plusieurs artistes → {os.path.relpath(OUT, ROOT)}")
    k = compacter(res, data, liens)
    print(f"{k} morceaux entre artistes UnderSpace → {os.path.relpath(COMPACT, ROOT)} (fichier du site)")
    if erreurs:
        print(f"{erreurs} projet(s) non lus à cause d'une erreur Deezer : relance le script pour les rattraper.")


main()
