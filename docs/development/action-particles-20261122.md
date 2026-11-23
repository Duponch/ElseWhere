# Particules d’action refaites (retours du 22 novembre, vague 3, lot 1)

Point 8 du [chantier des retours](chantier-retours-20261122.md). Présentation seulement : aucune règle du jeu, aucun changement de schéma (376 inchangé), rien d’enregistré dans les sauvegardes.

## Constat

Les anciennes marques d’action (`ActionVfxLayer`) étaient des formes vectorielles calculées dans le nuanceur : tomates, carottes, loupes, fioles, ciseaux, étoiles, gouttes et copeaux stylisés, huit par acteur, qui flottaient au-dessus de la cible. Elles ressemblaient à des icônes, ne suivaient aucune trajectoire physique, n’étaient pas au niveau des mains et la plupart des actions n’en avaient pas (semer, récolter, nettoyer, soigner, opérer, enterrer, traire, tondre, transporter…). Or les colons d’Elsewhere ont peu d’articulations et pas de doigts : les particules doivent montrer ce que font les mains.

## Le jeu de base

Les effets de travail de RimWorld 1.6 sont des `EffecterDef` (Defs/Effects) qui projettent des motes et flecks 2D vus de dessus, au rythme du travail ou des coups :

| Effet du jeu | Ce qu’il projette | Rythme et durée |
| --- | --- | --- |
| `Mine` | éclair d’étincelle à chaque coup (`SprayerTriggered`, `SparkFlash`) | à chaque coup de pioche |
| `Harvest_Tree` | copeaux de bois (`HarvestWood`), rafales de 5 à 7 | toutes les 60 ticks ; vie 0,04 + 0,15 + 0,1 s |
| `Harvest_Plant`, `Sow`, `Clean` | terre (`DirtBits`), poussière épaisse (`DustPuffThick`) | toutes les 14 à 17 ticks ; poussière 0,1 + 0,6 + 1,4 s |
| `ClearSnow`, `BuryPawn` | flocons (`SnowBits`), poussière (`DustPuff`) | au hasard (0,06 et 0,035 par tick) |
| `ConstructWood/Metal/Dirt`, `RoofWork`, `Repair` | poussière ; étincelles et éclats projetés pour le métal et la réparation (`SparkThrown`, 7,2 à 24 de vitesse) | 0,035 à 0,2 par tick ; étincelle 0,08 + 0,33 + 0,85 s |
| `Cook`, `ButcherFlesh`, `Surgery`, `CutStone`, `Tailor`, `Smith`, `Sculpt`, `Smelt`, `Cremate` | morceaux (`Mote_CookBit`, `Mote_FoodBitMeat`, `Mote_StoneBit`) à 0,6 case de la cible, échelle 0,3 à 0,7 | toutes les 20 ticks (5 pour la fonte) ; vie 0,08 + 0,4 + 0,25 s |
| `Research` | feuillets (`ResearchPage`) projetés, bouffée d’air | toutes les 40 ticks ; feuillet 0,04 + 1 + 0,1 s |
| `EatMeat`, `EatVegetarian` | miettes de viande ou de légumes | toutes les 20 ticks |
| `SleepZ` (fleck) | Z au-dessus du dormeur | 0,08 + 1,4 + 1,5 s |

Elsewhere reprend ces familles, rythmes et durées, adaptés à la 3D : chaque particule part du point de contact avec une vitesse, retombe sous la gravité, freine dans l’air, tourne, se pose au sol et s’efface. Le jeu ne dessine rien pour regarder le ciel, discuter ou regarder la télévision ; Elsewhere non plus.

## Ce qui change dans le jeu

- **Toutes les actions courantes ont leurs particules** : 71 actions inventoriées dans `src/render/action-particle-catalogue.ts` (abattre, couper, récolter, semer, transplanter ; miner, lisser, construire en bois, pierre, métal ou tissu, sols, ponts, toits, déconstruire, réparer, installer ; cuisiner, dépecer, démonter un mécanoïde, forger, assembler, coudre, façonner le bois, tailler, sculpter, fondre, incinérer, laboratoire, brasser, raffiner, rechercher, forer, prospecter, réarmer, ravitailler, remplir et tirer un fût ; soigner, opérer, nourrir un patient ; soigner, nourrir, apprivoiser, traire, tondre, abattre un animal ; nettoyer, déneiger, enterrer, dépouiller, éteindre un feu, ouvrir un caisson ; manger, boire, dormir ; lire, billard, jeux de lancer, jeux de table ; ramasser, déposer, soulever un blessé ; coups au corps à corps sur un être de chair, un mécanoïde ou un bâtiment ; brouter, manger et dormir pour les animaux). Les actions volontairement sans particules sont listées dans `ACTIONS_WITHOUT_PARTICLES`.
- **De vrais dessins** : 29 familles (copeaux, échardes, écorce, sciure, éclats et gravillons de pierre, poussière, fumée et vapeur, étincelles, métal chaud, reflets d’outil, copeaux de métal, chutes de tissu, fils, laine, graines, feuilles, herbe, mottes, gouttelettes, sang, pansements, miettes, viande, feuillets, Z, flocons, cendre, mousse), 75 sprites, peints une fois au chargement dans un atlas partagé, avec le même pinceau que les autres bitmaps du jeu (grain de papier haché, traces de poils, jamais de tirage aléatoire). Deux couches : Pastel (pigment craie plus clair, bord friable) et Gouache (pigment opaque, traces de pinceau, fin contour d’encre), choisies selon le style des modèles.
- **Au bon endroit** : sur le tronc côté bûcheron à hauteur de hache, sur la face de la roche tournée vers le mineur, sur l’ouvrage, au bord du plan de travail à sa hauteur, sur le patient, sur le flanc ou devant la tête de l’animal, au museau, à la bouche, au-dessus de la tête du dormeur, sous le toit, sur les flammes (17 règles, `PLACEMENT_RULES`). Les particules de travail attendent que le corps dessiné soit arrivé.
- **Au rythme des gestes** : les rafales partent au moment où la main descend (pioche, hache et marteau : `sin(11 t + w)` du gréement humain ; accroupi : `sin(8 t + w)`), les autres effets (vapeur, feuillets, Z) à leur propre rythme. Les particules suivent l’horloge confirmée de la présentation : elles s’arrêtent en pause et vont trois fois plus vite à ×3.
- **Lisibles au zoom par défaut** : jamais moins de 8 pixels à l’écran, à leur vraie taille de près ; moitié moins de particules entre 9 et 16 pixels par case, aucune en dessous.
- **Teintes vraies** : éclats et poussière de la roche minée (granite, calcaire, marbre, grès, ardoise, minerais), du matériau construit ou démoli, de la terre, du tissu, de l’aliment mangé, de la bière, du lait, du carburant. Les étincelles, le métal chaud et les reflets restent lumineux la nuit ; le reste suit la lumière du jour (au moins 62 %).
- Les anciennes marques (`ActionVfxLayer`, leurs huit sprites vectoriels par acteur et leurs tests) sont retirées.

## Comment c’est fait

- `action-particle-catalogue.ts` : le catalogue (familles, canaux de particules, rythmes, règles de placement), la sélection de l’action d’un humain ou d’un animal à partir de l’instantané confirmé, la détection des événements (ramassage, dépôt, soulèvement, coup), le placement, et un **modèle de référence** du nuanceur (`sampleActionParticle`) qui donne la position, la taille, la rotation et l’opacité de chaque particule à un instant : la page des animations peut s’en servir.
- `action-particle-atlas.ts` : le peintre de l’atlas (512 × 256 par couche, cases de 32 pixels avec 3 pixels de marge, mipmaps).
- `ActionParticleLayer.ts` : un seul dessin instancié, un **réservoir fixe** de 512 émetteurs × 16 quads, une table de paramètres par action et par case (texture flottante lue par le nuanceur), un enregistrement de 64 octets par émetteur (ancre, action, direction, graine, départ d’un événement, teinte, décalage du geste, sol, visibilité). Toute la vie d’une particule (rafale courante, âge, vitesse, chute, atterrissage, frein, battement, rotation, fondu) est calculée dans le nuanceur de sommets à partir de l’horloge et d’un hachage PCG de la graine, de la rafale et de la case : aucune particule n’existe côté processeur.
- Côté processeur : à chaque instantané confirmé, une passe sur les colons (et les animaux qui mangent ou dorment) choisit l’action ; à chaque image, seulement la lecture de trois numéros de version des poses ; les enregistrements ne sont réécrits et envoyés que si une ancre change. Au-delà de 512 émetteurs, les plus proches de la caméra sont gardés.
- Les rafales sont réparties en groupes de cases qui se chevauchent (cases / rafale × période ≥ vie) : une particule n’est jamais coupée avant la fin de sa vie. L’horloge tourne tous les 2π secondes comme celle du gréement ; la fréquence entière des rafales rend ce tour invisible (mêmes particules juste avant et juste après).

## Coût

Mesure dans le vrai client (Chromium avec WebGPU et requêtes d’horodatage GPU, 1440 × 1000, Les Forges : 80 colons, caméra au zoom par défaut centrée sur les colons au travail), outil `scripts/perf-action-particles.mjs` : une fenêtre de chauffe écartée puis trois paires de fenêtres de 3 s, couche dessinée (A) ou masquée (B), à l’arrêt puis à ×1. Avant = `0fba8e09` (anciennes marques), après = ce lot ; mêmes machine et sauvegarde, mesures successives.

| | Avant | Après |
| --- | --- | --- |
| Émetteurs dessinés | 14 | 19 |
| Travail propre de la couche par image (choix + présentation), à l’arrêt | 0,022 ms | 0,006 ms |
| Idem à ×1 (choix des actions à chaque instantané) | 0,102 à 0,106 ms | 0,126 à 0,150 ms |
| Passes GPU par image à l’arrêt, A / B | 4,504 / 4,499 ms | 4,371 / 4,281 ms |
| Image (processeur) à l’arrêt, A / B | 6,50 / 6,46 ms | 6,95 / 6,71 ms |

Charge forcée : 300 émetteurs synthétiques couvrant toutes les actions (4 800 quads), monde à l’arrêt, horloge des particules en marche : passes GPU A / B / A = 4,617 / 4,497 / 4,370 ms, image 7,72 / 7,37 / 7,31 ms, soit un écart dans le bruit des fenêtres. Lecture : pas de coût notable. À l’arrêt la couche ne fait presque plus rien (aucune recopie des poses tant qu’elles ne bougent pas) ; à ×1 le choix par instantané coûte quelques centièmes de milliseconde de plus qu’avant, car il couvre beaucoup plus d’actions, les événements et les animaux. Les fenêtres ×1 sont dominées par le bruit de la simulation (B y est même plus lent que A) : aucun gain n’est revendiqué. L’atlas est peint une fois à la création du rendu (110 à 140 ms dans Node) ; mémoire : atlas 2 × 512 × 256 RGBA (1 Mio, 1,3 Mio avec les mipmaps), table 126 Ko, enregistrements 32 Ko.

## Vu dans le jeu

Client de développement, son et musique coupés, Les Forges et Les Éclaircies, à ×1 et ×3, en Pastel et en Gouache, au zoom par défaut et de près (quatre fois) : vapeur au-dessus de la cuisinière et miettes aux mains du cuisinier ; chutes de tissu blanches aux mains du tailleur ; feuillets qui s’envolent du bureau de recherche (contour d’encre en Gouache) ; feuilles et brins aux mains de la récolteuse ; copeaux de bois pâles projetés du tronc côté bûcheron, à hauteur de hache, une partie cachée par le houppier comme il se doit ; bouffées de poussière aux ramassages et dépôts. À ×3 les mêmes particules vont trois fois plus vite, comme les gestes. Au zoom par défaut ce sont de petites marques de 8 à 12 pixels, lisibles sans masquer les colons ; de près, les dessins (échardes, éclats facettés, gouttes) se reconnaissent. Les particules tombées au sol disparaissent dans l’herbe haute en s’effaçant.

## Contrôles

`tests/action-particles-20261122.test.ts` (7 cas) : chaque action inventoriée a des particules dessinées, une règle de placement et tient dans 16 quads, aucun canal coupé avant sa vie ; les phases de travail confirmées choisissent action, cible et teinte (tâches, factures par poste, recherche, soins, sommeil, animaux) ; les événements ne sont jamais inventés au premier instantané ; les visuels sont une fonction pure de la graine et de l’horloge, continus au tour de l’horloge, au-dessus du sol ; l’atlas est identique à chaque chargement, sans débordement entre cases ; le réservoir ne grandit jamais et rien n’est envoyé tant que rien ne change ; l’ancienne couche est retirée. Le parcours natif `tests/integration/action-particles-20261122.spec.ts` remplace celui des anciennes marques de sommeil.

## Limites

- Le rythme des rafales reprend les formules actuelles du gréement humain (`PawnLayer`) ; si le lot des animations change ces gestes, `WORK_RHYTHMS` doit suivre.
- Le nettoyage dessine aux mains du colon (la tâche ne garde pas la case de la saleté en cours) ; les coups au corps à corps d’un animal ou d’un mécanoïde ne projettent rien (seuls les attaquants humains sont lus) ; l’éclairage local des lampes n’agit pas sur les particules (seule la lumière du jour).
