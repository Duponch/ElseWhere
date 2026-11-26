import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

const DX=Int8Array.of(0,1,0,-1,1,1,-1,-1),DZ=Int8Array.of(-1,0,1,0,-1,1,1,-1);
export interface OwnedNavigationGrid379 {readonly masks:Uint8Array;readonly patched:ReadonlyMap<number,number>;readonly offsets:Int32Array;readonly words:Uint16Array;readonly patchWords:readonly (Uint16Array|undefined)[];readBase(index:number):number}
export interface OwnedNavigationSource379 {readonly base:Uint8Array;readonly changed:ReadonlySet<number>}
interface Capture {readonly owner:object;readonly width:number;readonly height:number;readonly base:Uint8Array;readonly corners:ReadonlySet<number>;readonly changed:ReadonlySet<number>;kernel?:OwnedNavigationGrid379}
interface Base {readonly width:number;readonly height:number;readonly words:Uint16Array;readonly offsets:Int32Array;readonly grid:Uint8Array;readonly corners:ReadonlySet<number>;masks?:Uint8Array}
const captures=new WeakMap<Uint8Array,Capture>(),bases=new WeakMap<Uint8Array,WeakMap<ReadonlySet<number>,Base>>();
const baseParents=new WeakMap<Uint8Array,{readonly before:WeakRef<Uint8Array>;readonly changed:readonly number[]}>();
const work={captures:0,baseBuilds:0,baseCells:0,baseDerivations:0,baseReuses:0,derived:0,patchedCells:0,admissions:0};
export const navigationGridWork379=()=>({...work});

function maskAt(grid:Uint8Array,width:number,height:number,index:number,corners:ReadonlySet<number>):number {
 const x=index%width,z=Math.floor(index/width);let mask=0;
 for(let k=0;k<8;k++){const dx=DX[k]!,dz=DZ[k]!,nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=width||nz>=height||grid[nz*width+nx])continue;if(k>=4&&(grid[index+dx]||grid[index+dz*width]||corners.has(index+dx)||corners.has(index+dz*width)))continue;mask|=1<<k;}
 return mask;
}
/** 0 means an uncompiled cell; 0x100 | mask includes the valid all-closed
 * zero mask. Compile only the visited cells of an immutable source. This
 * replaces the eager 62,500-cell compilation after any geometry/rock change. */
function baseMask(base:Base,index:number):number {
 const word=base.words[index]!;if(word)return word&255;
 const mask=maskAt(base.grid,base.width,base.height,index,base.corners);base.words[index]=256|mask;work.baseCells++;return mask;
}
function diagnosticMasks(base:Base):Uint8Array {
 if(!base.masks){const masks=new Uint8Array(base.words.length);for(let i=0;i<masks.length;i++)masks[i]=baseMask(base,i);base.masks=masks;}
 return base.masks;
}
/** Actual immutable static-grid producer transition. Reuse the original
 * identity when only nonblocking geometry changed; otherwise copy the
 * compiled cells and retire just the 3×3 neighbourhoods of changed terrain,
 * solids and door corners. The cardinal page graph can likewise borrow all
 * untouched pages from its immediate weak parent. Never retain a history of
 * entire grids just to retain this acceleration. */
export function inheritNavigationBase379(next:Uint8Array,previous:Uint8Array,width:number,height:number,corners:ReadonlySet<number>,previousCorners:ReadonlySet<number>):Uint8Array {
 if(!terrainJournalReadOwner()||next.length!==width*height||previous.length!==next.length)return next;
 const changed:number[]=[];
 if(next!==previous){for(let i=0;i<next.length;i++)if(next[i]!==previous[i])changed.push(i);if(!changed.length){next=previous;work.baseReuses++;}else if(changed.length<=4096)baseParents.set(next,{before:new WeakRef(previous),changed});}
 const prior=bases.get(previous)?.get(previousCorners);if(!prior||prior.width!==width||prior.height!==height||changed.length>4096||next===previous&&corners===previousCorners)return next;
 const affected=new Set<number>(),touch=(index:number)=>{const x=index%width,z=Math.floor(index/width);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,nz=z+dz;if(nx>=0&&nz>=0&&nx<width&&nz<height)affected.add(nz*width+nx);}};
 for(const i of changed)touch(i);if(corners!==previousCorners){for(const i of corners)if(!previousCorners.has(i))touch(i);for(const i of previousCorners)if(!corners.has(i))touch(i);}
 let variants=bases.get(next);if(!variants){variants=new WeakMap();bases.set(next,variants);}
 if(!variants.has(corners)){
  if(!affected.size)variants.set(corners,prior);
  else{const words=prior.words.slice();for(const i of affected)words[i]=0;variants.set(corners,{width,height,offsets:prior.offsets,words,grid:next,corners});}
  work.baseDerivations++;
 }
 return next;
}
/** Immediate true source transition; weak and optional because a cold page
 * graph is always equivalent. */
export function navigationBaseAncestor379(next:Uint8Array):{before:Uint8Array;changed:readonly number[]}|undefined {
 const parent=baseParents.get(next),before=parent?.before.deref();if(before&&parent)return {before,changed:parent.changed};
}
/** A true grid producer supplies its immutable base and every subsequently
 * overwritten cell. Public mutable arrays never receive this witness. */
export function registerNavigationGrid379(grid:Uint8Array,width:number,height:number,corners:ReadonlySet<number>,base:Uint8Array,changed:Iterable<number>):void {
 const owner=terrainJournalReadOwner();if(!owner){captures.delete(grid);return;}if(grid.length!==width*height||base.length!==grid.length)return;
 const edits=new Set<number>();for(const i of changed)if(Number.isInteger(i)&&i>=0&&i<grid.length&&grid[i]!==base[i])edits.add(i);
 const previous=captures.get(grid);
 if(previous&&previous.owner===owner&&previous.width===width&&previous.height===height&&previous.base===base&&previous.corners===corners&&previous.changed.size===edits.size){let same=true;for(const i of edits)if(!previous.changed.has(i)){same=false;break;}if(same)return;}
 captures.set(grid,{owner,width,height,base,corners,changed:edits});work.captures++;
}
/** Actor/traffic edits inherit the actual opening grid's immutable base. */
export function deriveNavigationGrid379(grid:Uint8Array,source:Uint8Array,changed:Iterable<number>):void {
 const parent=captures.get(source),owner=terrainJournalReadOwner();if(!owner){captures.delete(source);captures.delete(grid);return;}if(!parent||parent.owner!==owner||grid.length!==source.length)return;
 const edits=new Set(parent.changed);for(const i of changed)if(Number.isInteger(i)&&i>=0&&i<grid.length){if(grid[i]===parent.base[i])edits.delete(i);else edits.add(i);}
 captures.set(grid,{...parent,changed:edits,kernel:undefined});work.derived++;
}
export function navigationGridCorners379(grid:Uint8Array):ReadonlySet<number>|undefined {const owner=terrainJournalReadOwner();if(!owner){captures.delete(grid);return;}const capture=captures.get(grid);return capture?.owner===owner?capture.corners:undefined;}

/** The opening grid's source proof, for existence-only spatial readers. */
export function ownedNavigationSource379(grid:Uint8Array,width:number,height:number):OwnedNavigationSource379|undefined {
 const owner=terrainJournalReadOwner(),capture=captures.get(grid);if(!owner){captures.delete(grid);return;}if(capture?.owner===owner&&capture.width===width&&capture.height===height)return capture;
}

export function ownedNavigationGrid379(grid:Uint8Array,width:number,height:number,corners:ReadonlySet<number>):OwnedNavigationGrid379|undefined {
 const capture=captures.get(grid),owner=terrainJournalReadOwner();
 if(!owner||!capture||capture.owner!==owner||capture.width!==width||capture.height!==height||capture.corners!==corners){if(!owner)captures.delete(grid);return;}
 const fresh=!capture.kernel;
 if(fresh){
  let variants=bases.get(capture.base);if(!variants){variants=new WeakMap();bases.set(capture.base,variants);}
  let base=variants.get(corners);
  if(!base||base.width!==width||base.height!==height){const words=new Uint16Array(grid.length),offsets=Int32Array.from(DX,(dx,k)=>dx+DZ[k]!*width);base={width,height,words,offsets,grid:capture.base,corners};variants.set(corners,base);work.baseBuilds++;}
  const affected=new Set<number>();for(const i of capture.changed){const x=i%width,z=Math.floor(i/width);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,nz=z+dz;if(nx>=0&&nz>=0&&nx<width&&nz<height)affected.add(nz*width+nx);}}
  // Keep the overlay immutable even if the actual actor/door grid is edited
  // later. Store the sparse changes in numeric pages; the hot search loop
  // no longer hashes every node through the patched Map.
  const capturedBase=base,patched=new Map<number,number>(),patchWords:(Uint16Array|undefined)[]=[];
  for(const i of affected){const mask=maskAt(grid,width,height,i,corners);if(mask!==baseMask(capturedBase,i)){patched.set(i,mask);(patchWords[i>>>8]??=new Uint16Array(256))[i&255]=256|mask;}}
  capture.kernel={get masks(){return diagnosticMasks(capturedBase);},offsets:capturedBase.offsets,patched,words:capturedBase.words,patchWords,readBase:index=>baseMask(capturedBase,index)};work.patchedCells+=affected.size;
 }
 const kernel=capture.kernel;
 if(fresh&&verifyTerrainWriteCaches)for(let i=0;i<grid.length;i++)if((kernel!.patched.get(i)??kernel!.masks[i])!==maskAt(grid,width,height,i,corners))throw Error('Owned navigation mask differs from its exhaustive topology');
 work.admissions++;return kernel;
}
