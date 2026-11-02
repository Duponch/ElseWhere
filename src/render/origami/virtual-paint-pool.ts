import type {ReferencePaintDescriptor} from './reference-paint-library';
import {referenceCoverageKey} from './reference-coverage';

/** CPU paint residency planning. No Three, Canvas, GPU, World or timers. */
export interface VirtualPaintDescriptor extends ReferencePaintDescriptor {origin?:string}
export interface PaintAdmissionEntry {
 readonly virtualId:number;readonly pigmentLayer:number;readonly faceLayer:number;
 readonly descriptor:VirtualPaintDescriptor;readonly newlyResident:boolean;
}
export interface PaintAdmissionPlan {
 readonly revision:number;readonly entries:readonly PaintAdmissionEntry[];
 readonly bankShapes:readonly {size:1|512;depth:number}[];
 readonly faceDepth:number;readonly residentCount:number;readonly refreshed:boolean;readonly repaint:boolean;
}
const TABLE_SIDE=256,MAX_VIRTUAL=TABLE_SIDE*TABLE_SIDE,MIP_TEXELS=349525;
function stable(value:unknown):string{
 if(value===undefined)return 'undefined';if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
}
function freezeDescriptor(descriptor:VirtualPaintDescriptor):VirtualPaintDescriptor{
 const copy=JSON.parse(JSON.stringify(descriptor)) as VirtualPaintDescriptor;
 if(copy.config.gradientTip)Object.freeze(copy.config.gradientTip);if(copy.config.flankStripe)Object.freeze(copy.config.flankStripe);Object.freeze(copy.config);return Object.freeze(copy);
}
function faceKey(descriptor:VirtualPaintDescriptor):string{
 // Include source namespace and refresh semantics conservatively. RGB values
 // may vary in a human palette; RNG-controlling configuration may not.
 return JSON.stringify([descriptor.origin??'atelier-original-6',referenceCoverageKey(descriptor),descriptor.refreshSeed??descriptor.seed]);
}
export class VirtualPaintPool {
 private readonly descriptors:VirtualPaintDescriptor[]=[];private readonly keys=new Map<string,number>();
 private readonly owners=new Map<string,readonly number[]>();private readonly species=new Map<string,readonly number[]>();
 private readonly resident=new Map<number,{pigmentLayer:number;faceLayer:number}>();private readonly faces=new Map<string,number>();
 private readonly rows:number[][]=[];private readonly rowKeys=new Map<string,number>();
 private revision=0;private nextPigment=1;private refreshed=false;private metadata?:Float32Array;
 private staticSealed=false;private staticCount=0;
 private readonly plans=new WeakSet<PaintAdmissionPlan>();
 constructor(base:readonly VirtualPaintDescriptor[],readonly physicalLimit=2048,readonly faceLimit=256){
  if(base.length!==43)throw Error('Paint residency requires the protected43 base virtual IDs.');
  if(!Number.isInteger(physicalLimit)||physicalLimit<1||physicalLimit>2048||!Number.isInteger(faceLimit)||faceLimit<1||faceLimit>256)throw Error('Physical texture-array limits exceeded.');
  if(base[0]?.key!=='generic-gouache')throw Error('Virtual0 must remain the protected generic profile.');
  for(const descriptor of base)this.register(descriptor);if(this.descriptors.length!==43)throw Error('Base virtual identities must be distinct.');
 }
 register(descriptor:VirtualPaintDescriptor):number{
  if(this.staticSealed&&!this.keys.has(descriptor.key))throw Error('Static virtual catalog is sealed; late species IDs could collide with human rows.');
  return this.registerAny(descriptor);
 }
 sealStaticCatalog():void{if(!this.staticSealed){this.staticSealed=true;this.staticCount=this.descriptors.length;this.revision++;}}
 registerHumanProfile(descriptor:VirtualPaintDescriptor):number{
  if(!descriptor.key.startsWith('human:'))throw Error('Dynamic virtual profiles are reserved for human appearance keys');this.sealStaticCatalog();return this.registerAny(descriptor);
 }
 private registerAny(descriptor:VirtualPaintDescriptor):number{
  if(typeof descriptor.key!=='string'||!descriptor.key)throw Error('Stable virtual paint key required');
  const old=this.keys.get(descriptor.key);if(old!==undefined){if(stable(this.descriptors[old])!==stable(descriptor))throw Error('A registered virtual paint identity cannot be overwritten.');return old;}
  if(this.descriptors.length>=MAX_VIRTUAL)throw Error('Virtual RG32 metadata capacity exceeded.');
  faceKey(descriptor);const id=this.descriptors.length;this.descriptors.push(freezeDescriptor(descriptor));this.keys.set(descriptor.key,id);this.revision++;return id;
 }
 id(key:string):number{const id=this.keys.get(key);if(id===undefined)throw Error('Unknown virtual profile '+key);return id;}
 private ids(ids:readonly number[]):readonly number[]{
  for(const id of ids)if(!Number.isInteger(id)||id<0||id>=this.descriptors.length)throw Error('Unknown virtual paint ID');
  return Object.freeze([...new Set(ids)].sort((a,b)=>a-b));
 }
 requireProfiles(owner:string,ids:readonly number[]):void{
  if(!owner)throw Error('Presentation owner required');const next=this.ids(ids),old=this.owners.get(owner);if(old&&stable(old)===stable(next))return;this.owners.set(owner,next);this.revision++;
 }
 release(owner:string):void{if(this.owners.delete(owner))this.revision++;}
 declareSpecies(species:string,ids:readonly number[]):void{
  const next=this.ids(ids),old=this.species.get(species);if(old){if(stable(old)!==stable(next))throw Error('Species recipe cannot be overwritten.');return;}this.species.set(species,next);this.revision++;
 }
 requireSpecies(owner:string,actualSpecies:readonly string[]):void{
  const ids:number[]=[];for(const species of actualSpecies){const recipe=this.species.get(species);if(!recipe)throw Error('No declared species recipe '+species);ids.push(...recipe);}this.requireProfiles(owner,ids);
 }
 registerHumanRow(virtualIds:readonly number[]):number{
  if(virtualIds.length!==12)throw Error('Human row requires the existing12 category IDs.');this.ids(virtualIds);this.sealStaticCatalog();const key=virtualIds.join(','),old=this.rowKeys.get(key);if(old!==undefined)return old;
  if(this.rows.length>=4096)throw Error('Human row capacity exceeded');const row=this.rows.length;this.rows.push([...virtualIds]);this.rowKeys.set(key,row);this.revision++;return row;
 }
 requireHumanRow(owner:string,row:number):void{const ids=this.rows[row];if(!ids)throw Error('Unknown human row');this.requireProfiles(owner,ids);}
 humanRowsData():Float32Array{return new Float32Array(this.rows.flat());}
 private required():readonly number[]{return [...new Set([...this.owners.values()].flat())].sort((a,b)=>a-b);}
 plan(repaint=false):PaintAdmissionPlan{
  const desired=this.required(),ids=repaint?[...new Set([...this.resident.keys(),...desired])].sort((a,b)=>a-b):desired.filter(id=>!this.resident.has(id));
  const faces=new Map(this.faces),resolved=new Map(this.resident),entries:PaintAdmissionEntry[]=[];let next=this.nextPigment;
  for(const id of ids){
   const descriptor=this.descriptors[id]!,existing=resolved.get(id);let pigmentLayer=existing?.pigmentLayer;
   // Slot0 is reserved ONLY for virtual generic0, retaining the generic-tint
   // test without a third metadata channel or extra varying. It is not baked
   // unless requested. Every non-generic virtual ID maps to a positive slot.
   if(pigmentLayer===undefined)pigmentLayer=id===0?0:next++;
   if(pigmentLayer>=this.physicalLimit)throw Error('Requested resident pigment capacity exceeded before allocation.');
   const key=faceKey(descriptor);let faceLayer=faces.get(key);if(faceLayer===undefined){faceLayer=faces.size;if(faceLayer>=this.faceLimit)throw Error('Requested face-template capacity exceeded before allocation.');faces.set(key,faceLayer);}
   resolved.set(id,{pigmentLayer,faceLayer});
   const effective=this.refreshed||repaint?freezeDescriptor({...descriptor,seed:descriptor.refreshSeed??descriptor.seed}):descriptor;
   entries.push(Object.freeze({virtualId:id,pigmentLayer,faceLayer,descriptor:effective,newlyResident:!existing}));
  }
  const maxima=Array<number>(8).fill(-1);for(const {pigmentLayer}of resolved.values()){const bank=Math.floor(pigmentLayer/256);maxima[bank]=Math.max(maxima[bank]!,pigmentLayer%256);}
  const bankShapes=maxima.map(max=>Object.freeze({size:(max<0?1:512) as 1|512,depth:Math.max(1,max+1)}));
  const plan=Object.freeze({revision:this.revision,entries:Object.freeze(entries),bankShapes:Object.freeze(bankShapes),faceDepth:faces.size,residentCount:resolved.size,refreshed:this.refreshed||repaint,repaint});this.plans.add(plan);return plan;
 }
 /** Call ONLY after all candidate texture bytes/uploads succeeded, immediately
  * before atomically publishing textures+metadata at a render boundary. */
 commit(plan:PaintAdmissionPlan):void{
  if(!this.plans.has(plan)||plan.revision!==this.revision)throw Error('Stale or foreign paint admission plan');
  if(plan.entries.length&&!this.metadata)this.metadata=new Float32Array(MAX_VIRTUAL*2).fill(-1);
  for(const entry of plan.entries){
   const source=this.descriptors[entry.virtualId]!;this.faces.set(faceKey(source),entry.faceLayer);this.resident.set(entry.virtualId,{pigmentLayer:entry.pigmentLayer,faceLayer:entry.faceLayer});
   this.metadata![entry.virtualId*2]=entry.pigmentLayer;this.metadata![entry.virtualId*2+1]=entry.faceLayer;
   this.nextPigment=Math.max(this.nextPigment,entry.pigmentLayer+1);
  }
  this.refreshed=plan.refreshed;this.plans.delete(plan);this.revision++;
 }
 /** Borrowed renderer-owned data. Never mutate outside this owner. Undefined
  * until the first admission; constructor/default metadata creates no pixels. */
 metadataData():Float32Array|undefined{return this.metadata;}
 /** Binding preparation only, still no pigment/paper pixels or Canvas. */
 ensureMetadataData():Float32Array{return this.metadata??=new Float32Array(MAX_VIRTUAL*2).fill(-1);}
 get version():number{return this.revision;}
 dispose():void{this.metadata=undefined;this.resident.clear();this.faces.clear();this.owners.clear();this.species.clear();this.rows.length=0;this.rowKeys.clear();this.descriptors.length=0;this.keys.clear();this.revision++;}
 resolve(virtualId:number):readonly[number,number]|undefined{const item=this.resident.get(virtualId);return item?[item.pigmentLayer,item.faceLayer]:undefined;}
 assertResident(virtualIds:readonly number[]):void{this.ids(virtualIds);for(const id of virtualIds)if(!this.resident.has(id))throw Error('Render attempted before virtual paint admission.');}
 stats(){const maxima=Array<number>(8).fill(-1);for(const {pigmentLayer}of this.resident.values()){const bank=Math.floor(pigmentLayer/256);maxima[bank]=Math.max(maxima[bank]!,pigmentLayer%256);}let pLayers=0,inactiveBanks=0;for(const max of maxima)if(max<0)inactiveBanks++;else pLayers+=max+1;const allocated=this.resident.size>0;
  return {virtualCount:this.descriptors.length,staticCatalogSealed:this.staticSealed,staticVirtualCount:this.staticSealed?this.staticCount:this.descriptors.length,humanRows:this.rows.length,requiredCount:this.required().length,residentCount:this.resident.size,faceCount:this.faces.size,metadataBytes:this.metadata?.byteLength??0,
   physicalPixelCpuBytes:allocated?pLayers*512*512*4+this.faces.size*512*512*5+inactiveBanks*4:0,
   physicalPixelGpuBytesWithMips:allocated?pLayers*MIP_TEXELS*4+this.faces.size*MIP_TEXELS*5+inactiveBanks*4:0};
 }
}
