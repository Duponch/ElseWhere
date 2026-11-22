# Les histoires personnelles du jeu de base V370

Jusqu'ici, Elsewhere tirait le passé de ses personnages dans quatorze histoires écrites pour la Lisière (six enfances, huit vies adultes). Le lot remplace ce tirage, pour toute personne née dans un monde du schéma 370, par **le catalogue complet des histoires mélangeables de RimWorld 1.6** et par **le tirage du jeu de base**. Chaque histoire garde son identifiant Core (son `defName`, par exemple `Policeman45`) et toutes ses règles ; son titre et son récit sont écrits en français pour Elsewhere. Une partie 369 migre par le seul numéro : personne ne reçoit de passé rétroactif, et les quatorze anciennes histoires restent valides pour les personnes qui les portent.

## Ce que fait le jeu

- **166 histoires** (48 enfances, 118 vies adultes), avec les effets du jeu de base : gains de compétence à la création, métiers interdits (onglet Travail, planification, « Incapable de » dans Bio), métiers requis, catégories d'apparition, traits imposés et traits interdits, silhouette, et objets apportés au départ.
- **Le tirage** suit `PawnBioAndNameGenerator` : un filtre de catégories tiré selon sa fréquence, une enfance compatible avec au moins une vie adulte de ce filtre, puis (dès 20 ans biologiques) la vie adulte ; vingt tirages avec remise puis un choix pondéré qui défavorise les histoires interdisant le travail manuel simple (×0,5), la violence (×0,6), le social (×0,7), l'intellectuel (×0,4) ou la lutte contre le feu (×0,8). Une vie adulte qui exige un travail que l'enfance interdit (sur un même type de travail) n'est jamais retenue.
- **Qui reçoit quoi.**
  - Candidats au départ (Atterrissage forcé) : colons de la colonie du joueur, catégorie *Offworld*. Dans le tutoriel, un candidat incapable de violence est remplacé par un autre, comme le jeu de base qui refait la personne.
  - Visiteurs et voyageurs : groupe paisible de la faction (avec la violence exigée, comme `PawnGroupKindWorker_Normal`) ; *Outlander* 95 % et *Offworld* 5 % pour une faction de l'extérieur, tirés pour chaque période.
  - Caravanes marchandes : le marchand selon son type (le commerçant tribal lit les filtres de chasseur tribal et doit pouvoir combattre), les gardes doivent pouvoir combattre.
  - Pillards : catégories de leur faction (*Pirate*, *Tribal*, *Outlander*), violence exigée ; le chasseur tribal reçoit une vie adulte de *chasseur tribal*.
  - Réfugié d'une capsule : un réfugié de l'espace dont le passé suit sa faction, ou une faction humaine au hasard s'il n'en a pas (comme `PawnGenerator`).
  - Personne demandant l'asile ou voyageur qui rejoint : sans faction, son passé suit une faction humaine non joueuse tirée au hasard (ou les Anciens, *Offworld*, s'il n'y en a pas).
  - Habitants des sarcophages anciens : le soldat ancien doit pouvoir combattre, le captif lit les catégories *Offworld*, *Outlander* et *Outsider*.
  - Un prisonnier recruté garde le passé avec lequel il est né.
- **Traits.** Les traits imposés par l'enfance puis par la vie adulte sont donnés d'abord et comptent dans le nombre total de traits (`PawnGenerator.GenerateTraits`) ; un degré interdit par une histoire est refusé après son tirage. Exemples : l'assassin est psychopathe, l'éclaireur tribal est coureur, le mannequin est magnifique, l'ermite et le prêtre ascète sont ascètes, les enfants des grottes sont souterrains.
- **Silhouette.** Une personne qui a une vie adulte prend la silhouette de celle-ci (mince, robuste, corpulente…), selon son sexe (`GetBodyTypeFor`).
- **Objets apportés.** Un colon de départ a une chance sur quatre d'apporter les objets de sa vie adulte, deux au plus (`StartingPawnUtility.GeneratePossessions`) : un chef cuisinier apporte des plats raffinés, un barman de la bière, un herboriste des plantes médicinales, un géologue du jade… Le dossier du candidat les affiche sous **Possessions**.
- **Bio** montre le titre français (au féminin quand la langue le demande) et le récit en info-bulle, avec les gains et les interdictions ; « Incapable de » liste les métiers refusés.

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun texte ni code recopié).

- `BackstoryDefs/Shuffled/*.xml` : 166 `BackstoryDef` (fichiers par ordre alphabétique, définitions dans l'ordre du fichier) ; `slot`, `spawnCategories`, `skillGains`, `workDisables`, `requiredWorkTags`, `forcedTraits`, `disallowedTraits` (degré 0 quand le XML n'en donne pas, comme `BackstoryTrait`), `bodyTypeGlobal/Male/Female`, `possessions`, `requiresSpawnCategory`. Aucune histoire du jeu de base ne porte de restriction de sexe : seuls le titre (`titleFemale`) et la silhouette en dépendent.
- `BackstoryDefs/Solid/*.xml` : les 618 histoires des personnages nommés (`PawnBio`, non mélangeables) portent les noms de vraies personnes : **elles ne sont pas reprises**.
- `PawnBioAndNameGenerator` : `GiveAppropriateBioAndNameTo` (25 % d'histoire de personnage nommé, toujours pour un chef de faction : non repris), `GiveShuffledBioTo` (âge de 20 ans pour la vie adulte), `FillBackstorySlotShuffled` (filtre tiré par fréquence, compatibilité enfance–vie adulte, `TakeRandom(20)`, `SelectionWeightFactorFromWorkTagsDisabled`, repli au hasard), `GetBackstoryCategoryFiltersFor` (filtres de remplacement du type de personne, sinon ceux du type puis de la faction, sinon « Civil »).
- `BackstoryCategoryFilter.Matches(BackstoryDef)`, `WorkTypeDefsUtility.OverlapsWithOnAnyWorkType`, `GenCollection.TryRandomElementByWeight` (choix pondéré en flux) et `RandomElementByWeight`.
- `FactionDefs` : colonie du joueur et Anciens *Offworld* ; Outlander 0,95 *Outlander* / 0,05 *Offworld* ; tribus *Tribal* ; pirates *Pirate*. `PawnKindDefs_Humanlikes` : `Slave` et `StrangerInBlack` (*Offworld*, *Outlander*, *Outsider*), `WildMan`, `Tribal_Hunter` et `Tribal_Trader` (enfance *Tribal*, vie adulte *TribalHunter*), `requiredWorkTags` Violent des types tribaux et du soldat ancien.
- `PawnGenerator` : 120 essais quand la violence ou les métiers requis du type ne sont pas tenus ; `GenerateTraits` ; `GetBodyTypeFor` ; `FactionManager.TryGetRandomNonColonyHumanlikeFaction` (poids 0,1 sous le niveau médiéval quand le médiéval est préféré) ; `DownedRefugeeQuestUtility.GetRandomFactionForRefugee` (60 %).
- `PawnGroupKindWorker_Normal` (combat et groupes paisibles : violence exigée) et `PawnGroupKindWorker_Trader` (marchand non, gardes oui) ; `QuestNode_Root_WandererJoin_WalkIn` (villageois sans faction) ; `ThingSetMaker_RefugeePod` (réfugié de l'espace).
- `WorkTypes.xml` (étiquettes de travail de chaque type), `SkillDefs` (`disablingWorkTags` Violent du tir et de la mêlée, sinon une compétence n'est perdue que si tous ses types de travail le sont).
- `StartingPawnUtility.GeneratePossessions` : deux objets au plus, 25 % pour ceux de la vie adulte, quantité bornée à la pile ; `ScenPart_PlayerPawnsArriveMethod` (Atterrissage forcé n'a pas `ScenPart_NoPossessions`).

## Adaptations

- **Textes.** Titres et récits écrits en français pour Elsewhere, sans le texte de Ludeon ; souvent plus courts. Le titre a une forme féminine chaque fois que le français l'exige ; le récit est rédigé sans sujet genré.
- **Tirages.** Ils suivent l'ordre du jeu de base sur le flux de naissance privé d'Elsewhere (graine et identité de la personne), pas sur `Verse.Rand` : ils ne sont pas identiques bit à bit à ceux du jeu de base. Quand le jeu de base refait toute la personne (violence, métiers requis), Elsewhere ne retire que les deux histoires sur le même flux.
- **Compétences.** Les gains s'ajoutent aux niveaux de naissance d'Elsewhere comme ceux des anciennes histoires (bornés à 0–20). Le calcul complet du jeu de base (`FinalLevelOfSkill` : gain × 1 à 1,4, courbes d'âge et d'ajustement final) n'est pas encore repris.
- **Objets apportés.** Seuls les objets qu'Elsewhere possède comme objets simples sont donnés (repas, médicaments, blocs de marbre, bière, jade, bois, cuir d'ours, viandes, croquettes, lait, tissu, pistolet automatique, arc court). Ils attendent près du point d'arrivée avec le bois et l'acier, au lieu de tomber dans les capsules. Les armes et vêtements à matière, livres, plans, pot de fleurs et lampe solaire ne sont pas donnés ; les objets de trait (25 %) et l'objet au hasard (6 %) non plus.
- **Absents.** Les histoires de personnages nommés et leur tirage, les histoires des extensions, les histoires d'enfants et de nouveau-nés en jeu (Elsewhere ne fait naître que des adultes de 18 ans et plus ; les histoires spéciales sont au catalogue mais jamais tirées), les chefs de faction (sans passé, comme avant), les traits imposés ou interdits qu'Elsewhere n'a pas au schéma de la naissance ne sont pas donnés (Pyromane arrive avec le lot 368 : l'histoire « pyromane » l'impose et l'assistant médical l'interdit dès que le trait existe).

## Sauvegarde

Le champ `background` garde sa forme (`childhood`, `adulthood`). Dès le schéma 370, il accepte une paire d'histoires du jeu de base : une enfance de la catégorie enfance et, à partir de 20 ans, une vie adulte ; les deux catalogues ne se mélangent pas. En dessous de 370, une histoire du jeu de base est refusée. Une partie 369 migre par le seul numéro ; tout tirage et toute personne d'un monde plus ancien restent identiques.

## Contrôles

`tests/backstories-370.test.ts` : catalogue complet (166, champs mécaniques comparés au XML installé), fréquences du tirage selon les poids, catégories des factions et des types (pillard tribal par le vrai producteur), traits imposés et interdits, métier interdit jusqu'à l'onglet Travail, la planification et Bio, candidats du tutoriel capables de combattre, objets apportés, sauvegarde et reprise, refus sous 370, migration par le seul numéro et tirages identiques sous 370.
