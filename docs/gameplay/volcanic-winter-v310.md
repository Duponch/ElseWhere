# Hiver volcanique — V310

Schéma 310. Le conteur tirait déjà l'hiver volcanique du jeu de base (catégorie « divers », poids 0,08), sans aucun effet. Il s'applique désormais selon les règles de RimWorld 1.6 Core (`VolcanicWinter`, `GameCondition_VolcanicWinter`). Les textes sont propres à Elsewhere. Le code se trouve dans `src/sim/volcanic-winter-state-310.ts` (règles) et `src/sim/volcanic-winter-310.ts` (incident).

## Déclenchement

- Pas avant le **jour 60**, puis au moins **140 jours** entre deux débuts.
- Durée : **7,5 à 40 jours**.
- Il n'est pas tiré quand la colonie n'a pas de carte d'origine active.

## Effets

Chaque effet monte progressivement pendant les 50 000 premiers ticks Core (environ 0,83 jour) et redescend pendant les 50 000 derniers.

- **Température extérieure** : −7 °C à pleine intensité.
- **Lumière du ciel** : elle est tirée de 30 % vers 0,55. Les journées sont donc plus sombres (en plein jour, 100 % devient 86,5 %) et les nuits un peu moins noires. La croissance des plantes à l'air libre et la production des panneaux solaires baissent d'autant. La croissance acquise est figée au début et à la fin de l'hiver.
- **Faune sauvage** : la densité visée et la probabilité d'arrivée de nouveaux animaux sont divisées par deux.
- **Loisirs** : personne ne se détend en plein air ; seuls les loisirs sous un toit restent possibles.

L'hiver volcanique apparaît dans les alertes et l'inspection de la météo, avec la baisse de température et la durée restante.

## Limites

- La couleur du ciel n'est pas encore assombrie à l'écran.
- Si une éclipse a lieu pendant un hiver volcanique, leurs pertes de lumière pour les plantes sont calculées séparément puis additionnées. C'est une approximation pour ce cas rare.

## Sauvegardes

Une sauvegarde 309 passe à 310 en changeant seulement son numéro ; aucun hiver n'est déclenché. Le calendrier « divers » n'accepte les champs de l'hiver volcanique qu'à partir du schéma 310 : nombre, dernier début et période en cours. Un hiver en cours doit avoir commencé à ce dernier début.

## Vérifications

`tests/volcanic-winter-310.test.ts` couvre :

- le jour 60, la durée et le délai de 140 jours ;
- la montée progressive, le −7 °C, la lumière, la croissance et la faune ;
- la fin de l'hiver ;
- le calendrier sauvegardé ;
- la migration 309 → 310.
