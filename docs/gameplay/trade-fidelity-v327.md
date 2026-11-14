# Commerce : vêtements de cadavre, achats des visiteurs, richesse — V327

Schéma 327. Ce lot corrige trois écarts relevés par l'audit du commerce face au jeu de base.

## Vêtements portés par un mort

Dans le jeu de base, un vêtement retiré d'un cadavre ne vaut plus qu'un dixième de sa valeur. Ce dixième s'applique après la qualité et avant l'usure. Aucun marchand ne l'achète.

Elsewhere marquait déjà ces vêtements (schéma 284) mais les vendait au prix plein. Désormais :
- un visiteur ou une caravane refuse de les acheter ;
- leur valeur compte pour un dixième dans la richesse de la colonie et dans la valeur des caravanes.

On ne peut donc plus dépouiller des pillards pour revendre leurs habits au prix fort.

## Ce que les visiteurs achètent

Les visiteurs et les caravanes du jeu de base achètent tout objet qui vaut au moins 15 d'argent l'unité, ainsi que les drogues. Elsewhere refusait l'or, les composants avancés, le cœur d'IA, les romans, les prothèses de bras et de jambe, et la bière. Les visiteurs et les caravanes les achètent désormais, sans pour autant en vendre.

## Richesse de la colonie

La richesse règle la force des raids et les attentes des colons. Deux règles du jeu de base s'appliquent désormais :
- **Seuls les bâtiments de la colonie comptent.** Les ruines anciennes, les sarcophages, les débris de vaisseau ou les capsules lumineuses sans faction n'augmentent plus la richesse.
- **Rien sous le brouillard ne compte** : ni les objets, ni les sols des zones encore inexplorées.

## Écarts restants

Ce lot ne traite pas ces écarts, qui restent à faire :
- la valeur des colons et des animaux dans la richesse ;
- la bonne volonté gagnée en commerçant ;
- les caravanes marchandes qui visitent la colonie ;
- le stock des caravanes rencontrées sur la carte du monde ;
- les achats des vaisseaux en orbite ;
- le négociateur mobilisé.

## Sauvegardes

Une sauvegarde 326 passe à 327 en changeant seulement son numéro.

## Vérifications

`tests/trade-fidelity-327.test.ts` couvre :
- la valeur et le refus des vêtements de cadavre ;
- les nouveaux achats des visiteurs ;
- la richesse sous le brouillard et hors de la colonie ;
- la migration.
