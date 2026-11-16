# Passion au travail et besoin d'espace — V345

Schéma 345. L'audit des bases (besoins et pensées) classait ces deux éléments parmi ceux que toute partie du jeu de base rencontre : la pensée d'un colon qui exerce une compétence pour laquelle il a une passion, et le besoin d'espace avec ses pensées d'intérieur exigu ou spacieux. Les règles viennent des définitions de RimWorld 1.6 (ThoughtDef DoingPassionateWork, NeedDef RoomSize, ThoughtDef NeedRoomSize) et des classes qui les appliquent (ThoughtWorker_PassionateWork, JobDriver.ActiveSkill, Need_RoomSize, Need_Seeker, ThoughtWorker_NeedRoomSize, Room.PsychologicallyOutdoors) ; aucun texte du jeu n'est repris.

## Passion pour son travail

- **Passion pour son travail** : +8 d'humeur ; **Passion brûlante pour son travail** : +14. Une seule des deux, selon la passion du colon pour la compétence exercée.
- La pensée dure le temps du **travail effectif** : dans le jeu de base, elle suit la compétence active de l'étape en cours de la tâche. Marcher jusqu'au chantier, aller chercher des matériaux, transporter, attendre ou manger n'en ont pas ; la pensée apparaît quand le colon creuse, coupe, construit, cuisine…, et disparaît dès qu'il s'arrête ou passe à un travail sans passion.
- Une compétence que l'histoire du colon lui interdit ne porte pas de passion.

| Activité dans Elsewhere | Compétence active (jeu de base) |
|---|---|
| Miner une roche | Minage (JobDriver_Mine) |
| Foreuse profonde | Minage (OperateDeepDrill) |
| Scanner de sol | Intellectuel (OperateScanner) |
| Semer, récolter, couper, abattre, extraire un arbre ; dégager une plante d'un chantier | Plantes (PlantSow, PlantWork, ExtractTree) |
| Construire (cadres, sols, ponts, meubles, installation), déconstruire, désinstaller, toits, lisser un sol, réparer, remplacer un composant en panne | Construction (ConstructFinishFrame, AffectFloor, AffectRoof, RemoveBuilding, SmoothWall, Repair, FixBrokenDownBuilding) |
| Facture à un poste de travail | la compétence de la recette (Toils_Recipe) : Cuisine pour les repas, la boucherie, les croquettes, le pemmican et le moût ; Artisanat pour les vêtements, armes, armures, blocs de pierre, composants et prothèses ; Art pour les sculptures ; Intellectuel pour les médicaments ; aucune pour la fonte, la crémation, le brûlage et le carburant |
| Recherche | Intellectuel (JobDriver_Research) |
| Soigner une personne ou un animal, opérer | Médecine (TendPatient ; recettes de chirurgie) |
| Discussion avec un prisonnier, y compris l'attente de la tentative finale de recrutement | Social (Toils_Interpersonal : ConvinceRecruitee, TryRecruit) |
| Apprivoiser, dresser (sauf pendant le nourrissage), traire, tondre | Dressage (InteractAnimal, GatherAnimalBodyResources) |
| Ordre d'attaque à distance, riposte d'un colon réglé sur « Attaquer », tir d'un chasseur | Tir (AttackStatic avec une arme à distance, CastVerb) |
| Ordre d'attaque au corps à corps, riposte, bagarre, folie meurtrière | Mêlée (AttackMelee) |

Sans compétence active : lecture et loisirs, transport, nettoyage, lutte contre le feu, nourrir un patient ou un animal, abattage, mener un animal, inhumation, actionner un interrupteur, replanter un arbre. Le tir et les coups automatiques d'un colon mobilisé viennent de son attente sur place : le jeu de base ne leur donne pas de compétence active, Elsewhere non plus. Pour le chasseur, la marche vers la position de tir ne compte pas, seul le tir compte.

La passion pour la lecture (+4 et +6) existait déjà ; elle reste à part et la lecture ne donne pas la passion pour son travail.

## Besoin d'espace

Les colons et les prisonniers ont un besoin **Espace** (de 0 à 100 %), affiché dans l'onglet Besoins de l'inspecteur.

- **Valeur perçue** : la surface de pièce autour du colon. Si sa case est à ciel ouvert (une pièce d'au moins 300 cases sans toit, ou touchant le bord de la carte avec au moins la moitié sans toit), la valeur est 100 %. Sinon, on retient sa pièce et celles des quatre cases voisines qui ne sont ni une porte ni à ciel ouvert, puis on compte, parmi les 193 cases à moins de 7,9 cases de lui, celles qui appartiennent à ces pièces. Une porte est une pièce d'une seule case, comptée seulement quand le colon s'y tient ; un mur ou la roche n'est d'aucune pièce.
- **Courbe** : 3 cases ou moins donnent 0 %, 9 cases 25 %, 16 cases 50 %, 42 cases 71 %, 100 cases ou plus 100 %, en ligne droite entre ces points. Une chambre de 3 × 3 donne 25 %, une de 4 × 4 50 %.
- **Évolution** : à chaque passage des besoins (150 ticks du jeu de base), le niveau se rapproche de la valeur perçue de 5,4 points (90 points par heure), à la hausse comme à la baisse, sans la dépasser.
- **Figé** pendant le sommeil (ou l'inconscience), dans un caisson de cryptosommeil, et à la mort.
- **Valeur de départ** : 50 %, pour un nouveau colon, un nouveau prisonnier ou une colonie chargée depuis une ancienne sauvegarde. Un colon qui n'a plus ce besoin (prisonnier libéré par exemple) le perd ; s'il le retrouve, il repart de 50 %.
- Les visiteurs, les pillards et les animaux n'ont pas ce besoin.

Pensées, seulement éveillé et dans une pièce qui n'est pas à ciel ouvert :

| Niveau | Pensée | Effet |
|---|---|---|
| sous 1 % | Intérieur confiné | −10 |
| sous 30 % | Intérieur exigu | −5 |
| de 30 à 70 % | aucune | — |
| 70 % et plus | Intérieur spacieux | +5 |

Dehors, le besoin remonte vers 100 % sans donner de pensée ; en rentrant dans une petite pièce, le colon reste quelques instants à l'aise avant que le niveau ne redescende, comme dans le jeu de base.

## Adaptations

- **La jauge est visible** : le jeu de base cache ce besoin dans la liste des besoins (showOnNeedList à faux) et ne montre que la pensée. Elsewhere l'affiche dans l'onglet Besoins, avec ses repères 1, 30 et 70 %.
- **Lecture de la pièce** : la pensée lit la pièce relevée au dernier passage des besoins (au plus 150 ticks plus tôt), gardée avec le niveau, au lieu de relire la pièce à chaque recalcul. Les pièces sont celles qu'Elsewhere calcule déjà (murs, roche et portes) avec ses toits ; le comptage des toits par pièce est fait une fois par changement de toits ou de murs.
- **Hors carte** : en caravane, le jeu de base fait remonter le besoin vers 100 % ; Elsewhere le laisse figé jusqu'au retour, sans pensée.
- **Invités** : le jeu de base donne aussi ce besoin aux invités hébergés par la colonie ; Elsewhere le réserve aux colons et aux prisonniers.
- **Installation** : dans le jeu de base, un meuble réinstallé est posé à la livraison ; dans Elsewhere, l'installation est un travail de construction et compte comme tel pour la passion, comme pour l'expérience déjà gagnée.
- La passion pour son travail s'applique à toute personne, comme le jeu de base ; seuls les colons travaillent en pratique.

## Sauvegardes

Une sauvegarde 344 passe à 345 en changeant seulement son numéro : chaque colon et prisonnier commence avec un besoin d'espace à 50 %, rien n'est rétroactif. Le besoin est enregistré à partir de 345 (niveau en simple précision entre 0 et 1, et la pièce intérieure ou non du dernier relevé) et refusé dans une sauvegarde plus ancienne ou s'il est malformé. La passion pour son travail n'enregistre rien : elle se lit sur la tâche en cours.

## Vérifications

`tests/mood-basics-345.test.ts` couvre :

- la courbe, l'échantillon de 193 cases et les seuils des catégories ;
- dans trois pièces réelles (un placard de deux cases, une chambre de 3 × 3, une salle de 12 × 12), le besoin qui baisse, monte, atteint 0, 25 % et 100 %, et les pensées confiné, exigu et spacieux ; dehors, le retour vers 100 % sans pensée ; le relevé sur une porte ;
- le gel pendant le sommeil, l'absence chez les visiteurs et les pillards, la perte du besoin ;
- un colon qui creuse avec une passion : pas de pensée pendant la marche, +8 puis +14 au travail, perte quand il est mobilisé, aucune pensée en déconstruisant sans passion ;
- la compétence active de chaque activité, à sa seule phase de travail ;
- rien de tout cela sous 345 ;
- la jauge Espace et la pensée dans l'onglet Besoins ;
- l'égalité au rechargement puis la même suite de la partie ;
- la migration 344 → 345 et le refus du besoin dans une sauvegarde 344.

Coût mesuré sur une carte de 250 × 250 (Node, hors navigateur) : un relevé d'espace à l'intérieur d'une salle de 12 × 12 coûte environ 10 µs, une fois par colon ou prisonnier toutes les 150 ticks du jeu de base ; la lecture de la compétence active environ 0,1 µs. Le comptage des toits par pièce se fait une fois après chaque changement de toits ou de murs (0,6 ms la première fois sur cette carte).

La campagne « Atterrissage » de 24 jours (graine 42) passe à 345 sans changer le joueur scripté (1 402 s). Elle a tourné avant le dernier ajustement : l'attente de la tentative finale de recrutement compte aussi comme travail social, ce qui ne touche que les geôliers passionnés pendant 350 ticks à la fin d'une discussion.
