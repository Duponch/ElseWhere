# Pyromane et frénésie incendiaire — V368

**Schéma 368.** Le dernier trait du jeu de base laissé de côté par les lots 361 et 362 rejoint le tirage : **Pyromane**. Il n'éteint jamais un feu, ses crises extrêmes sont toujours des **frénésies incendiaires** (il erre et met le feu à ce qui brûle autour de lui), qui peuvent aussi survenir sans raison, et il aime voir les flammes. Pour cela, Elsewhere gagne un canal général : un trait peut désormais retirer des travaux, comme un passé.

Sources : RimWorld 1.6.4871, définitions `Defs/TraitDefs/Traits_Singular.xml` (Pyromaniac), `Defs/MentalStateDefs/MentalStates_Mood.xml` (FireStartingSpree, break et état), `Defs/ThinkTreeDefs/SubTrees_Misc.xml`, `Defs/ThoughtDefs/Thoughts_Situation_Traits.xml` et `Thoughts_Memory_Misc.xml`, `Defs/WorkTypeDefs/WorkTypes.xml`, et classes décompilées `JobGiver_FireStartingSpree`, `JobDriver_Ignite`, `MentalState_FireStartingSpree`, `Pawn_NativeVerbs`, `Verb_Ignite`, `VerbDefsHardcodedNative`, `Stance_Warmup`, `JobDriver` (`TryActuallyStartNextToil`), `Pawn_JobTracker`, `FireUtility`, `ThoughtWorker_PyromaniacNearFlames`, `MentalBreakWorker`, `MentalBreaker`, `MentalStateWorker`, `MentalStateHandler`, `TraitMentalStateGiver`, `CellFinder.TryFindClosestRegionWith`, `ForbidUtility`, `RegionListersUpdater`, `PawnGenerator.GenerateTraitsFor`, `WorkGiver_FightFires`, `JobDriver_Wait`, `FloatMenuOptionProvider_ExtinguishFires`. Aucun texte ni code du jeu n'est repris.

## Le trait

Fréquence 0,8, un seul degré, aucun conflit, aucun travail requis, permis aux hostiles. Il est tiré comme les autres (V361) pour les candidats d'une nouvelle partie et toute personne née dans un monde du schéma 368. Un passé qui interdit la lutte contre le feu ne le refuse pas (le jeu de base ne refuse un trait que pour ses travaux *requis*).

## Les travaux qu'un trait retire

Le jeu de base lit les étiquettes de travail désactivées des passés **et** des traits (`CombinedDisabledWorkTags`). Elsewhere ne lisait que les passés : la même fonction (`backgroundTagRefusal`) lit désormais aussi les traits, dans leur ordre, après le passé. Seul Pyromane retire une étiquette, **Incendie** (`disabledWorkTags Firefighting`) : aucun trait plus ancien n'en retire, donc rien ne change sous 368. Partout où le jeu vérifie un travail impossible, le trait compte :

- **Travail** : la case Incendie est grisée, avec la raison « Incapacité liée au trait : Pyromane » ; la priorité ne peut pas être levée, une priorité enregistrée se lit 0 ;
- **réglages initiaux** d'un nouveau colon (`EnableAndInitialize`) : Incendie, qui démarre d'habitude actif, reste éteint ;
- **planificateur** et **urgences** : jamais de lutte contre le feu, même mobilisé au contact d'un feu (`JobDriver_Wait`) ;
- **ordre direct** « Éteindre » : refusé avec la même raison ;
- **Bio**, demande d'accueil, candidats de départ : l'incapacité est listée ; l'avertissement « personne ne peut lutter contre le feu » de la création de partie en tient compte.

## La frénésie incendiaire

**Crise extrême, Pyromane seulement** (`requiredTrait`), poids 1, durée 6 000 à 10 000 ticks du jeu de base, fin possible après 6 000 avec un délai moyen de 0,033 jour, fin au sommeil, colons seulement (jamais un prisonnier). **`theOnlyAllowedMentalBreaks`** : tant qu'elle peut survenir, un pyromane n'a aucune autre crise extrême (ni fureur, ni colère meurtrière) ; ses crises mineures et majeures sont celles de tout le monde. Lettre de menace mineure comme la fureur ; une crise causée par l'humeur donne la catharsis à sa fin.

**Crise spontanée** (`randomMentalState`, courbe (0, 50)) : une fois tous les 50 jours en moyenne, à toute humeur, testée toutes les 150 ticks quand aucune crise d'humeur ne survient ; les donneurs des traits passent dans l'ordre des traits du colon (un gourmand pyromane garde sa frénésie alimentaire). Elle n'est pas causée par l'humeur : pas de catharsis à la fin (V362).

**Ce que fait le colon** (`JobGiver_FireStartingSpree`), à chaque fin de tâche :

1. après chaque tâche, une **attente** de 80 à 140 ticks (`nextMoveOrderIsWait`) ;
2. sinon, trois fois sur quatre, il cherche une **cible** : une chose de sa région qui brûle maintenant (bâtiment, objet ou plante d'inflammabilité au moins 0,01, pas protégée par un mur plein, pas déjà en feu, pas sous ses pieds), tirée au hasard ; la région est toujours la sienne, car un colon en crise ne respecte pas les zones permises (`CaresAboutForbidden`) ;
3. sinon il **erre** vers une case à 10 cases au plus ;
4. pour une cible, il marche jusqu'à la toucher, **vise 3 secondes** (180 ticks, ×1,25 pour un tireur prudent, ×0,5 pour une gâchette facile), **allume un feu de taille 0,3** dans la case de la cible la plus proche de lui (là où le jeu de base le permet : pas sur un feu, une mousse ou un sol ininflammable), puis **récupère 1,3 seconde** (78 ticks). La tâche échoue si la cible disparaît ou prend feu avant qu'il l'atteigne ; s'il ne trouve aucun chemin, il attend 250 ticks.

Le feu suit ensuite les règles d'Elsewhere (propagation, dégâts, annonce « Incendie dans le foyer », lutte des autres colons). Les tirages de la crise (attente, chance, cible, case d'errance, crise spontanée) ont leur flux propre, fonction de la graine, du colon et du tick ; le choix de la crise d'humeur reste sur le flux des crises.

## Pensées

- **Beau feu** (`PyromaniacNearFire`) : +2 par feu à 8 cases au plus, dans la même pièce et pas dans le brouillard, au plus quatre (+8). Comme `FireUtility.NumFiresAt`, une case en feu compte le feu et chaque chose qui brûle dessus, un colon ou un animal en feu compte, et un **feu de camp ou une lampe-torche allumés** comptent aussi. Seulement sur la carte.
- **Arme incendiaire** (`PyromaniacHappy`, +2) et **arme incendiaire utilisée** (`PyroUsed`, +8, 8 heures) : non livrées, Elsewhere n'a ni lance-flammes, ni lanceur incendiaire, ni cocktail Molotov.

## Adaptations

- **Région** : une région du jeu de base est une partie connexe d'une pièce dans un bloc de 12 × 12 cases ; une porte est sa propre région. Elsewhere la calcule ainsi, mais compte les meubles infranchissables comme cases de la pièce. Les choses touchables depuis la région (adjacentes sans couper un coin plein, comme la lutte contre le feu) en font partie, comme dans `RegionListersUpdater`. Les chantiers (cadres) ne sont pas des cibles : le feu d'Elsewhere ne les brûle pas.
- **Besoins pendant la crise** : comme pour les autres crises d'Elsewhere, un besoin extrême (faim à 5 % ou moins, épuisement) passe avant ; il met fin à la tâche en cours.
- **Errance** : une case tenable et atteignable au hasard dans le rayon, comme les autres errances de crise, au lieu de `RandomWanderDestFor`.
- **`nextMoveOrderIsWait`** démarre faux au début de la crise (le jeu de base le garde du dernier ordre d'errance).
- **Avec une cargaison retenue** au début de la crise, le colon erre comme dans les autres crises jusqu'à pouvoir la poser.
- La frénésie en caravane (permise par le jeu de base, sans cible hors carte) n'est pas jouée : les crises d'Elsewhere ne commencent que sur la carte.

## Laissés de côté

- Les deux pensées d'arme incendiaire (voir plus haut) ;
- les objets de départ du trait (`possessions` : cocktail Molotov, 10 à 20 carburant chimique), la méditation des flammes (Royalty) et la valeur marchande (−20 %), absentes du jeu ;
- l'instigateur du feu (le jeu de base le note sur le feu) : Elsewhere ne garde pas d'instigateur.

## Sauvegardes

Nouveaux contenus, refusés en dessous de 368 et malformés : le trait `pyromaniac` ; la crise `fire-starting-spree` avec sa tâche (`igniteId` : la chose visée, un bâtiment, un objet ou une plante, jamais une personne ; `stanceCore` : fin de la visée ou de la récupération, au plus 225 ticks plus tard ; `cast` : allumage tenté ; `waitNext`), tenue seulement par un pyromane libre de la colonie. Une sauvegarde 367 passe à 368 par le seul numéro : aucun trait n'est donné après coup.

## Vérifications

`tests/pyromaniac-368.test.ts` (7 cas, vrais ticks de `stepWorld`) : données du jeu de base (fréquence, absence de conflit, seul trait qui retire un travail, catalogue de la crise, durées de la visée et de l'attente) ; fréquence du premier tirage à 368, un enfant protégé peut être pyromane, tirages identiques au code d'avant ce lot sous 368 (empreinte calculée sur le code du schéma 367), aucune naissance ni offre pyromane sous 368, candidats du tutoriel toujours capables de se battre ; refus de l'Incendie (raison, onglet Travail, réglages initiaux, ordre direct), un feu du foyer éteint par l'autre colon et jamais par le pyromane ; crise extrême forcée par le seul flux des crises : les cibles de la région, visée de 180 ticks, feu allumé sur chaque cible, récupération de 78 ticks, attentes de 80 à 140 ticks, sauvegarde rechargée pendant une visée et même suite sur 120 ticks, fin naturelle avec catharsis ; crise spontanée (flux propre forcé) sans catharsis et jamais chez un autre colon ; pensée Beau feu (feu de camp, pile en feu, portée, plafond de quatre, autre pièce) ; refus des contenus 368 dans une sauvegarde 367, refus de chaque champ malformé, migration 367 → 368 par le seul numéro.

Oracles précisés sans affaiblir de règle : les fréquences et l'absence de Pyromane « au schéma 362 » de `trait-links-362` se lisent désormais au schéma 362 ; l'identifiant inconnu de `traits.test.ts` n'est plus `pyromaniac` (devenu un vrai trait) ; le contrôle de présentation des crises (`mental-crises-presentation-v211`) reçoit le démarreur de la nouvelle crise ; l'aide des anciennes sauvegardes (`tests/scenarios/old-schema.ts`) retire le trait sous 368.

**Coût.** Le canal des travaux ne lit qu'une liste d'au plus quatre traits contre un ensemble d'un seul degré. La recherche de cible et la pensée ne tournent que pour un pyromane (une construction de l'index des feux par décision de la crise, toutes les quelques centaines de ticks ; la pensée s'arrête dès quatre feux comptés).
