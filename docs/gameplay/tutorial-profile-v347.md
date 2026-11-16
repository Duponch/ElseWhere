# Partie tutoriel : profil, règles et contenu imposé — schéma 347

Schéma 347. Premier des deux lots du tutoriel de RimWorld 1.6 (« Apprendre à jouer ») : ce lot livre ce que les 37 leçons demandent au jeu. Les leçons elles-mêmes, le verrouillage des actions et les indications à l'écran viendront au lot suivant. L'audit de l'accueil du nouveau joueur (section 1 et lot 7 proposé) décrit le tutoriel du jeu de base.

Sources : définitions Core (`Storytellers.xml`, `Difficulties.xml`, `Scenarios_Classic.xml`, `Tutor/Instructions.xml`, `PawnKinds_Pirate.xml`, `Buildings_Natural.xml`) et code décompilé (MainMenuDrawer.InitLearnToPlay, TutorSystem, TutorialState, Lesson_Instruction, Instruction_MineSteel, Instruction_DownRaider, TutorUtility.FindUsableRect, StorytellerUI, Storyteller.Notify_DefChanged, PawnGroupKindWorker_Normal, Pawn_HealthTracker et les vérifications de `TutorSystem.TutorialMode` citées plus bas). Aucun code ni texte n'en est repris.

## Lancer le tutoriel

Le bouton **Tutoriel** de l'accueil est actif (ligne « Apprendre à jouer », au-dessus de « Nouvelle partie », comme l'entrée du jeu de base). Comme InitLearnToPlay, il saute les pages du scénario et du narrateur : on passe directement aux paramètres du monde, puis au lieu de départ et au choix des colons. Le retour depuis le monde ramène à l'accueil.

La partie créée est un vrai départ Atterrissage forcé sur la planète générée, avec :

- **le scénario Tutoriel** : enfant d'Atterrissage forcé, plus une seule pièce, 300 tissus éparpillés près du point de départ (ScenPart_ScatterThingsNearPlayerStart). Ils sont tirés après les pièces héritées, sur le même flux de génération, et interdits comme les autres objets de départ ;
- **le narrateur Tuteur** : caché de la liste, sans aucun composant de narration, donc sans incident ; alertes et mort définitive désactivées ;
- **la difficulté imposée Bâtisseur de communauté** (Easy) ;
- les deux effets de génération propres au tutoriel déjà présents dans Elsewhere : météo initiale dégagée et aucun filon de minerai pendant la génération de la carte (GenStep_ScatterLumpsMineable ne place rien en mode tutoriel ; les tirages de position restent consommés).

Comme la page des colons du jeu de base en mode tutoriel, le départ refuse une équipe dont un colon est incapable de violence : le message nomme la personne à remplacer. La création refuse aussi ce cas dans la simulation.

L'assistant d'apprentissage reste actif pendant ce lot. Le jeu de base l'éteint pendant le tutoriel (disableAdaptiveTraining), mais seulement parce que les leçons prennent le relais ; elles n'existent pas encore ici.

## Ce que fait le Tuteur

Aucun incident n'est tiré tant que le Tuteur raconte l'histoire :

- le calendrier des raids de Cassandra existe dès la création (il porte le raid du tutoriel), mais chaque occasion échue est consommée sans être tirée, comme un composant absent ;
- les calendriers des maladies, des incidents divers, des petits incidents, des incidents mondiaux et des visiteurs ne naissent pas ; aucun vaisseau orbital, aucune demande d'asile, aucune rencontre de caravane ;
- les alertes de droite restent vides (disableAlerts).

## Les règles du mode tutoriel

Chaque règle reprend une vérification `TutorSystem.TutorialMode` du jeu de base :

| Règle | Jeu de base | Elsewhere |
|---|---|---|
| Aucune crise mentale ni état mental pour les pions du joueur | MentalBreakWorker.BreakCanOccur, MentalStateHandler.TryStartMentalState | les seuils restent suivis, aucune crise n'est choisie ni tirée ; tous les démarrages de crise refusent un colon libre (un prisonnier n'est pas du joueur) |
| Aucune bagarre | Pawn_InteractionsTracker.CheckSocialFightStart (avant le tirage) | refus avant le tirage |
| Aucune tentative de romance | InteractionWorker_RomanceAttempt (poids 0) | poids 0 |
| Aucun échec de construction | JobDriver_ConstructFinishFrame (pas de tirage) | pas de tirage pour le mur en bois, seule construction dont l'échec est modélisé |
| Météo toujours dégagée | WeatherDecider.ChooseNextWeather | Dégagé choisi sans tirage, la durée reste tirée |
| Les pillards ne volent pas | Trigger_HighValueThingsAround | les raids d'Elsewhere n'ont pas encore de phase de vol : rien à couper |
| Les prédateurs ne chassent pas les pions du joueur | FoodUtility (prédation) | les prédateurs d'Elsewhere ne chassent que des animaux, jamais un colon ; pendant le tutoriel, ils ne chassent pas non plus les animaux de la colonie (ajouté à l'intégration, avec le lot 348) |

## Valeurs de la difficulté Bâtisseur de communauté

Les valeurs que la simulation lit déjà (Récit d'aventure jusqu'ici) passent par une table de difficulté :

| Valeur | Récit d'aventure | Bâtisseur de communauté |
|---|---|---|
| Humeur des colons | +5 | +10 |
| Infection des blessures des colons | × 0,75 | × 0,5 |
| Intoxication alimentaire | × 0,75 | × 0,5 |
| Mort à terre d'un humain hors colonie | × 1 | × 0,9 |
| Vitesse de recherche | × 1 | × 1,2 |
| Récoltes et bois | × 1 | × 1,2 |
| Rendement des minerais | × 1 | arrondi de × 1,2 (40 → 48) |
| Croissance de l'adaptation aux menaces | × 0,75 | × 0,25 |
| Reproduction des ruches à la génération | 0,5 | 0,15 |
| Pourriture d'un animal mort de la scarie | 0,333 | 0 |

Les valeurs de Récit d'aventure sont inchangées.

## Le contenu imposé

Le jeu de base donne ce contenu à l'activation de la leçon qui en a besoin. Ici, trois commandes ordinaires le donnent, une fois chacune, seulement pendant le tutoriel ; le lot des leçons les enverra :

- **`tutorial-potatoes`** (leçon AddBillSimpleMeal) : 75 pommes de terre crues, autorisées, au centre d'un rectangle libre de 2 × 2 cases trouvé près du centre de la carte ;
- **`tutorial-steel-lump`** (leçon MineSteel) : un filon d'acier compacté de 30 à 40 cases grandi autour du centre d'un rectangle libre de 10 × 10 cases sans objet ; les plantes recouvertes disparaissent sans récolte ; les cases se minent normalement ;
- **`tutorial-raid`** (leçon DownRaider) : un raid au budget d'un vagabond (35 points), donc d'une faction de pirates, qui arrive à pied au bord de la carte et attaque aussitôt, sans regroupement. Son assaillant unique est **mis à terre forcée** : quand il tombe, il n'est jamais tué par le tirage de mort à terre et ne fuit pas seul.

Le rectangle libre suit TutorUtility.FindUsableRect : un rectangle tiré autour du centre avec un écart qui grandit de 0,25 case à chaque essai, dont toutes les cases (et la bordure d'une case) sont découvertes, praticables, constructibles en lourd, assez fertiles, hors de toute zone, sans bâtiment ni plan (ni objet si demandé) et à plus de 10 cases du bord. Il est exporté pour les leçons du lot suivant (pièce, réserve, champ, sacs de sable).

## La fin du tutoriel : choisir le narrateur

La commande **`choose-storyteller`** (leçon ChooseStoryteller) remplace le Tuteur par le narrateur et la difficulté choisis et clôt le tutoriel (date de fin enregistrée, comme TutorialState.endTick). Elsewhere ne propose que **Cassandra Classique en Récit d'aventure**. Le Menu de la partie offre ce choix pendant le tutoriel (« Narrateur : Tuteur »), comme le bouton des réglages du narrateur du jeu de base.

Comme Storyteller.Notify_DefChanged, les composants du nouveau narrateur partent du moment présent, sur leur calendrier en temps absolu :

- le calendrier des raids continue : le raid d'introduction du jour 5,4 a lieu si le tutoriel finit avant, sinon il est passé ; ce raid d'introduction a lui aussi un seul assaillant mis à terre forcée ;
- les calendriers des maladies et des visiteurs naissent à cet instant, sans rattraper les occasions passées ; la visite d'introduction du jour 2,5 reste prévue si elle est encore à venir ;
- les incidents divers, petits incidents et incidents mondiaux sont adoptés au tick suivant, comme pour une ancienne sauvegarde.

La partie redevient une partie normale : alertes, crises, bagarres, romances, échecs de construction et météo ordinaires.

## Sauvegarde

- Le profil de la partie (`gameProfile`) accepte, à partir de 347 seulement, deux formes de plus : le Tuteur en Bâtisseur de communauté avec un dossier `tutorial347`, puis Cassandra en Récit d'aventure avec ce dossier clos (`endedAtCore`). Le dossier ne garde que des ticks Core : contenus donnés (`potatoesAtCore`, `steelLumpAtCore`, `raidAtCore`) et fin ; aucune clé inconnue, aucune date future ; une partie du Tuteur n'a aucun calendrier d'incident.
- Un groupe de raid peut porter `forcedDowned347`, l'identifiant de son premier membre, seulement dans une partie commencée en tutoriel.
- Une partie normale ne change pas : même profil, mêmes calendriers, aucun nouveau champ, mêmes tirages.
- Migration 346 → 347 par le seul numéro ; une sauvegarde plus ancienne garde son profil. Un profil tutoriel avant 347 est refusé.

## Adaptations et limites

- **Narrateurs** : Elsewhere n'offre que Cassandra en Récit d'aventure ; le changement de narrateur n'est proposé que pour finir le tutoriel (le jeu de base le permet à tout moment).
- **Contenu imposé** : les pommes de terre vont sur la case visée ou, si une autre pile l'occupe, sur la plus proche qui a de la place (une pile par case). Le filon évite les cases occupées par une personne, un animal, un travail, un sol posé ou une ressource qui n'est pas une plante, au lieu de les déplacer ; sa forme suit le tirage de lump existant sur un flux privé. Le flux de tirage est celui de la partie, pas celui du jeu de base.
- **Prédateurs** : le filtre qui épargne les animaux de la colonie pendant le tutoriel a été ajouté à l'intégration, avec le lot 348 (`animalPreyCandidates`, test `tests/tutorial-wildlife-348.test.ts`). Les colons ne sont jamais des proies.
- **États mentaux** : la confusion d'un colon atteint de démence (épisode clinique) n'est pas encore bloquée ; les animaux de la colonie ne sont pas couverts.
- **Scarie** : à l'intégration, avec le lot 348, les deux lecteurs (`animal-scaria-261.ts`, `wildlife-health.ts`) passent à la table de difficulté : en Bâtisseur de communauté, la chance de pourriture est 0 et ne consomme aucun tirage.
- **Cartes temporaires** : camps, champs de bataille de caravane et informations sur un cœur d'IA restent refusés pendant le tutoriel (ils attendent le profil Récit d'aventure).
- **Assaillant dégâts jusqu'à terre** : la leçon DownRaider met aussi tous les ennemis à terre si un colon tombe ; cette aide appartient à la leçon et viendra avec elle.
- Les leçons, leur ordre, leurs textes, le verrouillage des actions, les objets de départ suivis et le compagnon animal du scénario ne sont pas dans ce lot.

## Vérifications

`tests/tutorial-profile-347.test.ts` : une vraie création géographique en tutoriel et une normale à partir de la même planète ; profil, tissu, météo, valeurs Easy ; six jours sans incident ; contenu imposé donné une fois, filon minable, raid d'un pirate à pied au bord de la carte, assaillant mis à terre sans mourir ; passage à Cassandra et calendriers nés ; règles (crise, bagarre, romance, échec de mur, météo) ; partie normale inchangée ; migration 346 → 347 et refus des dossiers malformés.
