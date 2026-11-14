# Caravanes commerciales — V332

Schéma 332. Dans le jeu de base, Cassandra envoie régulièrement des caravanes commerciales à la colonie. Elsewhere n'en envoyait aucune : seulement des passants, des groupes de visiteurs (parfois avec un marchand) et un « négociant exotique » propre au projet. Les caravanes du jeu de base arrivent désormais, à partir du schéma 332.

## Ce qui change pour le joueur

- Environ cinq fois par an, une caravane d'une faction non hostile arrive par un bord de la carte, marche jusqu'à un point près de la colonie et y fait halte. Le journal l'annonce : « Caravane commerciale : marchand en gros (nom de la faction) approche avec 14 personne(s)… ».
- Son marchand commerce comme un marchand visiteur : un colon le rejoint (Commerce, « Rejoindre le marchand »), puis le panier se règle en argent, aux mêmes prix et avec les mêmes règles. La liste des marchands affiche la caravane : « Marchand en gros 7.1 · caravane, marchand en gros (Union X) ».
- La caravane vend ses marchandises et rachète les objets de sa spécialité (une caravane de marchandises en gros achète de l'acier, une caravane exotique de l'or ou du plastacier), en plus de ce qu'achète tout visiteur.
- Après une halte de 27 000 à 45 000 ticks du jeu de base (environ un demi-jour à trois quarts de jour), elle repart par le bord le plus proche avec ce qu'il lui reste. Le journal l'annonce.
- Le négociant exotique propre au projet ne vient plus : le marchand d'objets exotiques du jeu de base le remplace. Celui-ci ne vend ni neutroamine ni uranium : la neutroamine vient désormais des caravanes en gros des étrangers et des marchands chamanes ; l'uranium n'est plus proposé par les visiteurs.

## Faits du jeu de base

Lus dans les définitions du jeu de base 1.6 (`Storytellers.xml`, `Factions_Misc.xml`, `TraderKinds_Caravan_Outlander.xml`, `TraderKinds_Caravan_Neolithic.xml`, `PawnKinds_Outlander.xml`, `PawnKinds_Tribal.xml`, `PawnKinds_Mercenary.xml`) et dans le code décompilé (`IncidentWorker_TraderCaravanArrival`, `IncidentWorker_NeutralGroup`, `PawnGroupKindWorker_Trader`, `TraderCaravanUtility`, `LordJob_TradeWithColony`, `StorytellerUtility.AllyIncidentFraction`). Aucun code ni texte n'est copié.

### Calendrier

Cassandra (`StorytellerCompProperties_FactionInteraction`, incident `TraderCaravanArrival`, carte du joueur seulement) : 5 occasions par an de 60 jours, à partir du jour 5, espacées d'au moins 6 jours. Elsewhere réutilise le calendrier des visiteurs : mêmes tranches de 1 000 ticks du jeu de base, même espacement vers l'avant, tirage propre au projet.

Le jeu de base garde une part des occasions selon la proportion de factions non hostiles (`AllyIncidentFraction` : part des factions visibles non hostiles parmi celles qui peuvent l'être, de 0,6 pour un quart ou moins à 1 pour toutes ; aucune caravane s'il n'y en a aucune). Elsewhere accepte chaque occasion avec cette probabilité. Dans un monde par défaut (deux factions civiles amies sur quatre factions possibles), elle vaut 0,73.

### Faction et type de marchand

- Faction : tirée uniformément parmi les factions visibles, ni vaincues ni temporaires, non hostiles au joueur, qui ont des types de marchands de caravane : étrangers (civils ou rudes) et tribus (civiles ou farouches ; la tribu sauvage est toujours hostile). Les pirates n'en ont pas.
- Type : tiré selon sa fréquence, 1 pour chacun, sauf le marchand d'esclaves dont la fréquence suit l'intention de population de Cassandra (0 à 0,2, 1 à 1, 3 à 2).

| Famille | Types du jeu de base |
|---|---|
| Étrangers | marchand en gros (`BulkGoods`), fournisseur militaire (`CombatSupplier`), marchand d'objets exotiques (`Exotic`), marchand d'esclaves (`PirateMerchant`) |
| Tribus | marchand en gros, marchand de guerre (`WarMerchant`), marchand d'esclaves (`Slaver`), marchand chamane (`ShamanMerchant`) |

### Membres

- Le marchand : `Town_Trader` (45 points, revolver) ou `Tribal_Trader` (60 points, arc recourbé).
- Les gardes : 550 à 1 000 points (`GenerateGuardPoints`), moins la puissance du marchand, dépensés comme un groupe de combat (`ChoosePawnGenOptionsByPoints`) sous le coût maximal par combattant de la faction.

| Étrangers | Poids | Coût | Arme | Tribus | Poids | Coût | Arme |
|---|---|---|---|---|---|---|---|
| Villageois | 3 | 45 | revolver | Guerrier | 7 | 50 | masse en acier |
| Garde | 10 | 60 | fusil à verrou | Archer | 10 | 45 | arc court |
| Mercenaire tireur | 10 | 85 | fusil à pompe | Chasseur | 10 | 60 | arc recourbé |
| | | | | Archer lourd | 10 | 75 | grand arc |
| | | | | Berserker | 7 | 65 | lance en acier |

Une caravane compte ainsi de 7 à 22 personnes environ (au moins 9 chez les étrangers). Les tribaux portent une tenue tribale en tissu, les étrangers une chemise en tissu.

### Marchandises

Chaque générateur de stock du type est exécuté dans son ordre, avec les quantités du jeu de base, puis découpé en vraies piles. Seuls les objets qu'Elsewhere représente sont produits ; les autres gardent leur poids dans les tirages et ne donnent rien (même règle que le stock des visiteurs).

| Type | Marchandises représentées |
|---|---|
| Étrangers, en gros | argent 750–1 200, composants 30–40, composants avancés −10–2, acier 250–400, tissu 250–400, neutroamine 70–160, bière (prix total −100–100), 7 vêtements de base et 3 vêtements |
| Étrangers, militaire | argent, médicaments 10–20, 5 armes à distance |
| Étrangers, exotique | argent, composants 6–20, composants avancés 1–4, plastacier 50–150, or 40–80, médicaments de glitterworld 2–8 |
| Étrangers, esclaves | argent, médicaments 2–5 |
| Tribus, en gros | argent, bois 100–350, tissu 100–350, pemmican 250–300, plantes médicinales 0–10, vêtements néolithiques (7 de base, 3) |
| Tribus, guerre | argent, pemmican 150–300, plantes médicinales 15–30, 4 armes à distance néolithiques, vêtements néolithiques |
| Tribus, esclaves | argent, pemmican 150–300, plantes médicinales 10–20 |
| Tribus, chamane | argent, pemmican 150–300, plastacier 50–150, or 30–60, neutroamine 25–100, plantes médicinales 1–2 |

Les armes et vêtements reprennent les réserves pondérées des visiteurs (valeur marchande, qualité de marchand, matière selon sa fréquence) ; les vêtements néolithiques se limitent aux parkas parmi les familles représentées, les armes néolithiques aux arcs.

### Séjour

`LordJob_TradeWithColony` : la caravane rejoint un point juste hors de la colonie, s'y défend, puis repart après 27 000 à 45 000 ticks, ou plus tôt face au danger.

## Adaptations

- **Animaux de bât.** Le jeu de base ajoute un animal de bât (mufalo, dromadaire, alpaga, éléphant) par huit marchandises et les charge du stock. Les animaux d'Elsewhere n'ont ni faction ni inventaire de voyage : le marchand porte lui-même toutes les marchandises, et aucun animal n'est créé.
- **Générateurs absents.** Catégories (nourriture crue, textiles, drogues, armes de mêlée, meubles), étiquettes (implants, objets exotiques, artefacts, armures, obus), plans techniques, livres, tonneaux, esclaves et animaux ne produisent rien. Le marchand d'esclaves vient donc presque sans marchandise. Le chemfuel n'est pas un objet de commerce dans Elsewhere.
- **Gardes absents.** Comme pour les raids V331 : grenadiers, mercenaires à lame et mercenaires d'élite sortent du tirage. Les deux derniers dépassent de toute façon le coût maximal par combattant de chaque budget de gardes ; seul le grenadier (poids 1,5) manque vraiment. Le facteur de poids selon le coût vaut 1 pour tous les gardes gardés.
- **Armes.** Une arme fixe par type, en qualité normale, comme pour les raids V331.
- **Comportement.** La caravane suit les règles des groupes de visiteurs : elle se retire face au danger ou après une agression, au lieu de se défendre comme dans le jeu de base. Ses gardes portent leurs armes sans combattre.
- **Rachat.** La caravane rachète les objets que ses générateurs représentés produisent, en plus des catégories et des objets chers qu'achète tout visiteur. Les autres règles d'achat du jeu de base (objets d'art, instruments, drogues selon le type) ne sont pas reprises.
- **Température d'arrivée.** Le jeu de base trie d'abord les factions selon la température (−40 à 45 °C), puis refait le tirage sans ce filtre : toutes les factions concernées ayant la même plage, le choix final est le même. Le filtre est omis.
- **Mondes sans registre de factions.** Les anciennes cartes locales sans factions du monde reçoivent des caravanes d'étrangers sans faction, comme leurs visiteurs.
- **Taille.** Le point d'entrée et le point de halte s'élargissent pour une caravane (rayons 7 et 6 cases au lieu de 5 et 4).

## Sauvegardes

Une sauvegarde 331 passe à 332 en changeant son numéro ; chaque calendrier de visiteurs de la colonie (carte chargée, autres cartes, ancien second site) adopte l'agenda des caravanes, ajouté en dernier. Comme l'adoption du négociant exotique en V123, les occasions de l'année déjà passées sont écartées : aucune arrivée de rattrapage, aucun bien offert, aucun autre agenda ni tirage modifié.

Champs nouveaux, refusés avant 332 :
- l'agenda des caravanes du calendrier, vérifié comme les autres (5 occasions au plus par an, dans la fenêtre, espacées de 6 jours) ;
- le dossier de caravane d'un groupe de visiteurs : type de marchand connu et faction du monde de la même famille (aucune sans registre). Un groupe de caravane compte au plus 24 membres et sa halte dure de 27 000 à 45 000 ticks ; ses membres appartiennent à sa faction.

Avant 332, aucune caravane n'est tirée et le négociant exotique continue de venir.

## Vérifications

`tests/trader-caravans-332.test.ts` couvre :
- le calendrier : 5 occasions par an dès le jour 5, espacées de 6 jours, sur trois ans ;
- le choix des factions (civiles par défaut, factions devenues hostiles écartées), la proportion d'acceptation, les fréquences des types et des marchands d'esclaves, la composition des gardes ;
- le stock : seulement des objets représentés et achetables, quantités du jeu de base, vraies piles, rachat de la spécialité ;
- une arrivée, un échange (achat et vente) avec conservation de l'argent et des biens, une sauvegarde rechargée à l'identique pendant la halte, puis le départ de toute la caravane avec ce qu'il lui reste ;
- la migration 331, le refus des nouveaux champs avant 332, l'absence de caravane avant 332 et la fin du négociant exotique à 332 ;
- une caravane de faction sur Les Éclaircies, sauvegardée et rechargée à l'identique.
