// Plugin Vite : petit serveur d'enregistrement pour le menu admin (admin.html).
// Il n'existe QUE pendant `npm run dev` : le site publié (npm run build) reste 100 % statique.
//
//   GET  /__admin/ping       → { ok: true }  (permet à la page admin de savoir si l'enregistrement est possible)
//   POST /__admin/rappeurs   → remplace src/data/rappeurs.json (une sauvegarde de l'ancienne version est gardée)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MAX_BACKUPS = 30;

export function adminPlugin(root) {
  const DATA = path.join(root, 'src/data/rappeurs.json');
  const BACKUPS = path.join(root, 'src/data/.sauvegardes');

  const send = (res, code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  // Vérifications minimales : on refuse tout fichier qui casserait le site.
  function validate(list) {
    if (!Array.isArray(list) || !list.length) return 'La liste des artistes est vide.';
    const ids = new Set();
    for (const r of list) {
      if (!r || typeof r !== 'object') return 'Artiste invalide.';
      if (!/^[a-z0-9-]+$/.test(r.id ?? '')) return `Identifiant invalide : « ${r.id} ».`;
      if (ids.has(r.id)) return `Identifiant en double : « ${r.id} ».`;
      ids.add(r.id);
      if (!String(r.nom ?? '').trim()) return `Nom manquant pour « ${r.id} ».`;
      const p = r.planete;
      if (!p || !Array.isArray(p.couleurs) || p.couleurs.length !== 3) return `Planète invalide pour « ${r.nom} ».`;
      if (!p.couleurs.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return `Couleur invalide pour « ${r.nom} ».`;
    }
    return null;
  }

  function backup() {
    fs.mkdirSync(BACKUPS, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA, path.join(BACKUPS, `rappeurs-${stamp}.json`));
    const files = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) fs.unlinkSync(path.join(BACKUPS, f));
  }

  return {
    name: 'underspace-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__admin', (req, res) => {
        // uniquement depuis la machine elle-même
        const ip = req.socket.remoteAddress ?? '';
        if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) return send(res, 403, { error: 'Accès refusé' });

        if (req.method === 'GET' && req.url.startsWith('/ping')) return send(res, 200, { ok: true });

        if (req.method === 'POST' && req.url.startsWith('/rappeurs')) {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            let list;
            try {
              list = JSON.parse(body);
            } catch {
              return send(res, 400, { error: 'Données illisibles.' });
            }
            const err = validate(list);
            if (err) return send(res, 400, { error: err });
            const before = new Set(JSON.parse(fs.readFileSync(DATA, 'utf8')).map((r) => r.id));
            backup();
            fs.writeFileSync(DATA, JSON.stringify(list, null, 2) + '\n');
            // Nouveaux artistes : on calcule leurs « artistes proches » (Deezer) en arrière-plan.
            const nouveaux = list.filter((r) => !before.has(r.id)).map((r) => r.id);
            if (nouveaux.length) {
              // artistes proches (Deezer), puis feats déjà connus du cache (sans appel Deezer)
              const p = spawn('sh', ['-c', 'python3 scripts/build-liens.py && python3 scripts/build-feats.py --local'], { cwd: root, stdio: 'ignore', detached: true });
              p.on('error', () => {});
              p.unref();
            }
            send(res, 200, { ok: true, total: list.length, nouveaux });
          });
          return;
        }
        send(res, 404, { error: 'Inconnu' });
      });
    },
  };
}
