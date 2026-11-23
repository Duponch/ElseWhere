# Animations des personnes et des animaux, modèles d'animaux, page des animations — retours du 22 novembre, vague 3

Lot 2 de la vague 3 du [chantier des retours du 22 novembre](chantier-retours-20261122.md) : points 4, 6 et 7. **Présentation seule, sans changement de schéma** (base 376) : aucune règle, aucun état de partie, aucun tirage ne change ; les sauvegardes sont identiques.

## Ce que fait le jeu de base

RimWorld 1.6 dessine des sprites 2D sans membres ; le Core ne contient **aucune** `AnimationDef` (le système d'animation de la 1.5 ne sert qu'aux extensions). Les seuls mouvements « vivants » du Core sont :

- **`PawnDownedWiggler`** (lu dans le code) : un pion à terre, éveillé, hors d'un lit, pivote sur le sol. Période 600 ticks, décalée par pion (`|HashOffset| % 600`) ; pendant les 90 premiers ticks de chaque demi-période il tourne de 0,35° par tick (+31,5°), puis revient de même pendant les ticks 300 à 390. Il vaut pour les colons et pour les animaux.
- les orientations : un pion qui discute pendant une fête se tourne vers un voisin (`JobDriver_StandAndBeSociallyActive.FindClosePawn`, 24 cases en ligne de vue) ; le décalage assis (`PawnTweener`, déjà repris en vague 1) ; le coup de corps à corps (`JitterHandler`, vague 1).

Tout le reste (bras, tête, souffle, queue, broutage) est une **adaptation d'Elsewhere** à ses modèles 3D, sans équivalent dans le jeu de base.

## 4. Personnes : assis et le reste

**Constat.** Un colon assis pour jouer aux échecs, au poker ou au jeu d'Ur, regarder la télévision, se détendre ou rendre visite à un malade restait raide, les bras le long du corps (pose assise sans geste) ; debout au repos, il ne faisait que respirer.

**Fait.** Les gestes sont choisis par l'état confirmé déjà publié (pose, code d'activité, phase propre à l'acteur) et suivent les deux horloges de présentation : ils s'arrêtent en pause et vont plus vite à ×3 et ×6, comme les autres. Nouveaux codes d'activité négatifs (aucun outil, pas de geste générique) : jeu de table −41, télévision −42, conversation −43, œuvre d'art −44, à terre −45, repas −46 ; la lecture garde son code 14.

| Situation (état du jeu) | Animation |
| --- | --- |
| Debout au repos | respire, se balance un peu, regarde à gauche puis à droite (tête tenue), porte une main à la tête toutes les 17 s environ |
| Jeu de table assis (échecs, poker, jeu d'Ur) | avant-bras sur la table, penché, regard sur le plateau ; lève les yeux vers l'adversaire, avance une pièce de temps en temps |
| Télévision | adossé, mains sur les genoux, un rire de temps en temps |
| Détente sociale, visite à un malade (assis), fête (debout) | parle avec les mains puis écoute en hochant la tête, tourné vers les autres |
| Admirer une œuvre | mains dans le dos, regard levé, parcourt l'œuvre |
| Repas (à table ou debout) | penché vers l'assiette, la tête vient à chaque bouchée (le plat tenu garde son geste) |
| Lecture (assis ou debout) | livre ouvert tenu **immobile** (il ne monte plus et ne descend plus comme une bouchée), yeux baissés, page tournée de temps en temps |
| Travail assis à l'établi (vague 1) | la cadence de l'activité (cuisine, recherche, fabrication), penché sur l'ouvrage |
| Assis sans activité particulière | mains sur les genoux, regarde autour de lui |
| Endormi | la poitrine se soulève lentement |
| Allongé éveillé, contemplation du ciel | respire, tourne la tête sur l'oreiller |
| À terre hors d'un lit | **pivotement du jeu de base** (ci-dessus, même période, même amplitude, même vitesse), respiration courte, une main tendue |

Le rig humain reste à huit os rigides. Trois mouvements s'y ajoutent sans nouvel attribut : une inclinaison de tout le haut du corps autour de la hanche (le torse, la tête et les bras suivent, ce que l'ancien angle du seul torse ne faisait pas), une rotation de la tête autour du cou, et le pivotement du corps entier autour de sa racine.

**Non fait.** Prière et méditation n'existent pas dans le Core (extensions). Les poses de transport et de travail accroupi n'ont pas changé.

## 6. Animaux

**Avant.** Marche, course, manger, attaque (vague 1), couché, mort ; au repos, la tête oscillait de 0,03 radian.

**Fait**, par famille tirée du corps et du régime du jeu (`race.body`, `race.foodType`) :

- **au repos** : regarde autour de lui (tête tournée et tenue) ; les herbivores de fourrage (`VegetarianRough`) baissent la tête pour brouter et mâchonnent ; les oiseaux picorent et ébouriffent leurs ailes ; la queue bat vite chez les canidés (chiens, renards, loups, warg), se balance lentement chez les félins, plus doucement chez les autres ; les mammifères s'ébrouent toutes les 17 s environ ;
- **couché ou endormi** : le corps se soulève à chaque respiration, la queue bouge à peine ;
- **à terre** : le pivotement du jeu de base, respiration courte.

Les queues et les ailes d'oiseau deviennent des appendices : leurs pièces gardent l'os 0 (le jeu de programmes par ensemble d'os ne change donc pas) et portent une étiquette dans la case libre de la marque d'œil (−2 queue, −3 et −4 ailes) avec un pivot unique, mesuré une fois sur les sommets de la pièce. Les oreilles restent solidaires de la tête : pas de battement d'oreille dans ce lot.

## Modèles d'animaux

**Revue des 53 espèces** (inventaire des modèles Pastel et Gouache, couleur dominante, taille, triangles) contre les teintes des définitions du jeu (`PawnKindDef`, `lifeStages/bodyGraphicData/color`) :

| Défaut | Espèces |
| --- | --- |
| Mêmes modèle et peinture | les trois chiens (labrador, husky, yorkshire) ; lièvre et lièvre des neiges ; cerf et caribou (même alezan, wapiti voisin) ; capybara et cochon d'Inde |
| Couleur loin du jeu | mégaraignée (bleu-gris au lieu de brun 154,125,94) ; alpaga (crème au lieu de fauve 180,148,109) ; capybara (trop clair, 109,84,49) ; labrador (ocre au lieu de crème 220,198,160) ; husky (ocre au lieu de gris 137,133,133) ; lièvre des neiges (sable au lieu de 180,180,180) |
| Modèles les plus pauvres (triangles) | cobra 128, iguane et tortue 156, émeu et autruche 168, casoar et canard 180, capybara 192 : silhouettes lisibles, non retouchées dans ce lot |

**Corrigé** ([`species-coats.ts`](../../src/render/origami/species-coats.ts)) : mégaraignée brune (les mandibles gardent le bleu-gris d'origine) ; alpaga fauve avec un toupet de laine crème sur la tête ; capybara brun foncé ; caribou gris-brun à collerette pâle ; lièvre des neiges blanc ; labrador crème aux **oreilles tombantes** ; husky gris à masque blanc et **queue enroulée sur le dos** ; yorkshire dos gris acier, tête et pattes feu. Les recettes sources ne changent pas : seule la présentation est retouchée, une fois, avant la compilation du lot de l'espèce.

**Peinture.** Pastel lit la couleur donnée. Gouache peint un pigment : seuls des pigments **déjà résidents** dans l'inventaire de 78 sont utilisés, et chaque pigment qu'une espèce abandonne reste utilisé ailleurs, si bien que l'inventaire exact (`game-paint-residency.ts`, 35 pigments du bestiaire + 43 protégés) ne change pas ; le test d'union réelle des matières le vérifie toujours.

## La page des animations

`animations.html` (Options → Développeur, publiée) joue toutes les animations avec les rigs du jeu eux-mêmes, en écrivant leurs flux d'instance comme l'atelier des modèles : aucun monde, aucune simulation. On choisit le corps (une personne ou l'une des 53 espèces), l'action, la vitesse (pause, ×1, ×3, ×6) et la texture (Gouache, Pastel). Chaque entrée a une description et l'état du jeu qui la produit ([`animation-catalogue.ts`](../../src/render/animation-catalogue.ts)) : 34 animations de personnes, 7 d'animaux. Les postures assises ont un tabouret et une table simples aux hauteurs du jeu. La page liste aussi les particules d'action du corps choisi, lues dans leur catalogue ([`action-particle-catalogue.ts`](../../src/render/action-particle-catalogue.ts), [lot des particules](action-particles-20261122.md)) : action, familles de particules, état qui les produit et effet du jeu de base suivi.

## Coût

Formules écrites une seule fois ([`actor-idle-gestures.ts`](../../src/render/actor-idle-gestures.ts)) sur une petite interface d'expressions : le graphe GPU résident les instancie en nœuds TSL (acteurs proches et moyens en mouvement), l'échantillonneur CPU retenu (moyens immobiles, rééchantillonnés à 12 Hz) les déroule en une bande d'opérations plate, sans fermeture ni allocation, spécialisée sur l'état discret de l'acteur (activité, posture, marche, charge) : les conditions connues sont calculées d'avance et les branches écartées élaguées (47 opérations pour une conversation assise au lieu de 428 pour la formule entière). Dormeurs, corps et animaux couchés prennent un raccourci scalaire ; un acteur lointain garde sa pose simple. Aucune scène ni mixeur par acteur, aucun attribut, aucune passe, aucun envoi au GPU de plus ; quelques sinus par sommet.

**Mesures** (Node, Les Forges : 80 colons, 241 animaux ; machine partagée avec d'autres travaux, donc bruitée).

- Image CPU des deux couches d'acteurs (`scripts/actor-accents-bench.ts` empaqueté par esbuild, 600 images × 3 tours, deux paires alternées avant/après, code final) : médiane des six tours 2,79 → 2,80 ms par image, p95 4,57 → 5,03 ms, adoption 3,59 → 3,99 ms. L'écart d'un tour à l'autre d'une même version atteint 30 à 50 % ; aucune différence n'est mesurable au-dessus de ce bruit. Une première série, avec l'ancien évaluateur à fermetures, donnait de même 4,09/4,79 → 5,56/3,13 ms.
- Échantillonneur retenu seul, par appel (µs, avant → après) : personnes dans leur état chargé 1,13 → 2,76, animaux 0,60 → 2,24 ; au repos (dormeurs, corps, couchés) 1,42 → 1,42 et 0,51 → 1,25. Les premières versions à fermetures coûtaient 6,6 et 4,5 µs : la bande spécialisée les a ramenées là. Au pire, si les 321 acteurs étaient tous moyens et immobiles, une passe à 12 Hz passerait de 0,23 à 0,76 ms, soit moins de 0,1 ms par image en moyenne à 60 images par seconde ; en pratique les acteurs proches et moyens en mouvement passent par le GPU et les lointains ne sont pas rééchantillonnés.
- GPU : rien de nouveau à envoyer ; quelques dizaines d'opérations par sommet (4 148 sommets par personne), sans texture ni passe de plus. Non mesuré au GPU dans ce lot.

## Preuves

Nouveau fichier [`retours-20261122-animations.test.ts`](../../tests/retours-20261122-animations.test.ts), 12 cas : chaque geste sort des flux réels de `PawnLayer` et `WildlifeLayer` pour l'état du jeu qui le produit (assis à table, télévision, conversation, lecture, repas, travail à l'établi, alité, à terre, animal à terre) ; déterminisme par acteur, bornes des angles, horloges sans saut au retour de 2π ni au recalage de l'origine du trajet ; balancement à terre égal à l'accumulation du jeu de base tick par tick ; échantillonneur CPU égal aux formules du shader, raccourcis des postures au repos exacts ; queues et ailes étiquetées, budgets de triangles des familles tenus ; robes comparées aux teintes Core en sRGB et sosies séparés ; une image ne crée aucun objet et ne touche pas au World ; catalogue complet et page inscrite dans `DEVELOPER_PAGES`.

Voisins (74 fichiers de rendu, d'acteurs et du bestiaire, 460 cas) : 403 réussis, 57 échecs dont 55 déjà dans `known-failures.json`. Les deux autres (« a real clinical dead animal keeps falling/rest primitives… », fichiers 297 et 298-port) dépassent leur délai de 120 s à l'identique sur `origin/main` sans ce lot. Trois oracles ont suivi le changement voulu : marques d'œil du bestiaire (−2 queue, −3/−4 ailes) et posture d'un animal à terre (1,25 au lieu de 1). Typage complet propre.

## Vérification dans le vrai client

Serveur Vite privé, son et musique coupés. **Page des animations** : toutes les actions des personnes jouées aux trois vitesses en Gouache et en Pastel (mains posées sur la table au repas et aux jeux, buste qui respire et tête qui suit l'écran ou l'interlocuteur, lecture, regard vers le ciel, alité et balancement à terre), puis les familles d'animaux (broutage, tête qui tourne, queue, ailes des oiseaux, respiration couchée, animal à terre) et les robes corrigées ; l'alpaga montrait d'abord des taches avec le pigment du lynx, remplacé par le fauve du couguar. **Jeu** : Les Forges chargées avec les nouveaux graphes, aucune erreur dans la console ; le panneau de navigateur, partagé avec d'autres travaux, tournait à environ 1 image par seconde, trop peu pour juger le mouvement dans la partie elle-même. Les rigs sont les mêmes que ceux de la page. Après reprise sur la branche principale (particules livrées), page rouverte : particules des personnes (abattage, coupe, récolte…) et des animaux (broutage, repas, sommeil) listées, aucune erreur.

## Reste à faire

- Oreilles qui battent, poses de transport et de travail accroupi variées.
- Tête des fêtards tournée vers un voisin précis (le jeu de base cherche le pion le plus proche) : ici la tête balaie.
- Modèles les plus simples (reptiles, oiseaux) non retouchés ; repas posé sur la table plutôt que tenu.
- Montrer les particules elles-mêmes sur la page (le modèle de référence `sampleActionParticle` du lot des particules le permet) ; elles y sont seulement listées.
