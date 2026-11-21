# Grande table, couchages doubles et applique murale — V363

Le lot ajoute quatre meubles courants de RimWorld 1.6 qui manquaient à Elsewhere : la **table 3 × 3**, le **couchage au sol double**, le **sac de couchage double** et l'**applique murale**. Ils n'existent qu'à partir du schéma 363 ; une sauvegarde 362 passe au schéma 363 par son seul numéro, sans rien recevoir.

## Ce que fait le jeu

- **Table 3 × 3** (Architecte → Meubles) : neuf cases, centrée sur la case visée, ne se tourne pas. 100 bois, métal ou pierre, travail 3 300 (bois ×0,7), sans recherche ni niveau de Construction, qualité tirée à la fin du chantier, 175 PV, beauté 2 (selon la matière et la qualité). C'est une surface de repas comme les autres tables : un colon assis sur un tabouret, une chaise ou un fauteuil posé contre un de ses bords mange à table et n'a pas la pensée « mangé sans table ». Elle est point de rencontre (case à décocher dans son inspection), compte 12 pour une salle à manger, se désinstalle et se transporte emballée.
- **Couchage au sol double** : 2 × 2, gratuit et posé à l'instant comme le couchage au sol simple, orientable (Q / E). Deux places civiles indépendantes, comme le lit double : chaque place a son propriétaire et sa tête de couchage réelle. Confort 0,4, repos comme au sol (efficacité 0,8), pensée « dormi par terre ». Pas de matière, de qualité, de points de vie, d'usage médical ni de prison ; le retirer libère ses dormeurs à l'instant.
- **Sac de couchage double** : 2 × 2, orientable, 85 tissu ou cuir, travail 1 100, sans recherche. Deux places civiles comme le lit double ; confort 0,68, efficacité de repos 0,95, immunité ×1,05, soins 4 par jour comme le sac simple ; 100 PV, qualité. Il se désinstalle et se transporte emballé.
- **Applique murale** (Architecte → Meubles) : 15 acier, travail 330, 35 PV, 30 W, rayon de lumière 11 (lumière chaude comme la lampe sur pied), interrupteur. Elle occupe une case praticable et se tourne (Q / E) vers le mur qui la porte : la case devant elle doit être un mur (son plan suffit pour la poser, mais le chantier ne se termine qu'une fois le mur construit) ou une paroi rocheuse naturelle. Elle se raccorde au réseau comme la lampe sur pied et n'éclaire que si elle est alimentée.

Chaque meuble a son pictogramme et sa forme dans les lots de meubles existants : plateau carré à cinq pieds, contour à la craie et deux repères de tête, deux largeurs de literie et deux oreillers, platine, bras et abat-jour fixés contre le mur.

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun code copié).

- `ThingDefs_Buildings/Buildings_Furniture.xml` :
  - `Table3x3c` (`TableGatherSpotBase`) : taille 3×3, `rotatable` false, `costStuffCount` 100 Metallic/Woody/Stony, `WorkToBuild` 3 300, PV 175, beauté 2, masse 22, inflammabilité 1, `CompQuality`, `CompGatherSpot`, `surfaceType` Eat, `PassThroughOnly`.
  - `DoubleSleepingSpot` (`SleepingSpotBase`) : taille 2×2, `WorkToBuild` 0, aucun coût, pas de points de vie, confort 0,4, `SurgerySuccessChanceFactor` 0,7, `Standable`. `BedRestEffectiveness` absent : `valueIfMissing` 0,8 (`Stats_Building_Special.xml`).
  - `BedrollDouble` (`BedWithQualityBase`) : taille 2×2, `costStuffCount` 85 Fabric/Leathery, `WorkToBuild` 1 100, confort 0,68, `BedRestEffectiveness` 0,95, `ImmunityGainSpeedFactor` 1,05, `bed_healPerDay` 4, masse 4,5, `Standable`, `pathCost` 14, PV absents (défaut de `MaxHitPoints` : 100, `Stats_Basics_General.xml`).
  - `WallLamp` (`LampBase`) : `rotatable` true, `costList` Steel 15, `WorkToBuild` 330, PV 35, masse 2, `Standable`, `pathCost` 0, `isEdifice` false, `isAttachment` true, `Placeworker_AttachedToWall`, `CompPowerTrader` 30 W, `CompGlower` rayon 11 couleur (214, 148, 94), `CompFlickable`.
- `Placeworker_AttachedToWall` et `GenConstruct.GetWallAttachedTo` : le support est la case devant la rotation (`GenAdj.CardinalDirections`) ; il doit porter un bâtiment `supportsWallAttachments` (mur `Wall`, roche naturelle) ; un plan ou un chantier de mur compte à la pose. `GenConstruct.CanConstruct` refuse de terminer un attachement dont le mur n'est encore qu'un plan.
- `Designator_Build` : un bâtiment au travail de construction nul se pose immédiatement (couchages au sol).

## Adaptations

- L'applique occupe sa case seule : dans le jeu de base, un attachement qui n'est pas un édifice peut partager sa case avec un meuble ; Elsewhere garde un bâtiment par case (hors câbles).
- Quand le mur qui la porte disparaît, le jeu de base emballe l'applique au sol ; Elsewhere la laisse en place, et elle continue d'éclairer.
- Comme la lampe sur pied d'Elsewhere, l'applique ne demande pas la recherche Électricité (Elsewhere n'a pas ce projet ; l'électricité est disponible dès le départ).
- Les deux couchages doubles reprennent la règle du lit double d'Elsewhere : deux places civiles, ni usage médical ni prison, partage automatique réservé au partenaire. Comme leurs versions simples, ils ne comptent pas pour le rôle de chambre ou de dortoir de la pièce.
- Le sac de couchage double n'est pas encore utilisé par les caravanes (le jeu de base l'autorise). Emballé, il garde le paquet générique des meubles (aucun nouveau modèle de cargaison) ; seul le sac simple a son rouleau dessiné.
- Un plan de table 3 × 3 se dessine avec la boîte générique des plans de meubles, comme les autres tables.

## Ce qui reste

- **Natte de paille** (`StrawMatting`, 2 foin, travail 120, beauté −1, propreté −0,1, inflammabilité 1,5, `FilthMultiplier` 0,05, sol brûlé propre) : non faite. Elle demande le foin comme matériau livré au chantier, un multiplicateur de saleté par sol et un sol brûlé de plus.
- **Canapé** (`Couch`) : non fait.
- Les autres meubles absents (bibliothèques, lit royal, lits d'animaux, applique à torche, projecteur) restent à faire.

## Contrôles

`tests/furniture-c-363.test.ts` : chiffres des définitions, construction par de vrais ticks (table en bois, sac double en tissu, applique en acier), repas assis à la table, salle à manger, deux colons endormis côte à côte sur le couchage double et sur le sac double, applique alimentée par une batterie qui éclaire sa case la nuit, sauvegarde et rechargement identiques, refus de chaque meuble en dessous de 363 et migration d'une sauvegarde 362 par son seul numéro.
