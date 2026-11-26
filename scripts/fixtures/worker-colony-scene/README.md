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
