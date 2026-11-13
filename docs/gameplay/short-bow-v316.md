# Arc court — V316

Schéma 316. Première arme à distance sans poudre : l'arc court du jeu de base (Bow_Short).

## Fabrication

- **Coût :** 30 bois.
- **Exigence :** Artisanat 2, sans recherche.
- **Postes :** emplacement d'artisanat, forge à combustible ou forge électrique.
- **Travail :** 2 400 unités du jeu de base, sans facteur de matière.
- **Ouvrage :** un arc inachevé garde son auteur et sa progression. Le fabricant tire la qualité comme pour les autres armes fabriquées.

## Caractéristiques (qualité normale)

| Valeur | Arc court |
|---|---|
| Portée | 22,9 cases |
| Visée | 1,35 s (81 ticks du jeu de base) |
| Récupération | 1,65 s (99 ticks) |
| Précision (contact / courte / moyenne / longue) | 75 % / 65 % / 45 % / 25 % |
| Flèche | 11 dégâts, pénétration 16,5 %, vitesse 44, pouvoir d'arrêt 0,5 |
| Corps à corps | Branche : contondant ou estoc, 9 dégâts, 2 s |
| Points de vie, masse, valeur | 100, 0,8 kg, 44,64 |

La qualité modifie les dégâts et la précision comme pour les autres armes à distance.

## Flèches

Une flèche fait une **coupure**, et une **fêlure** sur une partie dure (crâne, os). Une balle fait une blessure par balle. L'armure s'applique comme aux balles : la flèche est tranchante. L'arc sert aussi à chasser.

## Commerce

Les marchands visiteurs peuvent vendre un arc court. Le jeu de base l'a toujours compté parmi leurs armes à distance possibles ; Elsewhere ne le produisait pas jusqu'ici. Les tirages aléatoires sont inchangés : un marchand qui vendait déjà quelque chose le vend toujours.

## Rendu

Modèle original : poignée gainée, deux branches, corde. L'arc est tenu droit pour viser, corde vers le tireur, et porté en travers du dos au repos. L'ouvrage inachevé montre la seule perche, sans poignée ni corde.

## Limites

- **Autres arcs :** l'arc recourbé, le grand arc et les pila ne sont pas encore faits.
- **Factions tribales :** elles n'ont pas d'archers, faute de factions tribales dans les raids actuels.
- **Brûlage :** brûler l'arc comme recette n'est pas proposé.

## Sauvegardes

Une sauvegarde 315 passe à 316 en changeant seulement son numéro. Avant 316, les éléments suivants sont refusés :
- l'arc et son ouvrage ;
- sa recette ;
- les flèches en vol et les visées à l'arc.

## Vérifications

`tests/short-bow-316.test.ts` couvre :
- recette, valeur et profil de tir par qualité ;
- coupure et fêlure d'une flèche face à une balle ;
- visée de 81 ticks, vraies flèches et blessures, reprise exacte de la sauvegarde ;
- fabrication réelle au poste d'artisanat avec reprise exacte, puis équipement ;
- vente par les visiteurs avec les mêmes tirages ;
- refus avant 316 ;
- migration.
