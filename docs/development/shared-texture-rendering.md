# Rendu commun et textures Pastel/Gouache

État du 4 novembre 2026 : **rendu commun fonctionnel, qualification finale ouverte**.
La base des modèles est committée en `356a1d9a`. Le présent lot raccorde les surfaces,
le jeu et la galerie. Les contrats ciblés, le typage complet et Pages passent.
Native V45 a observé le même Core pendant les changements
Pastel/Gouache/Pastel, avec contours activés, relief/usure à zéro, puis sa fermeture.
La galerie a affiché 714 assets et conservé ce nombre pendant son aller-retour.
La correction de coordonnées multibanques passe cinq contrats distincts, dont
de vrais programmes humains et ressources avec deux banques, relief nul et
positif. Le typage final passe en 59,059 s et Pages en 5,193 s ; les deux Workers
restent identiques octet par octet. Native V46 a observé la galerie corrigée,
un humain corpulent, le passage relief/usure à zéro et Gouache/Pastel/Gouache
sur 714 assets, sans erreur. La fermeture de son onglet est observée ; aucun
reçu public de libération du renderer de galerie n'est revendiqué. Ces contrôles
ne constituent pas une qualification pixel exhaustive de toutes les palettes.

V45 dessine 25 appels et 214196 triangles dans les deux textures. Le GPU Gouache
reste à +23,23 % face à la moyenne des deux Pastel courants ; leur dérive est de
+15,28 %, avec le pic adverse conservé. CPU : +0,87 % sur 836 échantillons par bras.
Le témoin Pastel antérieur V38, mesuré de nouveau à cadence comparable, donne
encore +38,41 % GPU / +40,23 % CPU pour Gouache V45. Les quatre appels ajoutés
proviennent de deux familles de matériaux de ressources qui restent à réunir.
Les refus V43, les mesures V44 à faible cadence et tous leurs reçus restent
conservés séparément. **La parité avec l'ancien Pastel n'est pas atteinte.**
Il ne s'agit ni de FPS globaux, ni d'une campagne active ou de Whole Main.

## Un seul propriétaire des modèles et du rendu

Humains, 53 animaux, plantes, herbes et buissons gardent les modèles Origami
communs ; arbres, fragments, objets et mobilier gardent les modèles Legacy
communs. Les poses, variations, attachements, blessures, croissance, indices et
règles de visibilité appartiennent au modèle. Aucune de ces identités ne dépend
du style de texture.

Les mêmes matériaux et le même moteur de rendu sont conservés au changement
Pastel/Gouache. Un uniforme choisit les données d'habillage. Les valeurs
persistées `default`/`origami` restent des alias de compatibilité des préférences ;
elles ne choisissent plus deux fabriques de modèles ou deux renderers.

`Main` attend la préparation exclusive sur son renderer existant. Les nouveaux
états confirmés continuent d'être admis pendant cette attente ; le dernier état
complet et son éventuel reset sont présentés ensuite. Une erreur prépare de
nouveau l'habillage précédent sur les mêmes propriétaires. La galerie suit la
même règle et conserve collections, sélection, caméra, agencement et modèles.

## Peinture et traits sur les surfaces opaques

Le pigment Source reste à sa résolution 512². Le papier RGB conserve le masque
de remplissage dans son alpha : les imperfections suivent les UV de la vraie
face, tandis que le pigment adapte ses proportions physiques à la surface.
La composition conserve le mélange Source en sRGB encodé. Sur les formes aux
proportions variables, ce chemin utilise deux lectures de couleur, au lieu de
réduire arbitrairement la résolution ou d'étirer un atlas canonique.

Les traits noirs et carton utilisent les positions, largeurs, irrégularités,
graines et ordre des bandes du producteur Source. Une table de modèle permet
de les intégrer à la surface opaque ; les anciennes bandes transparentes ne
sont plus dessinées séparément. Le masque et les couleurs cliniques s'appliquent
au corps avant l'encre. Seules les vraies coutures nécessaires à la face sont
ajoutées aux sommets, avec indexation des faces coplanaires compatibles.

Le relief positif possède une carte de hauteur R8 séparée. À zéro, ni carte,
ni graphe de relief, ni propriétaire/décision LOD ne sont créés. L'usure physique
positive reste un effet optionnel existant ; à zéro, ses géométries, matériaux,
cartes et caches dédiés sont retirés. Les effets absents d'un producteur Source
n'ont pas été inventés. Les anciennes préférences positives ne sont pas
silencieusement converties en zéro.

## Arbres, ressources et rochers

`TreeModels` possède les treize essences Legacy et les deux vraies variantes de
couronnes, ainsi que les placements anonymes continus. UV Pastel et adresses
préparées existent avant le premier dessin. Le cache de peinture emprunte ces
modèles ; publier une banque change seulement texture et table d'adresses.

Les arbres nommés aux proportions fixes peuvent utiliser leur peinture cuite
avec une seule lecture. Les anonymes continus utilisent la peinture de face
adaptée à leurs proportions. Une banque absente, incomplète ou refusée laisse
la vraie surface Gouache directe ; aucun arbre Gouache ne redevient Pastel pour
attendre son image. Les effets positifs utilisent également la surface commune.

Le Pastel garde sa carte neutre Source64, ses pixels, filtres et espace couleur.
Il n'est pas converti en gros atlas2048. Les ressources transportent UV de face,
UV de trait/cache et identités exactes dans huit buffers au maximum, vent inclus.
Les tables d'adresses versionnées ne sont pas repackées à chaque frame.

Les rochers continus gardent leurs triangles, pigment, socle et mises à jour
locales d'excavation. Les coutures de face et tables de traits sont indépendantes
du style. Les pages de stockage retiennent une capacité maximale réutilisable
entre tailles de cartes ; elles ne sont pas recréées à chaque aller-retour.

## Qualification et limites

Les contrats contrôlent les vrais producteurs, les identités et les programmes
WGSL à froid, avec les limites de 16 attributs, huit buffers et 16 varyings.
Les données synthétiques de peinture des tests de cycle de vie ne qualifient
ni les coups de pinceau, ni les pixels, ni les performances d'une colonie.
Les erreurs et les reprises isolées sont conservées dans le checkpoint.

Les humains et animaux partagent le Standard Source de Gouache (.88/.02) entre
styles ; les ressources partagent Lambert. La comparaison inclut aussi
un ancien Pastel figé, pour ne pas masquer un coût commun ajouté aux deux
habillages. Les différences éventuelles d'éclairage de l'encre et son attache
aux faces sous morphologie/vent demandent une observation proche dans le produit.
V45 a aussi rétabli le corps de pierre Source dans les deux textures : les
rochers recevaient involontairement une nouvelle peinture par facette. Leur
seul changement d'habillage reste le trait. Les PNG proches à World/caméra
identiques et leurs différences sont conservés, sans identité pixel revendiquée.

La durée de vie des stockages GPU et ses limites publiques r186 sont décrites
dans [le contrat de stockage](shared-texture-storage-lifetime.md). Une fermeture
CPU seule ne prouve pas une libération anticipée des buffers d'une page435.

Les prototypes de culling et de peinture lointaine V39/V40/V41 restent privés,
non promus. SIM301, vraie325, sauvegardes et autres chantiers ne sont pas repris.
Aucun push ni publication n'est demandé. Commit local après qualification.
