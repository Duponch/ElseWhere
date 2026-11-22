# Natte de paille et canapé — V365

**Schéma 365.** Les deux contenus que le lot 363 avait laissés de côté : la **natte de paille**, le sol le moins cher du jeu de base, posé avec du foin et qui retient très peu la saleté (le sol des étables), et le **canapé**, un grand siège de deux places. Ils n'existent qu'à partir du schéma 365 ; une sauvegarde 364 passe au schéma 365 par son seul numéro, sans rien recevoir.

## Ce que fait le jeu

- **Natte de paille** (Architecte → Sols) : 2 foins par case, travail 120, sans recherche ni niveau de Construction. Le foin est livré au chantier comme les autres matériaux, par un vrai transport. Beauté −1 (au lieu de −3 pour l'herbe en intérieur), propreté −0,1 par case, coût de passage 1 (comme les sols brûlés), inflammabilité 1,5. **Elle retient très peu la saleté** : une saleté nouvelle (terre, déchets, gravats, mucus) n'y a qu'une chance sur vingt de se déposer ; le sang, le vomi, les cendres, la bile et la mousse anti-incendie s'y déposent normalement, et une saleté déjà présente peut toujours s'épaissir. Un feu au sol la transforme en **natte de paille brûlée** (beauté −6, coût de passage 1, ne brûle plus) et ses deux foins sont perdus. La retirer rend un foin, l'autre est perdu.
- **Canapé** (Architecte → Meubles) : 2 × 1, orientable (Q / E), 200 tissu ou cuir, travail 20 000, Construction 5, après **Mobilier complexe**. 160 PV, beauté 8, confort 0,85, 70 kg, qualité tirée à la fin du chantier ; il se désinstalle et se transporte emballé. **Chacune de ses deux cases est une place assise** : deux colons y mangent côte à côte devant une table, y regardent la télévision, y jouent ou s'y retrouvent autour d'une table de rencontre, comme sur un fauteuil.

Chaque nouveauté a son pictogramme et sa forme : tapis tressé de quatre brins dont l'ordre clair et foncé alterne d'une case à l'autre dans le lot des sols, canapé à deux coussins, accoudoirs et dossier dans le lot des meubles.

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun code copié).

- `TerrainDefs/Terrain_Floors.xml`, `StrawMatting` (`FloorBase`) : `costList` Hay 2, `WorkToBuild` 120, `Beauty` −1, `Cleanliness` −0,1, `FilthMultiplier` 0,05, `Flammability` 1,5, `pathCost` 1, pas de recherche ni de `constructionSkillPrerequisite`, `burnedDef` `BurnedStrawMatting`. Conseil de chargement Core : la natte « ignore la saleté », pour les étables.
- `TerrainDefs/Terrain_Floors_Burned.xml`, `BurnedStrawMatting` (`BurnedFloorBase`) : `Beauty` −6, `pathCost` 1.
- `ThingDefs_Items/Items_Resource_RawPlant.xml`, `Hay` : `MarketValue` 0,6 (valeur de la natte : 2 × 0,6 + 120 × 0,0036).
- `FilthMaker.CanMakeFilth` : à la création d'une saleté (pas à son épaississement), si la définition de saleté n'a ni `ignoreFilthMultiplierStat` ni masque `Natural`, un tirage `Rand.Value` supérieur au `FilthMultiplier` du terrain la refuse, avant le contrôle d'acceptation du terrain ; un refus ne la répand pas sur les cases voisines. `ThingDefs_Misc/Filth_Various.xml` : `Filth_Dirt`, `Filth_Trash`, `Filth_RubbleRock`, `Filth_RubbleBuilding` et `Filth_Slime` respectent le multiplicateur ; `Filth_Blood`, `Filth_Vomit`, `Filth_Ash`, `Filth_CorpseBile` et `Filth_FireFoam` l'ignorent. `Pawn_FilthTracker.DropCarriedFilth` n'amincit la saleté portée aux pieds que si le dépôt a réussi.
- `GenLeaving.DoLeavingsFor(TerrainDef)` : retirer un sol rend `RoundRandom(quantité × resourcesFractionWhenDeconstructed)`, 0,5 par défaut : un foin pour la natte, sans tirage.
- `ThingDefs_Buildings/Buildings_Furniture.xml`, `Couch` (`FurnitureWithQualityBase`) : `size` (2,1), `defaultPlacingRot` South, `costStuffCount` 200 `Fabric`/`Leathery`, `WorkToBuild` 20 000, `MaxHitPoints` 160, `Mass` 70, `Flammability` 1, `Beauty` 8, `Comfort` 0,85, `pathCost` 30, `fillPercent` 0,4, `constructionSkillPrerequisite` 5, recherche `ComplexFurniture`, `isSittable` et `multiSittable`, `CompQuality`, `MinifiedThing`. Le facteur de matière du tissu (`Cloth`, inflammabilité ×1,2) s'applique comme au sac de couchage.

## Adaptations

- **Foin livré au chantier.** Le foin est rangé parmi la nourriture dans Elsewhere ; la validation des sauvegardes refusait toute nourriture livrée à un chantier. À partir de 365, la seule exception est le foin d'un plan de natte de paille, dans la limite de sa recette.
- **Tirage de la saleté.** Le tirage du multiplicateur utilise le flux aléatoire de la saleté, à l'ordre du jeu de base (avant l'acceptation du terrain). Il n'a lieu que sur une natte de paille, qui n'existe qu'à partir de 365 : une partie sans natte garde exactement les mêmes tirages. Elsewhere n'a pas de saleté animale distincte ; la terre et les déchets portés par les colons et les animaux sont ceux qui sont filtrés.
- **Perte au retrait.** Le foin perdu en retirant une natte est noté dans le registre des déconstructions (`lostHay365`), celui perdu au feu dans le registre du feu, pour que la conservation des objets reste comptée.
- **Canapé.** Comme le sac de couchage double, il accepte tous les tissus et cuirs d'Elsewhere ; ses points de vie et son inflammabilité suivent le facteur du tissu comme le sac de couchage simple. Sa seconde case est sur le côté de sa direction, comme l'armoire à outils. Comme pour le fauteuil, l'Architecte garde la rotation choisie (Q / E) au lieu d'appliquer le `defaultPlacingRot` South du jeu de base. Deux colons ne peuvent pas occuper la même case ; la réservation se fait par case, comme pour toutes les places assises d'Elsewhere.
- **Confort.** Le canapé donne son confort là où Elsewhere le donne déjà pour une chaise : repas, télévision, échecs, poker, jeu d'Ur, poste de recherche ou d'établi. Une partie de rencontre assise ne donne pas de confort, comme pour le fauteuil.

## Ce qui reste

- Pas de saleté animale distincte (`Filth_AnimalFilth`) : la natte n'a donc pas encore son usage principal du jeu de base, les étables.
- La natte n'a pas de version polluée (extension Biotech, hors périmètre).
- Les autres sols absents (béton, dalles d'or et d'argent, dalles pavées) restent à faire.
- Le canapé n'est pas pris en caravane comme meuble utilisable (seulement transporté emballé).

## Contrôles

`tests/straw-couch-365.test.ts` : chiffres des définitions ; natte posée avec du foin livré par de vrais ticks dans une pièce fermée, sauvegarde valide en cours de livraison, beauté et propreté de la pièce, coût de passage ; refus d'environ 95 % des dépôts de terre et acceptation du sang, épaississement sans tirage ; retrait qui rend un foin et note l'autre ; feu au sol qui la brûle à la frontière des 7 500 ticks Core, deux foins notés au registre du feu ; canapé en tissu construit par un vrai chantier (refusé sans Mobilier complexe ou en bois), ses deux cases dans l'index des places, deux colons qui mangent assis côte à côte sur ses deux cases devant une table 2 × 2 sans la pensée « mangé sans table », désinstallation ; sauvegarde et rechargement identiques ; refus de chaque nouveauté en dessous de 365 et migration d'une sauvegarde 364 par son seul numéro.
