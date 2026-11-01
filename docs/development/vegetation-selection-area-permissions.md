# Sélection de la végétation et permissions par rectangle


Les petits couvre-sols et les vrais buissons utilisaient une silhouette trop semblable malgré des interactions différentes. Le lot distingue leur présentation, raccorde la multisélection aux définitions concrètes des plantes et ajoute les outils **Autoriser / Interdire** par rectangle dans Ordres. Le schéma de sauvegarde reste **301** ; aucune migration ou nouvelle espèce n'est créée.

## Règles établies et adaptations

La référence locale est **Core1.6.4871rev590**, `Assembly-CSharp.dll` SHA-256 `5cf1b5be399d5b1c9c56ca72c9d35b4ecf307feacf5859d04ac5a1aa5926356a`. La lecture ciblée de Selector, ThingSelectionUtility, des deux Designator et des dix XML plantes est conservée dans le reçu primaire privé. Le [guide de démarrage du wiki](https://rimworldwiki.com/wiki/Quickstart_Guides) corrobore l'accès Ordres → Autoriser → clic-glissé ; le détail des filtres provient du code local, pas de ce guide.

Les **32 espèces locales et 7 cultures** ont été résolues par héritage XML. Huit couvre-sols sont non sélectionnables. Le buisson ordinaire, les arbres et les cultures restent sélectionnables individuellement mais ne participent pas au double clic des semblables ; baies, agave, racine sauvage, Glowstool et Agarilux le permettent. Bryolux garde son propre flag. Les anciens arbres sans espèce utilisent le repli documenté de la famille TreeBase ; un ancien wild-plant sans identité concrète garde sa compatibilité historique, sans parité Core inventée.

La sélection des semblables utilise la définition concrète, la visibilité et le brouillard, avec le plafond Core de **200 objets/stacks**, distinct de la somme des unités. Les huit exclusions ne deviennent pas des buissons cliquables pour reproduire artificiellement le cas humain. La projection d'une vue3D reste une adaptation géométrique : aucune identité exhaustive de tous les contours2D/3D n'est revendiquée.

Les deux outils rectangle parcourent les **piles au sol admissibles** dans les cases connues : valeur cible explicite autorisée/interdite, filtre commun à l'aperçu et au commit, une seule commande froide et les gardes existantes de permission/propriétaire. Ils ne dépendent ni du premier objet touché ni du plafond de sélection. Le contrat primaire des Designator porte sur **Item + CompForbiddable** ; plantes, pawns, bâtiments, inventaires et gizmos individuels sont des voies distinctes. Le lot ne crée pas de permission sur une représentation locale qui ne possède pas déjà ce contrat.

## Présentation et interaction

Cinq couvre-sols autrefois confondus avec une boule de buisson reçoivent un profil bas avec les géométries, couleurs, identités et croissance existantes. Les originaux ne sont ni supprimés ni déplacés. Une pile peut légitimement partager une case avec une plante selon ses règles de dépôt ; ce lot ne fabrique pas un support végétal pour surélever l'acier.

Le survol des outils de carte agrandit l'outil autour de son **centre fixe**, ajoute son titre et conserve les informations d'aide. Les voisins, la disposition de base et la charte carton3D restent stables ; sortie du survol et état pressé reviennent à cette même base. Les autres animations et fenêtres ne sont pas réorganisées par cette couture.

## Qualification et limites

Treize nouveaux cas et quarante-trois cas existants distincts passent : rectangles, plusieurs Items par case, 240 piles, brouillard, propriétaires, refus avant écriture, save/recharge, checkpoint Full/deltas, sélection et formes, centre fixe du survol. Deux anciens oracles de gizmos échouent aussi avec leurs préimages ; leur bouton de permission supplémentaire vient du lot antérieur et les échecs sont conservés. Le lot ne revendique donc pas une suite générale entièrement verte.

Types complets : 75.346 s ; Pages CODE : 4.623 s. Une première compilation a été arrêtée après détection d'un import type erroné ; la suivante a révélé deux raccords de types de tests, corrigés. Les reçus antérieurs restent conservés. Carte 2135 sources, SHA-256 b387fb0b266e40443920e302287242b3bbfe949b53cbe01ebab5b127c4e36e79.

Observation Root Native/WebGPU dans un petit composant séparé : voir le reçu privé native-observation-root.json. Les palettes et gestes sont réels, les callbacks d'outil sont des spies UI explicites ; le contrôle moteur et la conservation sont acquis séparément. Aucun Main/Worker ou campagne joué, aucun ACK Engine déduit d'un clic spy. Le rendu de comparaison des plantes utilise les vraies parts avec éclairage simplifié ; il ne prouve pas les pixels ou le picking exacts de la capture humaine.

La pile acier3460 et le buisson entouré n'ont pas été joints à leur sauvegarde exacte. Leurs silhouettes et règles sont traitées sans inventer une surélévation, supprimer une plante ou interdire universellement leur coexistence. Les représentations locales sans permission existante, dont PackedFurniture, restent hors du contrat de ce rectangle.

La commande froide parcourt les piles une fois et conserve références, quantités, propriétaires, horloges et RNG. Le survol modifie les scalaires du seul bouton et au plus une étiquette ; les formes basses réutilisent la même géométrie et le même batch. Aucun coût nul, débit de simulation ou FPS global n'est déduit de ces contrôles.

Schéma301 inchangé. Les Workers sont reconstruits et peuvent changer puisque le chemin de commande est modifié. Les 565 publics et leurs 71 chemins de sauvegardes/68 fiches doivent être comparés exactement au paquet fermé avant publication, sans écrire leurs hardlinks. Commit, push et déploiement ne sont attestés que par leurs reçus ultérieurs. Vraie325 protégée en pause ; Monde reste privé et suspendu pendant ce lot.
