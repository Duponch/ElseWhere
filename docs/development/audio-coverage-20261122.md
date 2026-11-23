# Couverture audio — 22 novembre 2026 (présentation)

Passe de couverture sonore demandée par l'utilisateur : beaucoup de notifications, d'alertes, de lettres et d'actions étaient muettes ou partageaient un même clip. Ce lot est **de présentation seulement** : aucun champ de sauvegarde, aucune règle ni tirage de simulation, pas de changement de schéma (366). Les sons partent d'événements déjà confirmés (snapshots du Worker, commandes acceptées, lettres et alertes déjà affichées) et d'actions d'interface. Il prolonge le [mix V165](audio-mix-v165.md), les [variantes V164](audio-variation-v164.md) et la [couverture V175](audio-v175.md). Les noms Core cités sont des `SoundDef` de RimWorld 1.6.4871 (`Data/Core/Defs/SoundDefs/`) et les classes qui les jouent, lus pour savoir quels moments ont un son ; aucun fichier audio Core n'est repris.

**Résultat** : 32 nouveaux événements sonores, 102 prises publiées (2 à 4 par événement), 849 crédits ElevenLabs dépensés sur un plafond de 9 000. L'inventaire ci-dessous compte 62 lignes (certaines regroupent deux gestes voisins). 59 ont un son dans Core ou une adaptation déclarée : **36 sonnaient avant** dans Elsewhere (13 avec un son propre, 23 avec un clip partagé ou un simple clic), **48 ont maintenant un son propre**, 11 restent muettes. Les 3 moments muets dans Core le restent. Rien n'a encore été écouté par un humain : **l'écoute de l'utilisateur est la vraie validation** (voir « Écouter »).

## Inventaire

« Avant » : son joué avant ce lot (clip propre, clip partagé, clic générique ou rien). « Après » : identifiant du manifeste. Une lettre de schéma 352 porte le son de sa classe, ce qui couvre aussi les événements qui l'envoient.

### Lettres, alertes et messages

| Moment | Core | Avant | Après |
| --- | --- | --- | --- |
| Lettre de grande menace (raid, camp repéré, danger ancien) | `LetterArrive_BadUrgentBig` | `ui.threat` partagé | `letter.threat-big` |
| Lettre de petite menace (berserk, rage meurtrière) | `LetterArrive_BadUrgent` | `ui.threat` plus aigu | `letter.threat-small` |
| Lettre négative (crise mentale, piège) | `LetterArrive_BadUrgentSmall` | `ui.panel` grave | `letter.negative` |
| Lettre neutre | `LetterArrive` | `ui.panel` | `letter.neutral` |
| Lettre positive (inspiration, recrutement) et nouvelle quête | `LetterArrive_Good` (NewQuest hérite de PositiveEvent) | `ui.panel` aigu | `letter.positive` |
| Lettre de décès | Death hérite de NegativeEvent | `ui.colonist-death` | inchangé |
| Alerte critique qui apparaît | `Alert.Notify_Started` → `TinyBell` (0,5 s) | `ui.threat` à **chaque** alerte, sans limite | `alert.critical` (double cloche) |
| Alerte haute qui apparaît | `TinyBell` | `ui.panel` | `alert.high` (petite cloche) |
| Alerte moyenne | aucun son | muet | muet (conforme) |
| Inspiration qui commence (schéma 360) | lettre `PositiveEvent` (`Inspiration.SendBeginLetter`) | `ui.panel` aigu | `letter.positive` |
| Inspiration qui finit | message `NeutralEvent` (`Message_NeutralEvent`) | muet | **muet** |
| Crise mentale qui commence | lettre `NegativeEvent` / `ThreatSmall` (`MentalBreakWorker.TrySendLetter`) | `ui.panel` / `ui.threat` | `letter.negative` / `letter.threat-small` |
| Crise mentale qui finit | message `SituationResolved` (sans son) | muet | muet (conforme) |
| Recherche terminée | dialogue de `ResearchManager.FinishProject` (`CommsWindow_Open`) | muet | `ui.research-complete` |
| Colon à terre | pas de son de chute trouvé ; `Message_NegativeHealthEvent` existe | muet (seul le râle de blessure) | `ui.colonist-downed` (adaptation) |
| Colon mort | `Message_PawnDeath` | `ui.colonist-death` | inchangé |
| Arrivée d'un raid | lettre `ThreatBig` | `ui.threat` | `letter.threat-big` ; la page « Nouvelle menace » garde `ui.threat` |
| Offre de quête | lettre NewQuest | `ui.panel` aigu | `letter.positive` |
| Quête acceptée | `Quest_Accepted` | clic | `quest.accepted` |
| Quête réussie, échouée, terminée | `Quest_Succeded`, `Quest_Failed`, `Quest_Concluded` | muet | **muet** |
| Carte de leçon du tutoriel qui apparaît (349) | `TutorMessageAppear` (`Lesson_Note`), `Lesson_Activated` | muet | `tutorial.lesson-appear` |
| Leçon réussie | `Lesson_Instruction.PostDeactivated` → `CommsWindow_Close` ; `Lesson_Deactivated` | muet | `tutorial.lesson-complete` |
| Notion de l'assistant d'apprentissage affichée | `Lesson_Activated` | muet | **muet** |

### Interface

| Moment | Core | Avant | Après |
| --- | --- | --- | --- |
| Ouvrir un onglet du bas, la palette Ordres ou Zones | `TabOpen` | `ui.panel` ou clic | `ui.tab-open` |
| Refermer un onglet ou une page (Échap, Retour) | `TabClose` | `ui.panel` ou clic | `ui.tab-close` |
| Choisir un outil (ordre, zone, plan) | `Designator` : `Tick_Tiny`, `ArchitectCategorySelect` | clic, muet au clavier | `ui.tool-select` |
| Désigner un ordre (miner, abattre, récolter, déconstruire, chasser…) | `Designate_Mine`, `Designate_Haul`, `Designate_Deconstruct`… | muet | `ui.designate` |
| Tracer une zone ou une aire (stockage, culture, domicile, toit, déneigement) | `Designate_ZoneAdd*` | muet | `ui.designate-zone` |
| Annuler une désignation, retirer une zone | `Designate_Cancel`, `Designate_ZoneDelete` | muet | `ui.designate-cancel` |
| Poser un plan (bâtiment, sol, mur en ligne, réinstallation) | `Designate_PlaceBuilding` | muet | `ui.place-building` |
| Rectangle sans aucune case valide | `Designate_Failed` | muet | `ui.reject` |
| Clic sur un bouton | `Click` | `ui.click` | `ui.click`, remplacé par le son propre du geste quand il en a un |
| Bascule (boutons de vue murs, toits, feuillage, zones) | `Checkbox_TurnedOn` / `Checkbox_TurnedOff` | clic | `ui.toggle-on` / `ui.toggle-off` ; les cases des Options gardent le clic |
| Erreur ou refus | `ClickReject` (message `RejectInput`) | `ui.reject` | inchangé |
| Pause | `Clock_Stop` | clic (barre 3D), muet au clavier | `ui.clock-pause` |
| Vitesses ×1, ×3, ×6 | `Clock_Normal`, `Clock_Fast`, `Clock_Superfast` | clic, muet au clavier | `ui.clock-run`, joué 1 / 1,12 / 1,26 fois plus vite |
| Mobiliser, démobiliser | `DraftOn`, `DraftOff` | clic | `ui.draft-on`, `ui.draft-off` |
| Ordre direct à un colon (déplacement mobilisé, menu contextuel) | `ColonistOrdered` | muet | `ui.order` |
| Sélectionner un colon, un animal, un objet | `ColonistSelected`, `ThingSelected` | muet sur la carte | `ui.select` |
| Commerce ouvert | `Dialog_Trade` : `CommsWindow_Open` | clic | `ui.trade-open` |
| Échange conclu | `ExecuteTrade` | clic | `ui.trade-execute` |
| Survol des boutons | `Mouseover_*` | muet | **muet** (différé) |
| Glisser une désignation | `Designate_Drag*` (sustainers) | muet | **muet** |
| Fenêtre de dialogue qui s'ouvre | `DialogBoxAppear` | clic | **muet** au-delà du clic |

### Actions de la carte

| Moment | Core | Avant | Après |
| --- | --- | --- | --- |
| Manger | `Meal_Eat`, `RawVegetable_Eat`… | `eating.work` | inchangé |
| Dormir | aucun son trouvé | muet | muet (conforme) |
| Ramasser, déposer | `Standard_Pickup`, `Standard_Drop` (+ par matière) | `haul.pickup`, `haul.drop` | inchangé (pas par matière) |
| Récolter, semer | `Harvest_Standard`, `Interact_Sow` | `farming.harvest`, `farming.sow` | inchangé |
| Fin d'une récolte | `Harvest_Standard_Finish` | muet | **muet** |
| Soigner | `Interact_Tend` | `medical.tend` | inchangé |
| Coups de hache | `Harvest_Tree` | `woodcutting.hit` | inchangé |
| Arbre qui tombe | `Harvest_Tree_Finish` (`JobDriver_PlantWork`) | muet | `woodcutting.fell` |
| Miner | `PickHit` | `mining.hit` | inchangé |
| Roche qui cède | non vérifié | muet | **muet** |
| Construire | `Interact_ConstructWood/Metal…` | `construction.hit` | inchangé |
| Ouvrage achevé | `Building_Complete` (`Frame.CompleteConstruction`) | muet | `building.complete` |
| Sol posé, toit construit ou effondré | `Building_Complete`, `Roof_Finish`, `Roof_Collapse` | muet | **muet** |
| Porte manuelle, porte automatique | `Door_OpenManual`…, `Door_OpenPowered`… | `door.*`, `autodoor.*` | inchangé |
| Portail de clôture | `Door_FenceGateManual` (un seul son) | son de porte en bois | `fencegate.move` |
| Nettoyer, interrupteur, déconstruire | `Interact_CleanFilth`, `Power_OnSmall`, `Building_Deconstructed` | couverts | inchangé |
| Loisirs (fer à cheval, billard, poker) | `HorseshoeImpact`, `PlayBilliards`, `PokerChips` | muet | **muet** |
| Repas et cris spontanés des animaux | `Herbivore_Eat`…, `Pawn_*_Call` | muet | **muet** |

**Reste à faire**, par ordre d'utilité : fin de quête (réussite, échec), fin d'inspiration, fin de récolte, sols et toits, notion de l'assistant d'apprentissage, roche qui cède, loisirs, repas et cris des animaux, survol des boutons, glisser une désignation, fenêtres de dialogue, sons de dépôt par matière.

## Déclencheurs et limites de rafale

- **Lettres** : `letterCue` choisit la classe la plus urgente d'un lot arrivé ensemble (un seul son par lot, comme Core). **Alertes** : `alertCue` ne joue que lorsque le HUD a accordé sa cloche (au plus une toutes les 0,5 s, règle Core) ; l'avis « Alerte critique » reste affiché à chaque alerte critique, mais le son n'est plus rejoué vingt fois.
- **Commandes** : un seul point, après l'acceptation de la commande par le Worker (`commandCue` dans le client de `main.ts`) ; un refus lève une erreur et garde `ui.reject`. Une zone de 0 case ne sonne pas.
- **Gestes** : `nativeActivationCue` donne l'onglet ouvert ou fermé ; le clic générique d'un bouton est différé jusqu'à la fin de la tâche courante et **remplacé** si le geste demande un son propre (vitesse, bascule, outil, commerce, onglet), ce qui évite deux sons pour un clic. Les vitesses sonnent seulement sur un vrai changement demandé par le joueur (bouton ou clavier), pas sur la reprise automatique.
- **Monde** (enregistreur du Worker, `src/bridge/audio-cues.ts`) : ouvrage achevé = un chantier déjà travaillé disparaît **et** un ouvrage d'identifiant neuf apparaît sur sa case (une annulation ne laisse rien) ; arbre abattu = une coupe travaillée disparaît, l'arbre n'est plus là et la case ne brûle pas ; colon à terre = passage à l'état à terre d'un colon libre, sauf anesthésie ; recherche terminée = un projet de plus porte `completedAt`. Une reprise ou un chargement n'émet rien.
- **Lecteur** (`AudioDirector`) : les sons d'interface passent par la sortie d'interface (audibles en pause) sous le réglage Effets. Chaque son d'événement (lettres, alertes, tutoriel) attend 0,5 s avant de pouvoir rejouer et n'a qu'une voix ; à terre, mort, menace et recherche : 0,35 s et deux voix ; gestes : trois voix. Six voix d'interface au plus en tout, dans le plafond général de 24 voix. Effets coupés ou volume nul : rien ne joue (le mode de test muet). Les sons de monde gardent l'atténuation, la portée et les plafonds de groupe existants ; le portail rejoint le groupe des portes.

## Génération

Script existant [`generate-sfx.mjs`](../../scripts/audio/generate-sfx.mjs) (route API `/v1/sound-generation`, modèle `eleven_text_to_sound_v2`, MP3 44,1 kHz 128 kb/s), étendu d'une option `--take N` (`…-take-N.mp3`) et de l'enregistrement du coût facturé renvoyé par l'en-tête `character-cost`. Les 32 entrées du [plan](../../scripts/audio/sfx-plan.json) partagent une fin de prompt commune (« Warm cozy pastel colony game, dry close tactile foley… no voice, music… ») ; durées demandées 0,5 à 1,6 s, influence 0,72. Chaque génération est journalisée dans [generation-log.json](../../scripts/audio/generation-log.json) avec prompt, durée, influence, fichier, empreinte et crédits facturés.

| | Valeur |
| --- | --- |
| Générations | 108 (102 publiées) |
| Durée demandée | 84,9 s |
| Crédits facturés | **849** (10 crédits par seconde demandée, confirmé par le compteur du compte : 3 106 → 3 955) |
| Plafond de la passe | 9 000 |

Les trois premières prises de `letter.neutral` et de `quest.accepted` sont revenues presque silencieuses (souffle de papier, RMS actif −45 à −56 dBFS) : écartées, leurs fichiers bruts retirés (leur trace reste dans le journal et dans `rejectedTakes`), puis régénérées avec un prompt plus net (prises 4 à 6).

## Calibrage

Script [`calibrate-sfx.py`](../../scripts/audio/calibrate-sfx.py) (SoundFile, NumPy, SciPy, FFmpeg 7.1), mesures dans [pcm-balance-20261122.json](../../scripts/audio/pcm-balance-20261122.json), dérivations dans [processing-log.json](../../scripts/audio/processing-log.json) :

1. Les prises d'interface reçoivent une étagère −4 dB au-dessus de 5 kHz : elles revenaient bien plus brillantes que les clics V165 (centroïde spectral jusqu'à 9–10 kHz contre 1–6 kHz), et des prises trop brillantes avaient déjà été jugées dures. Les sons de monde gardent leur spectre.
2. Silence coupé au début et à la fin (seuil −50 dBFS, 4 ms avant, 40 ms après), fondus de 3 et 25 ms, atténuation seulement si la crête brute dépasse −1,5 dBFS, un seul encodage MP3 128 kb/s 44,1 kHz stéréo (`…-cal.mp3`).
3. Mesure du fichier encodé : crête, RMS sur la partie active, sonie K pondérée BS.1770 non fenêtrée (la plupart des sons durent moins qu'un bloc de 400 ms), centroïde.
4. Gain de prise = le plus petit entre le gain qui amène le RMS à la cible de sa famille et celui qui amène la crête au plafond ; gain d'événement 1.

| Famille | Cible RMS | Plafond de crête | Sons |
| --- | ---: | ---: | --- |
| Monde | −23 dBFS (règle V175) | −4 dBFS | ouvrage achevé, arbre qui tombe, portail |
| Notification forte | −27 dBFS | −6 dBFS | grande menace, alerte critique |
| Notification | −29 dBFS | −7 dBFS | autres lettres, alerte haute, recherche, à terre, commerce, tutoriel, quête |
| Interface | −32 dBFS | −8 dBFS | onglets, outils, désignations, vitesses, bascules, mobilisation, ordres, sélection |

Les sons d'interface restent sous la cible du monde parce qu'ils ne sont pas atténués par la distance ; les clics V165 sont vers −34,5 dBFS effectifs. Résultat : 102 prises, aucun écrêtage, crêtes des fichiers ≤ −1,2 dBFS ; chaque prise est à sa cible, ou en dessous seulement quand le plafond de crête décide (prises très percussives) ; l'écart le plus grand entre prises d'un même son est de 4,7 dB (`tutorial.lesson-appear`), de moins de 2 dB pour la plupart. Ce calcul ne prouve ni le confort ni la qualité : c'est l'oreille qui tranche.

## Écouter

- **Page des sons** (Options → Développeur → Sons et musiques, ou `/sounds-review.html`) : depuis le soir du 22 novembre, elle montre **tous** les sons et musiques du jeu ; « Nouveaux du 22 nov. » isole ces 32 sons, chacun avec la phrase qui dit où l'entendre en partie, et « Écouter toutes les prises visibles » les enchaîne. Détail plus bas, « Réglages manuels ».
- **En partie**, à écouter d'abord : les cinq lettres (un raid, une crise, une inspiration), les deux cloches d'alerte, puis les gestes fréquents (ouvrir un onglet, choisir un outil, désigner, poser un plan, changer de vitesse, mobiliser). Ce sont les sons qu'on entend le plus souvent : un timbre agaçant s'y remarque vite.
- Pour retirer une prise jugée mauvaise : supprimer son entrée dans `public/assets/audio/manifest.json` (le jeu choisit parmi les prises restantes).

## Réglages manuels (page des sons)

Point 19 du [chantier des retours](chantier-retours-20261122.md), soir du 22 novembre ; présentation seulement, schéma 376 inchangé. La page est l'une des [pages développeur](developer-pages.md).

**Ce qu'elle montre.** Les sons sont lus dans le manifeste par le lecteur du jeu lui-même (`parseAudioManifest`) : **87 sons** (86 du manifeste et l'explosion, qui reprend les prises de `weapon.impact-barrier`) et **239 prises**, rangés en sept familles (lettres et alertes, interface, travaux, bâtiments et machines, combat, douleur et mort, météo et ambiance), chacun avec la phrase qui dit où on l'entend, son gain, sa portée ou « interface », « boucle » le cas échéant. Les **10 musiques** viennent de `MUSIC_TRACKS`, par ambiance (jour, nuit, tension). Données : [`src/audio/sound-catalogue.ts`](../../src/audio/sound-catalogue.ts) ; page : [`src/dev/sounds-review.ts`](../../src/dev/sounds-review.ts).

**Niveaux.** Quand un calibrage a mesuré le fichier, la page affiche son RMS, sa crête, sa sonie K pondérée si elle est connue, et le niveau avec son gain ; sources, dans l'ordre : `pcm-balance-20261122.json`, `pcm-balance-v175.json`, `pcm-balance-v196.json`, `processing-log.json` (146 prises et 7 musiques). Pour les autres, la page mesure la prise à sa première écoute (RMS des fenêtres de 10 ms au-dessus de −50 dBFS et crête, comme les scripts), marquée « mesuré ici ». Chaque prise est jouée au gain du jeu : `min(8, gain du son × gain de la prise)` (une boucle : `min(2, gain du son) × gain de la prise`), puis le mélange des effets × le curseur de volume de la page ; sans la petite variation aléatoire de chaque lecture, et sans l'atténuation de la distance pour les sons de la carte. Une musique est jouée comme par le lecteur du jeu : `min(1, volume × 0,36 × gain du titre)`.

**Réglage.** Un curseur par son (« Tout le son »), un par prise et un par musique, de −30 à +12 dB par pas de 0,5 dB ; en relâchant le curseur, la prise (ou la dernière écoutée) rejoue au nouveau niveau, et un son en cours change de niveau pendant qu'on glisse. « Réinitialiser » remet un son et ses prises (ou un titre) à 0 dB ; « Tout réinitialiser » remet tout. « Seulement les réglés » filtre les sons modifiés.

**Enregistrement : un fichier dans le dépôt.** Les réglages vont dans [`public/assets/audio/gain-offsets.json`](../../public/assets/audio/gain-offsets.json) : décibels par son (`events`), par prise (`variants`, clé = chemin du fichier) et par titre (`music`), clés triées, zéros omis. Choix retenu, le plus simple qui compte vraiment en jeu :

- sur le serveur de développement, « Enregistrer » envoie le réglage à un point d'accès réservé à ce serveur ([`scripts/vite-dev-audio-gain-offsets.ts`](../../scripts/vite-dev-audio-gain-offsets.ts), `apply: 'serve'`) qui écrit **ce seul fichier**, après le lecteur strict (format, clés, bornes), et refuse une requête d'un autre site. Le projet n'avait pas encore de tel point d'accès ; sans lui, l'utilisateur aurait dû déplacer à la main un fichier téléchargé à chaque essai ;
- ailleurs (version publiée, aperçu du build), le même bouton télécharge `gain-offsets.json`, à placer dans `public/assets/audio/` ; « Télécharger le réglage » le fait à tout moment ;
- le fichier est dans `public/` et non importé par le code : l'écrire ne recharge pas une partie ouverte dans un autre onglet.

**Application en jeu.** `src/main.ts` lit le fichier une fois au chargement (`loadGainOffsets`, sans cache) et le donne à `AudioDirector.setGainOffsets` et `MusicDirector.setGainOffsets`. Le lecteur des effets multiplie gain du son et gain de prise sous les plafonds du manifeste (8, ou 2 pour une boucle) en gardant le manifeste lu intact (`applyManifestGainOffsets`) ; la musique multiplie le gain du titre et le volume de l'élément reste au plus 1. Un fichier absent, illisible ou hors format ne règle rien ; une valeur hors bornes est ramenée dans [−30, +12] dB. Coût : sans réglage, `applyManifestGainOffsets` rend le manifeste tel quel (0,3 µs) ; avec 21 réglages, 52 µs une fois au chargement (la lecture du manifeste en prend 56) ; aucun parcours par image ni nœud audio ajouté.

## Vérification

[Test ciblé](../../tests/audio-coverage-20261122.test.ts) : l'inventaire « fait » couvert par le manifeste ; deux à quatre prises par nouveau son ; calibrage relu depuis le JSON (cible, plafond, empreintes, gains du manifeste) ; aucun son en mode muet ; rafale de vingt alertes et lettres bornée ; clic générique remplacé ; ouvrage achevé une fois et rien sur une annulation (vraie construction) ; arbre abattu une fois (vraie coupe) ; colon à terre et recherche terminée une fois, rien au chargement ni sous anesthésie. `generate-sfx.mjs --dry-run` vérifie chaque prise publiée contre son journal. Dans Chromium (serveur de développement) : les 102 prises se décodent ; dans le vrai client, un bouton des Options joue un seul clic, **Retour** joue la fermeture d'onglet, et **Tutoriel** joue l'apparition de la carte de leçon à la place du clic. Les sons de la partie elle-même (lettres, alertes, ouvrage, arbre…) sont couverts par les tests ci-dessus, pas encore observés dans une partie lancée. Aucune mesure de FPS : les nouveaux sons n'ajoutent ni parcours par image ni nœud permanent ; l'enregistreur ne relit ressources et feux que lorsqu'une coupe travaillée disparaît. Le décodage des 102 prises ajoute environ **20 Mo de PCM flottant** stéréo au chargement audio (comme les autres prises, toutes décodées une fois) ; un chargement à la demande par événement réduirait ce coût s'il gêne. Les 102 fichiers bruts restent à côté des prises calibrées (1,6 Mo), comme en V196, pour que `--dry-run` vérifie la provenance ; le jeu ne les charge pas.


## Sons du jeu (point 20 du chantier des retours)

Point 20 du [chantier des retours](chantier-retours-20261122.md), 23 novembre ; présentation seulement, schéma 376 inchangé : aucun champ de sauvegarde, aucune règle, aucun tirage de simulation. Les sons partent d'événements confirmés que l'enregistreur du Worker (`src/bridge/audio-cues.ts`) lit déjà, ou d'horloges de présentation sans hasard de simulation. Les tables (Core → son d'Elsewhere) sont dans [`src/audio/game-sounds.ts`](../../src/audio/game-sounds.ts), avec les classes et définitions Core qu'elles réécrivent.

**État : complet.** Les 111 sons prévus sont câblés aux vrais événements et ont toutes leurs prises : **253 prises publiées**, générées et calibrées en deux passes (la première s'était arrêtée sur le plafond propre de 1 000 crédits de la clé « ElseWhere », relevé ensuite par l'utilisateur). Pour ne pas multiplier la mémoire par deux et demi, les prises ne sont plus toutes décodées au chargement : un jeu chaud est décodé d'avance, le reste à la demande sous un budget (voir « Décodage à la demande »). Reste à faire : l'écoute de l'utilisateur (timbre, confort, jointure des boucles), et les événements plus rares listés sous l'inventaire, encore muets.

Un son plus précis qui manquerait au manifeste retombe toujours sur celui qu'il précise (une chute de bois sur `haul.drop`, un tir de fusil sur `weapon.gunshot`…) ; avec toutes les prises publiées, ce repli ne sert plus qu'à une copie du jeu au manifeste incomplet.

### Inventaire, par fréquence d'écoute

« Avant » : ce que jouait Elsewhere. Tous les sons de la colonne « Après » sont publiés.

| Rang | Moment | Core 1.6 | Avant | Après |
| ---: | --- | --- | --- | --- |
| 1 | Cri spontané d'un animal éveillé (Les Forges : 241 animaux, environ un cri par animal et par minute de jeu) | `soundCall` des étapes de vie, `Pawn_CallTracker` | muet | `animal.call.<famille>`, 14 familles et le poussin |
| 2 | Un animal broute ou mange | `RaceProperties.soundEating` (7 classes) | muet | `animal.eat.<classe>` |
| 3 | Déposer un objet, selon la matière | `ThingDef.soundDrop` : `Wood_Drop`, `Metal_Drop`, `Silver_Drop`, `Stone_Drop`, `ChunkRock_Drop`, `ChunkSlag_Drop`, `Grain_Drop`, `Corpse_Drop` | `haul.drop` partout | `haul.drop-<matière>`, 8 |
| 4 | Construire, selon la matière | `Frame.ConstructionEffect` : `Interact_ConstructWood`, `…Metal`, `…Dirt` | `construction.hit` (marteau sur bois) partout | `construction.metal`, `construction.dirt` ; le bois garde `construction.hit` |
| 5 | Une plante récoltée ou coupée | `JobDriver_PlantWork` → `Harvest_Standard_Finish` | muet | `farming.harvest-finish` |
| 6 | Travail à un établi | `RecipeDef.soundWorking` : `Recipe_Smith`, `…Machining`, `…MakeStoneBlocks`, `…Smelt`, `…Brewing`, `…Drug`, `…Sculpt`, `…MakeBow`, `…Cremate`, `…ButcherCorpseMechanoid` | `crafting.work` partout | `crafting.<établi>`, 10 |
| 7 | Manger, selon l'aliment | `ingestible.ingestSound` : `Meal_Eat`, `RawVegetable_Eat`, `RawMeat_Eat`, `Ingest_Beer`, `Ingest_Pill` | `eating.work` partout | `eating.vegetable`, `.meat`, `.drink`, `.pill` ; les repas gardent `eating.work` |
| 8 | Insectes de la nuit | `BiomeDef.soundsAmbient` → `Ambient_NightInsects_Standard` | muet | boucle `ambient.night-insects` |
| 9 | Vent par temps clair, d'orage ou de tempête de neige | `WeatherDef.ambientSounds` : `Ambient_Wind_Clear`, `Ambient_Wind_Storm` | seulement le bruissement du feuillage | boucles `weather.wind-clear`, `weather.wind-storm` |
| 10 | Cri agressif (animal hostile, qui chasse, riposte ou vient de frapper) | `soundAngry` | muet | `animal.angry.<famille>` |
| 11 | Douleur et mort d'un animal | `soundWounded`, `soundDeath` | 5 espèces et la douleur du renard roux | 14 familles, les voix d'espèce gardées devant |
| 12 | Tir, selon l'arme | `Verb.soundCast` : `Shot_Revolver`, `Shot_AssaultRifle`, `Shot_SniperRifle`, `Shot_Shotgun`, `Shot_HeavySMG`, `Bow_*`, `Shot_IncendiaryLauncher`, `Shot_ChargeRifle`, `Shot_NeedleGun` | un seul `weapon.gunshot` (revolver), même pour les arcs | `weapon.shot-<groupe>`, 9 |
| 13 | Coup au corps à corps, selon l'arme, l'issue et le corps | `MeleeHit_Metal_Sharp/Blunt`, `MeleeHit_Wood`, `Pawn_Melee_SmallScratch/BigBash_HitPawn`, `Pawn_Melee_Mechanoid*`, `*_Miss`, `Pawn_MeleeDodge` | un seul `weapon.melee` | 7 sons (lame, masse, bois, griffe, charge, mécanoïde, coup manqué) ; les poings gardent `weapon.melee` |
| 14 | Opérer | `Recipe_Surgery` | `medical.tend` | `medical.surgery` |
| 15 | Générateur à carburant, centrale géothermique | `ChemfuelFiredGenerator_Ambience`, `GeothermalPlant_Ambience` | muet | boucles `machine.chemfuel-generator`, `machine.geothermal` |
| 16 | Explosion | `Explosion_Bomb` | prises de l'impact sur barrière | `weapon.explosion` |
| — | Dormir, marcher | aucun son Core | muet | muet (conforme) |

**Pas encore câblés**, par fréquence : coups sur un bâtiment (`Pawn_Melee_Punch_HitBuilding_*`), balles sur métal ou bois (`BulletImpact_Metal`, `…Wood`), bâtiment détruit (`BuildingDestroyed_*`), toit qui s'effondre (`Roof_Collapse`), capsules (`DropPod_Fall`, `…Impact`, `…Open`), piège déclenché (`TrapSpring`), jeux (`HorseshoeImpact`, `PlayBilliards`, `PokerChips`), geyser (`GeyserSpray`), scanner de sol, vent de brouillard et vent désolé des glaces (`Ambient_Wind_Fog`, `…Desolate`), insectes de jungle (le lot reprend les insectes standard dans les biomes tropicaux). L'eau n'a pas de son dans Core : pas de boucle ajoutée.

### Déclencheurs

- **Familles de voix** : Core a 31 voix animales ; Elsewhere en fait 14 familles (chiens et loups, chats, grands félins, ours, bovins, cervidés, équidés, éléphant-rhinocéros-mégaparesseux, sanglier, rongeurs et lièvres, canard, reptiles, insectes géants, singe) plus le poussin. Core partage déjà ses voix de la même façon (`Pawn_Dog_*` pour chiens et loups, `Pawn_Elk_*` pour élan, alpaga et caribou, `Pawn_Boomrat_*` pour boomrat, rat et raton laveur…) ; regrouper davantage est une adaptation déclarée. Les voix d'espèce déjà publiées (lièvre, cerf, muffalo, gazelle, dromadaire, douleur du renard roux) restent devant la famille.
- **Silences de Core gardés** : les renards n'ont aucune voix (sauf la douleur du renard roux, V196) ; autruche, émeu, casoar et dindon adultes sont muets ; couguar, lynx et panthère n'ont pas de cri spontané.
- **Étape de vie** (`LifeStageUtility.PlayNearestLifestageSound`) : l'étape courante ou la suivante qui a un son, jouée au rapport des `voxPitch` : petit ×1,6 en hauteur et ×0,8 en volume (larve d'insecte ×0,4), jeune ×1,2 ; les petits des oiseaux pépient (`Pawn_Chick_Call`), le jeune canard a la voix adulte plus aiguë. La hauteur voyage dans le nouveau champ facultatif `pitch` du signal (accepté par le validateur strict des phases entre 0,25 et 4).
- **Cris spontanés** (`Pawn_CallTracker`) : intervalle de 2 000 à 4 000 ticks Core (`soundCallIntervalRange` par défaut, aucune espèce ne le change), un quart de cet intervalle et la voix agressive quand l'animal est hostile, chasse, riposte ou a frappé depuis moins de 360 ticks ; la moitié des coups avance le cri de 0 à 20 ticks (`Notify_DidMeleeAttack`). Pas de cri endormi, à terre, sous le brouillard ni au chargement. Le tirage de Core devient une empreinte de présentation (identifiant de l'animal, numéro du cri) : aucune graine de simulation n'est lue. À ×6, les cris spontanés jouent au quart du volume (`IdleCallVolumeFactor`), les cris agressifs non.
- **Repas des animaux** : tant que l'animal mange vraiment (état `eating` et progression du repas), un contact toutes les 6 à 10 ticks.
- **Chute d'un objet** : la matière du tas porté est lue une fois, quand le colon le prend en main ; un meuble emballé garde la chute ordinaire. **Construction** : le bois (et un ouvrage sans matériau, que la simulation lit comme du bois) garde le marteau ; tout autre matériau sonne métal ; un sol en planches sonne bois, en acier ou stérile métal, les autres sols et la tombe terre (dalles de pierre comprises : `FloorBase` de Core).
- **Récolte finie** : un travail de récolte ou de coupe déjà travaillé disparaît et sa plante n'est plus là ou a perdu sa croissance (une annulation laisse la plante mûre) ; la plante est lue par la carte des cases que la simulation tient déjà (`resourceAt`).
- **Armes** : le tir lit l'arme du projectile (`weaponItem`), ou celle du tireur si le projectile est déjà parti ; le grand arc joue l'arc plus grave, l'arc court plus aigu. La tourelle garde `weapon.gunshot`. Le coup lit, sur le frappeur, l'issue (coup manqué ou esquivé : un souffle), l'arme équipée (bois, masse ou lame), la taille de l'animal (`soundMeleeHitPawn` de la race : charge ou griffe) ou le mécanoïde.
- **Boucles** : insectes selon les courbes de `Ambient_NightInsects_Standard` (pleine voix de 22 h à 1 h 45, nulle de 3 h 45 à 19 h, entre les deux en rampe ; nulle à 0 °C, pleine à 5 °C) et la hauteur de caméra ; vent de temps clair (aussi par brouillard et neige légère) ou d'orage et de tempête de neige ; générateur à carburant qui produit, centrale géothermique allumée. Comme la pluie, une voix par boucle, recalculée à l'adoption d'un instantané ou au déplacement de la caméra, jamais par image. Le fondu de ces ambiances sous la musique (`MusicPlayingFadeOut` de Core) n'est pas repris.

### Limites de voix

Une colonie chargée ne doit pas devenir du bruit. En plus des plafonds existants (24 voix, 12 sons nouveaux par image, groupes de 3 voix par zone de 5 cases), le lecteur borne par groupe : **2 voix** pour les repas des animaux et pour les repas des colons, **3** pour les cris d'animaux, les chutes d'objets, la construction et les établis. Les tirs et les explosions passent en tête de la sélection, avec le coup de feu existant ; les coups au corps à corps avec les impacts.

### Calibrage

`calibrate-sfx.py` reçoit la famille de chaque son par le plan (`calibrationFamily`) ; les cibles sont posées contre les familles déjà publiées qu'elles rejoignent (mesures du manifeste : coups de travail V165 entre −33 et −37 dBFS efficaces, cris de douleur vers −25 à −35, impacts V175 vers −26 à −30, pluie et vent vers −41, générateur vers −38). Pas d'étagère sur ces sons (elle reste aux sons d'interface). Une boucle n'est ni coupée, ni fondue, ni réencodée (sa jointure casserait) : elle est seulement mesurée et reçoit son gain.

| Famille | Cible RMS | Plafond de crête | Sons | Prises | RMS efficace obtenu |
| --- | ---: | ---: | --- | ---: | --- |
| `work` | −32 dBFS | −10 dBFS | chutes, construction, établis, chirurgie, récolte finie, repas des colons | 62 | −32,0 à −37,2 |
| `voice` | −29 dBFS | −8 dBFS | cris, cris agressifs, douleur et mort des animaux | 126 | −29,0 à −33,0 |
| `graze` | −35 dBFS | −14 dBFS | repas des animaux | 14 | −35,0 à −43,4 |
| `combat` | −28 dBFS | −6 dBFS | tirs et coups | 39 | −28,0 à −29,8 |
| `world` | −23 dBFS | −4 dBFS | explosion | 2 | −23,0 |
| `ambience` / `ambience-soft` | −44 / −48 dBFS | −18 / −22 dBFS | insectes, vent d'orage / vent de temps clair | 4 / 2 | −44,0 / −48,0 |
| `machine` | −38 dBFS | −16 dBFS | générateur à carburant, centrale géothermique | 4 | −38,0 |

Mesures dans [pcm-balance-g1122.json](../../scripts/audio/pcm-balance-g1122.json). Les prises sous leur cible sont celles qu'un pic bref aurait fait dépasser le plafond de crête (un coup sec, une mastication) : le plafond l'emporte, comme pour les lots précédents. Aucun écrêtage ; `check-sfx.py` passe sur les 253 fichiers publiés (aucun silence, aucun écrêtage). **Six prises refusées** après mesure, presque silencieuses (RMS actif −46 à −52 dBFS, crête −28 à −35) : la première de la taille de pierre, la première du fusil à aiguilles, la troisième chute de grain et trois prises du tir automatique ; chacune a été remplacée par une nouvelle prise (le plan de ces quatre sons a gagné autant de prises, et `generate-tag.mjs` ne régénère jamais sous le nom d'une prise refusée). Leurs fichiers sont retirés, leurs entrées gardées dans le journal et dans `rejectedTakes`. **Jointure des boucles** (écart entre le dernier et le premier échantillon, brut) : 0,002 à 0,05 pour la plupart, mais 0,21 sur la première prise de la centrale géothermique et 0,15 sur la deuxième des insectes ; après le gain de calibrage cela reste très faible, mais une jointure s'écoute. Ces calculs ne prouvent ni le confort ni le timbre : l'oreille tranche.

### Génération

Plan : 111 sons, 254 prises au départ (3 pour les cris, les chutes, la construction et la plupart des tirs, 2 pour le reste), 259 après les remplacements des six prises refusées. Prompts dans le style chaud et tactile du 22 novembre (« warm cozy colony game, gentle and tactile… not harsh or cartoonish… no retro synth ») ; les tirs « readable but never harsh or piercing ». Le premier prompt des tirs automatiques demandait une rafale de trois coups : corrigé avant toute génération en un seul coup, puisque Core joue le son à chaque balle.

| | Valeur |
| --- | --- |
| Prises générées | 259 : 253 publiées, 6 refusées |
| Crédits facturés (journal, 10 crédits par seconde demandée, en-tête `character-cost`) | **3 349** pour ce lot : 179 à la première passe, 3 170 à la seconde, sous un plafond de passe de 8 000 |
| Compteur de la clé pendant la seconde passe | 3 955 → 7 276 (+3 321) ; l'écart de 151 crédits avec le journal n'est pas expliqué (requête facturée sans prise rendue, ou autre usage de la clé) |
| Total de la couverture audio des 22 et 23 novembre | **4 198** crédits au journal (849 pour l'interface et les alertes, 3 349 pour les sons du jeu) |

Commandes, à relancer pour un lot futur :

```
node scripts/audio/generate-tag.mjs --tag g1122 --max-credits 8000
python scripts/audio/calibrate-sfx.py --tag g1122 --min-takes 2 --replace --write --balance scripts/audio/pcm-balance-g1122.json
```

`generate-tag.mjs` enchaîne les prises manquantes d'un lot en appelant `generate-sfx.mjs --generate` pour chacune, une par une (le journal est réécrit à chaque prise), saute celles déjà journalisées (publiées ou refusées) et s'arrête au premier refus ou au plafond `--max-credits`. `calibrate-sfx.py` calibre toutes les prises du lot et remplace ses entrées du manifeste ; relancé sans nouvelle prise, il redonne le même manifeste à l'octet. `generate-sfx.mjs --dry-run` vérifie chaque prise publiée contre son journal.

### Décodage à la demande

Web Audio ne joue qu'une prise décodée : du PCM flottant, environ 384 Ko par seconde en stéréo à 48 kHz, vingt fois son MP3. Jusqu'ici le lecteur décodait **toutes** les prises au chargement audio : 81 Mo avant ce lot, **193 Mo** avec ses 253 prises. Désormais ([`src/audio/decoded-cache.ts`](../../src/audio/decoded-cache.ts)) :

- **Jeu chaud, décodé au chargement** : tous les sons d'interface (gestes, lettres, alertes, tutoriel : les sons non spatiaux, hors tonnerre) et les contacts du monde les plus fréquents (minage, construction au marteau, prise et dépôt d'un objet, semis, récolte, repas, portes) ; 43 sons, 136 prises, **31,4 Mo**. La première prise de chacun est épinglée (9,8 Mo) et ne quitte jamais la mémoire : un geste de l'interface répond toujours dans son image.
- **Tout le reste à son premier besoin** : la prise est téléchargée et décodée hors de l'image (`fetch` et `decodeAudioData` sont asynchrones, trois à la fois), puis gardée dans un cache borné.
- **Budget de 32 Mio** (33,5 Mo). Il contient le jeu chaud entier, puis fait de la place à mesure que la partie en demande : seules les premières prises sont épinglées, il reste donc au moins 22 Mo pour les boucles qui sonnent ensemble (quatre lits de 3 à 4 Mo : insectes, vent, deux machines) et les contacts entendus récemment. Les 24 Mo évoqués au départ ne laisseraient presque rien aux sons du monde une fois les boucles et les prises épinglées en place : ils se décoderaient sans cesse.
- **Éviction** : la prise la moins récemment jouée part d'abord ; jamais une prise épinglée ni celle qui vient d'être décodée ; une prise qui sonne ne part qu'en dernier recours, et continue alors de jouer (son nœud la tient jusqu'à la fin) avant d'être redécodée à son prochain besoin. Un son joué avec moins de prises décodées que prévu (seconde prise évincée) les récupère quand le cache est sous 75 % du budget.
- **Premier déclenchement d'un son froid : retardé, jamais bloquant.** Le signal attend dans une file (16 au plus) et joue dès que sa prise est décodée, en retard du temps de décodage (une à quelques images) ; s'il n'est pas prêt après **0,25 s** d'horloge audio (un contact du monde ne correspondrait plus au geste) il est **abandonné** ; une lettre ou une alerte froide attend jusqu'à **1 s**. Une pause ou un onglet caché vide la file du monde. Une **boucle** est demandée quand son lit doit commencer, et démarre dès qu'elle est décodée.
- **Échecs** : une prise chaude qui a échoué est retentée par l'essai du son (Options), les autres sont simplement redemandées à leur prochain besoin.

### Performances

**Enregistreur du Worker** (appelé à chaque macro-tick). Banc dédié sur Les Forges (80 colons, 241 animaux, 1 778 tas, 21 122 plantes), ancien et nouvel enregistreur alternés sur le même monde pendant 400 ticks de vraie simulation (`tsx`, machine partagée) : par appel, **moyenne 1,48 → 1,60 ms** (+0,12 ms), **médiane 1,09 → 1,15 ms**, **p95 3,84 → 3,87 ms**, soit environ 0,2 % d'un macro-tick de Les Forges ; 2 348 → 2 729 signaux (231 cris d'animaux, 125 récoltes finies, 25 repas d'animaux de plus). Une première version construisait un index des 21 122 plantes à chaque récolte finie (+7 ms aux pics) ; elle lit maintenant la carte des cases déjà tenue par la simulation, et la recherche du tas porté ne construit plus d'index.

**Mémoire et lecteur, avant et après le décodage à la demande.** Banc : les signaux de 1 800 macro-ticks de vraie simulation de Les Forges (5 minutes à ×1, 12 092 signaux, avec les boucles que le client construit à chaque instantané) rejoués image par image (10 images par tick à 60 images/s) dans le vrai `AudioDirector`, avec un contexte audio factice qui « décode » chaque prise à sa durée réelle (48 kHz stéréo flottant). Deux passes alternées ; les deux versions jouent les mêmes 1 756 sons.

| | Tout décodé (avant) | À la demande (après) |
| --- | ---: | ---: |
| PCM décodé au chargement | 193,2 Mo (488 prises) | **31,4 Mo** (136 prises) |
| Après 5 minutes de Les Forges à ×1 | 193,2 Mo | **33,2 Mo** (97 prises) |
| Maximum observé | 193,2 Mo | 33,55 Mo (le budget) |
| `update()` par image, moyenne (deux passes) | 5,3 / 3,5 µs | 4,5 / 3,4 µs |
| `update()` par image, p95 | 27,5 / 19,5 µs | 16,2 / 13,9 µs |
| `update()` par image, maximum | 1,07 / 2,05 ms | 3,21 / 2,42 ms |

Les maxima sont des images isolées (ramasse-miettes, compilation) dans les deux versions ; ils ne sont pas attribués. Aucun décodage ne se fait dans `update()` : il ne fait que demander la prise et regarder la file.

**Vrai client** (Chrome du panneau intégré, serveur Vite de développement, effets activés à volume 0 et musique coupée, panneau masqué donc aucun chiffre d'images/s) : au menu, après le premier geste, **31 449 808 octets, 136 prises, 43 sons** (la valeur calculée) ; Les Forges chargée en pause, les lits de boucle démarrés : 33,44 Mo, 98 prises ; après 1 845 macro-ticks à ×1 (environ 5 minutes de jeu) : **33,47 Mo, 91 prises, 65 sons au moins en partie décodés**, jamais plus de 33,54 Mo aux relevés (budget 33,55 Mo). L'« avant » n'a pas été rejoué dans le client : il vaut par construction la somme de toutes les prises, 193 Mo.

Côté affichage, pas d'autre coût : aucun parcours par image, une voix par boucle comme la pluie, la résolution d'un son vers son repli seulement pour les signaux dus.

### Écouter

- **Page des sons** (Options → Développeur → Sons et musiques) : « Nouveaux du 22 nov. » montre aussi ces sons, chacun avec la phrase qui dit où l'entendre ; les cris, la douleur et la mort des animaux sont dans « Douleur et mort des humains et des animaux », chutes, établis et repas dans « Travaux », tirs et coups dans « Combat », insectes et vents dans « Météo et ambiance ».
- **En partie** : Les Forges fait entendre presque tout en quelques minutes (cris de 241 animaux, repas, chutes, établis, récoltes, insectes la nuit). Approcher la caméra d'un animal : un cri toutes les 33 à 67 s de jeu à ×1 ; un animal hostile crie quatre fois plus souvent, d'une voix agressive. Le premier contact d'un son rare peut arriver une image ou deux en retard (décodage), ou manquer s'il tarde plus de 0,25 s.

### Ce qui reste

- **Écoute de l'utilisateur** : timbre, confort, équilibre entre familles, et les deux jointures de boucle signalées au calibrage.
- **Événements encore muets** : la liste « Pas encore câblés » de l'inventaire.
- **Fondu des ambiances sous la musique** (`MusicPlayingFadeOut`) non repris.
- **Premier tir d'un raid** : les tirs ne sont pas dans le jeu chaud ; le premier coup d'une arme pas encore entendue peut être en retard ou abandonné. Une amélioration possible : décoder les sons de combat à la lettre de raid.

### Vérification

[Test ciblé](../../tests/audio-game-sounds-20261122.test.ts), 20 cas, tous verts : chaque espèce, étape et verbe donne un son du lot, une voix publiée ou le silence de Core ; silences et hauteurs de Core ; le validateur des phases accepte chaque son du lot avec sa hauteur et refuse l'inconnu ; chaque son prévu a son plan et toutes ses prises publiées (prises demandées moins prises refusées), ses fichiers et sa portée ; chaque son qui en précise un autre garde un repli publié ; calibrage relu depuis le JSON (cible, plafond, empreintes, gains du manifeste) ; sur de vrais événements : cris aux intervalles de Core et jamais endormi, sous le brouillard ou au chargement, cris agressifs quatre fois plus fréquents avec la voix d'un petit, repas d'un animal, mur d'acier construit (son métal, chute d'acier, un seul ouvrage achevé), chutes par matière, repas par aliment, tirs par arme, coup manqué, charge d'un ours, récolte finie une fois et rien pour une annulation, boucles d'ambiance et de machine ; lecteur muet : rien ne joue ; troupeau, chœur de cris et repas bornés ; repli sur la chute ordinaire, voix de petit plus aiguë, cri spontané au quart du volume à ×6 ; **décodage** : seul le jeu chaud est téléchargé au chargement, une prise froide n'est décodée qu'une fois, son premier signal joue en retard sans bloquer l'image et un signal trop tard est abandonné, le cache ne dépasse jamais son budget en gardant les prises épinglées et en évinçant la moins récente, et le cache seul (prises qui sonnent évincées en dernier, échec de décodage mémorisé sans coût).

Six anciens oracles de `bridge-audio-cues.test.ts` (quatre établis, la cadence de la taille de pierre, la chute de bois) attendent désormais le son de Core. Dans `audio-v149.test.ts`, cinq cas qui utilisaient `cooking.work` (un son froid désormais) pour éprouver les prises bloquées et la reprise de l'essai utilisent `door.open`, du jeu chaud, et le cas des treize décodages concurrents utilise des sons d'interface : leurs intentions sont inchangées. `developer-pages-sounds.test.ts` compte aussi les sons du jeu publiés parmi les « nouveaux » et lit leurs mesures dans `pcm-balance-g1122.json`. Voisins audio relancés (15 fichiers) : 184 cas verts ; les 57 échecs restants sont tous dans la liste des échecs connus (`audio-pain-v196`, `actor-frontier-runtime-v492`, `audio-coverage-v175`, un de `bridge-audio-cues`), et `native-phase-capture297` refuse de se charger sur l'empreinte figée de `core-phase-data-297.ts`, déjà périmée sur `origin/main` avant ce lot.
