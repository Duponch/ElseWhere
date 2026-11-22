# Conformité, vague 8 — V375

Lot sans mécanique nouvelle : quatre comportements déjà présents qui s'écartaient du jeu de base (liste « Conformité » de la [feuille de route du 15 novembre](../development/feuille-de-route-20261115.md), section 4) sont ramenés aux règles de RimWorld 1.6. Seul le pantalon pare-balles touche la simulation (schéma 375, migration par le seul numéro) ; les trois autres points sont de l'interface.

## Ce qui change pour le joueur

- **Pantalon pare-balles.** Après **Armure pare-balles**, l'atelier d'usinage propose « Pantalon pare-balles » juste après le gilet : 30 tissus, 60 aciers et 1 composant, Artisanat 4, travail d'Artisanat de 900 pas (9 000 dans le jeu de base). Comme pour le gilet, les matières deviennent un ouvrage réel (`unfinished-flak-pants`) qui garde son auteur et sa progression ; l'annulation rend environ 75 % de chaque matière. Le pantalon fini a 200 PV et une qualité tirée sur l'Artisanat de l'auteur ; ses protections, couches et malus de marche sont ceux de la pièce déjà portable depuis le schéma 256. La facture sait compter « Jusqu'à X » avec les filtres de réserve de vêtements. Une demande commerciale peut désormais porter sur des pantalons pare-balles quand la colonie sait en fabriquer.
- **Touches C et X.** Elles étaient déjà celles du jeu de base (C : Annuler, X : Déconstruire, dans les palettes Ordres et Zones et depuis la carte). Seul un conseil de chargement les nommait encore à l'ancienne (« C … Abattre », « X … Annuler ») ; il est corrigé. Aucune autre touche n'utilise C ou X.
- **Alerte « Réserves de nourriture faibles ».** Seuil, délai et compte suivent le jeu de base : après 2,5 jours, moins de 4 de nutrition par colon libre présent. La nutrition comptée est celle qu'un humain peut manger : le houblon (comme le foin) n'est plus compté, la bière l'est ; la nourriture d'une **trémie** de distributeur de pâte compte comme celle d'une réserve ou d'une étagère. L'explication arrondit la nutrition à l'unité.
- **Alerte « Hypothermie grave ».** Même seuil qu'avant (stade grave, sévérité 0,35) et même plage sûre (confort, vêtements portés compris, élargi de 10 °C de chaque côté). Elle lit désormais aussi les colons d'une **caravane** sur la carte du monde, avec la température de la case où elle se trouve.
- **Arbre de recherche.** Les liens et la liste « Prérequis » de chaque projet sont lus dans la table de la simulation, celle qui refuse un projet dont un prérequis manque. Ils ne peuvent plus dériver. Corrigé au passage : Batteries, Panneaux solaires, Climatisation et Usinage affichent maintenant Électricité (acquise au départ), et le Moniteur vital liste ses prérequis dans l'ordre du jeu de base (Multi-analyseur puis Lit d'hôpital).

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun texte ni code recopié).

- `ThingDefs_Misc/Apparel_Various.xml`, `Apparel_FlakPants` (parent `ArmorMachineableBase`) : `recipeUsers` TableMachining, `researchPrerequisite` FlakArmor, `workSkill` Crafting et `skillRequirements` Crafting 4, `WorkToMake` 9 000, `costList` Cloth 30, Steel 60, ComponentIndustrial 1, `unfinishedThingDef` UnfinishedTechArmor (partagé avec le gilet), `displayPriority` 230 (gilet 220).
- `Misc/KeyBindings/KeyBindings.xml` : `Designator_Cancel` C et `Designator_Deconstruct` X (catégorie Architect) ; `Misc/Designations/DesignationCategories.xml` : Cancel et Deconstruct dans toutes les catégories d'Architecte.
- `Alert_LowFood` : `NutritionThresholdPerColonist` 4, aucune alerte avant 150 000 ticks, carte du foyer avec un colon présent, `ResourceCounter.TotalHumanEdibleNutrition` comparé à 4 × `FreeColonistsSpawnedCount` ; explication avec la nutrition arrondie (`F0`), colons libres plus prisonniers, jours arrondis vers le bas. `ResourceCounter` : objets des groupes de stockage de la carte (`haulDestinationManager`, trémies comprises), frais (`IsNotFresh` exclu) et non cachés par le brouillard, dont la définition est comptée (`CountAsResource`) ; nutrition comptée si `IsNutritionGivingIngestible` et `ingestible.HumanEdible` (`FoodTypeFlags.OmnivoreHuman` ne contient pas `Plant` : foin et houblon, `RoughPlantBase`, sont exclus ; la bière, `DrugBase`, nutrition 0,08, `Fluid, Processed, Liquor`, est comptée).
- `Alert_Hypothermia` : colons libres vivants des cartes, caravanes et transports (`AllMapsCaravansAndTravellingTransporters_AliveSpawned_FreeColonists_NoSuspended`), hors de `SafeTemperatureRange` (plage de confort ± 10 °C, `GenTemperature`), avec `Hypothermia` au stade d'indice 3 ou plus (`Hediffs_Global_Temperature.xml` : stades 0 ; 0,04 ; 0,2 ; 0,35 ; 0,62).
- `ResearchProjectDefs/*.xml` (`prerequisites`, `hiddenPrerequisites`) et `MainTabWindow_Research` : une ligne est tracée pour chaque prérequis visible ; la fiche du projet liste les prérequis visibles puis les cachés.

## Adaptations

- **Ouvrage du pantalon.** Le jeu de base partage `UnfinishedTechArmor` entre gilet et pantalon ; Elsewhere garde un ouvrage par recette d'armure (`unfinished-flak-pants`), comme le gilet et le casque. Le pantalon fabriqué n'a pas de couleur tirée (le gilet non plus) ; inflammabilité de l'ouvrage reprise du gilet.
- **Touches globales.** Le jeu de base ne lit C et X que lorsqu'une catégorie d'Architecte est ouverte ; Elsewhere les garde valables partout, comme ses autres lettres (décrit dans les [alertes C](alerts-core-c.md)).
- **Hypothermie.** Les colons des autres cartes ne sont pas lus (une seule carte est chargée dans l'interface) ; les transports en vol n'existent pas.
- **Liens cachés tracés.** Le jeu de base ne trace pas de ligne pour un prérequis caché ; Elsewhere en trace une pour chaque prérequis qu'il impose (par exemple Armure de plaques → Armure pare-balles), la fiche les listant après les visibles comme dans le jeu de base. Électricité, acquise au départ, est listée sans lien.
- **Prérequis non imposés, conservés des lots précédents :** Repas de survie sans Pâte nutritive, Lit d'hôpital sans Matériaux stériles, Tourelles automatiques après Armurerie avant le schéma 340. La table les déclare et le test les vérifie.

## Contrôles

- `tests/conformity-w8.test.ts`, 13 cas : faits de la recette ; verrou du schéma 375 et de la recherche ; fabrication réelle à l'atelier alimenté (ouvrage physique, coût exact, rechargement identique en plein travail, pantalon de 200 PV avec une qualité) ; migration par le seul numéro et refus d'une ancienne sauvegarde qui porterait la facture ; demandes commerciales ; touches C et X dans chaque palette, l'aide et les conseils ; alerte de nourriture (houblon, bière, trémie, texte) ; hypothermie d'un colon en caravane selon la température de sa case ; liens tracés ⇔ prérequis de la simulation, listes dans l'ordre du jeu de base, refus de la simulation par le premier prérequis manquant, comparaison avec les `ResearchProjectDefs`.
- Équivalence du refus de recherche vérifiée avant et après sur 12 000 états tirés (huit schémas de 297 à 375) : seul change l'ordre du Moniteur vital quand ses deux prérequis manquent.

## Ce qui reste

- La couleur tirée d'un vêtement fabriqué (`colorGenerator`) n'est pas reprise, pour le pantalon comme pour le gilet.
- Repas de survie (Pâte nutritive) et Lit d'hôpital (Matériaux stériles) gardent leurs adaptations : les aligner changerait des règles de recherche.
- Les sauvegardes encore liées à d'anciens prérequis (règles d'ordre de fin des recherches, `GUNS_RESEARCH_PARENTS_342` et semblables) gardent leurs propres tables.
