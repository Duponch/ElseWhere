import type {ImportContext} from './convert.ts';
import {at,child,num,text,dictionary} from './xml.ts';
import {savedBytes} from './bytes.ts';
import {validAllowedAreaLabel} from '../../sim/allowed-area-save.ts';

function colorFromCore(raw:string|undefined):number|undefined{
 const m=raw?.match(/^(?:RGBA)?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/);
 if(!m)return;
 const values=m.slice(1,4).map(v=>Number(v));
 if(values.some(v=>!Number.isFinite(v)||v<0||v>1))return;
 return values.reduce((v,c)=>(v<<8)|Math.round(c*255),0);
}
/** Import only local custom allowed areas and the actual saved assignments.
 * No invented return orders: the simulation decides a later return itself. */
export function importAllowedAreas(ctx:ImportContext):void {
 const {map,w,notes}=ctx,ids=new Map<number,number>();
 for(const a of map.areas){
  if(a.attrs?.Class!=='Area_Allowed')continue;
  const old=num(a,'ID'),label=text(a,'label')?.normalize('NFC'),color=colorFromCore(text(a,'color')),grid=child(a,'innerGrid'),deflated=child(grid,'arrDeflate'),plain=child(grid,'arr');
  if(old===undefined||!validAllowedAreaLabel(label)||color===undefined||!deflated&&!plain||ids.has(old)||(w.allowedAreas?.length??0)>=10){
   notes.def('zones','Area_Allowed','dropped',undefined,'Aire personnalisée : identité, nom, couleur ou capacité non représentés.');continue;
  }
  const data=savedBytes((deflated??plain)!.text,!!deflated);
  if(data.length*8<w.width*w.height){notes.def('zones','Area_Allowed','dropped',undefined,'Grille de l’aire incomplète.');continue;}
  const cells:number[]=[];
  for(let i=0;i<w.width*w.height;i++){const source=ctx.coordinates.index(i);if((data[source>>3]??0)>>(source&7)&1)cells.push(i);}
  const id=w.nextId++;(w.allowedAreas??=[]).push({id,label,color,cells});ids.set(old,id);
  notes.countAfter('zones');notes.def('zones','Area_Allowed','exact',label);
 }
 let restored=0;
 for(const t of map.things){
  if(t.cls!=='Pawn')continue;
  const p=w.pawns.find(v=>v.id===ctx.thingIds.get(t.id));if(!p)continue;
  const rows=dictionary(at(t.node,'playerSettings/allowedAreas'));
  for(const [key,value] of rows){
   // The saved dictionary is keyed by the actual map. Never assign a
   // restriction belonging to a caravan/other map to the home map.
   const keyName=text(key),sourceMap=num(map.node,'uniqueID')??map.index;
   if(keyName!==`Map_${sourceMap}`)continue;
   const ref=text(value),match=ref?.match(/^Area_(?:Allowed_)?(?:\d+_)?(\d+)$/);
   const local=match?ids.get(Number(match[1])):undefined;
   if(local!==undefined){p.allowedAreaId=local;restored++;break;}
  }
 }
 if(restored)notes.mapped('zones',`${restored} affectations personnalisées d'aire reprises.`);
}
