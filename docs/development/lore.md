# L'univers d'Elsewhere (lore)

22 novembre 2026, schéma 376 inchangé. Aucune règle du jeu ne change dans ces lots. Second lot du même jour : les textes du RimWorld installé chez le joueur s'affichent à la place de ceux d'Elsewhere (section 5).

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

Code : `src/lore/lore-types.ts` (forme d'une entrée), `src/lore/lore-registry.ts` (lecture des sources, catégories, ce qui manque), `src/lore/lore-view.ts` (recherche, compte, export), `src/lore/lore-installed.ts` (place du jeu installé), `src/lore/lore-page.ts`. Jeu installé (section 5) : `src/lore/lore-text.ts` (la recherche d'un texte par identifiant, utilisée par l'interface), `src/lore/game-lore-mapping.ts` (quelle définition du jeu répond à quelle entrée), `src/lore/game-lore-reader.ts` (lecture des définitions et des fichiers de langue), `src/lore/game-lore-browser.ts` et `src/import/rimworld/game-files-browser.ts` (dossier choisi dans le navigateur), `src/lore/game-lore.worker.ts`, `src/lore/rimworld-texts.ts` (choix du dossier, autorisation, langue), `src/lore/game-lore-coverage.ts` (ce qui correspond, groupe par groupe).

## 3. La page `lore.html`

Page de développement comme `/sounds-review.html` : lancer `npm run dev` puis ouvrir `/lore.html`. Catégories à gauche avec leur nombre d'entrées, recherche sans accents sur tous les textes, identifiants et fichiers, chaque entrée avec tous ses textes, sa référence au jeu de base et sa source. En tête de chaque catégorie, la liste de ce qui n'est pas encore lu (section 6). Le lien garde la catégorie (`/lore.html#traits`).

**Exporter tout en JSON** télécharge `lore-elsewhere-<date>.json` (environ 400 Ko) : `format: "elsewhere-lore"`, `version: 1`, la date, les catégories avec leur compte et ce qui manque, et toutes les entrées. C'est le point de départ d'un univers personnalisé.

La page est **publiée avec le jeu** (`vite.config.ts`, construction normale et Pages) : elle ne contient que les textes propres à Elsewhere, déjà livrés dans le jeu lui-même. Elle reste hors des moteurs de recherche (`noindex`). Sa section **Jeu installé** (section 5) n'affiche les textes de RimWorld que dans le navigateur du joueur qui a choisi son dossier, lus à l'ouverture.

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

Choix de l'utilisateur (22 novembre) : quand RimWorld est installé chez le joueur, le jeu montre **les textes de RimWorld à la place de ceux d'Elsewhere**, qui restent le repli. Ces textes sont **lus à l'ouverture dans l'installation du joueur et jamais copiés** : rien dans le dépôt (les tests utilisent des définitions et des fichiers de langue écrits pour eux, aux mots inventés), rien dans une sauvegarde, rien dans le stockage du navigateur. La simulation et les sauvegardes ne gardent que des identifiants ; aucune règle ne change.

### Choisir le dossier une fois

**Options → Textes de RimWorld** (à l'accueil, et depuis le Menu en partie) : **Choisir le dossier…** ouvre le sélecteur de dossier du navigateur (`showDirectoryPicker`, API File System Access : Chrome, Edge, Opera) ; le joueur désigne le dossier de RimWorld (celui qui contient `Data`, ou bien `Data`, ou `Data/Core`). Seule la **poignée du dossier** est gardée, dans IndexedDB (base `elsewhere-rimworld-texts`), pour que le choix survive au rechargement ; la langue choisie est une préférence locale (`elsewhere.rimworldTexts.language`).

Au démarrage, la poignée est relue : si le navigateur garde l'autorisation, les textes sont lus aussitôt ; sinon (cas habituel après un redémarrage du navigateur) Options affiche **Autoriser la lecture**, qui redemande l'autorisation, et les textes d'Elsewhere restent affichés en attendant. Le sélecteur et la demande d'autorisation s'ouvrent dans le clic lui-même (appel avant toute attente), comme l'exige le navigateur. Sans cette API, Options le dit en français et rien ne change. **Langue des textes** : les langues du jeu (dossiers et archives `.tar` de `Data/Core/Languages`), par défaut celle choisie la dernière fois, sinon le français s'il est présent, sinon l'anglais. **Oublier ce dossier** efface la poignée et revient aux textes d'Elsewhere ; un dossier qui n'est pas le jeu ne change rien.

### Lire les textes

Un Worker dédié (`game-lore.worker.ts`) reçoit la poignée et la langue, lit seulement `Data/Core/Defs` (fichiers XML), la langue choisie (dossier ou archive `.tar`, lue en mémoire) et les chaînes `Keyed` de l'anglais (repli des pronoms), puis rend les entrées : le fil de la page ne lit ni n'analyse aucun fichier. La lecture passe par la source de données du lot 3 de la planète (`GameFolder`, `openGameLanguage`, lecteur `.tar`, injections `DefInjected` de `game-grammar.ts`), adaptée au dossier du navigateur sans être dupliquée.

Règles du jeu reprises (`DefInjectionPackage`, `TranslationHandleUtility`, `BackstoryDef`, `TraitDegreeData`, `ScenarioDef` décompilés, aucun code copié) : héritage `ParentName` pour un champ absent ; un « \n » écrit devient un saut de ligne ; un champ injecté remplace celui de la définition (noms de champ sans casse), `TODO` garde l'original ; un élément de liste est désigné par son indice ou par son libellé anglais normalisé (`NormalizedHandle`, suffixe « -n » si plusieurs éléments le partagent) ; une histoire sans `description` prend `baseDesc`, fin coupée et « \r » retiré.

Mesure : dans Node, l'analyse des définitions et de l'archive française prend 0,22 à 0,26 s (1 782 définitions dans 156 fichiers, 160 fichiers injectés). Dans le navigateur, cette analyse et la lecture des fichiers se font une fois, dans le Worker ; les recherches sont ensuite des lectures de table.

### Ce qui correspond

Correspondance par nom de définition du jeu de base, ou par les tables de l'importateur lues à rebours (`src/import/rimworld/map-*.ts`, correspondances **exactes** seulement : un animal ou un objet seulement approché garde son texte). Mesuré sur RimWorld 1.6 en français : **555 entrées du registre sur 983** ont le texte du jeu, plus 13 textes sans entrée dans le registre (titres de chef, océan et lac, deux bâtiments).

| Groupe | Texte du jeu | Définition lue |
| --- | --- | --- |
| Histoires du jeu de base | 166 / 166 | `BackstoryDef` : titre, titre court, au féminin, description |
| Traits | 65 / 65 | `TraitDef`, par degré : nom (et au féminin), description |
| Types de faction | 8 / 8 | `FactionDef` : nom, description ; titre du chef (et au féminin) dans le groupe `factions/titres-de-chef/<def>`, qu'Elsewhere n'a pas |
| Rôles des caravanes | 18 / 18 | `TraderKindDef`, `PawnKindDef` : nom |
| Milieux | 12 / 12 | `BiomeDef` : nom, description |
| Scénarios | 1 / 4 | `ScenarioDef Crashlanded` (« Atterrissage forcé ») ; les trois autres sont propres à Elsewhere |
| Objets | 104 / 489 | `ThingDef` exact ; pas les objets faits d'une matière (vêtements, armes, blocs), ni les viandes, que le jeu crée sans définition écrite |
| Animaux, plantes sauvages | 53 / 53, 32 / 32 | `ThingDef` : nom, description |
| Cultures | 8 / 9 | `ThingDef` |
| Bâtiments | 88 / 98 | `ThingDef` dont le bâtiment d'Elsewhere est l'équivalent exact |
| Histoires d'Elsewhere, prénoms, noms d'animaux, syllabes anciennes, romans | 0 | propres à Elsewhere, ou tirés par le jeu d'une grammaire et non d'une liste équivalente |
| Classes de lettres | 0 | les `LetterDef` du jeu n'ont pas de libellé |

La page `lore.html`, section **Jeu installé**, lit le même dossier (même contrôleur que les Options), affiche ce tableau pour l'installation lue et chaque entrée avec ses deux textes côte à côte, Elsewhere et jeu.

### Afficher les textes

`src/lore/lore-text.ts` : une recherche par identifiant (`loreText(id, champ, repli)`) et des aides par catégorie (`storyTitle`, `storyDescription`, `traitLabel`, `traitTooltip`, `factionTypeLabel`, `factionLeaderTitle`, `itemTitle`, `animalTitle`…) : le texte du jeu quand il est lu, celui d'Elsewhere sinon. Un nom prend la casse du repli (« Optimiste », « Union civile » : majuscule comme le `LabelCap` du jeu). Les titres suivent le sexe comme dans le jeu (`TitleFor`, `TitleShortFor`, `GetLabelFor`).

Les textes du jeu sur une personne portent ses symboles ; ils sont résolus pour la personne montrée comme le jeu le fait (`FullDescriptionFor`, `TipString`) : `Formatted` pour `{PAWN_…}`, avec les formes genrées `{PAWN_gender ? … : … : …}` ; puis `AdjustedFor` pour `[PAWN_…]`, avec les règles de `GrammarUtility.RulesForPawn` d'une personne nommée (nom sans article, pronoms des chaînes `Keyed` de la langue, `[PAWN_title]` titre de la dernière histoire) ; puis le traitement de la langue (élisions du français) et les phrases mises en majuscule. Une personne dont le sexe n'est pas encore connu (offre d'arrivée) prend la forme neutre. L'infobulle d'un trait montre le texte du jeu puis la règle telle qu'Elsewhere l'écrit ; les gains et interdictions des histoires restent ceux d'Elsewhere.

Lieux branchés : Bio et infobulles des histoires (`background-inspection.ts`, inspecteur natif) ; sélection des personnages (accueil natif et page HTML de repli) ; lettres d'arrivée ; traits (Bio, tableau Travail, candidats, lettres, inspecteur HTML) ; panneau des factions (type, description en infobulle, titre du chef) et liste des factions de la création du monde ; milieu du lieu de départ ; possessions de départ ; inspection des piles, bâtiments, plantes et animaux (nom, et description du jeu en sous-titre) et fiche d'information des objets. Un changement de textes repeint l'interface (`onLoreTextsChange`).

### Limites

- Les langues autres que l'anglais et le français sont lues avec le traitement de texte par défaut (pas les règles propres à l'allemand, au russe…).
- Les noms composés avec une matière (« parka en tissu »), les viandes, les classes de lettres et ce qui n'est pas encore dans le registre (section 6) gardent le texte d'Elsewhere ; les autres listes de noms d'objets (factures, filtres, commerce) et la page des scénarios ne sont pas encore branchées.
- Les extensions et les mods ne sont pas lus (`Data/Core` seul).
- Vrai client (serveur de développement, Chromium) : vérifié avec un dossier écrit à la main (mots inventés) placé dans le stockage privé du navigateur et rendu par le sélecteur remplacé, car le sélecteur de dossier du système ne se pilote pas depuis les outils de test ; la vraie installation n'a été lue que dans Node (test optionnel). Vu : lecture dans le Worker à partir d'une vraie poignée, poignée seule gardée dans IndexedDB et relue au rechargement, page « Jeu installé » côte à côte et changement de langue, Options du jeu (choisir, oublier, langue), Bio d'une colonie de test avec nom de trait au féminin et infobulle résolue, aucune erreur dans la console.

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
- Jeu installé (section 5), sur un dossier écrit à la main (`tests/helpers/hand-made-rimworld.ts`, mots inventés) lu par une fausse poignée de dossier : `tests/game-lore-reader.test.ts` (8 cas : libellé de liste normalisé, dossier trouvé depuis l'installation, `Data` ou `Core`, langues et version, seuls les fichiers utiles lus, injections, `TODO`, éléments par libellé et par indice, héritage, `baseDesc`, pronoms de repli anglais, refus en français, groupes correspondants) ; `tests/lore-text.test.ts` (6 cas : chaque catégorie sans puis avec les textes du jeu, symboles de personne, retour au repli) ; `tests/rimworld-texts-options.test.ts` (6 cas : langue par défaut, sélecteur ouvert dans le clic, poignée seule gardée, changement de langue, oubli, autorisation redemandée, refus, navigateur sans sélecteur, mauvais dossier, annulation, échec de lecture, page Options avec un faux sélecteur) ; `tests/lore-text-ui.test.ts` (5 cas : Bio et infobulles, inspection d'une pile et fiche d'objet, lettre d'arrivée, panneau des factions, sélection des personnages).
- Test optionnel sur la vraie installation : `RIMWORLD_DIR=<dossier du jeu> npx vitest run tests/game-lore-installed.test.ts` (langue `RIMWORLD_LANGUAGE`, français par défaut) : chaque histoire et chaque trait du jeu de base lus, groupes entiers attendus, aucun symbole de personne laissé non résolu pour un homme, une femme et un sexe inconnu ; il n'affiche que des nombres et des oui/non. Vert en français et en anglais sur RimWorld 1.6.
