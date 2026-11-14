import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {animalMarketValue261,ANIMAL_PRICE_CAPACITIES_261,type AnimalPriceClinicalCapture261} from './caravan-animal-value-261.ts';
import {CARAVAN_ANIMAL_VALUE_DATA_261} from './caravan-animal-value-data-261.ts';
import {pileMarketValue} from './trade-prices.ts';
import {structureRoomMarketValue} from './room-market-value.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {groupPackedMassGrams258} from './group-freight-mass-258.ts';
import {freightGroup} from './group-freight.ts';
import {healthRandom} from './health.ts';
import {selectDemand,type DemandCapture,type DemandResult} from './caravan-demand-selection-261.ts';
import type {AwayGroup} from './group-capture.ts';
import type {WildAnimal} from './wildlife-state.ts';

/** A medical record with no condition still represents a genuinely healthy
 * animal. Anything else requires the absent trade-capacity producer and refuses
 * this capture before category/animal selection; no animal is omitted. */
export function currentAnimalDemandValue261(a:WildAnimal):number|undefined {
 const h=a.health,data=CARAVAN_ANIMAL_VALUE_DATA_261[a.species];if(!data)return;
 if(!h){const result=animalMarketValue261(a);return result.ok?result.value:undefined;}
 if(h.injuries.length||h.missing.length||h.bloodLoss||Object.keys(h).some(k=>!['body','animalBirthTick','animalGrowth','tick','nextInjuryId','injuries','missing','bloodLoss'].includes(k)))return;
 const capacities=Object.fromEntries(ANIMAL_PRICE_CAPACITIES_261.map(name=>[name,{normal:name==='Manipulation'?data.healthyManipulation:1,forTradePrice:name==='Manipulation'?data.healthyManipulation:1}])) as AnimalPriceClinicalCapture261['capacities'];
 const result=animalMarketValue261(a,{summaryHealth:1,capacities,hediffPriceOffset:0,scenarioFactor:1});return result.ok?result.value:undefined;
}
export function captureCurrentDemand261(g:AwayGroup,playerFactionId:number,version=261):{ok:true;capture:DemandCapture}|{ok:false;reason:string} {
 if(version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))return {ok:false,reason:'Version de demande non prise en charge.'};
 const humans=g.members.map(p=>({id:p.id,owner:p.worldAffiliation259?.factionId===playerFactionId&&!p.prisoner,prisoner:!!p.prisoner}));
 if(g.members.some(p=>!p.worldAffiliation259))return {ok:false,reason:'La demande ne possède pas une affiliation humaine prise en charge.'};
 const animals=(g.animalOwners?.members??[]).map(a=>({id:a.id,marketValue:currentAnimalDemandValue261(a)}));
 if(animals.some(a=>a.marketValue===undefined))return {ok:false,reason:'Un animal exige un prix clinique qui n’est pas représenté.'};
 const objects:DemandCapture['objects'][number][]=g.items.map(p=>({kind:'pile',id:p.id,quantity:p.quantity,unitMarketValue:pileMarketValue(p,Number(version)),unitMassKg:(groupCaravanPileMass256(p,freightGroup(g),version)??NaN)/1000,apparel:p.owner.type==='apparel',equipmentDestroyedOnDrop:false}));
 try{for(const p of g.packed??[])objects.push({kind:'packed',id:p.building.id,quantity:1,unitMarketValue:structureRoomMarketValue(p.building),unitMassKg:(groupPackedMassGrams258(p,version)??NaN)/1000,apparel:false,equipmentDestroyedOnDrop:false});}
 catch(error){if(!(error instanceof RangeError))throw error;return {ok:false,reason:'Un meuble réel ne possède pas de prix représenté.'};}
 if(objects.some(p=>p.unitMarketValue===undefined||!Number.isFinite(p.unitMassKg)||p.unitMassKg!<=0))return {ok:false,reason:'Un bien réel ne possède pas son prix ou sa masse.'};
 return {ok:true,capture:{humans,animals,objects}};
}
/** Bounded speculative tape, exactly one draw per selected original plus fixed
 * category/fallback overhead. Only consumed draws advance the caller's state. */
export function selectCurrentDemand261(capture:DemandCapture,random:{rng:number}):DemandResult {
 const local={rng:random.rng},tape:number[]=[],states=[local.rng];
 for(let i=0;i<capture.objects.length+8;i++){tape.push(healthRandom(local));states.push(local.rng);}
 const result=selectDemand(capture,tape);random.rng=states[result.drawsUsed]!;return result;
}
