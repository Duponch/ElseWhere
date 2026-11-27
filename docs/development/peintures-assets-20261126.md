# Peintures personnalisées des assets — Gouache et Pastel

Demande de Saf du 26 novembre 2026 : reconnaître la nature de l'objet par le dessin appliqué sur ses volumes simplifiés, comme le pelage de la gazelle Gouache, avec un coût de rendu imperceptible ou très faible. Les modèles et les animations restent communs aux deux styles. La [décision sur le rendu dans un Worker](decision-rendu-worker.md) reste différée.

## Intégration

| Famille | Dessins et principes |
| --- | --- |
| Faune | 53 espèces, 16 panneaux anatomiques Pastel dans les trois atlases existants ; bandes du flanc et ventre de gazelle, marques du visage, taches, plumage, écailles, plumes, rides, laine. 18 profils Gouache résidents enrichis directement dans leurs pixels. Les dessins Gouache historiques de la gazelle et du museau du renard sont conservés. Les familles proches peuvent partager un panneau. |
| Colons | Atlas neutre partagé de 32 dessins : ouvertures et col de chemise, boutons/poche, T-shirt, coutures et pans de cache-poussière, parka, gilet, pantalon, bottes, tunique, armures, chapeaux, peau et cheveux. Les couleurs de vêtement sont des teintes du joueur ; les marques restent sur le rig. Les portraits reprennent les marques sur leurs triangles existants. La veste partage la silhouette et le dessin de la parka existante. |
| Meubles et structures | Dessins alignés sur les faces utiles : plateau en planches, tiroirs et panneaux, couvertures et oreillers, chaises, portes, grilles et panneaux de machines, matériels de recherche, cellules solaires, coffre et monument. Les variantes utilisent les bits fractionnaires libres de l'adresse de préparation existante. |
| Objets posés | Chemise, manteau, pantalon, gilet, casque, vêtements matelassés, armures, livres, emballages, composants, bois, tissus, cuirs, graines, feuilles et végétaux. Les objets minuscules, portés et icônes SVG gardent leur représentation légère. |
| Végétation | 13 essences, 7 cultures et motifs de végétation : écorces, lenticelles de bouleau, nœuds de bois et bambou, aiguilles, nervures, feuilles, graines, capsules, fruits et champignons. Pastel bénéficie des atlas dédiés ; Gouache des pigments existants, nuances par partie et dessins précalculés des cultures. Les arbres Gouache gardent leur peinture spécifique existante et une teinte anatomique par partie. |
| Capsules et mécanoïdes | Panneaux, grilles, vis, hublots, emblèmes, articulations et plaques. Les quatre familles de capsules conservent leur animation et leur lot ; les trois mécanoïdes utilisent le même dessin dans la partie et l'atelier, y compris leurs carcasses. |

Les petits fragments, roches, zones homogènes, murs et terrain déjà dessinés par familles de matière ne justifient pas un dessin de l'objet entier à chaque occurrence. Ils conservent leur traitement existant.

## Architecture et coût

- Aucune boucle par image de peinture, aucune géométrie de couture/bouton ajoutée. Les UV existants et les attributs résidents sont réutilisés ; les textures sont calculées une fois et conservées par les propriétaires déjà utilisés. Le style préparé dessine avec la même lecture de texture finale.
- Animaux : atlas 3 × 256² RGBA inchangé en taille, un additionneur RGB supplémentaire dans le décodage neutre. Les pigments Gouache sont modifiés lors de la préparation de la banque existante, sans nouveau profil admis. Les recettes partageant une palette conservent des dessins compatibles.
- Humains : source et deux copies résidentes passent de 64² à 256². Delta maximal nominal avec les deux copies : environ 1,17 Mio CPU et 1,56 Mio GPU. L'UV Pastel n'est calculé que pour l'encodage Pastel. Le chemin Gouache préparé intègre la couture dans sa texture finale.
- Meubles et objets : atlas 256² RGBA et ses copies préparées ; aucune nouvelle instance ou géométrie visible. Les copies de construction des chartes de préparation sont comptabilisées dans les budgets. Les surfaces génériques gardent leur zone historique 64² et leurs coordonnées de texture.
- Végétation : carte 256² par propriétaire de ressources/cultures et copies existantes adaptées à cette taille.
- Machines et capsules : carte partagée 128² RGBA (64 Kio de pixels CPU), texture résidente par propriétaire et mips. Les capsules conservent une lecture Pastel et ajoutent une lecture en Gouache lorsqu'elles sont visibles. Les mécanoïdes, auparavant à teinte simple, lisent une texture supplémentaire dans chacun des styles. Leur géométrie visible et leurs attributs d'instance ne changent pas ; le budget des cartes mécaniques est intégré au recensement de préparation.
- Le chemin direct Gouache (relief/usure positifs ou gros plan) des vêtements, objets/meubles décorés et cultures demande une lecture de masque de dessin supplémentaire. Les textures finales préparées incorporent ce masque lors de la construction.

## Qualification native du 27 novembre

Référence : commit `ae403266` (build C9202). Nouveau build local avec les textures décrites ci-dessus. Chrome WebGPU, AMD RDNA-1, viewport 1 440 × 1 000, Les Forges au tick 335, même caméra, HUD complet, même ombre. Après stabilisation (1 200 images de chauffe puis au moins 450 images de contrôle), chaque passage qualifie 600 temps CPU de soumission, puis 96 horodatages matériels WebGPU des passes de rendu. Les temps CPU et GPU sont mesurés séparément. Les ordres A B B A sont utilisés pour Pastel et Gouache à relief/usure nuls, puis une paire A B avec la Gouache à relief 1 et usure 0,75. Le premier passage Pastel préliminaire est écarté parce que ses compteurs n'étaient pas encore stables.

Sur les dix passages retenus, la scène affiche constamment **72 appels de dessin, 1 705 009 triangles et 5 soumissions GPU par image**, ainsi que les mêmes positions de caméra et tick. Aucun message d'erreur JavaScript ou WebGPU.

| Style | GPU moyen, ms | GPU médian, ms | GPU p95, ms | CPU moyen, ms | CPU médian, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pastel (2 paires) | 3,209 → 3,249 (+1,24 %) | 3,047 → 3,080 (+1,08 %) | 3,703 → 3,867 | 2,666 → 2,764 | 2,550 → 2,750 |
| Gouache, effets nuls (2 paires) | 3,579 → 3,666 (+2,42 %) | 3,408 → 3,670 (+7,69 %) | 4,325 → 4,325 | 3,334 → 3,162 | 3,150 → 3,050 |
| Gouache, effets actifs (1 paire) | 3,777 → 3,845 (+1,81 %) | 3,736 → 3,604 (−3,51 %) | 4,588 → 4,850 | 2,894 → 2,932 | 2,800 → 2,900 |

Les nombres agrègent les statistiques des passages par version. Le surcoût moyen GPU observé est de 0,04 à 0,09 ms sur cette scène. Le GPU médian Gouache à effets nuls augmente néanmoins de 0,262 ms ; le CPU médian Pastel augmente de 0,20 ms. Ces mesures isolent le rendu d'une colonie figée et ne donnent pas une garantie de stabilité des FPS en simulation active, ni une qualification exhaustive des GPU.

À Gouache effets nuls, les véritables banques de meubles (180 variantes), portes (2), cultures (3) sont toutes admises avant et après, et leur taille finale reste respectivement de 401 080 320, 22 282 240 et 16 711 680 octets. Les acteurs des Forges gardent le chemin direct en raison de la condition clinique/non rigide déjà présente chez le témoin. Le surcoût fixe de copies Pastel des meubles, portes et cultures est de 2,5 Mio au total, mesuré dans les propriétaires. Le coût des textures humaines, animales, végétales et mécaniques reste décrit ci-dessus.

Atelier réel `assets.html` ouvert dans les deux modes après renforcement du contraste du dessin sur les vêtements et meubles Gouache : les 1 130 entrées sont présentes, 18 vues rapprochées par style capturées sans erreur. Avant la modification, la capture Gouache de la gazelle était déjà identique à la nouvelle capture, octet par octet ; le Pastel reçoit désormais le dessin du flanc, du ventre, du visage et des pattes. Le contraste et le grain varient selon les deux styles. La résolution volontairement compacte des chartes laisse une douceur visible à très fort grossissement dans l'atelier.

Relevés dans `tmp/perf-20261125-next/paint-fixed-native-steady.json`, `paint-fixed-native-positive.json`, `paint-catalog-baseline/` et `paint-catalog-refined/`. Le banc de qualification est `paint-fixed-native.mjs` dans ce même répertoire. Le build et le typage complets ont réussi.

Deux paires actives alternées à ×6 Pastel, 30 s par lancement après cinq secondes de chauffe, AMD WebGPU, même sauvegarde. Les résultats par paire sont de 80,00 → 99,22 et 120,01 → 117,66 dessins/s. Agrégés sur environ 60 s par version, **100,05 → 108,43 dessins/s, 21,19 → 25,46 macro-ticks/s confirmés**, p95 des intervalles 19,4 → 16,9 ms, p99 86,5 → 87,0 ms. Les images dépassant 100 ms augmentent toutefois de 34 à 50, et le maximum de 212,2 à 931,1 ms. Les volumes de simulation diffèrent fortement entre les fenêtres ; ces paires ne démontrent pas un gain de FPS causé par les peintures, ni l'absence de tout effet sur les gels rares historiques. Le débit moyen ne montre pas de régression dans cet essai. Relevés `paint-moving-*.json` et `paint-moving2-*.json`.

Les nouveaux contrats vérifient les dimensions, les adresses et motifs des atlas, leurs frontières, les modèles et statistiques de soumission ainsi que les limites des programmes WebGPU générés. Validation consolidée finale : 39/39 sur 11 fichiers, puis 4/5 sur les deux fichiers de fermeture et de surfaces naturelles. L'unique échec final (identité matérielle lors du changement de style dans `shared-natural-texture-surface.test.ts`) figure déjà dans les deux listes historiques `tmp/perf/known-failures*.json`. Deux attentes audio des anciens tests mécanoïdes ont été reproduites sur le témoin C9202 ; le seuil de 90 000 sommets du portage est également un échec historique établi par l'identité exacte des buffers (90 036). Aucun changement de code de simulation ni de schéma.
