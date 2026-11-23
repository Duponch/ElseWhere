import {DEV_ACTIONS,type DevAction} from '../sim/dev-actions';
import type {NativeControl,NativePage,NativeRow,NativeUiState} from './native-contract';

/** The developer window (docs/development/developer-mode.md): Core's
 * Dialog_Debug, tab Actions — actions grouped by category with a filter box —
 * built from the single registry (sim/dev-actions.ts). Presentation only: the
 * Run buttons hand the action and its chosen parameters to the host, which
 * sends the bridge command. */
export interface DevPanelView {search:string;args:Record<string,Record<string,string>>;collapsed:Set<string>}
export interface DevPanelHost {
  readonly view:DevPanelView;
  god():boolean;
  setGod(on:boolean):void;
  run(action:DevAction,args:Record<string,string>):void;
  /** The map action waiting for the next map click, if any. */
  armed():{action:DevAction;args:Record<string,string>}|undefined;
  cancelArmed():void;
  rebuild():void;
  close():void;
}
export const DEV_PANEL_ID='dev-panel';
const fold=(text:string):string=>text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

/** Target line: who the selection-based actions will act on. */
export function devTargetText(state:Pick<NativeUiState,'world'|'selectedPawnIds'|'selectedAnimalId'>):string {
  const world=state.world;if(!world)return 'Aucune partie';
  const pawn=state.selectedPawnIds.length?world.pawns.find(p=>p.id===state.selectedPawnIds[0]):undefined;
  if(pawn)return `${pawn.name} (colon)`;
  const animal=state.selectedAnimalId!==undefined?world.wildlife?.animals.find(a=>a.id===state.selectedAnimalId):undefined;
  return animal?`${animal.species} ${animal.id} (animal)`:'Aucune sélection : choisissez un colon ou un animal sur la carte';
}
/** The id an action addressed to the selection acts on (the Worker refuses an absent or wrong one, with its reason). */
export function devTargetId(state:Pick<NativeUiState,'selectedPawnIds'|'selectedAnimalId'>,target:DevAction['target']):number|undefined {
  if(target==='pawn')return state.selectedPawnIds[0];
  if(target==='animal')return state.selectedAnimalId;
  if(target==='creature')return state.selectedPawnIds[0]??state.selectedAnimalId;
  return undefined;
}
export const devActionArgs=(view:DevPanelView,action:DevAction):Record<string,string>=>({...Object.fromEntries((action.params??[]).map(p=>[p.key,p.default])),...view.args[action.id]});

export function buildNativeDevPanel(state:NativeUiState,host:DevPanelHost):NativePage {
  const view=host.view,query=fold(view.search.trim());
  const rows:NativeRow[]=[
    {id:'dev-target',label:'Cible',value:devTargetText(state),hint:'Les actions « sur la sélection » agissent sur le colon ou l’animal sélectionné.'},
    {id:'dev-god',label:'Mode divin',detail:'Construction instantanée et recherche immédiate pendant qu’il est actif (comme le mode divin du jeu de base).',
      controls:[{id:'dev-god-toggle',label:host.god()?'Activé':'Désactivé',active:host.god(),hint:'Construire d’un geste et finir la recherche choisie.',onActivate:()=>{host.setGod(!host.god());host.rebuild();}}]},
    {id:'dev-search',label:'Rechercher',input:{value:view.search,placeholder:'faim, soin, raid, météo…',maxLength:40,onCommit:value=>{view.search=value;host.rebuild();}}},
  ];
  const armed=host.armed();
  if(armed)rows.push({id:'dev-armed',label:'Outil armé',value:armed.action.label,detail:'Cliquez une case de la carte pour appliquer ; Échap pour terminer.',
    controls:[{id:'dev-armed-cancel',label:'Désarmer',onActivate:()=>{host.cancelArmed();host.rebuild();}}]});
  let shown=0;
  for(const group of [...new Set(DEV_ACTIONS.map(a=>a.group))]){
    const actions=DEV_ACTIONS.filter(a=>a.group===group&&(!query||fold(`${a.group} ${a.label} ${a.hint}`).includes(query)));
    if(!actions.length)continue;
    const folded=view.collapsed.has(group)&&!query;
    rows.push({id:`dev-group-${group}`,label:group,emphasis:'heading',
      controls:[{id:`dev-group-toggle-${group}`,label:folded?'Déplier':'Replier',onActivate:()=>{if(view.collapsed.has(group))view.collapsed.delete(group);else view.collapsed.add(group);host.rebuild();}}]});
    if(folded)continue;
    for(const action of actions){
      shown++;
      const args=devActionArgs(view,action);
      const controls:NativeControl[]=(action.params??[]).map(param=>({
        id:`dev-${action.id}-${param.key}`,label:`${param.label} : ${param.options.find(o=>o.value===args[param.key])?.label??args[param.key]}`,onActivate:()=>{},
        select:{value:args[param.key]!,options:param.options.map(o=>({value:o.value,label:o.label})),onChange:value=>{(view.args[action.id]??={})[param.key]=value;host.rebuild();}}}));
      const selection=action.target==='pawn'||action.target==='animal'||action.target==='creature';
      controls.push({id:`dev-run-${action.id}`,label:action.target==='cell'?'Choisir une case':selection?'Appliquer à la sélection':'Appliquer',hint:action.hint,
        active:armed?.action.id===action.id,onActivate:()=>host.run(action,devActionArgs(view,action))});
      rows.push({id:`dev-${action.id}`,label:action.label,detail:action.hint,controls});
    }
  }
  if(!shown)rows.push({id:'dev-empty',label:'Aucune action ne correspond à cette recherche.',emphasis:'muted'});
  return {id:DEV_PANEL_ID,title:'Mode développeur',subtitle:'Actions magiques pour tester les mécaniques. Chacune est un ordre ordinaire, joué par la simulation.',
    layout:'dialog',width:680,rows,contentKey:`dev-${query}`,onClose:host.close,
    actions:[{id:'dev-close',label:'Fermer',onActivate:host.close}]};
}
