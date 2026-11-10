# Murs liés et toits en pente

10 novembre 2026, schéma 302 inchangé. Changement de présentation seulement : aucune règle, sauvegarde ni donnée du World ne change. `src/render` lit le World sans le modifier.

## Ce qui change à l'écran

**Murs.** Avant, chaque case de mur était un bloc indépendant (cube en pierre dans le lot de mobilier, planche biseautée instanciée pour le bois). Deux murs voisins montraient donc une jointure, un biseau et un contour à chaque case, d'où l'effet de poteaux collés. Désormais, tous les murs et les linteaux de porte forment une seule surface continue, l'équivalent 3D des murs « liés » de RimWorld :
- aucune face, aucun biseau ni contour entre deux murs voisins, en ligne droite, en angle, en T ou en croix ;
- les contours restent sur les vraies arêtes : extrémités, angles extérieurs, haut du mur, pied, changement de matériau et bande du chaperon ;
- la texture reste celle du style choisi, comme avant : peinture Gouache (pigment et papier) ou texture Pastel, continue d'une case à l'autre (voir « Peinture Gouache » plus bas) ;
- une porte rejoint le mur par son linteau : en bois depuis le haut du vantail, en maçonnerie au-dessus de l'encadrement, qui reste visible. Les montants des murs voisins s'arrêtent sous le linteau. En vue coupée, l'ouverture reste libre ;
- un mur construit ou retiré met à jour ses voisins (seulement la région concernée, voir plus bas).

**Toits.** Les toits construits ne sont plus une dalle plate mais de vrais toits en pente, peints avec la texture du style comme le reste du jeu. La forme dépend de l'emprise :
- un rectangle au moins 1,5 fois plus long que large reçoit deux pans avec pignons aux petits côtés, dans la couleur du mur porteur ;
- toute autre forme reçoit une croupe (pavillon) : carré, L, T, U, maison à cour intérieure, pièces voisines, toit partiel sans mur.

Le toit épouse l'emprise exacte : cases de toit construit, murs, portes, colonnes, climatiseurs et évents qui les portent. Il déborde de 0,3 au-delà des murs, avec rive, sous-face et bandeau. Au-delà de quatre cases du bord, il devient plat, si bien qu'une grande salle n'a pas de toit démesuré. Les toits naturels de montagne gardent leur dalle plate. L'affichage et le masquage des toits (bouton « Toits ») et la vue coupée sont inchangés.

## Construction des toits

La hauteur d'une croupe est la pente multipliée par la distance de Chebyshev (L∞) au dehors de la composante. Pour un contour en cases, ce champ est exactement le toit du squelette droit : faîtages, arêtiers et noues compris, quelle que soit la forme, trous inclus. Toutes ses lignes de pli tombent sur des demi-cases ou sur des diagonales qui passent par un centre de case. Un réseau de neuf points par case les triangule donc exactement : pas de trou, pas de fissure, pas de surface qui en traverse une autre. Une case plane donne deux triangles, une case traversée par un pli donne un éventail autour de son centre, et chaque arête partagée porte les mêmes sommets des deux côtés. Les tests vérifient sur un carré, un rectangle long, une grande salle, un L, un T, une cour intérieure, des pièces voisines et un contact en diagonale que chaque point de l'emprise élargie est couvert exactement une fois et que toute arête libre est sur le bord extérieur.

Code : `src/render/pitched-roof.ts` (champ et émission), `src/render/RoofLayer.ts` (couche), tests `tests/pitched-roof.test.ts`.

## Peinture Gouache

La Gouache peint chaque face par un pigment (coups de pinceau) posé sur un papier dont le masque de remplissage, prévu pour des coordonnées de face dans [0,1], laisse un bord irrégulier non peint. Une première version des murs liés employait des coordonnées en unités monde : hors de [0,1], la lecture du masque, bloquée sur son bord, ne rendait que le papier uni, d'où des murs et des toits orange sans peinture. Corrigé le 10 novembre :
- **côtés des murs** : chaque sommet connaît sa position le long de la face réelle complète (au-delà de sa région) et sa longueur. Par fragment, la première et la dernière case atteignent le bord du masque, les cases intermédiaires lisent une bande centrale en miroir. Le bord peint n'apparaît donc qu'aux vraies extrémités, jamais à une jonction ;
- **dessus des murs** : bord seulement sur les arêtes réellement exposées, valeurs en miroir entre deux murs ;
- **toits** : le masque est toujours lu dans sa zone peinte, si bien qu'aucune case ni région ne laisse de bord sur un pan ;
- **pigment** : continu sur chaque face, à la densité des anciennes faces (0,6 par unité sur les côtés, 1 vu de dessus). Les contours restent ceux décrits plus haut.

Les lattes, assises de blocs et rangs de bardeaux procéduraux de la première version sont retirés : la texture vient du style seul, comme avant. En Pastel, les murs gardent une texture de bois ou de pierre raccordable en coordonnées monde, et les toits la texture de toit historique.

## Un seul lot GPU, mis à jour par régions

Murs et toits sont chacun **un maillage résident et un seul appel de dessin** (plus son ombre), sans objet par case ni travail par image. `src/render/ChunkedSurfaceMesh.ts` découpe la carte en régions de 32×32 cases ; chaque région possède une plage réservée des tampons partagés et une région de la banque de contours. Un mur ajouté réécrit les régions à moins de deux cases de lui ; un toit réécrit celles dont les dépendances (cases à moins de neuf cases, forme de leur composante, couleur des pignons, toits naturels voisins) ont changé. Les tampons ne sont redisposés que si une région dépasse sa réserve, et les emplacements réservés inutilisés sont des triangles nuls.

Pour que les contours ne voient pas de couture à la frontière des régions, chaque région est compilée avec l'anneau d'une case qui l'entoure. Cet anneau n'est ni dessiné ni stocké. La table de contours est produite par `src/render/surfaces/WorldSurfaceStrokes.ts` : même règle et même résultat au bit près que `compileFaceStrokeTable(..., {mergeCoplanar:false})`, vérifiés par `tests/world-surface-strokes.test.ts`, sans la géométrie intermédiaire qui coûtait l'essentiel du temps.

Les aperçus d'ordres (déconstruction, etc.) teintent les murs ciblés par une texture d'une valeur par case, lue juste derrière la face. Les couleurs des sommets ne sont jamais réécrites.

## Coûts mesurés sur Les Forges

`TimberCladdingLayer` reste utilisé pour les fantômes de construction ; la scène ne l'instancie plus.

Reconstruction (CPU, Node, sauvegarde `v432/les-forges-crash-test.json` : 3 755 murs, 5 183 cases de toit construit), médiane de cinq répétitions par cas. Quatre passes en alternance avant/après. Les tests lourds d'une autre session tournaient en même temps, d'où la largeur des fourchettes ; seules les comparaisons comptent :

| Cas | Avant | Après |
|---|---|---|
| Murs, reconstruction complète (chargement, vue coupée) | 44–68 ms | 132–169 ms |
| Murs, un mur ajouté ou retiré | 29–32 ms | 3–12 ms (7–10 ms en zone dense) |
| Toit, reconstruction complète | 674–825 ms | 412–448 ms (une passe à 1 038 ms sous forte charge) |
| Toit, une case de toit ajoutée (la maison change de forme) | 587–755 ms | 30–38 ms (92 ms sous forte charge) |
| Toit, un mur posé loin de tout toit | 657–943 ms | 19–41 ms |

La vue coupée reconstruit tout : avant, environ 50 ms pour les murs et 750 ms pour le toit ; après, environ 140 ms et 430 ms.

Avant, le moindre mur ajouté n'importe où recompilait la dalle de tout le toit de la carte. Désormais, seule la région touchée est recompilée.

Géométrie et mémoire :

| | Avant | Après |
|---|---|---|
| Triangles des murs | 560 552 (bois) + 3 384 (pierre) | 19 458 dessinés, 24 378 réservés |
| Triangles du toit | 47 688 | 51 074 |
| Murs : géométrie + banque de contours (CPU, même ordre côté GPU) | ≈ 1 Mo d'instances (estimation) | 4,7 Mo + 8 Mo (avec les coordonnées papier) |
| Toit : géométrie + banque de contours | 8,0 Mo + 8 à 16 Mo | 11,5 Mo + 8 Mo |

La banque de contours croît par puissances de deux, d'où les valeurs rondes. Les anciennes planches ne sont plus préparées (cuisson de leurs surfaces) au chargement : cette mémoire libérée n'est pas comptée ici. Sur une colonie ordinaire comme Les Éclaircies (260 murs), ces volumes sont environ quinze fois plus petits.

Image : deux builds de profilage (`tmp/perf/vite.perfbuild.config.mjs`) dans Chromium, 1440×1000, même caméra sur Les Forges. Pour chaque build, toits masqués puis affichés, en pause puis à ×1, 8 s par condition, deux passes en alternance :

| En pause | Avant | Après |
|---|---|---|
| Triangles par image, toits masqués | 2 266 140 | 1 726 055 (−24 %) |
| Triangles par image, toits affichés | 2 316 000 | 1 792 700 (−23 %) |
| Appels de dessin | 77–79 | 76–78 |
| Images/s, toits masqués / affichés | 119–146 / 133–162 | 132–146 / 151–164 |

À ×1, les temps d'image (73–92 images/s des deux côtés, p95 21–38 ms) dépendent surtout de la simulation et de la charge de la machine : la différence n'est pas significative. Aucun gain de cadence n'est revendiqué. Ce qui est établi, c'est la baisse des triangles à dessiner et le coût de mise à jour, qui ne dépend plus que de la région touchée. Le temps de chargement est inchangé dans la marge de mesure (124 à 143 s sous charge).

Captures avant/après (Les Éclaircies, Les Forges, sauvegarde de formes variées : L, U, cour intérieure, pièces voisines avec porche, mur bois/granit, vue coupée, Pastel et Gouache, toits masqués et affichés), scripts et mesures brutes : `tmp/linked-walls-roofs-20261110/`, hors dépôt.

## Limites

- Un pli rentrant (angle intérieur d'une pièce) n'a pas de trait de contour vertical, il est rendu par l'ombrage seul.
- Un contact de deux toits par un seul coin garde une petite encoche dans le débord.
- Le chemin « préparé » des surfaces Gouache n'existe pas pour ces surfaces continues, comme pour l'ancienne dalle de toit. Elles restent en Source.
