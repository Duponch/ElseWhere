# Réserves profondes — phase 2, schéma 382

Référence locale : RimWorld Core 1.6.4871, `ThingDefs_Items/Items_Resource_Stuff.xml`, `CompDeepScanner`, `DeepDrillUtility`, `GenRadial`, `CellFinderLoose`, `CellFinder`, `IntVec3` et `GenCollection` lus dans l'installation Steam. Les données et règles sont réimplémentées ; aucune source propriétaire ni sauvegarde réelle dans le dépôt.

## Catalogue et import

| Minerai Core | Poids de découverte | Unités par portion | Taille du gisement en cases |
|---|---:|---:|---:|
| Silver | 0,5 | 70 | 2–10 |
| Gold | 0,5 | 8 | 1–4 |
| Steel | 4 | 45 | 20–30 |
| Plasteel | 1 | 10 | 2–10 |
| Uranium | 1 | 15 | 4–10 |
| Jade | 0,5 | 15 | 1–4 |

Les six définitions ordinaires (300 unités initiales par case) sont désormais reconnues en simulation et à l'import, dans les checkpoints/deltas, dans le forage et l'affichage des réserves. Uranium et jade utilisent les véritables objets et piles du jeu, et leur débit s'applique au stock brut avant le rendement du mineur. Les anciennes versions continuent à refuser les deux types qui n'existaient pas dans leur modèle ; aucun stock n'est créé à la migration.

Lecture indépendante de la grille comprimée de `Yes.rws` (SHA-256 `bd9af6c8…952b3`) : 58 cases d'acier contenant 17 265 unités et 10 cases d'uranium contenant 3 000 unités. Le contrat du témoin exige maintenant ces quatre quantités, soit 68 cases et 20 265 unités en tout, sans substitution.

## Règles corrigées en même temps

- Les 21 cases interrogées par la foreuse suivent les égalités de distance de `GenRadial` : tri Mono de la liste complète de 25 600 positions avant de prendre le préfixe. Les 60 premières positions suffisent également à tous les gisements. Z est reflété selon la convention du repère ElseWhere. Le préfixe constant évite le tri au démarrage comme les allocations de sous-tableau à chaque interrogation.
- Découverte : au maximum 1 000 essais dans l'intérieur à 10 cases du bord, comme Core, au lieu de constituer à chaque fois la liste de toutes les cases éligibles. Si le premier tirage réussit, pas de parcours de la carte. La garde de terrain teste le support `Light` réel et l'eau profonde du terrain sous-jacent, y compris sous une roche minable. Une surface d'eau peu profonde sans pont ne suffit plus. Aucun nouvel examen de terrain à chaque tick.
- Une carte géographique de banquise (`sea-ice`) ne possède pas de socle rocheux : scanner indisponible, foreuse admise uniquement si une réserve préexistante est accessible. Le repli vers la roche naturelle utilise le vrai terrain de base quand c'est de la roche brute ; sinon il utilise le hash Core de la cellule et le premier entier de Verse.Rand dans la liste géographique des roches du site, sans consommer le RNG du monde.

## Frontières de fidélité restantes

L'état des six réserves ordinaires est représenté sans perte. La continuation stricte de la découverte/extraction n'est pas encore prouvée identique : le flux temporel de tirages de la simulation reste distinct du flux `Rand` partagé de Core, l'ordre d'insertion natif des `ThingDef` n'a pas été mesuré en exécution, et les échecs de placement sont des transactions locales atomiques de sécurité. Les grilles développeur de quantités au-delà du stock ordinaire de 300 par case ne sont pas généralisées. L'interdiction automatique de toutes les foreuses voisines à l'épuisement d'une réserve reste à raccorder au véritable propriétaire des interdictions de bâtiments. Ne pas annoncer la parité de l'environnement de forage complet avec la seule preuve d'import des réserves.
