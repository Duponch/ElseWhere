import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import {validNovelPile295} from './book-save-295.ts';
import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {validProstheticWorkShape273} from './prosthetic-work-save-273.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSchema269OrLater,isSchema270OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {validSmithingWorkShape267} from './smithing-save-267.ts';
import {isSmithingProduct267,isSmithingWorkpiece267} from './smithing-content-267.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {validMaterialPermission256} from './material-permission-256.ts';
import {heldDuckInventoryClock256} from './duck-held-item-clock-256.ts';
import {validEggPile256} from './animal-egg-save-v256.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import {validTreePileShape} from './tree-transfer-save.ts';
import {validOriginalTreeResource} from './tree-transfer-resource-save.ts';
import { validMechCorpseShape } from './mechanoid-corpse-save.ts';
import { validFlakWorkShape } from './flak-work.ts';
import { validArtWorkShape } from './art-work.ts';
import { V91_ITEM_IDS, V190_ITEM_IDS } from './biome-items.ts';
import { V120_ANIMAL_PRODUCT_ITEMS } from './animal-product-items.ts';
import { validHumanCorpseShape } from './burial-save.ts';
import { validFoodContamination } from './food-poisoning-save.ts';
import { validCorpseShape } from './corpse-save.ts';
import { validGunWorkShape } from './gun-work.ts';
import { validComponentWorkShape } from './component-work.ts';
import { validUnfinishedShape } from './unfinished.ts';
import { validApparelShape } from './apparel-save.ts';
import { validWeaponShape } from './equipment-save.ts';
import { MAX_STACK } from './definitions.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import type { World } from './types.ts';
import {validToxicFalloutRotCredit294} from './toxic-fallout-save-294.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const oneOf=(v:unknown,values:string[]):boolean=>typeof v==='string'&&values.includes(v);

export function validatePileRecordShape(item:Record<string,unknown>,world:Pick<World,'width'|'height'|'tick'|'nextId'|'climate'>&Partial<Pick<World,'wildlife'>>,version:number,validationTick=world.tick,ancientCasketId?:number,worldSiteId263?:number,tradeRequestHolder284?:{requestId:number;optionId:number}):string[]{
 const input={width:world.width,height:world.height,tick:validationTick};
 const coord=(v:Record<string,unknown>)=>integer(v.x,0,world.width-1)&&integer(v.z,0,world.height-1);
 const errors:string[]=[];
 if(!validAiCorePile298(item,version))return ['Invalid or future physical AI core.'];
 if(!validNovelPile295(item,version))return ['Invalid or future Novel exemplar.'];
 if(!validToxicFalloutRotCredit294(item.rot,version,item.kind==='corpse'))return ['Invalid or future corpse fallout rot credit.'];
 if(item.kind==='prosthesis'&&record(item.owner)&&item.owner.type==='job')return ['Prosthesis cannot be a construction deposit.'];
 if(!isSchema273OrLater(version)&&(isProstheticItem273(item.item)||item.item==='unfinished-prosthetic'||Object.hasOwn(item,'prostheticWork273')))return ['Future industrial prosthetics.'];
 if(!validProstheticWorkShape273(item,version))errors.push('Invalid prosthetic work.');
 if(!isSchema272OrLater(version)&&(isSpearItem272(item.item)||item.item==='unfinished-spear'))return ['Future spear catalogue.'];
 if(version<316&&(item.item==='short-bow'||item.item==='unfinished-bow'))return ['Future short bow catalogue.'];
 if(!isSchema269OrLater(version)&&(isMaceItem269(item.item)||item.item==='unfinished-mace'))return ['Future mace catalogue.'];
 if(!isSchema270OrLater(version)&&(isLongswordItem270(item.item)||item.item==='unfinished-longsword'))return ['Future longsword catalogue.'];
 if(version<268&&item.item==='unfinished-knife')return ['Future knife manufacture.'];
 if(version<267&&(isSmithingProduct267(item.item)||isSmithingWorkpiece267(item.item)||Object.hasOwn(item,'smithingWork')))return ['Future smithing item.'];
 if(!validSmithingWorkShape267(item,version))errors.push('Invalid smithing work.');
 if(version<265&&['hops','wort','beer'].includes(String(item.item)))return ['Future brewing item.'];
 if(!validMaterialPermission256(item,version))return ['Invalid or future ordinary Thing permission.'];
 if(!validEggPile256(item as unknown as import('./types.ts').MaterialPile,version,heldDuckInventoryClock256(world,item,version,validationTick),world.nextId))errors.push('Invalid or future egg state.');
 if(version<256&&item.item==='slag-steel-chunk')errors.push('Future actual steel slag in older save.');
 if(version<256&&isFutureEcologyItem256(item.item))errors.push('Future animal product in older save.');
 if(!validTreePileShape(item,version,validationTick,world.nextId,(raw,tick)=>validOriginalTreeResource(raw,world,version,tick)))errors.push('Invalid or future minified tree.');
if(!validMechCorpseShape(item,version,input.tick as number))errors.push('Invalid or future mechanoid carcass.');
if(!validFoodContamination(item.foodPoison,item.item as keyof typeof ITEM_DEFINITIONS,version>=89))errors.push('Invalid food contamination.');
if(item.item==='human-corpse'?!validHumanCorpseShape(item.humanCorpse,version,input.tick as number):item.humanCorpse!==undefined)errors.push('Invalid human corpse metadata.');
if(item.item!=='human-corpse'&&!validCorpseShape(item,version))errors.push('Invalid corpse metadata for schema.');
if(!validArtWorkShape(item,version))errors.push('Invalid or future art work.');
if(version<227&&['hay','kibble'].includes(String(item.item)))errors.push('Future fodder in older save.');
if(version<218&&(item.item==='chemfuel'||item.kind==='chemfuel'))errors.push('Future chemfuel in older save.');
if(version<206&&(item.item==='neutroamine'||item.kind==='neutroamine'))errors.push('Future neutroamine in older save.');
if(version<109&&(item.item==='unfinished-flak-vest'||item.flakWork!==undefined))errors.push('Future flak work in older save.');
if(version<141&&(item.item==='flak-helmet'||item.item==='unfinished-flak-helmet'))errors.push('Future flak helmet in older save.');
if(version<148&&(item.item==='recon-helmet'||item.item==='unfinished-recon-helmet'))errors.push('Future recon helmet in older save.');
if(version<152&&item.item==='fine-meal')errors.push('Future fine meal in older save.');
if(version<154&&item.item==='lavish-meal')errors.push('Future lavish meal in older save.');
if(version<155&&item.item==='vegetarian-fine-meal')errors.push('Future vegetarian fine meal in older save.');
if(version<156&&item.item==='carnivore-fine-meal')errors.push('Future carnivore fine meal in older save.');
if(version<157&&item.item==='vegetarian-lavish-meal')errors.push('Future vegetarian lavish meal in older save.');
if(version<159&&item.item==='carnivore-lavish-meal')errors.push('Future carnivore lavish meal in older save.');
if(version<101&&(item.item==='unfinished-gun'||item.gunWork!==undefined))errors.push('Future machining work in older save.');
if(version<178&&(V190_ITEM_IDS.includes(String(item.item))))errors.push('Future predator product in older save.');
if(version<91&&V91_ITEM_IDS.includes(String(item.item)))errors.push('Future biome product in older save.');
if(version<120&&V120_ANIMAL_PRODUCT_ITEMS.includes(String(item.item)))errors.push('Future livestock product in older save.');
if(version<123&&['gold','plasteel','advanced-component','unfinished-component'].includes(String(item.item)))errors.push('Future industrial product in older save.');
if(version<79&&['hare-corpse','hare-meat','light-leather'].includes(String(item.item)))errors.push('Future animal product in older save.');
if(!validUnfinishedShape(item,version)||!validGunWorkShape(item,version)||!validFlakWorkShape(item,version)||!validComponentWorkShape(item,version))errors.push('Invalid unfinished item.');
if(!validApparelShape(item,version))errors.push('Invalid apparel state for schema.');
if(!validWeaponShape(item,version))errors.push('Invalid weapon state for schema.');
if (!oneOf(item.kind, ['wood', 'food', ...(isSchema298OrLater(version)?['ai-core']:[]), ...((version===295||(version===296||isCorePhysicalSchema297(version)))?['book']:[]), ...(isSchema273OrLater(version)?['prosthesis']:[]), ...(version>=265?['wort','beer']:[]), ...(version>=256?['jade']:[]), ...(version>=241?['uranium']:[]), ...(version>=235?['plant']:[]), ...(version>=218?['chemfuel']:[]), ...(version>=206?['neutroamine']:[]), ...(version>=28?['chunk']:[]), ...(version>=29?['steel']:[]),...(version>=123?['gold','plasteel','advanced-component']:[]), ...(version>=32?['blocks']:[]), ...(version>=41?['component']:[]), ...(version>=51?['medicine']:[]), ...(version>=52?['weapon']:[]), ...(version>=63?['apparel']:[]), ...(version>=71?['textile']:[]), ...(version>=72?['unfinished']:[]),...(version>=79?['corpse']:[]),...(version>=194?['mech-corpse']:[]),...(version>=88?['silver']:[])]) || !integer(item.quantity, 1, version>=227&&item.item==='hay'?200:version>=218&&item.item==='chemfuel'?150:version>=206&&item.item==='neutroamine'?150:version>=256&&isFutureEcologyItem256(item.item)&&item.kind==='textile'?100:version>=120&&item.item==='muffalo-wool'?100:version>=88&&item.item==='silver'||version>=123&&item.item==='gold'?500:MAX_STACK) || !record(item.owner)) errors.push('Invalid material pile.');
else {
  if (version >= 5) {
    if (typeof item.item !== 'string' || !Object.hasOwn(ITEM_DEFINITIONS, item.item)) errors.push('Unknown item definition.');
    else {
      if(version<84&&(item.item==='potato'||item.item==='corn'))errors.push('Legacy save contains a V84 crop product.');
      if(version<88&&['silver','bolt-action-rifle','plasteel-knife'].includes(item.item as string))errors.push('Legacy save contains V88 goods.');
      if(version<217&&item.item==='nutrient-paste-meal')errors.push('Legacy save contains nutrient paste meal.');
      if(version<10&&item.item==='simple-meal')errors.push('Legacy save contains cooked meal.');
      const definition = ITEM_DEFINITIONS[item.item as keyof typeof ITEM_DEFINITIONS];
      if (definition.kind !== item.kind || (item.quantity as number) > definition.stackLimit) errors.push('Invalid item category or stack limit.');
    }
  } else if (item.item !== undefined) errors.push('Legacy save contains version 5 item.');
  const owner = item.owner;
  // A direct held owner is admissible ONLY to the actual casket validator.
  // Ordinary map/full/delta calls omit this explicit original holder ID.
  if (owner.type === 'trade-request284' ? !isSchema284OrLater(version)||!tradeRequestHolder284||owner.requestId!==tradeRequestHolder284.requestId||owner.optionId!==tradeRequestHolder284.optionId||!integer(owner.requestId,1)||!integer(owner.optionId,1,3)||Object.keys(owner).length!==3||Object.keys(owner).some(key=>!['type','requestId','optionId'].includes(key))
    : owner.type === 'world-site263' ? !isSchema263OrLater(version)||!integer(worldSiteId263,1)||owner.siteId!==worldSiteId263||Object.keys(owner).length!==2||Object.keys(owner).some(key=>!['type','siteId'].includes(key))
    : owner.type === 'ancient-casket' ? !isSchema256Or257(version)||!integer(ancientCasketId,1,world.nextId-1)||owner.casketId!==ancientCasketId||Object.keys(owner).some(key=>!['type','casketId'].includes(key))
    : owner.type === 'ground' ? !coord(owner) || Object.keys(owner).some(key => !['type', 'x', 'z'].includes(key))
    : (owner.type === 'pawn'||version>=52&&owner.type==='equipment'||version>=63&&owner.type==='apparel'||version>=88&&owner.type==='inventory') ? !integer(owner.pawnId, 1) || Object.keys(owner).some(key => !['type', 'pawnId'].includes(key))
      : version>=231&&owner.type==='starting-pod' ? !integer(owner.podId,1,world.nextId-1)||Object.keys(owner).some(key=>!['type','podId'].includes(key))
      : version>=216&&owner.type==='orbital-ship' ? !integer(owner.shipId,1,world.nextId-1)||Object.keys(owner).some(key=>!['type','shipId'].includes(key))
      : version>=216&&owner.type==='orbital-cargo' ? !integer(owner.deliveryId,1,world.nextId-1)||Object.keys(owner).some(key=>!['type','deliveryId'].includes(key))
      : version>=89&&owner.type==='grave' ? !integer(owner.graveId,1)||Object.keys(owner).some(key=>!['type','graveId'].includes(key)) : owner.type === 'job' ? !integer(owner.jobId, 1) || Object.keys(owner).some(key => !['type', 'jobId'].includes(key)) : true) errors.push('Invalid material owner.');
}
 return errors;
}
