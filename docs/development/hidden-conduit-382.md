# Conduit dissimulé — phase 2, schéma 382

Référence locale : `Buildings_Power.xml` (définition Core `HiddenConduit` et parent `PowerConduit`), `Building.PreApplyDamage`, `ShortCircuitUtility.GetShortCircuitablePowerConduits` et `PlaceWorker_Conduit` lus dans le Core 1.6.4871 installé. Le produit ne copie ni ces sources ni les sauvegardes.

| Propriété | Conduit ordinaire | Conduit dissimulé |
|---|---:|---:|
| Acier | 1 | 2 |
| Travail Core (ticks de base) | 35 | 280 |
| Points de vie | 80 | 100 |
| Combustibilité | 0,7 | 0 |
| Beauté | −2 | 0 |
| Remboursement à la déconstruction | 0 | 0 |

La sauvegarde, la construction et le réseau électrique possèdent désormais le type distinct `hidden-conduit`. Il transmet comme le conduit ordinaire ; son empreinte 1×1 partage la couche de passage sous un mur ou un meuble et n'interdit ni les déplacements ni les plantes. L'import conserve les points de vie de cette définition, plutôt que de les rapporter aux 80 d'un objet ordinaire. Le validateur n'admet pas ce type avant le schéma 382 ; les anciens conduits ne sont pas convertis spontanément. Les deux conduits dépendent de la recherche Électricité.

Le Core absorbe tout DamageInfo sur un `HiddenConduit` dans `Building.PreApplyDamage` : les structures dissimulées ne sont donc plus des cibles de projectile/attaque/mêlée ou de crise de destruction. L'effondrement naturel épais tue toutefois directement les objets destructibles survivants après ses dégâts, ce qui est également respecté. Le court-circuit Core énumère exclusivement `ThingDefOf.PowerConduit`, pas tous les transmetteurs. Un réseau entièrement dissimulé ne peut pas être l'origine d'un court-circuit ; un tronçon ordinaire du même réseau reste éligible.

Présentation : la géométrie ordinaire du conduit n'est plus créée et le fantôme de construction reste visible. Un seul batch instancié d'indications électriques dissimulées est alloué à la demande (sélection/placement d'un appareil électrique, ou outil de déconstruction). Il se masque hors de ces modes, filtre la brume et ne parcourt pas les structures dans le mode normal. La sélection déjà consultée pour les gisements est partagée entre les deux lecteurs ; la lecture des gisements sans identité sélectionnée n'effectue plus de recherche inutile sur tous les bâtiments.

Lecture indépendante de `Yes.rws` : **138 `HiddenConduit` et 283 `PowerConduit`**, zéro `WaterproofConduit`. Le contrat du témoin impose ces deux nombres exacts. Le conduit normal n'est plus accepté comme équivalent à un conduit dissimulé. Les tests couvrent aussi une sauvegarde synthétique avec conduit sous mur à 73/100 PV, son transport, son rendu normal invisible, l'exécution du vrai chantier et le réseau mixte.

Frontière restante : le Core autorise aussi le remplacement direct des définitions compatibles (`replaceTags=Conduit`). ElseWhere autorise déjà la déconstruction puis la construction de la nouvelle variante, mais ne compose pas encore la transaction de remplacement direct sans coupure anticipée du réseau ni perte d'ordres. Ne pas confondre cette mécanique restante avec la reprise des conduits dissimulés existants. L'expansion automatique de la zone Home est une autre règle transversale encore non modélisée dans ce lot (la définition dissimulée ne l'étend pas).
