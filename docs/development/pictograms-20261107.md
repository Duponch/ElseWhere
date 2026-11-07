# Pictogrammes du 7 novembre 2026

Demande : refaire tous les petits symboles du jeu avec un dessin manuel plus
maîtrisé et une lecture immédiate, sans refaire les interfaces ou leurs boutons.

## Direction et périmètre

L'ancien tracé natif cumulait des variations de rayon de 24 %, des décalages
de coins de 5 pixels et plusieurs traits qui dépassaient aux intersections.
Certains choix étaient ambigus : sapin pour Faune, croix pour Assignations,
fusée commune aux poutres et moteurs, mêmes pictos pour différents meubles.

Le nouveau catalogue conserve une légère asymétrie dans les contours, des
courbes souples et une palette mate. Le trait est continu et plus fin, les
formes sont construites. Faune reçoit une tête de cerf ; Assignations une fiche
avec une personne ; Ordres une liste cochée. Les variantes utiles ont leurs
propres détails (oreillers, mécanisme, outils, type d'appareil).

`src/ui/picto-artwork.ts` est la source commune Canvas/SVG. Les courbes sont
préparées une seule fois, puis réutilisées dans les textures existantes de l'UI.
Aucun modèle 3D du monde, panneau, bouton, police, emplacement ou interaction
du jeu n'est remplacé. Les formes extrudées des pictos météo sont conservées.
Les matières d'un même objet partagent volontairement leur silhouette.

Le générateur produit 565 SVG transparents dans
`public/assets/ui/elsewhere/pictograms-20261107/`, rafraîchit 271 anciennes URL
individuelles et les trois planches UI/Architecte. Les grilles et coordonnées
des marqueurs restent inchangées. Les anciens PNG d'archives et les curseurs
carton ne font pas partie des images remplacées ; les contrôles de temps
utilisent les nouveaux SVG. Les commandes de vue, les saisons et les
recherches utilisent aussi le catalogue commun. Les portraits de personnages restent inchangés.

## Régénération et contrôle

Depuis la racine du worktree, avec les dépendances du projet disponibles :

```powershell
npx vite build --ssr scripts/rebuild-pictograms.mts --config scripts/pictograms-vite.config.mts --outDir tmp/pictograms-generator-build
node tmp/pictograms-generator-build/rebuild-pictograms.js
npx vite build --config scripts/pictograms-vite.config.mts
```

`pictograms-review.html` est la source de la planche filtrable : tailles
24/32/48/64/96 px, fonds crème/carton/sombre et recherche par identifiant.
La version autonome de revue se trouve dans `docs/reviews/`.
L'inventaire détaillé du générateur se trouve dans `tmp/pictograms-inventory.json`.

## Vérifications

La vérification finale dédiée passe : **44 tests dans huit fichiers**. Elle
couvre tous les objets, outils et projets de recherche, les SVG effectivement
livrés, les variantes reconnaissables, la conservation des états Canvas, les
adresses des marqueurs, les commandes du HUD et le disque des boutons de
vitesse, dont le dessin reste identique entre les états sélectionné et normal.

Le contrôle navigateur des **565 SVG** ne rencontre aucune image vide, aucun
coin opaque, aucun échec de décodage et aucune erreur JavaScript. La recherche,
les filtres combinés, les tailles 24 et 32 px, les trois fonds et les largeurs
1280/390 px sont contrôlés. La planche HTML autonome fonctionne sans réseau.
Les captures sont inspectées aux tailles normales et petites.

Le parcours étendu des tests historiques rencontre **27 échecs déjà présents
sur `666d598c`**. Les douze fichiers concernés sont exécutés dans une copie de
référence propre : les 27 cas et leurs premiers messages d'échec sont identiques.
Cela concerne notamment d'anciens nombres de sommets, cadres d'atlas, règles
de mousse, coordonnées de recherche et activités d'armes. Les assertions
portant sur les anciens chemins d'images et l'égalité avec les portraits 3D
sont adaptées à la nouvelle livraison SVG ; les assertions sur les modèles
et les règles du jeu restent conservées.

Les 15 échecs du harnais de sélection `native-hud-speed-selection-v486` se
reproduisent également sur la base : son extraction de `refreshNativeUi` ne
fournit pas `launchProgress`. `main.ts` et `NativeStage.ts` sont byte-identiques
à la base dans cette branche. Ce contrôle ne démontre pas une erreur dans le
jeu joué. Les copies de référence sont retirées après comparaison.

TypeScript complet et compilation Pages : **PASS**. Les 565 fichiers SVG du
paquet construit sont byte-identiques aux sources, pour 740813 octets au total.
Le paquet de contrôle temporaire est retiré après ce contrôle pour éviter une
copie durable des ressources publiques. Aucune publication n'est effectuée.

## Fond des menus — reprise du 7 novembre

La reprise se fait dans le même worktree, après le commit local des pictos
`a17ff7ce`. Une illustration originale de colonie en carton découpé, papier
plié et gouache est ajoutée : cabanes, potager, atelier, rivière et montagnes,
avec une prairie dégagée à gauche. Aucun texte ou bouton n'est peint dans
l'image. Les vrais panneaux et commandes conservent leur présentation.

Le fichier livré est
`public/assets/ui/elsewhere/menu/background-20261107.webp`, 1672 × 941 pixels,
523234 octets. Il est partagé entre le menu HTML et les menus 3D natifs.
Le cadrage remplit l'écran en conservant les proportions de l'image.
La texture native est non éclairée, derrière les commandes, masquée pendant
la partie et libérée à la fermeture du renderer. Un chargement lent ou refusé
ne bloque pas la navigation. Aucun changement de simulation ou de sauvegarde.

Sept contrôles couvrent le cadrage 16:9, ultralarge, 5:4 et portrait, le
chargement tardif pendant une partie, l'échec de chargement et la libération
des ressources après fermeture. Les douze contrôles existants des menus
Accueil/Options/Chargement/Scénario/import/téléchargement passent également.
TypeScript complet : PASS.

Le parcours visuel reproductible est `node scripts/review-front-background.mjs`.
Il compose les vrais `NativeStage` et `createNativeFrontMenu` hors réseau, avec
des services UI factices, sans monde ni simulation. L'URL du fond est embarquée
pour ce contrôle seulement ; le paquet produit garde son URL normale. Les
captures et le reçu sont dans `tmp/front-menu-background-qa/`. Le navigateur
de contrôle est fermé à la fin. L'accès du navigateur automatique au serveur
local est refusé par l'environnement ; le navigateur intégré est indisponible.
Ce contrôle de composant ne vaut donc pas parcours complet d'une partie.

Revue finale PASS : Accueil à 1920 × 1080, 1280 × 720 et 2560 × 1080,
Options, Chargement et Scénario, retours à l'accueil, fermeture/réouverture
du menu et retrait du canvas à la destruction. Backend du contrôle : WebGL 2,
aucune erreur JavaScript ou du renderer. Les captures ont été inspectées.
Compilation Pages PASS en 9,53 s ; fond et 565 SVG du paquet byte-identiques
aux sources. Reçu : `docs/reviews/front-menu-background-validation.json`.
Les avertissements de taille des chunks et d'import statique/dynamique
restent ceux du projet ; aucune optimisation ne fait partie de cette reprise.

## Isolation et fusion ultérieure

Base : `666d598c`. Branche : `art/pictograms-adult-handdrawn`.
Les métadonnées Git du dépôt principal étant protégées dans cette session,
le worktree dépend d'un dépôt local auxiliaire, avec lecture partagée des objets
Git du dépôt principal. Aucun historique ou fichier en cours du principal
n'a été modifié. Aucune dépendance npm n'a été recopiée.

* Worktree : `E:/Code/RimWorld/tmp/pictograms-worktree`
* Dépôt auxiliaire : `E:/Code/RimWorld/tmp/pictograms-isolated-repository`

Une fois la revue acceptée, depuis le principal dans une session où Git est
accessible en écriture :

```powershell
git fetch ./tmp/pictograms-isolated-repository art/pictograms-adult-handdrawn
git merge --no-ff FETCH_HEAD
```

Après résolution des éventuels conflits et validation de la fusion :

```powershell
powershell -File scripts/finish-pictograms-worktree.ps1
```

Le script refuse la suppression tant que le commit de la branche n'est pas
ancêtre du HEAD principal ou que le worktree contient des modifications.
Il retire uniquement ces deux chemins exacts sous `tmp`. Ne pas supprimer le
dépôt principal ou son magasin d'objets avant la fusion. Aucune fusion,
publication ou suppression du worktree n'est faite par cette livraison.
