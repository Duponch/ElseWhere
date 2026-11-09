# Refonte de la planification du travail sur le modèle de RimWorld

Demande humaine du 9 novembre : refaire en profondeur la planification du travail, par niveaux de priorité comme RimWorld, puis l'accessibilité par régions, pour obtenir le même comportement que le jeu de référence (Core 1.6). Ce document rassemble ce que fait RimWorld, ce que fait notre moteur, les écarts et le plan par étapes. Les sources sont le code décompilé de RimWorld 1.6, lu localement en lecture seule (jamais copié dans le produit), et les définitions XML du jeu.

## 1. Ce que fait RimWorld

### Place du travail dans l'arbre de décision d'un colon

Arbre `Humanlike`, dans l'ordre :
1. états critiques (à terre, en feu, crise mentale), ordres de combat, devoirs de groupe ;
2. pour un colon : zone autorisée, température sûre, puis **travail d'urgence** (`JobGiver_Work` avec `emergency`), puis repas s'il est affamé ;
3. comportement principal (`MainColonistBehaviorCore`) : un `ThinkNode_PrioritySorter` entre repas, sommeil, drogues, détente, méditation, rechargement et **travail**. Chaque nœud donne une priorité ; ceux à 0 sont ignorés. Les nœuds sont d'abord mélangés au hasard (`Rand`), puis essayés par priorité décroissante.
   - Travail (`JobGiver_Work.GetPriority`) : 9 en heure « Travail », 5,5 en « Libre », 3 en « Sommeil », 2 en « Détente » et « Méditation ».
4. errance si rien d'autre.

### Ordre des donneurs de travail (`Pawn_WorkSettings.CacheWorkGiversInOrder`)

- Les types de travail actifs (priorité 1 à 4) sont triés par `priorité du colon`, puis par `naturalPriority` décroissante. Concrètement, la clé de tri est `naturalPriority + (4 − priorité) × 100000`, décroissante.
- Dans chaque type, les donneurs sont triés par `priorityInType` décroissante (`workGiversByPriority`).
- Les donneurs `emergency` dont le type a la priorité la plus haute du colon forment la liste d'urgence. Les autres vont dans la liste normale.

Les 20 types et leur priorité naturelle : Firefighter 1400, Patient 1350, Doctor 1300, PatientBedRest 1200, BasicWorker 1150, Warden 1100, Handling 1050, Cooking 1000, Hunting 950, Construction 900, Growing 700, Mining 600, PlantCutting 500, Smithing 470, Tailoring 450, Art 430, Crafting 400, Hauling 300, Cleaning 200, Research 100.

Les 105 donneurs du Core et leur `priorityInType` sont dans `Data/Core/Defs/WorkGiverDefs/WorkGivers.xml`. Exemples :
- Doctor : soin d'urgence 110, soin des humains 100, soin de soi 90, nourrir 80, opérations 70, sauvetage 60, soin des animaux 50 ;
- Construction : réparer une panne 120, désinstaller 110, toits 100, … achever les cadres 80, livrer aux cadres 70, aux plans 60 ;
- Hauling : réarmer les tourelles 150, ravitailler 140, … transport général 15.

### Choix du travail (`JobGiver_Work.TryIssueJobPackage`)

- Les donneurs sont parcourus dans l'ordre ci-dessus. Le **premier donneur qui trouve une cible donne le travail** : on ne compare jamais deux types de travail entre eux autrement que par cet ordre.
- `PawnCanUseWorkGiver` écarte un donneur selon le type désactivé, `ShouldSkip`, une capacité manquante, etc.
- `NonScanJob` : travail sans cible cherchée (par exemple se mettre au lit comme patient).
- Donneur qui cherche des choses (`scanThings`) :
  - avec une liste globale propre (`PotentialWorkThingsGlobal` : transport, coupe, minage, chasse…) : la chose la plus proche **à vol d'oiseau** (`LengthHorizontalSquared`) parmi celles atteignables et valides, sur toute la carte ;
  - avec une requête de chose (`ThingRequest` : cadres, ravitaillement, feux, factures, recherche…) : parcours des **régions** en largeur depuis le colon (`RegionwiseBFSWorker`). On prend la plus proche à vol d'oiseau parmi les choses de la **première région** où une chose valide est trouvée. Au plus 30 régions sont parcourues ; si rien n'est trouvé alors que d'autres régions restaient, on passe à la recherche globale ;
  - donneur « priorisé » (recherche, retrait de toit…) : meilleure priorité d'abord, puis la plus proche ;
  - si le colon porte déjà une chose qui convient, elle est prise.
- Donneur qui cherche des cases (`scanCells` : semer, construire un toit…) : la case la plus proche à vol d'oiseau, atteignable et valide (ou la mieux priorisée).

### Accessibilité

`Reachability.CanReach` repose sur les **régions** (au plus 12 × 12 cases, découpées par les murs, les portes en régions d'une case), leurs liens et un cache. Pas d'inondation case par case.

## 2. Ce que fait notre moteur

- **Types de travail** : 18, avec `craft` qui réunit Smithing, Tailoring et Crafting.
- **Arbre de décision** : une longue cascade de traitements spécialisés dans `stepLocalWorld` (crises, ordres, besoins, loisirs, puis `planWork` quand le colon n'a pas de tâche). Le travail d'urgence n'a pas de place à part.
- **Choix du travail** (`planWork`, `src/sim/work-planner.ts`) : on rassemble des candidats de toutes les familles (soins, gardiennage, animaux, chantiers, transport par paires source × destination, cuisine et factures, chasse, recherche, nettoyage…). On garde le meilleur selon `(priorité du colon, rang maison, distance de Manhattan, identifiant)`. Les rangs maison (−7 pour le feu, 9 pour la recherche…) imitent partiellement RimWorld.
- **Accessibilité** : une inondation par colon (`reachableCells`/`search`), sous un budget partagé.

## 3. Écarts principaux

1. L'ordre des types et des donneurs n'est pas celui de RimWorld (rangs maison).
2. Distance de Manhattan au lieu de la distance à vol d'oiseau. Pour le transport, la distance compte source + destination, alors que RimWorld choisit la chose à transporter la plus proche, puis son meilleur stockage.
3. Pas de liste d'urgence avant les besoins.
4. `craft` regroupe trois types de RimWorld.
5. Pas de régions : le premier candidat valide par région n'est pas reproduit, et l'accessibilité coûte une inondation par colon.
6. Toute la planification est recalculée pour tous les types, au lieu de s'arrêter au premier donneur qui trouve.

## 4. Plan par étapes

Chaque étape est qualifiée, commitée et publiée séparément. Les nouvelles règles valent pour la famille du schéma **301**, celle des sauvegardes actuelles (`rimWorkGiverOrder301`). Les sauvegardes et scénarios plus anciens gardent l'ancienne planification, pour ne pas fausser les témoins historiques. Aucun nouveau schéma n'est nécessaire : rien de nouveau n'est sauvegardé.

1. **Registre des donneurs** (`src/sim/work-givers-rimworld.ts`) — fait : 20 types, 105 donneurs du Core (priorité naturelle, `priorityInType`, ordre des définitions, urgence) et la façon dont chacun cherche sa cible (`RIM_WORK_GIVER_SEARCH` : recherche par régions ou globale, limite de régions, mode d'arrivée, priorisé), relevés dans les classes du jeu.
2. **`JobGiver_Work`** — fait pour l'essentiel :
   - chaque candidat appartient au donneur que RimWorld utiliserait ; on compare d'abord les donneurs (priorité du colon, priorité naturelle, `priorityInType`, ordre), puis la cible ;
   - une famille dont le meilleur donneur possible vient après celui du meilleur candidat déjà trouvé n'est pas évaluée (premier donneur qui trouve) ;
   - cible : pour les donneurs à recherche par régions, la première région (parcours en largeur depuis le colon, à travers les régions où il peut entrer, au plus 30 régions hors portes, 4 pour la saleté) qui contient une cible valide, puis la plus proche à vol d'oiseau ; au-delà, la plus proche de toute la carte. Pour les autres, la plus proche à vol d'oiseau ;
   - transport général : la chose transportable la plus proche du colon qui a une meilleure réserve, puis sa meilleure réserve (priorité la plus haute, puis la case la plus proche de la chose). La fenêtre tournante de paires source × destination n'est plus utilisée ; le budget de paires partagé borne seulement le travail d'un tick ;
   - livraisons (chantiers, cadres, carburant, tourelles, trémies, fûts) : la destination d'abord, dans l'ordre de son donneur, puis la ressource la plus proche du colon (cherchée elle aussi par régions).
   - Familles qui choisissent leur cible elles-mêmes : le nettoyage (saleté des 4 régions les plus proches d'abord, comme `WorkGiver_CleanFilth`), les postes de travail des factures (donneur de la table, puis régions, puis distance) et le gardiennage (repas puis conversations, prisonniers par régions puis distance au lieu de l'identifiant) suivent maintenant l'ordre de RimWorld. Les soins, la libération et le nourrissage des patients le suivaient déjà via le comparateur commun. Le dressage, l'apprivoisement et la chasse cherchent dans toute la carte dans RimWorld comme ici (la plus proche à vol d'oiseau). La recherche reste à aligner (donneur priorisé : la table la plus rapide d'abord).
3. **Travail d'urgence avant les besoins** — fait pour l'essentiel. Le moteur avait déjà les soins d'urgence avant les besoins. Le seuil suit maintenant exactement `CacheWorkGiversInOrder` : seuls les types de travail qui ont un donneur ordinaire le fixent, donc pas la lutte contre le feu. Un colon inactif dont la lutte contre le feu est sur la liste d'urgence combat l'incendie avant de manger (sauf famine), de dormir ou de se détendre, comme `JobGiver_Work(emergency)` dans l'arbre `Humanlike`. La reprise d'un travail en cours au profit d'une urgence garde la règle existante (interruption d'un travail de moindre priorité).
4. **Séparation de `craft`** en forge, couture et artisanat (onglet Travail, priorités par défaut comme `EnableAndInitialize`) — à faire.
5. **Régions** (`src/sim/regions.ts`) — fait : construction comme `RegionMaker` (blocs de 12 alignés, composantes 4-connexes, portes en régions d'une case, liens), reconstruite seulement quand la grille ou les portes changent. L'accessibilité (`candidateAccess`) répond par une étiquette de composante au lieu d'une inondation case par case, avec exactement le même résultat (l'état simulé reste identique bit à bit sur Les Forges). Une porte s'ouvre ou non selon le colon ; un acteur hostile posé sur une case ordinaire garde l'inondation, et le chemin lui-même reste calculé case par case.

Les donneurs sans équivalent dans notre jeu (extensions, peinture, piratage…) restent absents ; ils figurent dans le registre comme non implémentés.

## 5. Effet mesuré

Les Forges (80 colons, 241 animaux), 1 500 ticks simulés depuis la même sauvegarde :

| | ancien | nouveau |
|---|---|---|
| chantiers restants | 170 | 127 |
| tas rangés | 800 | 857 |
| tas hors réserve | 1 241 | 1 100 |
| colons inactifs (moyenne) | 1,8 | 1,2 |

Le temps de simulation par tick est inchangé, aux fluctuations de mesure près. Sur cette carte ouverte, l'accessibilité coûtait déjà peu ; les régions servent surtout à la fidélité du choix des cibles.
