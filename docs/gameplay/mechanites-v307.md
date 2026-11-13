# Mécanites fibreuses et sensorielles — V307

Schéma 307. Le conteur tirait déjà ces deux maladies du jeu de base dans la catégorie « maladie », sans aucun effet. Elles touchent désormais de vrais habitants, selon les règles de RimWorld 1.6 Core : gravité, stades, soins et durée sont relevés dans les définitions du jeu, et les textes sont propres à Elsewhere. Le code se trouve dans `src/sim/mechanites-307.ts` et dans `resolveMechaniteIncident307` (`src/sim/flu-incidents.ts`) ; l'affichage dans `src/ui3d/native-special-inspection.ts` et `src/ui/parasites-inspection.ts`.

## Qui est touché

- **Poids par biome** : 30 ou 40 chacune dans la catégorie maladie, sur tous les biomes. Elles sont plus fréquentes sur la toundra, la tourbière froide et dans les régions glacées, où peu d'autres maladies existent.
- **Victimes** : de 20 % à 50 % des colons et prisonniers présents, et au moins une personne, comme les autres maladies. Une personne déjà atteinte du même type n'est pas choisie.

## Évolution

- La gravité commence à 0,1 % et augmente de **25 % par jour**, jusqu'à 100 %.
- Un soin de qualité *q* la fait baisser de *q* par jour pendant **51 heures** (48 heures plus 3 heures de chevauchement, pendant lesquelles un nouveau soin s'ajoute au temps restant). Un soin à 100 % fait donc reculer la maladie de 75 % par jour. La gravité ne descend jamais sous 0,1 % : les soins ne la font pas disparaître.
- Les mécanites **disparaissent d'elles-mêmes** après 15 à 30 jours ; la durée est tirée à la contamination.

## Effets

| | Stade 1 (sous 50 %) | Stade 2 (50 % et plus) |
|---|---|---|
| Douleur | +20 % | +60 % |
| Fatigue | 1,7 fois plus rapide | 2 fois plus rapide |

Les effets sur les capacités sont les mêmes aux deux stades :

- **Mécanites fibreuses** : manipulation, déplacement et circulation sanguine **augmentent** de 50 points.
- **Mécanites sensorielles** : vue, ouïe et parole augmentent de 50 points, et la manipulation de 30 points.

Avec des mécanites fibreuses, la capacité de déplacement peut dépasser 100 %, ce qui rend la personne plus rapide, comme dans le jeu de base. À partir du schéma 307, la sauvegarde accepte donc une vitesse de marche jusqu'à 200 %. Les sauvegardes plus anciennes gardent la limite de 100 %, qu'elles ne pouvaient pas dépasser.

Les deux donnent la pensée « Malade ». Elles n'imposent pas le repos au lit. Les soins servent surtout à garder la maladie au stade 1, où la douleur est moindre.

## Limites

Sur les anciens sites non géographiques, le tirage de ces maladies reste sans effet. La maladie du sommeil et la dégradation d'organes restent absentes.

## Sauvegardes

Une sauvegarde 306 passe à 307 en changeant seulement son numéro. Aucune maladie n'est donnée rétroactivement. Le dossier médical n'accepte le champ des mécanites qu'à partir du schéma 307, avec une gravité, une durée de vie et un soin cohérents.

## Vérifications

`tests/mechanites-307.test.ts` couvre :

- la montée de la gravité, le stade 2 et le plafond ;
- le soin de 51 heures et le plancher de 0,1 % ;
- la disparition après la durée de vie ;
- les effets : douleur, capacités, fatigue et pensée « Malade » ;
- les cibles de soin, un vrai médecin et la reprise exacte de la sauvegarde ;
- le tirage : 20 à 50 % des colons, jamais deux fois le même type, rien avant le schéma 307 ;
- un médecin atteint de mécanites fibreuses qui marche plus vite que 100 %, et la sauvegarde de ce déplacement ;
- la sauvegarde et la migration 306 → 307.
