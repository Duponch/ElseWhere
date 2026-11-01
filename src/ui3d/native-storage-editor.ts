import type {NativeControl, NativePage, NativeRow} from './native-contract';
import type {StorageControlSettings} from '../ui/storage-item-controls';
import {
  STORAGE_FILTER_TREE, storageTreeSelection, storageTreePermissions,
  storageSearchNodes, storageNodeState, storageNodeLeaves, setStorageNode, STORAGE_LEAVES, type StorageFilterNode, type StorageLeafId,
} from '../ui/storage-filter-tree';
import {WEAPON_QUALITIES, QUALITY_LABELS, type WeaponQuality} from '../sim/equipment-rules';

export interface NativeStorageEditorOptions {
  id:string;
  title:string;
  initial:StorageControlSettings;
  show:(page:NativePage)=>void;
  onApply:(settings:StorageControlSettings)=>void|Promise<unknown>;
  onBack:()=>void;
  applyLabel?:string;
}

export interface NativeStorageTreeOptions {
  id:string;
  selected:ReadonlySet<StorageLeafId>;
  expanded:ReadonlySet<string>;
  search:string;
  disabled?:boolean;
  fixedAllows?:(item:StorageLeafId)=>boolean;
  onExpand:(id:string)=>void;
  onToggle:(node:StorageFilterNode,state:'all'|'none'|'mixed',allowed:readonly StorageLeafId[])=>void|Promise<unknown>;
}

/** Pure projection: never writes to selected/expanded or sends a command.
 * The caller commits only allowed leaves against its own fresh policy. */
export function nativeStorageTreeRows(options:NativeStorageTreeOptions):NativeRow[] {
  const {selected,expanded}=options,rows:NativeRow[]=[];
  const searching=options.search.trim().length>0;
  const visible=searching?storageSearchNodes(options.search):undefined;
  const id=(suffix:string)=>`${options.id}-${suffix}`;
  function visit(node:StorageFilterNode,depth:number,path:string):void {
    if(visible&&!visible.has(node.id))return;
    const leaves=storageNodeLeaves(node),allowed=options.fixedAllows?leaves.filter(options.fixedAllows):leaves;
    const count=allowed.filter(leaf=>selected.has(leaf)).length;
    const state=options.fixedAllows?(count===0?'none':count===allowed.length?'all':'mixed'):storageNodeState(node,selected);
    const branch=!!node.children?.length,open=branch&&(searching||expanded.has(node.id));
    const unavailable=allowed.length===0,disabled=!!options.disabled||unavailable;
    const name=path?`${path} → ${node.label}`:node.label;
    const status=unavailable?'Exclusion physique de ce stockage':state==='all'?'Tout autorisé':state==='none'?'Tout interdit':'Partiellement autorisé';
    const controls:NativeControl[]=[];
    if(branch)controls.push({id:id(`node-${node.id}-expand`),label:`${open?'Replier':'Déplier'} ${name}`,glyph:open?'collapse':'expand',onActivate:()=>{if(!disabled&&!searching)options.onExpand(node.id);},
      disabled:disabled||searching,hint:searching?`${name} · déplié par la recherche`:`${open?'Replier':'Déplier'} ${name}`,active:open});
    controls.push({id:id(`node-${node.id}-permission`),label:`${state==='all'?'Interdire':'Autoriser'} ${name}`,glyph:state==='all'?'allow':state==='none'?'forbid':'mixed',onActivate:()=>{if(!disabled)return options.onToggle(node,state,allowed);},
      disabled,active:state==='all',hint:`${name} · ${status}${unavailable?'':` · ${state==='all'?'Interdire':'Autoriser'} ce groupe ou cet objet`}`});
    rows.push({id:id(`node-${node.id}`),label:node.label,hint:`${name} · ${status}`,region:'catalogue',compact:true,presentation:'plain',tree:{depth,state,branch,expanded:open},controls});
    if(open)for(const child of node.children??[])visit(child,depth+1,name);
  }
  for(const node of STORAGE_FILTER_TREE)visit(node,0,'');
  if(!rows.length)rows.push({id:id('empty'),label:'Aucun objet ni catégorie correspondant.',region:'catalogue',compact:true,presentation:'plain'});
  return rows;
}

/** Presentation draft only. The caller owns permission checks and any command.
 * Requires NativePage.layout:'storage' and NativeRow.tree in native-contract.
 * details/navigation/actions stay fixed; only catalogue is vertically scrolled.
 */
export function createNativeStorageEditor(options:NativeStorageEditorOptions):NativePage {
  const selected=storageTreeSelection(options.initial.filters,options.initial.items);
  const expanded=new Set<string>();
  let search='',priority=options.initial.priority;
  let allowFresh=options.initial.allowFresh!==false,allowRotten=options.initial.allowRotten!==false;
  let qualityStored=!!options.initial.quality,hpStored=!!options.initial.hitPoints;
  let minQuality=options.initial.quality?.min??WEAPON_QUALITIES[0]!;
  let maxQuality=options.initial.quality?.max??WEAPON_QUALITIES[WEAPON_QUALITIES.length-1]!;
  let minHp=options.initial.hitPoints?.min??0,maxHp=options.initial.hitPoints?.max??100;
  let applying=false;
  const id=(suffix:string)=>`${options.id}-${suffix}`;
  const redraw=()=>options.show(make());
  const control=(suffix:string,label:string,onActivate:NativeControl['onActivate'],extra:Partial<NativeControl>={}):NativeControl=>({id:id(suffix),label,onActivate,...extra});
  function change(write:()=>void):void {if(applying)return;write();redraw();}
  function readPercentage(value:string):number {
    const number=Number(value);
    if(!value.trim()||!Number.isInteger(number)||number<0||number>100)throw Error('Pourcentage entier de 0 à 100 requis.');
    return number;
  }
  function settings():StorageControlSettings {
    if(!Number.isInteger(priority)||priority<1||priority>5)throw Error('Priorité entière de 1 à 5 requise.');
    if(qualityStored&&(WEAPON_QUALITIES.indexOf(minQuality)<0||WEAPON_QUALITIES.indexOf(maxQuality)<0||WEAPON_QUALITIES.indexOf(minQuality)>WEAPON_QUALITIES.indexOf(maxQuality)))throw Error('La qualité minimale doit être inférieure ou égale à la qualité maximale.');
    if(hpStored){readPercentage(String(minHp));readPercentage(String(maxHp));if(minHp>maxHp)throw Error('Le minimum de points de vie doit être inférieur ou égal au maximum.');}
    return {
      ...storageTreePermissions(selected),priority,allowFresh,allowRotten,
      ...(qualityStored?{quality:{min:minQuality,max:maxQuality}}:{}),
      ...(hpStored?{hitPoints:{min:minHp,max:maxHp}}:{}),
    };
  }
  function qualityControl(bound:'min'|'max'):NativeControl {
    const value=bound==='min'?minQuality:maxQuality;
    return control(`quality-${bound}`,QUALITY_LABELS[value],()=>{}, {
      hint:`Qualité ${bound==='min'?'minimale':'maximale'}`,caption:bound==='min'?'Minimum':'Maximum',disabled:applying,
      select:{value,options:WEAPON_QUALITIES.map(value=>({value,label:QUALITY_LABELS[value]})),onChange:value=>{
        if(!WEAPON_QUALITIES.includes(value as WeaponQuality))throw Error('Choisissez une qualité valide.');
        if(value===(bound==='min'?minQuality:maxQuality))return;
        change(()=>{qualityStored=true;if(bound==='min')minQuality=value as WeaponQuality;else maxQuality=value as WeaponQuality;});
      }},
    });
  }
  function make():NativePage {
    const details=(suffix:string,label:string,controls:NativeControl[]):NativeRow=>({id:id(suffix),label,region:'details',compact:true,presentation:'plain',controls});
    const rows:NativeRow[]=[
      details('priority','Priorité',[control('priority-select',(['','Basse','Normale','Préférée','Importante','Critique'][priority]??String(priority)),()=>{}, {hint:'Priorité du stockage',disabled:applying,select:{value:String(priority),options:([[1,'Basse'],[2,'Normale'],[3,'Préférée'],[4,'Importante'],[5,'Critique']] as const).map(([value,label])=>({value:String(value),label})),onChange:value=>{
        const next=Number(value);if(!Number.isInteger(next)||next<1||next>5)throw Error('Priorité entière de 1 à 5 requise.');change(()=>{priority=next;});
      }}})]),
      details('freshness','Conservation',[
        control('fresh',allowFresh?'✓ Frais':'× Frais',()=>change(()=>{allowFresh=!allowFresh;}),{active:allowFresh,disabled:applying,hint:'Autoriser ou interdire les produits frais'}),
        control('rotten',allowRotten?'✓ Pourris':'× Pourris',()=>change(()=>{allowRotten=!allowRotten;}),{active:allowRotten,disabled:applying,hint:'Autoriser ou interdire les produits pourris'}),
      ]),
      details('quality','Qualité',[qualityControl('min'),qualityControl('max')]),
    ];
    rows.push(
      {id:id('hp-min'),label:'PV min. %',hint:'Points de vie minimum, en pourcentage',column:0,region:'details',compact:true,presentation:'plain',input:{value:String(minHp),kind:'number',onCommit:value=>{if(!applying){const next=readPercentage(value);if(next!==minHp){hpStored=true;minHp=next;redraw();}}}}},
      {id:id('hp-max'),label:'PV max. %',hint:'Points de vie maximum, en pourcentage',column:1,region:'details',compact:true,presentation:'plain',input:{value:String(maxHp),kind:'number',onCommit:value=>{if(!applying){const next=readPercentage(value);if(next!==maxHp){hpStored=true;maxHp=next;redraw();}}}}},
    );
    rows.push(
      {id:id('search'),label:'Rechercher',region:'navigation',compact:true,presentation:'plain',input:{value:search,placeholder:'Objet ou catégorie…',maxLength:160,onCommit:value=>{if(!applying){search=value;redraw();}}}},
      {id:id('all'),label:`${selected.size} / ${STORAGE_LEAVES.length}`,hint:'Nombre d’objets autorisés dans le filtre',region:'navigation',compact:true,presentation:'plain',controls:[
        control('clear','Tout effacer',()=>change(()=>{for(const node of STORAGE_FILTER_TREE)setStorageNode(node,selected,false);}),{disabled:applying}),
        control('allow','Tout autoriser',()=>change(()=>{for(const node of STORAGE_FILTER_TREE)setStorageNode(node,selected,true);}),{disabled:applying}),
      ]},
    );
    rows.push(...nativeStorageTreeRows({id:options.id,selected,expanded,search,disabled:applying,
      onExpand:nodeId=>change(()=>{if(expanded.has(nodeId))expanded.delete(nodeId);else expanded.add(nodeId);}),
      onToggle:(node,state)=>change(()=>setStorageNode(node,selected,state!=='all')),
    }));
    return {id:options.id,title:options.title,contentKey:search,layout:'storage',width:480,height:760,rows,modal:true,onClose:()=>{if(!applying)options.onBack();},actions:[
      control('apply',options.applyLabel??'Appliquer',async()=>{
        if(applying)return;
        const next=settings();applying=true;redraw();
        try {await options.onApply(next);options.onBack();}
        catch(error){applying=false;redraw();throw error;}
      },{disabled:applying}),
      control('back','Retour',()=>{if(!applying)options.onBack();},{disabled:applying}),
    ]};
  }
  return make();
}
