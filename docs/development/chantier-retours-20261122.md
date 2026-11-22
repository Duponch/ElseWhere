# Chantier des retours du 22 novembre 2026

Liste des retours de l'utilisateur après ses parties du 22 novembre, à traiter au fil du travail, dans l'ordre jugé le meilleur, sans abandonner la [feuille de route](feuille-de-route-20261115.md) ni les [chantiers obligatoires](chantiers-obligatoires.md). **Règle commune : aucun coût supplémentaire notable en performances, et si possible un gain.** Chaque point est coché ici quand il est livré, avec le lien vers sa note.

## A. Animations et poses

1. **Fin de marche qui glisse.** Un colon ou un animal arrête son animation de marche juste avant d'arriver et finit les derniers centimètres en glissant. Le même défaut semble toucher les autres animations : à corriger partout.
   **Fait le 22 novembre** : les jambes marchent jusqu'à ce que le corps dessiné arrive et se posent pieds joints ; s'asseoir, se coucher, manger et travailler attendent l'arrivée du corps ; colons et animaux ([note](retours-animations-20261122.md)).
2. **Tête qui dépasse du lit.** Un colon couché doit garder la tête sur le lit ; si le lit est trop court, ce sont les pieds qui dépassent.
   **Fait le 22 novembre** : tête au chevet pour toutes les couchettes et orientations, comme `PawnRenderer.GetBodyPos` ([note](retours-animations-20261122.md)).
3. **Travailler assis.** Un colon à un établi ne s'assoit pas sur le tabouret placé devant. Vérifier dans RimWorld s'il s'assoit et ce que cela change (confort, vitesse), puis confirmer ou corriger.
   **Fait le 22 novembre** : RimWorld assoit le colon sur un siège de la case de travail et lui donne du confort, sans effet sur la vitesse ; règle d'Elsewhere déjà conforme (lot 350), pose assise ajoutée ([note](retours-animations-20261122.md)).
4. **Animations assises et autres.** Un colon assis reste immobile, les bras le long du corps : il doit être animé de façon réaliste. Beaucoup d'autres animations manquent ou sont trop simples ; les enrichir en général.
5. **Corps à corps.** Supprimer l'effet de nuage de bande dessinée avec étoiles. Refaire l'attaque comme dans RimWorld : un coup en avant de tout le corps, comme un coup de boule, en plus de l'animation du corps ; pareil pour les animaux. Une bagarre doit se voir facilement.
   **Fait le 22 novembre** : nuage retiré ; coup en avant de tout le corps (0,35 case) et recul de la victime touchée (0,17), comme `Notify_MeleeAttackOn` et `JitterHandler`, pour les humains et les animaux ([note](retours-animations-20261122.md)).
6. **Animaux.** Ajouter des animations (attente, idle et autres ; aujourd'hui surtout marche, course et manger, à confirmer). Améliorer les modèles bâclés ou trop semblables entre espèces, en volume et en dessin (Pastel et Gouache).
7. **Page des animations.** Une page développeur qui montre toutes les animations existantes, à côté de la page des modèles.

## B. Effets visuels

8. **Particules d'action à refaire de zéro.** Abattre, miner, cuisiner et toutes les actions : les particules actuelles sont laides, mal placées, mal animées et ressemblent à des SVG. Les refaire en vrais dessins cohérents avec la direction artistique, au niveau des mains ou de la zone de l'action, pour masquer l'absence de mains et d'animations fines, et en ajouter à toutes les actions qui n'en ont pas.

## C. Modèles et affichage

9. **Bébés animaux trop petits** pour certaines espèces : taille minimale. *Fait le 22 novembre : chaque stade est dessiné à la `drawSize` du jeu (veau de muffalo à la moitié de l’adulte, plus jamais au cinquième) ; voir la [note du lot 3](retours-20261122-lot3.md).*
10. **Couleur du muffalo** : vérifier celle de RimWorld (il n'est pas brun foncé) et corriger en Pastel et en Gouache. *Fait le 22 novembre : pelage gris bleuté pâle tiré de la texture du jeu, dans les deux styles ; écarts relevés sur d’autres espèces listés dans la [note du lot 3](retours-20261122-lot3.md).*
11. **Buissons** : remettre le modèle d'avant la refonte Gouache/Origami (proche des fragments). *Fait le 22 novembre : buisson bas à facettes rétabli dans les deux styles ; voir la [note du lot 3](retours-20261122-lot3.md).*
12. **Fragment de calcaire posé sur une chaise** : à corriger. *Fait le 22 novembre : le jeu autorise un objet sur une chaise et le dessine au-dessus ; l’objet est maintenant posé sur l’assise au lieu de la traverser ; voir la [note du lot 3](retours-20261122-lot3.md).*
13. **Chantiers lancés** : afficher la forme fantôme de l'objet (la même que sur le curseur avant de le placer) au lieu de cubes à traits, et ne plus colorer ses cases en bleu. *Fait le 22 novembre : chaque chantier est le fantôme du curseur (même modèle, teinte et transparence), tourné comme posé, caché par ce qui est devant ; plus de boîte à traits ni de case teintée ; charpente avec les coins et les tuiles d’avancement du jeu ; voir la [note du lot](retours-20261122-vague2-lot1.md).*

## D. Sélection et interface

14. **Sélection plus robuste** : on ne peut pas sélectionner une applique murale (le clic prend le mur). *Fait le 22 novembre : applique trouvée sur son mur et visée sur sa face, ordre et cycle de clics du jeu, l’inspecteur ne bloque plus les clics dans la carte ; voir la [note du lot 3](retours-20261122-lot3.md).*
15. **Clic sur le modèle** : pouvoir sélectionner un objet, une personne ou un animal en cliquant sur son modèle 3D, pas seulement sur sa case, si c'est possible sans coût notable. *Fait le 22 novembre : au clic, le rayon de la caméra prend d’abord le modèle touché (couronne d’arbre, face d’un mur, flanc d’une pile, fantôme), puis la liste de la case dans l’ordre du jeu ; personnes et animaux visés sur leur pose dessinée ; environ 1 ms par clic ; voir la [note du lot](retours-20261122-vague2-lot1.md).*
16. **Noms dans la barre des colons** : RimWorld n'affiche que le surnom sous l'avatar (« LeSombre »), pas le nom complet (« Umbre « LeSombre » Nighthawk »). *Fait le 22 novembre : surnom sous le portrait, nom complet dans l’info-bulle ; voir la [note du lot 3](retours-20261122-lot3.md).*
17. **Grand chantier des interfaces** : réorganiser HUD, fenêtres et mises en page pour être fidèle à RimWorld (dispositions, nombre d'éléments par zone, longueur des défilements, accessibilité, ergonomie, tailles des fenêtres), à partir de sources visuelles du vrai jeu. L'utilisateur signale l'outil « pbakaus/impeccable » pour Claude Code, à examiner.

## E. Animaux en enclos

18 bis. **Animaux qui traversent les clôtures** (signalé le 22 novembre sur la partie « Yes » importée) : des canards sortent de l'enclos en passant les barrières comme si elles n'existaient pas. Vérifier la règle (ce que les clôtures bloquent dans RimWorld) et l'import (clôtures, portillons, enclos), puis le ramassage à la corde des animaux sortis pour les ramener à l'enclos. Fait le 22 novembre (schéma 377) : enclos donné à l'import, canards et portillons corrigés, voir [la note](../gameplay/animals-to-pens-377.md).
18. **Mener les animaux à l'enclos** : les colons semblent avoir du mal à amener les animaux tenus à la corde ; comparer avec RimWorld (confirmer ou infirmer). La corde traverse les murs (le colon d'un côté, l'animal derrière le mur) : à corriger.
   **Fait le 22 novembre (schéma 377)** : confirmé, la bête cherchait sa propre route et le colon la suivait pas à pas ; désormais le colon marche sa route à l'allure de la bête la plus lente et les bêtes suivent sa trace 2 à 5 cases derrière comme dans RimWorld (3 bêtes rentrées en 77 ticks au lieu de 346), la corde passe par cette trace sans traverser les murs. Retour ajouté : les canards et le troupeau d'une partie importée sortaient de l'enclos (enclos non repris à l'import, canards qui passaient les clôtures, portillon ouvert franchissable) ; corrigé, aucune sortie en 2 000 ticks ([note](../gameplay/animals-to-pens-377.md)).

## F. Son

19. **Page des sons complète** : lister tous les sons et musiques du jeu (pas seulement les nouveaux), avec un réglage manuel du volume de chacun et un enregistrement de ces réglages. — **Fait le 22 novembre** : la page montre les 87 sons (239 prises) et les 10 musiques par famille, avec gain et niveau mesuré ; un curseur par son, par prise et par musique ; « Enregistrer » écrit `public/assets/audio/gain-offsets.json`, appliqué par le jeu au chargement ([note](audio-coverage-20261122.md#réglages-manuels-page-des-sons)).
20. **Couverture sonore du jeu lui-même** : les nouveaux sons visent surtout l'interface et les alertes ; il manque énormément de sons de jeu (actions, travaux, animaux, environnement…).

## G. Pages développeur

21. **Une section « Développeur » dans les Options** avec un lien vers chaque page développeur (modèles, sons, lore, pictogrammes, navigation, animations, règles…), tenue à jour au fil du projet. — **Fait le 22 novembre** : Options → Développeur ouvre chaque page dans un nouvel onglet ; une seule liste (`src/ui/developer-pages.ts`) sert aussi les builds local et publié ([note](developer-pages.md)).
22. **Page des règles du jeu** : toutes les règles, boucles de jeu et calculs, organisés, accessibles et aussi exhaustifs que possible, pour que le moteur n'ait plus de secret. — **Fait le 22 novembre** : `rules.html` (Options → Développeur, publiée) décrit 93 règles en 20 domaines, avec 240 nombres et 75 tableaux lus dans le code, la source de chaque nombre et l'écart éventuel avec le jeu de base ; un test refuse un nombre écrit à la main ou un fragment de code disparu. Domaines partiels et parties pas encore décrites listés dans la page ([note](rules-page.md)).

## Ordre retenu au départ

- **Vague 1** : pages développeur et page des sons complète (19, 21) ; animations de fin de marche, lit, établi assis et corps à corps (1, 2, 3, 5) ; petites corrections visuelles et sélection (9, 10, 11, 12, 14, 16).
- **Vague 2** : fantômes des chantiers et clic sur le modèle (13, 15) ; animaux en enclos (18) ; page des règles (22).
- **Vague 3** : particules refaites (8) ; animations assises et animaux (4, 6, 7) ; couverture sonore du jeu (20).
- **Vague 4** : grand chantier des interfaces (17).
