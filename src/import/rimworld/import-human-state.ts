/** Stored individual human state that the current simulation can own. */
import type {Pawn} from '../../sim/types.ts';
import type {XmlNode} from './xml.ts';
import {at,items,text,num} from './xml.ts';
import type {ImportContext} from './convert.ts';
import {HAIR_STYLES,BEARD_STYLES,SKIN_COLORS,HAIR_COLORS} from '../../sim/pawn-appearance.ts';
import {validNativeHumanIdentity256,validHumanAgeForPawn256,type NativeHumanIdentity256} from '../../sim/native-human-identity-256.ts';
import {nativeHumanHealthScaleForCore256} from '../../sim/native-human-clinical-scale-256.ts';
import {ancientHumanNameLabel256} from '../../sim/ancient-human-name-256.ts';
import {validPawnNameInput378} from '../../sim/pawn-identity-state-378.ts';
import {validatePawnHealthRecord} from '../../sim/health-save.ts';
import {HUMAN_YEAR_TICKS} from '../../sim/human-age.ts';
import type {MedicalCare} from '../../sim/medicine-rules.ts';
import {validSchedule,type ScheduleAssignment} from '../../sim/schedule.ts';
import {outdoorsNeedApplies359} from '../../sim/outdoors-need-359.ts';
import {indoorsNeedApplies362} from '../../sim/indoors-need-362.ts';
import {spacePerceptibleNow345} from '../../sim/room-size-need-345.ts';
import {RoomTopologyCache,type RoomTopology} from '../../sim/room-topology.ts';

const careMap:Readonly<Record<string,MedicalCare>>={NoCare:'none',NoMeds:'dry',HerbalOrWorse:'herbal',NormalOrWorse:'industrial',Best:'best'};
const scheduleMap:Readonly<Record<string,ScheduleAssignment>>={Anything:'anything',Work:'work',Sleep:'sleep',Joy:'recreation'};
const meter=(n:number)=>Math.max(0,Math.min(1,n));
const topologies=new WeakMap<ImportContext,RoomTopology>();
const color=(v:string|undefined):number|undefined=>{
 const m=v&&/RGBA\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(v);
 if(!m)return undefined;
 const c=(s:string)=>Math.round(meter(Number(s))*255);
 return c(m[1]!)<<16|c(m[2]!)<<8|c(m[3]!);
};

/** Exact native name components require the actual native human clinical
 * owner as well. We attach both only when admitted; never label a synthetic
 * name a native one, or replace an age ailment with a false clinical scale. */
export function importHumanName(ctx:ImportContext,p:Pawn,node:XmlNode):void {
 const {w,notes}=ctx,source=text(node,'ageTracker/ageBiologicalTicks'),core=Number(source);
 const first=text(node,'name/first'),last=text(node,'name/last'),nick=text(node,'name/nick');
 const title=text(node,'story/title');
 if(title){
  if(validPawnNameInput378(title)){p.identity378={revision:1,title};notes.def('pawn-state','Titre personnalisé','exact','titre');}
  else notes.def('pawn-state','Titre personnalisé','dropped',undefined,'Titre non admis par les règles actuelles (16 caractères et alphabet des noms).');
 }
 if(!first||!last||!nick||!Number.isSafeInteger(core)||core<13*HUMAN_YEAR_TICKS*10||!p.health||p.health.ageAilments?.length)return;
 const gender=text(node,'gender')==='Female'?'Female':text(node,'gender')==='None'?'None':'Male';
 const sourceId=Number(/^Human(\d+)$/.exec(text(node,'id')??'')?.[1]);
 const native:NativeHumanIdentity256={revision:1,gender,name:{first,last,nick,nickSet:!!nick},biologicalCoreRemainder:core%10,...w.schemaVersion>=382&&Number.isInteger(sourceId)&&sourceId>0&&sourceId<=2147483647?{sourceThingId382:sourceId}:{}};
 const name=ancientHumanNameLabel256(native.name);
 if(!validNativeHumanIdentity256(native)||name.length>80)return;
 const oldName=p.name,oldAge=p.age;
 const bio=Math.floor(core/10),birth=num(node,'ageTracker/birthAbsTicks');
 const chronological=birth===undefined?bio:Math.floor((ctx.save.gameStartAbsTick+ctx.save.ticksGame-birth)/10);
 p.nativeHuman=native;p.name=name;p.age={biologicalTicks:bio,chronologicalTicks:Math.max(bio,chronological)};
 p.health.humanHealthScale=nativeHumanHealthScaleForCore256(core);
 if(!validHumanAgeForPawn256(p,w.schemaVersion)||validatePawnHealthRecord(p,w).length){
  delete p.nativeHuman;delete p.health.humanHealthScale;p.name=oldName;p.age=oldAge;
  notes.def('pawn-state','Identité structurée','dropped',undefined,'Le nom reste sous forme de texte : dossier clinique natif incompatible.');
 }else notes.def('pawn-state','Identité structurée','exact','nom, prénom, surnom et âge biologique Core');
}

export function importHumanAppearance(ctx:ImportContext,p:Pawn,node:XmlNode):void {
 if(!p.appearance)return;
 const {notes}=ctx,a=p.appearance,female=text(node,'gender')==='Female';
 a.sex=female?'female':'male';
 const body=text(node,'story/bodyType');a.bodyType=(body==='Thin'||body==='Hulk'||body==='Fat'?body:female?'Female':'Male') as typeof a.bodyType;
 const head=text(node,'story/headType');a.headType=(head&&new RegExp(`^${female?'Female':'Male'}_(Average|Narrow)(Normal|Pointy|Wide)$`).test(head)?head:`${female?'Female':'Male'}_AverageNormal`) as typeof a.headType;
 if(body&&body!==a.bodyType)notes.def('pawn-state',`Corps : ${body}`,'adapted',a.bodyType);
 if(head&&head!==a.headType)notes.def('pawn-state',`Visage : ${head}`,'adapted',a.headType);
 const hair=text(node,'story/hairDef');
 if(hair){
  const found=HAIR_STYLES.find(h=>h.id===hair);
  if(found){a.hair=found.id;notes.def('pawn-state',`Cheveux : ${hair}`,'exact',hair);}
  else notes.def('pawn-state',`Cheveux : ${hair}`,'adapted',a.hair,'Coiffure absente du catalogue : apparence de repli.');
 }
 const b=text(node,'style/beardDef')??'NoBeard',beard=BEARD_STYLES.find(row=>row.id===b&&(!female||row.id==='NoBeard'));
 // The save's distinction between no beard and no saved override is Core's
 // default NoBeard, never the generated beard of an unrelated starting pawn.
 a.beard=beard?.id??'NoBeard';
 notes.def('pawn-state',`Barbe : ${b}`,beard?'exact':'adapted',a.beard,beard?undefined:'Style de barbe absent ou non admis pour cette apparence.');
 // Core persists the base melanin gene even without Biotech. The installed
 // Core definitions and existing nine SKIN_COLORS rows have the same order
 // (Skin_Melanin1..9). A cosmetic override takes precedence over the gene.
 const genes=[...items(node,'genes/endogenes'),...items(node,'genes/xenogenes')].filter(g=>!text(g,'overriddenByGene')).map(g=>text(g,'def')??'');
 const hairColor=color(text(node,'story/hairColor'));
 if(hairColor!==undefined)a.hairColor=hairColor;
 else {const gene=HAIR_COLORS.find(g=>genes.includes(g.id));if(gene){a.hairColor=gene.color;notes.def('pawn-state','Couleur des cheveux','adapted',gene.id,'Couleur de base du gène sans variation enregistrée.');}}
 const skin=color(text(node,'story/skinColorOverride')??text(node,'story/skinColorBase')??text(node,'story/skinColor'));
 const melanin=genes.filter(g=>/^Skin_Melanin[1-9]$/.test(g));
 if(skin!==undefined){a.skinColor=skin;notes.def('pawn-state','Couleur de peau','exact','couleur explicite');}
 else if(melanin.length===1){a.skinColor=SKIN_COLORS[Number(melanin[0]!.at(-1))-1]!.color;notes.def('pawn-state','Couleur de peau','exact',melanin[0]);}
 else notes.def('pawn-state','Couleur de peau','adapted',undefined,'Aucune couleur explicite ni gène mélanine unique lisible dans le dossier source : repli visuel.');
}

export function importHumanNeeds(ctx:ImportContext,p:Pawn,node:XmlNode,detached=false):void {
 const {notes,w}=ctx;
 const care=text(node,'playerSettings/medCare');
 if(care&&careMap[care]){p.medicalCare=careMap[care];notes.def('policies',`Soins : ${care}`,'exact',p.medicalCare);}
 else if(care)notes.def('policies',`Soins : ${care}`,'dropped',undefined,'Politique médicale inconnue.');
 if(text(node,'playerSettings/selfTend')==='True')p.selfTend=true;else delete p.selfTend;
 const hostility=text(node,'playerSettings/hostilityResponse')??text(node,'drafter/hostilityResponse');
 if(hostility==='Attack')p.hostilityResponse='attack';else if(hostility==='Ignore')p.hostilityResponse='ignore';else if(hostility==='Flee')delete p.hostilityResponse;
 const schedule:unknown[]=items(node,'timetable/times').map(n=>scheduleMap[n.text.trim()]);
 if(validSchedule(schedule)){p.schedule=schedule;notes.def('policies','Emploi du temps','exact','24 heures');}
 else if(schedule.length)notes.def('policies','Emploi du temps','dropped',undefined,'Une plage horaire n’a pas d’équivalent ou les 24 heures ne sont pas lisibles.');
 for(const n of items(node,'needs/needs')){
  const def=text(n,'def'),level=num(n,'curLevel');if(level===undefined)continue;const pct=meter(level)*100;
  if(def==='Food')p.hunger=pct;else if(def==='Rest')p.rest=pct;else if(def==='Mood')p.mood=pct;else if(def==='Comfort')p.comfort=pct;else if(def==='Beauty')p.beauty=pct;
  else if(def==='Outdoors'&&outdoorsNeedApplies359(p)){p.outdoors359=Math.fround(meter(level));notes.def('pawn-state','Plein air','exact','besoin');}
  else if(def==='Indoors'&&indoorsNeedApplies362(p)){p.indoors362=Math.fround(meter(level));notes.def('pawn-state','Intérieur','exact','besoin');}
  else if(def==='RoomSize'){
   let indoors=false;
   if(!detached){let topology=topologies.get(ctx);if(!topology){topology=new RoomTopologyCache().read(w);topologies.set(ctx,topology);}indoors=spacePerceptibleNow345(w,p,topology).indoors;}
   p.roomSize345={level:Math.fround(meter(level)),indoors};
   notes.def('pawn-state','Besoin d’espace','adapted','niveau du besoin','Niveau repris ; intérieur/extérieur recalculé depuis la carte importée.');
  }else if(def==='Joy'){
   p.recreation.level=pct;
   // Core 1.6 JoyKinds.xml DefMap order, only the seven categories with
   // physical activities in Elsewhere. Refuse unexpected lengths rather
   // than mislabel a different definition order.
   const tolerances=items(at(n,'tolerances'),'vals'),bored=items(at(n,'bored'),'vals');
   if(tolerances.length===10&&bored.length===10){
    const kinds=['solitary','social','dexterity','cerebral','television',null,null,'chemical',null,'reading'] as const;
    for(let i=0;i<kinds.length;i++){
     const k=kinds[i],v=num(tolerances[i]);if(!k||v===undefined)continue;
     const value=meter(v)*100,raw=bored[i]?.text.trim()==='True';
     p.recreation.tolerance[k]=value;p.recreation.bored[k]=value>50?true:value<30?false:raw;
    }
    notes.def('pawn-state','Tolérance aux loisirs','adapted','sept catégories','Sept catégories reprises ; télescope, musique et gloutonnerie ne sont pas représentés.');
   }
  }else if(def)notes.def('pawn-state',`Besoin : ${def}`,'dropped',undefined,'Besoin absent ou incompatible avec le modèle du colon actuel.');
 }
}
