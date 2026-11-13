# Corrections de fidélité : soins — V317

Schéma 317. Un quatrième audit, en lecture seule, a comparé à RimWorld 1.6 Core les règles de santé et de médecine. Les points suivants concordaient déjà :
- formule du soin hors lit d'hôpital ;
- infections des plaies ;
- guérison, cicatrices et perte de sang ;
- vitesse d'immunité ;
- maladies et intoxication alimentaire ;
- chirurgie.

Ce lot corrige trois des quatre écarts confirmés.

## Corrections

- **Soin en lit d'hôpital.** Le jeu de base plafonne d'abord la base du soin, (compétence × efficacité du médicament + bonus du lit) × 0,7 en auto-soin, au maximum du médicament. Il ajoute ensuite l'écart aléatoire de ±0,25. Elsewhere ajoutait l'écart avant le plafond, si bien qu'un bon médecin en lit d'hôpital atteignait presque toujours le maximum. Exemple avec des médicaments industriels et une base de 1,2 :
  - avant : toujours 1 ;
  - maintenant : de 0,75 à 1, environ 0,94 en moyenne.

  En auto-soin, l'écart garde toute son amplitude au lieu d'être réduit par le facteur 0,7.
- **Durée d'un soin de la grippe.** Un soin de grippe agit 12 heures plus 3 heures de chevauchement (37 500 ticks du jeu de base), et on peut le renouveler pendant ces 3 dernières heures. Avant, il durait 12 heures avec un chevauchement de 2,4 heures. Il fallait donc soigner environ 25 % plus souvent. Les autres maladies suivaient déjà cette règle.
- **Expérience en soignant un animal.** Soigner un animal rapporte 175 points d'expérience de Médecine (avant le facteur du médicament) au lieu de 500, comme dans le jeu de base.

## Écart restant

**Soin des personnes hors carte.** Le jeu de base ajoute aussi l'écart aléatoire de ±0,25 au soin automatique des personnes du monde. Elsewhere garde la valeur moyenne de 0,225 sans tirage, faute de flux aléatoire propre à ces personnes.

## Sauvegardes

Une sauvegarde 316 passe à 317 en changeant seulement son numéro. Un soin de grippe déjà donné garde sa durée d'origine ; le suivant suit la nouvelle règle.

## Vérifications

`tests/health-fidelity-317.test.ts` couvre :
- le soin en lit d'hôpital, avant et après 317, auto-soin compris ;
- la durée, le renouvellement et la validation d'un soin de grippe ;
- l'expérience pour un animal ;
- la migration.

Les anciens tests de soin en lit d'hôpital et de grippe fixent désormais leur schéma d'origine.
