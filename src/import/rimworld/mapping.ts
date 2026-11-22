/** Shared shape of the importer's mapping tables. Each table is keyed by a
 * RimWorld definition name (an identifier, used as a key only) and says
 * which Elsewhere identifier it becomes, how it is adapted, or why it has no
 * Elsewhere counterpart. All explanations are French, shown to the player. */
export type DefMapping<T>={readonly to:T;readonly adapt?:string}|{readonly drop:string};
export const exact=<T>(to:T):DefMapping<T>=>({to});
export const adapt=<T>(to:T,adapt:string):DefMapping<T>=>({to,adapt});
export const drop=<T=never>(reason:string):DefMapping<T>=>({drop:reason});
export const isDropped=<T>(m:DefMapping<T>):m is {readonly drop:string}=>'drop' in m;
export type MappingStatus='exact'|'adapted'|'dropped'|'unknown';
export function mappingStatus<T>(m:DefMapping<T>|undefined):MappingStatus {return !m?'unknown':isDropped(m)?'dropped':m.adapt?'adapted':'exact';}
export function lookup<T>(table:Readonly<Record<string,DefMapping<T>>>,key:string|undefined):DefMapping<T>|undefined {
 return key!==undefined&&Object.hasOwn(table,key)?table[key]:undefined;
}

/** Stuff (material) families shared by buildings, apparel and weapons. */
export const STONES=['Granite','Limestone','Marble','Sandstone','Slate'] as const;
export type CoreStone=typeof STONES[number];
export const stoneId=(stone:CoreStone)=>stone.toLowerCase() as 'granite'|'limestone'|'marble'|'sandstone'|'slate';
