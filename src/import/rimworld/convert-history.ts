import type {ImportContext} from './convert.ts';
import {items,num,text,type XmlNode} from './xml.ts';
import {LETTER_ARCHIVE_LIMIT_352,LETTER_CLASSES_352,LETTER_PIN_LIMIT_352,LETTER_STACK_LIMIT_352,isLetter352,validLetters352,type ArchiveEntry352,type LetterClass352,type LetterTarget352} from '../../sim/letters-352.ts';
import {registeredMapId} from '../../sim/world-map-context.ts';

const classByDef=new Map(Object.entries(LETTER_CLASSES_352).map(([cls,v])=>[v.def,cls as LetterClass352]));
const clip=(s:string,n:number)=>s.length>n?s.slice(0,n-1)+'…':s;
const inline=(s:string)=>s.replace(/\(\*[^)]*\)|\(\/[A-Za-z]+\)/g,'');
const sourceKey=(n:XmlNode)=>{const id=text(n,'ID');return id?`${n.attrs?.Class==='Message'?'Message':'Letter'}_${id}`:undefined;};
/** Active letters and historical message copies are distinct source owners.
 * Rebase timestamps against the adopted local tick. Historical dates earlier
 * than the local epoch cannot yet be stored. Preserve order by id and report
 * the truncation rather than treating them as events that just occurred. */
export function importHistory(ctx:ImportContext):void {
 const {w,save,notes}=ctx,archive=items(save.game,'history/archive/archivables'),stack=items(save.game,'letterStack/letters');
 if(!archive.length&&!stack.length)return;
 const source=new Map<string,XmlNode>(),stackKeys:string[]=[],pinnedKeys=items(save.game,'history/archive/pinnedArchivables').map(n=>n.text.trim());
 for(const [index,n] of archive.entries()){
  // Core's ArchivedDialog has no Thing-style ID (e.g. opening scenario
  // dialogue), only its historical text; index is its original list key.
  const key=sourceKey(n)??(n.attrs?.Class==='ArchivedDialog'?`Dialog_${index}`:undefined);
  if(key)source.set(key,n);else notes.def('history','Archive sans identifiant','dropped');
 }
 for(const n of stack){const key=sourceKey(n)??n.text.trim();if(key){stackKeys.push(key);if(sourceKey(n))source.set(key,n);}}
 const ticks=(n:XmlNode)=>num(n,'arrivalTick')??num(n,'startingTick')??0;
 const nodes=[...source.entries()].sort((a,b)=>ticks(a[1])-ticks(b[1]));
 const entries:Array<{key:string;entry:ArchiveEntry352}>=[],mapId=registeredMapId(w);
 let next=1,dates=0,clipped=0,unmappedTarget=0;
 for(const [key,n] of nodes){
  notes.countBefore('history');
  const rawTick=Math.floor(ticks(n)/10);
  const tick=Math.max(0,Math.min(w.tick,rawTick));
  if(tick!==rawTick)dates++;
  const body=inline(text(n,'text')??'');
  if(n.attrs?.Class==='Message'){
   if(body.length>240)clipped++;
   entries.push({key,entry:{id:next++,tick,journal:'command',message:clip(body,240)}});
   notes.def('history','Message archivé','adapted','copie du journal','Catégories des messages et cibles non représentables par la copie du journal.');
  }else if(n.attrs?.Class==='ArchivedDialog'){
   if(body.length>1200)clipped++;
   entries.push({key,entry:{id:next++,tick,cls:'neutral',title:'Dialogue archivé',text:clip(body,1200),targets:[],read:true}});
   notes.def('history','Dialogue archivé','adapted','lettre neutre','Texte du dialogue conservé dans l’archive disponible.');
  }else{
   const cls=classByDef.get(text(n,'def')??''),label=inline(text(n,'label')??text(n,'title')??'');
   if(!cls||!label){
    notes.def('history',text(n,'def')??'Lettre inconnue','dropped',undefined,'Classe ou titre non représentable.');continue;
   }
   if(label.length>120||body.length>1200)clipped++;
   const targets:LetterTarget352[]=[];
   for(const t of items(n,'lookTargets/targets')){
    const raw=t.text.trim(),id=ctx.thingIds.get(raw.replace(/^Thing_/,''));if(raw==='null'||!raw)continue;
    if(id!==undefined&&(w.pawns.some(p=>p.id===id)||w.wildlife?.animals.some(a=>a.id===id)))targets.push({kind:'actor',id});
    else{
     const entity=w.structures.find(s=>s.id===id)??w.resources.find(r=>r.id===id),pile=w.piles.find(p=>p.id===id);
     const at=entity??(pile?.owner.type==='ground'?pile.owner:undefined);
     if(at)targets.push({kind:'cell',x:at.x,z:at.z});else unmappedTarget++;
    }
   }
   if(targets.length>12)unmappedTarget+=targets.length-12;
   entries.push({key,entry:{id:next++,tick,cls,title:clip(label,120),text:clip(body,1200),targets:targets.slice(0,12),
    ...mapId!==undefined&&targets.length?{mapId}:{},...stackKeys.includes(key)?{}:{read:true as const}}});
   notes.def('history','Lettre archivée','adapted',cls,'Classe et texte repris ; date historique et liens uniquement dans les limites du modèle.');
  }
 }
 const byKey=new Map(entries.map(e=>[e.key,e.entry]));
 const stackIds=[...new Set(stackKeys.map(k=>byKey.get(k)).filter((e):e is ArchiveEntry352=>!!e).filter(isLetter352).map(e=>e.id))].slice(-LETTER_STACK_LIMIT_352);
 const pinned=[...new Set(pinnedKeys.map(k=>byKey.get(k)?.id).filter((id):id is number=>id!==undefined))].slice(-LETTER_PIN_LIMIT_352);
 const keptAlways=new Set([...stackIds,...pinned]),cullable=entries.filter(e=>!keptAlways.has(e.entry.id)),discard=new Set(cullable.slice(0,Math.max(0,cullable.length-LETTER_ARCHIVE_LIMIT_352)).map(e=>e.entry.id));
 const retained=entries.map(e=>e.entry).filter(e=>!discard.has(e.id));
 w.letters352={revision:1,next,stack:stackIds,archive:retained,pinned};
 if(!validLetters352(w as unknown as Record<string,unknown>,w.schemaVersion)){
  delete w.letters352;notes.lost('history','Archive non admise par le validateur.');return;
 }
 notes.countAfter('history',retained.length);
 if(dates)notes.adapted('history',`${dates} dates antérieures au compteur local : ordre chronologique conservé, date absolue non reprise.`);
 if(clipped)notes.adapted('history',`${clipped} textes raccourcis pour respecter la limite du modèle.`);
 if(unmappedTarget)notes.lost('history',`${unmappedTarget} cibles historiques non résolues.`);
 if(discard.size)notes.lost('history',`${discard.size} archives au-delà de la capacité disponible.`);
}
