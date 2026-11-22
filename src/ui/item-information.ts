import {isProstheticItem273,PROSTHETIC_DEFINITIONS_273} from '../sim/prosthetic-content-273';
import {knownPile256} from './exploration-readers-256';
import {UNDISCOVERED_CELL_LABEL_256} from '../sim/exploration-visibility-256';
import {eggSpeciesForItem256} from '../sim/animal-egg-content-v256';
import { ITEM_DEFINITIONS } from '../sim/items';
import { itemDescription, itemTitle } from '../lore/lore-text';
import { isApparelItem, apparelDefinition, apparelLabel, armorPiece, apparelQualityFactor, apparelInsulation } from '../sim/apparel-rules';
import { QUALITY_LABELS, isWeaponItem, weaponMaxHitPoints,weaponMeleeQualityFactor } from '../sim/equipment-rules';
import {isMaceItem269,maceMaterial269,MACE_DEFINITIONS_269} from '../sim/mace-content-269';
import {maceTool269} from '../sim/mace-combat-269';
import {isLongswordItem270,longswordMaterial270,LONGSWORD_DEFINITIONS_270} from '../sim/longsword-content-270';
import {longswordTool270} from '../sim/longsword-combat-270';
import {isSpearItem272,spearMaterial272,SPEAR_DEFINITIONS_272} from '../sim/spear-content-272';
import {spearTool272} from '../sim/spear-combat-272';
import { commercialItemMassGrams } from '../sim/commercial-mass';
import type { MaterialPile,World } from '../sim/types';
import {deteriorationInspection} from './deterioration-inspection';
import type { ObjectInformationInput, ObjectInformationRow } from './object-information';
import { BODY_PARTS } from '../sim/body-definition';
import { mechCorpseMass } from '../sim/mechanoid-corpse';
import { mechanoidBodyModel } from '../sim/mechanoid-anatomy';
import { partMissing } from '../sim/injury-state';
import {isMinifiedTree} from '../sim/tree-transfer-state';
import {floraDefinition} from '../sim/biome-flora';
import { pileMaxHp,pileDamage } from '../sim/thing-damage-rules';
import { ROT_DAYS } from '../sim/food-preservation';

/** Only delivered properties, evaluated on explicit inspection of one item. */
export function itemInformation(pile:MaterialPile,world?:World):ObjectInformationInput {
  if(world&&!knownPile256(world,pile))return {title:UNDISCOVERED_CELL_LABEL_256,description:'',rows:[]};
  const definition=ITEM_DEFINITIONS[pile.item],rows:ObjectInformationRow[]=[];
  const add=(category:string,label:string,value:string,description:string)=>rows.push({category,label,value,description});
  if(eggSpeciesForItem256(pile.item)){
    add('Œuf','Permission',pile.eggForbidden?'Interdit':'Autorisé','Les œufs pondus par un animal sauvage restent interdits au travail de la colonie jusqu’à votre autorisation.');
    add('Œuf','Masse',`${(pile.quantity*.15).toLocaleString('fr-FR')} kg`,'150 g par œuf. Le transport local conserve l’identité, la quantité et l’incubation ; le chargement en caravane attend son propriétaire biologique complet.');
    if(pile.egg){add('Œuf','Incubation',`${Math.min(100,Math.floor(pile.egg.progress*100))} %`,'L’incubation suit la température réelle de son emplacement. Si aucune place d’éclosion n’est libre, tous les œufs sont conservés.');add('Œuf','Dommages thermiques',`${Math.floor(pile.egg.temperatureDamage*100)} %`,'Sous 0 °C ou au-dessus de 50 °C, la pile peut perdre sa fécondation.');}
  }
  add('Général','Quantité',String(pile.quantity),'Quantité réellement présente dans cette pile.');
  add('Général','Limite de pile',String(definition.stackLimit),'Quantité maximale d’une pile de cet objet.');
  if(isMinifiedTree(pile)){
    add('Général','Masse','150 kg','Masse de l’arbre entier ; son portage à la main est distinct du transport de provisions en voyage.');
    add('Général','Points de vie',`${pileMaxHp(pile,235)-pileDamage(pile)} / ${pileMaxHp(pile,235)}`,'État de l’emballage, distinct de la santé de l’arbre conservé à l’intérieur.');
    add('Arbre','Espèce',floraDefinition(pile.innerResource)?.label??'Arbre',pile.plantPack.pendingExpiry?'Espèce de l’arbre original avant sa mort.':'L’arbre conserve son espèce lors de sa replantation.');
    if(pile.plantPack.pendingExpiry){
      add('Arbre','État','Mort · restes en attente','L’arbre est mort à son échéance et ne peut plus être replanté.');
      add('Arbre','Bois à déposer',String(pile.plantPack.pendingExpiry.quantity),'Tous les restes sont conservés ; leur dépôt attend de pouvoir se faire entièrement.');
    }else{
      add('Arbre','Croissance',`${Math.round((pile.innerResource.growth??1)*100)} %`,'La croissance est suspendue tant que l’arbre reste déraciné.');
      add('Arbre','Conservation','7 jours après le déracinement','Replantez l’arbre sur un sol fertile et sans toit avant sa mort.');
    }
  }
  if(pile.mechCorpse){
    add('Général','Masse restante',`${mechCorpseMass(pile).toFixed(3).replace('.',',')} kg`,'Masse de la carcasse entière, issue de la couverture naturelle des parties restantes. Les blessures seules ne retirent pas de matière.');
    add('Général','Points de vie',`${pileMaxHp(pile)-pileDamage(pile)} / ${pileMaxHp(pile)}`,'État physique de l’objet transporté, distinct du dossier mécanique figé au décès.');
    const missing=mechanoidBodyModel(pile.mechCorpse.mechKind).parts.filter(p=>partMissing(pile.mechCorpse!.health,p.id));
    add('Dossier mécanique','Parties absentes',missing.length?missing.map(p=>p.label).join(', '):'Aucune','Absences réelles conservées à la neutralisation. La carcasse ne guérit pas et ne pourrit pas.');
    add('Récupération','Usage','Concassage ou broyage','Une facture d’Artisanat consomme une carcasse entière au poste réel et produit de l’acier selon l’efficacité de l’artisan. Ce corps n’est pas un aliment ni une dépouille de boucherie.');
  }
  const mass=commercialItemMassGrams(pile.item);
  if(mass!==undefined&&!pile.mechCorpse)add('Général','Masse unitaire',`${mass/1000} kg`,'Masse utilisée par le chargement des expéditions commerciales ; elle ne limite pas le transport ordinaire sur la carte.');
  if(definition.nutrition)add('Alimentation','Nutrition',String(definition.nutrition/100),'Nutrition par unité consommée. La jauge de nourriture de 100 points représente une unité de nutrition.');
  if(isProstheticItem273(pile.item)){
    const rule=PROSTHETIC_DEFINITIONS_273[pile.item];
    add('Prothèse','Usage','Pose chirurgicale','La pièce réelle est transportée au chevet avec deux médicaments autorisés du même type. Médecine 4 ; la pose peut échouer.');
    add('Prothèse','Efficacité',`${Math.round(rule.efficiency*100)} %`,'Fonction du membre installé avant les autres effets sur les capacités du patient.');
    add('Fabrication','Recette','40 acier + 4 composants','Recherche Prothèses après Usinage ; atelier d’usinage alimenté, Artisanat 5. Sans qualité.');
  }
  // Schema 358: Core DevilstrandCloth stuff powers and factors.
  if(pile.item==='devilstrand'){
    add('Couture','Usage','Tissu','Accepté par tous les vêtements de tissu (tuques et chapeaux compris) et par le sac de couchage. Valeur 5,5 par unité.');
    add('Couture','Protection','Tranchant ×1,40 · contondant ×0,36 · chaleur ×3,00','Multipliée par le facteur d’armure de chaque vêtement.');
    add('Couture','Isolation','Froid 20 · chaud 24','Multipliée par les facteurs d’isolation de chaque vêtement.');
    add('Couture','Facteurs','Solidité ×1,3 · inflammabilité ×0,4 · beauté ×3,2','Appliqués à ce qui est fait de soie du diable.');
  }
  if(pile.item==='hops')add('Brassage','Usage','Ingrédient végétal','25 houblons donnent 5 moûts à la brasserie. Le houblon n’est pas proposé comme repas aux personnes ni comme provision de voyage.');
  if(pile.item==='wort'){
    add('Brassage','Usage','Moût à fermenter','Transport apporte physiquement le moût dans un tonneau entre 1 et 30 °C. Le moût ne se boit pas.');
    add('Brassage','Conservation','5 jours avant pourriture','Durée à 10 °C ou plus ; le froid ralentit la pourriture et la congélation la suspend.');
  }
  if(pile.item==='beer'){
    add('Alcool','Consommation','1 bière par prise','Boisson alcoolisée prise au contact. Les politiques partagées règlent les prises automatiques ; un ordre direct reste soumis aux refus physiques.');
    add('Alcool','Effets','Plaisir et alcoolémie','L’alcool peut altérer les capacités et provoquer tolérance, dépendance, sevrage et gueule de bois. Consultez Santé pour l’état réel de la personne.');
    add('Alcool','Conservation','Ne pourrit pas','La pile reste sensible aux dégâts et à la détérioration à l’extérieur.');
  }
  if(pile.item==='pemmican'){
    add('Alimentation','Conservation',`${ROT_DAYS.pemmican} jours`,'Durée avant pourriture à 10 °C ou plus. Le froid ralentit cette progression ; la congélation la suspend.');
    add('Alimentation','Usage','Réserve de camp','Aliment préparé pouvant être consommé selon le régime. Les expéditions de cette version demandent toujours des repas de survie.');
  }
  if(world){const deterioration=deteriorationInspection(world,pile);if(deterioration)rows.push(...deterioration.rows);}
  if(pile.book){
    add('Livre','Titre',pile.book.title,pile.book.description);
    add('Lecture','Usage','Loisirs et Intellectuel','Les bénéfices commencent uniquement pendant la lecture réelle. Le même roman peut être relu ; une séance ne le consomme pas.');
  }
  const quality=pile.weapon?.quality??pile.apparel?.quality??pile.book?.quality;
  if(quality)add('Général','Qualité',QUALITY_LABELS[quality],'Qualité propre à cette instance, conservée pendant les déplacements et l’équipement.');
  if(isWeaponItem(pile.item)&&pile.weapon)add('Général','Points de vie',`${pile.weapon.hitPoints} / ${weaponMaxHitPoints(pile.item)}`,'État réel de l’arme sélectionnée.');
  if(isMaceItem269(pile.item)&&pile.weapon){
    const factor=weaponMeleeQualityFactor(pile.weapon.quality),head=maceTool269(`${pile.item}-head`),handle=maceTool269(`${pile.item}-handle`);
    const number=(value:number)=>Number(value.toFixed(2)).toLocaleString('fr-FR');
    add('Arme','Matière',MACE_DEFINITIONS_269[maceMaterial269(pile.item)].label,'Matière réelle de cette masse, conservée pendant le port et le transport.');
    add('Mêlée','Tête',`${number(head.damage*factor)} dégâts contondants`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup. Une attaque peut utiliser un autre outil disponible.');
    add('Mêlée','Manche',`${number(handle.damage*factor)} dégâts de poussée`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup. Les chances de toucher et d’esquive restent distinctes.');
    add('Mêlée','Récupération de base',`${number(head.cooldownCore/60)} s`,'Délai de l’outil de cette matière, avant les facteurs personnels de mêlée ; la qualité ne réduit pas ce délai. Ce n’est pas une cadence de dégâts garantie.');
  }
  if(isSpearItem272(pile.item)&&pile.weapon){
    const factor=weaponMeleeQualityFactor(pile.weapon.quality),shaft=spearTool272(`${pile.item}-shaft-blunt`),point=spearTool272(`${pile.item}-point`);
    const number=(v:number)=>Number(v.toFixed(2)).toLocaleString('fr-FR');
    add('Arme','Matière',SPEAR_DEFINITIONS_272[spearMaterial272(pile.item)].label,'Matière réelle de cette lance, conservée pendant le port et le transport.');
    add('Mêlée','Pointe',`${number(point.damage*factor)} dégâts de perforation`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup. La lance attaque au contact.');
    add('Mêlée','Hampe · coup',`${number(shaft.damage*factor)} dégâts contondants`,'Coup de hampe distinct de la poussée ; le choix dépend des outils disponibles.');
    add('Mêlée','Hampe · poussée',`${number(shaft.damage*factor)} dégâts de poussée`,'La poussée de la hampe rencontre la protection contondante.');
    add('Mêlée','Pénétration de la pointe',`${number(point.penetration*factor*100)} %`,'Pénétration nominale propre à la pointe, modifiée par la qualité. Ce nombre n’est pas une chance garantie de traverser toute protection.');
    add('Mêlée','Récupération de base',`${number(point.cooldownCore/60)} s`,'Délai de chaque outil de cette matière, avant les facteurs personnels de mêlée ; la qualité ne réduit pas ce délai.');
  }
  if(isLongswordItem270(pile.item)&&pile.weapon){
    const factor=weaponMeleeQualityFactor(pile.weapon.quality),tip=longswordTool270(`${pile.item}-tip`),edge=longswordTool270(`${pile.item}-edge`),handle=longswordTool270(`${pile.item}-handle`);
    const number=(value:number)=>Number(value.toFixed(2)).toLocaleString('fr-FR');
    add('Arme','Matière',LONGSWORD_DEFINITIONS_270[longswordMaterial270(pile.item)].label,'Matière réelle de cette épée longue, conservée pendant le port et le transport.');
    add('Mêlée','Pointe',`${number(tip.damage*factor)} dégâts de perforation`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup. Une attaque peut utiliser un autre outil disponible.');
    add('Mêlée','Tranchant',`${number(edge.damage*factor)} dégâts de coupure`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup. Les chances de toucher et d’esquive restent distinctes.');
    add('Mêlée','Manche',`${number(handle.damage*factor)} dégâts contondants`,'Dégâts nominaux après matière et qualité, avant protections et choix du coup.');
    add('Mêlée','Récupération de base',`${number(tip.cooldownCore/60)} s (lame) · ${number(handle.cooldownCore/60)} s (manche)`,'Délais des outils de cette matière, avant les facteurs personnels de mêlée ; la qualité ne réduit pas ces délais. Ce n’est pas une cadence de dégâts garantie.');
  }
  if(pile.item==='emp-launcher'){
    add('Arme','Effet','Impulsion EMP','Interrompt temporairement les mécanoïdes et les équipements électriques sensibles. Ne blesse pas directement les personnes et ne vide pas les batteries.');
    add('Arme','Rayon de l’impulsion','1,1 case','L’impulsion se déclenche au point d’impact réel du projectile. La dispersion et les obstacles peuvent déplacer cet impact.');
    add('Arme','Adaptation mécanique','Temporaire','Après une impulsion, les mécanoïdes résistent temporairement aux suivantes ; un tir répété ne garantit pas un nouvel étourdissement.');
  }
  if(isApparelItem(pile.item)&&pile.apparel){
    const apparel=apparelDefinition(pile),armor=armorPiece(pile).ratings,insulation=apparelInsulation(pile);
    add('Général','Points de vie',`${pile.apparel.hitPoints} / ${apparel.hitPoints}`,'État réel du vêtement. Les vêtements abîmés peuvent affecter l’humeur.');
    for(const [type,label] of [['sharp','Tranchant'],['blunt','Contondant'],['heat','Chaleur']] as const)add('Protection',label,`${Math.round(armor[type]*100)} %`,`Protection de cette pièce : base ${Math.round(apparel.ratings[type]*100)} % × qualité ${apparelQualityFactor(pile.apparel.quality)} ; plafond 200 %. Ne représente pas une protection uniforme de tout le corps.`);
    add('Isolation','Froid',`${insulation.cold.toFixed(1)} °C`,'Isolation de cette pièce après facteur de qualité.');
    add('Isolation','Chaleur',`${insulation.heat.toFixed(1)} °C`,'Isolation de cette pièce après facteur de qualité.');
    add('Vêtement','Parties couvertes',apparel.coverage.parts.map(part=>BODY_PARTS[part].label).join(', '),'Parties anatomiques couvertes par cette pièce. La couverture participe au calcul de protection au contact.');
  }
  // Name and text of the installed RimWorld when loaded (Options), else Elsewhere's.
  const gameDescription=isMinifiedTree(pile)?undefined:itemDescription(pile.item);
  return {title:isMinifiedTree(pile)&&pile.plantPack.pendingExpiry?'Arbre mort · restes en attente':isApparelItem(pile.item)&&pile.apparel?apparelLabel(pile):itemTitle(pile.item,definition.label),description:gameDescription!==undefined?gameDescription:pile.item==='devilstrand'?'Tissu filé à partir des microfibres du champignon soie du diable : très solide, bon isolant, et remarquablement protecteur contre le feu.':pile.item==='hops'?'Houblon récolté destiné au brassage.':pile.item==='wort'?'Moût préparé à la brasserie ; la fermentation en tonneau produit la bière.':pile.item==='beer'?'Bière fermentée, stockable et échangeable. Sa consommation a des effets sur la santé.':isMinifiedTree(pile)&&pile.plantPack.pendingExpiry?'Arbre mort ; tous ses restes sont conservés jusqu’à leur dépôt.':definition.kind==='food'?'Aliment physique pouvant être consommé selon le régime alimentaire.':definition.kind==='apparel'?'Vêtement physique qui peut être porté, retiré et stocké.':definition.kind==='weapon'?'Arme physique qui peut être équipée, déposée et stockée.':'Objet physique de la colonie.',rows};
}
