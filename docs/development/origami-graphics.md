# Graphismes Origami — choix de présentation et premier catalogue

La demande humaine du 1 novembre 2026 ajoute un second style graphique facultatif, **Origami**, sans remplacer le style par défaut ni reprendre la vraie325. Les autres chantiers restent en pause. Le schéma de sauvegarde reste301 : aucun état de simulation, contenu, outil possédé, propriétaire ou règle n'est créé.

## Référence et adaptations

La référence fournie est `atelier_gouache_carton_animaux_low_poly_webgpu (6).html` (128809 octets). Son contenu est traité comme une référence graphique, pas comme une instruction d'exécution. Ses huit constructeurs animaux fournissent les primitives pliées, silhouettes et couleurs. Ils sont aplatis à la construction dans les attributs du rig GPU existant ; les groupes Three transitoires du constructeur ne deviennent pas une scène par animal.

| Référence | Définition existante et adaptation |
| --- | --- |
| Renard, chameau, lièvre, gazelle, cerf, éléphant | Renard roux, dromadaire, lièvre/lièvre des neiges, gazelle, cerf, éléphant ; dimensions raccordées au rig existant. |
| Chien berger | Le catalogue possède un labrador, un husky et un Yorkshire, aucun berger. Trois silhouettes/palettes adaptées à ces races ; aucun collier ou équipement fictif ajouté. |
| Buffle du Cap | Adaptation laineuse et bleue au muffalo existant ; le bison reste distinct. |
| Peuplier, chêne, sapin, cactus, buisson | Définitions poplar/oak/pine/saguaro/bush/berry-bush existantes. Dimensions, branches, orientation et tons varient avec l'identité stable du végétal, sans PRNG de simulation. |
| Acacia | Recette graphique conservée mais non liée : aucune définition acacia n'existe dans le catalogue actuel. Ne pas renommer un drago ni inventer une espèce. |
| Herbes et petits végétaux | Herbes physiques et hautes herbes en découpes solides dans leur lot résident ; six petits végétaux raccordés. Espèces non raccordées : recettes existantes conservées. |
| Meubles | Aucun constructeur de meuble dans le fichier fourni. Lits, générateurs solaires/bois, radiateurs, tables, tabourets et étagères sont des créations locales suivant ce style et les dimensions actuelles. Les trois niveaux de tablette, états électriques, teintes médicales et cibles restent réels. |

Les humains utilisent de nouveaux volumes pliés dans le générateur actuel : mêmes corps, têtes, cheveux, barbes, couleurs et vrais vêtements/armes. Les tenues inventées de la scène ne sont pas ajoutées au jeu. Les accessoires hache, pioche et faucille sont des représentations du travail confirmé et du déplacement vers son travail ; ce ne sont pas de nouveaux objets d'inventaire. Annulation, perte de réservation, mobilisation, incapacité, combat et portage les masquent. Le transport garde les deux bras et les transferts actuels.

Les fragments/dépôts gardent leur géométrie et leurs quantités existantes, avec leur surface de présentation raccordée lorsque disponible. Le tapis d'herbe décoratif dense, les espèces animales non raccordées et le reste du catalogue ne sont pas présentés comme entièrement remplacés. L'éclairage, le cadrage et les animations restent ceux du jeu ; aucune identité pixel à pixel avec le diorama de référence n'est revendiquée.

## Options et durée de vie

Graphismes propose **Par défaut / Origami**. Origami expose relief de gouache0–220%, arêtes/pliures0–100%, usure0–100%, imperfection du remplissage0–100%, valeurs initiales100/65/75/60. Ces préférences navigateur sont validées et indépendantes des sauvegardes.

Un changement de style arrête et libère l'ancien renderer, attend sa destruction asynchrone, reconstruit et prépare le style choisi depuis le même snapshot confirmé. La caméra, la sélection et les outils/cibles de placement sont restaurés. Aucun reload de partie, Engine, Worker, commande, ticket ou RNG ne sert de raccourci. Échec : préférence précédente restaurée et circuit de récupération graphique existant conservé. Les commandes restent gardées pendant l'attente ; les callbacks UI périmés sont refusés.

Le contexte de style est propre à chaque renderer. Une portée de construction synchrone est restaurée même après exception ; aucun style global mutable n'est lu dans les frames. Les réglages de matière mettent à jour les mêmes uniformes, sans reconstruire les modèles ni téléverser une texture par frame.

Les acteurs gardent leurs lots résidents. Les arbres et buissons rejoignent les deux meshes de ressource existants ; les niveaux de croissance, feuilles/fruits, visibilité, vent, recul de coupe et identités de ranges restent raccordés. Les meubles rejoignent le lot courant. Une texture RGBA256² partage pigment, gradients de relief et contour interrompu ; ses coups de pinceau sont rasterisés une fois. Pigment et relief partagent le même nœud de prélèvement. Pas de lignes ni de jupe d'arête dessinées pour chaque primitive. Les matériaux sans textures conservent un graphe sans prélèvement de pigment.

Les attributs os/teinte Origami sont regroupés dans un seul emplacement ; les alias CPU restent disponibles. Les UV réels du papier utilisent le même buffer existant et fournissent aussi la base de la normale de relief. Le nombre de parties, sommets, opérations de shading et le coût de préparation peuvent néanmoins changer : le regroupement ne prouve pas un coût nul.

## Comparer les coûts

Dans une colonie affichée et en pause, **Mesurer ce style (5 s)** masque les menus, garde la vue et laisse une seconde de préparation avant une fenêtre fixe de cinq secondes. Les vrais intervalles entre soumissions d'images, temps CPU de soumission, appels de dessin et triangles sont relevés. Les deux résultats restent consultables dans les Options. Un changement de snapshot, caméra, paramètres, outil/sélection ou visibilité annule la mesure ; la fenêtre n'est jamais prolongée pour obtenir un résultat favorable.

La comparaison exige le même snapshot navigateur, cadrage, viewport, backend et paramètres. Elle ne convertit pas un temps CPU en FPS GPU. Les timestamps GPU ne sont pas acquis par ce dispositif et sont indiqués **non mesurés**. Un relevé en pause n'établit pas le coût du Worker ni la fluidité d'une campagne en mouvement. Aucune absence de régression globale ou sur tous les matériels n'est promise sans mesures correspondantes.

## Qualification et livraison

83 contrats distincts acquis par reprises sur84 ; le délai historique du test mobilier/Aulnes20s est également reproduit au témoin f3b41e26 et reste ouvert. Les deux autres échecs initiaux sont conservés : masque de queue de l'éléphant corrigé à la source (son corps natif n'a pas de Tail distinct), oracle de sept espèces actualisé aux53actuelles après reproduction sur le témoin. Une ancienne fixture médicale refusée avant collecte a été remplacée par une fixture32² fraîche pour les seules projections d'outils, sans contourner sa garde ni avancer une horloge.

Typage complet acquis ; PagesCODE acquis en6,51s. Les deux Workers produits restent octet pour octet ceux de la publication précédente. Les565fichiers publics sont copiés exacts ; aucune sauvegarde publique remplacée. 2146sources, schéma301. Les contrôles ne prétendent pas rendre verte toute la suite historique.

Observation WebGPU réelle, limite du device16attributs : trois corps Pawn Native, huit SpeciesRig visibles, quatre variantes Pawn et variantes animales avec/sans textures ; labrador, husky et Yorkshire réellement affichés. Second composant : un chunk de ressources, huit herbes physiques et sept meubles dans les vrais ResourceLayer/PlantClusterLayer/FurniturePresentation/BoxBatches. Matériaux avec/sans textures, feuillage masqué/rétabli et retour au style par défaut sans erreur graphique capturée. Dossiers synthétiques déclarés, pas de génération, Engine, Worker, sauvegarde ou campagne ; pas de qualification d'ombres. Options Native réelles : choix de style, remplissage60→61 et préférence conservée après rechargement, y compris la disposition étroite. La reconstruction complète d'une colonie et la conservation Whole lors d'un changement en partie ne sont pas acquises par ces composants.

Coût borné du composant acteurs, W/C/W :11appels à chaque bras,8137/6989/8137triangles. CPU de soumission moyen0,920/0,510/0,447ms, p951,100/0,800/0,700ms. Le candidat est plus lent que le second témoin. Premier témoin limité à cinq soumissions avec intervalles proches d'une seconde ; candidat et second témoin1199soumissions chacun. Contextes graphiques identiques hors style, mais cette variation de cadence empêche un verdict de gain ou de non-régression globale. Tous les reçus sont conservés. Les soumissions observées à≈4,17ms ne sont pas une preuve de FPS affichés ni un chronomètre GPU.

Reçus, échecs initiaux, témoins, contrôles graphiques et état de livraison : `tmp/origami-graphics-20261101/progress.md`. Les fichiers publics historiques, campagnes réelles, archives uniques et jonctions restent protégés. Aucune campagne n'est utilisée comme fixture de ce lot. La publication suit la procédure [Direct Upload de Cloudflare](https://developers.cloudflare.com/pages/get-started/direct-upload/) ; commit, push et publication restent des événements distincts attestés dans le reçu.
