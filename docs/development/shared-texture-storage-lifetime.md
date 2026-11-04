# Durée de vie des tables de traits communes

État Source du 4 novembre 2026, qualification graphique encore ouverte.
Les tables scalaire de traits conservent les positions de base, largeurs,
irrégularités et graines des vrais rubans Source, sans les dessiner à part.
Leur préparation appartient au modèle ; changer de texture ne la relance pas.

Three r186 ne libère pas un `StorageBufferAttribute` lu uniquement par
`StorageBufferNode.element()` lorsque le node reçoit `dispose()`.
Cet appel émet seulement l’événement du node. Le changement de `node.value`
crée un nouveau binding et ne détruit pas l’ancien buffer GPU. Les méthodes
`dispose()` des propriétaires ne constituent donc pas une preuve autonome
de libération GPU.

`PawnLayer` conserve les vraies géométries du corps et des cargos qui ont pu
être initialisées, y compris après croissance. Juste avant leur fermeture
finale, `attachFaceStrokeGpuRetirement` y inscrit les deux buffers empruntés.
Le gestionnaire géométrique r186 détruit alors les attributs sur la première
géométrie initialisée ; les suppressions suivantes sont sans effet. Rien
n’est ajouté pendant le dessin, la copie, la croissance ou la compilation435.
Cette inscription terminale n’ajoute aucun emplacement de sommet au shader.
Une géométrie factice jamais initialisée n’est pas un propriétaire valable.

Les autres `OwnedStrokeModel` et les `MutableFaceStrokeBank` dynamiques ont
explicitement une durée de vie GPU liée au renderer et à son device.
Leur fermeture invalide le propriétaire CPU et son node. Le renderer produit
est fermé ensuite par `SceneRenderCore` ; aucune libération GPU plus précoce
n’est revendiquée. Les géométries Source cachées par435 ne prouvent pas une
initialisation : ses pages compilées seraient les vrais candidats à une
future retraite publique anticipée. Aucune modification435 n’est incluse ici.

Les banques dynamiques utilisent un node stable et des blocs libres alignés.
Elles publient seulement à l’adoption d’une vraie nouvelle géométrie, réutilisent
les blocs retirés et ne réorganisent aucun modèle au changement de style.
La capacité croît par puissances de deux, avec un plafond explicite de128Mio
pour le binding courant. La somme nominale des anciennes allocations est
strictement inférieure à deux fois la capacité maximale, plus le placeholder.
Ce plafond est une comptabilité d’allocations, pas une mesure de VRAM du pilote.
