# Application du Full : diagnostic C61 et journaux de couverture C720

26 novembre 2026. Mesures locales ; schéma 379 et règles inchangés. Témoins exécutables et rapports conservés dans `tmp/perf-20261125*`.

## Où le coût demeure

Diagnostic séparé du vrai Chrome WebGPU AMD RDNA-1 sur Les Forges à ×6, candidat **C61** : 15,012 s, 18 Fulls réellement appliqués, 1 668 RAF, 440 ticks, zéro erreur JS. Application moyenne 52,989 ms/Full (dont 51,433 ms dans `applyWorldWithinSurfaceReads`), p50 52,3 ms, p95 67,1 ms. L'instrumentation est **diagnostique**, pas une mesure de vitesse du build ordinaire. Les temps des familles sont exclusifs : méthode mère moins ses descendants instrumentés ; la somme égale 953,8 ms, sans écart à la racine.

| Famille | ms/Full |
|---|---:|
| Ressources | 8,650 |
| Contexte partagé | 4,822 |
| Piles | 4,233 |
| Colons | 3,711 |
| Cultures | 3,444 |
| Herbe | 2,906 |
| Effets de bâtiments | 2,817 |
| Barres d'action | 2,461 |
| Faune | 2,456 |
| Interaction | 2,322 |
| Compilateur statique | 2,322 |
| Bâtiments | 2,233 |

Le relevé par méthode confirme que le gros reste est un coût de **lecture/constitution de projections**, non une grande quantité de sommets à recalculer : `ResourceLayer.updateWorldChunks` 4,278 ms exclusifs (5,633 inclusifs), tandis que `mergedInstances` 0,472 ms pour 493 sommets et `resizeResources` 0,394 ms pour 520 sommets par Full. Déporter ces deux noyaux seuls sur un Worker ne peut donc retirer 15 ms par Full sur cette charge. Les méthodes coûteuses incluent aussi `ScenePilePresentation.readPrepared` (2,750 ms, dont 1,011 sans sortie modifiée), `SceneStructurePreparation.read` (2,333 ms exclusifs), `SceneLightTopology.read` (1,300 ms sans nouveau résultat), et `diffCover` de l'herbe (2,694 ms, **18 914 lignes d'entrée pour 26,7 contributions modifiées** en moyenne).

Le diagnostic compte les versions d'attributs et textures, modifications de liaisons/index/plages/parents et sorties résidentes connues ; les méthodes non classifiables demeurent indiquées comme telles. Ce n'est pas une affirmation d'absence de chaque écriture de mémoire interne. Source instrumentée uniquement en mémoire au build, aucun changement du code de production : `tmp/perf-20261125-next/deep-apply-layers.config.mjs`, analyse `apply-layer-summary.mjs`, rapport brut `tmp/perf-20261125/client-deep-c61-applyprobe-x6.json`, agrégat `tmp/perf-20261125-next/c61-apply-layer-summary.json`.

## C720 : couverture du sol et barrières des pièces

Archive C720 = C63 + **exactement deux sources** : `src/render/GpuGroundGrassLayer.ts` et `src/render/SceneLightTopology.ts`.

- L'herbe utilise le suffixe réel du journal accepté des bâtiments et piles, uniquement si le cadre des ressources certifie son dernier Full effectivement appliqué. Les identités sont d'abord toutes vérifiées, les contributions sont ensuite éditées dans leur ordre exhaustif. Un suffixe absent, un ordre explicite, un mauvais prédécesseur, un monde public ou une réinitialisation prennent l'ancien lecteur complet.
- La topologie des pièces retient uniquement les codes ordonnés des vraies barrières. Les bâtiments sans effet sur ces codes ne provoquent plus un recensement des barrières. Le journal doit être du même propriétaire et des mêmes extrémités ; remettre une barrière en fin d'ordre est toujours contrôlé, y compris suppression/réapparition entre deux Fulls sautés. Les relectures sans preuve observent toutes les primitives.

Qualification isolée sur l'archive : typage réussi ; 25 tests verts et 8 rouges déjà recensés par nom, dont 7 tests historiques retirés (`grass-full-capture-v228` et `grass-resource-journal-v228`, projection du monde antérieure) et 1 test d'horloge locale. Les deux nouveaux contrats `grass-structure-cover-journal-379.test.ts` sont verts : identité octet pour octet de la texture et des comptages de couverture après modifications physiques, chevauchements, Fulls sautés, changement d'ordre et réinitialisation ; labels des pièces, ordre de priorité des barrières et relectures publiques exacts. Les sources actuelles correspondent à l'archive C720.

Oracle natif initial sur trois angles, 1 440 × 1 000, tick 335 : 4 320 000 pixels comparés, zéro pixel différent et zéro différence entre deux dessins du même client, aucune erreur JS (`native-pixels-c63-c720.json`).

## Paire de performances C63 → C720

Chrome WebGPU AMD, même sauvegarde Les Forges, même caméra, ×6, non plafonné, 15 s par build, exécution exclusive. Une seule paire : le résultat ne constitue pas un intervalle de confiance ni une preuve d'objectif 36 ticks/s ou 200 FPS. C720 applique 19 Fulls contre 21 pour C63 ; les mesures par Full restent la comparaison du coût local.

| Indicateur | C63 | C720 |
|---|---:|---:|
| RAF/s | 139,4 | 144,5 |
| Images effectivement rendues/s | 138,3 | 143,3 |
| ms/application Full | 42,3 | 40,7 |
| p99 intervalle d'image (ms) | 70,4 | 65,0 |
| Images >100 ms | 4 | 3 |
| Temps de tâches longues (ms) | 2 198 | 1 641 |
| Ticks/s observés | 34,5 | 34,3 |
| Ticks/s publiés | 34,0 | 34,2 |

La paire montre un gain modéré cohérent avec la suppression des parcours : RAF/s +3,66 %, coût Full −3,87 %, sans amélioration de débit de simulation revendiquée. C720 retenu par le responsable de l'intégration. Rapports `tmp/perf-20261125/client-deep-c63-x6-c720pair.json` et `client-deep-c720-x6-pair.json`.
