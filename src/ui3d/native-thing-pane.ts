import type {NativeControl,NativePage,NativeRow} from './native-contract';

/** The inspect pane of anything that is not a colonist or a prisoner (RimWorld
 * `InspectPaneUtility`, `InspectPaneFiller`, `GizmoGridDrawer`, `ITab`): the
 * name, the hit points bar and the inspect string in the 432 × 165 pane, the
 * 72 × 30 tabs of the thing, the 75 × 75 gizmos right of the pane and the info
 * card behind the (i) button. The inspector builds its dossier rows as before
 * (they are the data); this module only sorts them into those places, so that
 * no row, no control and no command is lost: a row that holds controls becomes
 * gizmos, the rest of the facts go to the info card, a few of them are copied
 * as inspect lines. Pure: no command, no control is created here except through
 * the factory given. */
export type PaneGauge=NonNullable<NativeRow['gauges']>[number];
export interface PaneLine {id:string;text:string;hint?:string}
export interface PaneTab {id:string;label:string;hint:string;width:number;height:number;margin:number;rows:()=>NativeRow[]}
export interface PaneSpec {gauges?:PaneGauge[];lines?:PaneLine[];tabs?:PaneTab[];/** Rows the pane already shows in a gauge or a tab: they stay on the info card but make no gizmo. */consumed?:readonly string[]}
export type PaneControlFactory=(id:string,label:string,action:()=>unknown,disabled?:boolean,active?:boolean,hint?:string)=>NativeControl;

/** A row whose only meaning is its controls (a toggle, a choice, a command). */
export function isGizmoRow(row:NativeRow):boolean {
  return !!row.controls?.length&&!row.input&&!row.meter&&!row.tree&&!row.card&&!row.bio&&!row.columns&&!row.gauges&&!row.inspectPane&&row.id!=='inspector-feedback';
}
const GENERIC_LABEL=/^(Activer|Désactiver|Choisir|Inspecter|Ajouter|Retirer|Autoriser|Interdire)$/;
/** `Command_Toggle` / `Command_Action` of a row: the row's name on the tile and
 * its state in the corner. Controls with their own words keep them. */
export function gizmosFromRow(row:NativeRow):NativeControl[] {
  const controls=row.controls??[],single=controls.length===1;
  return controls.map(control=>{
    const label=single?(control.select||GENERIC_LABEL.test(control.label)||!control.label?row.label||control.label:control.label):control.label;
    const state=row.value&&single?row.value:undefined;
    const hint=[row.label&&row.value?`${row.label} : ${row.value}`:row.label,control.hint&&control.hint!==control.label&&control.hint!==label?control.hint:undefined].filter(Boolean).join('\n\n')||control.hint;
    return {...control,label:label||control.label,caption:control.caption??(state&&state.length<=9?state:undefined),hint};
  });
}
/** `Thing.HitPoints` bar (`InspectPaneFiller.DrawHealth`): white when whole,
 * yellow above half, red above zero, grey at zero. */
export function hitPointGauge(id:string,current:number,max:number,hint?:string):PaneGauge {
  const fill=max>0?Math.max(0,Math.min(1,current/max)):0;
  const color=current>=max?'#bdb39c':current>max*.5?'#d2bb62':current>0?'#c4806a':'#9a9a9a';
  return {id,label:`${Math.round(current)} / ${Math.round(max)}`,fill,color,hint:hint??`Points de vie : ${Math.round(current)} / ${Math.round(max)}`};
}
export function lineOfRow(row:NativeRow):string|undefined {
  if(row.value&&row.label)return `${row.label} : ${row.value}`;
  return row.value??row.label??undefined;
}
/** `label · detail · detail` texts the dossier used for a whole row. */
export function partsOf(text:string|undefined,count:number):string[] {
  return (text??'').split(' · ').map(part=>part.trim()).filter(Boolean).slice(0,count);
}
export interface ComposeOptions {page:NativePage;spec:PaneSpec;activeTab:string|null;control:PaneControlFactory;toggleTab:(id:string)=>void;openInfo:()=>void}
export function composeThingPane(options:ComposeOptions):NativePage {
  const {page,spec}=options,old=page.rows;
  const consumed=new Set(spec.consumed??[]),gizmoRows=old.filter(row=>isGizmoRow(row)&&!consumed.has(row.id));
  const infoRows=old.filter(row=>(!isGizmoRow(row)||consumed.has(row.id))&&row.id!=='inspector-feedback');
  const tabs=spec.tabs??[],active=tabs.find(tab=>tab.id===options.activeTab);
  const rows:NativeRow[]=[{id:'pawn-tabs',label:'',region:'navigation',compact:true,controls:tabs.map(tab=>options.control(`pane-tab-${tab.id}`,tab.label,()=>options.toggleTab(tab.id),false,tab.id===options.activeTab,tab.hint))}];
  if(spec.gauges?.length)rows.push({id:'pane-gauges',label:'',inspectPane:true,gauges:spec.gauges});
  const feedback=old.find(row=>row.id==='inspector-feedback');
  if(feedback)rows.push({...feedback,region:undefined,compact:undefined,presentation:undefined,inspectPane:true});
  for(const line of spec.lines??[])rows.push({id:`pane-line-${line.id}`,label:'',value:line.text,hint:line.hint,inspectPane:true});
  // A tab's rows flow in the window's width: a long `detail` is a tooltip (as the dossier already folds it), never a second line under the row.
  if(active)rows.push(...active.rows().map(row=>{
    const {detail,...rest}=row,hint=[row.hint,detail].filter(Boolean).join(' · ')||undefined;
    return {...rest,hint,region:undefined,controls:hint?row.controls?.map(control=>({...control,hint:[control.hint,hint].filter(Boolean).join(' · ')})):row.controls};
  }));
  // A map-object command keeps the icon of its designation (`object-action-chop` draws the axe).
  const withIcon=(control:NativeControl):NativeControl=>control.icon||!control.id.startsWith('object-action-')?control:{...control,icon:control.id.slice('object-action-'.length)};
  const gizmos=[...(page.actions??[]).filter(action=>!action.id.startsWith('inspect-')),...gizmoRows.flatMap(gizmosFromRow)].map(withIcon);
  const info=options.control('inspect-info','i',options.openInfo,false,false,'Informations : toutes les caractéristiques de cet élément');
  const result:NativePage={...page,rows,actions:[...gizmos,info],layout:'inspector',width:undefined,height:undefined,columnRatio:undefined,
    inspectInfo:infoRows,id:`${page.id}-${active?.id??'pane'}`};
  if(active){
    result.inspectTab={id:active.id,width:active.width,height:active.height,margin:active.margin};
    result.actions!.push(options.control('inspect-tab-close','Fermer l’onglet',()=>options.toggleTab(active.id),false,false,'Fermer l’onglet'));
  }
  return result;
}

const HP_ROWS=new Set(['structure-condition','pile-condition','resource-hp','rock-hp','packed-health']);
/** Dossier rows that Core prints in the inspect string (`GetInspectString` of
 * the thing and its comps), and how many of their parts fit the pane. A row
 * given as a number uses its tooltip text split at « · ». */
const LINE_RULES:Record<string,number|'row'>={
  'structure-quality':'row','battery-energy':'row','fuel-reserve':'row','breakdown':'row','wind-output':'row','turret-ammo':'row','turret-phase':'row','climate-target':'row',
  'power-details':2,'brewing-details':2,'egg-box-content':3,'tool-cabinet-links':2,'resource-growth':4,
  'corpse-stage':'row','equipment-permission-state':'row','egg-permission-state':'row','pen-region':'row','special-crop-species':'row','growing-size':'row',
  'plan-size':'row','plan-total':'row','plan-color':'row','packed-label':'row','packed-quality':'row','job-kind':'row','job-state':'row','job-worker':'row','job-materials':'row',
  'turret-target':'row','ied-trap-effect':'row','ied-trap-wick':'row','firefoam-spec':'row','firefoam-wick':'row','special-ship-fixed':'row','special-ship-transmitter':'row',
};
/** The hit points gauge and the inspect lines of an object's dossier rows. */
export function objectPaneParts(rows:readonly NativeRow[]):{gauges:PaneGauge[];lines:PaneLine[]} {
  const gauges:PaneGauge[]=[],lines:PaneLine[]=[];
  let facts=0;
  for(const row of rows){
    if(HP_ROWS.has(row.id)&&row.meter){gauges.push(hitPointGauge(row.id,row.meter.value,row.meter.max??1,`${row.label} : ${row.value??''}`));continue;}
    if(/^group-\d+$/.test(row.id)){lines.push({id:row.id,text:row.value?`${row.label} ×${row.value}`:row.label});continue;}
    if(/^cell-fact-\d+$/.test(row.id)){if(facts++<4){const text=lineOfRow(row);if(text)lines.push({id:row.id,text,hint:row.hint});}continue;}
    if(/^cell-thing-\d+$/.test(row.id)){lines.push({id:row.id,text:row.label,hint:row.hint});continue;}
    const rule=LINE_RULES[row.id];if(rule===undefined)continue;
    if(rule==='row'){const text=lineOfRow(row);if(text)lines.push({id:row.id,text,hint:row.hint});}
    else partsOf(row.hint,rule).forEach((part,index)=>lines.push({id:`${row.id}-${index}`,text:part,hint:row.hint}));
  }
  return {gauges,lines};
}
