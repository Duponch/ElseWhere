# Fenêtres comme RimWorld, troisième lot : le panneau d’inspection et les onglets de tout ce qui n’est pas un colon

Vague 4, lot 3 du [chantier des retours du 22 novembre](chantier-retours-20261122.md) (points 17 et 32), après le [premier lot](fenetres-rimworld-fiche-bio.md) (échelle de texte, fiche Bio, panneau d’inspection du colon) et le [deuxième](fenetres-rimworld-onglets.md) (onglets du colon). Lot d’interface seulement : aucun changement de règle ni de schéma. Les chiffres viennent des classes de Ludeon relues pour ce lot (`InspectPaneFiller`, `InspectPaneUtility`, `MainTabWindow_Inspect`, `ITab_Bills`, `ITab_Storage`, `ITab_Art`, `ITab_Pawn_Training`, `TrainingCardUtility`, `Races_Animal_Base`, `Plant`, `Frame`, `Blueprint`, `Building_TurretGun`, `CompPowerTrader`, `CompPowerBattery`, `CompRefuelable`, `CompTempControl`, `CompQuality`, `Pawn.GetInspectString`), décompilées à part et réécrites : aucun texte ni image du jeu n’est copié.

## Ce qui change pour le joueur

Animaux, mécanoïdes, bâtiments, plantes, objets au sol, zones, plans, chantiers et cases n’ouvrent plus le grand dossier à deux colonnes : ils reçoivent le **même panneau d’inspection que le colon** (432 × 165 en bas à gauche), ses onglets de 72 × 30, ses vignettes de commande de 75 × 75 à droite et le bouton (i).

- **Le panneau** (`InspectPaneFiller.DoPaneContentsFor`). Le nom en Titre, puis la jauge de points de vie de 93 × 16 (`DrawHealth` : texte « actuel / maximum », blanc entier, jaune au-dessus de la moitié, rouge au-dessus de zéro, gris à zéro), puis les lignes de la chaîne d’inspection. Une zone n’est pas une chose du jeu : pas de jauge. Un animal reçoit sa jauge de santé (« En bonne santé », « Blessé », « À terre »…) et, s’il est domestique et d’une espèce qui admet les zones, la jauge de zone autorisée sur laquelle on clique pour la changer (`DrawAreaAllowed`). Les lignes viennent des mêmes sources que l’ancien dossier : « Qualité », besoin et réserve d’énergie, combustible, température de consigne, panne, canon et munitions d’une tourelle, croissance et récolte d’une plante (`Plant.GetInspectString` : « Croissance n % », repos, lumière, température, fléau), « Fraîche » d’une dépouille, travail restant et matériaux d’un chantier ou d’un plan, « Femelle, adulte, n jours » puis l’activité et le maître d’un animal (`Pawn.MainDesc`, `GetJobReport`). Le libellé de groupe d’une sélection multiple (« Bois ×75 ») est conservé.
- **Les onglets** (`ITab`, à leur taille). Poste de travail : **Factures** (420 × 480, marge de 10, `ITab_Bills`) avec, comme le jeu, un seul bouton « Ajouter une facture » qui ouvre la liste des recettes. Meuble de stockage et zone de stockage : **Stockage** (300 × 480, `ITab_Storage`). Animal de la colonie : Journal, Social, Dressage, Besoins, Santé dans l’ordre de `Races_Animal_Base` (de droite à gauche : Santé, Besoins, Dressage, Social, Journal). Un animal sauvage n’a ni Besoins ni Dressage (`ITab_Pawn_Needs.IsVisible`, `ITab_Pawn_Training.IsVisible`). Un mécanoïde n’est pas de chair : Santé et Journal seulement (`ITab_Pawn_Social.IsVisible` demande `IsFlesh`). L’onglet ouvert reste ouvert d’une sélection à l’autre quand la nouvelle chose le possède (`MainTabWindow_Inspect.OpenTabType`), comme pour le colon.
  - **Dressage** (nouvelle carte, `TrainingCardUtility`) : 300 de large, carte contractée de 17 plus 10 sous le bord, lignes de 22 à 2 d’écart (familiarité, maître), un écart de 12, puis une ligne de 28 par apprentissage avec sa case (cochée si demandé ou acquis) et « étapes / total » dans la colonne de droite (vert une fois acquis), infobulle avec la raison d’un refus.
  - **Besoins, Santé, Social, Journal** d’un animal reprennent les cartes du colon (`NeedsCardUtility` sans humeur donc 225 de large, `HealthCardUtility` avec ses capacités et une entrée par partie blessée, `SocialCardUtility` pour la mère, le père et le maître, `ITab_Pawn_Log` vide : un animal n’a pas de journal personnel).
- **Les vignettes de commande** (`GizmoGridDrawer`, 75 × 75, 5 d’écart, à droite du panneau + 14). Toute ligne du dossier qui ne portait que des commandes devient une vignette : un interrupteur, « Maintenir ouverte », « Interdire le passage », « Point de rencontre », « Cesser le feu », « Rechargement automatique », « Couper les arbres dans le couloir éolien », les réglages de la température de consigne, « Secourir cet animal » (une liste de colons), les commandes de la case (« Inspecter » un objet de la case), la couleur d’un plan, la zone… Le nom de la ligne est le nom de la vignette, son état (« Oui » / « Non ») est écrit dans le coin, les anciennes commandes d’objet (abattre, couper, récolter, désinstaller, copier…) gardent le pictogramme de leur désignation.
- **Le bouton (i)** (`MainTabWindow_Inspect.DoInspectPaneButtons`, `Widgets.InfoCardButton`) : à gauche du bouton de fermeture, il ouvre la **fiche d’informations** (`Dialog_InfoCard`), une page qui liste toutes les caractéristiques de la chose (identité, points de vie, encombrement, passage, matériau, qualité, détails d’énergie, de brassage…) et se ferme par « Retour ».

## Où est passée chaque ligne de l’ancien dossier

| Ancienne ligne | Nouvelle place |
| --- | --- |
| Points de vie (bâtiment, objet, plante, roche, meuble emballé) | Jauge du panneau ; la ligne reste à la fiche d’informations |
| Qualité, énergie, combustible, température de consigne, panne, canon, croissance, état d’une dépouille, travail d’un chantier… | Lignes du panneau (copiées) et fiche d’informations (complètes) |
| Identité, orientation, matériau, encombrement, passage, taille de zone, détails énergétiques | Fiche d’informations |
| Interrupteurs, portes, réglages d’alimentation, tourelles, points de rencontre, enclos, pièges, brassage, désignations | Vignettes de commande |
| Factures (ajout, copie, collage, réglages d’une facture, exécutant, pause de réserve) | Onglet Factures ; « Ajouter » est une liste de recettes |
| Réglages de stockage d’un meuble ou d’une zone | Onglet Stockage (filtres, priorité, qualité, points de vie, copier/coller) |
| Animal : identité, âge, activité, maître, lait ou laine | Lignes du panneau |
| Animal : zone autorisée | Jauge du panneau (liste) |
| Animal : capacités, lésions, douleur, soins vétérinaires, gestation | Onglet Santé (« Médicaments » est la politique de soins) |
| Animal : apprentissages, familiarité | Onglet Dressage |
| Animal : repos, nourriture | Onglet Besoins |
| Animal : parents | Onglet Social |
| Animal : secours, abattage, relâcher, chasse, apprivoisement | Vignettes de commande |
| Mécanoïde : capacités, parties, armure, canon, EMP, masse | Santé (capacités, parties), lignes du panneau (activité, cible, canon, EMP), fiche d’informations (le reste) |

## Faits du jeu utilisés (classe, nombre)

- `InspectPaneFiller.DoPaneContentsFor` : le bloc de barres commence 3 sous le titre ; barre de 93 × 16, écart de 6 ; pas de barres pour une chose qui n’utilise pas de points de vie (`useHitPoints`) ni pour une zone ; la chaîne d’inspection commence 18 plus bas. `DrawHealth` : jaune quand `HitPoints > MaxHitPoints × 0,5`, rouge au-dessus de zéro, gris à zéro. `DrawAreaAllowed` : barre pleine, liste au clic, seulement pour les créatures de la colonie.
- `MainTabWindow_Inspect.DoInspectPaneButtons` : le bouton d’informations est à `largeur − 48` de la zone, 24 de large (ici à gauche de la croix de 18).
- `ITab_Bills` : `WinSize` 420 × 480 ; `ITab_Storage` : `WinSize` 300 × 480, contenu contracté de 10 ; `ITab_Art` : 400 × 300 (aucun objet d’art n’a de description dans Elsewhere : l’onglet n’existe pas) ; `ITab_Pawn_Training` : largeur 300, hauteur `TrainingCardUtility.TotalHeightForPawn` (112 + 28 par apprentissage), carte contractée de 17 avec `yMin += 10`.
- `TrainingCardUtility.DrawTrainingCard` : lignes de 22 (`Listing_Standard`, 2 d’écart), ligne du maître de 25, `Gap` de 12, `TryDrawTrainableRow` : ligne de 28, case et libellé sur la largeur moins 50, « étapes / total » dans la colonne de droite, vert quand acquis, infobulle `description` + prérequis ou raison du refus.
- `Races_Animal_Base` `inspectorTabs` : Santé, Besoins, Personnage, Dressage, Social, Invité, Prisonnier, Esclave, Allaitement, Convoi, Équipement, Journal. Visibilité : `ITab_Pawn_Needs` (animal sans faction : caché), `ITab_Pawn_Training` (animal de la colonie), `ITab_Pawn_Social` (`IsFlesh`), `ITab_Pawn_Gear` (seulement s’il porte quelque chose), `ITab_Pawn_Log` (toujours).
- Chaînes d’inspection : `Plant.GetInspectString` (croissance, taux, repos, lumière, température, sécheresse, fléau, « Prêt à récolter »), `Frame` (« Ressources contenues », « Travail restant »), `Blueprint` (« Travail restant »), `CompPowerTrader` (énergie demandée ou produite), `CompPowerBattery` (stockée / maximum, rendement), `CompRefuelable` (carburant n / maximum), `CompTempControl` (température cible, mode de consommation), `Building_TurretGun` (portée minimale, tir possible dans, obus), `CompQuality` (« Qualité : … »), `CompMilkable` et `CompShearable` (« Maturité du lait » / « Laine »), `Pawn.MainDesc` (sexe, race, âge) puis `GetJobReport`.

## Adaptations déclarées

- **Textes de la chaîne d’inspection** : ce sont ceux d’Elsewhere (« Demande 350 W », « Allumée »), pas les traductions du jeu ; seuls le contenu et l’ordre suivent la chaîne de Core. Les lignes sont copiées de lignes du dossier (jamais recalculées) : un état qu’Elsewhere ne tient pas n’apparaît pas.
- **Vignettes sans pictogramme propre** : une commande qui n’a pas de dessin dans le catalogue des icônes garde la pastille d’information (comme avant dans le dossier, comme `Command_Action` sans icône).
- **Zones et cases** : le jeu n’a pas de panneau pour une case nue ; Elsewhere en garde un (terrain, température, lumière, objets de la case), avec ses lignes de fait en tête (4 au plus) et la liste complète à la fiche d’informations.
- **Animal** : Elsewhere n’a ni nom donné à renommer, ni confiance de dressage en pourcentage, ni jauge de sauvagerie : la ligne « Familiarité n / 5 » prend leur place dans Dressage. Le nom « Dressage » se coupe dans une tabulation de 72 (comme les noms longs du jeu).
- **Invités** (`ITab_Pawn_Visitor`), **objets d’art** (`ITab_Art`) et **contenu d’un caisson** (`ITab_ContentsCasket`) : pas de nouvel onglet. Les lignes qu’Elsewhere avait pour eux restent dans les vignettes ou la fiche d’informations ; la fiche des invités reste celle du lot 2 (colon et prisonnier).
- **Fiche d’informations** : la liste des caractéristiques est celle du dossier (pas la liste de `StatsReportUtility`, que la simulation d’Elsewhere ne calcule pas stat par stat).

## Performance

Chaque panneau se compose une fois par changement de la page (sélection, commande, bascule d’onglet) ; les lignes n’ont que des plans d’infobulle sans texture, les onglets utilisent le moteur de cartes du lot 2 (une carte peinte une fois, défilement par cran de molette) et les lignes de l’onglet Factures ou Stockage ne sont construites que quand l’onglet est ouvert. Aucune recherche ni allocation par image.

Mesure dans le vrai client, voir plus bas.

## Tests

- `tests/native-thing-panes.test.ts` (nouveau, 16 cas) : carte de dressage (rectangles, hauteur) ; tri d’un dossier (jauge de points de vie et ses couleurs, une ligne d’interrupteur devient une vignette, lignes et fiche d’informations) ; bâtiment (barre, onglet Factures à 420 × 480, vignettes de 75 × 75 à droite des 432, fiche d’informations complète et « Retour », « Ajouter une facture » en liste, commandes de l’ancien dossier encore atteignables) ; meuble et zone de stockage (300 × 480, pas de barre pour une zone) ; plante (« actuel / maximum », ligne de croissance) ; animal (onglets dans l’ordre du jeu, tailles de chaque onglet, jauge de zone, rien de perdu) ; libellé de groupe.
- Tests adaptés sans affaiblir le comportement (seul l’endroit change, détail dans le journal du commit) : `bill-clipboard`, `native-inspector-actions-v476` (secours d’un animal : une liste de colons ; œuf et lieu de rencontre), `native-inspector-storage-v476`, `native-storage-tree-ergonomics`, `native-remaining-zones-ergonomics`, `plans-369`, `door-over-wall-presentation-v483`, `interactions-rimworld-20261122` (la jauge de la roche). Les tutoriels et le guide d’apprentissage reconnaissent les nouveaux onglets (`pane-tab-bills`, `pane-tab-storage`).
- Échecs déjà connus (liste `known-failures.json`) inchangés : `native-layout-density` (3), `native-inspector-close-material-group325` (2), `animal-inspector-v99` (1).
