# Pages développeur

22 novembre 2026, schéma 376 inchangé. Point 21 du [chantier des retours du 22 novembre](chantier-retours-20261122.md). Présentation seulement : aucune règle, aucun champ de sauvegarde.

## Le point d'entrée : Options → « Développeur »

Les Options (menu natif et ancien menu HTML) ont une section **Développeur** : une ligne par page, avec sa description et un bouton **Ouvrir** qui ouvre la page dans un nouvel onglet, sans quitter la partie. La section n'apparaît que si la version servie a des pages à montrer.

La liste tient en un seul endroit, [`src/ui/developer-pages.ts`](../../src/ui/developer-pages.ts) (`DEVELOPER_PAGES`). Elle sert trois fois :

- la section des Options (`developerPagesForMode(import.meta.env.MODE)`, branché dans `src/main.ts`) ;
- les entrées du build local (`npm run build`) : le jeu et **toutes** les pages ;
- les entrées du build publié (`npm run build:pages`) : le jeu et les pages marquées `published`.

## Les pages

| Page | Fichier | Publiée | Contenu |
| --- | --- | --- | --- |
| Modèles et assets | `assets.html` | oui | L'atelier des modèles 3D (personnes, animaux, plantes, objets, bâtiments) dans les styles du jeu. |
| Sons et musiques | `sounds-review.html` | oui | Tous les sons et musiques du jeu, à écouter et à régler un par un ; voir [la couverture audio](audio-coverage-20261122.md#réglages-manuels-page-des-sons). |
| Textes de l'univers | `lore.html` | oui | Les textes d'Elsewhere par catégorie et la comparaison avec le jeu installé ; voir [l'univers](lore.md). |
| Pictogrammes | `pictograms-review.html` | oui | La collection des pictogrammes (interface, objets, recherches). |
| Règles du jeu | `rules.html` | oui | Toutes les règles par domaine, leurs nombres lus dans le code et leur source ; voir [la page des règles](rules-page.md). |
| Laboratoire de navigation | `navigation.html` | non | Essais de recherche de chemin sur la carte graphique, comparés à un calcul de référence. |

**Pourquoi ces choix de publication.** Une page publiée ne montre que du contenu propre à Elsewhere (modèles, sons, textes, pictogrammes) et marche sans le serveur de développement : elle sert à l'utilisateur, qui joue sur la version publiée. Les sons et les pictogrammes rejoignent donc les modèles et l'univers, déjà publiés. Sur la version publiée, la page des sons ne peut pas écrire dans le dépôt : « Enregistrer » y télécharge le fichier de réglages. Le laboratoire de navigation reste local : c'est un banc d'essai du moteur, pas une page de référence. Sur Cloudflare, une page absente renvoie le jeu lui-même : la liste des Options ne doit donc jamais montrer une page non publiée, ce que `developerPagesForMode('pages')` garantit.

Avant ce lot, `pictograms-review.html` et `sounds-review.html` n'étaient servies que par `npm run dev` (absentes des deux builds).

## Ajouter une page

1. Créer `ma-page.html` à la racine du dépôt (avec `<meta name="robots" content="noindex,nofollow">` comme les autres) et son script sous `src/dev/` ou à côté du module concerné.
2. Ajouter une ligne à `DEVELOPER_PAGES` : identifiant, fichier, titre et description en français, `published` selon la règle ci-dessus.
3. C'est tout : les Options et les deux builds la prennent. Le [test](../../tests/developer-pages-sounds.test.ts) refuse une page `.html` de la racine absente de la liste, une entrée sans fichier, et vérifie les entrées des builds local et publié.

La page des règles du jeu s'est ajoutée ainsi ; celle des animations, prévue par le chantier, suivra le même chemin.

## Vérification

`tests/developer-pages-sounds.test.ts`, partie « developer pages hub » : chaque page existe et toutes les pages de la racine sont listées ; build local = toutes les pages, build publié = les pages publiées ; Options natives : section « Développeur », une ligne par page, **Ouvrir** appelle `window.open('/sounds-review.html', '_blank', 'noopener')`, la liste publiée n'a pas le laboratoire, sans liste la section est absente. Dans le vrai client (serveur de développement) : la section s'affiche avec les cinq pages et leur description, **Ouvrir** ouvre la page demandée. `vite build --mode pages` produit `index.html`, `assets.html`, `lore.html`, `pictograms-review.html` et `sounds-review.html`.
