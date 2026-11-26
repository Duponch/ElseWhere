# Comparer le rendu WebGPU de la colonie entre Window et Worker

Depuis la racine du dépôt, avec les dépendances du projet installées et Chrome disposant de WebGPU, lancer la commande suivante.

```powershell
node scripts/check-worker-colony-scene.mjs
```

Le banc charge la sauvegarde distribuée `public/test-saves/v432/les-forges-crash-test.json`. Chaque contexte utilise le décodeur de sauvegardes et les migrations du jeu. Playwright sert les fichiers locaux au navigateur. La scène partagée utilise les couches de murs, portes et colons du jeu, sa caméra et son éclairage avec ombres. Les bâtiments restants, le terrain, la faune, la simulation en cours et l'interface sont hors du périmètre de ce contrôle.

Chrome dessine la première scène dans un canvas ordinaire. Il transfère le second canvas à un Worker dédié qui initialise son propre appareil WebGPU et soumet la même scène. Le banc compare les captures du compositeur en RGBA sur deux angles de vue et répète la première image à colonie figée. Il masque ensuite, à tour de rôle, les murs, les portes, les colons et les ombres. Chaque retrait doit changer des pixels à l'écran, et les deux chemins doivent produire la même image pour chacun des sept états. Le contrôle compare aussi les matrices de caméra, les nombres d'appels de dessin et de triangles, et l'état de la carte d'ombres.

Les captures PNG, l'empreinte SHA-256 de la sauvegarde et les résultats sont écrits sous `tmp/test-runs/worker-colony-scene/run-*/`. Une divergence de pixels, un calque masqué sans effet visible ou une erreur GPU/JavaScript font échouer la commande. Ce banc mesure la fidélité du sous-ensemble rendu. Les performances en jeu se mesurent dans le client complet.

## Monde figé avec SceneRenderCore

```powershell
npm run build:pages
node scripts/check-worker-colony-scene.mjs --full
```

Ce mode utilise le code source courant de `SceneRenderCore` et le Worker de présentation construit dans `dist/assets` par la commande précédente. Chaque contexte recharge Les Forges à partir du fichier distribué, valide son message initial et garde son propre propriétaire natif du monde. Les fichiers de textures proviennent du même build. Le Worker dédié dessine la colonie figée avec les couches du monde, les étiquettes, la pièce et les ombres du style par défaut. Les deux rotations de caméra sont programmées. L'interface NativeStage, les interactions clavier/souris, l'audio et la simulation en mouvement restent hors du contrôle.

Dans la référence Window, les images passent par le chargeur de textures Three.js du jeu. Pour le canvas transféré, la page décode les fichiers PNG et SVG réels, dont le pictogramme vectoriel généré par le jeu. Elle transmet chaque `ImageBitmap` au Worker, qui l'utilise comme texture et le libère à la destruction de celle-ci. Les captures comparent également le résultat de ces deux chemins de décodage.

Le navigateur accède aux fichiers via les routes locales de Playwright. Le module du Worker enfant utilise une URL Blob du même navigateur pour fonctionner hors réseau. Les octets reçus sont vérifiés par SHA-256 avant la création du Worker et la réception native conserve son contrôle d'identité. Un futur build qui découperait ce module en imports relatifs fera échouer ce banc. Les mesures et les captures de chaque passage aboutissent dans un nouveau dossier `tmp/test-runs/worker-colony-scene/full-*/`.

Avec `node scripts/check-worker-colony-scene.mjs --advance`, chaque simulation reçoit en plus l’action de développement « Avancer le temps » d’une heure de jeu. Le banc exige un deuxième monde confirmé au tick 585, soit 250 ticks après le premier, et compare les pixels, les triangles, les matrices de caméra et le numéro de Core sur ce monde. Les deux contextes utilisent le même client de simulation et le même moteur de scène que la vue expérimentale.

## Colonie en mouvement dans la vue expérimentale

```powershell
npm run build
node scripts/check-worker-colony-live.mjs
```

Ce contrôle ouvre la page locale `worker-colony.html`. Il utilise ses boutons de vitesse, la souris et le clavier. Sur Les Forges, il exige une progression de la simulation et des phases reçues à ×1, ×3 et ×6, la stabilité du tick en pause, des publications dans l’ordre, des soumissions WebGPU et une file sans débordement. Il déplace, tourne et zoome la caméra, redimensionne la page, ouvre un fichier invalide pendant que la simulation tourne et rouvre Les Forges. Le journal et la capture de la carte arrivent dans un nouveau dossier `tmp/test-runs/worker-colony-live/run-*/`.

Le banc sert le build par HTTP local. Sur un profil Chrome qui refuse les connexions loopback, Playwright sert les mêmes fichiers et le banc remplace seulement l’URL du Worker enfant par une URL Blob construite avec les octets du module de simulation. Le rapport consigne le transport et l’empreinte du module utilisé dans ce cas. La page livrée charge normalement ses scripts depuis leur URL Vite.

L’option `--pick-reference=<chemin-du-result.json>` utilise les points relevés dans le rendu Window du banc `--full` ou `--advance`. Le contrôle ouvre la colonie en pause et adapte la surface à la résolution de référence. En mode scène seule, il exige l’identité de tous les pixels RGBA de l’image épinglée avec le fichier `window-first.png` du même dossier. Il vérifie aussi l’identité de l’image épinglée avec le canvas affiché juste avant le clic, y compris lorsque le HUD est activé. Il clique sur un acteur puis sur une case ou un objet et vérifie le tick, la caméra, l’identité de l’acteur, les coordonnées de la case et l’identité de l’objet lorsqu’il y en a un.

Pour mesurer une fenêtre de 60 secondes en 1440 × 1000, lancer la commande suivante après le build local.

```powershell
node scripts/check-worker-colony-live.mjs --measure --speed=6 --seconds=60
```

La page `worker-colony.html?hud=speed` compose les quatre cartons de vitesse sur le GPU de la carte. La page sans ce paramètre garde la vue de la seule scène. Les contrôles suivants utilisent le build local et la sauvegarde de test Les Forges.

```powershell
node scripts/check-worker-colony-scene.mjs --advance --speed-hud
node scripts/check-worker-colony-live.mjs --speed-hud
```

Le premier contrôle compare chaque pixel du rendu Worker avec les quatre pièces de `NativeHudCards` peintes sur le fil principal, après stabilisation de leur pose. Il vérifie aussi que les pixels de la carte hors de la bande des commandes sont identiques à ceux de la même caméra au même tick. Le second clique sur vitesse normale, ×3, ×6 et Pause, vérifie la vitesse confirmée et relâche une pression sur un autre carton pour contrôler son annulation. L’option `--pick-reference=<chemin-du-result.json>` permet d’enchaîner le contrôle des sélections de la carte dans la même ouverture.

La mesure utilise Chrome avec le plafonnement de cadence et la synchronisation verticale désactivés. Entre deux états confirmés du Worker, elle relève le débit des soumissions et la progression des ticks de jeu, les intervalles entre callbacks d’animation du fil principal et le retard d’un temporisateur de 16 ms. À la fin, elle mesure le délai entre un clic sur Pause, la publication de la vitesse effective et l’accusé de réception de la commande. Les valeurs concernent cette vue de colonie et sa surface de rendu, dont les dimensions figurent dans le rapport. La variable `LISIERE_WORKER_COLONY_DIST` permet de choisir un autre dossier de build local.
