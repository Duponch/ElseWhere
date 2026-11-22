# Même planète, même graine — premier lot (schéma 376)

Le 22 novembre 2026, à la demande de l'utilisateur : avec la même graine et les mêmes réglages, la planète d'Elsewhere doit être celle que génère RimWorld 1.6, case par case. Ce premier lot fournit l'outil de mesure, le générateur aléatoire et les bruits du jeu, et l'étape de terrain du jeu. **Résultat mesuré sur deux vraies sauvegardes : altitude, relief, température, pluie, marécages, biome, lacs, rivières et grottes sont identiques sur les 119 904 cases.** Les colonies étrangères, les routes et les autres étapes ne le sont pas encore (section 6).

Le code du jeu (Core 1.6.4871) a été lu par décompilation et réécrit dans le nôtre ; aucun texte source n'est recopié. Les sauvegardes de l'utilisateur ne sont que lues : ni modifiées, ni copiées, ni aucune de leurs données par case dans le dépôt.

## 1. Outil de mesure

```
npx tsx scripts/planet-parity.ts <sauvegarde.rws> [...] [--generator=historique|exact|tous] [--table] [--complet]
```

L'outil lit la graine, la couverture, les réglages (pluie, température, population, pollution, liste des factions) et les colonnes par case de la couche de surface de la sauvegarde, génère la planète d'Elsewhere avec les mêmes réglages, puis affiche par champ la part de cases identiques et la distribution des écarts (altitude en mètres, température en °C, pluie en mm, marécages en %), la confusion des biomes et du relief (`--table` : table complète des biomes), les rivières (tronçons et distance à la rivière). `--complet` génère aussi le monde entier (sites anciens, factions, routes, modificateurs) et compare routes, colonies étrangères et grottes. Code : `src/import/rimworld/planet-parity.ts` (pur, testé), `scripts/planet-parity.ts`.

**Comparer comme le jeu enregistre.** La sauvegarde ne garde pas les valeurs flottantes mais des entiers (`SurfaceLayer.TilesToRawData`) : altitude au mètre (au moins 1 m hors de l'eau, `RoundToInt(e + 8192)`), température au dixième de degré (`RoundToInt((t + 300) × 10)`), pluie au millimètre, marécages en 1/255, chaque fois arrondis au pair le plus proche. L'outil quantifie les valeurs générées de la même façon, avec la précision de calcul du jeu (section 3) : deux planètes sont identiques sur un champ quand ces entiers sont égaux.

**Sauvegardes mesurées** (jeu de base seul, couverture 30 %, réglages normaux, 119 904 cases) : `Yes.rws` (graine « poivre », RimWorld 1.6.4633) et `Reference-Core-4871.rws` (graine « Test », RimWorld 1.6.4871). Les 87 sauvegardes « poivre » partagent la même graine et les mêmes réglages ; une sauvegarde au format 1.4 (« champignon »), sans couche de surface, n'est pas lisible par l'outil.

## 2. Ce qui est porté

- **Générateur aléatoire** (`src/sim/verse-rand.ts`) : `Verse.Rand` complet pour la génération — compteur haché par `MurmurHash.GetInt`, graine et nombre d'itérations, pile d'états (`PushState`/`PopState`), `Value`, `Int`, `Bool`, `Range` (entiers et flottants), `RangeInclusive`, `Chance`, `Gaussian` et sa variante asymétrique, `ByCurve`, `Element`, `ElementByWeight`, les variantes « Seeded », `MTBEventOccurs`, et `RandomElement`, `RandomElementByWeight`, `TryRandomElementByWeight` de `GenCollection` (deuxième passe comprise). Aussi `GenText.StableStringHash`, `Gen.HashCombineInt`, `Mathf.RoundToInt`, `SimpleCurve.Evaluate`, `Mathf.Lerp`.
- **Bruits** (`src/sim/verse-noise.ts`, `src/sim/verse-vector.ts`) : modules `Verse.Noise` utilisés par la planète — `Perlin`, `RidgedMultifractal`, `Const`, `ScaleBias`, `Blend`, `Multiply`, `Power`, `Abs`, `OneMinus`, `Filter`, `Clamp`, `InverseLerp`, `Arbitrary`, `CurveSimple`, `AbsLatitudeCurve`, `DistanceFromPlanetViewCenter`, `ConvertToIsland` — et `Vector3.Angle`, `Vector3.normalized`. Le bruit de gradient lui-même (`Utils.GradientCoherentNoise3D`, `MakeInt32Range`, table de gradients) était déjà identique dans `world-coherent-noise.ts` et est réutilisé.
- **Étape de terrain** (`src/sim/world-terrain-core.ts`) : `WorldGenStep_Terrain` dans l'ordre du jeu. Graine de l'étape `HashCombineInt(StableStringHash(graine), 83469557)` (première étape de la couche de surface : `GetSeedPart` n'ajoute rien). Puis, dans cet ordre, les quatre graines du relief (Perlin 0,035 persistance 0,4 six octaves ; ridged 0,012 ; Perlin 0,12 cinq octaves ; continents Perlin 0,01), le mélange des continents (`Range(-0,4 ; -0,35)` sous 55 % de couverture, `Range(0,15 ; 0,25)` sinon, avec la distance au centre de vue pondérée 0,4), le mélange micro/ridged `Range(0,4 ; 0,6)`, l'île (`ConvertToIsland`, niveau de l'eau −0,12) sous 99,99 %, puis (×0,5 + 0,5)³ × 5 500 − 500 ; la température (courbe de latitude 30/29/7/−37, refroidissement de 0 à 40 °C entre 250 et 5 000 m, bruit 0,018 × 4, courbe du réglage) ; la pluie (bruit 0,015, courbe de latitude 1,12…0,05, effet de l'altitude 0,000 222 222 22, relevé des faibles valeurs, puissance 1,5, × 4 000, courbe du réglage) ; le relief (lignes de montagne 0,025, trous 0,06 entre −0,3 et 1, seuils 0,235 / 0,12 / 0,0363, collines 0,19 > 0,46 et 0,032 > −0,3, avec leurs tirages `Bool` et `Range(0, 4)` dans l'ordre des cases) ; les marécages (Perlin 0,09 × ridged 0,025, altitude 750→650 m, pluie 725→900 mm) ; le biome par le meilleur score des quatorze `BiomeWorker` dans l'ordre de la base de définitions (glace de mer avec sa bande bruitée au bord de la partie générée). Les lacs (`WorldGenStep_Lakes`, océans de 15 cases au plus) et les rivières existaient déjà et sont repris tels quels.
- **Maillage** (`src/sim/world-surface-mesh.ts`, géométrie révision 2) : même icosaèdre, mêmes subdivisions, mêmes cases et voisins qu'avant ; seuls les calculs flottants suivent le jeu (section 3). Les centres de 80 % des cases changent d'un ou deux ulps.

## 3. La précision de calcul du jeu

Le jeu tourne sous Mono (Unity), qui **évalue une expression en `float` en double précision et n'arrondit à la simple précision qu'au moment de ranger la valeur** : variable locale, paramètre, champ, élément de tableau, valeur rendue, conversion explicite. Le code porté applique cette règle : `Math.fround` à chacun de ces endroits, et nulle part à l'intérieur d'une expression. Ce n'est pas une hypothèse de lecture : c'est ce que la mesure impose.

- Avec un calcul strict en simple précision (le générateur historique), 40 à 62 altitudes sur 120 000 diffèrent d'un mètre, et surtout une case d'altitude −0,00004 m au lieu d'un peu plus de 0 (case 73 945 de « poivre ») ne tire pas le nombre aléatoire du relief que le jeu tire : tout le relief des cases suivantes est décalé (97,7 % et 93,7 % de relief identique).
- La norme d'un vecteur (`Vector3.Magnitude`) calculée en double avant la racine suffit à rendre le relief, les marécages et le biome identiques sur les deux sauvegardes.
- Les derniers écarts (8 et 11 altitudes, 6 et 8 températures, 1 et 2 pluies) disparaissent avec la même règle appliquée partout : `Vector3.Angle`, la distance au centre de vue (`1 − x` rendu en double), l'île, les courbes, l'arrondi de la sauvegarde elle-même (`(t + 300) × 10` calculé en double puis arrondi une fois).

Deux parties du calcul viennent du moteur natif d'Unity (C++) et sont donc émulées : `Quaternion.AngleAxis` (centre de vue de la planète) et `Quaternion.LookRotation` (cap utilisé par la bande de glace de mer). De même, les fonctions mathématiques (`log`, `sin`, `acos`, `pow`) de V8 et de la bibliothèque C du jeu peuvent différer d'un ulp dans de rares cas. Rien de cela n'a produit d'écart sur les deux sauvegardes mesurées, mais ce n'est pas prouvé pour toutes les graines.

## 4. Mesures par champ

Part de cases identiques, avant (générateur historique, inchangé pour les parties existantes) et après (générateur du jeu, nouvelles parties). Outil : `scripts/planet-parity.ts --complet`.

| Champ | « poivre » avant | « poivre » après | « Test » avant | « Test » après |
|---|---:|---:|---:|---:|
| Toutes les colonnes de la case | 97,66 % | **100 %** | 93,67 % | **100 %** |
| Biome | 99,94 % | **100 %** | 99,72 % | **100 %** |
| Relief | 97,73 % | **100 %** | 93,74 % | **100 %** |
| Altitude (m) | 99,96 % | **100 %** | 99,97 % | **100 %** |
| Température (0,1 °C) | 99,996 % | **100 %** | 99,996 % | **100 %** |
| Pluie (mm) | 99,98 % | **100 %** | 99,96 % | **100 %** |
| Marécages (1/255) | 99,21 % | **100 %** | 96,85 % | **100 %** |
| Tronçons de rivière (même tronçon, même rivière) | 1 016 / 2 105 (48,3 %), 835 | **2 105 / 2 105** | 2 261 / 4 570 (49,5 %), 1 814 | **4 570 / 4 570** |
| Distance à la rivière | 98,14 % | **100 %** | 95,81 % | **100 %** |
| Grottes | 3 443 / 4 464 (77,1 %) | **4 464 / 4 464** | 1 722 / 4 402 (39,1 %) | **4 402 / 4 402** |
| Routes anciennes (même tronçon, même type) | 154 / 550 | 229 / 550 | 203 / 398 | 358 / 398 |
| Toutes routes (même tronçon) | 261 / 2 234 (11,7 %) | 319 / 2 234 (14,3 %) | 324 / 2 510 (12,9 %) | 513 / 2 510 (20,4 %) |
| Colonies étrangères (même case) | 1 / 96 | 1 / 96 | 8 / 97 | 8 / 97 |

Les écarts « avant » restent au plus d'un mètre, d'un dixième de degré, d'un millimètre : le générateur historique était une réécriture déjà proche, à la précision près ; c'est le décalage du tirage du relief qui propage les différences (relief, marécages, biomes, puis rivières et routes).

## 5. Choix de mise en service

- **Parties existantes inchangées.** Une sauvegarde garde ses colonnes de planète ; seule la géométrie est reconstruite, depuis sa révision enregistrée (`geometryRevision`). La révision 1 reste exactement l'ancien maillage : une somme de contrôle du générateur historique et du maillage est identique avant et après ce lot (vérifiée contre le commit de départ, épinglée dans `tests/world-terrain-core.test.ts`).
- **Nouvelles parties : générateur du jeu par défaut**, géométrie révision 2, schéma 376. Raison : tous les champs que produit l'étape portée (relief, altitude, température, pluie, marécages, biome) et ceux qu'elle rend exacts en aval (lacs, rivières, grottes) sont identiques sur les deux sauvegardes mesurées, ce qui remplit la condition « exact pour chaque champ produit ». Les étapes suivantes (sites anciens, factions, routes, modificateurs) sont celles d'Elsewhere, inchangées : elles travaillent désormais sur un terrain plus fidèle. Une option aurait laissé chaque nouvelle partie sur l'ancien terrain pour un gain de sûreté nul (même mécanique, mêmes étapes en aval).
- **Garde de schéma.** `geometryRevision: 2` n'est admis qu'à partir du schéma 376 : une sauvegarde plus ancienne qui le contiendrait est refusée avant toute reconstruction (`preparePlanetHydration256`, `validateGeographicPlanet256`). Migration 375 → 376 par le seul numéro : rien n'est régénéré ni offert.
- **Import RimWorld.** La planète recopiée case par case d'une sauvegarde utilise désormais la géométrie révision 2 : ses centres sont ceux du jeu, pas seulement ses cases et voisins. Le repli par la graine (sauvegarde sans grille) génère le terrain du jeu.
- Le brouillon de monde accepte `terrain: 'historical'`. Les tests qui valident une géographie au schéma 256 (`tests/planet-integration-v256.test.ts`) ou qui renumérotent une nouvelle partie géographique en schéma plus ancien (`tutorial-profile-347`, `tutorial-lessons-349`) l'utilisent : la géométrie révision 2 ne peut pas être retirée d'une telle partie, car le climat du site dépend des centres de ses cases ; `asOldSchema` la garde donc, et la sauvegarde renumérotée est refusée.

## 6. Ce qui n'est pas exact, et pourquoi

Les étapes suivent l'ordre du jeu : terrain (0), lacs (150), rivières (200), sites anciens (300), routes anciennes (400), factions (500), routes (600), modificateurs (700), caractéristiques (1000). Tout est exact jusqu'aux rivières ; les grottes (tirage par case de l'étape des modificateurs) aussi.

- **Premier champ non identique : les routes anciennes (étape 400).** Une partie seulement des tronçons est juste : 358 sur 398 pour « Test », 229 sur 550 pour « poivre ». Les sites anciens eux-mêmes ne sont pas enregistrés dans la sauvegarde et n'ont donc pas pu être vérifiés. Raisons identifiées à la lecture du code : le jeu trie les chaînes de sites avec `List.Sort`, un tri introspectif instable (Elsewhere trie de façon stable : l'ordre des chaînes de même longueur diffère, donc les sites déjà utilisés aussi) ; le cap entre sites passe par `Quaternion.LookRotation`, natif ; les départages de la recherche de chemin `WorldPathing` n'ont pas été vérifiés. À porter dans un lot suivant : le tri introspectif de Mono à l'identique, puis la recherche de chemin.
- **Colonies étrangères (étape 500), puis routes ordinaires.** Avant de tirer le nombre de colonies et leurs cases, le jeu crée chaque faction (`FactionGenerator.NewGeneratedFaction`) : son nom par le générateur de grammaire et son chef par `PawnGenerator`, sur le même flux aléatoire ; le nom de chaque colonie (`SettlementNameGenerator`) est tiré entre deux placements. Placer les colonies comme le jeu exige donc de générer les personnes et les noms à l'identique, ce que ce lot ne fait pas (consigne du 17 novembre : les PNJ actuels restent provisoires). Les routes ordinaires relient les colonies : elles en héritent.
- **Non mesuré** : couvertures 50 % et 100 %, réglages de pluie et de température autres que normaux (les courbes sont portées mais aucune sauvegarde ne les exerce), nom du monde, modificateurs autres que les grottes (rive de lac, étang, baie, delta… absents d'Elsewhere), pollution (Biotech).
- Une partie du jeu rechargée garde les valeurs arrondies de sa sauvegarde (température au dixième, etc.), alors qu'Elsewhere garde les flottants générés : sans effet sur cette comparaison, à garder en tête pour la suite.

## 7. Performances

Génération de la planète à 30 % (graine « Elsewhere ») dans Node 24, même moteur V8 que le Worker du navigateur, machine de développement sans autre charge, médianes de 4 et 3 mesures alternées : surface physique (maillage, terrain, lacs, rivières) **1,91 s avant, 2,26 s après** ; monde complet (sites, factions, routes, modificateurs) **2,32 s avant, 2,68 s après**. Le surcoût (≈ 0,35 s, +16 à +18 %) vient du graphe de modules du jeu, évalué comme lui ; l'altitude et la pluie, lues plusieurs fois par case, sont mémorisées pour le dernier point (résultat identique). La génération reste dans le Worker de création de monde, avec sa barre de progression.

## 8. Tests

- `tests/verse-rand.test.ts` : hachages, tirages et leurs compteurs, pile d'états, gaussienne, courbes, choix pondérés ; valeurs attendues calculées à la main (entiers et `float32` indépendants) depuis l'algorithme décompilé.
- `tests/verse-noise.test.ts` : bruit de gradient dans ses trois qualités, Perlin, ridged, chaque module de combinaison, latitude, distance au centre de vue, île, `Vector3.Angle`.
- `tests/world-terrain-core.test.ts` : graine et 14 tirages de l'étape, scores des biomes, maillage révision 2 (mêmes cases et voisins), générateur historique identique (somme de contrôle), surface du jeu épinglée, enregistrement et reconstruction de la révision 2, garde de schéma, brouillon de nouvelle partie.
- `tests/planet-parity.test.ts` : quantification de la sauvegarde et rapport sur une petite planète écrite à la main ; **optionnel** : `PLANET_PARITY_SAVE=<chemin.rws>[;<chemin.rws>…]` compare de vraies sauvegardes et exige 100 % sur toutes les colonnes et les rivières.

## 9. Suite

1. Routes anciennes : tri introspectif de Mono, recherche de chemin du monde, cap par `LookRotation`.
2. Factions et colonies : noms (grammaire), chefs (`PawnGenerator`) et noms de colonies sur le flux du jeu — gros chantier, lié à la génération des personnes.
3. Mesurer une sauvegarde à 50 % et à 100 %, et des réglages de pluie et de température non normaux.
4. Modificateurs de case manquants, nom du monde, caractéristiques (`WorldGenStep_Features`).
