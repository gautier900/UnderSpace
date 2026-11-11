import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { adminPlugin } from './scripts/admin-plugin.js';

const root = fileURLToPath(new URL('.', import.meta.url));

// Pages publiées : la galaxie (index.html) et la page artiste (artiste.html).
// Le menu admin (admin.html) ne sert qu'en local avec `npm run dev` : il n'est pas publié.
export default defineConfig({
  // Chemins relatifs : le site marche à la racine d'un domaine comme dans un sous-dossier
  // (GitHub Pages publie sur https://gautier900.github.io/UnderSpace/).
  base: './',
  plugins: [adminPlugin(root)],
  server: {
    watch: { ignored: ['**/src/data/.sauvegardes/**'] },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        artiste: fileURLToPath(new URL('./artiste.html', import.meta.url)),
      },
    },
  },
});
