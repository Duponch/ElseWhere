# Tutoriel : les 37 leçons — schéma 349

Schéma 349. Second lot du tutoriel de RimWorld 1.6 (« Apprendre à jouer ») : après le [profil, les règles et le contenu imposé du lot 347](tutorial-profile-v347.md), la partie Tutoriel déroule maintenant les **37 leçons du jeu de base, dans l'ordre**, adaptées à l'interface native d'Elsewhere. Chaque leçon a sa carte de consigne, ses commandes en surbrillance, son contour sur la carte et son verrou : tant qu'elle est active, seules les actions qu'elle nomme sont permises.

Sources : `Data/Core/Defs/Tutor/Instructions.xml` (ordre, événements de départ et de fin, actions permises, étiquettes de surbrillance, tailles) et le code décompilé de `TutorSystem`, `Tutor`, `TutorialState`, `ActiveLessonHandler`, `Lesson`, `Lesson_Instruction`, de chaque classe `Instruction_*`, de `TutorUtility`, `PlayerKnowledgeDatabase`, `LessonAutoActivator`, `HealthUtility.DamageUntilDowned`, et des appelants de `TutorSystem.AllowAction` et `Notify_Event` (`Designator`, `Command`, `Command_SetPlantToGrow`, `FloatMenuOption`, `MainButtonWorker`, `InspectPaneUtility`, `Page`, `Page_SelectStartingSite`, `Page_ConfigureStartingPawns`, `StartingPawnUtility`, `MainTabWindow_Research`, `ActiveTransporter`, `GenStep_ScatterThings`, `Pawn_DraftController`, `CompForbiddable`). Les consignes françaises sont celles d'Elsewhere ; aucun texte ni code du jeu de base n'est repris.

## Ce qui change pour le joueur

- **Une leçon à la fois.** La carte de consigne, en carton, s'affiche en haut à droite (310 pixels de large) avec le texte de l'étape et, quand l'étape compte quelque chose, une barre de progression. À chaque nouvelle leçon, la carte s'éclaire d'un éclat blanc qui s'efface en une demi-seconde.
- **La première leçon** (créer le monde) s'ouvre au centre de l'écran sur un voile noir à 90 % pendant quatre secondes, puis glisse en une seconde vers son coin. Le voile absorbe toute saisie tant qu'il est là, comme dans le jeu de base.
- **Les commandes à utiliser pulsent** (surbrillance existante) : par exemple le bouton Zones puis Zone de stockage, l'onglet Architecte puis la catégorie et la construction, le matériau Bois, l'onglet Travail, le bouton Mobiliser, le Menu et son choix du narrateur.
- **Les zones à tracer sont entourées sur la carte** (contour existant) : la réserve de 6 × 6, la pièce de 12 × 8, le champ de 10 × 8, l'anneau de sacs de sable, le filon d'acier, puis l'abri à couvert tant que les colons n'y sont pas tous.
- **Un geste hors de l'étape est refusé** : la commande n'est pas envoyée, un son de refus joue et la consigne de l'étape s'affiche en message. La caméra et le temps (pause, vitesses) ne sont jamais verrouillés, ni le Menu.
- **L'assistant d'apprentissage se tait** pendant le tutoriel (le Tuteur l'éteint, `disableAdaptiveTraining`) : aucune notion n'est montrée ni ouverte. Il reprend à la fin, son minuteur de repos remis à zéro.
- **À la fin**, le choix du narrateur dans le Menu clôt le tutoriel : la partie devient une partie Cassandra ordinaire (lot 347) et plus rien n'est verrouillé.
- **Une partie normale ne change pas** : aucune leçon, aucune carte, rien de verrouillé, aucune commande de plus.

## Les leçons

| # | Leçon (jeu de base) | Ce que demande la consigne | Fin de la leçon | Actions permises | Adaptation Elsewhere |
|---|---|---|---|---|---|
| 1 | CreateWorldParams | garder les réglages, Générer | page fermée | Retour, Suivant | carte centrée sur voile noir, puis coin ; Suivant = **Générer** |
| 2 | ChooseLandingSite | une forêt tempérée de plaine, puis Suivant | page fermée | Retour, Suivant, onglets du lieu, `ChooseBiome-TemperateForest-Flat-None` | la liste et le tirage aléatoire ne proposent que ces cases ; une case est marquée « Lieu conseillé » ; Suivant refuse un autre biome |
| 3 | ReorderCharacters | faire entrer un candidat laissé sur place | `ReorderPawnOptionalToStarting` | Retour, réordonner | réordonner = **Choisir pour le départ**, ↑, ↓ (pas de glisser) |
| 4 | RandomizeCharacter | renouveler un candidat | `RandomizePawn` | + renouveler | renouveler = ↻ ; démarre seulement après la leçon 3 (source) |
| 5 | AcceptStartingPawns | réorganiser à son gré, Démarrer | page fermée | + Suivant | Suivant = **Démarrer** ; renommer est libre ; les trois colons doivent pouvoir se battre (lot 347) |
| 6 | MapCameraDolly | déplacer la vue | notion Déplacer la vue apprise (remise à 0 au départ) | rien | démarre quand la carte s'affiche (pas de lettre d'arrivée) |
| 7 | MapCameraZoom | zoomer | notion Zoomer apprise | rien | molette |
| 8 | Pause | mettre en pause | notion Pause apprise (0,4 par pause) | rien | barre d'espace ou boutons de vitesse |
| 9 | TimeControls | changer de vitesse | notion Vitesse du temps apprise | rien | touches 1, 2, 3 ou boutons |
| 10 | MakeStockpile | tracer la réserve de 6 × 6 entourée | désignation de la zone | Architecte, Zone de stockage | exactement le rectangle (tracé depuis n'importe quel coin) ; Architecte = bouton **Zones** |
| 11 | EndStockpileDesignating | ranger l'outil | `ClearDesignatorSelection` | rien | clic droit ou Échap |
| 12 | UnforbidStartingResources | autoriser les biens de départ | tous autorisés ou disparus | Autoriser (objet), Ordres → Autoriser | biens de départ = contenu des capsules et dispersions près du départ ; attend l'ouverture des capsules |
| 13 | BuildRoomWalls | murs en bois sur le contour de 12 × 8 | chaque case du contour a un mur (plan, chantier ou mur) | Architecte, Mur, bois | une ligne de murs doit tomber sur des cases du contour encore sans mur ; matériau remis à bois |
| 14 | BuildRoomDoor | une porte en bois sur le contour, hors des coins | désignation de la porte | Architecte, Porte, bois | la porte se pose sur le plan de mur |
| 15 | BuildBeds | 3 lits en bois dans la pièce | 3 centres de lit dans la pièce | Architecte, Lit, bois | dans la pièce = contour retiré |
| 16 | BuildTorchLamp | une lampe-torche dans la pièce | 1 dans la pièce | Architecte, Lampe-torche | — |
| 17 | BuildAnimalSleepingSpot | un couchage animal dans la pièce | 1 dans la pièce | Architecte, couchage animal | l'animal de départ existe déjà (lot 256) |
| 18 | BuildHorseshoesPin | fers à cheval dehors, à 10 cases au plus | 1 placé | Architecte, fers à cheval, bois ou acier | catégorie **Loisirs** |
| 19 | MakeGrowingZone | tracer le champ de 10 × 8 entouré (fertilité ≥ 0,5) | désignation de la zone | Architecte, Zone de culture | exactement le rectangle |
| 20 | SetToGrowRice | régler la culture sur Riz | `GrowingZoneSetPlant-Plant_Rice` | sélecteur de culture | sélecteur **Culture** de l'inspection ; toute autre plante est refusée |
| 21 | EquipWeapons | chaque colon s'équipe d'une arme de départ | chaque colon libre a une arme | rien (ordres non verrouillés) | les armes de départ restent mémorisées après la leçon 12 |
| 22 | BuildFueledStove | une cuisinière à bois dans la pièce | 1 dans la pièce | Architecte, cuisinière | catégorie **Production** |
| 23 | AddBillSimpleMeal | sélectionner la cuisinière, Factures, Repas simple × 10 | facture de la cuisinière sélectionnée répétée 10 fois ; progression (1 + nombre) / 11 | Factures, Travail | **75 pommes de terre** à l'activation (lot 347) ; mode « X fois » d'Elsewhere |
| 24 | MineSteel | miner tout le filon | toutes les cases du filon désignées ou minées | Architecte, Miner | **filon d'acier compacté** à l'activation ; ses cases dans le rectangle 10 × 10 sont gardées |
| 25 | ChopTrees | désigner 10 arbres | 10 ordres de coupe sur des arbres | Architecte, Couper | Ordres → **Couper** |
| 26 | OpenMainTabWork | ouvrir Travail | `MainTab-Work-Open` | Travail | — |
| 27 | ChangeWorkSettings | changer des réglages de travail | notion Répartir le travail apprise | Travail | mode cases à cocher du lot 344 |
| 28 | BuildSimpleResearchBench | un bureau de recherche simple en bois dans la pièce | 1 dans la pièce | Travail, Architecte, bureau, bois | — |
| 29 | OpenMainTabResearch | ouvrir Recherches | `MainTab-Research-Open` | Recherches | — |
| 30 | SelectResearchProject | choisir un projet | `StartResearchProject` | Recherches, Travail | événement au choix accepté d'un projet |
| 31 | ExpandAreaHome | agrandir la zone de foyer de 30 cases | +30 cases depuis l'activation | Architecte, Travail, Zone de foyer | — |
| 32 | ExpandAreaBuildRoof | tracer 10 cases de toit à construire | +10 cases depuis l'activation | Architecte, Travail, Construire un toit | — |
| 33 | BuildSandbags | sacs de sable sur l'anneau de 7 × 7 sans ses lignes centrales | les 20 cases ont des sacs | Architecte, Travail, Sacs de sable | les arbres de la bande intérieure sont retirés à l'activation (pas les objets) |
| 34 | FinishSandbags | attendre la fin des constructions | plus aucun plan ni chantier ; progression 1 − restants / initiaux | Travail, onglets du colon | — |
| 35 | DownRaider | pause, mobiliser, se mettre à couvert, reprendre | plus aucun ennemi debout | Mobiliser, Démobiliser, Tir à volonté, viser, onglets du colon | **raid d'un pillard** à l'activation (lot 347) ; si un pion du joueur tombe, chaque ennemi est mis à terre |
| 36 | UndraftAll | démobiliser tout le monde | plus aucun colon mobilisé | Mobiliser, Démobiliser | — |
| 37 | ChooseStoryteller | Menu → choisir le narrateur | `ChooseStoryteller` ; **fin du tutoriel** | Menu, choix du narrateur | commande `choose-storyteller` du lot 347 ; seule Cassandra Classique en Récit d'aventure est proposée |

## Le moteur des leçons

- **Une leçon active.** Les cinq leçons des pages de création n'existent que dans l'interface (aucun monde n'existe encore). Dès la carte, la leçon active est celle de la partie : elle est enregistrée avec elle.
- **Le bus d'événements** (`TutorSystem.Notify_Event`) : un événement va d'abord à la leçon active (ses événements de fin et les vérifications propres à sa classe), puis active la première leçon dont l'événement de départ est celui-ci, en tenant compte de la leçon source (`ReorderPawnOptionalToStarting` n'active RandomizeCharacter que depuis ReorderCharacters). Une leçon finie annonce `InstructionDeactivated-<leçon>`, qui active la suivante. Les événements viennent de la vraie interface : pages de création (début, fermeture), réordonner et renouveler un candidat, outils (choix, désignation, rangement), onglets du bas et de l'inspection, commandes d'objet, choix de la culture, choix d'un projet de recherche, choix du narrateur, notions apprises.
- **Les fins sur l'état de la carte** (Mur, Lits, Armes, Factures, Coupe, Foyer, Sacs de sable, Pillard…) sont vérifiées sur le dernier instantané confirmé, au rythme de l'assistant (quatre fois par seconde au plus), comme les `LessonUpdate` du jeu de base.
- **Une leçon de la partie** se demande à la simulation par la commande `tutorial-lesson` ; la simulation vérifie seulement l'ordre (la suivante, ou MapCameraDolly au départ) et fait ce que l'activation change dans la partie (rectangles, contenu imposé). La décision de fin est prise par l'interface, comme dans le jeu de base.
- **Les leçons de notion** (vue, zoom, pause, vitesses, travail) remettent leur notion à zéro au départ (`Instruction_LearnConcept`) et finissent quand elle est apprise ; une partie rechargée sur une de ces leçons ne la remet pas à zéro.

## Le verrou des actions

Comme `TutorSystem.AllowAction`, seulement pendant le tutoriel et seulement tant qu'une leçon est active : l'action doit figurer dans la liste de la leçon, avec les vérifications de cases de sa classe.

- **Rectangle exact** pour les zones (réserve, champ).
- **« Dans ces cases »** pour les murs (cases du contour encore sans mur), la porte (contour sans les coins), les sacs de sable (l'anneau) et le minage (les cases du filon).
- **« Dans la pièce »** pour le mobilier (pièce sans son contour) ; les fers à cheval : à dix cases au plus de la pièce, jamais dedans.
- **Actions verrouillées** : outils d'Ordres et de Zones, constructions de l'Architecte et leurs matériaux, ouverture de l'Architecte (et des boutons Ordres et Zones), onglets du bas sauf le Menu, onglets de l'inspection (Factures, Besoins, Santé, Matériel, Social, Bio, Journal, Prisonnier, Stockage), commandes d'objet (Mobiliser, Tir à volonté, viser, Interdire, Interdire le passage d'une porte, et les commandes sans étiquette : interrupteur, ravitaillement, réglages de chauffage…), choix de la culture, choix du narrateur, boutons Retour et Suivant des pages, réordonner et renouveler un candidat.
- **Jamais verrouillés** : caméra, pause et vitesses, Menu, sélection, ordres du clic droit (s'équiper, secourir…), factures, priorités, réglages de réserve.
- **Le verrou ne touche pas la simulation** : il filtre l'action dans l'interface avant l'envoi de la commande (`client.command`, outils, onglets, pages). Une action refusée n'envoie rien.
- Une leçon qui ne permet rien (caméra, pause, temps, ranger l'outil, armes) refuse toutes les actions verrouillées jusqu'à sa fin, comme dans le jeu de base.

## La leçon du pillard

À l'activation, le raid d'un vagabond du lot 347 arrive. Comme `Instruction_DownRaider`, dès qu'un pion du joueur est à terre (colon libre ou animal de la colonie), **chaque ennemi est blessé jusqu'à terre** : la procédure de `HealthUtility.DamageUntilDowned` déjà présente dans Elsewhere (lot 271) inflige des blessures tirées sur l'anatomie jusqu'à la chute, sans tirage de mort à terre. Elsewhere le vérifie à chaque tick de la simulation (le jeu de base, à chaque image de la leçon), pour les humains hostiles et les animaux enragés. La leçon finit quand plus aucun de ces ennemis n'est debout.

## Sauvegarde

- Le dossier du tutoriel (`gameProfile.tutorial347`) porte, à partir de 349 seulement, `lessons349` : `revision`, `introDone`, `startingItems` (identifiants), la leçon active (`active`), `roomRect` (dès BuildRoomWalls), `sandbagsRect` (dès BuildSandbags), et les données de la leçon active seulement : `zoneRect` (réserve ou champ), `mineCells` (cases du filon, croissantes), `areaStart` (taille de la zone à l'activation), `blueprints` (plans et chantiers à l'activation).
- Validation stricte : aucune clé inconnue, leçon des pages de création refusée, rectangles de la bonne taille et dans la carte, jamais avant leur leçon (ils peuvent manquer si aucun emplacement n'a été trouvé), données de leçon (`mineCells`, `areaStart`, `blueprints`) présentes exactement pendant leur leçon, identifiants uniques et positifs ; un dossier clos n'a plus ni leçon, ni rectangle, ni bien de départ.
- Une partie tutoriel créée au schéma 349 naît avec ce dossier ; une sauvegarde 348 (tutoriel ou non) migre par le seul numéro, sans dossier de leçons : un tutoriel commencé avant 349 continue sans leçon, l'assistant d'apprentissage reste actif. Rien n'est offert après coup.
- Une partie normale n'a aucun nouveau champ et aucun nouveau tirage.

## Adaptations

- **Pages de création** : le jeu de base fait glisser les candidats ; Elsewhere réordonne avec **Choisir pour le départ**, ↑ et ↓. La carte ne saute pas à gauche quand la souris passe dessus sur la page des personnages.
- **Lieu de départ** : le jeu de base marque une tache de cases permises près du centre de l'écran ; Elsewhere filtre la liste et le tirage aléatoire, et marque la case permise qui a le plus de voisines permises. Elsewhere n'a pas de points remarquables (`Landmark` est toujours « None »). Les onglets Planète et Terrain du jeu de base correspondent aux onglets « Lieux disponibles », « Factions » et « Lieu choisi ».
- **Lettre d'arrivée** : Elsewhere n'a pas de dialogue de début de partie ; la première leçon de la carte démarre quand la carte s'affiche.
- **Architecte** : les catégories Ordres et Zone du jeu de base sont les boutons **Ordres** et **Zones** à gauche ; les ouvrir est l'action `MainTab-Architect-Open`.
- **Matériau** : le choix du matériau d'une construction est verrouillé comme la liste de matériaux du jeu de base ; les leçons qui le demandent remettent le matériau à bois.
- **Biens de départ** : contenu des capsules (sauf la scorie) et dispersions près du départ, mémorisés pendant les 1 200 premiers ticks ; une pile fusionnée avec une autre à la dispersion n'est pas suivie. La leçon d'autorisation attend que les capsules soient ouvertes (le départ d'Elsewhere est en pause).
- **Armes de départ** : toutes les armes des capsules (celles d'Atterrissage forcé valent toutes plus de 30 argent).
- **Sacs de sable** : seuls les arbres de la bande intérieure sont retirés, pas les objets ; un arbre déjà visé par un travail reste.
- **Pillard** : les mécanoïdes endormis et les insectes des ruches ne retiennent pas la leçon ; seuls les humains hostiles et les animaux enragés sont mis à terre.
- **Facture** : le mode « X fois » d'Elsewhere tient lieu de RepeatCount ; la surbrillance « Ajouter une facture » n'a pas d'équivalent (l'onglet Factures pulse).
- **Repères sur la carte** : un contour de rectangle, sans étiquette ni flèche (le jeu de base ajoute une étiquette grise et des flèches).
- **Messages de refus** : la consigne de la leçon (le jeu de base a un message de refus propre à chaque leçon).
- **Aucun emplacement** : le jeu de base cherche sans fin un rectangle libre près du centre (`TutorUtility.FindUsableRect`) ; Elsewhere s'arrête quand la recherche couvre la carte. La leçon est alors passée (réserve, champ, pièce et ses meubles, sacs de sable) plutôt que laissée impossible ; un message le signale.

## Coûts

- Partie normale : un test par commande (aucun dossier de leçons), rien d'autre.
- Le verrou est une recherche dans la liste de la leçon, plus, pour les désignations qui en ont, un parcours des cases de l'action ou des centres de la construction concernée.
- Les fins et la progression se calculent au rythme de l'assistant (250 ms), sur le dernier instantané : un parcours des piles, des plans ou des colons selon la leçon, jamais de parcours du monde à chaque image.
- La carte est un seul carton redessiné quand le texte ou la progression change ; l'éclat et le voile sont deux plans dont seule l'opacité change pendant leur animation.
- La règle du pillard ne coûte qu'un test par tick hors de sa leçon.

## Vérifications

`tests/tutorial-lessons-349.test.ts` : 10 cas.
- **La chaîne des 37 leçons** sur une vraie création géographique en tutoriel, menée par de vrais événements et de vraies commandes jusqu'au choix du narrateur : intro centrée et voile, filtre du lieu, règle de la source, leçons de notion, rectangle exact, autorisation, murs, porte, lits, lampe, couchage, fers, champ, riz, armes, cuisinière et facture, filon, coupe, onglets, recherche, foyer, toit, sacs de sable, constructions finies (raccourci de test : les chantiers restants sont annulés hors verrou), pillard, démobilisation, fin.
- Chaque sorte de fin et le verrou (refus puis accord, rectangle exact, cases du contour, pièce, près de la pièce, anneau).
- Contenu imposé et raid à l'activation ; un colon à terre met le pillard à terre.
- Sauvegarde et rechargement au milieu du tutoriel : même leçon, mêmes données, notion non remise à zéro.
- Validation stricte et migration 348 → 349 ; une partie normale inchangée ; assistant suspendu puis minuteur remis à zéro.

## Limites

- Aucune vérification dans le navigateur n'a été faite pour ce lot : la carte, le voile, les contours et la surbrillance sont vérifiés par les tests du moteur et le typage, pas par une capture.
- Les étiquettes et flèches sur la carte du jeu de base ne sont pas reprises.
- L'assistant d'apprentissage reste suspendu pour un tutoriel créé à 349 jusqu'à sa fin ; un tutoriel 347/348 n'a pas de leçons.
