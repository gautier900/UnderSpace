"""Construit src/data/liens.js : pour chaque artiste UnderSpace, son identifiant Deezer
et la liste de ses « artistes proches » selon Deezer (API publique, sans compte).

Relancer après avoir ajouté des artistes :   python3 scripts/build-liens.py
Les liens déjà calculés sont conservés (seuls les nouveaux artistes sont interrogés),
sauf avec l'option --tout.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src/data/rappeurs.json')
OUT = os.path.join(ROOT, 'src/data/liens.js')


# Nom à chercher sur Deezer quand il diffère de celui affiché dans UnderSpace.
ALIAS = {
    'norsacce': 'Norsacce Berlusconi',
    'darlinchouchou': 'Darlingchouchou',
    'reallo': 'Realo',
}


# Identifiant Deezer imposé quand la recherche par nom ne suffit pas (homonymes).
DEEZER_ID = {
    'jade': 78534732,  # Jäde (Lyon) — retrouvée via l'album « Les Malheurs de Jäde »
}


def norm(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
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
                if d['error'].get('code') == 4:
                    time.sleep(5)
                    continue
                return None
            return d
        except Exception:
            time.sleep(2)
    return None


def main():
    artistes = [(r['id'], r['nom']) for r in json.load(open(DATA))]
    # identifiants Deezer déjà connus (liens Deezer présents dans les fiches)
    old = {}
    if os.path.exists(OUT) and '--tout' not in sys.argv:
        txt = open(OUT).read()
        old = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    known_names = {norm(n) for _, n in artistes}
    liens = {}
    for rid, nom in artistes:
        if rid in old:
            liens[rid] = old[rid]
            continue
        if rid in DEEZER_ID:
            did = DEEZER_ID[rid]
            rel = (get(f'artist/{did}/related', limit=25) or {}).get('data', [])
            liens[rid] = {'deezerId': did, 'proches': [[r['id'], r['name']] for r in rel]}
            print(f'{rid}: deezer {did} (imposé), {len(rel)} proches', flush=True)
            continue
        nom_dz = ALIAS.get(rid, nom)
        cands = [a for a in (get('search/artist', q=nom_dz, limit=10) or {}).get('data', []) if norm(a['name']) == norm(nom_dz)]
        if not cands:
            print(f'{rid}: introuvable sur Deezer')
            continue
        best, best_score, best_rel = None, (-1, -1), []
        for a in cands:
            rel = (get(f"artist/{a['id']}/related", limit=25) or {}).get('data', [])
            score = (sum(1 for r in rel if norm(r['name']) in known_names), a.get('nb_fan', 0))
            if score > best_score:
                best, best_score, best_rel = a, score, rel
        if len(cands) > 1 and best_score[0] == 0:
            print(f'{rid}: homonymes non départagés, ignoré')
            continue
        liens[rid] = {
            'deezerId': best['id'],
            'proches': [[r['id'], r['name']] for r in best_rel],
        }
        print(f"{rid}: deezer {best['id']}, {len(best_rel)} proches ({best_score[0]} dans UnderSpace)", flush=True)
    with open(OUT, 'w') as f:
        f.write('// Généré par scripts/build-liens.py — ne pas modifier à la main.\n')
        f.write('// Pour chaque artiste : son identifiant Deezer et ses « artistes proches » selon Deezer\n')
        f.write('// ([idDeezer, nom], du plus proche au moins proche).\n')
        f.write('export const liens = ')
        json.dump(liens, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print(len(liens), '/', len(artistes), 'artistes reliés')


main()
