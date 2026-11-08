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
