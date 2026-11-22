/** Definition short hashes used by the save's compressed grids.
 *
 * Facts read from the game (no code copied): each definition type gives its
 * definitions a 16-bit hash, the definition name's stable string hash
 * (23, then ×31 + UTF-16 code unit, 32-bit signed wrap) modulo 65535, cast
 * to an unsigned 16-bit value; a zero or an already taken value is
 * incremented, definitions being processed in name order within their type.
 *
 * The importer only knows the definition names of its own mapping tables, so
 * collisions are resolved among those names. A value that matches no known
 * name is reported as unknown, never guessed. */

export function stableStringHash(name:string):number {
 let h=23;for(let i=0;i<name.length;i++)h=(Math.imul(h,31)+name.charCodeAt(i))|0;return h;
}
export function rawShortHash(name:string):number {return (stableStringHash(name)%65535)&0xffff;}

/** Map short hash → definition name for one definition type. */
export function shortHashTable(names:Iterable<string>):Map<number,string> {
 const sorted=[...new Set(names)].sort((a,b)=>a<b?-1:a>b?1:0),taken=new Map<number,string>();
 for(const name of sorted){let h=rawShortHash(name);while(h===0||taken.has(h))h=(h+1)&0xffff;taken.set(h,name);}
 return taken;
}
