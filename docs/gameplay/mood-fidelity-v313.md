# Corrections de fidélité : humeur — V313

Schéma 313. Un second audit en lecture seule a comparé les règles d'humeur, de besoins et de compétences d'Elsewhere aux définitions et au code de RimWorld 1.6 Core. Presque tout concordait déjà :
- **Pensées** : valeurs des pensées de faim, repos, confort, loisirs, beauté et douleur, empilement ;
- **Humeur et crises** : vitesses de l'humeur, seuils et délais des crises ;
- **Besoins** : vitesses de la faim, du repos, des loisirs, du confort et de la beauté ;
- **Compétences** : courbe d'expérience, passions, saturation quotidienne et oubli.

Ce lot corrige les six écarts confirmés.

## Corrections

- **Fatigue en voyage.** Dans le jeu de base, la pensée de fatigue (« Somnolent », « Très fatigué », « Épuisé ») n'existe pas pour une personne hors de la carte. Les membres d'une caravane ne la reçoivent donc plus.
- **Attentes en voyage.** Hors de la carte, un colon ou un prisonnier de la colonie a des attentes « très basses » : +24 d'humeur, et une tolérance aux loisirs qui baisse de 0,13 par jour. Avant, la caravane reprenait le niveau de la colonie, ou un niveau fixe de +30 sans économie.
- **Attentes des prisonniers.** Un prisonnier de la colonie sur la carte a les attentes de la colonie, selon sa richesse, comme les colons. Avant, il avait toujours +30.
- **Bonus de difficulté des prisonniers.** Le bonus d'humeur du niveau de difficulté (+5 en « Récit d'aventure ») s'applique aussi aux prisonniers de la colonie, même venus d'une autre faction.
- **Plaie infectée.** Une infection de plaie donne la pensée « Malade » (−5), comme dans le jeu de base.
- **Seuils de beauté.** Une valeur exactement égale à un seuil reste dans la catégorie inférieure, comme dans le jeu de base : 35 est encore « laid », 65 encore « neutre ».

## Adaptations connues, non modifiées

- **Confort hors de la carte :** le jeu de base peut donner « Inconfortable » en caravane ; Elsewhere ne réutilise ni le confort ni la beauté d'une carte quittée.
- **Attentes :** les rôles des extensions ne sont pas représentés.
- **Loisirs :** la méditation est rangée parmi les loisirs solitaires.

## Points douteux relevés, laissés en l'état

L'audit signale aussi des cas qu'il n'a pas pu confirmer :
- un seuil de faim de 12,5 % pendant le sommeil, sans équivalent trouvé ;
- un bonus d'humeur de caravane pris sur le premier membre ;
- la beauté figée hors de la carte ;
- une personne portée qui garde ses pensées de repos.

Ils restent à vérifier.

## Sauvegardes

Une sauvegarde 312 passe à 313 en changeant seulement son numéro. Les nouvelles règles s'appliquent dès la mise à jour suivante de l'humeur.

## Vérifications

`tests/mood-fidelity-313.test.ts` couvre :

- les seuils de beauté ;
- la pensée « Malade » d'une plaie infectée ;
- la fatigue et les attentes en voyage ;
- les attentes et le bonus de difficulté d'un prisonnier venu d'ailleurs ;
- la migration.
