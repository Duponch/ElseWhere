# Opérer, nourrir et parler au chevet d'un lit — V339

Schéma 339. Suite du lot 336, qui a donné aux soins les cases du jeu de base autour d'un lit. Les autres services au chevet gardaient les quatre cases voisines de la tête du patient. Dans la disposition de la campagne « Atterrissage » (trois lits côte à côte, têtes contre un mur), le patient du milieu ne pouvait donc être ni opéré, ni nourri, et un prisonnier couché à cette place ne recevait plus la visite du geôlier.

## Ce qui change

**Opération.** Dans le jeu de base, le chirurgien se place sur la case d'interaction du lit, comme le médecin qui soigne. À partir de 339, il va à la première case libre et atteignable de l'ordre du lit décrit dans le [lot 336](bedside-tending-v336.md) : à côté de la tête, à côté du pied, au-delà de la tête, puis au-delà du pied. Cela vaut pour l'amputation, la pose et le retrait d'une prothèse.

**Repas d'un patient.** Dans le jeu de base, le colon qui nourrit un patient se met sur une case qui touche le patient : une des huit cases autour de sa tête, un coin ne comptant que si l'un de ses deux côtés se traverse sans porte. À partir de 339, il prend la moins coûteuse de ces cases. Les coins comptent désormais, alors qu'avant seules les quatre cases voisines étaient admises.

**Conversation du geôlier.** Avec un prisonnier couché dans un lit, le geôlier parle depuis les mêmes cases que le chirurgien, dans le même ordre. Avec un prisonnier debout, rien ne change.

## Adaptations

- Dans le jeu de base, la personne qui nourrit un patient peut s'arrêter sur un lit voisin. Elsewhere ne laisse personne se tenir sur un lit. Quand aucune case autour de la tête n'est libre, le repas est donné depuis les cases au-delà du pied du lit.
- Le jeu de base laisse le geôlier parler à quelques cases de distance, s'il voit le prisonnier. Elsewhere garde une place fixe : à côté du prisonnier debout, ou une case du lit pour un prisonnier couché.
- Comme pour les soins, une case réservée ou inatteignable est sautée au profit de la suivante.

## Restant

Les visites aux malades gardent la règle d'Elsewhere : une case à moins de deux cases et demie du malade, en vue directe. Le jeu de base utilise la case d'interaction du lit. Dans la disposition de la campagne, la case au-delà du pied convient aux deux règles.

## Sauvegardes

Une sauvegarde 338 passe à 339 en changeant seulement son numéro. Un service déjà engagé avant la mise à jour garde sa case : les nouvelles cases s'ajoutent aux anciennes places, qui restent valables.

## Vérifications

`tests/bedside-services-339.test.ts` couvre :
- l'opération du patient du milieu depuis la case au-delà du pied, jusqu'au travail du chirurgien, avec sauvegarde et reprise exactes, et aucune opération possible avant 339 ;
- le repas du même patient depuis cette case, jusqu'à la fin du repas, et aucun repas possible avant 339 ;
- autour d'un lit isolé, un repas donné depuis une case qui touche le patient, jamais au-delà du pied, et un coin admis seulement à partir de 339 ;
- la conversation avec un prisonnier couché au milieu, depuis la case au-delà du pied ;
- la migration.
