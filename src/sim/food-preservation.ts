import {ANIMAL_ITEM_ROT_DAYS_256} from './animal-items-v256.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import type { ItemId } from './items.ts';
import { TICKS_PER_DAY, type MaterialPile, type World } from './types.ts';

export const ROT_DAYS = Object.freeze({ambrosia:30,hops:30,wort:5,'raw-fungus':30, ...ANIMAL_ITEM_ROT_DAYS_256,pemmican:70,hay:60, 'nutrient-paste-meal':.75, berries: 14, milk: 14, rice: 40, potato: 30, corn: 60, 'simple-meal': 4, 'fine-meal': 4, 'vegetarian-fine-meal': 4, 'carnivore-fine-meal': 4, 'lavish-meal': 4, 'vegetarian-lavish-meal': 4, 'carnivore-lavish-meal': 4, 'herbal-medicine':150, 'hare-meat':2, 'hare-corpse':2.5, 'agave-fruit':25, 'snow-hare-meat':2, 'deer-meat':2, 'muffalo-meat':2, 'gazelle-meat':2, 'dromedary-meat':2, 'snow-hare-corpse':2.5, 'deer-corpse':2.5, 'muffalo-corpse':2.5, 'gazelle-corpse':2.5, 'dromedary-corpse':2.5, 'red-fox-meat':2, 'red-fox-corpse':2.5 } as const);
export type PerishableItem = keyof typeof ROT_DAYS;
export interface RotState { progress: number; atTick: number; rate?:number; /** Actual extra age, on an indivisible corpse only; never inferred from weather history. */ fallout294?:number }
export type SpoiledFood = Record<'berries'|'rice'|'simple-meal',number>&Partial<Record<PerishableItem,number>>;
export const emptySpoilage = (): SpoiledFood => ({ berries: 0, rice: 0, 'simple-meal': 0 });
export const isPerishable = (item: ItemId): item is PerishableItem => Object.hasOwn(ROT_DAYS, item);
export const rotRateAtTemperature = (temperature: number): number => Math.max(0, Math.min(1, temperature / 10));

/** Anchored thermal age. Rate changes checkpoint the previous interval first. */
export function rotAge(pile: MaterialPile, tick: number): number {
  return pile.rot ? pile.rot.progress + (tick - pile.rot.atTick) * (pile.rot.rate??1) : 0;
}
export function ticksUntilRot(pile: MaterialPile, tick: number): number {
  if(!isPerishable(pile.item))return Infinity;
  const remaining=ROT_DAYS[pile.item]*TICKS_PER_DAY-rotAge(pile,tick);
  return remaining<=0?0:remaining/(pile.rot?.rate??1);
}
export function freshRot(item: ItemId, tick: number): { rot?: RotState } {
  return isPerishable(item) ? { rot: { progress: 0, atTick: tick } } : {};
}
export function copyRot(pile: Pick<MaterialPile,'rot'>): { rot?: RotState } {
  return pile.rot ? { rot: { ...pile.rot } } : {};
}
/** Call before increasing target.quantity; incomingAge=0 means newly produced food. */
export function mergeRot(target: MaterialPile, quantity: number, incomingAge: number, tick: number): void {
  if (!quantity || !isPerishable(target.item)) return;
  target.rot = { progress: (rotAge(target, tick) * target.quantity + incomingAge * quantity) / (target.quantity + quantity), atTick: tick,...target.rot?.rate!==undefined?{rate:target.rot.rate}:{} };
}
export function spoiledUnits(world: World): number {
  return Object.entries(world.spoiled).reduce((sum,[item,n])=>sum+(ITEM_DEFINITIONS[item as ItemId].nutrition>0?(n??0):0),0);
}
