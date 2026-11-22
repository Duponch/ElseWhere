# Fin de marche, lit, établi assis et corps à corps — retours du 22 novembre

Lot 2 de la vague 1 du [chantier des retours du 22 novembre](chantier-retours-20261122.md) : points 1, 2, 3 et 5. **Présentation seule, sans changement de schéma** (base 376) : aucune règle ni aucun état de partie ne change ; le point 3 confirme la règle déjà en place.

## 1. La fin de marche ne glisse plus

**Cause.** La position dessinée d'un colon ou d'un animal suit sa position confirmée avec le ressort de RimWorld (`PawnTweener` : 0,09 × durée de l'image × 60 × vitesse, adoption directe à ×5 et au-delà). À ×1 elle reste derrière d'environ 0,6 case en marchant. Quand l'arête confirmée se terminait, l'animation de marche s'arrêtait aussitôt (indicateur de marche de l'arête), alors que le corps dessiné avait encore cette distance à parcourir : il la finissait en glissant, jambes immobiles, pendant environ 0,6 s.

**Correction** ([PawnLayer](../../src/render/PawnLayer.ts), [WildlifeLayer](../../src/render/WildlifeLayer.ts), [actor-motion-accents](../../src/render/actor-motion-accents.ts)). Tant que le corps dessiné n'a pas rejoint sa position (reste supérieur à 2 cm), les jambes continuent de marcher, à la cadence de la distance réellement parcourue à l'écran. La phase est planifiée pour finir sur un multiple de π (pieds joints) exactement quand le corps s'arrête : le pas ralentit avec le corps puis se pose, sans saut des jambes. Le ressort lui-même n'est pas modifié (il reste celui de RimWorld, et le contrôle de présentation le vérifie toujours).

**Autres animations touchées par le même défaut.** S'asseoir (repas, lecture, établi), se coucher (lit, repos), manger debout et travailler (miner, couper, construire, fabriquer) commençaient eux aussi à la fin de l'arête confirmée, donc avant que le corps dessiné n'arrive : le colon s'allongeait ou s'asseyait à 0,6 case du lit ou du siège puis y glissait. Pendant la fin de marche, ces poses attendent maintenant que le corps soit arrivé (le colon marche debout jusqu'à sa place, puis s'assoit ou se couche). Une transition accroupie (récolte) garde sa propre transition. Combat, transport par un autre colon, étourdissement, mort et colon à terre ne marchent jamais plus loin. Chez les animaux, manger et se coucher attendent de même ; une attaque garde son horloge. Le dépôt d'une charge (transfert de 0,25 s des mains vers le sol) n'a pas ce défaut et n'est pas changé.

## 2. La tête reste sur le lit

**Cause.** Un colon couché était centré sur sa place de lit (milieu des deux cases). Le corps couché mesure environ 1,77 case ; avec le modèle Origami, la hanche (le point d'ancrage) est à 0,64 case des pieds et à 1,13 case du sommet de la tête : la tête dépassait de 0,2 à 0,3 case derrière la tête de lit.

**RimWorld.** `PawnRenderer.GetBodyPos` dessine un dormeur depuis sa case de tête (`BedUtility.GetSleepingSlotPos`, la case du chevet), le corps décalé vers les pieds d'une demi-tête (`BaseHeadOffsetAt(South).z` plus les décalages du type de corps et du lit) : la tête est toujours au chevet, ce sont les pieds qui dépassent d'un lit trop court.

**Correction.** Le sommet de la tête (cheveux ordinaires compris) est placé à 0,82 case du centre de la place, côté chevet, pour toutes les couchettes : lit, lit double (chaque place), lit d'hôpital, sac de couchage simple et double, emplacement de couchage simple et double, dans les quatre orientations (0,38 case pour l'ancien lit d'une case). Les pieds arrivent alors au bout du lit ; un corps plus long les fait dépasser. Les oreillers du lit double ont été alignés sur celui du lit simple, là où la tête repose. La natte de paille citée dans la consigne est un sol (`StrawMatting`), pas une couchette : rien à placer.

## 3. Travailler assis à l'établi

**RimWorld 1.6 (vérifié dans le code).** Un colon travaille une facture debout sur la case d'interaction de l'établi (`JobDriver_DoBill`, `Toils_Recipe.DoRecipeWork`). Il n'y a **aucune recherche de chaise** pour une facture : si un siège (`building.isSittable` : tabouret, chaise, fauteuil, canapé) se trouve sur cette case, il en tire du confort (`PawnUtility.GainComfortFromCellIfPossible(chairsOnly: true)`, toutes les 15 ticks, comme au bureau de recherche dans `JobDriver_Research`). La vitesse de travail ne dépend que des statistiques de la recette et de l'établi (`workSpeedStat`, `workTableSpeedStat`) : **le siège ne change pas la vitesse**. Visuellement, un humain immobile debout sur un meuble où l'on s'assoit est dessiné assis (`PawnTweener.TweenedPosRoot`, `sittingOffset` du stade de vie, 0,18 pour l'adulte).

**Elsewhere.** La règle de confort du lot 350 suit déjà ce code (facture sur la case de travail ; recherche) ; aucune règle à corriger, pas de schéma. Ce qui manquait était la pose : un cuisinier, artisan ou chercheur qui travaille sur sa case avec un siège dessus est maintenant dessiné **assis sur le siège**, face à l'établi, les bras au travail ; sans siège il reste debout comme avant. La pose suit la même règle à chaque image et à chaque publication complète.

## 5. Corps à corps comme dans RimWorld

**Retiré.** Le nuage de bande dessinée avec étoiles (`BrawlCloudLayer`, ses 59 pièces par bagarre, son test et sa vérification de visibilité) est supprimé du rendu.

**Remplacé** par le geste de RimWorld (`Pawn_DrawTracker.Notify_MeleeAttackOn`, `JitterHandler`) : à chaque attaque, touchée ou non, tout le corps de l'attaquant est projeté vers sa cible de 0,35 case (0,5 plafonné à `JitterMax` 0,35), puis revient en ligne droite à 0,018 case par tick de jeu (0,32 s à ×1). Une attaque qui touche pousse la victime de 0,17 case dans le sens du coup (dégâts à impact, `hasForcefulImpact`, vrai pour tous les dégâts de corps à corps du jeu de base). Les décalages d'un même acteur s'additionnent et restent plafonnés à 0,35. Le moment est celui du coup confirmé (`atCore` de la frappe), la durée suit les ticks de jeu (plus rapide à ×3, figée en pause). Cela vaut pour les colons, les visiteurs et pillards, les bagarres sociales (qui sont des frappes de corps à corps) et les animaux (morsure, griffes, charge : l'animal se projette tête et corps vers sa cible). L'animation des bras et du corps (garde, frappe, armes) reste en dessous.

Le geste est ajouté à la position dessinée, dans les lots résidents existants : aucun objet par acteur, aucune nouvelle passe, aucun nouvel attribut. Les attaques des mécanoïdes poussent leurs victimes humaines et animales ; leur propre geste n'est pas ajouté (hors du périmètre demandé).

## Preuves

`tests/actor-motion-accents.test.ts` (15 cas) : marche réelle d'un colon par le moteur à ×1 (aucun déplacement visible de plus de 2 mm par image sans jambes en marche, reste à parcourir au moment où les jambes s'arrêtent inférieur à 2 cm, pieds joints, aucune saute de phase) ; même contrôle pour un animal ; plan de phase ; tête au chevet pour les sept couchettes, quatre orientations et les deux places des lits doubles (sommet de la tête mesuré indépendamment sur la géométrie humaine résidente) et pour l'ancien lit d'une case ; cuisinier assis avec tabouret et debout sans (ticks réels du moteur) ; geste d'attaque et poussée de la victime aux bons instants (0,35, puis 0,26 à 5 ticks, 0,17 à 10 ticks), pause et ×6 ; morsure d'animal ; absence du nuage dans le rendu.

Voisins mis à jour pour la nouvelle position couchée (emplacement de couchage, couple, ancrage du sommeil), pour le retrait du nuage (trois tests du nuage retirés, listes de couches de scène) et pour le double de `facilityLinks` qui manquait aux listes de deux tests de scène (échec antérieur au lot). Passe ciblée de 35 fichiers voisins (rendu des colons et des animaux, lits, corps à corps, armes, scène) : 193 réussis, 37 échecs dont 34 déjà connus, deux corrigés (`facilityLinks`) et un sans lien avec le lot (`surgery-presentation-v192` : un signal sonore inattendu de l'enregistreur audio, aucun fichier de rendu en cause).

## Vérification dans le vrai client

Serveur de développement, son et musique coupés, sur une petite colonie temporaire (sept couchettes occupées, un fourneau avec tabouret et une cuisinière, deux colons en duel, un promeneur), puis Les Forges. Observé : chaque dormeur a la tête au chevet ou au repère de tête et les pieds au pied du lit ou au-delà (lit simple, lit double avec la place vide et son oreiller du côté du chevet, sac de couchage, emplacement de couchage) ; la cuisinière arrive debout puis travaille **assise sur le tabouret**, bras au travail, face au fourneau ; à chaque coup du duel, l'attaquant est projeté vers sa cible et la cible repoussée, puis tous deux reviennent (images successives d'une rafale de captures) ; plus aucun nuage. Le promeneur marche jambes en mouvement jusqu'à l'arrêt, pieds joints ; l'arrivée elle-même est passée en bord de cadre dans la rafale, la preuve chiffrée reste le test avec le vrai moteur. Le volet du navigateur intégré était masqué (rendu ralenti à 1 image par seconde) : les rafales ont été prises dans Chromium sans affichage sur le même serveur.

## Performance

Banc ciblé [`scripts/actor-accents-bench.ts`](../../scripts/actor-accents-bench.ts) sur Les Forges (80 colons, 241 animaux) : temps CPU par image des couches colons et animaux sur le chemin du client (mises à jour, animations présentées, et le nuage retiré pour la version d'avant), un vrai tick Core par image à ×1, 1 200 images par tour, versions d'avant et d'après alternées (quatre passes de trois tours chacune, paquet esbuild).

| | Avant (avec le nuage) | Après |
|---|---:|---:|
| Image, médiane des 12 tours | 1,24 ms | 1,31 ms |
| Image, étendue des tours | 1,09 à 1,63 ms | 1,00 à 1,53 ms |
| Adoption d'une publication, moyenne des passes | 2,38 ms | 2,29 ms |

La machine est partagée et la dispersion entre tours (± 0,3 ms) est plus grande que l'écart : aucun coût ni gain n'est mesurable sur ce chemin. Le travail ajouté par image est borné : quelques lectures de propriétés par acteur (frappe en cours, reste du ressort) et une recherche dans une petite table des victimes ; aucun objet par acteur, aucune nouvelle passe, aucun envoi au GPU hors des images où un corps bouge déjà. Le nuage retiré coûtait une mise à jour par publication et un passage par image quand une bagarre était visible.

## Reste à faire

- Mécanoïdes : leurs victimes sont poussées, mais leur propre geste d'attaque n'est pas ajouté.
- La fin de marche suit le ressort de RimWorld : à ×1 le corps décélère sur environ 0,6 s avant de s'arrêter (c'est le comportement du jeu de base) ; les jambes l'accompagnent désormais.
- Les animations assises (point 4 du chantier) restent à enrichir : la pose assise à l'établi reprend le geste de travail générique des bras.
