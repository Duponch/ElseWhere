# Alertes de droite comme dans RimWorld 1.6 — lot B : besoins, santé, animaux et vêtements

Interface seulement : le schéma ne change pas (351), rien n'est sauvegardé et la simulation n'est pas touchée. Les alertes lisent la partie confirmée sans la modifier ni tirer de hasard, au même rythme que le [lot A](alerts-core-a.md) (au plus une lecture toutes les 400 ms, aucune avant 600 ticks du jeu de base). Référence : RimWorld 1.6.4871, classes `Alert_Exhaustion`, `Alert_LowMedicine`, `Alert_TatteredApparel` (`Alert_Thought`), `Alert_Boredom`, `Alert_NeedBatteries`, `Alert_LowFood`, `Alert_Hypothermia`, `Alert_LifeThreateningHediff`, `Alert_MajorOrExtremeBreakRisk`, `Alert_MinorBreakRisk`, `Alert_AnimalPenNeeded`, `Alert_AnimalPenNotEnclosed`, `Alert_PredatorInPen`, `Alert_PennedAnimalHungry`, `Alert_StarvationAnimals`, `Alert_NeedWarmClothes`, et les classes qu'elles appellent (`Need_Rest`, `ResourceCounter`, `JoyToleranceSet`, `ThoughtWorker_ApparelDamaged`, `Hediff`, `MentalBreaker`, `AnimalPenUtility`, `GenTemperature`) ; définitions `HediffDefs` du jeu de base. Seuls des faits ont été repris ; les textes sont écrits pour Elsewhere.

## Ce qui change pour le joueur

Onze alertes nouvelles, et une alerte de danger de mort qui réunit les urgences médicales comme dans le jeu de base. Chacune a la priorité du jeu de base, ses délais, ses cas pour le clic gauche ou droit et une explication au survol.

| Alerte (classe) | Priorité | Règle |
|---|---|---|
| **Personne en danger de mort** (`Alert_LifeThreateningHediff`) | Critique | Colons libres **et prisonniers** dont un état a atteint un stade mortel du jeu de base sans immunité acquise : perte de sang (≥ 0,60), malnutrition (≥ 0,8), coup de chaleur ou hypothermie (≥ 0,62), infection (≥ 0,78), grippe (≥ 0,833), peste (≥ 0,9), paludisme (≥ 0,91), maladie du sommeil (≥ 0,875), crise cardiaque, artères du cœur obstruées (≥ 0,9). L'explication donne chaque personne et ses états, et propose l'amputation si une infection mortelle touche un membre. Remplace les cinq lignes « Urgence médicale » (infection, grippe, paludisme, peste, maladie du sommeil). |
| **Colon épuisé** (`Alert_Exhaustion`) | Haute | Repos d'un colon libre sous 1 % (catégorie « épuisé » du besoin de repos). |
| **Médicaments en réserve** (`Alert_LowMedicine`) | Haute | Après 150 000 ticks du jeu de base (2,5 jours), sur la carte du foyer : médicaments rangés dans une réserve ou sur une étagère, comptés à l'unité, sous 2 par colon libre présent. « Aucun médicament en réserve » quand il n'y en a pas du tout. |
| **Vêtements chauds nécessaires** (`Alert_NeedWarmClothes`) | Haute | Carte du foyer. Température la plus basse à venir : la plus froide des moyennes saisonnières du douzième en cours et des trois suivants, et de l'air extérieur actuel. Sous 5 °C, chaque colon libre dont le minimum confortable, vêtements portés compris, reste au-dessus est un cas. |
| **Vêtements abîmés** (`Alert_TatteredApparel`) | Moyenne | Colons libres qui ont la pensée « vêtements abîmés » : une pièce portée sous 50 % de ses points de vie. « ×N » quand plusieurs colons sont concernés. |
| **Ennui** (`Alert_Boredom`) | Moyenne | Carte du foyer : un colon libre dont les loisirs sont sous 24 %, ou qui est dans une heure de loisirs de l'emploi du temps, et qui est lassé de tous les types de loisirs de la carte. L'explication liste les loisirs disponibles. |
| **Batteries nécessaires** (`Alert_NeedBatteries`) | Moyenne | Carte du foyer avec un panneau solaire ou une éolienne, sans batterie ni générateur géothermique. Le clic ouvre Architecte > Énergie ; l'explication dit s'il faut d'abord rechercher les batteries. |
| **Enclos nécessaire** (`Alert_AnimalPenNeeded`) | Moyenne | Animal de la colonie d'une espèce gardée en enclos, hors de tout enclos (un enclos ouvert compte), pas en rage, quand aucun marqueur d'enclos n'accepte son espèce ou qu'aucun colon n'a le travail Dressage activé. |
| **Enclos non fermé** (`Alert_AnimalPenNotEnclosed`) | Moyenne | Marqueur d'enclos dont la zone touche le bord de la carte. Le clic va au marqueur. |
| **Prédateur dans un enclos** (`Alert_PredatorInPen`) | Moyenne | Prédateur sauvage dans la zone d'un enclos fermé ; le titre nomme son espèce. |
| **Animal affamé dans un enclos** (`Alert_PennedAnimalHungry`) | Moyenne | Animal d'enclos, dans un enclos fermé, affamé depuis plus de 2 500 ticks du jeu de base. |
| **Animaux affamés** (`Alert_StarvationAnimals`) | Moyenne | Animal de la colonie affamé depuis plus de 30 000 ticks du jeu de base, ou 5 000 s'il porte des petits. |

Ordre dans la colonne : Critique, puis Haute, puis Moyenne, l'ordre d'apparition étant gardé à priorité égale (lot A).

## Déjà conformes depuis le lot A

Relus dans les classes du jeu de base, sans changement : la nourriture rangée sous 4 par colon libre après 2,5 jours (`Alert_LowFood`), l'hypothermie grave (stade ≥ 0,35) dans un air hors de la plage sûre (`Alert_Hypothermia`), et le risque de crise : majeure ou extrême en Critique (`Alert_MajorOrExtremeBreakRisk`), mineure en Haute seulement quand personne n'est à risque majeur (`Alert_MinorBreakRisk`).

## Adaptations

- **Cartes et voyages.** Comme au lot A, seuls les colons et animaux présents sur la carte sont lus ; ceux d'une caravane ne comptent pas (le jeu de base les inclut pour les vêtements abîmés, les menaces vitales, l'hypothermie et les animaux affamés).
- **Durée de la faim des animaux.** La sauvegarde ne garde pas l'heure du dernier repas. Tant qu'un animal est affamé, sa malnutrition grandit de son propre pas fixe tous les 150 ticks du jeu de base ; la durée de faim est lue comme le nombre de ces pas. Une malnutrition restée d'une faim précédente compte donc comme du temps de faim : l'alerte peut revenir plus tôt que dans le jeu de base si un animal à peine nourri retombe à zéro. Un animal nourri n'est plus affamé et l'alerte disparaît aussitôt. La lecture se fait au pas près, soit au plus 150 ticks plus tard que le jeu de base.
- **Porter des petits.** Le jeu de base retient la grossesse visible ; dans ses définitions la grossesse est visible dès le début. Toute gestation compte.
- **Enclos.** Les zones viennent du même remplissage que la simulation (fermeture, cases). L'accès jusqu'au bord de la carte et jusqu'au marqueur n'est pas vérifié ; un animal enfermé ailleurs qu'un enclos peut donc être signalé. Elsewhere n'a pas de poteau d'attache, ni de marqueur interdit.
- **Prédateur dans un enclos.** Seuls les prédateurs dont la case est connue du joueur sont lus.
- **Vêtements chauds.** Le jeu de base prévoit de retrancher les ensembles chauds rangés en réserve, mais dans la version 1.6.4871 son calcul additionne des priorités négatives et ne retient jamais aucun ensemble : des parkas rangées n'effacent pas l'alerte, il faut les porter. Elsewhere suit ce comportement observable. Il n'y a ni bébé, ni nudiste, ni vêtement verrouillé à exclure. La moyenne d'un douzième reprend le cycle saisonnier de la carte (géographique ou de référence) sans le cycle du jour ni la météo ; une carte sans climat garde 21 °C.
- **Ennui.** Les types de loisirs comptés sont ceux d'Elsewhere, comme au lot A (contemplation et vie sociale toujours présents).
- **Menaces vitales.** Les états mortels du jeu de base absents d'Elsewhere (dépendance au lucifer, pourriture des poumons, décomposition d'organe) ne sont pas lus ; le carcinome n'a pas de stade mortel dans le jeu de base. L'exception des « sans mort » de Biotech ne s'applique pas.
- **Lignes de maladie ordinaires.** Les lignes Moyennes « N colon(s) avec une infection, la grippe, le paludisme… » propres à Elsewhere restent ; seules les lignes d'urgence ont été réunies.

## Absent et pourquoi

- `Alert_HitchedAnimalHungryNoFood` : pas de poteau d'attache dans Elsewhere.
- `Alert_AnimalRoaming` : pas d'état mental d'errance des animaux d'enclos.
- `Alert_HypothermicAnimals` : alerte du mode développeur seulement.
- `Alert_UnhappyNudity` : pas de pensée de nudité dans Elsewhere.

## Coût mesuré

Mesure sur Les Forges (80 colons, 241 animaux dont 161 de la colonie, 1 778 piles, 7 512 bâtiments, 4 enclos fermés), dans Node, bancs empaquetés par esbuild sans `--keep-names`, tick placé après les 2,5 jours pour que chaque lecteur travaille en entier. Chaque lecture se fait sur un nouvel objet World qui partage les tableaux (partie publiée inchangée) ou reçoit un nouveau tableau de bâtiments (cas probable en jeu, les portes changeant d'état). Liste entière mesurée en alternance avant et après le lot, 300 lectures par mesure, machine partagée et chiffres bruités :

| Lecture | Avant le lot | Après le lot |
|---|---|---|
| Liste entière, tableaux partagés (médiane) | 1,23 à 1,57 ms | 1,40 à 1,46 ms |
| Liste entière, nouveau tableau de bâtiments (médiane) | 5,1 à 5,4 ms | 5,6 à 5,8 ms |

Le lot ajoute donc environ 0,2 ms par lecture quand les tableaux sont partagés et 0,4 à 0,5 ms avec un nouveau tableau de bâtiments, soit environ 0,1 % du fil principal au rythme de 400 ms. Détail des lecteurs (200 lectures, médianes) :

| Lecteur | Médiane |
|---|---|
| Lecteurs du lot B ensemble, tableaux partagés | 0,27 ms |
| dont médicaments (cases de stockage, partagées avec la nourriture dans la liste entière) | 0,15 ms |
| dont enclos, zones réutilisées | 0,05 ms |
| Enclos, nouveau tableau de bâtiments, clôtures inchangées | 0,5 à 0,6 ms |
| Enclos quand une clôture, un portillon tenu ouvert, un marqueur ou la roche change | 7,5 ms (maximum 15 à 17 ms) |

Les zones d'enclos sont gardées d'une lecture à l'autre tant que les clôtures, portes, marqueurs et la roche ou l'eau restent les mêmes : un tableau de bâtiments inchangé ne demande que l'état de ses portes, un nouveau tableau une passe sur ses bâtiments. Le remplissage complet de la carte n'a lieu que lorsqu'un de ces éléments change. Aucune lecture par image ; une passe sur les piles par question au plus, partagée entre alertes. Ces chiffres ne sont pas des images par seconde et n'ont pas été mesurés dans le navigateur.

## Contrôles

- `tests/alerts-core-b.test.ts`, 15 cas sur des parties construites avec les aides de scénario : chaque alerte apparaît et disparaît (repos, médicaments rangés ou non avant et après 2,5 jours, chemise usée, lassitude puis nouveau loisir, panneau solaire puis batterie ou géothermie, perte de sang, hypothermie, crise cardiaque, paludisme puis immunité, prisonnier en malnutrition, saisons boréales et parkas portées ou rangées, animal hors enclos avec ou sans dresseur et marqueur, clôture percée puis réparée et portillon tenu ouvert, renard dans l'enclos, faim d'un animal dans l'enclos menée par la simulation jusqu'au seuil, faim de 30 000 et 5 000 ticks) ; priorités et ordre dans la liste ; réutilisation et recalcul des zones d'enclos entre parties publiées ; lecture sans modification de la partie.
- Anciens tests mis à jour quand ils décrivaient une règle remplacée : les lignes « Urgence médicale » par maladie deviennent l'unique alerte de danger de mort, aux mêmes seuils (`tests/status-alerts-v319.test.ts`, `tests/native-hud-controls-v485.test.ts`).
- Voisins lancés (alert*, status*, notification*, native-hud*, mood-risk*, animal-pen*, pen*, apparel*, temperature*, medicine*, food*, et les tests qui lisent les alertes : froid, malnutrition, refuge et thermie animale, disponibilité, fête, alertes distantes, incidents secondaires, étagères), 52 fichiers : 356 cas réussis, 52 échecs dont 51 déjà connus ; le dernier (liste des recettes du laboratoire de `medicine-production-v271`) échoue de même sur les sources d'avant le lot et ne lit pas les alertes.
- Non vérifié dans un navigateur.
