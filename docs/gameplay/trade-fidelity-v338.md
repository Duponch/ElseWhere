# Commerce : bonne volonté, caravanes rencontrées, vaisseaux orbitaux, négociateur — V338

Schéma 338. Ce lot ferme quatre écarts restants de l'audit du commerce face au jeu de base 1.6 (le [lot 327](trade-fidelity-v327.md) et les [caravanes commerciales](trader-caravans-v332.md) avaient fermé les autres).

## Ce qui change pour le joueur

- **Commercer améliore les relations.** Après chaque échange avec un marchand qui appartient à une faction, cette faction gagne de la bonne volonté : 1 point par tranche entière de 600 d'argent que le marchand vous a payé pour ce que vous lui avez vendu. Les achats ne comptent pas. Le journal l'annonce : « Relations avec Union X : 12 → 14 (commerce). »
- **Les caravanes rencontrées sur la carte du monde sont de vraies caravanes marchandes.** Leur faction, leur type de marchand (en gros, militaire, exotique, esclaves ; ou leurs équivalents tribaux), leurs gardes armés et leur stock sont ceux des caravanes qui visitent la colonie. Elles rachètent les objets de leur spécialité.
- **Les vaisseaux orbitaux achètent ce qu'ils achètent dans le jeu de base.** Le marchand en gros achète désormais les vêtements ordinaires, l'uranium, le houblon, le pemmican, les croquettes et le biocarburant, et vend du biocarburant et des vêtements. Le marchand exotique achète les prothèses, la bière, les repas de survie et le cœur d'IA, et vend parfois une prothèse. Les deux achètent les objets coûteux (composants, or, romans, prothèses, cœur d'IA).
- **Un colon mobilisé peut négocier.** Il rejoint le marchand ou la console et reste mobilisé ; après l'échange, il attend sur place. Un colon muet ou sourd peut négocier avec un marchand ou une caravane (son prix est moins bon) ; seule la console de communication exige de pouvoir parler.

## Faits du jeu de base

Lus dans les définitions du jeu de base 1.6 (`TraderKinds_Orbital_Misc.xml`, catégories d'objets, étiquettes commerciales, `Stats_Pawns_Social.xml`, `PawnCapacityDefs`) et dans le code décompilé (`Faction.Notify_PlayerTraded`, `Faction.TryAffectGoodwillWith`, `Faction.CanChangeGoodwillFor`, `TradeDeal.TryExecute`, `IncidentWorker_CaravanMeeting`, `IncidentWorker_OrbitalTraderArrival`, `TradeShip`, `StockGenerator_*`, `FloatMenuOptionProvider_Trade`, `FloatMenuOptionProvider_FromThing`, `Building_CommsConsole`). Aucun code ni texte n'est copié.

### Bonne volonté

- Après un échange, `TradeDeal.TryExecute` additionne, pour chaque objet vendu par le joueur, la quantité multipliée par le prix de vente unitaire (le prix payé, pas la valeur marchande brute ; somme en flottant 32 bits).
- `Faction.Notify_PlayerTraded` demande un gain de la partie entière de cette somme divisée par 600.
- Le gain passe par `TryAffectGoodwillWith` : rien si la faction est cachée, temporaire, vaincue, ennemie permanente, ou si le joueur attaque l'un de ses établissements ; rien pour un gain nul ; bonus d'un quart vers la bonne volonté naturelle ; bornes −100 et 100 ; seuils d'alliance et d'hostilité. Elsewhere réutilise le calcul déjà livré pour les dons (schéma 274).
- Les vaisseaux orbitaux du jeu de base n'ont pas de faction (sans extension) : aucun gain.

Le gain s'applique au marchand visiteur, au marchand d'une caravane commerciale, au comptoir d'un établissement de faction visité par une caravane, et à la caravane rencontrée sur la carte du monde.

### Caravane rencontrée

`IncidentWorker_CaravanMeeting` choisit une faction non hostile, visible, humaine, non temporaire, qui a des types de marchands de caravane, puis génère le groupe `Trader` de cette faction avec `GenerateGuardPoints` (550 à 1 000 points). Le type de marchand est tiré selon sa fréquence (`CalculatedCommonality`, le marchand d'esclaves suivant l'intention de population). Elsewhere réutilise exactement la génération des caravanes commerciales du schéma 332 : type, marchand, gardes, armes, tenues et stock.

### Vaisseaux orbitaux

Ce que chaque marchand échange suit les générateurs de son stock (`WillTrade`) :

| Marchand | Échange (deux sens) | Achète seulement |
|---|---|---|
| En gros | argent, composants, composants avancés, acier, bois, plastacier, tissu, médicaments, or, neutroamine, biocarburant, bière, roman ; ressources brutes (uranium, houblon) ; textiles (cuirs, laines) ; nourriture brute ; repas ; croquettes, pemmican ; vêtements portant l'étiquette « vêtement » (tous les vêtements ordinaires, armure de plaques, casque simple) | objets coûteux |
| Exotique | argent, composants, composants avancés, or, plastacier, médicaments de glitterworld, neutroamine, bière, roman, prothèses (étiquette `TechHediff`), cœur d'IA (`ExoticMisc`) | objets coûteux |

Objets coûteux (`StockGenerator_BuyExpensiveSimple`) : objets qui ne sont ni vêtement, ni arme, ni médicament, ni drogue, valant au moins 15 d'argent par unité de volume : composants (32), composants avancés, or (10, petit volume), cœur d'IA, roman, prothèses, repas de survie (24). Aucun des deux n'achète d'armes, ni le gilet pare-balles, le casque pare-balles ou l'armure de reconnaissance (étiquette « armure » seulement). Un vêtement retiré d'un mort est refusé, comme ailleurs.

Stock ajouté :
- marchand en gros : biocarburant 200 à 600, juste après la neutroamine ; 7 à 15 vêtements de base puis 3 à 5 vêtements, après le roman (même tirage que les caravanes du schéma 332) ;
- marchand exotique : 3 à 5 pièces distinctes parmi les 24 pièces `TechHediff` du jeu de base, une de chaque ; seules la jambe et le bras prothétiques sont représentés (chacune vient environ une fois sur six).

Le biocarburant et les croquettes s'échangent désormais avec les vaisseaux, comme dans le jeu de base (ils restaient fermés au commerce).

### Négociateur

- `FloatMenuOptionProvider_Trade` (commerce avec un marchand) et `FloatMenuOptionProvider_FromThing` (console) acceptent un colon mobilisé.
- Commercer avec un marchand ou une caravane n'exige ni de parler ni d'entendre : la statistique `TradePriceImprovement` pèse seulement les deux capacités (poids 0,9). La console de communication exige `CapableOf(Talking)`, c'est-à-dire une capacité de parole au-dessus de 0.

## Adaptations

- Les caravanes rencontrées, comme celles qui visitent la colonie, n'ont pas d'animaux de bât : le marchand porte ses marchandises.
- Les tirages de la caravane rencontrée viennent du flux propre à l'incident de la carte du monde (mêmes lois, pas la même suite que le jeu de base) ; l'intention de population est celle de la colonie et de la caravane du joueur.
- Ce qu'une caravane du joueur peut porter ne change pas : les vêtements d'une caravane rencontrée restent refusés dans l'échange sur la carte du monde, comme avant.
- Les catégories de stock orbital non représentées (textiles, ressources brutes, nourriture, drogues, livres de cours, meubles, animaux, objets exotiques divers) ne produisent toujours rien ; le fournisseur militaire et le vaisseau d'esclaves orbitaux restent absents.
- L'échange individuel au comptoir civil historique garde son ancienne règle de négociateur.

## Écarts restants

- La valeur des colons et des animaux dans la richesse.
- Les animaux de bât des caravanes.

## Sauvegardes

Une sauvegarde 337 passe à 338 en changeant seulement son numéro. Aucune bonne volonté, aucun stock ni aucun échange n'est accordé rétroactivement : une rencontre ouverte garde l'ancien groupe de visiteurs, un vaisseau déjà en orbite garde son stock. Une sauvegarde 338 refuse un type de marchand inconnu ou étranger à la faction rencontrée, et une sauvegarde 337 refuse le type de marchand, les vêtements et le biocarburant d'un vaisseau.

## Vérifications

`tests/trade-fidelity-338.test.ts` couvre :
- le calcul de la bonne volonté (seuil de 600, bonus vers la bonne volonté naturelle, alliance, borne, factions vaincues ou ennemies) ;
- une vraie vente à une caravane commerciale par un colon mobilisé, qui fait gagner la bonne volonté de sa faction, et rien au schéma 337 ni avec un marchand sans faction ;
- la caravane rencontrée sur la carte du monde (type, gardes, armes, stock) et sa validation, son rachat d'acier, et l'ancien groupe au schéma 337 ;
- le négociateur muet et sourd ;
- les listes d'achat orbitales, le stock de biocarburant, de vêtements et de prothèses, une vraie vente de vêtement et d'uranium et un achat de biocarburant livré par capsule ;
- la migration.
