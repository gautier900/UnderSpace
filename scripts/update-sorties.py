"""Met à jour les sorties (projets et singles) de tous les artistes depuis l'API publique Deezer.

    python3 scripts/update-sorties.py            → ajoute les nouvelles sorties + complète les dates manquantes
    python3 scripts/update-sorties.py --essai    → affiche ce qui changerait, sans rien écrire
    python3 scripts/update-sorties.py keeqaid sean   → seulement ces artistes (identifiants)

Règles :
- seules les sorties où l'artiste est l'artiste PRINCIPAL sont ajoutées (pas ses featurings chez les autres) ;
- rien n'est jamais supprimé ni écrasé : on ajoute ce qui manque, et on complète la date
  des sorties qui n'en avaient pas (utile pour le badge 🔥 et la galaxie des sorties) ;
- les singles sont limités aux MAX_SINGLES plus récents : un single plus ancien que ceux gardés
  n'est même pas lu (avant, chaque passage relisait ~200 vieux singles pour rien) ;
- un « single » qui n'est qu'un morceau d'un album/EP du même artiste sorti à quelques jours près
  (± 2 jours) est ignoré : Deezer publie parfois chaque morceau d'un nouvel album comme un single séparé ;
- les titres listés dans « sortiesIgnorees » d'un artiste ne sont jamais ajoutés
  (utile quand Deezer mélange un homonyme dans son profil).
Utilise src/data/liens.js (identifiants Deezer, générés par scripts/build-liens.py).
"""
import json, os, re, sys, threading, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src/data/rappeurs.json')
LIENS = os.path.join(ROOT, 'src/data/liens.js')
MAX_SINGLES = 30
TYPES = {'album': 'Album', 'ep': 'EP', 'single': 'Single', 'compile': 'Compilation'}
# « (feat. X) » — gère aussi les parenthèses imbriquées : « (feat. (D)Juno & 13Jenaya) »
FEAT_RE = re.compile(r'\s*[\(\[](?:feat\.?|ft\.?|featuring|with|avec)\s+(?:[^()\[\]]|\([^()]*\))*[\)\]]', re.I)
# Titres jamais ajoutés automatiquement (insultes racistes).
EXCLURE_RE = re.compile(r'\bnigg', re.I)


def norm(s):
    s = FEAT_RE.sub('', s or '')
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s.replace('$', 's'))


# Deezer tolère ~50 requêtes / 5 s : les appels sont espacés, toutes tâches confondues
# (plusieurs artistes sont traités en parallèle pour ne pas attendre chaque réponse l'une après l'autre).
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
                if d['error'].get('code') == 4:  # quota : on patiente
                    time.sleep(5)
                    continue
                return None
            return d
        except Exception:
            time.sleep(2)
    return None


def all_albums(did):
    """Toutes les sorties d'un artiste, ou None si Deezer n'a pas répondu."""
    out, index = [], 0
    while index < 400:
        d = get(f'artist/{did}/albums', limit=100, index=index)
        if d is None:
            return None
        out += d.get('data', [])
        if not d.get('next'):
            break
        index += 100
    return out


from datetime import date as _date
FENETRE_ALBUM = 2  # jours : un « single » sorti à ± 2 jours d'un album qui le contient = un morceau publié à part


def jours_entre(a, b):
    try:
        return abs((_date.fromisoformat(a) - _date.fromisoformat(b)).days)
    except Exception:
        return 9999


def main():
    essai = '--essai' in sys.argv
    cibles = {a for a in sys.argv[1:] if not a.startswith('--')}
    data = json.load(open(DATA))
    txt = open(LIENS).read()
    liens = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    a_traiter = [r for r in data if (liens.get(r['id']) or {}).get('deezerId') and (not cibles or r['id'] in cibles)]

    def traiter(r):
        """Met à jour un artiste ; renvoie (sorties ajoutées, dates complétées)."""
        did = liens[r['id']]['deezerId']
        ajouts, dates = [], 0
        projets = r.setdefault('projets', [])
        singles = r.setdefault('singles', [])
        ignorees = {norm(t) for t in r.get('sortiesIgnorees', [])}
        connus = {}
        for it in projets:
            connus[('p', norm(it['titre']))] = it
        for it in singles:
            connus[('s', norm(it['titre']))] = it

        # date du plus ancien single gardé : en dessous, inutile de lire (il serait retiré aussitôt)
        cle_tri = lambda x: x.get('date') or str(x.get('annee', 0))
        gardes = sorted((cle_tri(x) for x in singles), reverse=True)
        seuil = gardes[MAX_SINGLES - 1] if len(gardes) >= MAX_SINGLES else ''

        albums = all_albums(did)
        if albums is None:
            return [], 0, r['nom']  # Deezer n'a pas répondu : on le signale, rien n'est modifié
        # albums/EP de l'artiste, pour reconnaître leurs morceaux publiés en « singles »
        longs = [a for a in albums if a.get('record_type') != 'single' and a.get('release_date')]
        pistes = {}
        def morceaux_de(alb):
            if alb['id'] not in pistes:
                d = get(f"album/{alb['id']}/tracks", limit=100) or {}
                pistes[alb['id']] = {norm(t.get('title')) for t in d.get('data', [])}
            return pistes[alb['id']]

        for al in albums:
            date = al.get('release_date')
            titre = al.get('title') or ''
            if not date or not titre or EXCLURE_RE.search(titre) or norm(titre) in ignorees:
                continue
            rtype = TYPES.get(al.get('record_type'), 'Album')
            cle = ('s' if rtype == 'Single' else 'p', norm(titre))
            deja = connus.get(cle) or connus.get(('p' if cle[0] == 's' else 's', cle[1]))
            if deja:
                if not deja.get('date'):  # on complète la date manquante
                    deja['date'] = date
                    deja['annee'] = int(date[:4])
                    dates += 1
                continue
            if rtype == 'Single':
                if seuil and date < seuil:
                    continue  # plus ancien que les MAX_SINGLES singles gardés
                if any(jours_entre(date, a['release_date']) <= FENETRE_ALBUM and cle[1] in morceaux_de(a) for a in longs):
                    continue  # morceau d'un album/EP publié à part le même jour
            det = get(f"album/{al['id']}") or {}
            if (det.get('artist') or {}).get('id') != did:
                continue  # l'artiste n'est pas l'artiste principal
            item = {'titre': FEAT_RE.sub('', titre).strip(), 'annee': int(date[:4]), 'date': date}
            lien = det.get('link') or f"https://www.deezer.com/album/{al['id']}"
            if rtype == 'Single':
                feats = [c['name'] for c in det.get('contributors', []) if c.get('id') != did and c.get('name')]
                if feats:
                    item['featurings'] = feats[:4]
                item['lien'] = lien
                singles.append(item)
            else:
                item = {'titre': item['titre'], 'type': rtype, 'annee': item['annee'], 'date': date, 'titres': det.get('nb_tracks') or None}
                if det.get('cover_medium'):
                    item['cover'] = det['cover_medium']
                item['lien'] = lien
                if not item['titres']:
                    del item['titres']
                projets.append(item)
            connus[cle] = item
            ajouts.append(f"{r['nom']} — {rtype} « {item['titre']} » ({date})")

        projets.sort(key=cle_tri, reverse=True)
        singles.sort(key=cle_tri, reverse=True)
        del singles[MAX_SINGLES:]
        if not projets:
            del r['projets']
        if not singles:
            del r['singles']
        return ajouts, dates, None

    ajouts, dates, rates = [], 0, []
    # 6 artistes à la fois : au-delà, Deezer commence à refuser des requêtes
    with ThreadPoolExecutor(max_workers=6) as ex:
        for a, n, rate in ex.map(traiter, a_traiter):
            ajouts += a
            dates += n
            if rate:
                rates.append(rate)

    print(f'{len(ajouts)} nouvelle(s) sortie(s), {dates} date(s) complétée(s)')
    if rates:
        print(f"⚠ Deezer n'a pas répondu pour {len(rates)} artiste(s), relance plus tard : {', '.join(rates)}")
    for a in ajouts[:200]:
        print('  +', a)
    if essai:
        print('(mode essai : rien n’a été écrit)')
    elif ajouts or dates:
        with open(DATA, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')


main()
