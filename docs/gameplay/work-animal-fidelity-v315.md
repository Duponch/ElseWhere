# Corrections de fidélité : récoltes, cuisine et animaux — V315

Schéma 315. Un troisième audit, en lecture seule, a comparé à RimWorld 1.6 Core les règles des plantes, des animaux et des vitesses de travail. La plupart concordaient déjà :
- croissance et besoins des cultures ;
- flore sauvage ;
- statistiques des animaux ;
- vitesses de travail ;
- électricité.

Ce lot corrige les six écarts confirmés dans les définitions et le code du jeu de base.

## Corrections

- **Rendement de récolte aux niveaux élevés.** Les valeurs des niveaux 17 à 19 de Culture étaient décalées d'un niveau. Elles valent désormais 109 %, 110 % et 112 %, comme dans le jeu de base ; le niveau 20 reste à 113 %.
- **Plantes abîmées.** Toute plante abîmée rapporte moins, selon les points de vie qui lui restent : de 100 % du produit intact à 50 % pour une plante presque détruite. Avant, seules la racine médicinale et l'herbe à foin suivaient cette règle.
- **Cuisiniers maladroits.** En dessous du niveau 0 (mains ou vue blessées), la vitesse de cuisine suit la courbe du jeu de base : elle baisse de 1,95 % par point au lieu de 1,5 %, sans descendre sous 10 %.
- **Apprivoiser et dresser : capacités.** Une capacité un peu réduite ne pénalise plus. Par exemple, la parole à 80 % compte comme intacte pour apprivoiser, car le jeu de base tolère 20 % de perte. En dessous, la pénalité est proportionnelle. Avant, la tolérance servait seulement de plancher.
- **Apprivoiser : sauvagerie.** La chance d'apprivoiser ne porte plus de facteur ×0,5 en plus de celui de la sauvagerie de l'espèce. Les espèces d'origine prennent leur sauvagerie du jeu de base :

  | Espèce | Sauvagerie | Facteur d'apprivoisement |
  |---|---|---|
  | Lièvre, cerf, gazelle | 75 % | inchangé (×0,5) |
  | Muffalo | 60 % | ×0,8 |
  | Dromadaire | 25 % | ×1,5 |

  L'entretien du dressage de ces espèces utilise aussi le facteur du jeu de base, 1,5 − sauvagerie : il est inchangé pour le lièvre.
- **Portées du lièvre.** Une hase donne naissance à deux petits trois fois sur quatre, et à un seul une fois sur quatre (avant : moitié-moitié). Le tirage aléatoire reste unique.

## Adaptations connues, non modifiées

- **Inspiration et liens :** l'inspiration d'apprivoisement, le bonus de lien et les animaux vénérés des extensions ne sont pas représentés.
- **Portées des renards d'origine :** ces renards ont toujours un seul petit. Le jeu de base en donne d'un à trois.

## Sauvegardes

Une sauvegarde 314 passe à 315 en changeant seulement son numéro. Les règles s'appliquent dès la récolte, la cuisson, la tentative ou la naissance suivante.

## Vérifications

`tests/work-animal-fidelity-315.test.ts` couvre :
- les valeurs de récolte par niveau, avant et après 315 ;
- le rendement d'un riz et d'une herbe à foin abîmés ;
- la courbe de cuisine sous zéro et son minimum ;
- la tolérance des capacités ;
- les chances d'apprivoiser et de dresser, et la sauvagerie des espèces d'origine ;
- la portée du lièvre ;
- la migration.

Le lièvre garde exactement ses anciennes chances d'apprivoisement et d'entretien.
