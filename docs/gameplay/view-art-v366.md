# Admirer une œuvre d'art V366

Les sculptures d'Elsewhere (petite et grande, toutes matières et qualités) embellissaient les pièces sans que personne ne s'arrête pour les regarder. Le lot ajoute le loisir **admirer une œuvre d'art** du jeu de base : un colon qui s'ennuie peut choisir une sculpture, marcher jusqu'à elle, la contempler et en tirer de la joie selon sa beauté et sa qualité. Schéma 366 ; une partie 365 migre par le seul numéro, sans aucun loisir rétroactif.

## Ce que fait le jeu

- Un colon libre, capable de voir et pas encore lassé de la contemplation, peut tirer ce loisir avec la chance de base 1, juste après « observer le ciel » dans l'ordre des loisirs du jeu de base. Contempler le ciel et une œuvre appartiennent à la même famille (**contemplation**, la famille Méditative du jeu de base) : la lassitude de l'un vaut pour l'autre.
- Le colon choisit une sculpture au hasard, pondérée par sa **beauté** (au moins 0,5 : une sculpture affreuse reste choisie, rarement). Une sculpture n'est proposée que si elle appartient à la colonie, n'est pas sous le brouillard, se trouve dans la zone autorisée du colon, n'est regardée par personne d'autre (un seul spectateur à la fois), n'est pas réservée par une déconstruction, et se trouve **sous un toit** — ou bien dehors quand le temps s'y prête : moins de 0,25 de pluie, ni retombées toxiques ni hiver volcanique, et une température extérieure dans la plage de confort du colon.
- Les œuvres d'une **chambre**, d'un **dortoir**, d'une chambre d'hôpital ou d'une cellule ne sont regardées que par le colon dont c'est la pièce : le propriétaire du lit d'une chambre, ou celui d'un dortoir dont il est le seul lit attribué.
- Le colon marche jusqu'à la case voisine de la sculpture la plus proche par le chemin (huit voisines ; une voisine en diagonale n'est utilisable que si l'une des deux cases entre elle et l'œuvre est praticable et sans porte). La marche ne rapporte rien.
- Sur place, il contemple l'œuvre pendant 4 000 ticks du jeu de base (400 ticks d'Elsewhere), ou jusqu'à 100 % de joie. Chaque tick lui rapporte le gain ordinaire des loisirs multiplié par **beauté de l'œuvre ÷ beauté de base de son modèle** (50 pour la petite, 100 pour la grande ; 0 si la beauté n'est pas positive), puis par la **puissance de loisir** de l'œuvre selon sa qualité (0,76 / 0,88 / 1 / 1,12 / 1,24 / 1,4 / 1,8). Une petite sculpture en bois normale divertit autant que les fers à cheval ; excellente, 3,72 fois plus ; légendaire en jade, près de 39 fois plus ; affreuse (beauté −5), pas du tout, même si le colon y reste toute la durée comme dans le jeu de base.
- Debout sur une chaise, un tabouret ou un fauteuil voisin, le spectateur en tire aussi le confort.
- La contemplation s'arrête si l'œuvre disparaît, sort de la zone autorisée, est réservée par une déconstruction, si le colon ne peut plus la toucher, au début d'une plage de travail ou pour une urgence médicale. À la fin, comme après les autres loisirs, la pièce laisse son **souvenir de salle de loisirs** selon son impression (« Salle du dernier loisir », à partir d'une pièce correcte).
- L'alerte « Sources de loisirs insuffisantes » compte toujours la contemplation parmi les loisirs disponibles ; son libellé devient « contemplation (ciel, œuvres d'art) ». L'inspection et l'état du colon affichent le loisir (« Contemplation d'une œuvre d'art », « Prend le temps d'admirer une œuvre d'art »).

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun code copié).

- `Joy/JoyGivers.xml` : `ViewArt` (`JoyGiver_ViewArt`, `baseChance` 1, `joyKind` Meditative, `requiredCapacities` Sight, `canDoWhileInBed` true), placé après `Skygaze`, `GoForWalk` et `VisitGrave` dans l'ordre de chargement. `JobGiver_GetJoy` : poids chance × max(0,001 ; (1 − lassitude)^5), donneur sauté si la famille est lassée.
- `JobDefs/Jobs_Joy.xml` : `ViewArt` (`JobDriver_ViewArt`, `joyDuration` 4 000, `joyKind` Meditative, `joyGainRate` par défaut 1).
- `JoyGiver_ViewArt.TryGiveJob` : candidats du groupe Art avec `CompArt.CanShowArt` et `canBeEnjoyedAsArt` ; faction du joueur ; `JoyUtility.EnjoyableOutsideNow(pawn)` ou case couverte ; pas sous le brouillard ; `CanReserveAndReach(Touch, Danger.None)` ; non interdit ; une pièce, et si son rôle a `avoidViewingArtIfUnowned`, seulement la pièce possédée du colon ; tirage pondéré par `Mathf.Max(Beauty, 0.5)`.
- `ThingDefs_Buildings/Buildings_Art.xml` : seul `SculptureBase` porte `canBeEnjoyedAsArt` true (petite beauté 50, grande 100) ; `minQualityForArtistic` par défaut Affreux, donc toutes les qualités se montrent. Aucune sculpture n'a `CompForbiddable`.
- `JobDriver_VisitJoyThing` : réservation d'un seul spectateur, `Toils_Goto.GotoThing(Touch)`, attente de `joyDuration`, `FailOnDestroyedNullOrForbidden`, `FailOnCannotTouch`, `TryGainRecRoomThought` à la fin de l'attente.
- `JobDriver_ViewArt.WaitTickAction` : facteur `Beauty` de l'objet ÷ `Beauty` abstraite du modèle (sans matière, qualité normale), 0 s'il n'est pas positif ; `GainComfortFromCellIfPossible`. `JoyUtility.JoyTickCheckEnd` : × `JoyGainFactor` du bâtiment, gain 0,36/2 500 par tick, fin à joie pleine ou hors plage de loisirs.
- `Stats/Stats_Basics_General.xml` (`Beauty`, qualité −0,1 / 0,5 / 1 / 2 / 3 / 5 / 8) et `Stats/Stats_Building_Special.xml` (`JoyGainFactor`, base 1, qualité 0,76 / 0,88 / 1 / 1,12 / 1,24 / 1,4 / 1,8).
- `JoyUtility.EnjoyableOutsideNow` : `RainRate` < 0,25, conditions qui l'interdisent (`GameCondition_ToxicFallout`, hiver volcanique), température extérieure dans `ComfortableTemperatureRange`.
- `Rooms/RoomRoles.xml` : `avoidViewingArtIfUnowned` pour Bedroom, PrisonCell, Hospital, Barracks, PrisonBarracks ; `Room.Owners` vide dès que plus d'un lit d'un dortoir a un propriétaire, et pour tout autre rôle ; `Pawn_Ownership.OwnedRoom`.
- `TouchPathEndModeUtility.IsCornerTouchAllowed` : une case en diagonale ne touche la chose que si l'une des deux cases entre elles est praticable et sans porte.
- `RoomRoleWorker_RecRoom` : le donneur `ViewArt` n'a pas de `thingDefs`, une sculpture ne compte donc pas pour le rôle de salle de loisirs. Aucune pensée propre à la contemplation n'existe dans `ThoughtDefs` : seule `JoyActivityInImpressiveRecRoom` (le souvenir de salle de loisirs) s'applique.

## Adaptations

- Elsewhere tire d'abord la sculpture pondérée parmi celles qui passent les conditions, puis cherche un chemin vers ses cases voisines ; une sculpture inatteignable est écartée et une autre tirée parmi les restantes. Le jeu de base filtre l'accessibilité avant un unique tirage : la répartition est la même, les tirages consommés diffèrent.
- Les rôles de pièce d'Elsewhere ne distinguent pas l'hôpital et la cellule : tout lit compte, une pièce à un lit est une chambre et plusieurs lits un dortoir. Un lit médical n'ayant pas de propriétaire, une chambre d'hôpital reste évitée comme dans le jeu de base ; un prisonnier, lui, ne prend pas de loisirs dans Elsewhere.
- La case praticable d'un coin se lit sur le terrain marchable et les structures qui bloquent le passage ; une sauvegarde accepte une case voisine dont le coin s'est fermé depuis, la contemplation cessant au tick suivant.
- Le confort ne vient que des sièges des repas (tabouret, chaise, fauteuil), seules cases à la fois praticables et confortables.
- Les retombées toxiques et l'hiver volcanique interrompent, comme pour les autres loisirs d'Elsewhere, un spectateur posté sur une case non couverte.
- Le récit et la description générée des œuvres (`CompArt`, récits) n'existent pas dans Elsewhere ; ils n'entrent pas dans ce loisir.
- La contemplation au lit (`canDoWhileInBed`) n'a pas d'effet ici : `JoyGiver_ViewArt` ne propose rien à un colon alité.

## Ce qui reste

- Les autres loisirs de contemplation (promenade, visite de tombe, bonhomme de neige) et la grande sculpture du jeu de base restent absents.
- Pas de dessin propre à la contemplation : le colon se tient debout, tourné vers l'œuvre.

## Vérification

`tests/view-art-366.test.ts` : chiffres relus aux définitions (facteurs de joie par matière et qualité, poids, durée, famille) ; un colon qui s'ennuie, enfermé dans une pièce couverte sans ciel à contempler, marche jusqu'à la case voisine la plus proche puis contemple l'œuvre au fil des ticks (joie et lassitude ne montent que sur place), gain du premier tick exact pour quatre qualités ; une œuvre affreuse retient le colon toute la durée sans joie, une œuvre légendaire en jade remplit la joie en quelques dizaines de ticks et laisse le souvenir de salle ; une œuvre hors zone autorisée n'est jamais choisie puis l'est quand la zone l'inclut ; une œuvre magnifique enfermée derrière des murs est écartée au profit d'une œuvre affreuse atteignable ; conditions du jeu de base (faction, brouillard, spectateur unique, pluie dehors, chambre de son propriétaire, dortoir sans propriétaire, coin fermé) ; sauvegarde en pleine contemplation rechargée puis poursuivie à l'identique, refus de deux spectateurs, d'un spectateur loin de l'œuvre ou d'une source qui n'est pas une sculpture ; à 365 personne ne contemple, et sans sculpture 365 et 366 jouent à l'identique ; migration 365 → 366 par le seul numéro, refus d'une contemplation dans une sauvegarde 365.
