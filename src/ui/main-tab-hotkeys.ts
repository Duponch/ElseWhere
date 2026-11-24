import type {Panel,Tool} from './layout';

/** Keyboard map of the main tabs and of the designators (RimWorld 1.6 defaults).
 * Pure tables: main.ts reads them, no state, no World. */

/** Core MainButtonDefs defaultHotKey: Architect Tab, Work F1, Schedule F2,
 * Assign F3, Animals F4, Wildlife F5, Research F6, Quests F7, World F8,
 * History F9. Factions and Menu have none. Every tab exists in Elsewhere. */
export const MAIN_TAB_HOTKEYS:Readonly<Record<string,Exclude<Panel,null>>>=Object.freeze({
  Tab:'architect',F1:'work',F2:'schedule',F3:'assign',F4:'animals',F5:'wildlife',F6:'research',F7:'quests',F8:'world',F9:'history',
});
export const mainTabHotkey=(key:string):Exclude<Panel,null>|undefined=>Object.hasOwn(MAIN_TAB_HOTKEYS,key)?MAIN_TAB_HOTKEYS[key]:undefined;

/** Core designator hot keys of the Orders category, valid while that palette
 * is open (KeyBindings.xml and each Designator's hotKey): Designator_Cancel C,
 * Designator_Deconstruct X, Mine Misc10 (L), PlantsHarvestWood Misc1 (B),
 * PlantsCut Misc3 (Y), PlantsHarvest Misc2 (H), Haul Misc12 (P), Forbid
 * Command_ItemForbid (F), Unforbid Misc6 (U), SmoothSurface Misc5 (J, schema
 * 367). Hunt (O), Slaughter (M), Tame and Claim (N) have no Orders tool in
 * Elsewhere. Schema 369: Designator_Plan_Add
 * Misc9 (I) and Designator_Plan_Remove Misc8 (K). */
export const ORDERS_PALETTE_HOTKEYS:Readonly<Record<string,Tool>>=Object.freeze({
  c:'cancel',x:'deconstruct',l:'mine',b:'chop',y:'cut',h:'harvest',p:'haul-chunks',f:'forbid',u:'allow',j:'smooth-surface',
  i:'plan',k:'remove-plan',
});
/** Core designator hot keys of the Zone category: Cancel C, Deconstruct X,
 * ZoneAddStockpile_Resources Misc1 (B), ZoneAdd_Growing Misc2 (H),
 * AreaHomeExpand Misc4 (N), AreaHomeClear Misc7 (M), AreaBuildRoof Misc9 (I),
 * AreaNoRoof Misc5 (J), AreaIgnoreRoof Misc11 (O). Zone deletion (Y) and the
 * allowed areas (K, L) have no matching tool in this palette. */
export const ZONES_PALETTE_HOTKEYS:Readonly<Record<string,Tool>>=Object.freeze({
  c:'cancel',x:'deconstruct',b:'stockpile',h:'growing',n:'home',m:'remove-home',i:'build-roof',j:'remove-roof',o:'ignore-roof',
});
export function paletteHotkeyTool(palette:'orders'|'zones'|undefined,key:string):Tool|undefined {
  if(!palette||key.length!==1)return undefined;
  const table=palette==='orders'?ORDERS_PALETTE_HOTKEYS:ZONES_PALETTE_HOTKEYS,letter=key.toLowerCase();
  return Object.hasOwn(table,letter)?table[letter]:undefined;
}

/** Remaining Elsewhere-specific convenience shortcuts. C/X outside the
 * Architect now target the selection's reverse designators, and S is the
 * Core downward camera key. The open palettes have their own bindings. */
export const GLOBAL_TOOL_HOTKEYS:Readonly<Record<string,Tool>>=Object.freeze({
  m:'mine',b:'wall',l:'bed',r:'harvest',
});
export function globalHotkeyTool(key:string):Tool|undefined {
  if(key.length!==1)return undefined;
  const letter=key.toLowerCase();
  return Object.hasOwn(GLOBAL_TOOL_HOTKEYS,letter)?GLOBAL_TOOL_HOTKEYS[letter]:undefined;
}
