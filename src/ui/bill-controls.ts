import {isSchema289OrLater} from '../sim/schema-compatibility-257.ts';
import {isProstheticRecipe273} from '../sim/prosthetic-content-273';
import {isSchema278OrLater,isSchema283OrLater} from '../sim/schema-compatibility-257';
import {billWorkerControls283,type BillWorkerOptionsReader283} from './bill-worker-controls-283';
import {billPauseControls289} from './bill-pause-controls-289';
import {supportsBillReservePause289} from '../sim/bill-pause-rules-289';
import {isSmithingRecipe267} from '../sim/smithing-content-267';
import { productionResearchUnlocked } from '../sim/machining';
import { isArtRecipe, type ArtRecipe } from '../sim/art-rules';
import { isGunRecipe,RECON_ARMOR_REQUIREMENTS,ADVANCED_COMPONENT_REQUIREMENTS,FLAK_HELMET_REQUIREMENTS,RECON_HELMET_REQUIREMENTS,FLAK_REQUIREMENTS,GUN_REQUIREMENTS,type ProductionRecipe } from '../sim/production-recipes';
import { ITEM_DEFINITIONS } from '../sim/items';
import { PRODUCTION_RECIPES, stationRecipes } from '../sim/production-recipes';
import { countedProducts } from '../sim/cooking-bills';
import {isApparelCountRecipe278,newApparelCountFilter278,validApparelCountFilter278} from '../sim/apparel-count-278';
import { queryCookingBillStatus } from '../sim/cooking-diagnostics';
import type { ApparelCountFilter278,BillSettings,CookingBill } from '../sim/cooking-types';
import type { Command, Structure, World } from '../sim/types';
import {isCremationRecipe} from '../sim/cremation-content';
import {isSmeltingRecipe} from '../sim/smelting-rules';
import {isBurnApparelRecipe} from '../sim/burn-apparel-content';
import {WEAPON_QUALITIES} from '../sim/equipment-rules';
import type {WeaponQuality} from '../sim/equipment-rules';

export const prostheticRecipeDescription273='40 acier + 4 composants → 1 prothèse · Artisanat 5 · recherche Prothèses après Usinage · atelier d’usinage alimenté · 15 000 ticks Core nominaux · ouvrage et auteur conservés · sans qualité';
export const brewingRecipeDescription='25 houblons → 5 moûts · travail Cuisine à la brasserie · 1 000 ticks Core nominaux · recherche Brassage de bière · Transport charge ensuite le moût dans un tonneau';
export const pemmicanRecipeDescription='5 viandes animales + 5 végétaux → 16 pemmicans · lait exclu · Recherche Pemmican · feu de camp ou cuisinière';
export const burnApparelDescription='Détruit un vêtement entier autorisé au sol · filtres PV et qualité · Transport sans expérience · aucune matière ni combustible récupéré · armures métalliques exclues';
const cremationDescription='Détruit une dépouille et ses possessions encore attachées · aucune sortie · Transport sans expérience · dépouille déjà matérialisée au sol, hors tombe';
export const plasteelKnifeRecipeDescription='30 plastacier → 1 couteau en plastacier · Artisanat sans niveau minimum · aucune recherche de recette · emplacement d’artisanat : efficacité de base 50 % · auteur et progression conservés';
export const spearRecipeDescription272='75 unités d’une même matière (750 pour argent ou or) → 1 lance · Artisanat 4 · recherche Lames longues · forge à combustible ou électrique · bois, argent et or désactivés au départ · auteur et progression conservés';
export const longswordRecipeDescription270='100 unités d’une même matière (1 000 pour argent ou or) → 1 épée longue · Artisanat 5 · recherche Lames longues · forge à combustible ou électrique · bois, argent et or désactivés au départ · auteur et progression conservés';
export const maceRecipeDescription269='50 unités d’une même matière (500 pour argent ou or) → 1 masse · Artisanat 3 · recherche Forge · forge à combustible ou électrique · bois, argent et or désactivés au départ · auteur et progression conservés';
const smithingRecipeDescription=(recipe:ProductionRecipe)=>recipe==='make-spear'?spearRecipeDescription272:recipe==='make-longsword'?longswordRecipeDescription270:recipe==='make-mace'?maceRecipeDescription269:recipe==='make-plasteel-knife'?plasteelKnifeRecipeDescription:recipe==='make-short-bow'?'30 bois · Artisanat 2 · sans recherche · poste d’artisanat ou forge · auteur et progression conservés':recipe==='make-recurve-bow'?'40 bois · Artisanat 5 · recherche Arc recourbé · poste d’artisanat ou forge · auteur et progression conservés':recipe==='make-greatbow'?'60 bois · Artisanat 6 · recherche Grand arc · poste d’artisanat ou forge · auteur et progression conservés':recipe==='make-plate-armor'?'170 unités d’une même matière (1 700 pour or/argent) · Artisanat 7 · recherche Armure de plaques · auteur et progression conservés':'40 unités d’un même métal (400 pour or/argent) · Artisanat · recherche Forge · auteur et progression conservés';
const smeltingApparelDescription='Détruit une armure métallique entière autorisée au sol · 25 % de sa matière, avec arrondi · filtres PV et qualité · Artisanat sans expérience · plaques en bois exclues';
const smeltingDescription='Détruit l’arme · récupère 25 % des métaux, aucun composant · revolver : 7–8 acier ; fusil : 15 acier ; EMP : 18–19 acier ; couteau : 7–8 plastacier ; masse : 12–13 unités de métal, ou 125 argent/or · masses en bois exclues · Artisanat sans expérience';
const slagDescription256='1 vraie scorie d’acier → 15 acier · 400 ticks Core de travail · aucune expérience · entrée transportée au four';
const qualityLabel:Readonly<Record<WeaponQuality,string>>={awful:'Déplorable',poor:'Médiocre',normal:'Normale',good:'Bonne',excellent:'Excellente',masterwork:'Chef-d’œuvre',legendary:'Légendaire'};
const apparelDrafts278=new WeakMap<HTMLElement,{sync:(bill:CookingBill,available:boolean)=>void}>();
const workerDrafts283=new WeakMap<HTMLElement,ReturnType<typeof billWorkerControls283>>();
const pauseDrafts289=new WeakMap<HTMLElement,ReturnType<typeof billPauseControls289>>();
export const apparelReserveDescription278='La qualité choisie filtre la réserve ; elle ne garantit pas la prochaine fabrication. Toutes les matières du produit sont comptées, indépendamment des ingrédients autorisés.';

const mechRecipe=(recipe:ProductionRecipe)=>recipe==='smash-mechanoid'||recipe==='shred-mechanoid';
const mechRecipeDescription=(recipe:ProductionRecipe)=>recipe==='smash-mechanoid'?'1 carcasse mécanique entière · Artisanat · 15 acier de base selon efficacité · emplacement d’artisanat à 50 % de vitesse':'1 carcasse mécanique entière · Artisanat · 15 acier de base selon efficacité · atelier d’usinage alimenté';

const artMaterialCount=(recipe:ArtRecipe):number=>recipe==='small-sculpture'?50:100;
const biofuelRecipe=(recipe:ProductionRecipe)=>recipe==='chemfuel-from-wood'||recipe==='chemfuel-from-organics';
const biofuelRecipeDescription=(recipe:ProductionRecipe)=>recipe==='chemfuel-from-wood'
  ?'70 bois → 35 biocarburants · 200 ticks à vitesse normale · travail Artisanat · raffinerie alimentée'
  :'3,5 nutrition (70 unités crues) → 35 biocarburants · mélange accepté · 250 ticks à vitesse normale · filtre végétal initial, viandes et lait au choix · travail Artisanat · raffinerie alimentée';

export function billControls(station:Structure,send:(command:Command)=>void,readWorkerOptions?:BillWorkerOptionsReader283):HTMLElement {
  const root=document.createElement('section');root.className='bill-controls';
  const title=document.createElement('h3');title.textContent='Factures';root.append(title);
  for(const [index,recipe] of stationRecipes(station).entries()){const add=document.createElement('button');add.dataset.addRecipe=recipe;add.id=index===0?'add-cooking-bill':`add-bill-${recipe}`;add.textContent=`Ajouter : ${PRODUCTION_RECIPES[recipe].label.toLowerCase()}`;if(isProstheticRecipe273(recipe))add.title=prostheticRecipeDescription273;if(isSmithingRecipe267(recipe))add.title=smithingRecipeDescription(recipe);if(isCremationRecipe(recipe))add.title=cremationDescription;if(isBurnApparelRecipe(recipe))add.title=burnApparelDescription;if(isSmeltingRecipe(recipe))add.title=recipe==='smelt-slag'?slagDescription256:smeltingDescription;if(biofuelRecipe(recipe))add.title=biofuelRecipeDescription(recipe);if(isArtRecipe(recipe))add.title=`Art · ${artMaterialCount(recipe)} unités d’un seul matériau · Artistique détermine la qualité`;if(recipe==='brew-wort')add.title=brewingRecipeDescription;if(recipe==='make-pemmican')add.title=pemmicanRecipeDescription;if(recipe==='cook-simple-meal-bulk')add.title='40 ingrédients crus · 4 repas simples · Cuisine';if(recipe==='cook-fine-meal-bulk')add.title='20 protéines (viande ou lait) + 20 végétaux · 4 plats raffinés · Cuisine 6';if(recipe==='cook-vegetarian-fine-meal-bulk')add.title='60 végétaux crus ou lait · 4 plats raffinés végétariens · Cuisine 6';if(recipe==='cook-carnivore-fine-meal-bulk')add.title='60 viandes crues · 4 plats raffinés carnivores · Cuisine 6';if(recipe==='cook-lavish-meal-bulk')add.title='40 protéines (viande ou lait) + 40 végétaux · 4 plats gastronomiques · Cuisine 8';if(recipe==='cook-vegetarian-lavish-meal-bulk')add.title='100 végétaux crus ou lait · 4 plats gastronomiques végétariens · Cuisine 8';if(recipe==='cook-carnivore-lavish-meal-bulk')add.title='100 viandes crues · 4 plats gastronomiques carnivores · Cuisine 8';add.onclick=()=>send({type:'bill-add',structureId:station.id,recipe});root.append(add);}
  for(const bill of station.bills??[]) {
    const form=document.createElement('div');form.className='bill';form.dataset.bill=String(bill.id);
    const status=document.createElement('p');status.dataset.billStatus=String(bill.id);form.append(status);
    const reason=document.createElement('p');reason.dataset.billReason=String(bill.id);reason.className='muted';form.append(reason);
    if(mechRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=mechRecipeDescription(bill.recipe);form.append(cost);}
    if(isProstheticRecipe273(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=prostheticRecipeDescription273;form.append(cost);}
    if(isGunRecipe(bill.recipe)){const cost=document.createElement('p'),r=GUN_REQUIREMENTS[bill.recipe];cost.className='bill-cost';cost.textContent=`${r.steel} acier · ${r.component} composants · Artisanat ${r.skill}`;form.append(cost);}
    if(bill.recipe==='make-flak-vest'){const cost=document.createElement('p'),r=FLAK_REQUIREMENTS;cost.className='bill-cost';cost.textContent=`${r.cloth} tissu · ${r.steel} acier · ${r.component} composant · Artisanat ${r.skill}`;form.append(cost);}
    if(bill.recipe==='make-flak-helmet'){const cost=document.createElement('p'),r=FLAK_HELMET_REQUIREMENTS;cost.className='bill-cost';cost.textContent=`${r.steel} acier · ${r.component} composants · ${r.plasteel} plastacier · Artisanat ${r.skill}`;form.append(cost);}
    if(bill.recipe==='make-recon-armor'){const cost=document.createElement('p'),r=RECON_ARMOR_REQUIREMENTS;cost.className='bill-cost';cost.textContent=`${r.plasteel} plastacier · ${r['advanced-component']} composants avancés · ${r.uranium} uranium · Artisanat ${r.skill}`;form.append(cost);}
    if(bill.recipe==='make-recon-helmet'){const cost=document.createElement('p'),r=RECON_HELMET_REQUIREMENTS;cost.className='bill-cost';cost.textContent=`${r.plasteel} plastacier · ${r['advanced-component']} composant avancé · Artisanat ${r.skill}`;form.append(cost);}
    if(isSmithingRecipe267(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=smithingRecipeDescription(bill.recipe);form.append(cost);}
    if(bill.recipe==='brew-wort'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=brewingRecipeDescription;form.append(cost);}
    if(bill.recipe==='make-medicine'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='1 plante médicinale + 1 neutroamine + 3 tissus → 1 médicament industriel · Artisanat 4 et Intellectuel 4 · Travail Artisanat · Recherche Production de médicaments';form.append(cost);}
    if(biofuelRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=biofuelRecipeDescription(bill.recipe);form.append(cost);}
    if(isCremationRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=cremationDescription;form.append(cost);}
    if(isBurnApparelRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=burnApparelDescription;form.append(cost);}
    if(isSmeltingRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=bill.recipe==='smelt-slag'?slagDescription256:bill.recipe==='smelt-apparel'?smeltingApparelDescription:smeltingDescription;form.append(cost);}
    if(bill.recipe==='make-component'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='12 acier · Artisanat 8';form.append(cost);}
    if(bill.recipe==='cook-simple-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='40 ingrédients crus → 4 repas simples · Cuisine';form.append(cost);}
    if(bill.recipe==='cook-fine-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='20 protéines (viande ou lait) + 20 végétaux → 4 plats raffinés · Cuisine 6';form.append(cost);}
    if(bill.recipe==='cook-vegetarian-fine-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='60 végétaux crus ou lait → 4 plats raffinés végétariens · Cuisine 6';form.append(cost);}
    if(bill.recipe==='cook-carnivore-fine-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='60 viandes crues → 4 plats raffinés carnivores · Cuisine 6';form.append(cost);}
    if(bill.recipe==='cook-lavish-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='40 protéines (viande ou lait) + 40 végétaux → 4 plats gastronomiques · Cuisine 8';form.append(cost);}
    if(bill.recipe==='cook-vegetarian-lavish-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='100 végétaux crus ou lait → 4 plats gastronomiques végétariens · Cuisine 8';form.append(cost);}
    if(bill.recipe==='cook-carnivore-lavish-meal-bulk'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='100 viandes crues → 4 plats gastronomiques carnivores · Cuisine 8';form.append(cost);}
    if(bill.recipe==='make-pemmican'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=pemmicanRecipeDescription;form.append(cost);}
    if(bill.recipe==='cook-survival-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='6 protéines (viande ou lait) + 6 végétaux → 1 repas de survie · Cuisine 8 · Recherche Repas de survie';form.append(cost);}
    if(bill.recipe==='fine-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='5 protéines (viande ou lait) + 5 végétaux · Cuisine 6';form.append(cost);}
    if(bill.recipe==='vegetarian-fine-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='15 végétaux ou lait · Cuisine 6';form.append(cost);}
    if(bill.recipe==='carnivore-fine-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='15 viandes crues · Cuisine 6';form.append(cost);}
    if(bill.recipe==='lavish-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='10 protéines (viande ou lait) + 10 végétaux · Cuisine 8';form.append(cost);}
    if(bill.recipe==='vegetarian-lavish-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='25 végétaux ou lait · Cuisine 8';form.append(cost);}
    if(bill.recipe==='cook-carnivore-lavish-meal'){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent='25 viandes crues · Cuisine 8';form.append(cost);}
    if(bill.recipe==='make-advanced-component'){const cost=document.createElement('p'),r=ADVANCED_COMPONENT_REQUIREMENTS;cost.className='bill-cost';cost.textContent=`${r.component} composant · ${r.steel} acier · ${r.plasteel} plastacier · ${r.gold} or · Artisanat ${r.skill}`;form.append(cost);}
    if(isArtRecipe(bill.recipe)){const cost=document.createElement('p');cost.className='bill-cost';cost.textContent=`${artMaterialCount(bill.recipe)} unités d’un seul matériau · travail Art · qualité selon Artistique`;form.append(cost);}
    const fields=new Map<string,HTMLInputElement|HTMLSelectElement>();
    const input=(key:string,label:string,type:string,value:string|boolean)=>{
      const row=document.createElement('label'),field=document.createElement('input');field.type=type;field.dataset.field=key;
      if(typeof value==='boolean')field.checked=value;else field.value=value;
      if(type==='number'){field.min='0';field.max=key==='radius'?'999':'9999';field.step='1';}
      row.append(label,field);fields.set(key,field);return row;
    };
    const select=(key:string,label:string,choices:readonly [string,string][],value:string)=>{
      const row=document.createElement('label'),field=document.createElement('select');field.dataset.field=key;
      for(const [v,text] of choices){const o=document.createElement('option');o.value=v;o.textContent=text;field.append(o);}field.value=value;
      row.append(label,field);fields.set(key,field);return row;
    };
    form.append(select('mode','Répéter',(bill.recipe==='smelt-weapon'||bill.recipe==='smelt-apparel')||isCremationRecipe(bill.recipe)||isBurnApparelRecipe(bill.recipe)?[['times','Faire X fois'],['forever','Sans limite']]:[['times','Faire X fois'],['until','Jusqu’à X en réserve'],['forever','Sans limite']],bill.mode),input('target',isBurnApparelRecipe(bill.recipe)?'X : vêtements à brûler':isCremationRecipe(bill.recipe)?'X : dépouilles à incinérer':bill.recipe==='smelt-slag'?'X : scories / acier en réserve':isSmeltingRecipe(bill.recipe)?bill.recipe==='smelt-apparel'?'X : armures à fondre':'X : armes à fondre':biofuelRecipe(bill.recipe)?'X : raffinages / biocarburant en réserve':mechRecipe(bill.recipe)?'X : carcasses / acier en réserve':bill.recipe==='butcher-creature'?'X : dépouilles / viande en réserve':bill.recipe==='stone-blocks'?'X : opérations / blocs en réserve':bill.recipe==='cook-simple-meal-bulk'||bill.recipe==='cook-fine-meal-bulk'||bill.recipe==='cook-vegetarian-fine-meal-bulk'||bill.recipe==='cook-carnivore-fine-meal-bulk'||bill.recipe==='cook-lavish-meal-bulk'||bill.recipe==='cook-vegetarian-lavish-meal-bulk'||bill.recipe==='cook-carnivore-lavish-meal-bulk'?'X : cuissons / repas en réserve':'Quantité','number',String(bill.target)),input('suspended','Suspendre','checkbox',bill.suspended));
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=isBurnApparelRecipe(bill.recipe)?'Vêtements autorisés':isCremationRecipe(bill.recipe)?'Dépouilles autorisées':'Ingrédients et livraison';details.append(summary);
    if((bill.recipe==='smelt-weapon'||bill.recipe==='smelt-apparel')||isBurnApparelRecipe(bill.recipe)){
      const filter=bill.smeltFilter!;
      const hpMin=input('hpMin','État minimum (%)','number',String(filter.hpMin)),hpMax=input('hpMax','État maximum (%)','number',String(filter.hpMax));
      for(const row of [hpMin,hpMax])row.querySelector('input')!.max='100';
      const qualities=WEAPON_QUALITIES.map(q=>[q,qualityLabel[q]] as [string,string]);
      details.append(hpMin,hpMax,select('qualityMin','Qualité minimum',qualities,filter.qualityMin),select('qualityMax','Qualité maximum',qualities,filter.qualityMax));
    }
    if(isCremationRecipe(bill.recipe)){const filter=bill.cremationFilter!;for(const [key,label] of [['colonists','Colons'],['strangers','Étrangers'],['fresh','Corps frais'],['rotting','Corps pourris'],['desiccated','Corps desséchés']] as const)details.append(input(key,label,'checkbox',filter[key]));}
    details.append(...PRODUCTION_RECIPES[bill.recipe].inputs.map(i=>input(i,ITEM_DEFINITIONS[i].label,'checkbox',bill.filters[i]??false)),input('radius','Rayon depuis le poste','number',String(bill.radius)),...(isCremationRecipe(bill.recipe)||isBurnApparelRecipe(bill.recipe))?[]:[select('destination','Produit',[['stockpile','Meilleur stockage'],['drop','Déposer au sol']],bill.destination)]);form.append(details);
    const apply=document.createElement('button');apply.dataset.applyBill=String(bill.id);apply.textContent='Appliquer la facture';
    const field=(name:string)=>fields.get(name)!;
    let readReserve:(()=>ApparelCountFilter278|undefined)|undefined,refreshReserve:(()=>void)|undefined,reserveValid=()=>true,cancelReserve:HTMLButtonElement|undefined;
    if(isApparelCountRecipe278(bill.recipe)){
      let confirmed=bill,active=!!bill.apparelCount,available=!!bill.apparelCount;
      const reserve=document.createElement('details'),heading=document.createElement('summary');reserve.dataset.apparelReserve=String(bill.id);reserve.hidden=!available;heading.textContent='Réserve de vêtements';reserve.append(heading);
      const enable=document.createElement('button');enable.type='button';enable.dataset.enableApparelReserve=String(bill.id);enable.textContent='Filtrer la réserve';reserve.append(enable);
      const group=document.createElement('div');group.dataset.apparelReserveFields=String(bill.id);
      const filter=bill.apparelCount??newApparelCountFilter278(),qualities=WEAPON_QUALITIES.map(q=>[q,qualityLabel[q]] as [string,string]);
      group.append(input('reserveHpMin','État minimum (%)','number',String(filter.hpMin)),input('reserveHpMax','État maximum (%)','number',String(filter.hpMax)),select('reserveQualityMin','Qualité minimum',qualities,filter.qualityMin),select('reserveQualityMax','Qualité maximum',qualities,filter.qualityMax),input('reserveIncludeEquipped','Inclure les vêtements portés, équipés et en inventaire personnel','checkbox',filter.includeEquipped));
      (field('reserveHpMin') as HTMLInputElement).max='100';(field('reserveHpMax') as HTMLInputElement).max='100';
      const help=document.createElement('p');help.className='muted';help.textContent=apparelReserveDescription278;
      const scope=document.createElement('p');scope.className='muted';scope.textContent='Compte les vêtements visibles sur cette carte et le cargo des porteurs de la colonie. L’option ajoute la tenue et l’inventaire personnel des colons libres présents. Compter une pièce ne garantit pas son accès pour s’habiller.';
      group.append(help,scope);reserve.append(group);
      const error=document.createElement('p');error.dataset.apparelReserveError=String(bill.id);error.setAttribute('role','status');reserve.append(error);
      const draft=document.createElement('p');draft.dataset.billDraft=String(bill.id);draft.className='muted';draft.textContent='Modifications non appliquées.';reserve.append(draft);
      cancelReserve=document.createElement('button');cancelReserve.type='button';cancelReserve.dataset.cancelBillDraft=String(bill.id);cancelReserve.textContent='Annuler les modifications';
      const value=():ApparelCountFilter278=>({hpMin:Number(field('reserveHpMin').value),hpMax:Number(field('reserveHpMax').value),qualityMin:field('reserveQualityMin').value as WeaponQuality,qualityMax:field('reserveQualityMax').value as WeaponQuality,includeEquipped:(field('reserveIncludeEquipped') as HTMLInputElement).checked});
      const valid=()=>field('reserveHpMin').value.trim()!==''&&field('reserveHpMax').value.trim()!==''&&validApparelCountFilter278(value());
      refreshReserve=()=>{
        reserve.hidden=!available;enable.hidden=active;enable.disabled=!available;group.hidden=!active;
        const invalid=available&&active&&!valid();apply.disabled=invalid;error.hidden=!invalid;error.textContent=invalid?'Choisissez des pourcentages entiers de 0 à 100 et des bornes minimum inférieures ou égales aux bornes maximum, pour l’état comme pour la qualité.':'';
        draft.hidden=!form.dataset.dirty;cancelReserve!.disabled=!form.dataset.dirty;
      };
      readReserve=()=>available&&active?value():undefined;
      reserveValid=()=>!available||!active||valid();
      const restore=(next:CookingBill)=>{
        field('mode').value=next.mode;field('target').value=String(next.target);(field('suspended') as HTMLInputElement).checked=next.suspended;field('radius').value=String(next.radius);field('destination').value=next.destination;
        for(const item of PRODUCTION_RECIPES[next.recipe].inputs)(field(item) as HTMLInputElement).checked=next.filters[item]??false;
        active=!!next.apparelCount;const f=next.apparelCount??newApparelCountFilter278();field('reserveHpMin').value=String(f.hpMin);field('reserveHpMax').value=String(f.hpMax);field('reserveQualityMin').value=f.qualityMin;field('reserveQualityMax').value=f.qualityMax;(field('reserveIncludeEquipped') as HTMLInputElement).checked=f.includeEquipped;
      };
      const matches=(next:CookingBill)=>{
        if(field('mode').value!==next.mode||field('target').value.trim()===''||Number(field('target').value)!==next.target||(field('suspended') as HTMLInputElement).checked!==next.suspended||field('radius').value.trim()===''||Number(field('radius').value)!==next.radius||field('destination').value!==next.destination||active!==!!next.apparelCount)return false;
        if(PRODUCTION_RECIPES[next.recipe].inputs.some(item=>(field(item) as HTMLInputElement).checked!==(next.filters[item]??false)))return false;
        if(!active)return true;
        if(!valid()||!next.apparelCount)return false;
        const f=value(),n=next.apparelCount;return f.hpMin===n.hpMin&&f.hpMax===n.hpMax&&f.qualityMin===n.qualityMin&&f.qualityMax===n.qualityMax&&f.includeEquipped===n.includeEquipped;
      };
      enable.onclick=()=>{if(!available)return;active=true;form.dataset.dirty='true';refreshReserve!();};
      cancelReserve.onclick=()=>{delete form.dataset.dirty;restore(confirmed);refreshReserve!();};
      apparelDrafts278.set(form,{sync(next,enabled){confirmed=next;available=enabled;if(form.dataset.dirty&&matches(next))delete form.dataset.dirty;if(!form.dataset.dirty)restore(next);refreshReserve!();}});
      form.append(reserve);refreshReserve();
    }
    if(readWorkerOptions){const workers=billWorkerControls283(station.id,bill,send,readWorkerOptions);workerDrafts283.set(form,workers);form.append(workers.element);}
    if(supportsBillReservePause289(bill.recipe)){const pause=billPauseControls289(station.id,bill,send);pauseDrafts289.set(form,pause);form.append(pause.element);}
    form.addEventListener('input',()=>{form.dataset.dirty='true';refreshReserve?.();});
    form.addEventListener('change',()=>{form.dataset.dirty='true';refreshReserve?.();});
    apply.onclick=()=>{
      if(!reserveValid()){refreshReserve?.();return;}
      const settings:BillSettings={mode:field('mode').value as BillSettings['mode'],target:Number(field('target').value),suspended:(field('suspended') as HTMLInputElement).checked,filters:Object.fromEntries(PRODUCTION_RECIPES[bill.recipe].inputs.map(i=>[i,(field(i) as HTMLInputElement).checked])),radius:Number(field('radius').value),destination:isCremationRecipe(bill.recipe)||isBurnApparelRecipe(bill.recipe)?'drop':field('destination').value as BillSettings['destination']};
      if(isCremationRecipe(bill.recipe))settings.cremationFilter={colonists:(field('colonists') as HTMLInputElement).checked,strangers:(field('strangers') as HTMLInputElement).checked,fresh:(field('fresh') as HTMLInputElement).checked,rotting:(field('rotting') as HTMLInputElement).checked,desiccated:(field('desiccated') as HTMLInputElement).checked};
      if((bill.recipe==='smelt-weapon'||bill.recipe==='smelt-apparel')||isBurnApparelRecipe(bill.recipe))settings.smeltFilter={hpMin:Number(field('hpMin').value),hpMax:Number(field('hpMax').value),qualityMin:field('qualityMin').value as WeaponQuality,qualityMax:field('qualityMax').value as WeaponQuality};
      const reserve=readReserve?.();if(reserve){if(apply.disabled||!validApparelCountFilter278(reserve))return;settings.apparelCount=reserve;}
      send({type:'bill-update',structureId:station.id,billId:bill.id,settings});
    };
    const actions=document.createElement('div');actions.className='bill-actions';actions.append(apply);if(cancelReserve)actions.append(cancelReserve);
    for(const [text,direction] of [['↑',-1],['↓',1]] as const){const button=document.createElement('button');button.textContent=text;button.setAttribute('aria-label',direction===-1?'Monter la facture':'Descendre la facture');button.onclick=()=>send({type:'bill-move',structureId:station.id,billId:bill.id,direction});actions.append(button);}
    const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Supprimer la facture');remove.onclick=()=>send({type:'bill-remove',structureId:station.id,billId:bill.id});actions.append(remove);form.append(actions);root.append(form);
  }
  return root;
}
export function updateBillControls(root:ParentNode,station:Structure,world:World):void {
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-add-recipe]')){const recipe=button.dataset.addRecipe as ProductionRecipe;const unlocked=productionResearchUnlocked(world,recipe);button.hidden=!unlocked;button.disabled=!unlocked;button.title=isProstheticRecipe273(recipe)?prostheticRecipeDescription273:isSmithingRecipe267(recipe)?smithingRecipeDescription(recipe):recipe==='smelt-apparel'?smeltingApparelDescription:recipe==='brew-wort'?brewingRecipeDescription:recipe==='make-pemmican'?pemmicanRecipeDescription:recipe==='tuque'?'20 tissus ou 20 laines de mufalo, sans mélange · Vêtements complexes requis':isBurnApparelRecipe(recipe)?burnApparelDescription:isCremationRecipe(recipe)?cremationDescription:recipe==='smelt-slag'?slagDescription256:isSmeltingRecipe(recipe)?smeltingDescription:biofuelRecipe(recipe)?biofuelRecipeDescription(recipe):recipe==='make-medicine'?'1 plante médicinale + 1 neutroamine + 3 tissus → 1 médicament · Artisanat 4 et Intellectuel 4 · Production de médicaments requise':mechRecipe(recipe)?mechRecipeDescription(recipe):isGunRecipe(recipe)?`${GUN_REQUIREMENTS[recipe].steel} acier + ${GUN_REQUIREMENTS[recipe].component} composants · Artisanat ${GUN_REQUIREMENTS[recipe].skill} · ${recipe==='make-emp-launcher'?'Microélectronique':'Armurerie'} requise`:recipe==='make-flak-vest'?`${FLAK_REQUIREMENTS.cloth} tissu + ${FLAK_REQUIREMENTS.steel} acier + ${FLAK_REQUIREMENTS.component} composant · Artisanat ${FLAK_REQUIREMENTS.skill} · Armure pare-balles requise`:recipe==='make-flak-helmet'?`${FLAK_HELMET_REQUIREMENTS.steel} acier + ${FLAK_HELMET_REQUIREMENTS.component} composants + ${FLAK_HELMET_REQUIREMENTS.plasteel} plastacier · Artisanat ${FLAK_HELMET_REQUIREMENTS.skill} · Armure pare-balles requise`:recipe==='make-recon-armor'?'80 plastacier + 3 composants avancés + 10 uranium · Artisanat 6 · Armure de reconnaissance requise':recipe==='make-recon-helmet'?`${RECON_HELMET_REQUIREMENTS.plasteel} plastacier + ${RECON_HELMET_REQUIREMENTS['advanced-component']} composant avancé · Artisanat ${RECON_HELMET_REQUIREMENTS.skill} · Armure de reconnaissance requise`:recipe==='make-advanced-component'?'1 composant + 20 acier + 10 plastacier + 3 or · Artisanat 8 · Fabrication avancée requise':recipe==='cook-survival-meal'?'6 protéines (viande ou lait) + 6 végétaux · 1 repas de survie · Cuisine 8 · Recherche Repas de survie requise':recipe==='cook-simple-meal-bulk'?'40 ingrédients crus · 4 repas simples · Cuisine':recipe==='cook-fine-meal-bulk'?'20 protéines (viande ou lait) + 20 végétaux · 4 plats raffinés · Cuisine 6':recipe==='cook-vegetarian-fine-meal-bulk'?'60 végétaux crus ou lait · 4 plats raffinés végétariens · Cuisine 6':recipe==='cook-carnivore-fine-meal-bulk'?'60 viandes crues · 4 plats raffinés carnivores · Cuisine 6':recipe==='cook-lavish-meal-bulk'?'40 protéines (viande ou lait) + 40 végétaux · 4 plats gastronomiques · Cuisine 8':recipe==='cook-vegetarian-lavish-meal-bulk'?'100 végétaux crus ou lait · 4 plats gastronomiques végétariens · Cuisine 8':recipe==='cook-carnivore-lavish-meal-bulk'?'100 viandes crues · 4 plats gastronomiques carnivores · Cuisine 8':'';}
  for(const bill of station.bills??[]) {
    const form=root.querySelector<HTMLElement>(`[data-bill="${bill.id}"]`);if(!form)continue;
    const count=bill.mode==='until'&&(!bill.suspended||isSchema289OrLater(world.schemaVersion)&&supportsBillReservePause289(bill.recipe))?countedProducts(world,bill):undefined;
    form.querySelector('[data-bill-status]')!.textContent=`${PRODUCTION_RECIPES[bill.recipe].label} · ${bill.suspended?'suspendue':bill.mode==='times'?`${bill.target} restant(s)`:bill.mode==='until'?`${count} / ${bill.target} ${isApparelCountRecipe278(bill.recipe)&&bill.apparelCount?'vêtement(s) admis dans la réserve confirmée':bill.recipe==='butcher-creature'?'viande(s) stockée(s)':'produit(s) compté(s)'}${isSchema289OrLater(world.schemaVersion)&&bill.reservePause?.enabled&&bill.reservePause.paused?` · pause automatique acquise, reprise à ${bill.reservePause.resumeAt} ou moins`:''}`:'sans limite'}`;
    form.querySelector('[data-bill-reason]')!.textContent=queryCookingBillStatus(world,station,bill).reason;
    apparelDrafts278.get(form)?.sync(bill,isSchema278OrLater(world.schemaVersion));
    workerDrafts283.get(form)?.sync(bill,isSchema283OrLater(world.schemaVersion));
    pauseDrafts289.get(form)?.refresh(world,bill,count);
    if(!form.dataset.dirty)(form.querySelector('[data-field="target"]') as HTMLInputElement).value=String(bill.target);
  }
}
