# Rafraîchissement immédiat des zones — 27 novembre 2026

Retour de Saf : tracer ou effacer le foyer ne recolore parfois pas la carte tant que l'outil n'a pas été désélectionné puis resélectionné. Corriger le mécanisme général, pas un rafraîchissement forcé spécifique au bouton. Schéma 380 inchangé, aucune règle de simulation modifiée.

## Cause et reproduction

Le lecteur fermé des intentions MAIN (`closed-main-map-intents.ts`) comparait ses groupes de primitives dans un seul flux à offsets variables. Une modification du nombre d'objets dans un groupe amont pouvait rendre exactement égale une sous-séquence du flux précédent à la nouvelle valeur d'un autre groupe, et donc oublier sa mise à jour. Reproduction avec le vrai `SnapshotEncoder` et `PresentationSnapshotDecoder`, même tick :

- Ancien foyer `[0,1,2,3,42,43,44]`, stockage vide ; puis une cellule de stockage ajoutée (quatre primitives) et foyer réduit à `[42,43,44]`.
- Le lecteur de `HEAD ae403266` (copie privée du source, sans modifier Git) conserve l'ancien foyer entier : les mots `[3,42,43,44]` du nouveau foyer coïncident exactement avec la fin du précédent au nouvel offset.
- Le lecteur corrigé restitue la référence du vrai nouveau foyer `[42,43,44]` et conserve celles des jobs inchangés. Rapport reproductible `tmp/zone-reader-repro-20261127.log` ; test permanent `confirmed-zone-refresh.test.ts`.

Un tracé simple dans Les Éclaircies (pause et ×3) ne manifestait pas le défaut sur le build précédent : les texels CPU et les captures de la case recolorée étaient corrects sans resélection. Le défaut combiné a en revanche été reproduit exactement. Ne pas prétendre avoir reproduit la sauvegarde précise de Saf, non fournie. L'audit a trouvé deux autres chemins susceptibles de prendre du retard : les plans restaient dépendants du World joué, et les contours des zones sélectionnées pouvaient être calculés sur ce même World antérieur.

## Correction commune

- Comparaison exacte relative à chaque groupe avec deux petits tableaux de plages réutilisés ; le flux primitive reste plat. Les slots de comptage réservés suivent aussi ces limites. Une lecture historique non admise ne peut plus faire hériter une projection ancienne d'un nouveau témoin. Le contrat JSON historique du `PresentationQueue` reste identique.
- Les plans 369 rejoignent les intentions confirmées. Leur couleur, visibilité et cellules sont admises indépendamment ; le World joué ne réécrit plus un plan ancien par-dessus la commande reçue. Le secours RAW utilise une signature exacte plutôt qu'un hash seul.
- `presentConfirmedIntents` est le propriétaire commun des remplissages confirmés foyer, neige, stockage, cultures, zones autorisées, toitures et plans. Première admission / changement de carte reconstruit les lots nécessaires ; les changements de terrain réellement joués conservent leurs hauteurs et le brouillard. Le prochain dessin lit les intentions reçues, sans attendre le playhead physique. Une sélection de zone suit les cellules confirmées, pas le World joué ; les limites des cultures, réserves et plans se recalculent à leur changement, y compris si une zone est agrandie, réduite ou supprimée.
- Le foyer et le déneigement ne reconstruisent plus le lot des réserves. Le sous-lot de remplissage concerné est mis à jour seulement s'il est affiché ou à un changement de support. Les deux sens d'un même outil gardent sa couleur ; les changements de visibilité habituels sont préservés. Aucun nouvel appel de dessin, aucun scan des zones par image stable. Les contrats contrôlent les versions GPU et la persistance des lots inchangés.

## Qualification

67 cas distincts dans douze fichiers ciblés après la reprise des deux assertions (arrondis Float32 des surfaces de toiture ; assertion historique du cinquième argument de `updateConfirmedPath`, déjà recensée). Les nouveaux contrats reproduisent le conflit de groupes sur le vrai transport, vérifient chaque groupe, le foyer et la neige outil maintenu, les autres producteurs réels, la persistance des captures inchangées, les contours et la suppression. `npm run build:pages` (incluant le typage) réussi ; Vite 8,02 s. Contrôles natifs complémentaires ci-dessous.

### Vrai Chrome WebGPU : premier dessin confirmé

Les Éclaircies, Pastel, véritable interface native : bouton Zones, sélection de l'outil et rectangle à la souris. **16/16 confirmations correctes au premier appel de rendu qui observe la nouvelle commande**, sans resélection, aucun message d'erreur : foyer ajout/retrait en pause et à ×3 ; neige, réserve, culture, toiture, plan et zone autorisée en pause. Pour la zone autorisée, le test sélectionne sa cible de rendu et joue les vrais ordres de peinture, sans injection de World. Lors du retrait du foyer à ×3, le World reçu est au tick 1796 mais le World joué est encore au tick 1794 ; le lot et le texel utilisent déjà le retrait. Les toitures ont leur propre atlas de surfaces ; les autres alpha attendus sont 0,28 (foyer/neige), 0,20 (réserve/culture/autorisation), 0,40 (plan), et zéro après retrait.

Contrôle des pixels réels en pause : sur le carré de 32 × 32 pixels au centre de la case ajoutée, 892 pixels changent lors du tracé ; zéro pixel de différence entre le dessin immédiatement après la commande et après resélection. Le retrait restaure exactement les 1 024 pixels initiaux, et la resélection suivante ne change rien. Rapport `tmp/perf-20261125-next/zone-gesture-after.json` et captures portant le même préfixe. Les ordres de vérification ne sont joués que dans une instance de test chargée depuis une fixture publique.

Les Forges, Gouache aux réglages habituels, même protocole avec la grande zone de foyer de **10 774 cases** : 4/4 au premier dessin, en pause et à ×6 (tics confirmés 388 pour l'ajout et 478 pour le retrait). Le rectangle ajoute quatre cases, puis les retire, sans changement d'outil en cours de chaque confirmation. Sur les 1 024 pixels de contrôle de la case en pause, l'ajout change 883 pixels ; après désélection/resélection, aucun pixel ne change ; le retrait restaure exactement la capture initiale. `tmp/perf-20261125-next/zone-gesture-forges-gouache.json`, aucune erreur navigateur. **Total : 20/20 confirmations au premier rendu, 0 erreur, sans coût de nouveau lot ni scan par image stable.** Aucun gain global de FPS revendiqué.
