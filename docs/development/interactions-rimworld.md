# Interactions entre le joueur et l’interface, comme RimWorld

Points 23 à 30 et 33 de la section H du [chantier des retours du 22 novembre](chantier-retours-20261122.md). Interface et présentation seulement : aucune règle de simulation, aucun changement de schéma, aucune donnée de sauvegarde touchée. La référence est le code de Ludeon (1.6), décompilé et lu classe par classe ; chaque comportement a été réécrit dans notre code, sans texte du jeu.

## Relevé : comportement, classe qui le décide, Elsewhere avant, changement

### Sélection (`RimWorld.Selector`, `ThingSelectionUtility`, `InspectPaneUtility`)

| Comportement | Classe et méthode | Avant | Changement |
|---|---|---|---|
| Clic gauche : cycle des choses de la case, magasins d’abord | `Selector.SelectUnderMouse` | déjà conforme (lot 3 de la vague 1) | — |
| Maj + clic : ajoute ou retire | `Selector.SelectUnderMouse` (`ShiftIsHeld`) | déjà conforme | — |
| Double-clic : tout ce qui est du même genre à l’écran, personnes d’abord (même faction, même race) | `Selector.SelectAllMatchingObjectUnderMouseOnScreen` | conforme, sauf murs, clôtures, câbles, sacs de sable, trémie et roche naturelle, groupés alors que le jeu les marque `neverMultiSelect` | ces choses ne forment plus de groupe (`mapObjectGroupTarget`) ; plantes déjà exclues |
| Rectangle de sélection | `Selector.SelectInsideDragBox` : `IsColonist` (ordre de la barre), `IsHumanlike`, `IsResource`, `IsPawn`, puis toute chose sélectionnable non `neverMultiSelect` ; sinon zones, ou plans (un plan efface les zones) ; sinon sélection sous la souris | personnes et animaux seulement, mécanoïdes rangés avec les humains, rien d’autre | toute la cascade (`boxSelection`, `mapObjectsInRect`) : ressources du compteur (bois, nourriture…), bâtiments, plans et charpentes de construction, objets, cadavres, zones, plans ; mécanoïdes avec les animaux ; rien dans le cadre : clic sous la souris |
| Ce qu’un rectangle peut prendre | `ThingSelectionUtility.MultiSelectableThingsInScreenRectDistinct` (`SelectableByMapClick`, `neverMultiSelect`) | — | exclus comme dans les définitions : `Wall`, `Fence`, `PowerConduit`, `Sandbags`, `Barricade`, `Hopper`, `RockBase`, plantes (`PlantBaseNonEdible`), livres ; les désignations (miner, couper…) ne sont pas des choses |
| Titre d’une sélection multiple | `InspectPaneUtility.AdjustedLabelFor` : un seul nom de définition, sinon « Divers », puis « x » et la somme des quantités | « N objets sélectionnés » | « Bois ×75 », « Divers ×31 » |
| Touche `*` du pavé : chose suivante de la case | `KeyBindingDefOf.SelectNextInCell`, `Selector.SelectNextAt` | absent | ajouté |
| Virgule et point : colon précédent et suivant, caméra sur lui | `ThingSelectionUtility.SelectPrevious/NextColonist` | absent | ajouté (`cycledColonist`), ordre de la barre des colons |

### 23. Roche sélectionnée (`Mineable`, `InspectPaneFiller`, `ReverseDesignatorDatabase`)

Le jeu titre l’inspecteur avec le nom de la chose (`Thing.LabelCap`) : « Granite », « Acier compacté » (`MineableSteel`), « Paroi de granite lissée »… (`ThingDefs_Misc/Various_Stone.xml`, `Buildings_Natural.xml`), puis la barre de points de vie (`InspectPaneFiller.DrawHealth` : « 740 / 900 » ; granite 900, minerais 1 500 à 8 000) ; `Mineable` n’ajoute aucune ligne. Les gestes sont les désignations inverses (`ReverseDesignatorDatabase`) : Miner et, sur une paroi naturelle, Lisser.

Avant : titre « Massif rocheux » et une ligne d’identité, sans la nature de la roche ni ses points de vie. Après : titre de la roche, du minerai, de la paroi lissée ou des roches effondrées (`rockThingLabel`), barre de points de vie, gestes Miner et « Lisser le mur » (quand la case peut l’être), « Annuler l’ordre » qui annule aussi un lissage.

### 24, 25, 29. Menu des ordres (`FloatMenuMakerMap`, `FloatMenuOptionProvider*`, `FloatMenu`, `FloatMenuMap`, `WindowStack`)

| Comportement | Classe et méthode | Avant | Changement |
|---|---|---|---|
| Ouverture | `Selector.HandleMapClicks` : clic droit avec un pion sélectionné ; `FloatMenuMakerMap.GetOptions` interroge chaque fournisseur (`FloatMenuOptionProvider_*`) pour la case, chaque chose à 0,8 case de la souris et chaque pion | fenêtre modale en bas à gauche | menu flottant à la souris (+4 px, gardé dans l’écran, `FloatMenu.SetInitialSizeAndPosition`), non modal : la caméra reste libre (`preventCameraMotion = false`) |
| Aucune option | `Selector.HandleMapClicks` (`list.NullOrEmpty()`) | page « Aucun travail ni pile à transporter ici » | pas de menu |
| Plusieurs pions non mobilisés, prisonnier, étranger, crise | fournisseurs de travail `Multiselect = false` ; `FloatMenuContext` retire les pions qui ne peuvent pas recevoir d’ordre (`CanTakeOrder`) | page d’explication | pas de menu |
| Titre | `Selector.HandleMapClicks` : `context.FirstSelectedPawn.LabelCap`, aucun titre en sélection multiple | « Nom complet · case x, z » | surnom du colon (« LeSombre »), « Ordres » en sélection multiple mobilisée |
| Contenu | les options seules, désactivées avec leur raison (`FloatMenuOptionProvider_WorkGivers.GetWorkGiverOption` : « impossible de … : raison ») | les options et une ligne d’aide par contexte | les options seules (les lignes d’aide sont retirées) |
| Clic hors du menu | `WindowStack.HandleEventsHighPriority` → `CloseWindowsBecauseClicked` (`FloatMenu.closeOnClickedOutside = true`) : tout clic hors de toute fenêtre ferme le menu et l’événement est consommé | clic gauche hors de la fenêtre : fermeture **et désélection** du colon ; clic droit avalé par la fenêtre modale : il fallait désélectionner puis resélectionner | le clic ferme le menu, la sélection reste, l’événement est consommé |
| Souris qui s’éloigne | `FloatMenu.UpdateBaseColor` (`vanishIfMouseDistant`) : le menu pâlit avec la distance et se ferme au-delà de 95 px du rectangle agrandi de 5 px | — | fermeture au-delà de 95 px (`floatMenuVanishes`) ; l’ombre progressive n’est pas dessinée. Conséquence : en allant clic-droiter une autre cible, le menu est déjà fermé et le nouveau s’ouvre aussitôt, comme dans le jeu ; un clic droit à moins de 100 px du menu le ferme seulement, comme dans le jeu |
| Échap | `WindowStack.Notify_PressedCancel` (`closeOnCancel`) consomme la touche | — | ferme le menu seul, la sélection reste |
| Plus de pion sélectionné | `FloatMenuMap.DoWindowContents` | — | déjà fermé (sélection changée) |
| Option devenue invalide | `FloatMenuMap.PreOptionChosen` (revalidation) | revalidée au clic par le Worker | — |
| Clic droit sur le modèle | `FloatMenuContext` : `GenUI.ThingsUnderMouse(clickPos, 0.8)` | case du sol sous la souris | personne ou animal d’abord, puis le modèle 3D touché par le rayon (couronne d’arbre, face de mur, flanc de pile, fantôme, vague 2), puis la case du sol |

Passe générale sur les cibles (arbres, plantes, animaux, objets, bâtiments, personnes, cases) : la requête du Worker (`queryOrderOptions`) suit déjà les fournisseurs du jeu de base pour ce qu’Elsewhere sait faire (travaux désignés `FloatMenuOptionProvider_WorkGivers`, `Ingest`, `Equip`, `Wear`, `DropEquipment`, `PickUpItem`/transport, `CapturePawn`, `RescuePawn`, `Arrest`, `Strip`, `ExtinguishFires`, `OpenThing`, soins, `DraftedMove`, `DraftedAttack`, `DraftedTend`). Comme dans le jeu, un arbre non désigné, un animal non désigné ou une roche non désignée n’offrent aucune option de travail (`WorkGiver.JobOnThing` sans désignation ne donne ni travail ni raison).

### 26. Jauge de travail (`ToilEffects.WithProgressBar` et chaque `JobDriver`)

| Travail | Classe | Avant | Changement |
|---|---|---|---|
| Minage | `JobDriver_Mine` : `1 - HitPoints / MaxHitPoints` de la roche | un remplissage par coup de pioche | toute la roche (dégâts / points de vie) |
| Construction, pose de sol, pont, réinstallation, tombe | `JobDriver_ConstructFinishFrame` : aucune jauge (la charpente dessine ses tuiles) | jauge | aucune jauge (les tuiles de la charpente, vague 2, restent) |
| Réparation, interrupteur | `JobDriver_Repair`, `JobDriver_Flick` : aucune jauge | jauge | aucune |
| Apprivoiser, dresser, entretien du dressage, mener à la corde | `JobDriver_InteractAnimal` : aucune jauge | jauge par étape | aucune |
| Discussion avec un prisonnier | `JobDriver_ChatWithPrisoner` : aucune jauge | jauge | aucune |
| Nettoyage | `JobDriver_CleanFilth` : travail fait / (travail par épaisseur × épaisseur de départ) | une jauge par couche | une jauge pour toute la saleté |
| Recherche (projet entier), plantes, semis, déracinement, déconstruction, lissage, toits, sols, cuisine et fabrication, soins, repas, vêtements, recharge, traite, tonte, abattage | `WithProgressBar` de chaque pilote | déjà conformes | — |

La jauge reste dessinée au-dessus du colon ; le jeu la dessine sur la cible, une demi-case plus bas (`offsetZ = -0,5`), entre colon et cible pour plantes et nettoyage : voir « Reste à faire ».

### 27. Info-bulles (`TooltipHandler`, `TipSignal`, `ActiveTip`, `GenUI`)

Le jeu redéclenche l’info-bulle d’une région à chaque image où la souris est dessus et relit son texte (`TipRegion`, `textGetter`) ; elle ne meurt que si la région n’est plus déclenchée (souris sortie, région disparue). Elle apparaît après 0,45 s (`TipSignal.delay`) et suit la souris (`GenUI.GetMouseAttachedWindowPos` : 16 px à droite, 14 px dessous, ou à gauche et au-dessus près des bords).

Avant : en jeu, un texte qui change (valeurs vivantes d’une ligne d’inspecteur, barre des colons…) ou une pièce redessinée effaçait l’info-bulle, qui ne revenait qu’en bougeant la souris ; elle restait figée là où elle était apparue ; délai 0,35 s. Après : le texte est relu à chaque image (comparaison de chaînes, aucune allocation) et l’info-bulle est repeinte seulement s’il change ; si la pièce sous la souris est remplacée, l’info-bulle revient aussitôt sur la pièce de même identité ; elle suit la souris ; délai 0,45 s.

### 30. Ordres en file et gestes (`KeyBindingDefOf`, `Pawn_JobTracker`)

`Pawn_JobTracker.TryTakeOrderedJob` met l’ordre en file quand `KeyBindingDefOf.QueueOrder` (Maj gauche ou droite) est tenu **au moment où l’option est choisie**. Avant, seul Maj tenu à l’ouverture du menu comptait ; maintenant Maj au clic sur l’option compte aussi. Gestes du jeu de base relevés (`Defs/Misc/KeyBindings/KeyBindings.xml`) :

- présents : Maj (file des travaux, transports, cuisine, déplacements mobilisés, ajout à la sélection), double-clic, Échap, Espace, 1 à 3 (vitesses), R (mobiliser), Q/E (tourner), Alt (inspecteur de case), F1 à F9 (onglets), touches des ordres et zones de la palette ouverte ;
- ajoutés : virgule et point (colon précédent, suivant), `*` du pavé (chose suivante de la case) ;
- absents, voir « Reste à faire » : G et T (statistiques de pièce, beauté), F (interdire l’objet sélectionné), V (interrupteur), C et X hors palette, Ctrl (pipette de construction, alignement des formes), Z (recherche sur la carte), Origine/Fin (vitesse), Page haut/bas (zoom).

### 33. Texte de survol d’une case (`Verse.MouseoverReadout`, `GlobalControls`)

`MouseoverReadout.MouseoverReadoutOnGUI` écrit, de la ligne du bas vers le haut, 19 px entre les lignes, à 15 px du bord gauche et 65 px du bas : lumière (`MouseoverUtility.GetGlowLabelByValue` : « Sombre » jusqu’à 30 %, « Éclairé », « Très éclairé » au-delà de 90 %, et le pourcentage) ; sol avec « (vitesse de marche X % fert. Y %) » (`GenPath.SpeedPercentString` = 13 / (coût + 13), fertilité seulement si > 0, rien entre parenthèses s’il est infranchissable) ; zone ; neige si sa profondeur dépasse 0,03 (`WeatherBuildupUtility` : poudreuse, fine, moyenne, épaisse, et la vitesse de marche avec +0, +4, +8, +12) ; chaque chose de la case par son `LabelMouseover` (bâtiment ou roche, plante « (croissance N %) », objet « ×N » au-delà de un, saleté « ×épaisseur » de `Filth.Label`, plan et charpente, personnes et animaux) ; toit (« Toit construit », « Toit de roche mince », « Montagne au-dessus ») ; gaz (aucun en Elsewhere). Sous le brouillard, seulement « Zone non découverte » (déjà ainsi). Masqué quand un onglet principal est ouvert.

Avant : coût du chemin en ticks, supports de construction, « Sol de culture (fertilité et plante à vérifier) », note de pont, désignations ; manquaient zone, saleté, plans de construction, personnes, neige ; ordre différent. Après : exactement les lignes ci-dessus, dans l’ordre du jeu (la liste rendue commence par la ligne du haut), placées à 15 px du bord gauche et 65 px du bas quand le coin est libre. Le terrain sous une paroi naturelle est son sol rocheux brut (« Granite brut ») et la roche est listée comme une chose, comme dans le jeu. L’ordre des choses entre elles suit leur genre (le jeu suit l’ordre d’apparition sur la case, qu’Elsewhere ne garde pas). Police et taille : vague 4.

Température en bas à droite : `GlobalControls.TemperatureString` donne « Intérieur » ou « Extérieur » et la température de la pièce de la case survolée (pour un mur, la dernière pièce intérieure parmi les cases voisines dans l’ordre de `GenAdj.AdjacentCellsAndInside`), arrondie au degré. Avant : température extérieure à une décimale. Après : la ligne de météo porte « Intérieur 21 °C » ou « Extérieur 12 °C » pour la case survolée (`hoverTemperatureText`), tous onglets confondus. Au lot 17, la variante « Intérieur (sans toit : N) » compte aussi les véritables cases de cette région thermique qui n'ont pas de toit, sans dévoiler les parties inconnues.

Statistiques de pièce et beauté (`EnvironmentStatsDrawer`, réglages de jeu « statistiques de pièce » et « beauté », touches G et T) : **faites au lot 17** ([note](fenetres-rimworld-environnement.md)). Une même feuille 424 × 49/195/233 suit le curseur, cinq statistiques et rôle réels, contours des cases de la pièce, moyenne de beauté réellement perçue et valeurs signées sur la carte. Modes indépendants, aucun calcul quand coupés ; données cachées exclues, pas de nouveau calcul de simulation.

Corrigé en passant : l’inspecteur d’un arbre ou d’une plante sauvage sans les textes du jeu installé titrait l’identifiant interne (« oak ») ; il prend le nom français (« Chêne »).

## Vérification dans le client

Serveur de développement local (port 5307), son et musique coupés, partie « Atterrissage forcé » (graine 42), vue 1 400 × 860 :
- roche : clic sur une paroi d’ardoise, inspecteur « Ardoise », barre « Points de vie » pleine, gestes « Miner », « Lisser le mur », « Fermer » ; après « Miner », « Annuler l’ordre » remplace « Miner » ; le survol de la case donne « Ardoise » au-dessus de « Ardoise brute (vitesse de marche 87 %) » et de « Éclairé (66 %) » ;
- menu : chêne désigné pour l’abattage, colon sélectionné, clic droit sur la couronne (au-dessus d’une autre case que celle du sol) : menu flottant « Ada » à la souris, option désactivée « Abattre — Ce travail est désactivé dans le tableau Travail » ; avec un colon dont le travail est permis, « Prioriser : Abattre » ouvre le travail et ferme le menu, le colon reste sélectionné ;
- éloigner la souris de plus de 100 px : le menu disparaît, le dossier du colon revient ; un second clic droit sur la même cible le rouvre aussitôt ; un clic gauche à côté du menu le ferme sans sélectionner la case ni désélectionner le colon ; Échap ferme le menu seul ; clic droit sur l’herbe nue : aucun menu ;
- colon mobilisé : clic droit sur le sol, il part tout de suite (sans menu) ; Maj + clic droit, le déplacement est mis en file ;
- info-bulle du portrait d’Ada dans la barre des colons, partie en vitesse ×3 : présente 15 s de suite (seize relevés, ticks 70 à 590), son texte (humeur, nourriture, repos) relu et sa largeur changeant ;
- rectangle sur le point d’atterrissage sans colon : « Divers ×1360 » (bois, acier, composants, repas de survie, médicaments, argent), sans le revolver ni le gilet ; rectangle sur Ada et des piles : Ada seule ;
- point et virgule : Ada → Noé → Ada ; température en bas à droite « Ensoleillé · Extérieur 11 °C » ;
- minage : dégâts de la roche relevés 240, 320, 400, 480 sur 500 pendant le travail de Mina, jauge croissante sur toute la roche ; la jauge elle-même n’a pas pu être lue à l’écran (vue réduite du panneau).

## Performances

Banc empaqueté par esbuild (`scripts/interactions-bench.ts`) sur Les Forges (250 × 250, 7 512 bâtiments, 1 778 piles, 21 122 plantes, 80 pions, 133 pièces), médianes de 7 et 9 passages, machine partagée et bruyante ; « avant » = fichiers d’`origin/main` copiés dans `tmp/bench/` :
- texte de survol, par case : avant 0,94 et 2,06 ms, après 0,53 et 1,22 ms (environ −42 %) ; il est relu au plus 4 fois par seconde ;
- température de la case survolée : 0,24 et 0,29 ms par relecture (même cadence) ; survol complet toujours moins cher qu’avant ;
- jauges de travail, tous les pions, par instantané : avant 0,158 et 0,128 ms, après 0,104 et 0,128 ms ;
- rectangle de sélection (objets d’un cadre de 40 × 25 cases) : 3,2 et 4,3 ms, une fois au relâchement, et seulement quand le cadre ne contient aucune personne ;
- menu : clic droit visé sur le modèle, même calcul qu’au clic gauche (environ 1 ms, vague 2), une fois par clic ; fermeture à distance : une comparaison par mouvement de souris quand un menu est ouvert ;
- info-bulle : par image, une comparaison de chaînes sans allocation tant qu’une info-bulle est montrée ; repeinte seulement quand son texte change ;
- rien n’est ajouté par image ailleurs.

## Tests

`tests/interactions-rimworld-20261122.test.ts` (9 cas) : roche, menu flottant (ouverture, titre, options seules, pas de menu sans option, file par Maj au choix de l’option), position, fermeture au clic extérieur et à 95 px, jauges, info-bulles, rectangle et double-clic, colon suivant et précédent, texte de survol, température. Anciens tests mis à jour parce qu’ils vérifiaient l’ancien texte de survol (`bridge-presentation-v387`, `campaign-biome-terrain-presentation-256`, `breakdown-presentation-v144`, `natural-roof-presentation-256`, `shallow-water-presentation-v403`), la ligne d’aide du menu (`everyday-orders-346`) ou la jauge d’apprivoisement et de dressage (`animal-training-ui-v459`, `domestic-save`).

## Reste à faire — reprise du 24 novembre

Les quatre points qui restaient après ce lot sont raccordés dans le candidat [schéma 378](ordres-identite-378.md) : file générale par Maj, ordres personnels chasse/apprivoisement/abattage, tri réel et pâlissement des menus, persistance des info-bulles au clic. Voir cette note pour la qualification et l'adaptation déclarée des réservations futures. Les actions renommer/bannir du Bio et les barres de défilement natives de 16 points ont été traitées dans le même lot.

**Lot 18, 24 novembre :** [gestes, recherche et jauges](fenetres-rimworld-gestes-20261124.md). Le double-clic de zone concerne les vrais champs de culture (les zones de stockage ne sont pas multisélectionnables dans Core). F/V/C/X agissent sur la sélection et les intentions d'interrupteur, Ctrl impose le carré ou prélève la couleur d'un tapis, Z recherche sur la carte, Origine/Fin règle la vitesse et Page précédente/suivante le zoom. Les jauges utilisent leurs cibles réelles et offsets de carte (`ToilEffects.WithProgressBar`). Détail, nuances du comportement et mesures dans la note ; aucune nouvelle règle de simulation.
