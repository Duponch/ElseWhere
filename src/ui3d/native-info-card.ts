import type {NativeControl,NativePage,NativeRow} from './native-contract';
import {NATIVE_INFO} from './native-dialog-metrics';

export interface NativeInfoFact {id:string;category:string;label:string;value:string;explanation:string}
export type InfoSection='stats'|'bio'|'health';
export interface NativeInfoView {query:string;selected?:string;section:InfoSection}
export interface NativeInfoSource {
  id:string;title:string;description?:string;icon?:string;facts:readonly NativeInfoFact[];
  sections?:readonly {id:Exclude<InfoSection,'stats'>;label:string;rows:NativeRow[]}[];
  backId?:string;
}
interface Bindings {search:(value:string)=>boolean;select:(id:string)=>void;section:(id:InfoSection)=>void;back:()=>void}
const fold=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const queryWords=(query:string)=>fold(query).trim().split(/\s+/).filter(Boolean);
const unique=(values:readonly (string|undefined)[])=>[...new Set(values.filter((value):value is string=>!!value))].join('\n');
function categoryOf(row:NativeRow):string {
  const id=row.id;
  if(row.infoCategory)return row.infoCategory;
  if(/(^|-)capacity-|injury-|missing-|artificial-|health|condition|pain|blood|bleed|infection|pregnancy|death|clinical|anatomy|malnutrition|hypothermia|heatstroke|mech-part/.test(id))return 'Santé';
  if(/animal-(food|rest|daily-food)|need-/.test(id))return 'Besoins';
  if(/training-|tameness|animal-master|animal-area|animal-bed|animal-pen/.test(id))return 'Dressage et vie animale';
  if(/parents|animal-parent|animal-family|relation-/.test(id))return 'Relations';
  if(/power|battery|fuel|wind|breakdown|climate|solar|energy/.test(id))return 'Énergie et fonctionnement';
  if(/storage|shelf|stockpile|zone|filter/.test(id))return 'Stockage';
  if(/resource-growth|plant-|crop-|growing-|resource-harvest|growth/.test(id))return 'Croissance';
  if(/skill-|learning-|work-/.test(id))return 'Compétences et travail';
  if(/gear-|inventory-|packed-|armor|apparel|equipment/.test(id))return 'Équipement et possessions';
  if(/turret-|mech-ranged|ied-|firefoam/.test(id))return 'Fonctionnement';
  return 'Général';
}

/** Every entry comes from the original dossier. Presentation controls are
 * not duplicated here; the available value and its true hint are retained. */
export function infoFactsFromRows(rows:readonly NativeRow[]):NativeInfoFact[] {
  const ids=new Set<string>(),facts:NativeInfoFact[]=[];
  let section:string|undefined;
  for(const row of rows){
    if(row.emphasis==='heading'){section=row.label||section;continue;}
    if(!row.label||row.id==='inspector-feedback'||row.card||row.bio||row.gauges||ids.has(row.id))continue;
    const explicitPrefix=row.infoCategory&&row.label.startsWith(row.infoCategory+' · ')?row.infoCategory+' · ':'';
    const value=row.value??row.meter?.label??(row.meter?`${row.meter.value} / ${row.meter.max??1}`:'');
    const explanation=unique([row.detail,row.hint]);
    if(!value&&!explanation&&row.controls?.length)continue;
    ids.add(row.id);facts.push({id:row.id,category:row.infoCategory??section??categoryOf(row),label:explicitPrefix?row.label.slice(explicitPrefix.length):row.label,value,explanation});
  }
  return facts;
}
function factMatchesWords(fact:NativeInfoFact,words:readonly string[]):boolean {
  if(!words.length)return true;const haystack=fold([fact.category,fact.label,fact.value,fact.explanation].join(' '));return words.every(word=>haystack.includes(word));
}
export function infoFactMatches(fact:NativeInfoFact,query:string):boolean{return factMatchesWords(fact,queryWords(query));}
const button=(id:string,label:string,action:()=>void,hint?:string,active=false):NativeControl=>({id,label,onActivate:action,hint:hint??label,active});

/** Renderer-neutral information sheet. Search highlights matches like the
 * Core list, leaving all other facts present and muted, not destroyed. */
export function buildNativeInfoCard(source:NativeInfoSource,view:NativeInfoView,bindings:Bindings):NativePage {
  const sections=source.sections??[],requested=view.section==='stats'?undefined:sections.find(section=>section.id===view.section),section=requested?.id??'stats';
  const rows:NativeRow[]=[];
  if(sections.length)rows.push({id:'info-tabs',label:'',region:'navigation',controlStyle:'tab',controls:[{id:'stats' as const,label:'Statistiques'},...sections].map(tab=>button(`info-tab-${tab.id}`,tab.label,()=>bindings.section(tab.id),undefined,section===tab.id))});
  let selectedId:string|undefined,focusRow:string|undefined;
  if(section==='stats'){
    const facts:NativeInfoFact[]=[...(source.description?[{id:'info-description',category:'Général',label:'Description',value:'',explanation:source.description}]:[]),...source.facts];
    const categories=new Map<string,NativeInfoFact[]>();for(const fact of facts){const group=categories.get(fact.category)??[];group.push(fact);categories.set(fact.category,group);}
    const words=queryWords(view.query),active=words.length>0,matches=new Set(active?facts.filter(fact=>factMatchesWords(fact,words)).map(fact=>fact.id):[]);
    const displayed=[...categories.values()].flat();
    const first=active?displayed.find(fact=>matches.has(fact.id)):displayed[0];
    const selected=facts.find(fact=>fact.id===view.selected)??first;selectedId=selected?.id;
    if(active&&matches.size)focusRow=first?.id;
    let index=0;
    for(const [category,group]of categories){
      rows.push({id:`info-category-${index++}`,label:category,region:'catalogue',infoHeading:true});
      for(const fact of group){const chosen=fact.id===selectedId,hint=unique([fact.label,fact.value,fact.explanation]);rows.push({id:fact.id,label:fact.label,value:fact.value,infoCategory:fact.category,region:'catalogue',infoEntry:{selected:chosen,match:active?matches.has(fact.id)?'match':'muted':'normal'},hint,controls:[button(`info-stat-${fact.id}`,fact.label,()=>bindings.select(fact.id),hint,chosen)]});}
    }
    if(!facts.length)rows.push({id:'info-empty',label:'Aucune caractéristique disponible.',region:'catalogue'});
    if(selected){
      rows.push({id:'info-explanation-title',label:selected.label,emphasis:'heading',region:'details'});
      if(selected.value)rows.push({id:'info-explanation-value',label:'Valeur actuelle',value:selected.value,region:'details'});
      if(selected.explanation)rows.push({id:'info-explanation-text',label:selected.explanation,region:'details'});
      else rows.push({id:'info-explanation-text',label:'Aucune explication supplémentaire enregistrée pour cette donnée.',region:'details'});
    }else rows.push({id:'info-explanation-text',label:active?'Aucune statistique ne correspond à la recherche. Tous les faits restent dans la liste.':'Aucune statistique disponible pour cet élément.',region:'details'});
    rows.push({id:'info-search',label:'Rechercher une statistique',region:'toolbar',hint:active?`${matches.size} résultat(s) sur ${facts.length}`:'Rechercher dans les caractéristiques et leurs explications.',input:{value:view.query,placeholder:'Rechercher une statistique',maxLength:160,onChange:bindings.search,onCommit:bindings.search},controls:view.query?[{...button('info-search-clear','Effacer',()=>bindings.search(''),'Effacer la recherche'),icon:'cancel',presentation:'icon'}]:undefined});
  }else if(requested)rows.push(...requested.rows.map(row=>({...row,region:'details' as const})));
  return {id:source.id,title:source.title,layout:'info',modal:true,width:NATIVE_INFO.width,height:NATIVE_INFO.height,infoCard:{section,icon:source.icon,focusRow},contentKey:JSON.stringify([section,view.query]),detailsKey:selectedId??section,rows,
    actions:[button(source.backId??'info-back','Retour',bindings.back,'Revenir à la sélection et à son onglet')],onClose:bindings.back,closeOwnsNavigation:true};
}
