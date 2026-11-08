# Pictogrammes seuls sur les boutons

Demande du 8 novembre : retirer les disques crème à contour noir derrière les
pictogrammes, en conservant les boutons, leurs libellés et leurs interactions.

Les SVG sont déjà transparents. Les médaillons étaient peints séparément dans
les boutons de gestion, les vitesses, Ordres/Zones et les tuiles/navigation
d'Architecte et des autres pages. Ces quatre décorations sont retirées.
Les centres et tailles des pictos sont conservés. Les quatorze tirages de
décoration sont consommés sans dessin lorsqu'ils précédaient un libellé : le
tracé aléatoire déterministe des étiquettes reste donc identique. Les disques
utiles au dessin d'un objet, les portraits et la texture du carton restent
inchangés. Aucun changement de simulation ou de sauvegarde.

Worktree : `E:/Code/RimWorld/tmp/pictograms-without-discs`.
Branche : `art/pictograms-without-discs`, base `c6ca03d7`.
Il utilise le dépôt auxiliaire `tmp/pictograms-isolated-repository` ; conserver
ces métadonnées tant que ce worktree n'est pas fusionné et retiré.
Le worktree principal contient du travail de simulation en cours : il n'est
ni modifié, ni réinitialisé, ni fusionné par cette correction.

Contrôles acquis : 13 tests ciblés (HUD, catalogue des pictos, Architecte),
TypeScript complet et `git diff --check` PASS. L'ancien contrat qui imposait
un disque aux vitesses est remplacé par l'absence du fond crème et la
conservation de la géométrie du picto entre sélection et repos.

Revue visuelle PASS via `node scripts/review-bare-pictograms.mjs` : composants
natifs réels à 1440 × 900, sans monde ni simulation. Barre de gestion et
tuiles/navigation Architecte rendues en WebGL 2 ; vitesses peintes avec leur
vrai producteur Canvas sur des aplats de contrôle. Aucun médaillon blanc ou
contour circulaire derrière ces pictos, aucune erreur du renderer/JavaScript.
Capture inspectée : `tmp/bare-pictograms/review.png`. Ce contrôle de composants
ne constitue pas un parcours complet de partie ou une mesure de performance.

## Pictos agrandis

La demande suivante remplace les anciens rayons fixes par un ajustement à la
silhouette réellement dessinée, trait compris, sans changer ses proportions.
Les bornes sont calculées une seule fois par picto, puis réutilisées lors des
repeints existants. Aucun traitement supplémentaire par image ou chargement.

Marges réservées : 9 px sur les tuiles et catégories, 8 px avant le libellé,
et une bande supérieure supplémentaire pour un raccourci tel que « B ».
La barre de gestion réserve 12 px latéraux et sa zone de libellé actuelle.
Les vitesses gardent une marge de 6 unités dans leur espace 48 × 37 ;
Ordres/Zones gardent 7 px entre leur pictogramme et le bord/leur étiquette.
Les médaillons restent supprimés et les boutons conservent leurs dimensions.

Les 13 tests ciblés passent après agrandissement. La revue hors réseau montre
les nouvelles tailles sur les vrais boutons de gestion, les tuiles, les
catégories et les vitesses ; aucun monde de simulation n'est créé.

TypeScript final PASS. Contrôle raster des 438 identifiants UI/outils/objets
distincts : chaque picto peint dans sa boîte, sans pixel en dehors de la
tolérance d'anticrénelage d'un pixel. Revue WebGL 2 finale sans erreur,
avec le raccourci « B » conservé au-dessus du picto de mur.

## Marge supplémentaire sur la barre du bas

À la demande suivante, seuls les pictos des boutons de gestion de la barre
inférieure sont réduits de 20 % par rapport à l'agrandissement précédent.
Ils restent centrés dans la même zone au-dessus de leur libellé, avec un retrait
supplémentaire de 10 % sur chaque côté de cette zone. Les tuiles d'Architecte,
les vitesses et Ordres/Zones gardent les tailles précédemment validées.
Les dimensions, couleurs, libellés et interactions des boutons sont conservés.

Validation de cet ajustement : 13 tests PASS, revue visuelle WebGL 2 inspectée,
438 pictos vérifiés dans leurs boîtes, aucune erreur JavaScript/renderer et
`git diff --check` PASS.

## Dernier ajustement : marge et vitesses dessinées

La barre inférieure réduit encore ses pictos de 5 % par rapport au réglage
précédent : sa boîte passe de 80 % à 76 % de la zone disponible, toujours
centrée. Les autres marges restent inchangées.

Pause, lecture, double et triple vitesse sont redessinées dans la source
commune Canvas/SVG : bords doucement courbes, coins arrondis à la main,
légères asymétries fixes, palette sauge/bleu mat et traits de pigment clair.
Leurs deux barres ou une/deux/trois flèches restent immédiatement lisibles.
Les quatre SVG publics correspondants sont régénérés ; le reste des images,
les boutons, leurs états et les valeurs de vitesse ne changent pas.

Les 13 tests ciblés passent après cette modification.

TypeScript final PASS ; revue WebGL 2 inspectée sans erreur, avec contrôle
raster de 442 pictos, dont les quatre symboles de temps redessinés.
