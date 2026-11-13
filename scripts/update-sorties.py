"""Met à jour les sorties (projets et singles) de tous les artistes depuis l'API publique Deezer.

    python3 scripts/update-sorties.py            → ajoute les nouvelles sorties + complète les dates manquantes
    python3 scripts/update-sorties.py --essai    → affiche ce qui changerait, sans rien écrire
    python3 scripts/update-sorties.py keeqaid sean   → seulement ces artistes (identifiants)

Règles :
- seules les sorties où l'artiste est l'artiste PRINCIPAL sont ajoutées (pas ses featurings chez les autres) ;
- rien n'est jamais supprimé ni écrasé : on ajoute ce qui manque, et on complète la date
  des sorties qui n'en avaient pas (utile pour le badge 🔥 et la galaxie des sorties) ;
- les singles sont limités aux MAX_SINGLES plus récents ;
- les titres listés dans « sortiesIgnorees » d'un artiste ne sont jamais ajoutés
  (utile quand Deezer mélange un homonyme dans son profil).
Utilise src/data/liens.js (identifiants Deezer, générés par scripts/build-liens.py).
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

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


_last = [0.0]
def get(path, **params):
    wait = 0.12 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    url = 'https://api.deezer.com/' + path + ('?' + urllib.parse.urlencode(params) if params else '')
    for _ in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                _last[0] = time.time()
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
    out, index = [], 0
    while index < 400:
        d = get(f'artist/{did}/albums', limit=100, index=index) or {}
        out += d.get('data', [])
        if not d.get('next'):
            break
        index += 100
    return out


def main():
    essai = '--essai' in sys.argv
    cibles = {a for a in sys.argv[1:] if not a.startswith('--')}
    data = json.load(open(DATA))
    txt = open(LIENS).read()
    liens = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    ajouts, dates = [], 0

    for r in data:
        did = (liens.get(r['id']) or {}).get('deezerId')
        if not did or (cibles and r['id'] not in cibles):
            continue
        projets = r.setdefault('projets', [])
        singles = r.setdefault('singles', [])
        ignorees = {norm(t) for t in r.get('sortiesIgnorees', [])}
        connus = {}
        for it in projets:
            connus[('p', norm(it['titre']))] = it
        for it in singles:
            connus[('s', norm(it['titre']))] = it

        for al in all_albums(did):
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

        cle_tri = lambda x: x.get('date') or str(x.get('annee', 0))
        projets.sort(key=cle_tri, reverse=True)
        singles.sort(key=cle_tri, reverse=True)
        del singles[MAX_SINGLES:]
        if not projets:
            del r['projets']
        if not singles:
            del r['singles']

    print(f'{len(ajouts)} nouvelle(s) sortie(s), {dates} date(s) complétée(s)')
    for a in ajouts[:200]:
        print('  +', a)
    if essai:
        print('(mode essai : rien n’a été écrit)')
    elif ajouts or dates:
        with open(DATA, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')


main()
