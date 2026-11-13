# Vers intestinaux et parasites musculaires — V306

Schéma 306. Sur les sites géographiques, le conteur tirait déjà ces deux maladies du jeu de base dans la catégorie « maladie », mais ce tirage restait sans effet. Désormais, il rend malades de vrais habitants, selon les règles de RimWorld 1.6 Core. Les poids par biome, les effets et les soins sont relevés dans les définitions du jeu ; les textes sont propres à Elsewhere. Code : `src/sim/parasites-306.ts` et `resolveParasiteIncident306` dans `src/sim/flu-incidents.ts`. L'affichage est dans la fiche de l'interface 3D (`src/ui3d/native-special-inspection.ts`) et dans l'ancienne fiche HTML (`src/ui/parasites-inspection.ts`).

## Qui est touché

- **Poids par biome** : les vers intestinaux et les parasites musculaires ont chacun leur part dans la catégorie maladie. Elle va de 30 à 80 selon le biome, par exemple 50 en forêt tempérée et 80 en forêt tropicale. Les biomes polaires n'en ont pas.
- **Nombre de victimes** : de 20 % à 50 % des colons et prisonniers présents sur la carte, et au moins une personne. La règle est la même que pour la grippe et le paludisme.
- **Choix des victimes** : une personne qui a déjà cette maladie n'est pas choisie. Pour les vers intestinaux, il faut aussi un estomac (ni l'estomac ni le torse ne doivent manquer). Ces maladies n'ont pas d'immunité : quand une personne est choisie, elle tombe malade.

## Effets

| | Vers intestinaux | Parasites musculaires |
|---|---|---|
| Douleur | +20 % | +20 % |
| Besoin qui baisse deux fois plus vite | faim | repos |
| Capacités | aucune | manipulation −30 points, déplacement −30 points |

Les deux maladies donnent la pensée « Malade » et apparaissent dans la fiche Santé, avec l'état des soins. Elles n'imposent pas le repos au lit.

## Soins et guérison

- Un médecin les traite comme les autres maladies : il va chercher un médicament si la politique de soins le permet, puis applique le soin. La priorité est faible, comme pour une maladie qui ne menace pas la vie.
- Un soin agit **51 heures** : 48 heures plus 3 heures de chevauchement. Un nouveau soin est possible pendant ces 3 dernières heures et s'ajoute au temps qui reste ; les soins peuvent donc s'enchaîner sans interruption.
- La maladie **disparaît** quand la somme des qualités des soins reçus atteint **300 %**. Il faut donc en général plusieurs soins.
- Pendant un voyage, les soins automatiques des membres hors carte les traitent aussi.

## Limites

- Le vomissement des vers intestinaux (environ un par jour) n'est pas encore représenté.
- Sur les anciens sites non géographiques, le tirage de ces deux maladies reste sans effet.
- Les mécanites (fibreuses et sensorielles), la maladie du sommeil et la dégradation d'organes restent absentes : leur part du tirage ne produit toujours rien.

## Sauvegardes

Une sauvegarde 305 passe à 306 en changeant seulement son numéro. Aucune maladie n'est donnée rétroactivement. Le dossier médical n'accepte le champ des parasites qu'à partir du schéma 306. Une maladie dont les soins totalisent déjà 300 % y est refusée.

## Vérifications

`tests/parasites-306.test.ts` couvre :

- les effets : douleur, faim, repos, capacités et pensée « Malade » ;
- la durée de 51 heures d'un soin, son renouvellement pendant les 3 dernières heures et la guérison à 300 % ;
- les cibles de soin, et un vrai médecin qui va chercher le médicament et soigne, avec reprise exacte de la sauvegarde ;
- le tirage : de 20 % à 50 % des colons, jamais deux fois la même maladie, un estomac exigé pour les vers, rien avant le schéma 306 ;
- la sauvegarde et la migration 305 → 306.

Les tests voisins ont été relancés avec ce lot : maladies, soins, besoins, repos, humeur, migrations et sauvegardes.
