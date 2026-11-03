# Modèles communs, deux habillages graphiques

État du 3 novembre au soir : **modèles communs qualifiés en composants**.
L'optimisation de l'habillage Origami reste en cours, sans parité générale.

La consigne humaine sépare le choix des modèles de celui des matériaux :

| Famille | Modèle commun aux deux styles |
| --- | --- |
| Humains, animaux | Référence Origami et corrections produit existantes |
| Plantes, herbes, buissons | Modèles Origami déjà intégrés |
| Arbres | Modèles Legacy, y compris les variantes historiques des cartes |
| Mobilier, objets et fragments | Modèles Legacy |

Les placements, proportions, masques anatomiques, croissance, poses et attaches
doivent rester communs. Les matériaux pastel et gouache ainsi que les surfaces
de contours restent propres à leur style. La simulation et le schéma301 ne
changent pas. Les objets ne déclenchent pas de nouveau choix de forme par frame.

Le rig humain de référence utilise le même squelette et les mêmes équipements
dans les deux modes. La génération Legacy omet les compagnons physiques de
traits et d'usure. Les portraits extraient les vrais triangles et suivent la
même morphologie et les mêmes masques. Les animaux conservent les mêmes
53 identités et propriétaires cliniques ; leur couche Legacy garde sa peinture
de pelage. Les anciens onze constructeurs animaux conservent encore des données
CPU de lignes dans leur cache : l'absence de ruban GPU ne vaut pas zéro stockage.

Deux écarts d'arbres ont été identifiés : le repli reprenait les anciens modèles
Origami lorsque l'atlas n'était pas prêt ou que les effets étaient positifs ;
les cartes sans site utilisent des couronnes coniques Legacy, incompatibles
avec la recette précuite à couronnes icosaédriques. Le repli utilise maintenant
la vraie forme Legacy et le chemin précuit refuse cette variante incompatible.
Les recettes de cônes et cactus compatibles restent admises. Ce refus peut
encore laisser préparer un atlas inutilisé ; aucune économie n'en est déduite.

Les sept contrats ciblés, huit régressions de rendu affectées et quatorze
contrats adaptés passent, ainsi que le typage complet et Pages. Les deux
Workers sont octet-identiques aux témoins. Les preuves détaillées, échecs de
fixtures conservés et contrôles restant à faire figurent dans
`tmp/origami-baked-architecture-20261102/progress.md`.

Les mesures V36/V37 restent historiques : elles comparaient des modèles
différents entre styles. Le changement du témoin Legacy ne sera pas compté
comme un gain d'optimisation Origami. Le prototype opaque des touffes reste
privé ; il n'a pas encore reçu sa comparaison GPU/visuelle.

V38 utilise une seule vraie carte128 en pause, trois renderers successifs et
le vrai contexte Main435. Sur les trois essais Legacy/Origami/Legacy :

| Mesure | Legacy initial | Origami | Legacy retour |
| --- | ---: | ---: | ---: |
| GPU de la frame Core | 0,699051ms | 1,283413ms | 0,693589ms |
| CPU de soumission | 1,163917ms | 1,589259ms | 1,062719ms |
| Appels de dessin | 21 | 42 | 21 |
| Triangles soumis | 214196 | 1177740 | 214196 |

Origami reste à **+84,31%GPU et +42,75%CPU** face aux moyennes Legacy. Les
dérives Legacy de−0,78%GPU et−8,69%CPU restent visibles. Il ne s'agit ni de FPS
ni d'une campagne active. Le delta963544triangles correspond arithmétiquement
aux rubans recensés en V37, sans attribution des temps GPU à chaque famille.

Les retours PNG joueur sont exacts dans chaque style. Quatre gros plans
arbre/colon montrent les mêmes formes et placements dans ces vues, avec leurs
habillages distincts. Aucun feuillage manquant ou surélevé n'a été observé dans
ces vues ; cela n'est pas une qualification exhaustive des13essences ou une
partie ancienne réellement jouée. Les473arbres et13animaux du candidat sont
prêts sans repli. Les trois renderers et le client sont fermés sans erreur.
Le [rapport V38](../../tmp/origami-baked-architecture-20261102/core-common-model-runtime-current/native-v38-common-model-summary.json)
porte le SHA256`5e4aa64683e9630098b8d117b5d3fdb7c12c8ecbcaeb63e41512a812f7c34773`.

L'utilisateur conserve les contours activés : la suite porte sur leur coût
avec le rendu souhaité. Le diagnostic privé contours0 a été arrêté sans
construction ni exécution. Les traits déjà cuits des arbres/animaux ne créent
pas de surface supplémentaire à afficher ; les autres familles restent à
traiter. Leur préparation et stockage ne sont pas assimilés au coût par frame.
