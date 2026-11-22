/** Counts and explanations gathered during analysis and conversion. */
import type {MappingStatus} from './mapping.ts';

export const FAMILIES=['world','factions','time','terrain','roofs','plants','buildings','items','apparel','weapons','colonists','traits','backstories','skills','health','animals','zones','research'] as const;
export type Family=typeof FAMILIES[number];
export const FAMILY_LABELS:Readonly<Record<Family,string>>={world:'Monde',factions:'Factions',time:'Date et saison',terrain:'Terrain',roofs:'Toits',plants:'Plantes',
 buildings:'Bâtiments',items:'Objets et piles',apparel:'Vêtements',weapons:'Armes',colonists:'Colons et autres personnes',traits:'Traits',backstories:'Histoires',
 skills:'Compétences, passions et travaux',health:'Santé',animals:'Animaux',zones:'Zones et aires',research:'Recherche'};
export interface DefTally {def:string;status:MappingStatus;to?:string;note?:string;count:number}
export interface Message {family:Family;kind:'mapped'|'adapted'|'lost';text:string}

export class ImportNotes {
 readonly tallies=new Map<Family,Map<string,DefTally>>();
 readonly messages:Message[]=[];
 /** Before/after counts per family (things in the save / things created). */
 readonly before=new Map<Family,number>();readonly after=new Map<Family,number>();
 def(family:Family,def:string,status:MappingStatus,to?:string,note?:string,count=1):void {
  let table=this.tallies.get(family);if(!table)this.tallies.set(family,table=new Map());
  const key=`${def}→${to??''}|${status}`,row=table.get(key);
  if(row)row.count+=count;else table.set(key,{def,status,...to!==undefined?{to}:{},...note?{note}:{},count});
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
