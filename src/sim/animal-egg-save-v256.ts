import {isEggBoxSchema374} from './egg-box-state-374.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
import {ANIMAL_EGG_CONTENT_256,isEggSpecies256,eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import {animalLifeStageData256} from './animal-core-v256.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {MaterialPile} from './types.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
/** No parent must remain alive/on this map; only its real prior identity survives. */
export function validEggPile256(pile:Pick<MaterialPile,'item'|'egg'|'eggForbidden'>,version:number,tick:number,nextId:number):boolean {
 const species=eggSpeciesForItem256(pile.item),egg:unknown=pile.egg;
 if(Object.hasOwn(pile,'eggForbidden')&&(version<256||!species||pile.eggForbidden!==true))return false;
 if(version<256||!species)return !Object.hasOwn(pile,'egg');
 if(!animalMechanicalReadiness256(species).ok)return false;
 const def=ANIMAL_EGG_CONTENT_256[species];if(pile.item!==def.fertilizedItem)return !Object.hasOwn(pile,'egg');
 return obj(egg)&&keys(egg,['progress','temperatureDamage','faction','atTick'],['motherId','fatherId'])&&finite(egg.progress,0,1+1/(def.hatchDays*60000)+1e-6)&&finite(egg.temperatureDamage,0,1)&&['player','wild'].includes(String(egg.faction))&&egg.atTick===tick
  &&(egg.motherId===undefined||int(egg.motherId,1,nextId-1))&&(egg.fatherId===undefined||int(egg.fatherId,1,nextId-1))&&(egg.motherId===undefined||egg.motherId!==egg.fatherId);
}
export function validAnimalEggState256(a:WildAnimal,version:number,w:{width:number;height:number;nextId:number;tick:number}):boolean {
 if(version<256||!isEggSpecies256(a.species))return !Object.hasOwn(a,'eggLayer')&&!Object.hasOwn(a,'eggLay');
 const def=ANIMAL_EGG_CONTENT_256[a.species],layer:unknown=a.eggLayer,job:unknown=a.eggLay;
 if(!obj(layer)||!keys(layer,['progress','fertilizations'],['fatherId'])||!finite(layer.progress,0,1)||!int(layer.fertilizations,0,def.fertilizationMaximum)||(layer.fatherId===undefined?layer.fertilizations>0:!int(layer.fatherId,1,w.nextId-1)||layer.fatherId===a.id))return false;
 if(job===undefined)return true;
 return obj(job)&&keys(job,['target','progress'],isEggBoxSchema374(version)?['box374']:[])&&(job.box374===undefined||int(job.box374,1,w.nextId-1))&&obj(job.target)&&keys(job.target,['x','z'])&&int(job.target.x,0,w.width-1)&&int(job.target.z,0,w.height-1)&&int(job.progress,0,49)
  &&layer.progress>=1&&animalLifeStageData256(a.species,a.ageTicks,a.growthTracker?.value).milkable&&(!def.femaleOnly||a.sex==='female')&&!['dead','downed'].includes(a.state)
  &&(job.progress===0||a.x===job.target.x&&a.z===job.target.z&&!a.path.length&&(a.motion?.end??0)<=w.tick);
}
