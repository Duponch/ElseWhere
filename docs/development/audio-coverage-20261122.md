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

- **Page de revue** : lancer le serveur de développement (`npm run dev`) puis ouvrir `/sounds-review.html`. Toutes les prises du manifeste, avec leur gain et le facteur de mix du jeu ; « Seulement les nouveaux » (coché par défaut) isole ces 32 sons, chacun avec la phrase qui dit où l'entendre en partie, et « Écouter toutes les prises visibles » les enchaîne.
- **En partie**, à écouter d'abord : les cinq lettres (un raid, une crise, une inspiration), les deux cloches d'alerte, puis les gestes fréquents (ouvrir un onglet, choisir un outil, désigner, poser un plan, changer de vitesse, mobiliser). Ce sont les sons qu'on entend le plus souvent : un timbre agaçant s'y remarque vite.
- Pour retirer une prise jugée mauvaise : supprimer son entrée dans `public/assets/audio/manifest.json` (le jeu choisit parmi les prises restantes).

## Vérification

[Test ciblé](../../tests/audio-coverage-20261122.test.ts) : l'inventaire « fait » couvert par le manifeste ; deux à quatre prises par nouveau son ; calibrage relu depuis le JSON (cible, plafond, empreintes, gains du manifeste) ; aucun son en mode muet ; rafale de vingt alertes et lettres bornée ; clic générique remplacé ; ouvrage achevé une fois et rien sur une annulation (vraie construction) ; arbre abattu une fois (vraie coupe) ; colon à terre et recherche terminée une fois, rien au chargement ni sous anesthésie. `generate-sfx.mjs --dry-run` vérifie chaque prise publiée contre son journal. Dans Chromium (serveur de développement) : les 102 prises se décodent ; dans le vrai client, un bouton des Options joue un seul clic, **Retour** joue la fermeture d'onglet, et **Tutoriel** joue l'apparition de la carte de leçon à la place du clic. Les sons de la partie elle-même (lettres, alertes, ouvrage, arbre…) sont couverts par les tests ci-dessus, pas encore observés dans une partie lancée. Aucune mesure de FPS : les nouveaux sons n'ajoutent ni parcours par image ni nœud permanent ; l'enregistreur ne relit ressources et feux que lorsqu'une coupe travaillée disparaît. Le décodage des 102 prises ajoute environ **20 Mo de PCM flottant** stéréo au chargement audio (comme les autres prises, toutes décodées une fois) ; un chargement à la demande par événement réduirait ce coût s'il gêne. Les 102 fichiers bruts restent à côté des prises calibrées (1,6 Mo), comme en V196, pour que `--dry-run` vérifie la provenance ; le jeu ne les charge pas.
