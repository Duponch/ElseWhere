# Assistant d’apprentissage (interface)

Lot d’interface, sans changement de schéma. Rien n’est écrit dans le monde, la sauvegarde ou la simulation, et aucun tirage aléatoire n’est fait : l’assistant lit les instantanés déjà confirmés et adoptés par l’interface, ainsi que les commandes acceptées et les gestes du joueur. Sa mémoire appartient au navigateur.

Il reprend l’aide adaptative du jeu de base (« learning helper ») : des **notions** sur les commandes et les règles apparaissent au moment utile, et disparaissent quand le joueur montre qu’il les connaît ou clique **Compris**.

## Ce qui change pour le joueur

- **Notions dans la carte Conseils.** En haut de la carte de conseils (en bas à gauche), la rubrique **Notions à découvrir** liste les notions proposées : titre, texte et bouton **Compris**. Le survol d’une notion redonne son texte complet et sa progression (« Acquis à 40 % »). Les premiers gestes et les huit préparations des premiers jours restent en dessous. Sur une colonne courte, le texte se raccourcit, puis seuls les titres et **Compris** restent ; repliée, la carte affiche « Conseils · 2 notions à lire ».
- **Quand une notion apparaît.** Les notions de base (caméra, vitesse, pause, réserves…) viennent d’elles-mêmes, par ordre d’importance et espacées dans le temps ; d’autres attendent l’occasion : une attaque, un blessé, un incendie, un poste de production construit, un marchand arrivé… Les plus urgentes s’affichent aussitôt. Au plus trois notions viennent d’elles-mêmes à la fois ; une occasion importante ou critique peut en ajouter.
- **La carte s’ouvre pour une nouvelle notion**, même repliée ou fermée, comme le panneau du jeu de base. Pour ne plus rien voir, désactivez l’assistant dans les Options. Pendant la descente des capsules, la carte attend leur ouverture.
- **Apprendre en jouant.** Les vrais gestes comptent : déplacer la caméra, zoomer, mettre en pause, tracer une réserve, mobiliser, secourir, régler Travail, survoler une alerte, ouvrir les factures d’un poste, maintenir Alt sur une case… Une notion bien pratiquée quitte la liste d’elle-même. Ce que l’on n’a pas pratiqué depuis longtemps s’oublie très lentement.
- **Options → Jeu.** **Assistant d’apprentissage** l’active ou le désactive (activé par défaut). **Notions apprises → Réinitialiser l’assistant** demande confirmation puis oublie toutes les notions ; le parcours des premiers gestes n’est pas touché. Ces deux réglages sont aussi accessibles en partie, depuis les Options du Menu.
- **Trois messages uniques**, affichés une seule fois par navigateur, même assistant désactivé : en ouvrant le commerce orbital (biens près des balises), en demandant d’actionner un appareil (un colon doit s’y rendre), en portant au-delà de 1 le nombre maximal de colonies dans les Options.
- **Mémoire.** Les connaissances sont gardées par ce navigateur, pour toutes vos colonies (clé `elsewhere.learning.helper.v1`, à côté de `elsewhere.learning.first-gestures.v1`). À la première ouverture, les quatre premiers gestes déjà repérés comptent comme appris : Répartir le travail, Réserves, Couchages et Cultures. Exporter une colonie n’exporte pas ces connaissances.

## Règles (RimWorld 1.6, Core)

Faits relevés dans le code décompilé (`LessonAutoActivator`, `LearningReadout`, `PlayerKnowledgeDatabase`, `ConceptDef`, `TutorUtility`, `TimeControls`, `Pawn_HealthTracker`, `GenHostility`, `Dialog_Options`, `FlickUtility`, `TradeShip`) et dans `Data/Core/Defs/Tutor/Concepts_*.xml` :

- **Connaissance** de 0 à 1 par notion, propre au joueur et partagée par toutes ses parties (`Config/Knowledge.xml`). Une notion est apprise au-delà de 0,999 ; elle quitte alors la liste.
- **Désir** = (priorité + occasion × 0,6) × (1 − connaissance) ; nul pour une notion apprise, déjà affichée, ou qui attend une occasion inférieure à 0,1.
- **Occasions** : 60 (bon à savoir), 80 (important), 100 (critique). Elles baissent de 0,4 par seconde réelle, sauf pour Factures et Étagères ; une occasion « bon à savoir » dure donc 150 s.
- **Oubli** : 0,00015 par seconde réelle pour toute notion non apprise (environ 0,54 par heure).
- **Vérification** tous les 15 images : oubli, baisse des occasions, puis, s’il y a moins de **3** notions affichées, choix de la plus désirée parmi celles dont la connaissance ne dépasse pas **0,15** ; elle s’affiche si son désir dépasse 0,1 et si **100 − t/9** est inférieur à ce désir, *t* étant le temps réel depuis la dernière notion affichée (départ à 10 000 s). Avec trois notions affichées, *t* revient à zéro à chaque vérification.
- **Délai de grâce** : rien n’est choisi pendant **8 s** après le chargement d’une partie ni pendant 8 s après la fermeture de la fenêtre de début de partie, ni tant que le **Menu** est ouvert. La pause n’arrête pas l’assistant.
- **Occasion importante ou critique** : la notion s’affiche aussitôt, sans délai ni plafond ni seuil de 0,15 ; une occasion « bon à savoir » l’affiche aussitôt s’il y a moins de 4 notions.
- **Démonstrations** : affiché pendant une image +0,004, interaction par image +0,008, petite +0,03, courte +0,1, précise +0,4, complète +1. Elles comptent même assistant désactivé. **Marquer comme appris** met la connaissance à 1.
- **Notions modales** (priorité −1000) : un message unique, montré si la notion n’est pas apprise puis aussitôt marqué appris, même assistant désactivé ; elles n’entrent jamais dans la liste.
- **Options → Jeu** : case « Assistant d’apprentissage » (vrai par défaut) et « Réinitialiser l’assistant », qui efface `Knowledge.xml`.

## Notions

49 notions affichables et 3 messages uniques, écrits pour Elsewhere (aucun texte repris du jeu de base). Groupe, priorité et baisse des occasions sont ceux du jeu de base ; l’ordre de définition, qui départage deux désirs égaux, aussi. Les textes sont dans `src/ui/learning-concepts.ts`, les déclencheurs dans `src/ui/learning-triggers.ts`.

### Occasions (priorité 50, attendent une occasion)

| Notion | Concept Core | Occasion dans Elsewhere | Démonstration |
|---|---|---|---|
| Repartir d’une carte lointaine | ReformCaravan | Important : un colon à terre ou mort hors du foyer, sans raid ni animal en rage, avec un colon valide | groupe de voyage lancé hors du foyer (complète) |
| Secourir un blessé | Rescuing | Critique : un colon tombe à terre | ordre Secourir (complète) |
| Capturer un ennemi | Capturing | Important : un pillard tombe à terre | ordre Capturer (complète) |
| Commercer | InteractingWithTraders | Important : un marchand visiteur attend à son emplacement | ordre de commerce (complète) |
| Mobiliser | Drafting | Critique : un groupe de raid passe à l’assaut (fin du regroupement) | Mobiliser (précise) |
| Balise de commerce orbital | BuildOrbitalTradeBeacon | Bon à savoir : une console de communication construite ; critique : ouverture du commerce orbital | balise posée (complète) |
| Animaux en rage et portes | AnimalsDontAttackDoors | Critique : un animal entre en rage | — (Compris) |
| Factures de production | BillsTab (ne baisse pas) | Bon à savoir : un des 19 postes de production du jeu de base construit | page Factures affichée (par image) |
| Console de communication | OpeningComms | Bon à savoir : une console construite | contacter une faction ou un marchand orbital (complète) |
| Dépendance | DrugAddiction | Important : un colon ou un prisonnier devient dépendant à l’alcool | — (Compris) |
| Politiques de drogues | DrugPolicies | Bon à savoir : de la bière ou un médicament rangé en réserve | toute commande de politique de drogues (complète) |
| Prisonniers | PrisonerTab | Bon à savoir : un nouveau prisonnier détenu | onglet Prisonnier affiché (par image) |
| Vitesse des portes | DoorOpenSpeed | Important : plan de porte en pierre (vitesse 0,45 < 0,65) | — (Compris) |
| File d’ordres | QueueOrders | Bon à savoir : un colon mobilisé | ordre mis en file avec Maj (complète) |
| Étagères | Shelves (ne baisse pas) | Bon à savoir : des cases de réserve ajoutées | — (Compris) |
| Livres | Books | Bon à savoir : un livre apparaît sur la carte | — (Compris) |

### Notions de base (s’affichent par priorité)

| Notion | Concept Core | Priorité | Démonstration |
|---|---|---|---|
| Déplacer la vue | CameraDolly | 95 | flèches, ZQSD/WASD ou bouton central glissé (par image) |
| Zoomer | CameraZoom | 94 | molette (petite, par cran) |
| Vitesse du temps | TimeControls | 93 | bouton ou touche de vitesse 1, 2, 3 (précise) |
| Mettre en pause | Pause | 92 | Espace ou bouton pause (précise) |
| Réserves | Stockpiles | 40 | réserve tracée sur au moins une case (complète) |
| Interdire et autoriser | Forbidding | 40 | interdire ou autoriser un objet ou un rectangle (précise) |
| Couchages | *Elsewhere* | 38 | couchage, lit ou paillasse posé (complète) |
| Cultures | GrowingFood | 37 | zone de culture ou bac hydroponique (complète) |
| S’équiper d’une arme | EquippingWeapons | 30 — critique à chaque raid | ordre Équiper (complète) |
| Alertes | Alerts | 27 | survol d’une alerte (par image) |
| Miner | Mining | 25 | ordre Miner (précise) |
| Recherche | *Elsewhere* | 21 | projet choisi (complète) |
| Répartir le travail | WorkTab | 20 | priorité réellement changée dans Travail (précise) |
| Interdire une porte | ForbiddingDoors | 15 — critique aux retombées toxiques et aux meutes | porte interdite (précise) |
| Couvert et tir | CoverAndShooting | 13 | — (Compris) |
| Former un groupe de voyage | FormCaravan | 11 — important à l’ouverture de Monde | groupe de voyage lancé (complète) |
| Apprivoiser | AnimalTaming | 10,1 | apprivoisement demandé (complète) |
| Dresser | AnimalTraining | 10 | apprentissage choisi (complète) |
| Fiche d’information | InfoCard | 9 | fiche Information d’une pile ouverte (complète) |
| Réglages de réserve | StorageTab | 7 — bon à savoir à la création d’une réserve | page de réglages de réserve affichée (par image) |
| Zone de foyer | HomeArea | 7 — important à chaque départ de feu | zone de foyer tracée (complète) |
| Pourriture et froid | SpoilageAndFreezers | 6,5 — bon à savoir quand de la nourriture pourrit | — (Compris) |
| Détérioration | Deterioration | 6 | — (Compris) |
| Réaction aux menaces | HostilityResponse | 5 | réaction changée (précise) |
| Zones autorisées | AllowedAreas | 4,5 — critique aux retombées toxiques, important aux meutes | zone créée ou peinte (précise) |
| Opérations | MedicalOperations | 4 | onglet Santé affiché (par image), opération demandée (précise) |
| Planning | TimeAssignments | 3 | plage horaire changée (courte) |
| Inspecter une case | TileInspector | 2 | Alt maintenu (petite, par image) |
| Politiques de tenue | Outfits | 2 | politique attribuée (complète) |
| Prévenir les incendies | FirePreparation | 2 | — (Compris) |
| Historique | HistoryTab | 1 | Historique ouvert (complète) |
| Tirs amis | FriendlyFireSafety | 1 | — (Compris) |

### Messages uniques

| Message | Concept Core | Quand |
|---|---|---|
| Biens près des balises | TradeGoodsMustBeNearBeacon | ouverture du commerce orbital |
| Actionner un appareil | SwitchFlickingDesignation | demande acceptée pour actionner un appareil |
| Plusieurs colonies | MaxNumberOfPlayerSettlements | nombre maximal de colonies porté au-delà de 1 dans les Options |

**Concepts Core non repris**, faute de fonction à enseigner aujourd’hui : ceintures-boucliers, brûler la drogue, info-bulle de précision, déplacement de groupe en ligne, télévision pour les alités, faire venir plus de marchands, cases à cocher de Travail, clic sur les messages, choix de la plante (jamais proposé seul par le jeu de base), arrestation qui crée des ennemis, permis de commerce, déplacement du globe à l’accueil et les deux notes Steam Deck.

## Adaptations

- **Affichage.** Le jeu de base liste les titres en haut à droite et montre le texte au survol, avec « Marquer comme appris » après un clic. Elsewhere place ces notions dans la carte de conseils, en bas à gauche (la droite porte les alertes), avec le texte et **Compris** visibles.
- **Liste affichée.** Le jeu de base la garde dans la sauvegarde de la partie ; Elsewhere ne met rien dans le monde : la liste vit pendant la visite du navigateur et se reconstitue selon les règles après un rechargement. Les connaissances, elles, sont gardées.
- **Ouverture de la carte.** Comme le panneau du jeu de base, visible dès qu’une notion est affichée : une nouvelle notion rouvre la carte repliée ou fermée.
- **Cadence.** Une minuterie de 250 ms remplace le test « toutes les 15 images » ; les démonstrations par image comptent 60 images par seconde réelle.
- **Grâce.** 8 s après la création ou le chargement d’une colonie, et 8 s après l’ouverture des capsules de départ (équivalent de la fenêtre de début de partie). Rien n’est choisi sur l’écran d’accueil, pendant un chargement ou pendant la descente des capsules ; le Menu en partie suspend les vérifications comme dans le jeu de base.
- **Occasions.** Elles se lisent comme des différences entre deux instantanés confirmés de la même colonie. Un monde chargé ou une carte changée sert seulement de point de départ : rien n’est proposé pour ce qui existait déjà.
  - Pourriture : toute nourriture pourrie compte, pas seulement celle d’une réserve (le compteur du monde ne distingue pas le lieu).
  - Meute : deux nouveaux animaux en rage au même relevé déclenchent Interdire une porte et Zones autorisées ; un seul suffit pour Animaux en rage et portes.
  - Prisonnier : un nouveau détenu, plutôt que sa mise au lit.
  - Drogues rangées : bière ou médicament au sol sur une case de réserve ou d’étagère.
  - Marchands : un marchand visiteur à l’arrêt à son emplacement.
  - Commerce orbital : le message unique précède la page de commerce au lieu de la suivre.
- **Démonstrations.** Elles reprennent les gestes du jeu de base quand ils existent ; sinon la commande équivalente : opération demandée (en plus de l’onglet Santé), page de réglages d’une réserve, page Factures d’un poste. Deux notions propres à Elsewhere, **Couchages** (priorité 38) et **Recherche** (21), reprennent les gestes du parcours et du tutoriel du jeu de base qui n’ont pas de concept.
- **Écriture.** Les connaissances sont écrites aussitôt pour un geste marquant, au plus toutes les 30 s pour l’oubli et les petits gestes, et à la fermeture de la page.

- **Pendant le tutoriel** (schéma 349, [les 37 leçons](tutorial-lessons-v349.md)) : comme le Tuteur du jeu de base (`disableAdaptiveTraining`, `TutorSystem.AdaptiveTrainingEnabled`), l'assistant se tait : aucune notion montrée ni ouverte, le minuteur de repos ne court pas ; les démonstrations comptent toujours, et les leçons de notion remettent la leur à zéro à leur départ (`Instruction_LearnConcept`). À la fin du tutoriel, le minuteur repart de zéro (`LessonAutoActivator.Notify_TutorialEnding`).

## Coûts

- Une minuterie de 250 ms. Le monde n’est lu que si un nouvel instantané a été adopté depuis le dernier relevé, et chaque famille d’objets (raids, personnes, bâtiments, piles, animaux) seulement si l’une de ses notions reste à apprendre. Assistant désactivé ou tout appris : aucune lecture du monde.
- Aucun parcours du monde par image. La carte n’est repeinte que si la liste ou la progression (au dixième près) change.
- Mémoire du navigateur : environ 1,5 Ko.
- Aucune mesure d’images par seconde n’a été faite pour ce lot.

## Contrôles

- `tests/learning-helper.test.ts` : 14 cas — calcul du désir à la main, grâce, minuterie de détente, plafond de trois, Menu, occasions critiques et importantes, seuil de 0,15, durée d’une occasion, interrupteur, oubli, démonstrations et **Compris**, message unique, format du navigateur et migration des quatre gestes, Options (désactiver, réinitialiser avec confirmation, message des colonies), raid, colon à terre, pillard à terre et incendie sur un monde avancé par `stepWorld`, commandes et gestes d’interface, liste des notions, carte de conseils.
- Voisins : carte de conseils, premiers gestes, premiers jours, accueil et Options natifs, alertes, HUD et scène natifs. Les échecs relevés sont tous des échecs anciens déjà connus. Typage complet.

## Limites

- Ni la liste complète avec recherche du jeu de base (« tout afficher »), ni le tutoriel ne sont faits. La mise en évidence des commandes concernées est décrite dans [Surbrillance des commandes](native-highlight.md).
- Aucune vérification visuelle dans le navigateur ; les parcours natifs Playwright n’ont pas été rejoués.
- Un texte de notion qui décrit une règle doit être revu quand cette règle change.
