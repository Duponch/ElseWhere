/** PRIVATE component draft; intended src/render/surfaces/FixedTreeTextureSurface.ts.
 * Final fixed-tree graph only. No direct-paint import, fallback graph, geometry,
 * renderer, GPU bake or texture disposal belongs to this representation. */
import type {GraphicsStyleContext} from '../graphics-style';
import type {TreeBakeDemand} from '../origami/TreeBakeOwner';
import type {TreeAssetCatalog} from '../origami/baked/trees/types';
import {createTextureSurface,validateTextureSurfaceAssets,type TextureSurfaceAssets,type TextureSurfaceOptions} from './TextureSurface';

type Cohort={readonly key:string;readonly models:readonly Readonly<{key:string;slot:number}>[]};
type State={readonly cohort:Cohort;readonly catalog:TreeAssetCatalog|undefined;readonly paintKey:string|undefined};
/** This key is captured by the actual texture owner's preparation BEFORE its
 * async bake and retained beside a cached catalog. Never relabel an old bank
 * with current settings merely because a caller wants to reuse it. */
export interface FixedTreeBank {readonly catalog:TreeAssetCatalog;readonly paintKey:string}
const empty:State=Object.freeze({cohort:Object.freeze({key:'[]',models:Object.freeze([])}),catalog:undefined,paintKey:undefined});
/** Same current Source invalidation domain. Other palette admission does not
 * alter the protected tree profiles. Atlas preparation still holds its actual
 * Source paint lease/epoch; the active owner handles generation retirement. */
export function fixedTreePaintKey(context:GraphicsStyleContext):string{
 const p=context.preferences;return JSON.stringify(['fixed-tree-source-bank-v1',p.impasto,p.wear,p.edges,p.blackEdges,p.edgeWidth,p.strokeImperfection,p.contourImperfection]);
}
function capture(demand:TreeBakeDemand):Cohort{
 if(!demand.isCurrent())throw Error('Tree cohort changed before texture admission');
 const models=demand.models.map(model=>{model.assertCurrent();if(model.species===undefined)throw Error('Continuous anonymous trees are not atlas-only assets');return Object.freeze({key:model.key,slot:model.surfaceSlot});});
 if(models.length>13||new Set(models.map(m=>m.key)).size!==models.length||new Set(models.map(m=>m.slot)).size!==models.length||models.some(m=>!Number.isSafeInteger(m.slot)||m.slot<0||m.slot>=64))throw Error('Unique bounded named tree models required');
 return Object.freeze({key:demand.key,models:Object.freeze(models)});
}
function covers(state:State):boolean{
 if(!state.cohort.models.length)return true;
 const c=state.catalog;if(!c)return false;c.assertCurrent();
 return state.cohort.models.every(model=>{const layer=c.modelKeys.indexOf(model.key),row=c.slots[model.slot];return layer>=0&&row?.paletteBaked===true&&row.layer===layer;});
}

/** Caller must keep the Core/gallery presentation hold while ready=false.
 * assertDrawable is O(1), checked at a dirty publication boundary. A missing
 * Gouache slot is explicitly unready; it is never rendered using Pastel/layer0.
 * A caller needing the complete Source representation selects its separately
 * constructed direct material before releasing the presentation hold. */
export class FixedTreeTextureSurface {
 readonly surface:ReturnType<typeof createTextureSurface>;
 private active:State=empty;private closed=false;private ready=true;
 private publication=0;private openStage=false;
 private readonly releaseSettings:()=>void;
 constructor(private readonly context:GraphicsStyleContext,private readonly pastel:TextureSurfaceAssets,options:TextureSurfaceOptions={},private readonly changed:()=>void=()=>{}){
  if(pastel.uvAddress!=='raw'||pastel.slots.some(row=>row.paletteBaked))throw Error('Exact rawUV neutral Pastel bank required');
  validateTextureSurfaceAssets(pastel);this.surface=createTextureSurface(pastel,options);
  this.releaseSettings=context.trackSharedPaintSettingsRefresh(()=>this.synchronize());
 }
 private compatible():boolean{return!this.context.reliefEnabled&&!this.context.wearEnabled;}
 private assets(state:State):TextureSurfaceAssets{
  const catalog=state.catalog;if(!catalog)throw Error('Named Gouache bank absent');
  return{texture:catalog.texture,uvAddress:'chart',slots:catalog.slots,assertCurrent:()=>catalog.assertCurrent()};
 }
 private synchronize():void{
  if(this.closed)return;
  const previousReady=this.ready,previousAssets=this.surface.assets;
  this.ready=!this.active.cohort.models.length||this.compatible()&&(!this.context.origami||this.active.paintKey===fixedTreePaintKey(this.context)&&covers(this.active));
  // Missing Gouache data never publishes the tiny Pastel placeholder. The
  // previous borrowed image remains held until admission or explicit fallback.
  const next=!this.context.origami||!this.active.cohort.models.length?this.pastel:this.ready&&this.active.catalog?this.assets(this.active):undefined;
  let bindingChanged=false;
  if(next&&(next.texture!==previousAssets.texture||next.uvAddress!==previousAssets.uvAddress||next.slots.some((row,i)=>row.layer!==previousAssets.slots[i]!.layer||row.paletteBaked!==previousAssets.slots[i]!.paletteBaked))){this.surface.setAssets(next);bindingChanged=true;}
  if(bindingChanged||previousReady!==this.ready)this.changed();
 }
 assertDrawable():void{if(this.closed||!this.ready)throw Error('Fixed tree texture admission must finish before drawing this cohort');}
 /** No await or GPU work. Warm/upload the externally owned bank first. The
  * stage borrows old/new owners until commit or CPU rollback finishes. */
 prepare(bank:FixedTreeBank|undefined,demand:TreeBakeDemand,assertExclusive:()=>void){
  if(this.closed||this.openStage)throw Error('Fixed tree texture publication unavailable');
  assertExclusive();const cohort=capture(demand),catalog=bank?.catalog,paintKey=bank?.paintKey,next:State=Object.freeze({cohort,catalog,paintKey});
  if(bank&&paintKey!==fixedTreePaintKey(this.context))throw Error('Tree texture bank belongs to different paint settings');
  if(catalog){const assets=this.assets(next);validateTextureSurfaceAssets(assets);if(catalog.pageCount!==Math.max(2,catalog.modelKeys.length)||Number((catalog.texture.image as {depth?:number}).depth)!==catalog.pageCount||new Set(catalog.modelKeys).size!==catalog.modelKeys.length||!covers(next))throw Error('Complete fixed-tree cohort bank required');}
  if(this.context.origami&&cohort.models.length&&(!this.compatible()||!catalog))throw Error('Admit named Gouache data or choose complete direct representation before publication');
  const previous=this.active,previousAssets=this.surface.assets,startPublication=this.publication;this.openStage=true;let published=false,settled=false,rolledBack=false,disposed=false;
  const rollback=()=>{if(settled)throw Error('Committed tree texture publication cannot roll back');if(rolledBack)return;if(published){if(this.publication!==startPublication+1)throw Error('Newer tree publication owns the binding');this.active=previous;this.surface.setAssets(previousAssets);this.publication++;this.ready=false;this.synchronize();}rolledBack=true;};
  return{
   publish:()=>{if(disposed||published||rolledBack||this.closed||startPublication!==this.publication)throw Error('Fixed tree stage superseded');assertExclusive();if(!demand.isCurrent()||catalog&&paintKey!==fixedTreePaintKey(this.context))throw Error('Fixed tree admission changed');catalog?.assertCurrent();this.active=next;this.publication++;published=true;try{this.synchronize();this.assertDrawable();}catch(error){try{rollback();}catch(cleanup){throw new AggregateError([error,cleanup],'Fixed tree CPU publication rollback failed');}throw error;}},
   commit:()=>{if(settled)return;if(disposed||!published||rolledBack)throw Error('Only a published current fixed tree stage can commit');assertExclusive();if(!demand.isCurrent()||catalog&&paintKey!==fixedTreePaintKey(this.context))throw Error('Fixed tree admission changed before commit');catalog?.assertCurrent();settled=true;},
   rollback,
   dispose:()=>{if(disposed)return;try{if(!settled)rollback();}finally{disposed=true;this.openStage=false;}},
  };
 }
 status(){return{ready:this.ready,cohort:this.active.cohort.key,models:this.active.cohort.models.length,material:this.surface.material.uuid,boundTexture:this.surface.assets.texture.uuid,bank:this.active.catalog?.texture.uuid??null,publication:this.publication,openStage:this.openStage};}
 dispose():void{if(this.closed)return;if(this.openStage)throw Error('Settle fixed tree texture publication before disposal');this.closed=true;this.releaseSettings();this.surface.dispose();this.active=empty;}
}
