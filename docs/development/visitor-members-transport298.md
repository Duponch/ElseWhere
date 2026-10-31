# Arrivée des visiteurs : refus de transport corrigé — schéma 298

Dans la partie réelle 325×325, la première arrivée de visiteurs arrêtait la simulation au 8 avrimai vers 17h59 (Core150000). Le premier refus concernait la publication complète ; l'erreur suivante d'en-tête Core était une conséquence du prédécesseur resté ancien dans MAIN.

## Cause et correction

Le constructeur réel des groupes de visiteurs conserve leurs membres sous forme d'identifiants numériques. Deux contrôles historiques, Party et Forestry, parcouraient cette liste comme une liste d'objets personnages. Cette collision existe dans leurs lignes du 23 octobre, avant la refonte des déplacements ; aucun futur d'horloge n'est établi pour ce défaut précis.

Les contrôles distinguent maintenant uniquement le chemin visiteurs → groupes → membres. Celui-ci accepte des identifiants entiers positifs, dans une liste dense de propriétés propres et énumérables. Getters, trous, objets substitués et enveloppes de delta sont refusés. Les membres de caravanes et de garde restent des objets ; les clôtures historiques, budgets et refus de champs futurs sont conservés.

Les cinq motifs auparavant réunis sous un message de facture sont séparés, sans changer l'ordre des contrôles. Ni règles des visiteurs, ni calendrier, déplacements, RNG, commandes, acquittements ou schéma ne changent. Il s'agit de notre transport interne, sans nouvelle règle de RimWorld revendiquée.

## Vérification et limites

- Dix cas ciblés : huit échecs/deux succès avant, dix succès après. Typage complet et build Pages acquis.
- La même vraie colonie a franchi Core150000 à ×6 et atteint 20h30 avec un visiteur et ses trois colons d'origine vivants. Sauvegarde manuelle, export, recharge par l'interface puis nouvel export : fichiers intégralement identiques (SHA256 98d64752a746a59373ee3da6e5e96e53d29a5b65b91dbf2fa97d0358edfc340f, Core156290).
- L'ancien scénario visiteurs préparé sur une carte de 32 reste non qualifié : son refus initial Party devient un refus de registre de groupes. Il n'a pas atteint ingestion/rejeu ; ce n'est pas une suite globale verte ni une preuve que le second refus est causé par ce changement.

Comparaison locale de 300 passages doubles sur une projection partielle identique : témoin/candidat/témoin, temps mural 1423,936 / 1507,790 / 1417,813 ms ; CPU processus 672 / 672 / 610 ms. Entrées, sorties, références et RNG conservés. L'écart mural défavorable est retenu : aucun coût nul, absence générale de régression ou résultat FPS global n'est démontré.

La revue adjacente des gardes n'a trouvé aucune autre collision de ces identifiants dans cette chaîne précise. La campagne continue ; cette correction ne prouve pas la stabilité de tous les événements ni une identité exhaustive avec RimWorld.
