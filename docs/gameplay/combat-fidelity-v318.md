# Corrections de fidélité : combat — V318

Schéma 318. Un audit, en lecture seule, a comparé à RimWorld 1.6 Core les règles de combat d'Elsewhere. Les points suivants concordaient déjà :
- précision du tireur et de l'arme ;
- couvert et tirs perdus ;
- cadences de tir ;
- jet d'armure ;
- corps à corps (toucher, esquive, choix de l'attaque) ;
- choix des parties du corps ;
- douleur, chute, saignement et mort.

Ce lot corrige quatre des neuf écarts confirmés.

## Corrections

- **Animaux de la colonie à terre.** Un animal sauvage abattu par la violence meurt une fois sur deux en tombant, comme dans le jeu de base. Un animal de la colonie ne subit plus ce tirage : chiens, chats et bêtes de somme blessés par un prédateur ou un animal enragé survivent à terre.
- **Taille des animaux visés.** Pour la précision d'un tir, un animal présente sa vraie taille corporelle, bornée entre 0,5 et 2 comme dans le jeu de base, au lieu d'une valeur fixe de 0,2. Un muffalo ou un ours est donc bien plus facile à toucher, un lièvre reste petit. La chasse et la défense contre les animaux enragés y gagnent.
- **Recul des animaux touchés par balle.** Une balle ne ralentit un animal que si sa taille ne dépasse pas le pouvoir d'arrêt du projectile :
  - balle de revolver ou de fusil : pouvoir d'arrêt 1 à 1,5 ;
  - flèche : 0,5.

  Un ours ou un muffalo touché continue donc sa charge.
- **Étourdissement d'un coup contondant.** Un coup contondant étourdit pendant 2 secondes, soit 120 ticks du jeu de base. Avant, une valeur calibrée de 45 ticks était utilisée. Cela vaut pour les humains, les animaux et les mécanoïdes.

## Écarts restants

- **Pillards à terre :** le jeu de base fait mourir une partie des pillards abattus, selon l'« intention de population » du conteur, qui dépend du nombre de colons et de son historique récent. Ce calcul n'est pas encore modélisé : tous les pillards à terre survivent, ce qui rend les raids moins meurtriers et les prisonniers trop nombreux.
- **Armure naturelle :** tortue, mégascarabée, mégaraignée et spélopède ont une armure dans le jeu de base, ignorée ici.
- **Petites créatures :** le report d'un fort coup sur la partie parente n'est pas fait (lièvres, chats, petits).
- **Coups à mains nues :** leurs dégâts ne baissent pas avec l'efficacité des mains ou de la mâchoire blessées.
- **Langue :** elle saigne, alors qu'elle ne saigne pas dans le jeu de base (impact négligeable).

## Sauvegardes

Une sauvegarde 317 passe à 318 en changeant seulement son numéro. Un étourdissement de 120 ticks n'est accepté qu'à partir de 318. Les bornes de validation qui supposaient 45 ticks suivent désormais le schéma :
- étourdissement d'un colon, d'un tireur ou d'un mécanoïde ;
- promenade en cours ;
- arrêt d'un trajet et délai de déplacement ;
- paquets vers l'affichage.

## Vérifications

Quatre anciens tests de mêlée, de tir et de promenade ont été ajustés à la nouvelle durée. Un scénario de tir étourdi vérifie maintenant la durée du schéma courant.

`tests/combat-fidelity-318.test.ts` couvre :
- la survie d'un animal de la colonie à terre, face à un animal sauvage ;
- la taille d'un animal visé ;
- le recul selon le pouvoir d'arrêt ;
- la durée d'étourdissement ;
- la migration.
