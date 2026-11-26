# Mémoire du client et rendu déporté sur Les Forges

Le point de départ est le commit `dbb04d58`. Les 2 652 fichiers de l’archive de référence C801 correspondent aux blobs Git de ce commit après normalisation des fins de ligne. Les mesures ci-dessous comparent le même schéma 379 et les mêmes réglages.

## Travail évité

| Chemin du jeu | Charge identique avant et après | Allocations V8 estimées |
|---|---|---:|
| Décodage des phases d’acteurs | 203 messages réels des Forges, répétés quatre fois | 368 → 155 ko par message (−57,8 %) |
| Identification des objets sur le port privé | 12 publications complètes rejouées huit fois | 225,9 → 25,7 Mo (−88,6 %) |
| Planification des acteurs à dessiner | 10 000 images, 711 700 visites de slots dans le même ordre | 291,8 → 13,5 Mo (−95,4 %) |
| Projection des piles et écriture des lots graphiques | 300 changements de quantité dans un secteur de 426 lots | 191,0 → 61,3 Mo (−67,9 %) |
| Segments numériques de mouvement | 6 472 segments, même empreinte de sortie | 66,0 → 25,7 Mo (−61,1 %) |

Les essais couvrent des charges différentes. Les pourcentages décrivent chaque opération, et les octets échantillonnés incluent les objets déjà collectés.

Le décodeur garde au plus 384 Kio de tampons numériques entre deux messages. Le résultat appartient à chaque publication. Une réentrée ou un gros message dispose de ses propres tampons. Les lecteurs d’objets arbitraires gardent leurs contrôles. Le premier lecteur du canal privé peut parcourir directement la copie structurée reçue avant toute exposition du graphe.

Les lots de piles conservent la signature et les placements de chaque pile inchangée. Les cultures remettent directement les colonnes de chaque espèce à son lot graphique. À chaque image, la liste ordonnée des acteurs à animer utilise des masques réutilisables. Les halos et les fumées classent chaque émetteur avant d’évaluer son animation. L’aide à la recherche calcule les cases occupées des seules tables de recherche. Les transitions de portage construisent le répertoire des piles lorsque leur animation l’exige.

## Rendu dans un Worker

En partie, le Worker de l’horloge dessine les libellés dans un `OffscreenCanvas`. L’interface affiche la minute confirmée, peint immédiatement si la feuille attendue manque et conserve les textures de météo et de température quand seule la minute change. Sur Chrome, les 1 440 minutes d’une journée correspondent pixel par pixel au tracé local à 560 × 134. Le test a comparé 108 057 600 pixels. Une feuille occupe environ 2,1 Mo. Le temps mesuré de dessin sur le fil principal pour la journée passe de 56,4 à 24,7 ms. La fabrication des feuilles dans le Worker est hors de ce chronométrage.

Un deuxième banc transfère le canvas visible et exécute les vraies couches 3D des murs, des portes et des colons avec la caméra et les ombres des Forges. Il ouvre la sauvegarde distribuée et compare les deux modes de rendu dans Chrome. Sur AMD RDNA-1, les sept états donnent **0 pixel différent sur 2 752 512**. Masquer les murs modifie 71 269 pixels, les battants 336, les colons 1 704 et les ombres 14 447. La scène compte 80 colons et 270 battants. Commande depuis le dépôt :

```powershell
node scripts/check-worker-colony-scene.mjs
```

L'essai suivant transfère le canvas de la **scène 3D entière à la pause**. Le Worker de rendu obtient lui-même la publication complète migrée par le Worker de simulation, l'adopte par le canal privé du jeu et initialise le véritable `SceneRenderCore`. La page décode les images des atlas avec le décodeur HTML natif et transmet leurs bitmaps au Worker, qui attend les sept textures avant de dessiner. La référence sur le fil principal utilise le chargeur de textures ordinaire. Chaque contexte exécute le terrain, les ressources, les acteurs, la profondeur et les ombres sur son propre appareil WebGPU.

Sur Les Forges au tick 335, le banc reproductible compare deux angles et répète la première image. **0 pixel différent sur 1 179 648**, avec 392 089 pixels modifiés par la rotation. Les deux contextes obtiennent 755 maillages, dont 142 marqués visibles. Chaque nouvelle vue nécessite 144 appels de dessin et 2 501 147 triangles. La répétition de la vue fixe en nécessite 133 et 2 483 090 dans les deux contextes. Ces captures vérifient le rendu et la caméra sur une colonie identique et figée. La mesure de FPS en partie est distincte. Pour reproduire ce contrôle avec le client compilé :

```powershell
npm run build:pages
node scripts/check-worker-colony-scene.mjs --full
```

Le rendu 3D de la partie normale utilise toujours le fil principal. Pour le déplacer, le Worker de rendu doit recevoir les phases successives pendant la partie et prendre en charge la composition du HUD avec la scène. Le fil d'interface doit pouvoir associer chaque clic, projection de caméra et sélection au dernier état effectivement affiché. La cadence de simulation, l'intégrité du canal et la réponse des commandes pendant un gel doivent être vérifiées dans ce mode à ×1, ×3 et ×6.

## Exactitude et décisions

Le candidat retenu est C903. Les 2 656 fichiers de son archive correspondent aux fichiers de travail. Ses exécutables de simulation, de publication et de rejeu sont identiques à ceux de C902, à la ligne de localisation de leur carte de sources près. Le seul changement produit entre ces deux archives concerne la qualification des pixels de l’horloge.

Les trois rejeux déterministes comparent 2 250 messages canoniques et trois sauvegardes au témoin, avec contrôle de l’index des piles, du journal des ressources, du terrain, des porteurs, des plantes et de l’adoption. Les 148 publications complètes et 1 715 phases ont effectivement été adoptées. Les 1 494 cas supplémentaires du lecteur de mouvements donnent les mêmes 878 acceptations et 616 refus sur les schémas 263, 297 et 379. La sauvegarde utilisateur est intacte.

Une variante de fusion des champs d’acteurs réduisait les allocations du microbanc et augmentait le temps CPU. Le fichier de fusion des acteurs a été restauré à l’identique. Les mesures de jeu de C903 excluent cette variante.

## Mesures dans le client complet

Les quatre lancements successifs utilisent la sauvegarde distribuée Les Forges, Chrome avec WebGPU natif sur AMD RDNA-1, une vue fixe de 1 440 × 1 000 et une cadence d'affichage déplafonnée. Chaque lancement mesure 15 secondes à chacune des trois vitesses, après cinq secondes de chauffe. L'ordre des versions est témoin, refonte, refonte, témoin. Les images comptées ci-dessous sont les appels de dessin du jeu. Les ticks sont les macro-ticks de l'état reçu. Les percentiles portent sur l'intervalle entre images. Le tableau donne la moyenne des deux résultats de chaque version.

| Vitesse | Dessins/s témoin → refonte | Ticks/s témoin → refonte | Intervalle p99 témoin → refonte | Images > 100 ms sur les deux passages |
|---|---:|---:|---:|---:|
| ×1 | 186,9 → 216,6 | ≈ 6 → ≈ 6 | 33,3 → 29,5 ms | 2 → 2 |
| ×3 | 152,5 → 161,1 | 17,45 → 17,21 | 59,5 → 52,2 ms | 7 → 3 |
| ×6 | 109,1 → 102,4 | 25,98 → 27,87 | 90,6 → 84,9 ms | 20 → 21 |

À ×1, les deux témoins donnent 161,6 et 212,1 dessins/s, les deux passages de la refonte 210,8 et 222,4. Ce recouvrement limite la précision du gain. À ×6, le nombre de dessins baisse de 6,1 % pendant que la simulation avance davantage. Les images les plus lentes durent 127 et 828 ms pour les témoins, 1 063 et 973 ms pour la refonte. Les quatre lancements se terminent sans erreur du navigateur. À chaque passage de la refonte, l'horloge utilise 84 fois le dessin préparé, effectue 7 tracés directs et reçoit 5 feuilles.

La scène complète du client à la pause a également été comparée entre les deux versions, avec la caméra aux angles 0, 1,03 et 2,20 radians. Les 4 320 000 pixels coïncident au tick 335 et chaque capture répétée est stable. Le texte variable du compteur de FPS est exclu de cette comparaison.

Sur la première tentative d'endurance à ×6 directement après chargement, Chrome a perdu son périphérique WebGPU avec `DXGI_ERROR_DEVICE_HUNG`, une fois sur chaque version. Le jeu a libéré son moteur de rendu. L'outil de mesure a ensuite perdu l'accès à ses compteurs. Ces deux tentatives sont exclues des résultats numériques. Le même protocole relancé dans deux nouveaux navigateurs a abouti sur les deux versions. La cause de la perte de périphérique intermittente reste à déterminer.

| Les Forges ×6, 60 secondes après chauffe | Témoin | Refonte |
|---|---:|---:|
| Dessins/s | 104,8 | 110,4 |
| Macro-ticks/s reçus | 26,28 | 26,03 |
| Temps entre images, p95 / p99 | 21,5 / 83,8 ms | 18,7 / 74,5 ms |
| Intervalles de plus de 100 ms | 33 | 26 |
| Intervalle le plus long | 879,1 ms | 784,6 ms |

Les deux passages d'endurance terminés traitent 91 et 90 publications complètes sans erreur. La variation des FPS et des ticks à ×6 change de sens entre la paire longue et les fenêtres courtes. Les Forges reste en dessous des 36 macro-ticks/s de ×6 et des 200 dessins/s à cette vitesse.

Le banc `scripts/perf-client-publication.mjs` accepte désormais `PERF_GC=1`. Chrome échantillonne les allocations du contexte principal, y compris les objets déjà collectés. Des marqueurs relient les intervalles d'image aux événements du ramasse-miettes sur le même fil. Le rapport voisin `.gc-summary.json` donne les périodes de collecte sans compter deux fois les phases imbriquées, les principales sources d'allocation et les éventuelles pertes d'événements. Utiliser un passage distinct pour les FPS.

Deux passages consécutifs avec cette option, un par version, estiment **8,34 Go → 6,79 Go alloués sur le fil principal (−18,6 %)** sur l'enchaînement des trois vitesses, chauffes incluses. Ce volume cumule les allocations successives. V8 a enregistré 7 911 et 6 429 échantillons. Pendant les fenêtres chronométrées, les clients ont observé 6 298 et 6 079 images, et reçu 700 et 714 macro-ticks. Un essai antérieur de la refonte recoupait un autre processus de vérification graphique et a été écarté du comparatif.

| Fil principal, événements de collecte pendant les 15 s mesurées | Témoin | Refonte |
|---|---:|---:|
| ×1 | 268,6 ms | 202,3 ms |
| ×3 | 407,7 ms | 274,0 ms |
| ×6 | 1 107,6 ms | 1 290,1 ms |
| Cumul des trois fenêtres | 1 783,9 ms | 1 766,4 ms |

La baisse du volume alloué améliore peu le temps total de collecte dans cette paire (−1,0 %). À ×6, une image de la refonte dure **1 123,5 ms**, avec **1 009,2 ms d'événements de collecte sur ce même fil**. Une collecte majeure de 863,5 ms réduit le tas de 1,093 Go à 0,338 Go. Les deux traces ne signalent aucune perte et l'écart maximal des marqueurs de temps est inférieur à 0,1 ms. Le gel rare reste reproductible.

Le typage et la compilation Pages réussissent en 37,8 s. La suite consolidée de 22 fichiers compte 177 réussites et 10 échecs sur 187 tests. Sept titres sur les mouvements d'acteurs et celui de la projection d'étagère figurent au registre des échecs antérieurs. Les deux titres sur le nombre de variantes de culture et celui de l'étagère ont également échoué sur le témoin C801 gelé. Les cinq nouveaux cas unitaires réussissent.

Le contrôle natif du minage et de la coupe d'arbres qualifie les deux scénarios de 45 secondes. Il observe **21 358 soumissions graphiques appariées, 44 changements de vitesse, délai maximal de 29,4 ms**, quatre départs de contact justifiés et aucun saut inexpliqué, colon dans une roche, blocage de présentation ou erreur JavaScript. Le premier lancement avait dépassé les 180 secondes du programme enveloppe. Le second a exécuté les deux scénarios du même banc avec les mêmes options et les mêmes seuils, en lui laissant finir le chargement et les captures.
