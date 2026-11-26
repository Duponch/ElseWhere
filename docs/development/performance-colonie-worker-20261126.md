# Rendu d'une colonie en mouvement dans un Worker et performances du jeu

Le témoin est le lot mémoire C903. Les changements portent sur le client ordinaire, la simulation commune et une nouvelle vue locale de développement qui exécute la scène WebGPU dans son propre Worker. Le schéma de sauvegarde reste 379.

## Résultat final dans le jeu complet

Le témoin C903 et le build final C9202 ouvrent la même sauvegarde des Forges dans Chrome WebGPU sur AMD RDNA-1, en 1 440 × 1 000, à qualité identique. Chaque lancement passe de ×1 à ×3 puis ×6, avec 5 secondes de chauffe et 15 secondes enregistrées par vitesse. L'ordre final est C9202, C903, C903, C9202. Les dessins sont les soumissions du moteur par seconde et les ticks sont les macro-ticks confirmés par le Worker. Les deux fenêtres d’une même version sont agrégées.

| Vitesse | Dessins/s, avant → après | Évolution | Ticks confirmés/s | Intervalle p95 | Images > 100 ms |
|---|---:|---:|---:|---:|---:|
| ×1 | 167,5 → 160,6 | −4,1 % | 6,00 → 6,00 | 12,0 → 12,2 ms | 1 → 1 |
| ×3 | 100,6 → 133,5 | +32,7 % | 17,29 → 17,61 | 21,4 → 15,8 ms | 9 → 5 |
| ×6 | 85,0 → 109,8 | +29,2 % | 23,61 → 25,45 | 26,5 → 18,4 ms | 21 → 17 |

À ×3 et ×6, chacun des deux passages finaux donne plus de dessins et de ticks confirmés que son témoin. À ×1, les deux paires donnent respectivement 150,9 → 133,9 puis 184,2 → 187,3 dessins/s. Aux trois vitesses réunies, les intervalles de plus de 100 ms passent de 31 à 23. Le maximum à ×6 passe de 863,1 à 1 087,1 ms. La scène conserve donc un gel rare d’environ une seconde, même avec un meilleur p95.

En endurance, chaque version démarre directement à ×6 et passe 60 secondes dans une colonie en mouvement après la chauffe. **114,55 → 123,11 dessins/s (+7,5 %)** et **26,25 → 26,41 ticks confirmés/s (+0,6 %)** sur les 36 demandés. Le p95 des images passe de 18,4 à 16,9 ms, le p99 de 66,4 à 62,2 ms. Les images de plus de 100 ms passent de 22 à 26 et le maximum de 268,6 à 699,7 ms. Les deux versions reçoivent respectivement 92 et 93 publications complètes, ainsi que 4 242 et 4 278 phases. Le gain de débit soutenu concerne principalement l’affichage.

Pour vérifier le résultat à vitesse normale, quatre nouveaux lancements restent exclusivement à ×1, en alternant C9202, C903, C903, C9202. Chaque passage mesure 30 secondes après 5 secondes de chauffe. Les deux paires passent de 144,97 à 152,36 puis de 142,28 à 148,83 dessins/s. Au total, **143,62 → 150,60 dessins/s (+4,9 %)**, 6,00 → 6,01 ticks/s, p95 12,9 → 12,1 ms et 4 → 3 images de plus de 100 ms. Les deux protocoles donnent des signes opposés à ×1. Le gain à cette vitesse dépend donc du parcours. Les quatre relevés sont dans `tmp/perf-20261125-next/next-finalx1{1,2}-c{903,9202}.json`.

## Jouer la simulation dans la vue de développement

Lancer `npm run dev`, ouvrir `/worker-colony.html`, choisir Les Forges, Les Éclaircies ou un fichier de sauvegarde Elsewhere, puis sélectionner une vitesse. Le menu Options → Développeur donne également accès à cette page dans le build local. Le canvas affiche la carte, les acteurs, la végétation, les ressources et les ombres du moteur. Les boutons pilotent la simulation native. Un déplacement à la souris, le clic droit et la molette commandent la caméra. Les vitesses et les taux affichés proviennent des états confirmés reçus.

Le thread d'interface transfère le canvas, décode les textures PNG/SVG nécessaires, redimensionne la vue et affiche les compteurs. Un Worker possède le moteur de rendu et la file ordonnée d'admission des publications. Le Worker de simulation lui transmet les publications complètes et les mouvements par le port natif. Le monde complet ne revient pas au thread d'interface. Le Worker qui dessine détient la géométrie, la caméra, la profondeur et les ombres. La partie habituelle conserve le HUD complet et ses interactions.

Avec `/worker-colony.html?hud=speed`, les quatre vrais boutons du jeu sont peints et composés sur le même appareil WebGPU que la carte. La page reçoit les triangles nécessaires au premier affichage puis leurs transformations pour détecter les clics. Pour inspecter une cible dans la carte, un appui gauche demande une capture ponctuelle. Le Worker renvoie ensemble l’image, le point, la cible et l’état de la caméra. Un appui maintenu valide au relâchement sur le même pixel. Un clic bref présente le point à confirmer. Déplacer la caméra, masquer, redimensionner ou recharger la vue annule la sélection en attente. La partie ordinaire fournit encore les ordres de construction, les autres fenêtres, l’enregistrement et le compte à rebours du vaisseau.

Les préférences graphiques persistées sont relues à l’ouverture, y compris les textures, l’herbe, l’éclairage, les ombres, la pièce, le diorama et le style Origami. Le peintre Origami travaille sur un canvas DOM dans le jeu ordinaire et sur un OffscreenCanvas dans le Worker. Le contrôle visuel a été fait aux réglages de référence.

La comparaison Window / Worker couvre cinq images de 768 × 512. **0 pixel différent sur 1 966 080**, aux ticks 335 et 585, avec deux orientations et une passe incluant les commandes de vitesse. Les 250 ticks changent 370 271 pixels. Les commandes changent 3 529 pixels dans leur bande. Le test de la page réelle vérifie aussi les 393 216 pixels de la sélection, le colon 54373 et la ressource 17207 à (130,128), la confirmation des quatre commandes, les glissements annulés, la disparition des deux Workers après une sauvegarde invalide et la réouverture d’un fichier valide. Aucune erreur JS/GPU ni débordement de file sur ce passage (14 publications complètes, 110 phases, profondeur maximale 4).

La connexion TCP du navigateur de test au serveur local est refusée dans cet environnement. Le banc sert le build local par le routeur de test et charge l’exécutable du Worker de simulation par URL Blob après contrôle SHA-256. Le moteur, le GPU, les Workers et les événements de pointeur sont réels. Ces commandes reproduisent la vérification depuis le dépôt.

```powershell
npm run build
node scripts/check-worker-colony-scene.mjs --advance --speed-hud
# Remplacer le chemin par le result.json produit par la commande précédente.
node scripts/check-worker-colony-live.mjs --speed-hud --pick-reference=tmp/test-runs/worker-colony-scene/full-0PzWwI/result.json
node scripts/check-worker-colony-live.mjs --measure --speed=6 --seconds=60
```

Sur un passage ×6 de 60,227 secondes après chauffe, le Worker soumet **7 113 dessins (118,1/s)** et reçoit **1 627 macro-ticks confirmés (27,01/s sur 36)**, avec 105 publications complètes et 1 410 phases. Au fil d’interface, les intervalles d’animation atteignent 32,6 ms au p99 et 33,1 ms au maximum. Un temporisateur de 16 ms accuse au plus 16,7 ms de retard supplémentaire. La pause effective apparaît 439,9 ms après le clic et son accusé arrive à 440,9 ms. La file atteint 17 messages, sans débordement ni erreur. La surface de rendu mesure 1 440 × 896 dans une fenêtre de 1 440 × 1 000. Ce passage utilise la scène sans la barre de vitesse native et sans les autres panneaux du jeu. Il mesure la disponibilité de la page et le débit de la vue expérimentale, avec un périmètre graphique différent du client complet.

Sur le build final C9202 aux clés WebGPU différées, la vraie page reproduit exactement les 393 216 pixels de l’image Window de référence au tick 335, puis les 393 216 pixels de la surface réellement présentée lors de la sélection. Le scénario de rechargement et les commandes passent. À ×6 sur 60,085 s dans cette version, **112,1 dessins/s, 25,73 ticks confirmés/s**. Le fil d’interface présente un intervalle p99 de 32,4 ms et un maximum de 33,2 ms. Le temporisateur de 16 ms a un retard maximal de 16,4 ms. La pause effective prend 446,0 ms et son accusé 446,9 ms. La scène admet 89 publications complètes et 1 392 phases, avec une profondeur maximale de 15 et zéro débordement. Ces deux passages de la vue dédiée donnent un débit inférieur sur le second. Ils ne démontrent aucun gain de débit dans cette vue lié à la seule modification de Three.js.

## Changements dans le client ordinaire

À chaque ouverture, la vue dédiée lit les préférences du jeu dans ce navigateur. Elle transmet les textures, l’herbe, le diorama, la pièce, l’occultation du décor, l’éclairage, les ombres, le détail des animations, les seuils des icônes et des libellés et le style graphique. Le style Origami utilise le même peintre procédural et les mêmes paramètres sur une surface Canvas2D du Worker. Les boutons de visibilité des toits, murs et zones ne sont conservés que pendant la partie ordinaire.

Le compte à rebours de départ du vaisseau utilise les images éligibles et le coordinateur de fin de partie du client ordinaire. La vue dédiée ne pilote pas cette séquence. Une campagne qui perd sa dernière carte active ferme sa vue de colonie.

| Traitement | Charge de comparaison | Mesure ciblée |
|---|---|---|
| Validation et construction des scènes d'acteurs | 1 218 phases des Forges | 659 → 255 Mo alloués, 3 701 → 1 465 ms |
| Barres d'action | 15 passages de 26 publications complètes et 88 phases | 1 111 → 342 Mo, 1 217 → 805 ms |
| Journal de mouvements partagé par les groupes | 203 phases, 23 lecteurs | 4,68 → 0,61 Mo, 3,96 → 0,94 ms |
| Halos et fumées | 16 000 images des Forges, 72 halos et 340 fumées | 321 → 4 Mo, 641 → 27 ms |
| Matériaux de culture | 9 000 dessins, sept variétés | 80,5 → 22,3 Mo |
| Index spatial de la végétation | 13 606 touffes, 129 publications | 393 → 20,8 Mo, 313 → 31 ms |
| Détection des frappes dans les deux couches d'acteurs | 369 messages, 5 images par message, 10 répétitions | Hors combat 367 → 52 ms. Avec deux attaquants injectés, 536 → 202 ms, mêmes 732 réveils |

Les comparaisons conservent les champs et références partagés, les décisions de validation, les buffers d'animation et leur ordre d'écriture. Les mesures ci-dessus ont des unités de travail différentes. Les gains de chaque ligne ne s'additionnent pas.

Sur 7 514 structures, la validation d'une livraison par le client demande 4,22 → 0,68 ms. Elle lit directement l'occupation des cases demandées dans le monde reçu. Un seul des 26 états complets du corpus exerçait cette validation.

## Simulation

Le moteur utilise les structures à proximité pour les places de repas et partage le calcul des réservations entre les piles candidates à une même décision. Sur Les Forges tardives au tick 2035, 12 paires de blocs de 30 macro-ticks donnent **40,84 → 36,15 ms CPU par macro-tick sur le fil de simulation**. Dix blocs sur douze sont plus rapides. Une première comparaison par processus séparés donnait un résultat inverse. Sur Les Éclaircies, le même protocole donne 8,78 → 8,96 ms. Les deux sauvegardes finales ont la même empreinte que leur témoin respectif.

À l'ouverture de la sauvegarde, les 800 premiers macro-ticks (335 à 1135) déclenchent **zéro appel aux quatre fonctions de repas modifiées** et zéro lecture de réservations pour ces choix. La faim minimale passe de 72 à 50,67. Sur 25 paires de 32 macro-ticks alternées, le temps CPU du thread de simulation est de 47,11 → 46,86 ms. Les deux états finaux ont la même empreinte SHA-256, `c37c65cf72bd88c741242e4a5626cfed29ecf5c06d0be3aaaaeb2e9c802cd6ec`. Le travail de ces fonctions n'explique pas la baisse de débit observée sur le client fraîchement chargé.

## Jeu complet sur Les Forges avant la modification de Three.js

Chrome utilise WebGPU sur la carte AMD, à 1 440 × 1 000, avec la même sauvegarde et les mêmes réglages graphiques. Le banc compte les soumissions du moteur et les ticks confirmés reçus depuis la simulation. Chaque lancement passe successivement par ×1, ×3 et ×6, avec cinq secondes de chauffe puis quinze secondes enregistrées à chaque vitesse. L'ordre des quatre lancements est témoin, refonte, refonte, témoin. Les nombres agrègent les deux fenêtres de chaque version.

| Vitesse | Dessins/s, témoin → refonte | Ticks confirmés/s | Intervalle p99 | Images > 100 ms |
|---|---:|---:|---:|---:|
| ×1 | 187,1 → 197,0 | 5,98 → 5,99 | 31,9 → 31,4 ms | 1 → 0 |
| ×3 | 139,6 → 120,6 | 17,63 → 15,42 | 59,7 → 61,8 ms | 6 → 6 |
| ×6 | 96,3 → 100,2 | 24,47 → 20,60 | 93,0 → 85,1 ms | 22 → 19 |

Le deuxième passage de la refonte à ×3 donne 13,32 ticks confirmés/s, contre 17,51 au premier et 17,42 / 17,84 chez le témoin. À ×6, la plus longue image de la refonte dure 1 264,9 ms. L'adoption d'une publication complète occupe 1 234 ms de cette image. Cette mesure sans instrumentation mémoire ne permet pas d'en attribuer la durée au calcul ou au ramasse-miettes.

**Contrôle spécifique à ×3.** Chaque version ouvre deux fois un nouveau navigateur et la sauvegarde au tick 335, avec 5 s de chauffe à ×3 puis 30 s de mesure. Ordre C9201, C903, C903, C9201. Les débits du témoin sont 143,9 et 143,6 dessins/s. Ceux de la version finale 149,9 et 139,9. Au total **143,75 → 144,89 dessins/s** et **17,85 → 17,79 ticks confirmés/s** sur 18. Le p95 passe de 15,0 à 14,1 ms, le p99 de 60,3 à 59,4 ms. Les intervalles de plus de 100 ms passent de 5 à 7, le maximum de 158,2 à 250,8 ms. Ce contrôle ne confirme pas de gain stable à ×3. La baisse constatée sur le parcours successif reste dans le tableau.

La paire distincte enregistrée avec le profileur V8 estime les allocations du fil principal à **6,655 → 6,174 Go** sur le parcours, chauffe incluse (−7,2 %). Sur les seules fenêtres chronométrées, le temps cumulé de collecte passe de 203 à 296 ms à ×1, de 259 à 379 ms à ×3 et de 1 117 à 283 ms à ×6. À ×6, l'image témoin de 877,6 ms recoupe 776,3 ms de collecte. La refonte ne reproduit pas cette collecte longue dans son passage instrumenté. Les traces sont complètes. Le travail de simulation effectivement accompli sur cette paire varie entre versions, et une image de plus d'une seconde reste observée sans profileur.

Une sonde distincte a suivi les allocations du fil principal pendant 25 secondes à ×6 sur C9201, puis imposé une collecte hors mesure des FPS. Parmi les objets alloués pendant cette fenêtre, **41,36 Mo estimés** survivent, à partir de 185 échantillons. Le tas JS total occupé après collecte est de 315,97 Mo, allocations antérieures incluses. La plus grande pile d’allocation survivante regroupe 8,53 Mo dans la préparation des ressources (21 122 ressources dans la sauvegarde). La file des phases d’acteurs référence un seul monde aux deux extrémités de la mesure. Ces observations identifient des sites d’allocation. Les chemins qui retiennent chaque objet restent à déterminer.

En démarrant directement à ×6, une paire d'endurance de 60 secondes donne **109,5 → 113,8 dessins/s** (+3,9 %) et **25,11 → 24,74 ticks confirmés/s** sur les 36 demandés. Le p95 des images passe de 18,9 à 17,3 ms, le p99 de 66,8 à 66,7 ms et le maximum de 772,4 à 253,2 ms. On compte 19 intervalles de plus de 100 ms sur chaque version. Les publications reçues pendant la mesure sont comparables (83 → 82 complètes, 4 137 → 4 119 phases).

## Clés des ressources WebGPU dans Three.js

Sur 12 secondes des Forges à ×6, Three.js 0.186.0 visite 263 776 groupes de ressources WebGPU. 133 534 appels ne lisent aucun identifiant, 130 242 en lisent au moins un et seuls 20 appels utilisent la clé pour mettre à jour le groupe. La méthode d'origine concatène les identifiants de textures et de buffers à chaque visite qui en rencontre. La variante diffère cette concaténation jusqu'à son utilisation. Elle lit les identifiants aux mêmes endroits et conserve les mises à jour des textures, uniformes, mipmaps et samplers. Deux variables suffisent pour les petits groupes. Les groupes plus longs peuvent emprunter un tampon de 1 Kio. Une réentrance, un identifiant atypique ou le dépassement de la capacité disposent du calcul de secours d’origine.

Le contrôle isolé modifie seulement la classe `Bindings` du module Three.js distribué. Les six exécutables de Workers et les octets du module situés avant et après cette classe sont identiques au témoin C9200. Sur deux paires sans profileur à ×6, **126,3 → 132,6 dessins/s (+5,0 %)** et **26,77 → 28,94 ticks confirmés/s (+8,1 %)**. Les intervalles de plus de 100 ms passent de 17 à 9, le p99 de 67,3 à 63,5 ms. La première paire donne 131,45 → 130,64 dessins/s, la seconde 121,15 → 134,55. Une paire enregistrée séparément avec le profileur voit les allocations attribuées à `Bindings._update` passer de 94,37 Mo à **au plus 24,12 Mo** (sous le vingtième site). Le total échantillonné du parcours passe de 2,65 à 2,71 Go avec davantage de dessins et de ticks sur la variante. Ces résultats isolent cette modification par rapport à C9200. Ils ne s'ajoutent pas aux comparaisons contre C903.

La version intégrée applique cette modification au module WebGPU distribué lors de la compilation. Le paquet installé reste intact. La version de Three.js, l’empreinte du module et celle de la méthode sont vérifiées. Sur une distribution inconnue, Vite conserve le module d’origine et émet un avertissement. Le build principal, les Workers et le prébundlage de développement utilisent le même transform. Pour une comparaison locale, définir `$env:LISIERE_THREE_BINDING_KEY='0'` puis lancer `npm run dev -- --force`. La suppression de cette variable et un nouveau démarrage avec `--force` réactivent la variante.

**Charge graphique fixe.** Deux paires alternées ont rendu exactement 1 200 images des Forges à la pause par passage. Le jeu soumet sa vraie carte et son HUD à la même caméra. Les pixels, les ombres, les 1 705 009 triangles par image et les 6 000 soumissions GPU par passe sont identiques. Le coût temporel est mesuré séparément de l’échantillonnage du tas. Les allocations totales passent de **76,87 à 50,90 Mo (−33,8 %)**, celles dans l’appel de dessin de **75,35 à 49,31 Mo (−34,6 %)**. Celles de la méthode et de ses appels passent de 24,36 à 0,05 Mo. Les médianes CPU par image moyennées sur les deux passages vont de 2,50 à 2,25 ms et les p95 restent à 3,10 ms. Un premier témoin dont les ressources se préparaient encore a été écarté avant les quatre passages retenus.

## Exactitude

Les trois rejeux adoptent 148 publications complètes et 1 715 phases. Les 2 250 messages et les trois sauvegardes finales correspondent au témoin canonique avec les vérifications du terrain, des piles, du journal de ressources, des plantes et du portage. Les trois programmes de simulation, de Worker et de rejeu des versions C9200, C9201 et C9202 ont le même contenu exécutable (seule l’adresse de leur carte de sources varie).

La comparaison de C903 avec chacune des versions C9200, C9201 et finale C9202 donne **0 pixel différent sur 4 320 000** par comparaison (colonie figée, trois angles). Sur C9200, les scénarios natifs de minage et de coupe d'arbres qualifient 21 275 soumissions appariées et 44 changements de vitesse en 22,5 ms au maximum. Sur la version C9201, les mêmes contrôles qualifient 21 411 soumissions appariées et 44 changements de vitesse en 25,8 ms au maximum, avec six départs de contact justifiés. Aucun saut inexpliqué, colon dans une roche, blocage de présentation ou erreur JavaScript dans les deux passages.

Le build final C9202 passe les deux scénarios, avec **21 134 soumissions graphiques appariées et 44 changements de vitesse visibles en 28,7 ms au maximum**. Le contrôle identifie quatre départs de contact justifiés, zéro saut inexpliqué, zéro occupation de roche active, zéro blocage de présentation et zéro erreur JavaScript.

La compilation Pages finale et le typage réussissent. Les octets chargés par son entrée principale contiennent la modification vérifiée. Le build local minifié contient également sa version dans le Worker de la vue de développement. Le résolveur de Vite en développement suit les deux entrées jusqu'au même module WebGPU prébundlé, vérifié sur disque (SHA-256 `9146990583453d252f419b195c5e404ca1750e1b99b51c4852bdc7ef9bbd902b`). Sur 173 contrôles consolidés dans 25 fichiers, 169 passent. Quatre échecs sont également présents chez le témoin, deux attentes sur les repas (tâche/queue et confort) et deux sur l’ancien nombre d’opérations de peinture du carton natif. Les quatre tests supplémentaires du transform Three.js passent, dont 99 comparaisons de la méthode. La sauvegarde privée du dossier `bugs/` conserve l’empreinte SHA-256 `fb3291817cf6f5361eba2916cbd85c3e289365e565b2626f20eed3e09c9278bb`.
