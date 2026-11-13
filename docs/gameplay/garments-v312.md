# T-shirt et blouson — V312

Schéma 312. Deux vêtements courants du jeu de base manquaient au catalogue. La « Chemise » d'Elsewhere est la chemise boutonnée de RimWorld (`Apparel_CollarShirt`). Ce lot ajoute le t-shirt (`Apparel_BasicShirt`) et le blouson (`Apparel_Jacket`), avec leurs valeurs Core ; les textes sont propres à Elsewhere.

| | T-shirt | Blouson |
|---|---|---|
| Matière | 40 unités de tissu ou de cuir | 70 unités de tissu ou de cuir |
| Travail | 1 600 | 7 000 |
| Points de vie | 100 | 160 |
| Couche | sur la peau | par-dessus (comme la parka) |
| Zones couvertes | torse, épaules | torse, cou, épaules, bras |
| Protection (× matière) | 0,2 | 0,3 |
| Isolation froid / chaud (× matière) | 0,22 / 0,10 | 0,80 / 0,30 |
| Recherche | vêtements complexes | vêtements complexes |

Les deux se cousent aux établis de tailleur, à la main ou électriques, dans les 22 matières de couture : soit 44 vêtements. Le t-shirt ne peut pas se porter en même temps que la chemise boutonnée, et le blouson pas en même temps que le cache-poussière ou la parka. Le blouson se porte par-dessus un t-shirt ou une chemise. Leur valeur suit la règle du jeu de base : quantité × valeur de la matière + travail × 0,0036.

## Partie en cours

Migration 311 → 312 : une politique de tenue qui autorisait la chemise boutonnée dans une matière autorise aussi le t-shirt dans cette matière. Une politique qui autorisait le cache-poussière autorise aussi le blouson. Aucun vêtement n'est donné.

## Limites

- **Affichage :** le t-shirt porté reprend la silhouette de la chemise, et le blouson celle de la parka.
- **Commerce :** les visiteurs n'en proposent pas encore à la vente. Ils peuvent en acheter, comme les autres vêtements ordinaires.

## Sauvegardes

Avant le schéma 312, une sauvegarde ne peut contenir ni ces vêtements, ni leurs ouvrages, factures et commandes, ni leur mention dans une politique de tenue. Le contrôle des contenus futurs, déjà utilisé pour la tuque, en tient compte.

## Vérifications

`tests/garments-312.test.ts` couvre :

- les caractéristiques, les couches et les valeurs ;
- un vrai tailleur qui coud un t-shirt puis un blouson en tissu et les porte, avec reprise exacte de la sauvegarde ;
- la limite au schéma 312 ;
- la migration des politiques.
