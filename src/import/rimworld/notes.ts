/** Counts and explanations gathered during analysis and conversion. */
import type {MappingStatus} from './mapping.ts';
import type {GapOrigin} from './gap-origin.ts';

export const FAMILIES=['world','factions','time','weather','terrain','snow','mineable-state','deep-resources','roofs','plants','plant-state','buildings','building-state','items','apparel','weapons','colonists','pawn-state','traits','backstories','skills','health','animals','zones','research','production','designations','active-jobs','reservations','social','policies','history'] as const;
export type Family=typeof FAMILIES[number];
export const FAMILY_LABELS:Readonly<Record<Family,string>>={world:'Monde',factions:'Factions',time:'Date et saison',terrain:'Terrain',roofs:'Toits',plants:'Plantes',
 buildings:'Bâtiments',items:'Objets et piles',apparel:'Vêtements',weapons:'Armes',colonists:'Colons et autres personnes',traits:'Traits',backstories:'Histoires',
 skills:'Compétences, passions et travaux',health:'Santé',animals:'Animaux',zones:'Zones et aires',research:'Recherche',
 weather:'Météo et climat',snow:'Neige','mineable-state':'État des roches et minerais','deep-resources':'Gisements souterrains','plant-state':'État des plantes','building-state':'État des bâtiments','pawn-state':'État individuel des colons',production:'Production',designations:'Ordres et plans','active-jobs':'Tâches en cours',reservations:'Réservations des tâches',social:'Relations et souvenirs',policies:'Politiques',history:'Historique et quêtes'};
export interface DefTally {def:string;status:MappingStatus;to?:string;note?:string;count:number;origin?:GapOrigin}
export interface Message {family:Family;kind:'mapped'|'adapted'|'lost';text:string}

export class ImportNotes {
 readonly tallies=new Map<Family,Map<string,DefTally>>();
 readonly messages:Message[]=[];
 /** Serious runtime limitations that must be visible before playing. */
 readonly warnings:string[]=[];
 /** Before/after counts per family (things in the save / things created). */
 readonly before=new Map<Family,number>();readonly after=new Map<Family,number>();
 def(family:Family,def:string,status:MappingStatus,to?:string,note?:string,count=1,origin?:GapOrigin):void {
  let table=this.tallies.get(family);if(!table)this.tallies.set(family,table=new Map());
  const key=`${def}→${to??''}|${status}`,row=table.get(key);
  // Keep individually established causes, rather than collapsing distinct
  // explanations for the same definition into whichever one arrived first.
  if(row&&row.note===note&&row.origin===origin)row.count+=count;
  else if(row){const specific=JSON.stringify([key,note,origin]),existing=table.get(specific);if(existing)existing.count+=count;else table.set(specific,{def,status,...to!==undefined?{to}:{},...note?{note}:{},...origin?{origin}:{},count});}
  else table.set(key,{def,status,...to!==undefined?{to}:{},...note?{note}:{},...origin?{origin}:{},count});
 }
 mapped(family:Family,text:string):void {this.messages.push({family,kind:'mapped',text});}
 adapted(family:Family,text:string):void {this.messages.push({family,kind:'adapted',text});}
 lost(family:Family,text:string):void {this.messages.push({family,kind:'lost',text});}
 countBefore(family:Family,n=1):void {this.before.set(family,(this.before.get(family)??0)+n);}
 countAfter(family:Family,n=1):void {this.after.set(family,(this.after.get(family)??0)+n);}
 /** Totals per status for a family. */
 summary(family:Family):Record<MappingStatus,number> {
  const out:Record<MappingStatus,number>={exact:0,adapted:0,dropped:0,unknown:0};
  for(const row of this.tallies.get(family)?.values()??[])out[row.status]+=row.count;return out;
 }
}
