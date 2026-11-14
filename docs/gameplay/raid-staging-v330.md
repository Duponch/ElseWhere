# Pirates qui se regroupent avant l'assaut — V330

Schéma 330. Dans le jeu de base, un raid pirate choisit sa stratégie au moment où il arrive. Elsewhere attaquait toujours immédiatement ; il tire désormais la stratégie comme le jeu de base.

## Choix de la stratégie

Poids du jeu de base pour les pirates :

| Stratégie | Poids |
|---|---|
| Attaque immédiate | 1 |
| Attaque immédiate « habile » | de 0 (sans points de menace) à 0,5 (1 000 points et plus) |
| Regroupement puis attaque | 1 |

Les sièges, les sapeurs et les brèches n'existent pas encore dans Elsewhere : ils sortent du tirage. L'attaque habile se joue comme l'attaque immédiate. Un raid sur deux se regroupe donc à bas niveau, deux sur cinq à partir de 1 000 points.

## Le regroupement

Les pillards restent près du point d'arrivée et défendent un rayon de 28 cases autour de lui, comme le devoir « défendre » du jeu de base. Ils passent à l'assaut :
- après un délai tiré entre 5 000 et 15 000 ticks du jeu de base (de 2 à 6 heures de jeu) ;
- ou dès qu'ils ont perdu 30 % des leurs.

Pendant le regroupement, ils ne battent pas en retraite. Le délai de renoncement de l'assaut ne compte qu'à partir de l'assaut. Le journal et le panneau des raids signalent le regroupement, puis le début de l'assaut.

Adaptations :
- le point de regroupement est le point d'arrivée du raid ; le jeu de base cherche une position de siège à distance de la colonie ;
- si les pertes déclenchent l'assaut avant la fin du délai, le délai de renoncement reste compté depuis la fin prévue du regroupement.

Cela ne concerne que les raids de la colonie tirés par Cassandra. Les raids des cartes temporaires, des caravanes et du réacteur du vaisseau gardent leur comportement.

## Sauvegardes

Une sauvegarde 329 passe à 330 en changeant seulement son numéro. Un regroupement enregistré doit avoir un point réel et une fin comprise dans la fenêtre du jeu de base. Il reste enregistré après le début de l'assaut, avec l'heure de ce début, car le délai de renoncement a été repoussé de la durée prévue du regroupement.

## Vérifications

`tests/raid-staging-330.test.ts` couvre :
- la part des raids qui se regroupent, et aucun avant 330 ;
- la défense du point, puis l'assaut après le délai ;
- une sauvegarde valide avec un regroupement long, avant et après l'assaut (défaut trouvé par la campagne « prison ») ;
- le refus d'une fin hors fenêtre ;
- la migration.
