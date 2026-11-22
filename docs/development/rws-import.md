# Import d'une sauvegarde RimWorld (étapes 1 à 3)

Le 22 novembre 2026, à la demande de l'utilisateur : un outil qui lit une vraie sauvegarde RimWorld 1.6 (`.rws`, jeu de base seul) et en fait une colonie Elsewhere valide. **Aucun changement de schéma** : le monde produit est au schéma courant et n'utilise que les types existants. Ce qu'Elsewhere ne sait pas représenter est adapté ou laissé de côté, et chaque cas est compté dans un rapport en français.

- **Étape 1 — analyse** (`src/import/rimworld/analyze.ts`) : lit la sauvegarde et dit, famille par famille, ce qui est repris tel quel, ce qui est adapté (et comment) et ce qui est perdu. Rien n'est construit ; le code est du TypeScript pur, identique dans un Worker du navigateur et dans Node.
- **Étape 2 — conversion** (`src/import/rimworld/convert.ts`, `scripts/import-rws.ts`) : construit le monde Elsewhere, le valide, vérifie qu'il se recharge à l'identique et le fait tourner quelques centaines de ticks.
- **Étape 3 — dans le jeu** (`src/import/rimworld/import-job.ts`, `import.worker.ts`, `src/ui/rimworld-import.ts`, page « rimworld » de `src/ui3d/native-front.ts`) : le bouton « Importer une sauvegarde RimWorld » de « Charger une partie » convertit le fichier choisi dans un Worker dédié, montre la progression, le bilan et le rapport, puis « Jouer cette colonie » ouvre la colonie par le chemin de chargement ordinaire (section 7).

La sauvegarde du joueur n'est que lue : jamais modifiée, déplacée ni copiée dans le dépôt. La sauvegarde convertie est sa partie : elle s'écrit sous `tmp/` et ne se commite pas.

## 1. Utilisation

```
npx tsx scripts/import-rws.ts <sauvegarde.rws> tmp/rws-import/<nom>.json [--ticks 300] [--no-planet]
```

Le script écrit la partie Elsewhere (`<nom>.json`, à charger comme une sauvegarde) et le rapport `<nom>-rapport.md` à côté. Il refuse clairement une sauvegarde d'une autre version que 1.6, avec une extension (Royalty, Ideology, Biotech, Anomaly, Odyssey) ou un mod, ou sans carte de colonie ; le rapport dit pourquoi.

## 2. Lecture de la sauvegarde

Faits lus dans le jeu (décompilation de `MapFileCompressor`, `DataExposeUtility`, `MapExposeUtility`, `DataSerializeUtility`, `ShortHashGiver`, `GenText.StableStringHash`, `TerrainGrid`, `RoofGrid`, `FogGrid`, `SnowGrid`, `PlanetLayer`, `SurfaceLayer`, `GenAdj`, `BodyDef`), aucun code repris :

- **XML** : lecteur minimal écrit pour l'outil (`xml.ts`), sans dépendance ; les valeurs par défaut absentes du fichier (rotation 0, pile de 1, identifiant de faction 0, bonne volonté 0) sont restituées.
- **Grilles** : chaque tableau « …Deflate » est du base64 de DEFLATE brut (sans en-tête zlib) ; sinon du base64 simple. Les cases sont en ordre `z × largeur + x`, comme les tuiles d'Elsewhere. Les grilles de définitions (terrain, sous-sol, fondations, couleur, toits, objets compressés, neige) stockent des entiers 16 bits petit-boutistes ; le brouillard et les aires sont des bits, poids faible d'abord. Le décodeur DEFLATE (`bytes.ts`) est écrit pour l'outil (blocs stockés, fixes et dynamiques) et testé contre `zlib`.
- **Hachages courts** : une définition reçoit `hash(nom) mod 65535` sur 16 bits (hachage : 23, puis ×31 + caractère, entier signé 32 bits) ; une valeur nulle ou déjà prise est incrémentée, dans l'ordre des noms de son type. L'outil résout les collisions entre les noms de ses tables ; une valeur qui ne correspond à aucun nom connu est comptée comme « inconnue », jamais devinée. Sur `Yes.rws`, les 14 biomes, 4 rivières, 5 routes, 4 modificateurs, 3 toits, toutes les roches et tous les terrains sont reconnus.
- **Roches** : les murs de roche et les minerais intacts ne sont pas des objets mais une grille compressée (« compressedThingMap ») ; les roches endommagées restent des objets.
- **Planète** : la couche de surface garde par case le biome, l'altitude (+8192), le relief, la température (×10, +300), la pluie, les marécages (×255), la distance aux rivières, et les rivières et routes sous forme (case, indice du voisin, définition).

## 3. Correspondances (une table par famille)

Chaque table associe un nom de définition du jeu (identifiant utilisé comme clé) à l'élément Elsewhere, à une adaptation expliquée ou à la raison de son absence.

| Famille | Fichier | Principe |
|---|---|---|
| Monde, factions | `map-world.ts`, `planet.ts` | 14 biomes, 5 reliefs, 4 rivières, 5 routes à l'identique ; modificateurs montagne/rivière/côte déduits de la case (règle d'Elsewhere), grottes reprises ; factions dans le même ordre avec leur nom, colonies étrangères sur leur case, bonne volonté reprise (sauf ennemis permanents) ; chefs de faction recréés par Elsewhere |
| Terrain, toits, roches | `map-terrain.ts` | sols naturels, eaux, roche brute ou lissée ; sols construits (bois, dalles, carrelages, 63 tapis) posés sur le sol naturel du dessous ; béton, carrelages d'or et d'argent adaptés ; toits construits, de roche fine et épaisse ; roches et minerais avec leur propriétaire de minage |
| Plantes | `map-plants.ts` | 30 espèces sauvages et 8 cultures avec leur croissance ; ambroisie, fleurs en pot, cacaoyer, drogues absents ; souches et arbres brûlés non recréés |
| Bâtiments | `map-buildings.ts` | 100 définitions ; taille du jeu → cases occupées par le jeu → ancre et orientation Elsewhere couvrant les mêmes cases ; matière reprise si Elsewhere l'admet pour ce bâtiment ; qualité, points de vie (dégâts par rapport au maximum d'Elsewhere), portes, lits (médical, prisonnier), étagères avec leurs filtres, carburant |
| Objets, matières | `map-items.ts` | ressources, blocs, morceaux, tissus, cuirs, laines, repas, nourriture, œufs, médicaments ; matières (« stuff ») pour bâtiments, vêtements et armes |
| Vêtements, armes | `map-items.ts` | famille × matière (« plainleather-parka ») ; armures et casques selon le métal ; qualité et points de vie ; armes à feu et arcs à l'identique, armes de mêlée par métal |
| Personnes, animaux | `map-pawns.ts` | colons ; espèces animales (49 à l'identique, cochon, chèvre, mouton, vache, poule et oie adaptés à l'espèce la plus proche, thrumbo absent) |
| Traits | `map-pawns.ts` | tous les traits du jeu de base par (définition, degré) sauf pyromane ; règles de compatibilité d'Elsewhere appliquées |
| Histoires | `map-pawns.ts`, `core-tables.ts` | voir section 4 |
| Compétences, travaux | `map-pawns.ts` | niveaux, expérience depuis le dernier niveau, passions ; priorités dans l'ordre des 20 types de travail du jeu ; un travail refusé par l'histoire reste à 0 |
| Santé | `map-pawns.ts`, `core-tables.ts` | parties du corps humain numérotées comme le jeu (ordre préfixe du corps « Human », 64 parties) ; blessures (griffure → coupure), cicatrices avec leur douleur, parties manquantes, jambe de bois, pied et main de bois, prothèses simples ; chaque ajout est vérifié par le validateur de santé d'Elsewhere |
| Zones, aires, recherche | `map-colony.ts` | zones de stockage (priorité, filtres), champs (plante, semis, coupe), zone domestique, déneigement ; 55 projets de recherche (terminés ou en cours) après leurs prérequis Elsewhere |

`core-tables.ts` est généré par `scripts/rws-import-core-tables.ts` depuis les définitions du jeu installé : uniquement des nombres et des identifiants (gains de compétences et étiquettes de travail des 784 histoires, ordre des 64 parties du corps humain), aucun texte.

## 4. Histoires

Depuis le schéma 370, Elsewhere contient les 166 histoires mélangeables du jeu de base sous leur propre identifiant (titres et récits écrits en français pour Elsewhere, voir [V370](../gameplay/backstories-v370.md)). Une histoire de la sauvegarde qui en fait partie est donc **reprise telle quelle**, avec ses gains de compétences, ses travaux refusés et ses traits liés. Une histoire « solide » d'un personnage nommé, absente du catalogue, devient l'histoire mélangeable du même moment de la vie aux **effets mécaniques les plus proches** : somme des écarts de gains de compétences, plus 6 par étiquette de travail refusée d'un côté et pas de l'autre, les deux côtés lus dans la même table des effets du jeu ; un âge adulte choisi n'exige jamais un travail que l'enfance refuse ; une paire reprise telle quelle n'est jamais modifiée. L'âge adulte n'est donné qu'à partir de 20 ans. Les niveaux de compétences importés restent exactement ceux de la sauvegarde (l'histoire n'y ajoute rien), mais un travail que l'histoire refuse dans le jeu de base passe à la priorité 0. Aucun titre ni description du jeu n'est repris ; le rapport donne chaque histoire et, pour une histoire rabattue, son écart.

## 5. Conversion

1. **Planète.** Le maillage d'Elsewhere a exactement le même nombre de cases que la couche de surface du jeu pour une couverture donnée (119 904 à 30 %), dans le même ordre et avec les voisins dans le même ordre : sur `Yes.rws`, les 2 234 tronçons de route forment 8 réseaux aux cases de degré 2, et 2 085 des 2 105 tronçons de rivière relient des cases dont la distance à la rivière diffère de 1. La planète est donc recopiée case par case, puis la vraie usine de nouvelle partie géographique d'Elsewhere crée la colonie sur la même case. Si la recopie est impossible (maillage différent, sauvegarde sans grille du monde, factions refusées), Elsewhere régénère sa propre planète depuis la même graine et la même couverture et place la colonie sur une case du même biome (relief, rivières, routes et factions diffèrent alors de la partie). Si aucune colonie géographique n'est possible (carte non carrée ou hors des tailles 200 à 325), la carte est importée sans planète (monde local seul). Le rapport dit lequel des trois cas s'applique.
2. **Carte locale.** Le contenu généré par l'usine (personnes de départ, plantes, roches, ruines, animaux) est retiré, puis remplacé : terrain, roches, toits, brouillard ; bâtiments (murs et portes d'abord, lampes murales en dernier) ; plantes ; colons et animaux ; objets au sol ; zones, aires, filtres d'étagères ; recherche ; date.
3. **Date.** L'ancre du calendrier est choisie pour que la date affichée soit celle de la sauvegarde. Le compteur interne de la partie repart de la création : les horloges d'Elsewhere ne sont pas décalées de 12 millions de ticks.
4. **Contrôle.** `validateWorld` doit être vide, la sauvegarde doit se relire à l'identique, puis le monde avance ; il est revalidé toutes les 60 ticks.

## 6. Résultat mesuré sur `Yes.rws`

Sauvegarde : RimWorld 1.6.4633, jeu de base seul, 12 305 756 ticks (205 jours), Phoebe (facile), scénario « tutoriel », carte 250 × 250, 26 378 objets, 164 êtres vivants dont 12 colons, 24 zones, 55 projets de recherche entamés, graine « poivre », couverture 30 %, 119 904 cases, 11 factions.

Conversion par `scripts/import-rws.ts` en 28 s (Node 24) : planète recopiée case par case (119 904 cases, 2 105 tronçons de rivière, 2 234 tronçons de route, grottes sur 4 464 cases), colonie sur sa case (86 845, forêt tempérée), 10 factions avec leur nom et 96 colonies étrangères sur leur case, bonne volonté du joueur reprise envers 6 factions. Date reprise : 11 Jugust 5503. `validateWorld` vide, rechargement identique (12,7 Mo), 300 ticks joués sans erreur avec revalidation toutes les 60 ticks ; les douze colons travaillent, mangent et se déplacent.

Comptes par famille (rapport `tmp/rws-import/Yes-rapport.md`, éléments par définition du jeu) :

| Famille | Dans la sauvegarde | Créés | Repris | Adaptés | Perdus |
|---|---:|---:|---:|---:|---:|
| Terrain (cases) | 62 500 | 62 500 | 62 500 | 0 | 0 |
| Toits (cases) | 3 377 | 3 377 | 3 377 | 0 | 0 |
| Plantes | 21 828 | 21 403 | 21 403 | 0 | 425 |
| Bâtiments | 2 193 | 2 105 | 1 947 | 195 | 89 |
| Objets et piles | 2 052 | 2 008 | 1 997 | 11 | 44 |
| Vêtements | 192 | 170 | 157 | 13 | 22 |
| Armes | 33 | 32 | 25 | 7 | 1 |
| Personnes | 14 | 12 | 12 | 0 | 2 |
| Traits | 25 | 25 | 25 | 0 | 0 |
| Histoires | 24 | 23 | 14 | 9 | 1 |
| Santé des colons | — | 13 | 8 | 5 | 1 |
| Animaux | 150 | 149 | 124 | 25 | 15 |
| Zones et aires | 28 | 25 | 14 | 11 | 2 |
| Recherche | 55 | 44 | 44 | 0 | 11 |

Principales adaptations : 138 conduits enterrés deviennent des conduits ordinaires ; 16 barricades deviennent des sacs de sable ; matières refusées par Elsewhere pour certains bâtiments remplacées par la matière par défaut (sacs de sable en laine, fauteuil en laine) ; lit royal → lit double ; 9 cochons → sangliers, 16 chèvres → bouquetins (et leur viande) ; griffures → coupures ; 9 histoires de personnages nommés vers l'histoire du jeu de base la plus proche (écart de 4 à 25 ; les 14 autres sont reprises telles quelles) ; sept champs à semis désactivé perdent les cases couvertes d'herbes sauvages (Elsewhere y lancerait une récolte impossible) ; obéissance, maître et lien de deux animaux liés repris, nom des autres.

Principales pertes : souches et arbres brûlés (388), ambroisie (20), fleurs en pot (13) ; urnes, colonnes et stèles anciennes (42), lampes murales au-dessus d'un meuble (15), tourelles autres que la mini-tourelle (9), geysers et générateurs géothermiques (8) ; 15 cadavres, 8 meubles emballés, bioniques et drogues ; ceintures bouclier, masques et voiles (22) ; 2 mécanoïdes ; un thrumbo ; 14 gestations ; santé des animaux ; 11 projets de recherche sans équivalent (dont Électricité, acquise d'office).

**Autres sauvegardes.** 25 autres sauvegardes 1.6 du même dossier (jeu de base, couverture 30 %) se convertissent, se valident et se rechargent à l'identique ; une sauvegarde 1.4 est refusée avec son motif. Ces essais ont fait corriger quatre cas : aire domestique vide, groupes d'insectes générés, plantes sous un bâtiment (règles d'Elsewhere reprises : cultures sur conduits, plantes légères sous les meubles qui les gardent), objets qu'Elsewhere ne laisse pas porter en inventaire. Sur l'une d'elles (« Canard »), le monde devient invalide après 184 ticks : la flore sauvage d'Elsewhere fait naître une herbe sur une case où une semaille est déjà prévue (« Construction overlaps existing content ») ; c'est un défaut du jeu lui-même, pas de l'import, signalé et non corrigé ici (fichiers partagés, changement de règle).

## 7. Dans le jeu (étape 3)

**Parcours.** « Charger une partie » → **Importer une sauvegarde RimWorld** ouvre le sélecteur de fichiers du navigateur (`.rws`). La page « Importer une sauvegarde RimWorld » montre alors l'étape en cours et une barre de progression, avec **Annuler l'import** (ou Échap). À la fin :
- **sauvegarde refusée** (autre version que 1.6, extension, mod, pas de carte) : le motif en français, les faits lus (version, modules, carte), **Télécharger le rapport** et **Choisir un autre fichier** ;
- **échec** (fichier illisible, conversion ou validation impossible) : le message en français ; la colonie ouverte et les sauvegardes ne sont pas touchées ;
- **conversion réussie** : un résumé (partie RimWorld, conteur et scénario, carte, monde, planète reconstruite ou non, colons et animaux de la colonie), le bilan « repris · adaptés · perdus » de chaque famille et les douze plus grosses pertes ; à gauche, chaque famille ouvre son détail complet (messages et chaque définition du jeu avec son compte, son statut, son équivalent Elsewhere et l'explication), qui défile ; **Télécharger le rapport** enregistre le rapport Markdown complet (`<nom>-rapport-import.md`) ; puis **Jouer cette colonie** ou **Annuler**.

**Fil d'exécution : un Worker dédié à l'import**, et non le Worker de simulation. La conversion est un calcul synchrone de 15 à 30 s sur une grande sauvegarde : dans le Worker de simulation, elle bloquerait ses requêtes (copie de récupération de la colonie ouverte, publications, sauvegardes) pendant tout ce temps ; un calcul synchrone ne s'annule qu'en arrêtant son fil, ce qui ne doit jamais être celui de la simulation ; enfin le code de l'import (lecteur XML, tables, recopie de la planète) n'est chargé qu'au moment d'importer, dans son propre paquet. C'est le même schéma que le contrôle des sauvegardes (`save-check.worker.ts`). Le fichier lui-même est confié au Worker, qui le lit : le fil d'affichage ne tient jamais le texte RimWorld. Le Worker envoie l'étape et l'avancement (`{type:'progress'}`), puis un seul résultat (`{type:'done'}`), et la page l'arrête aussitôt (mémoire rendue). **Annuler** arrête le Worker immédiatement. Sans Worker disponible, l'import est refusé avec un message : il ne tourne jamais sur le fil d'affichage.

**Ce que fait le Worker** (`runRwsImport`) : lecture, analyse, refus éventuel avec le rapport ; sinon conversion (planète, colonie sur sa case — l'étape longue, dont la barre suit les étapes du générateur —, terrain, bâtiments, plantes, personnes, objets, zones, recherche et date), `validateWorld`, texte de la sauvegarde Elsewhere, puis le chemin de chargement complet sur ce texte (`deserializeCampaign`, validation stricte comprise) et la vérification qu'il se réécrit à l'identique. Aucun tick n'est joué : le monde adopté est exactement celui de la conversion. Les parts de la barre viennent d'une mesure sur `Yes.rws` dans Node (14 s : création de la colonie 58 %, contrôle du rechargement 16 %).

**Adoption.** « Jouer cette colonie » passe le texte converti à `GameSession.loadExternal`, comme **Importer un fichier** : la colonie ouverte, s'il y en a une, va dans « Colonie précédente », le Worker de simulation relit et valide strictement la sauvegarde, et un refus laisse la colonie actuelle intacte. Rien n'est enregistré par l'import lui-même : ni le fichier RimWorld, ni le rapport (seulement téléchargé si le joueur le demande), ni la sauvegarde convertie, qui n'existe qu'en mémoire jusqu'à « Jouer » ou « Annuler ». La sauvegarde automatique et les copies nommées s'appliquent ensuite comme pour toute partie.

## 8. Ce qui reste

- **Vrai client** : vérifié le 22 novembre avec la petite colonie des tests seulement (serveur Vite de développement, panneau de navigateur en 1280 × 800, son et musique coupés ; le fichier est donné au sélecteur par un script, la boîte de dialogue du système n'étant pas pilotable) : le vrai Worker d'import convertit le fichier, le résumé et le détail d'une famille s'affichent, « Jouer cette colonie » passe par l'écran « Chargement de la colonie » et la colonie tourne (deux colons, provisions) ; une variante « Biotech » affiche son refus, Échap revient à « Charger une partie ». La version construite contient le Worker d'import dans son propre fichier (`import.worker-….js`, 5,2 Mo), chargé seulement à l'import. Une vraie sauvegarde de 16 Mo n'a été convertie que dans Node (test optionnel, 14 s) : la durée dans un Worker du navigateur et le pic de mémoire (texte XML, arbre lu, monde et texte converti, environ quatre à cinq fois la taille du fichier) restent à mesurer.
- « Dans Elsewhere » donne le nom français de la cible pour les objets, vêtements, armes, bâtiments, plantes, animaux, traits, terrains et recherches (`src/import/rimworld/labels-fr.ts`, qui lit les tables de noms du jeu) ; les autres familles (zones, toits, santé) gardent leur texte. Le script passe par `npx tsx`, car ces tables utilisent des imports sans extension.
- L'import n'est proposé que dans l'interface native (pas dans l'ancienne interface HTML de développement).
- Non repris dans cette étape : prisonniers, visiteurs et ennemis présents, mécanoïdes ; cadavres, saletés, chantiers et plans, meubles emballés, ouvrages inachevés ; souvenirs, pensées, relations sociales, emplois du temps, politiques (tenues, nourriture, drogues), factures des établis ; dressage autre que l'obéissance d'un animal lié ; santé des animaux ; maladies, dépendances et implants ; neige au sol ; aires autorisées personnalisées ; sites et objets du monde autres que les colonies.
- Le repli sur une planète régénérée depuis la graine n'a été exercé qu'en forçant l'absence de grille du monde : il n'arrive pas sur les sauvegardes du jeu de base à 30 % de couverture. Les couvertures 50 % et 100 % n'ont pas été vérifiées sur une vraie sauvegarde.

## 9. Tests

- `tests/rws-import.test.ts` : décodage (DEFLATE contre `zlib`, base64, hachages courts vérifiés sur une vraie sauvegarde, XML), refus d'une extension, correspondances (histoires, parties du corps), analyse et rapport, conversion de la petite colonie de `tests/fixtures/rws/petite-colonie.rws` (20 × 20, grilles encodées comme le jeu, écrite par `scripts/rws-import-fixture.ts`) : validation, rechargement exact, contenu et 240 ticks.
- Test optionnel : `RWS_IMPORT_SAVE=<chemin.rws>` importe une vraie sauvegarde (planète, validation, rechargement, 120 ticks).
- `tests/rws-import-flow.test.ts` (étape 3) : ce que fait le Worker sur la petite colonie (étapes dans l'ordre, barre qui ne recule jamais, sauvegarde identique à la conversion, valide et qui se recharge à l'identique, bilan par famille et pertes, rapport sans ticks prétendus), refus d'une extension et échec d'un fichier qui n'est pas une sauvegarde ; protocole du Worker (lecture du fichier dans le Worker, un seul résultat, fichier vide) ; client de la page avec un Worker de substitution (progression, arrêt du Worker à la fin, annulation immédiate, jamais de repli sur le fil d'affichage, erreur du Worker) ; adoption par `GameSession.loadExternal` (rechargement strict, rien d'enregistré par l'import, « Colonie précédente » ensuite). Optionnel avec `RWS_IMPORT_SAVE` : tout le travail du Worker sur une vraie sauvegarde (planète et colonie dans la progression).
- `tests/native-front-rimworld-import.test.ts` : le bouton dans « Charger une partie », le sélecteur `.rws`, la page de progression avec Annuler et Échap, le refus et son motif, le téléchargement du rapport, l'échec, le résumé et le détail par famille, « Jouer cette colonie » qui transmet exactement la sauvegarde convertie, et un chargement refusé qui garde la colonie convertie à l'écran.

