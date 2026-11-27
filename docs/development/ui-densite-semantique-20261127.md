# Densité et sens des couleurs dans les fiches natives — 27 novembre 2026

À la demande de Saf : retirer les zones vides des fenêtres, rendre les catégories plus lisibles, et conserver le sens des couleurs avec le thème configurable. Cette tranche ne modifie ni la simulation, ni une commande, ni une sauvegarde. Elle conserve les trois rôles de police de `native-ui-scale.ts`.

## Référence vérifiée

Lecture du code Core 1.6 décompilé déjà disponible localement (`tmp/planner-study/full`, sources de référence uniquement) : `Verse.ColoredText`, `RimWorld.NeedsCardUtility`, `ITab_Pawn_Needs`, `ITab_Pawn_Gear`, `HealthCardUtility`, `InspectPaneFiller`. Voir aussi les [onglets](fenetres-rimworld-onglets.md) et la [référence générale](rimworld-ui-reference.md).

| Rôle Core | Valeur lue | Application dans cette tranche |
| --- | --- | --- |
| `ColoredText.NameColor` | `d09b61` | Rôle sémantique personne, également sur le nom de la Bio |
| `TipSectionTitleColor` | `(0,9 ; 0,9 ; 0,3)` | `NATIVE_INK.sectionTitle` pour catégories, titres et intitulés des besoins |
| `SubtleGrayColor` | `999999` | `NATIVE_INK.subtle` pour l'activité « Inoccupé » |
| Effet d'une pensée | vert positif, rose négatif, gris sans effet | Couleur du nombre conservée ; le libellé reste neutre comme dans Core |
| Opinions | gris sous 10 en valeur absolue, rouge négatif, vert positif | Signe et couleur conservés, y compris l'avis réciproque |
| Douleur et capacités | seuils Core déjà implémentés | Couleurs explicites conservées ; le moteur sémantique ne les remplace pas |

Les valeurs RGB du jeu sont des références sur son fond sombre. Les rôles partagés sont résolus par le thème d'Elsewhere, afin de garder leur contraste sur le papier choisi. Aucune nouvelle couleur de texte locale n'est ajoutée ici. Les fonds d'alertes, déjà liés aux priorités Core, ne sont pas reclassés comme des titres.

## Résultat et adaptations déclarées

- **Besoins** : la hauteur suit le bas réellement occupé par les besoins ou les pensées, avec le maximum Core de 520. Les jauges conservent leurs rectangles : l'apparition d'une pensée ne les comprime pas. Les pensées gardent leur défilement ; si une liste exceptionnelle de besoins dépasse le maximum à cause du minimum de 30 points des besoins mineurs, elle dispose aussi de son défilement.
- **Santé** : le résumé et la liste des lésions déterminent la hauteur jusqu'à 430. Le saignement reste sous la liste. Libellés de capacités et valeurs disposent de deux zones distinctes : un nom long ne passe plus sous son pourcentage. Les lésions longues restent défilantes.
- **Matériel** : hauteur selon possessions et portrait, bornée par la place réelle au-dessus de l'inspecteur. Les rangées et leurs boutons restent hors du portrait. Le maximum de 4 000 fourni par le dossier ne fait plus créer une liste interne trop haute pour l'écran.
- **Social** : les listes de relations et d'interactions retirent leur bas vide indépendamment, conservent leurs plafonds et leurs propres défilements, avec la séparation de 17 points. L'opinion réciproque conserve toute son encre, car l'alpha de Core sur fond sombre ne conserve pas le contraste du texte sur un papier configurable ; parenthèses et colonne la distinguent toujours.
- **Bio, fiches d'information et autres catégories** : rôle des noms et des titres commun. Les textes neutres des cartes utilisent le lexique de personnes, objets, actions et valeurs existant. Les couleurs explicites de santé, avis et effets restent prioritaires.
- **Activité de sélection** : Small sur des lignes de 22 points, centrage vertical et retrait horizontal de 4 points. Le texte de l'activité réelle reste intact. « Inoccupé » utilise le rôle secondaire. Le titre d'une sélection passe par le vrai lexique : un objet n'est pas pris pour une personne à cause de sa majuscule.
- **Molette imbriquée** : une carte consomme le geste seulement si son défilement se déplace. Une liste qui tient dans sa zone, ou l'extrémité d'une liste, laisse la page extérieure défiler sur un petit écran.

Les hauteurs ajustées sont une adaptation explicite demandée par Saf : Core conserve notamment une fenêtre Besoins de 580 × 520 avec humeur, une Santé de 630 × 430, une Social de 540 × 510 et une hauteur initiale Matériel de 450. Les espacements, colonnes, tailles de ligne et contrôles utiles sont conservés ; aucune parité dimensionnelle exhaustive n'est revendiquée.

## Validation et limites

Premier passage ciblé : `native-tab-cards.test.ts` et `native-ui-scale-system.test.ts`, **40 réussites sur 40**, un seul worker, 11,36 s. Il couvre les bornes de jauges, seuils de couleur, listes et cibles défilantes, conservation des contrôles et des trois tailles de texte, les hauteurs compactes et l'absence de recouvrement du portrait.

Le correctif final de hauteur disponible et de transfert de la molette ajoute deux contrats fonctionnels : carte Matériel réellement bornée sur un écran de 650 points et propriété de la molette aux deux extrémités d'une liste. Reprise des seuls contrats touchés (`native-tab-cards.test.ts` et `native-tab-wheel-fallback.test.ts`) : **32 réussites sur 32**, un seul worker, 11,65 s. L'union des deux passages contient **42 contrats réussis**. Rapport final : `tmp/ui-semantics-wheel-tests-20261127.log` ; copie des sources observées et empreintes dans `tmp/ui-semantics-20261127-final/`.

La composition reste dans les mises en page et l'impression des textures déjà existantes, à leur cadence de rafraîchissement ; aucun objet graphique ni travail de simulation par image n'est ajouté. Aucun banc FPS/GPU ni contrôle visuel navigateur effectué par cette tranche. L'intégration du thème et les autres lots concurrents sont qualifiés séparément par ROOT. Les chantiers de performance existants et la décision différée du rendu en Worker restent inchangés.
