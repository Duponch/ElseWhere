# Cadences de RimWorld 1.6 : plantes, besoins, humeur

Relevé du 8 novembre 2026, pour aligner la simulation sur le jeu et éviter du travail inutile à chaque tick.

**Source principale.** La bibliothèque du jeu RimWorld **1.6.4871 rev590** (`Assembly-CSharp.dll`, empreinte SHA256 commençant par `5CF1B5BE`), décompilée localement avec ILSpyCmd 8.2 pour lecture seulement. Aucun code ni asset du jeu n’est copié dans le projet ; les formules ci-dessous sont reformulées. Données XML de Core : `ThingDefs_Plants/Plants_Bases.xml`, `NeedDefs/Needs.xml`.

**Sources secondaires.** Les pages du wiki [Plants](https://rimworldwiki.com/wiki/Plants), [Time](https://rimworldwiki.com/wiki/Time), [Mood](https://rimworldwiki.com/wiki/Mood), [Rest](https://rimworldwiki.com/wiki/Rest), [Recreation](https://rimworldwiki.com/wiki/Recreation) et [Mental break](https://rimworldwiki.com/wiki/Mental_break) concordent avec la bibliothèque. La page [Saturation](https://rimworldwiki.com/wiki/Saturation) décrit une baisse de la faim « à chaque tick » et des seuils de 25 / 12,5 % : elle est périmée pour 1.6.

Dans le projet, un tick local vaut 10 ticks Core (ticks de RimWorld).

## Plantes

- Les plantes ont le ticker `Long` : leur `TickLong` passe tous les **2 000 ticks**.
- Une plante d’identifiant N le reçoit à chaque tick T tel que `T % 2000 == N % 2000` : le compartiment vient directement de l’identifiant, sans décalage de hachage. Le calendrier est le même après rechargement.
- La cadence variable de 1.6 (`TickInterval`) ne s’applique pas aux plantes, qui n’ont pas le ticker `Normal`.
- À chaque `TickLong`, tout est **lu à cet instant** : température de la case, lumière, fertilité, heure locale (repos avant 25 % et après 80 % du jour), brume, sécheresse. La croissance avance alors de `GrowthPerTick × 2000`, sans moyenne.
- Les facteurs de température par défaut sont 0 / 6 / 42 / 58 °C ; ceux de lumière, 0,51 et 1,0.

**Dans le projet.**
- Depuis le 8 novembre, chaque plante lit son facteur de température à son `TickLong` (famille de schémas 301), au lieu de suivre immédiatement chaque variation pour toutes les plantes.
- La lumière reste une intégrale continue exacte, adaptation déjà décrite dans [la serre](greenhouse-core-v189.md).

## Besoins et humeur

- `Pawn_NeedsTracker` appelle `NeedInterval` de chaque besoin une fois tous les **150 ticks**, au tick haché du pion (`IsHashIntervalTick(150)`), avec un pas fixe de 150 ticks.
- Faim, repos, loisirs, confort, beauté et humeur avancent ainsi par pas de 150 ticks.
- L’humeur est un besoin « chercheur » : base 32 %, +12 %/h et −8 %/h vers sa cible, soit 0,0072 / 0,0048 par pas.
- Les pensées situationnelles sont recalculées dans ce même appel, puis gardées en cache.
- Les souvenirs vieillissent par pas de 150 ticks.

**Dans le projet.**
- Les taux reproduisent déjà ceux de RimWorld, ramenés au tick local.
- Le chemin des caravanes suit déjà la cadence de 150 (`group-need-meters-256.ts`).
- Sur la carte, depuis le 8 novembre, confort, expiration des souvenirs et humeur, pensées comprises, avancent une fois par 150 ticks Core, par un pas de 15 ticks locaux (famille 301).
- Faim, repos et loisirs restent mis à jour à chaque tick local. Leurs taux sont identiques ; seul l’instant de franchissement d’un seuil peut différer de moins de 150 ticks.

## Ce qui concorde déjà

- **Ruptures mentales** : tous les 150 ticks, même compteur sous le seuil, mêmes intervalles moyens.
- **Récupération d’un état mental** : tous les 30 ticks.
- **Exposition au froid et à la chaleur, saignement** : tous les 60 ticks.
- **Gravité des affections (infection, grippe) et oubli des compétences** : tous les 200 ticks.
- **Guérison naturelle** : tous les 600 ticks.

## Pousse spontanée des plantes sauvages

**Dans RimWorld 1.6.**
- `WildPlantSpawner` tourne à chaque tick et lit `ceil(surface × 0,0001)` cases par tick, dans un ordre mélangé fixe, avec un index de cycle sauvegardé.
- Sur chaque case lue :
  - la densité voulue est le minimum de 1 et du produit (fertilité, ×0,5 sous un toit naturel) × densité du biome ;
  - la chance d’apparition est (densité voulue / cases fertiles), suivie d’un tirage à intervalle moyen sur `wildPlantRegrowDays` (130 jours sous un toit naturel).
- La saturation est globale ou mesurée par régions dans un rayon de 20.
- L’espèce choisie dépend de sa fréquence, de l’ordre des plantes, des regroupements et des proportions locales.
- Une plante née ainsi démarre à 15 % de croissance.
- Il n’existe aucune reproduction des plantes dans le Core 1.6.

**Dans le projet.**
- Les sites géographiques (`site.revision === 3`) reproduisent ce fonctionnement point par point (`src/sim/wild-plant-runtime-256.ts`) : 70 cases par tick local sur une carte de 250², même cycle et même cache décalé d’un cycle. Le générateur aléatoire est celui du projet : même distribution, pas la même suite de tirages.
- Les anciens sites de biome (`revision === 2`) gardent une adaptation simple. Ils remontent vers le nombre de plantes de départ, sans densité par case, saturation, regroupement, plantes de grotte ni contrôle de température, et une plante y démarre à 0,01 %. Les aligner demanderait des données géographiques que ces sites n’ont pas ; l’adaptation est conservée.
- Coût : la capture d’occupation reconstruite à chaque tentative pourrait être gardée d’un tick à l’autre sans changer les résultats. Le gain est faible (≈ 1,5 % du Worker).

## Écarts relevés, non traités

- Les besoins « Extérieur » (`Need_Outdoors`) et « Taille de la pièce » (`Need_RoomSize`) de Core n’existent pas dans la simulation.
- Les facteurs de taux propres au lit (faim au lit), aux traits et aux statistiques `RestFallRateFactor`, `RestRateMultiplier`, `JoyFallRateFactor` ne sont pas modélisés. Il reste à vérifier quels traits ou affections de Core les modifient réellement.
- La beauté avance tous les 200 ticks, en une seule impulsion pour tous les pions, au lieu de 150 ticks étalés par pion.

## Recherche de travail

**Dans RimWorld 1.6.**
- Un pion ne cherche un travail qu’à la fin, à l’interruption ou à l’expiration de sa propre tâche, après des dégâts, ou tous les 211 ticks quand il est couché. Aucune recherche périodique de tout le monde à chaque tick.
- Un colon inactif alterne attente (125 à 200 ticks) et promenade, puis réévalue.
- La recherche parcourt les types de travail dans l’ordre des priorités et s’arrête au premier niveau qui trouve une cible. Le plus proche est cherché par régions.
- Des listes tenues à jour à chaque changement (objets à transporter, saleté dans la zone, bâtiments à réparer, désignations) évitent de reparcourir la carte.
- La faim ne fait pas abandonner une tâche en cours : le colon y pense à la fin de sa tâche.

**Dans le projet, écarts relevés (non traités).**
- `planWork` (`src/sim/work-planner.ts`) évalue à chaque appel une vingtaine de prédicats sur toute la carte (tas, structures, saleté, pions, corps à enterrer), puis toutes les catégories, sans s’arrêter au premier niveau de priorité. La sélection suit (priorité, rang propre, distance de Manhattan, identifiant) plutôt que l’ordre et la proximité de RimWorld.
- Un budget partagé de 8 recherches de chemin par tick local limite le coût ; un colon privé de budget réessaie au tick suivant.
- Chaque fin de tâche ou de transport réveille tous les colons inactifs (`wakePlanners`), ce que RimWorld ne fait pas. Sur Les Forges, retirer ce réveil des fins autonomes ne change pas le coût de la planification (essai du 8 novembre, non retenu) : le coût vient de chaque évaluation complète.
- Un colon affamé abandonne sa tâche en cours pour manger (`processNeedsDecision300`).
- Pendant une tâche, les contrôles de validité parcourent pions et tas (`storageCapacity`, `constructionSiteFree`) au lieu de consulter la case.

Le levier principal, pour la fidélité comme pour le coût, est donc un planificateur par niveaux de priorité avec arrêt au premier niveau trouvé, appuyé sur des listes tenues à jour. C’est un chantier à part entière.
