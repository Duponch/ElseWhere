# Promenade des animaux comme dans RimWorld 1.6 (schéma 304)

Demande de l'utilisateur (11 novembre au soir) : vérifier d'abord le fonctionnement du vrai RimWorld pour la cadence des décisions des animaux, puis l'adapter si le jeu ne fait pas déjà la même chose ; choix retenu : « les deux, comme RimWorld » (attente puis promenade vers une case tirée autour d'un point de départ).

## Ce qui change pour le joueur

Avant, un animal oisif sans autre besoin faisait un pas au hasard vers une case voisine toutes les 12 à 24 décisions locales : il tremblotait sur place. Désormais il alterne, comme dans RimWorld :

- **une attente** de 120 à 240 ticks, terminée au premier tick de vérification de l'animal qui tombe dans sa fenêtre (soit 120 à 480 ticks, 2 à 8 secondes de jeu à vitesse normale) ;
- **une promenade** jusqu'à une case tirée autour d'un point de départ, à l'allure de la marche (déjà en place : coût doublé, au moins 50 ticks par case).

Le point de départ et le rayon dépendent de l'animal (nœuds de `ThinkTreeDefs/Animal.xml`) :

| Animal | Nœud RimWorld | Départ | Rayon | Danger toléré |
|---|---|---|---|---|
| Sauvage vivant en troupeau | `JobGiver_WanderHerd` | un congénère proche (voir plus bas), sinon lui-même | 5 | mortel |
| Autre sauvage | `JobGiver_WanderAnywhere` | lui-même | 7 | mortel |
| Domestique vagabond (`roamMtbDays`) | 10 % `JobGiver_WanderInPen`, sinon `WanderAnywhere` | l'enclos (sa case s'il est enclos, sinon la balise d'enclos atteignable la plus proche) | 10, sinon 7 | aucun |
| Autre domestique (chien, chat…) | `JobGiver_WanderColony` | près d'un mur ou d'un lieu de détente de la zone domestique, à moins de 35 cases ; sinon un colon libre ; sinon lui-même | 7 | aucun |

La case visée suit `RCellFinder.RandomWanderDestFor` : 35 essais de 5 tirages dans les régions voisines du départ (au plus 13), pondérés par leur nombre de cases, puis les mêmes contrôles et dans le même ordre que `CanWanderToCell` (case debout, autorisée, atteignable sans traverser de région plus dangereuse que permis ; les 10 premiers essais refusent eau, marais et boue sauf pour les animaux aquatiques, un coût de passage perçu au-delà de 20 ticks et toute température dangereuse ; les 5 suivants refusent seulement le mortel ; jamais une case réservée, une porte, un feu ou un piège connu ; les canards vérifient l'eau en dernier). Si rien ne convient, les replis de RimWorld s'enchaînent (carré du rayon autour du départ, puis de 20 et de 30 cases, puis de 5 autour de l'animal, enfin sa propre case). Un chemin introuvable donne une attente de 250 ticks (`ErroredPather`). Un canard en vol ne fait pas d'attente, comme dans RimWorld.

**Troupeau** (`WanderUtility.GetHerdWanderRoot`) : le congénère le plus proche à moins de 35 cases, de même race et même statut, se trouvant dans une région atteinte depuis celle de l'animal par des régions à moins de 35 cases (comme `GenClosest.ClosestThingReachable`), qui passe un tirage à pile ou face et n'a aucun humain à moins de 15 cases.

## Animal enragé devant une porte fermée (même schéma)

Écart trouvé en vérifiant une longue campagne : quand toutes ses cibles étaient enfermées derrière une porte qu'il ne peut pas ouvrir, notre animal enragé restait immobile là où il était, parfois à des dizaines de cases. Dans RimWorld 1.6 (`JobGiver_Manhunter`), il trace le chemin vers sa cible à travers les portes (`TraverseMode.PassDoors`), prend la dernière case avant la première porte qu'il ne peut pas franchir (`TryFindLastCellBeforeBlockingDoor`), puis va vers une case tirée dans les 9 régions voisines de celle-ci (`CellFinder.RandomRegionNear`), ou attend 30 ticks si c'est sa propre case : il rôde devant la porte. C'est désormais le cas au schéma 304, avec les tirages de son propre flux aléatoire. Une porte interdite aux colons reste un obstacle pour lui (adaptation). Contrôle : `tests/manhunter-door-loiter-304.test.ts` (304 : il vient rôder ; 303 : comportement antérieur).

## Sources

Code décompilé de RimWorld 1.6 (lecture privée, rien n'est copié dans le produit) : `JobGiver_Wander.TryGiveJob`, `JobGiver_WanderHerd`, `WanderUtility.GetHerdWanderRoot` et `GetColonyWanderRoot`, `RCellFinder.RandomWanderDestFor` et `CanWanderToCell`, `Pawn_JobTracker` (expiration des tâches à `IsHashIntervalTick(expiryInterval, 15)` lors des `TickInterval` de l'animal) ; données du jeu `Core/Defs/ThinkTreeDefs/Animal.xml` (`ticksBetweenWandersRange` 120~240 sur tous les nœuds animaux) et les races (`herdAnimal`, `roamMtbDays`).

## Adaptations déclarées

- Nos décisions tombent sur notre tick local (10 ticks) : une attente se termine au premier tick local qui suit sa fin RimWorld.
- Nos régions sont des blocs de 12 × 12 cases joints par des pas cardinaux, sans région de porte : une porte se traverse en ligne droite. Elles sont gardées d'un tick à l'autre tant que la grille d'obstacles de l'animal est inchangée hors des portes ; leurs cases sont rangées par indice pour qu'une partie rechargée reproduise exactement la partie continue.
- Les candidats du troupeau sont pris par distance, pas dans l'ordre des régions de RimWorld.
- Le coût de passage perçu est lu dans nos coûts de navigation, qui incluent aussi le danger du feu.
- Les cases réservées par les colons et la température sont lues une fois par passe de la faune (les colons ne reçoivent pas de tâche pendant cette passe).
- Ne sont pas reproduits : l'expiration à 500 ticks des promenades d'enclos, `JobGiver_WanderInRoofedCellsInPen` (seul le cas des retombées toxiques, déjà en place, demande des cases couvertes), le nœud « ennemis sur une carte hostile » des animaux domestiques.
- Les tirages aléatoires n'utilisent pas les flux de RimWorld.

## Sauvegarde

Schéma 304, migration depuis 303 par le seul numéro, après validation stricte du schéma 303 : la tâche en cours d'un animal est gardée, la nouvelle règle s'applique à sa décision suivante. Une attente enregistrée peut durer jusqu'à 500 ticks (200 au schéma 303, toujours refusé au-delà dans une sauvegarde 303).

## Contrôles

`tests/animal-idle-wander-304.test.ts` : fin d'attente dans la fenêtre de hachage (1 500 cas), alternance attente/promenade sur Les Éclaircies (400 ticks), partie rechargée identique au bit près à la partie continue, bornes de validation 303/304, migration par le numéro seul et refus d'une attente trop longue au schéma 303.

## Coût

Voir le bilan de la nuit du 12 novembre (`docs/development/bilan-nuit-20261112.md`).
