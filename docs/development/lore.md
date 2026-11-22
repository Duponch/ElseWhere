# L'univers d'Elsewhere (lore)

22 novembre 2026, schéma 376 inchangé. Aucune règle du jeu ne change dans ce lot.

Elsewhere reprend pour de bon les règles et les mécaniques de RimWorld. Son univers (histoires, noms, factions, lieux, récits) en est aujourd'hui un clone, réécrit en français ; un jour, l'utilisateur veut le remplacer par le sien sans toucher au jeu. Ce lot prépare ce jour-là : un **registre** qui rassemble chaque texte de l'univers sous une forme unique, une **page** qui les montre tous et les exporte, et la place où s'affichera plus tard l'univers du jeu installé.

## 1. Univers ou règle

- **Univers** : ce que le joueur lit et qui pourrait être raconté autrement sans changer une partie : titre et description d'une histoire, nom et description d'un trait, nom d'un type de faction, prénoms, noms de milieux, titres de romans, noms des objets, des animaux, des plantes et des bâtiments.
- **Règle** : tout ce qui décide de ce qui se passe. Gains de compétences, travaux refusés, traits imposés ou interdits par une histoire, possessions de départ, catégories de tirage, morphologie, effets d'un trait, relations entre factions, genres de chef, poids et coûts des raids et des caravanes, croissance des plantes, statistiques des objets. Ces champs restent dans leurs tables et n'entrent jamais dans le registre (le test le vérifie).

Une description de trait dit sa règle (« Vitesse de travail générale +20 % ») : une autre histoire peut la reformuler, pas la changer.

## 2. Inventaire

983 entrées, 1 744 textes (un mot d'une liste compte pour un texte). Chaque entrée porte un identifiant stable `catégorie/groupe/clé`, la clé étant celle de sa table d'origine (nom de définition du jeu de base, identifiant d'objet, nom de liste), et le fichier et le symbole qui définissent le texte. Le registre lit les tables là où elles sont ; il ne copie ni ne déplace aucun texte.

| Catégorie | Groupe | Entrées | Où |
| --- | --- | --- | --- |
| Histoires (180) | Enfance · Elsewhere | 6 | `src/sim/colonist-backgrounds.ts` · `CHILDHOODS` |
| | Âge adulte · Elsewhere | 8 | `src/sim/colonist-backgrounds.ts` · `ADULTHOODS` |
| | Enfance · jeu de base | 48 | `src/sim/core-backstory-texts-370.ts` · `CORE_BACKSTORY_TEXTS_370` (titre, titre court, au féminin, description) |
| | Âge adulte · jeu de base | 118 | idem ; la case (enfance ou âge adulte) vient de `CORE_BACKSTORY_LIST_370` |
| Traits (65) | Traits | 65 | `src/sim/traits.ts` · `TRAITS` (nom, description ; définition et degré du jeu de base en référence) |
| Factions (8) | Types de faction | 8 | `src/ui/world-draft-controls.ts` · `WORLD_FACTION_CHOICES` |
| Personnes (23) | Prénoms | 2 listes (32 + 12) | `src/sim/starting-candidates.ts` · `STARTING_CANDIDATE_NAMES` ; `src/sim/arrival-state.ts` · `ARRIVAL_NAMES` |
| | Noms d'animaux | 2 listes (8 + 8) | `src/sim/starting-pet-birth-256.ts` · `STARTING_PET_NAME_FIRST_256`, `…_SECOND_256` |
| | Noms anciens | 1 liste (32 syllabes) | `src/sim/ancient-human-name-256.ts` · `ANCIENT_NAME_SYLLABLES_256` |
| | Rôles | 18 | `src/sim/trader-caravans-332.ts` · `CARAVAN_TRADER_KINDS_332`, `CARAVAN_GUARDS_332`, `CARAVAN_TRADERS_332` |
| Lieux (12) | Milieux | 12 | `src/sim/site.ts` · `BIOME_LABELS` |
| Récits (14) | Scénarios | 4 | `src/sim/scenario-definitions.ts` · `SCENARIOS` |
| | Classes de lettres | 7 | `src/sim/letters-352.ts` · `LETTER_CLASSES_352` |
| | Romans | 3 listes (8 + 8 + 8) | `src/sim/book-state-295.ts` · `NOVEL_TITLE_STARTS_295`, `NOVEL_TITLE_ENDS_295`, `NOVEL_STORIES_295` |
| Descriptions (681) | Objets | 489 | `src/sim/items.ts` · `ITEM_DEFINITIONS` |
| | Animaux | 53 | `src/sim/animal-species.ts` · `ANIMAL_SPECIES` |
| | Plantes sauvages | 32 | `src/sim/biome-flora.ts` · `FLORA_DEFINITIONS` |
| | Cultures | 9 | `src/sim/plants.ts` · `PLANT_DEFINITIONS` |
| | Bâtiments | 98 | `src/ui3d/native-catalog.ts` · `toolDefinitions` (catégories de l'Architecte qui bâtissent : structure, mobilier, température, loisirs, électricité, production, vaisseau) |

« Descriptions » ne contient pour l'instant que des noms : Elsewhere ne donne encore aucune description narrative à ses objets, animaux, plantes et bâtiments. Le texte d'aide des bâtiments (coût, taille, recherche) est une règle et n'est pas repris.

Six listes n'étaient pas exportées ; le lot ajoute seulement un `export { … as … }` à côté d'elles (`starting-candidates.ts`, `starting-pet-birth-256.ts`, `ancient-human-name-256.ts`, `book-state-295.ts`), sans changer une valeur.

Code : `src/lore/lore-types.ts` (forme d'une entrée), `src/lore/lore-registry.ts` (lecture des sources, catégories, ce qui manque), `src/lore/lore-view.ts` (recherche, compte, export), `src/lore/lore-installed.ts` (place du jeu installé), `src/lore/lore-page.ts`.

## 3. La page `lore.html`

Page de développement comme `/sounds-review.html` : lancer `npm run dev` puis ouvrir `/lore.html`. Catégories à gauche avec leur nombre d'entrées, recherche sans accents sur tous les textes, identifiants et fichiers, chaque entrée avec tous ses textes, sa référence au jeu de base et sa source. En tête de chaque catégorie, la liste de ce qui n'est pas encore lu (section 6). Le lien garde la catégorie (`/lore.html#traits`).

**Exporter tout en JSON** télécharge `lore-elsewhere-<date>.json` (environ 400 Ko) : `format: "elsewhere-lore"`, `version: 1`, la date, les catégories avec leur compte et ce qui manque, et toutes les entrées. C'est le point de départ d'un univers personnalisé.

La page est **publiée avec le jeu** (`vite.config.ts`, construction normale et Pages) : elle ne contient que les textes propres à Elsewhere, déjà livrés dans le jeu lui-même. Elle reste hors des moteurs de recherche (`noindex`).

## 4. Brancher un univers personnalisé

Prévu, pas encore fait :

- **Un seul fichier de remplacement**, indexé par les identifiants du registre : `{ "histoires/enfance-base/SewerKid57": { "title": "…", "description": "…" }, "personnes/prenoms/depart": { "words": [ … ] } }`. Seuls les champs de texte sont admis : `title`, `shortTitle`, `titleFemale`, `shortTitleFemale`, `description`, `words`. Un identifiant inconnu ou un champ en trop est refusé.
- **Le jeu lit ses textes par le registre** au moment de les afficher (titre d'une histoire, nom d'un trait, d'un objet…). Les règles ne passent jamais par lui : gains, travaux refusés, traits imposés, relations, règles de raid et de commerce restent dans leurs tables.
- **Ce qui ne doit pas changer** avec l'univers, relevé entrée par entrée dans la note de chaque liste :
  - La **longueur des listes** tirées au hasard : un tirage choisit une place dans la liste ; les noms d'animaux de départ sont tirés de nouveau tant qu'ils sont pris, donc la longueur peut changer le nombre de tirages du monde ; les syllabes anciennes doivent rester 32 (masque sur 5 bits). Un remplacement garde la même longueur, ou bien il change les parties tirées.
  - Le **prénom de naissance** des personnes de départ entre dans le hachage qui tire leur sexe et leur apparence ; Ada, Noé et Mina ont une apparence et un portrait écrits pour eux. Changer ces prénoms change les personnes proposées.
  - Les noms **déjà tirés** sont gardés dans les sauvegardes (prénoms, titres de romans, noms de colonies) : un univers personnalisé vaut pour les nouveaux tirages et pour tout ce qui est relu par identifiant (histoires, traits, objets, lettres) ; il ne réécrit pas une sauvegarde.
  - Quelques libellés servent encore d'identifiant dans la logique (« Garde » des visiteurs, section 6) : à séparer avant de les rendre personnalisables.

## 5. Le jeu installé

La page garde une section **« Jeu installé »**. Un autre chantier lit les définitions et les fichiers de langue du RimWorld du joueur (`src/import/rimworld`) ; le choix de l'utilisateur est que les textes du jeu soient **lus à l'ouverture depuis son installation et jamais copiés dans le dépôt**. Quand ce lecteur sera prêt, il fournira une source (`InstalledLoreSource` de `src/lore/lore-installed.ts`) : un libellé et une fonction qui lit l'installation et rend des entrées de la même forme, d'origine `installed`, enregistrée par `registerInstalledLoreSource`. Sans source, la section explique ce qu'elle montrera.

## 6. Ce qui n'est pas encore lu

- **Noms des factions, des colonies et des chefs** (listes `forms`, `roots`, `people` de `src/sim/world-faction-generation.ts`) : non exportées, dans la génération du monde qu'un autre chantier refait pour tirer les noms comme le jeu ([planète](planet-parity.md), section 6). À lire une fois ce chantier posé.
- **Libellés de faction** « Colonie », « Tribu du joueur », « Anciens », « Anciens hostiles » : seulement dans des fonctions locales de l'interface (`src/ui3d/native-world.ts`, en partie répétés dans `src/ui3d/native-front.ts`). Les huit autres existent en trois exemplaires ; le registre lit `WORLD_FACTION_CHOICES`. Pas de titre de chef en français ni de description de faction.
- **Rôles des visiteurs** « Villageois », « Garde », « Conseiller » : écrits dans `groupProfiles` (`src/sim/visitors.ts`), où « Garde » est comparé par la logique. **Noms faits d'un mot et d'un numéro** (« Assaillant », « Naufragé », « Veilleur ancien », « Captif ancien », « Mécanoïde », marchands orbitaux) : écrits dans le code qui crée la personne. Pas de nom de famille ni de surnom : une personne n'a qu'un prénom.
- **Lieux** : nom du monde et grands lieux de la planète (génération de la planète, autre chantier) ; libellés des cartes et des sites (`src/ui/map-registry-adapter.ts`, `src/ui/world-target-ui-263.ts`) ; descriptions des milieux de l'écran de départ (`src/ui/front-site.ts`) ; « Nouvelle colonie » (`src/main.ts`).
- **Lettres, incidents et quêtes** : phrases écrites à l'endroit de l'événement (journal, lettre de décès, demande d'asile…), dans une centaine de fichiers. Il faut d'abord les rassembler en tables, puis les lire ici.
- **Pensées et souvenirs** (nom et description) : une vingtaine de tables qui mêlent récit et explication de la règle.
- **Conteurs et difficultés** (« Cassandra Classique », « Récit d'aventure »…) : écrits dans l'interface de départ (`src/ui/front-menu.ts`, `src/ui3d/native-front.ts`).
- **Sols, tapis, pierres, météo, maladies, blessures** : noms de règles plus que de récit, non repris.

La page affiche cette liste en tête de chaque catégorie, et l'export la contient.

## 7. Contrôles

- `tests/lore-registry.test.ts` (11 cas) : chaque groupe a autant d'entrées que sa table d'origine (166 histoires du jeu de base, 65 traits, 489 objets…), chaque liste porte tous ses mots dans l'ordre, chaque texte est égal à sa source ; identifiants uniques, de la forme `catégorie/groupe/clé` et stables pour une liste d'entrées connues ; aucun champ de règle dans une entrée, et chaque fichier cité définit bien son symbole ; forme de l'export et nom du fichier ; recherche sans accents ; section du jeu installé vide tant qu'aucune source n'est branchée. Une nouvelle entrée dans une table déjà lue entre seule dans le registre ; une **nouvelle table** de textes doit être ajoutée au registre et à ce test.
- Page ouverte dans le serveur de développement : catégories, recherche (« gamine » : deux histoires), section « Jeu installé », export intercepté (983 entrées, fichier `lore-elsewhere-2026-11-22.json`), largeur de téléphone sans défilement horizontal, aucune erreur dans la console. Construction Pages réussie avec `lore.html`.
- Les autres pages de revue n'ont pas de test de page ; la logique de la page (recherche, comptes, export) est dans `lore-view.ts`, testée sans navigateur.
