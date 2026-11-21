import {ANIMAL_ITEM_DETERIORATION_256} from './animal-items-v256.ts';
import {SMITHING_APPAREL_ITEMS267,type SmithingApparel267} from './smithing-apparel-267.ts';
/** Restricted prospective catalogue. Core 1.6.4871 rates in mean HP/day. */
export const DETERIORATION_RATES=Object.freeze({'shell-high-explosive':1.5,'shell-incendiary':1.5,novel:5,'prosthetic-arm':2,'prosthetic-leg':2,...Object.fromEntries(SMITHING_APPAREL_ITEMS267.map(item=>[item,2])) as Record<SmithingApparel267,number>,hops:6,wort:1,beer:.5,'raw-fungus':6,...ANIMAL_ITEM_DETERIORATION_256,wood:.5,cloth:4,'muffalo-wool':3.4,'light-leather':2,plainleather:2,bluefur:2,camelhide:2,foxfur:2,component:2,'advanced-component':2});
export type DeteriorationItem=keyof typeof DETERIORATION_RATES;
export const isDeteriorationItem=(v:unknown):v is DeteriorationItem=>typeof v==='string'&&Object.hasOwn(DETERIORATION_RATES,v);
/** Local probability cadence, not the Core cell sampler. */
export const DETERIORATION_INTERVAL=25;
export interface DeteriorationState {revision:1;rng:number;lastTick:number}
/** New independent stream; migration never draws the campaign RNG or ages goods. */
export function createDeteriorationState(seed:number,tick:number):DeteriorationState {
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('Invalid prospective deterioration tick.');
 return {revision:1,rng:((seed^0x6d369e31)>>>0)||1,lastTick:tick};
}
