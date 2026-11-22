# Page des règles du jeu

22 novembre 2026, schéma 376 inchangé. Point 22 du [chantier des retours du 22 novembre](chantier-retours-20261122.md). Présentation seulement : aucune règle du jeu, aucun champ de sauvegarde ne change.

## Ce que montre la page

`rules.html` (Options → Développeur → « Règles du jeu », publiée) décrit les règles qu'Elsewhere applique, domaine par domaine. Pour chaque règle :

- ce qu'elle fait, en français, avec ses nombres insérés dans le texte ;
- son calcul quand il y en a un ;
- d'où vient chaque nombre (fichier et symbole, « lu dans le code » ou « écrit dans la fonction »), dans un tableau replié sous la règle ;
- les tableaux tirés du code (espèces, cultures, crises, armes, maladies, recherches…) ;
- si elle suit RimWorld 1.6 (jeu de base), si c'est une adaptation ou si elle est propre à Elsewhere, avec la note `docs/` qui le documente ;
- les règles liées (liens dans la page).

La page a un sommaire, une recherche (mots dans n'importe quel ordre, accents ignorés, sur les titres, les textes, les nombres, les cellules des tableaux et les noms de fichiers), des domaines repliables au clavier (bouton avec `aria-expanded`), une ancre par règle (`rules.html#besoins.repos`) et une mise en page pour téléphone (les grands tableaux défilent dans leur cadre). Les tableaux de plus de quinze lignes sont repliés.

Elle est **publiée** : elle ne contient que du contenu d'Elsewhere (nos règles, nos textes en français, nos nombres), aucun texte ni ressource de RimWorld. Les liens « Code » et « Notes » ouvrent le dépôt.

## Comment elle est construite

- [`src/rules/rules-types.ts`](../../src/rules/rules-types.ts) : la forme des données (domaine, règle, nombre, tableau, source).
- [`src/rules/rules-helpers.ts`](../../src/rules/rules-helpers.ts) : les constructeurs (`rule`, `code`, `pinned`, `table`, `sim`, `at`) et le format français des nombres.
- [`src/rules/domains/`](../../src/rules/domains/) : les règles, en quatre fichiers (`people.ts` : temps, besoins, humeur, compétences, travail ; `colony.ts` : déplacements, construction, plantes, animaux, nourriture ; `danger.ts` : santé, combat, climat, électricité ; `world.ts` : recherche, commerce, conteur, prisonniers, monde, sauvegardes).
- [`src/rules/rules-registry.ts`](../../src/rules/rules-registry.ts) : l'ordre des domaines et la liste de ce qui n'est pas encore décrit.
- [`src/rules/rules-view.ts`](../../src/rules/rules-view.ts) : la recherche et les comptes (purs, testés).
- [`src/rules/rules-page.ts`](../../src/rules/rules-page.ts) : l'affichage (toujours `textContent`).

Les domaines importent directement les constantes, tables et fonctions exportées par `src/sim/` (et deux modules purs de `src/ui/` : la liste des recherches et les intervalles de sauvegarde automatique). Aucun module de rendu ni du navigateur n'est importé ; la page ne charge aucune partie.

## Ce qui est généré, ce qui est écrit à la main

- **Généré** : tous les tableaux (`table(…)` construit à partir d'une collection du code : `ANIMAL_SPECIES`, `TRAITS`, `MENTAL_CRISIS_CATALOG`, `ITEM_DEFINITIONS`, `ROT_DAYS`, `rangedWeaponProfile`, `computeThreatPoints`…) et les nombres `code(…)`, lus dans un symbole exporté ou calculés par une fonction exportée.
- **Écrit à la main** : les titres, les explications et les formules en mots. **Ils ne contiennent aucun chiffre** : chaque nombre est un `{clé}` rempli par un nombre de la règle.
- **Épinglé** : un nombre écrit dans le corps d'une fonction (pas exporté) est donné par `pinned(…)` avec un fragment exact du fichier source (`'rest>=28?1:rest>=14?.7:rest>=1?.3:.6'`). Si quelqu'un change ce code, le fragment disparaît et le test échoue. Une liste privée recopiée (perte d'expérience par niveau) porte de même son fragment.
- Une seule petite exportation a été ajoutée au jeu : `MOOD_THOUGHTS_FOR_RULES` dans `src/sim/mood.ts`, une vue en lecture seule des pensées de situation et des souvenirs de repas, qui n'étaient pas exportés. Les étiquettes des compétences (`SKILL_LABELS`) et des facteurs de difficulté sont écrites dans le registre, le test vérifie qu'elles couvrent les identifiants du code.

## Ajouter une règle

1. Choisir le fichier du domaine sous `src/rules/domains/` et ajouter un `rule(D, { id, title, text, values, tables, fidelity, notes, related })`.
2. Écrire `text` sans chiffre ; chaque nombre est un `{clé}` et une entrée de `values` : `code('clé', 'Libellé', CONSTANTE, sim('fichier.ts', 'CONSTANTE'), 'unité')` si le nombre est exporté, sinon `pinned('clé', 'Libellé', valeur, sim('fichier.ts', 'fonction'), 'fragment exact du fichier')`. L'unité s'affiche dans le tableau des nombres ; le texte dit l'unité lui-même.
3. Pour un tableau, `table('id', 'Légende', colonnes, lignes, sim('fichier.ts', 'SYMBOLE'))` avec des lignes calculées à partir de la collection du code.
4. `fidelity` : `core` si la note dit que la règle est celle de RimWorld 1.6, `adaptation` si elle est adaptée (expliquer dans `fidelityNote`), `elsewhere` si elle est propre au jeu. Citer la note dans `notes`.
5. Ajouter le nombre de lignes attendu du nouveau tableau dans `tests/rules-page.test.ts` (« generated sections against their sources »).
6. Un nouveau domaine s'ajoute à `RULE_DOMAINS` (et à la liste des domaines du test) ; mettre `coverage` honnêtement et lister ce qui manque dans `missing`.

## Ce que vérifie le test

`tests/rules-page.test.ts` :

- forme : identifiants uniques, chaque règle dans son domaine, au moins une source, couverture honnête (« complet » sans manque, sinon des manques listés) ;
- chaque `{clé}` a son nombre et chaque nombre est utilisé ; aucun chiffre dans les textes écrits à la main ;
- chaque fichier source existe et contient son symbole ; chaque nombre épinglé (et chaque liste recopiée) retrouve son fragment ; chaque note existe ; chaque règle liée existe ;
- chaque tableau a le nombre de lignes de sa collection source, et des valeurs vérifiées contre le code (expérience par niveau, traits, cultures, mufalo, maladies, consommation électrique de chaque appareil, toutes les armes à distance du catalogue, durée du jour, schéma…) ;
- format des nombres, recherche, et place de la page dans les pages développeur publiées.

## Couverture actuelle

20 domaines, 93 règles, 240 nombres, 75 tableaux (1 414 lignes), au 22 novembre (schéma 376).

| Domaine | Couverture | Ce qui manque |
| --- | --- | --- |
| Temps et vitesse | complet | — |
| Besoins | partiel | besoins des animaux et des enfants, tirage de la malnutrition, besoins des invités et des prisonniers |
| Humeur, pensées et crises | partiel | pensées sociales, pensées de chaque trait, détail de chaque crise |
| Compétences, passions et traits | partiel | gains d'expérience de chaque travail, tirage des histoires et des traits en détail |
| Travail, priorités et emploi du temps | partiel | conditions de chaque donneur de travail, vitesse de chaque travail |
| Déplacements et chemins | partiel | coût de chaque meuble, algorithme de recherche de chemin |
| Construction, minage et démolition | partiel | coût de chaque bâtiment (exemples seulement), réparation, effondrement des toits |
| Plantes, cultures et flore sauvage | partiel | rendement de récolte par niveau, repousse en détail, gel |
| Animaux | partiel | reproduction, prédation, enclos et menage |
| Nourriture, cuisine et nutrition | partiel | ingrédients de chaque recette, politiques alimentaires, équarrissage |
| Santé, blessures, maladies et chirurgie | partiel | grippe et infections en détail, drogues et alcool, toutes les opérations, capacités en détail |
| Combat | partiel | couverture et angle de tir, pièges, tourelles, mortiers, outils de mêlée |
| Température, météo et feu | partiel | échanges de chaleur en détail, neige, éclipse, aurore, éruption solaire |
| Électricité | partiel | délestage, éruption solaire |
| Recherche | partiel | niveau technologique, température et propreté en détail |
| Commerce, factions et caravanes | partiel | stocks des marchands, demandes commerciales, pourparlers, fourrage |
| Conteur et incidents | partiel | loterie des incidents divers, quêtes, petites menaces, incidents de la planète |
| Prisonniers et recrutement | partiel | libération et exécution, nourriture et lits des prisonniers |
| Monde, planète et voyages | partiel | génération du relief et des rivières, sites, températures par biome |
| Sauvegardes et schémas | complet | — |

**Pas encore décrits du tout** (listés en haut de la page) : vie sociale ; vêtements et équipement ; stockage et transport ; production et factures ; visiteurs, quêtes et lettres ; fin de partie ; cartes temporaires ; tutoriel et aide.

Limites connues : plusieurs tableaux montrent des identifiants du code (terrains, saletés, factions, genres de raid, appareils électriques, postes de cuisine) faute d'étiquette française exportée par la simulation ; certaines tables privées (succès de construction par niveau, rendement de récolte par niveau) ne sont décrites qu'en mots.

## Vérification

- `tests/rules-page.test.ts` (9 cas) et `tests/developer-pages-sounds.test.ts` (liste des pages, builds local et publié).
- Dans le vrai client (serveur de développement, 22 novembre) : la page s'ouvre sans erreur de console, 20 domaines, 93 règles ; recherche « pourriture » → 5 règles ; un domaine se replie et se déplie à la touche Entrée, le focus reste sur le bouton ; l'ancre `#besoins.repos` ouvre la règle ; à 375 px de large la page ne défile plus horizontalement (seuls les grands tableaux défilent dans leur cadre). Rendu complet de la page ≈ 25 à 47 ms ; replier un domaine ne touche que sa section. La page n'est pas chargée par le jeu : aucun coût pour une partie.
