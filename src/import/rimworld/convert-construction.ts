/** Original Core frames and build blueprints are distinct material owners.
 * Build each actual plan with the ordinary command/recipe guard, and give
 * it only the material actually delivered inside Core's resourceContainer. */
import type {ImportContext} from './convert.ts';
import type {JobKind,DesignateCommand} from '../../sim/types.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../../sim/items.ts';
import {canDesignate,applyCommand} from '../../sim/engine.ts';
import {constructionMaterials,validConstructionMaterial,newConstructionRecipe379} from '../../sim/construction-materials.ts';
import {addMaterial,refreshStock} from '../../sim/materials.ts';
import {frameMaxHp256} from '../../sim/roof-frame-256.ts';
import {markFrameGeometryChanged379} from '../../sim/frame-geometry-379.ts';
import {setWorkUnits} from '../../sim/work-progress.ts';
import {isConstruction} from '../../sim/construction-rules.ts';
import {newShelfStorage} from '../../sim/shelf-storage.ts';
import {BUILDING_MAP} from './map-buildings.ts';
import {ITEM_MAP,STUFF_MAP} from './map-items.ts';
import {lookup,isDropped} from './mapping.ts';
import {placeRwsFootprint} from './local-coordinates.ts';
import {items as listItems,text,num,child} from './xml.ts';
import {storageSettingsFromCore} from './colony-filters.ts';

export function importConstructionPlans(ctx:ImportContext):void {
 const {map,w,notes}=ctx;
 for(const t of map.things){
  const frame=t.cls==='Frame',blueprint=t.cls==='Blueprint_Build';
  if(!frame&&!blueprint||!t.pos)continue;
  notes.countBefore('production');
  const name=t.def.replace(/^(?:Frame|Blueprint)_/,'');
  const spec=lookup(BUILDING_MAP,name);
  const lost=(why:string)=>notes.def('production',t.def,'dropped',undefined,why);
  if(!spec||isDropped(spec)){lost('Bâtiment associé non représenté.');continue;}
  const kind=spec.to.kind as JobKind;
  if(!isConstruction({kind})){lost('Construction non réalisable.');continue;}
  const where=placeRwsFootprint(ctx.coordinates,spec.to.kind,t.pos,t.rot,spec.to.size);
  if(!where){lost('Emprise non représentée.');continue;}
  const stuff=lookup(STUFF_MAP,t.stuff);
  const material=stuff&&!isDropped(stuff)?stuff.to.construction:constructionMaterials(kind)[0];
  if(material!==undefined&&!validConstructionMaterial(kind,material,w.schemaVersion)){lost('Matériau de construction non admis.');continue;}
  const command:DesignateCommand={type:'designate',kind,x:where.x,z:where.z,orientation:where.orientation,...material!==undefined?{material}:{}};
  const decision=canDesignate(w,command);
  if(!decision.ok){lost('Chantier non admissible : '+decision.reason);continue;}
  const recipe=newConstructionRecipe379({kind,material},w.schemaVersion);
  if(!recipe){lost('Recette de construction introuvable.');continue;}
  const delivered=new Map<ItemId,number>();let valid=true;
  for(const entry of listItems(t.node,'resourceContainer/innerList')){
   const m=lookup(ITEM_MAP,text(entry,'def')),q=num(entry,'stackCount')??1;
   if(!m||isDropped(m)||q<=0||!Number.isSafeInteger(q)){valid=false;break;}
   delivered.set(m.to,(delivered.get(m.to)??0)+q);
  }
  if(!valid||[...delivered].some(([item,q])=>q>(recipe.ingredients.find(c=>c.item===item)?.quantity??0))){
   lost('Les matières livrées ne correspondent pas au coût du chantier Elsewhere.');continue;
  }
  const id=w.nextId,result=applyCommand(w,command);
  const job=w.jobs.find(j=>j.id===id);
  if(!result.ok||!job){lost('Création du chantier refusée.');continue;}
  if(frame){
   job.construction='frame';markFrameGeometryChanged379(w);
   const hp=frameMaxHp256(job);
   if(t.hp!==undefined&&hp>0&&t.hp>0&&t.hp<hp)job.frameDamage=hp-Math.round(t.hp);
   const work=num(t.node,'workDone')??0;
   if(work>0)setWorkUnits(job,Math.min(Math.round(recipe.work*10000),Math.round(work*1000)));
  }
  if(t.forbidden&&w.schemaVersion>=379)job.forbidden379=true;
  if((job.kind==='shelf'||job.kind==='small-shelf')&&w.schemaVersion>=380){
   const settings=storageSettingsFromCore(child(t.node,'storageSettings'));
   if(settings)job.storage380={...newShelfStorage([0],w.schemaVersion).settings,...settings};
  }
  for(const [item,quantity] of delivered)addMaterial(w,ITEM_DEFINITIONS[item].kind,quantity,{type:'job',jobId:job.id},item);
  ctx.thingIds.set(t.id,job.id);
  notes.countAfter('production');
  notes.def('production',t.def,spec.adapt?'adapted':'exact',kind,spec.adapt);
  notes.mapped('production',`Chantier ${name} : ${frame?'charpente':'plan'}, ${[...delivered].reduce((sum,[,q])=>sum+q,0)} objets déjà livrés.`);
 }
 refreshStock(w);
}
