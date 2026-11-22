/** Developer pages (Options → « Développeur », docs/development/developer-pages.md).
 * This list is the only place a page is declared: the Options hub, the dev
 * build inputs and the published build inputs (vite.config.ts) all read it.
 * Keep this module free of browser and Vite globals: vite.config.ts imports it. */
export interface DeveloperPage {
  id: string;
  /** HTML file at the repository root, served at `/${file}`. */
  file: string;
  title: string;
  description: string;
  /** Part of the published build (`npm run build:pages`). A page that is not
   * published is only listed by the dev server and the local build. */
  published: boolean;
}

export const DEVELOPER_PAGES: readonly DeveloperPage[] = [
  { id: 'assets', file: 'assets.html', title: 'Modèles et assets',
    description: 'L’atelier des modèles 3D : personnes, animaux, plantes, objets et bâtiments dans les styles du jeu.', published: true },
  { id: 'sounds', file: 'sounds-review.html', title: 'Sons et musiques',
    description: 'Tous les sons et musiques du jeu, à écouter prise par prise, avec un réglage du volume de chacun.', published: true },
  { id: 'lore', file: 'lore.html', title: 'Textes de l’univers',
    description: 'Les textes d’Elsewhere par catégorie (histoires, traits, factions, noms) et la comparaison avec le jeu installé.', published: true },
  { id: 'pictograms', file: 'pictograms-review.html', title: 'Pictogrammes',
    description: 'La collection des pictogrammes de l’interface, des objets et des recherches.', published: true },
  { id: 'rules', file: 'rules.html', title: 'Règles du jeu',
    description: 'Toutes les règles, boucles et calculs du jeu par domaine, avec leurs nombres lus dans le code et leur source.', published: true },
  { id: 'navigation', file: 'navigation.html', title: 'Laboratoire de navigation',
    description: 'Essais de recherche de chemin sur la carte graphique, comparés à un calcul de référence. Outil de développement seulement.', published: false },
];

/** The pages a build serves: every page in development and in the local build,
 * the published ones in the `pages` build (Cloudflare). On the published site a
 * missing page falls back to the game itself, so it must never be listed. */
export function developerPagesForMode(mode: string): readonly DeveloperPage[] {
  return mode === 'pages' ? DEVELOPER_PAGES.filter(page => page.published) : DEVELOPER_PAGES;
}

/** Rolldown inputs of `vite build` for a mode: the game plus its pages. */
export function buildInputs(mode: string): string[] {
  return ['index.html', ...developerPagesForMode(mode).map(page => page.file)];
}

export function developerPageUrl(page: DeveloperPage): string { return `/${page.file}`; }
