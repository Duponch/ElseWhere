# Retours du 22 novembre, vague 2, lot 1 : fantômes des chantiers et clic sur le modèle

Points 13 et 15 du [chantier des retours](chantier-retours-20261122.md). Présentation et interface seulement : aucune règle du jeu, aucun changement de schéma (376 inchangé), aucune donnée de sauvegarde touchée.

## 13. Chantiers lancés : la silhouette fantôme au lieu des cubes à traits

**Constat.** Un plan ou une charpente posés étaient dessinés par une boîte en fil de fer à la taille approximative du bâtiment (lot `job-plans`), et chacune de leurs cases recevait une teinte bleu-vert (lot `job-orders`, jaune quand un colon y travaillait). La progression d’une charpente était un bloc plein qui montait du sol.

**Le jeu de base.** Un plan (`Blueprint_…`, `ThingDefGenerator_Buildings.NewBlueprintDef_Thing`) reprend le dessin du bâtiment lui-même, avec ses liaisons (`linkFlags`), dans un nuanceur transparent et la couleur `BlueprintColor` (0,82 ; 0,92 ; 1 ; alpha 0,6) : c’est la silhouette translucide du futur bâtiment. Le plan d’installation reprend celui du bâtiment. Une charpente (`Frame.DrawAt`) dessine un fond, quatre coins de côté `min(largeur, longueur) × 0,38` posés dans l’emprise, puis `ceil(avancement × largeur × longueur × 4)` tuiles d’une demi-case, rangée par rangée depuis le coin inférieur, à la couleur du matériau (gris 0,6 sans matériau).

**Correction.**
- Chaque ordre qui construit quelque chose (bâtiment, installation d’un meuble emballé, sol, pont) est dessiné par le **fantôme du curseur de placement** : mêmes constructeurs de modèles, même matériau, même teinte (`validTint` à 35 %) et même opacité (0,48), tourné comme posé, sur toute son emprise. Une seconde instance de `ConstructionPreviewLayer` (« placée ») garde ces fantômes dans ses lots résidents : mêmes géométries (boîtes, planches, chaperons, sacs, pièces d’arbre), un seul matériau ; seule différence, elle respecte la profondeur : un colon ou un mur devant le fantôme le cache, alors que le curseur reste toujours visible.
- Plus aucune teinte de case pour ces ordres, ni boîte en fil de fer. Les ordres qui ne construisent rien gardent leurs marques : croix de démolition, de désinstallation, de retrait de sol ou de pont ; case de réparation et de commutation (sans pictogramme). Les toits gardent leur teinte de zone (ils n’ont pas de fantôme au curseur).
- Charpente : les quatre coins (deux barres chacun) et les tuiles d’avancement du jeu de base, au ras du sol sous le fantôme, à la couleur du matériau. Les tuiles se lisent aussi pour un ordre d’installation en cours de travail. Adaptation : le jeu cesse de dessiner la silhouette une fois la charpente posée ; Elsewhere garde le fantôme par-dessus, comme demandé, et n’ajoute pas le fond sombre.
- Porte posée sur un mur existant : la porte future serait cachée dans le mur qu’elle remplace ; son cadre de trois barres autour du mur est maintenant dessiné en fantôme (même matériau translucide) au lieu du fil de fer.
- Murs de pierre et d’acier : le curseur n’en avait pas (le constructeur ne produisait que le bardage des murs en bois et levait « Empty construction model ») ; leur fantôme est maintenant le bloc que dessine `WallLayer`, corps et chaperon à la couleur du matériau, pour le curseur comme pour les chantiers.
- État interdit ou bloqué : les ordres de construction d’Elsewhere n’ont pas d’état interdit (le jeu en a un pour ses plans) ; les états qui se distinguaient restent distincts (plan seul, charpente avec coins et tuiles, démolitions en croix). La surbrillance de l’outil d’annulation teint aussi les fantômes ciblés.

**Coût.** Les fantômes ne sont reconstruits que quand l’ensemble des chantiers posés change, jamais à cause de l’avancement. Le contexte que lisent les modèles (murs liés, bardage, axes de porte, conduits) est réduit aux bâtiments ancrés à 6 cases au plus des fantômes, au lieu de toute la carte : résultat identique, vérifié sur Les Forges (466 fantômes, avec et sans coupe des murs). Une capture de meubles pour tous les fantômes au lieu d’une par fantôme. Un changement redessine seulement les fantômes ancrés à 8 cases au plus du changement ; l’identité d’un fantôme vient de son ordre (son numéro), si bien que son dessin ne dépend pas de l’ordre des autres (les nuances du bardage ne clignotent plus) et que le résultat est identique à un dessin complet (vérifié par les tests et sur Les Forges). Les matrices sans rotation hors de l’axe vertical sont écrites directement.

## 15. Clic sur le modèle

**Le jeu de base** (`GenUI.ThingsUnderMouse`) prend d’abord les personnes et animaux à 0,4 case de la souris (puis à 0,8), puis les choses de la case cliquée triées par altitude (lot 3 de la vague 1). Dans le jeu, vu de dessus, ce qui est dessiné sous la souris est presque toujours sur la case cliquée ; en 3D, la couronne d’un arbre, la face d’un mur ou le flanc d’une pile se dessinent au-dessus d’une autre case que celle du sol sous la souris.

**Correction.**
- Au clic seulement, le rayon de la caméra est testé contre des boîtes approchées des modèles proches de lui : bâtiments et chantiers sur leur emprise jusqu’au sommet de leur modèle (mesuré une fois par sorte sur les mêmes constructeurs que le curseur : mur 3,24, porte 2,26, lampadaire 1,68, éolienne 6,49…), arbres et plantes à leur taille dessinée, piles, meubles emballés, roche naturelle (cases parcourues le long du rayon). La chose touchée la plus proche de la caméra gagne.
- Si cette chose est sur la case du sol sous la souris, rien ne change : la liste de la case suit l’ordre du jeu (lot 3). Si elle est dessinée au-dessus d’une autre case, elle est sélectionnée d’abord ; les clics suivants parcourent ensuite sa case dans l’ordre du jeu. L’applique murale garde sa visée propre (lot 3), testée avant.
- Personnes, animaux et mécanoïdes étaient déjà visés sur leur pose dessinée (disques à l’écran, `screenPawns`) ; ce calcul est sorti dans `actor-screen-proxy.ts`, et le disque d’une personne vue de dessus compte aussi sa largeur d’épaules (0,4 case), sinon il se réduisait à 5 pixels. Les personnes restent prioritaires sur les choses, comme dans le jeu ; un double-clic sur un modèle choisit le groupe de cette chose.
- Le survol (texte de la case) reste lu sur la case du sol.

## Vérification dans le client

Serveur de développement local, son et musique coupés, sur Les Forges (catalogue des colonies de test) :
- une ligne de murs en bois tracée : fantômes en planches translucides, sans boîte à traits ni case teintée ; le dernier clic sur une case déjà prise montre le curseur rouge ; deux lits, l’un tourné : fantômes du lit (cadre, tête, oreiller) chacun dans son orientation ;
- en vitesse ×6, les murs deviennent charpentes puis murs pleins ; un lit en charpente, deux colons au travail cachent le fantôme devant eux ;
- clic sur la face du fantôme d’un mur : « Plan · Mur » ; clic sur le haut de la couronne d’un chêne : le chêne (n° 21037), alors que la case du sol sous la souris était une case de réserve (un clic de l’outil de zone au même endroit l’avait créée) ; clic sur la tête d’un colon : son dossier ;
- fenêtre en arrière-plan (1 à 15 images/s) : pas de mesure d’images par seconde tirée de cette vérification.

## Performances

Banc ciblé empaqueté par esbuild (`scripts/ghosts-pick-bench.ts`) sur Les Forges (7 512 bâtiments, 1 778 piles, 21 122 plantes), 300 chantiers posés en plus des 256 ordres de la partie (dont 113 sacs de sable), soit environ 410 fantômes et 2 140 pièces ; machine partagée et bruyante, médianes de trois à cinq passages ; « avant » = `JobLayer` d’`origin/main` copié dans `tmp/` :
- marques des ordres après un pas d’avancement (le cas fréquent : toutes les 5 % de travail de chaque chantier actif) : avant 1,7 à 2,2 ms, après 1,1 à 1,9 ms (les fantômes ne sont pas touchés) ;
- un chantier posé ou terminé : 3,8 à 5,1 ms, dont environ 1,2 ms d’écriture des matrices des 2 140 pièces ; 28 fantômes redessinés (chantiers serrés tous les 3 × 2 cases), le résultat restant identique à un dessin complet ;
- tous les fantômes redessinés (premier dessin, coupe des murs, nouvelle carte) : 7 à 13 ms, dont 4 à 6 ms de modèles ; avant la réduction du contexte et l’incrémental, 34 ms ;
- clic : le rayon contre les modèles coûte 1,1 à 1,3 ms par clic en médiane, pour 1,5 à 3 ms de liste de case, une seule fois par clic (la cible est gardée pour les trois questions du clic) ; le premier clic mesure en plus les sommets des sortes de bâtiments croisées par le rayon (6 à 17 ms au total, une fois) ;
- rien n’est calculé par image : les fantômes restent dans leurs lots résidents, le rayon ne part qu’au clic ;
- 72 rayons sur 400 tirés au hasard avec la caméra par défaut touchent un modèle dessiné au-dessus d’une autre case que celle du sol (surtout arbres et murs).

## Tests

`tests/retours-20261122-ghosts-picking.test.ts` (27 cas). Anciens tests mis à jour parce qu’ils vérifiaient la boîte en fil de fer ou la case teintée : `biofuel-presentation-v283`, `bridge-presentation-v387`, `confirmed-job-markers-v426`, `door-over-wall-presentation-v483`, `geothermal-presentation-v440`, `instance-target-preview-v300`, `ship-parts-presentation-v452`, `ship-reactor-presentation-v451`, `tree-designation-render-v349`. Voisins relancés (sélection, cartes et fantômes du curseur, bardage, murs liés, présentations de chantier) : aucun échec hors de `known-failures.json`.

## Reste à faire

- Le fond sombre de la charpente du jeu n’est pas dessiné (les coins et les tuiles suffisent à lire l’avancement sous le fantôme).
- Le clic sur le modèle utilise des boîtes approchées (emprise × hauteur du modèle) : un clic dans le vide à côté d’un meuble bas peut encore le prendre ; un test sur les vraies pièces des lots résidents serait plus précis mais coûterait davantage.
