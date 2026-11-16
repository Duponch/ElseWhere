# Surbrillance des commandes (interface)

Lot d’interface, sans changement de schéma. Rien n’est écrit dans le monde, la sauvegarde ou la simulation, et aucun tirage aléatoire n’est fait : la surbrillance lit les notions affichées par l’[assistant d’apprentissage](learning-helper.md) et les pièces de l’interface native ; le contour de rectangle est un simple objet d’affichage sur la carte.

Il reprend la mise en évidence du jeu de base (`UIHighlighter`) : une notion ou une étape de tutoriel nomme des **étiquettes**, et les vraies commandes qui portent ces étiquettes pulsent tant qu’elle est affichée. Le tutoriel du jeu de base entoure aussi des rectangles de cases sur la carte ; Elsewhere a désormais l’outil pour le faire, en vue du futur tutoriel.

## Ce qui change pour le joueur

- **Les commandes dont parle une notion pulsent.** Quand la carte Conseils affiche une notion, les commandes concernées sont entourées d’un cadre de carton découpé, ocre souci bordé d’encre, dont l’éclat monte et descend un peu plus d’une fois par seconde. Exemples :
  - **Vitesse du temps** et **Mettre en pause** : les quatre boutons de vitesse, en bas à droite ;
  - **Réserves** : le bouton **Zones**, puis, la palette ouverte, l’outil **Zone de stockage** ;
  - **Miner** : le bouton **Ordres**, puis l’outil **Miner** ;
  - **Mobiliser** : le bouton **Mobiliser** de l’inspection d’un colon ;
  - **Répartir le travail** : l’onglet **Travail** du bas de l’écran ;
  - **Couchages** : l’onglet **Architecte**, puis la catégorie **Mobilier**, puis **Couchage au sol** et **Lit**.
- **Un chemin à suivre.** Un onglet, une palette, une catégorie d’Architecte ou un onglet d’inspection ne pulse que **fermé** ; une fois ouvert, c’est la commande suivante, à l’intérieur, qui prend le relais. Un outil, lui, pulse même choisi.
- **Le cadre suit sa commande** quand elle grossit au survol ou défile dans une page. Il disparaît quand la commande est cachée : HUD masqué, page qui la recouvre, fenêtre modale, liste déroulante ouverte par-dessus, ligne sortie de la partie visible d’un tableau.
- **Quand la pulsation s’arrête.** Dès que la notion quitte la carte : **Compris**, notion apprise en jouant, carte repliée en onglet ou fermée, assistant désactivé dans les Options. Rouvrir la carte rallume les cadres des notions encore affichées.
- **Animations réduites.** Avec la préférence système « réduire les animations », le cadre reste fixe, sans pulsation.
- **Contour sur la carte.** Le rendu sait tracer le bord blanc d’un rectangle de cases, comme les zones que le tutoriel du jeu de base demande de tracer. Aucune partie ne s’en sert encore : il attend le tutoriel.

## Règles (RimWorld 1.6, Core)

Faits relevés dans le code décompilé (`UIHighlighter`, `Pulser`, `Widgets.DrawTextHighlight`, `ConceptDef`, `LearningReadout`, `Lesson_Instruction`, `Lesson_Note`, `MainButtonWorker`, `MainButtonDef`, `MainTabWindow_Architect`, `InspectPaneUtility`, `InspectTabBase`, `Command`, `Designator`, `Designator_Build`, `CompForbiddable`, `TimeControls`, `AlertsReadout`, `TutorUtility`, `GenDraw`, `Instruction_PlaceStockpile`) et dans `Data/Core/Defs/Tutor/Concepts_*.xml` et `Instructions.xml` :

- **Étiquettes.** Une commande appelle `HighlightOpportunity(rect, étiquette)` en se dessinant ; elle est mise en évidence si cette étiquette a été demandée par `HighlightTag` pendant l’image précédente. Une notion (`ConceptDef.highlightTags`) ou une étape de tutoriel (`InstructionDef.highlightTags`) demande ses étiquettes à chaque image où elle est montrée.
- **Pulsation.** `Pulser.PulseBrightness(1,2 ; 0,7)` : l’opacité va de 1 − 0,7 = 0,3 à 1, en suivant (1 − cos(2π × 1,2 × t)) / 2, soit 1,2 battement par seconde. Le dessin est `Widgets.DrawTextHighlight` en blanc à cette opacité, sans débord.
- **Quelles notions.** Le panneau de l’assistant met en évidence les étiquettes de la notion **survolée ou épinglée** (`LearningReadout` → `HighlightAllTags`) ; une note (`Lesson_Note`) et l’étape de tutoriel active (`Lesson_Instruction`) mettent en évidence les leurs tant qu’elles sont affichées.
- **Noms d’étiquettes.** Onglet du bas : `MainTab-<onglet>-Closed`, seulement si l’onglet n’est pas ouvert et qu’aucune fenêtre n’est ouverte. Catégorie d’Architecte : `DesignationCategoryButton-<catégorie>-Closed`, seulement si elle n’est pas choisie. Onglet d’inspection : `ITab-<onglet>-Closed`, seulement s’il n’est pas ouvert. Outil : `Designator-<nom>` ou `Designator-Build-<objet>`. Commande d’objet : son `tutorTag` (`ToggleForbidden`, `ToggleForbidden-Door` pour une porte). Boutons de vitesse : `TimeControls`. Alertes : `Alerts`.
- **Rectangles du tutoriel.** Les étapes qui demandent de tracer une zone dessinent le bord des cases visées (`GenDraw.DrawFieldEdges`, blanc), une flèche vers leur centre et une étiquette au centre (`TutorUtility.DrawCellRectOnGUI`).

## Étiquettes des notions

Les étiquettes du jeu de base, rapportées aux commandes d’Elsewhere. Les notions sans étiquette dans le jeu de base n’en ont pas non plus ici : Secourir, Capturer, Commercer, Animaux en rage et portes, Console de communication, Vitesse des portes, File d’ordres, Déplacer la vue, Zoomer, S’équiper d’une arme, Couvert et tir, Pourriture et froid, Détérioration, Opérations, Inspecter une case, Prévenir les incendies et Tirs amis.

| Notion | Concept Core | Étiquettes Core | Commandes Elsewhere |
|---|---|---|---|
| Repartir d’une carte lointaine | ReformCaravan | MainTab-World-Closed, ReformCaravan | onglet Monde, puis **Former / Reformer la caravane** |
| Mobiliser | Drafting | Draft | **Mobiliser** (inspection d’un colon) |
| Balise de commerce orbital | BuildOrbitalTradeBeacon | MainTab-Architect-Closed, DesignationCategoryButton-Misc-Closed, Designator-Build-OrbitalTradeBeacon | onglet Architecte, catégorie Production, **Balise orbitale** |
| Factures de production | BillsTab | ITab-Bills-Closed | **Factures** (inspection d’un poste) |
| Dépendance | DrugAddiction | ITab-Needs-Closed | onglet **Besoins** de l’inspection |
| Politiques de drogues | DrugPolicies | MainTab-Assign-Closed, ManageDrugPolicies | onglet Assignations, puis **Drogues** |
| Prisonniers | PrisonerTab | ITab-Prisoner-Closed | onglet **Prisonnier** de l’inspection |
| Étagères | Shelves | Designator-Build-Shelf | outil **Étagère** |
| Livres | Books | MainTab-Assign-Closed, ReadingAssignPolicy | onglet Assignations, puis colonne **Lecture** |
| Vitesse du temps, Mettre en pause | TimeControls, Pause | TimeControls | les quatre boutons de vitesse |
| Réserves | Stockpiles | MainTab-Architect-Closed, DesignationCategoryButton-Zone-Closed, Designator-ZoneAddStockpile_Resources | bouton **Zones**, puis **Zone de stockage** |
| Interdire et autoriser | Forbidding | ToggleForbidden | **Interdire / Autoriser** d’une pile, d’une arme, d’un vêtement ou d’un œuf |
| Couchages | *Elsewhere* | (tutoriel BuildBeds) Architect, Furniture, Designator-Build-Bed | onglet Architecte, catégorie Mobilier, **Couchage au sol**, **Lit** |
| Cultures | GrowingFood | Architect, Zone, Designator-ZoneAdd_Growing | bouton **Zones**, puis **Zone de culture** |
| Alertes | Alerts | Alerts | les cartes d’alerte et **tout voir** |
| Miner | Mining | Architect, Orders, Designator-Mine | bouton **Ordres**, puis **Miner** |
| Recherche | *Elsewhere* | (tutoriel OpenMainTabResearch) MainTab-Research-Closed | onglet **Recherches** |
| Répartir le travail | WorkTab | MainTab-Work-Closed | onglet **Travail** |
| Interdire une porte | ForbiddingDoors | ToggleForbidden-Door | **Interdire le passage** (inspection d’une porte) |
| Former un groupe de voyage | FormCaravan | MainTab-World-Closed, FormCaravan, ReformCaravan | onglet Monde, puis **Former une caravane** |
| Apprivoiser | AnimalTaming | Architect, Orders, Designator-Tame | onglet **Faune**, puis la colonne **Apprivoiser** (ou **Apprivoiser** dans l’inspection de l’animal) |
| Dresser | AnimalTraining | ITab-Training-Closed | **Demander** sur les lignes d’apprentissage de l’animal |
| Fiche d’information | InfoCard | InfoCard | **Informations** de l’arme, des vêtements et de l’inventaire d’un colon |
| Réglages de réserve | StorageTab | ITab-Storage-Closed | **Réglages du stockage** d’une réserve, **Stockage** d’une étagère |
| Zone de foyer | HomeArea | Architect, Zone, Designator-AreaHomeExpand | bouton **Zones**, puis **Zone de foyer** |
| Réaction aux menaces | HostilityResponse | HostilityResponse | colonne **Hostilité** d’Assignations |
| Zones autorisées | AllowedAreas | Architect, Schedule, Zone, AreaAllowedExpand, AreaAllowedClear | bouton **Zones**, puis **Zones autorisées** ; onglet Assignations |
| Planning | TimeAssignments | MainTab-Schedule-Closed | onglet **Planning** |
| Politiques de tenue | Outfits | MainTab-Assign-Closed, ManageOutfits | onglet Assignations, puis **Tenues** |
| Historique | HistoryTab | MainTab-History-Closed | onglet **Historique** |

Les correspondances sont dans `src/ui/learning-concepts.ts` (champ `highlightTags` de chaque notion) et `src/ui/native-highlight-tags.ts` (étiquette de chaque commande, lue sur son identifiant ; une commande peut aussi porter une étiquette explicite, `NativeControl.highlight`, pour le futur tutoriel).

## Adaptations

- **Toutes les notions de la carte.** Le jeu de base ne montre qu’un titre et met en évidence la notion survolée ou épinglée ; Elsewhere montre déjà le texte de chaque notion dans la carte, qui tient lieu de fiche épinglée : les étiquettes de **toutes** les notions peintes sur la carte pulsent. Repliée en onglet, la carte ne montre plus de texte : rien ne pulse.
- **Palettes Ordres et Zones.** Les chemins Architecte → Zone et Architecte → Ordres du jeu de base passent ici par les boutons **Zones** et **Ordres** à gauche ; ils ne pulsent que palette fermée, comme une catégorie.
- **Apprivoiser** se demande dans **Faune** (et dans l’inspection d’un animal sauvage), pas par un outil d’Ordres. Les **zones autorisées** s’attribuent dans **Assignations** (le jeu de base 1.6 le fait dans l’onglet Planning).
- **Dresser.** Les apprentissages sont des lignes de l’inspection d’un animal, sans onglet séparé : leurs boutons pulsent sans condition d’onglet fermé.
- **Former et reformer** un groupe de voyage sont le même bouton de Monde, dont le texte change.
- **Couchages** et **Recherche**, notions propres à Elsewhere, prennent les étiquettes des étapes du tutoriel du jeu de base qui enseignent ces gestes (BuildBeds, OpenMainTabResearch).
- **Aspect.** Le jeu de base éclaire la commande d’un halo blanc ; sur le carton crème et kraft d’Elsewhere, un cadre ocre souci bordé d’encre reste lisible. La pulsation (1,2 par seconde, de 0,3 à 1) est celle du jeu de base. Le cadre est dessiné par-dessus l’interface : une commande recouverte par une page ou une liste n’est pas encadrée, plutôt que d’être dessinée dessous.
- **Contour de carte.** Bord blanc fixe, comme les bords de zones du jeu de base, un peu à l’intérieur du rectangle ; ni flèche ni étiquette pour l’instant.

## Coûts

- **Aucune notion étiquetée** : un seul test par image, rien n’est cherché ni dessiné.
- **Recherche des commandes** : seulement quand les étiquettes changent, quand une pièce de l’interface est créée, rangée, reprise ou détruite, ou quand une page est reconstruite ou rebranchée (au rythme des instantanés tant qu’une page est ouverte). Elle parcourt une fois la liste des pièces cliquables ; aucun parcours par image.
- **Par image** : pour chaque commande encadrée, une remontée de ses parents (visibilité, découpe de page) et un produit de matrices ; la pulsation est **une seule valeur** (l’opacité du matériau). Les sommets des cadres ne sont réécrits que si un cadre apparaît, disparaît ou bouge ; une page rebranchée sur les mêmes commandes ne réécrit rien. Tous les cadres forment **un seul maillage**, donc un seul appel de dessin en plus, dessiné après l’image en cache de l’interface sans la repeindre.
- **Contour de carte** : un maillage de 24 sommets, réécrit une fois par rectangle, un appel de dessin quand il est montré, rien par image ; son matériau est compilé avec les autres couches pendant le chargement.
- Le pipeline des cadres est compilé à la première surbrillance de la session (court à-coup possible une fois). Aucune mesure d’images par seconde n’a été faite pour ce lot.

## Contrôles

- `tests/native-highlight.test.ts` : 6 cas.
  - **Une commande étiquetée est trouvée et encadrée** : vrais boutons de vitesse du HUD, cadre autour de chacun, pulsation 0,3 puis 1 une demi-période plus tard, cadre fixe en animations réduites ; identifiants réels des palettes Zones et Ordres, de l’Architecte (Mobilier), d’Assignations et de l’inspection d’un colon ; commande de page et étiquette explicite ; onglet du bas qui cesse de pulser une fois ouvert ; fenêtre modale qui recouvre le HUD mais pas ses propres commandes ; HUD masqué.
  - **Aucun parcours par image** : la liste des pièces n’est lue qu’au changement d’étiquettes, à la création d’une pièce ou à une page rebranchée ; sommets écrits une fois tant que rien ne bouge, réécrits quand une commande bouge, pas pour un simple rebranchement.
  - **La surbrillance commence et s’arrête avec sa notion** : vrai assistant et vraie carte Conseils ; Mobiliser allume **Mobiliser** ; carte repliée, fermée puis rouverte ; deuxième notion (Réserves) ; **Compris**, notion apprise en jouant, assistant désactivé ; le câblage de `main.ts` est vérifié dans le source.
  - **Étiquettes des notions** : une notion a des étiquettes exactement quand son concept Core en a ; chaque étiquette est portée par une commande existante.
  - **Contour de rectangle montré puis retiré** : bords exacts, rectangle borné à la carte, rectangle vide, point d’entrée du rendu (`setMapOutline`).
  - **Aucune écriture du monde** : monde sérialisé identique et aucune commande envoyée après HUD, pages, surbrillance et contour.
- Voisins : assistant d’apprentissage, carte Conseils, premiers gestes et premiers jours, alertes, HUD, accueil et Options natifs, scène native, couches de rendu touchées. Les échecs relevés sont des échecs anciens (liste connue, plus deux tests de fermeture de la scène qui échouent déjà sur la base du lot faute de couche `raidPods` dans leur montage, et un test dont l’empreinte de `main.ts` est périmée depuis longtemps). Typage complet.
- Vérification dans le navigateur (serveur de développement local, scénario Camp pédagogique 32², volet du navigateur ralenti) : la notion **Vitesse du temps** encadre les quatre boutons de vitesse et **Compris** éteint les cadres ; **Réserves** encadre le bouton Zones, puis, palette ouverte, l’outil Zone de stockage seulement ; sommets écrits une fois tant que rien ne bouge ; contour d’un rectangle de 6 × 4 cases affiché puis retiré par le point d’entrée de diagnostic `__lisiere.setMapOutline` (développement, `?e2e`).

## Limites

- Le contour de rectangle et la surbrillance servent désormais aux [37 leçons du tutoriel](tutorial-lessons-v349.md) (schéma 349) : nouvelles étiquettes `next-page`, `reorder-pawn`, `randomize-pawn`, `material:<construction>`, `growing-plant` et `choose-storyteller`. Toujours sans flèche ni étiquette sur la carte.
- Les étiquettes du jeu de base sans commande équivalente ne sont pas reprises (`ManualPriorities-Off`, `Messages`, `GrowingZoneSetPlant`, `AddBill`, `StoragePriority`, boutons de page et de création des colons, etc.), comme les notions correspondantes.
- Une commande est jugée recouverte par son centre : une commande à moitié sous une page garde ou perd son cadre selon ce centre.
- Le tableau Faune et les colonnes d’Assignations encadrent chaque ligne visible (un cadre par colon ou par animal).
