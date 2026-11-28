import { ITEM_DEFINITIONS, type ItemId } from '../sim/items';
import { isAnimalMeat } from '../sim/biome-items';
import {isLongswordItem270} from '../sim/longsword-content-270';
import {isSpearItem272} from '../sim/spear-content-272';
import {isMaceItem269} from '../sim/mace-content-269';
import type { StorageFilters } from '../sim/types';

/** Furniture is a real storage permission, but has no mechanical ItemId. */
export type StorageLeafId=ItemId|'furniture';
export interface StorageFilterNode {id:string;label:string;children?:readonly StorageFilterNode[];item?:StorageLeafId}
const entries=Object.entries(ITEM_DEFINITIONS) as [ItemId,(typeof ITEM_DEFINITIONS)[ItemId]][];
const leaves=(accept:(id:ItemId,kind:string)=>boolean):StorageFilterNode[]=>entries
  .filter(([id,def])=>accept(id,def.kind)).map(([id,def])=>({id,label:def.label,item:id}));
const branch=(id:string,label:string,children:readonly StorageFilterNode[]):StorageFilterNode=>({id,label,children});
const kind=(name:string)=>leaves((_id,k)=>k===name);

/** Only the supported catalogue is displayed. A leaf occurs exactly once. */
export const STORAGE_FILTER_TREE:readonly StorageFilterNode[]=[
  branch('foods','Aliments',[
    branch('meals','Plats',leaves((id,k)=>k==='food'&&(id.endsWith('-meal')||id==='pemmican'||id==='legacy-portion'))),
    branch('raw-food','Aliments crus',[
      branch('meat','Viandes crues',leaves(id=>isAnimalMeat(id))),
      branch('vegetarian','Végétaux',leaves(id=>['berries','rice','potato','corn','agave-fruit'].includes(id))),
      branch('animal-products','Produits animaliers',leaves(id=>id==='milk')),
    ]),
    branch('animal-food','Fourrage',leaves(id=>id==='hay'||id==='kibble')),
  ]),
  branch('manufactured','Produits manufacturés',[
    branch('medicines','Médicaments',kind('medicine')),
    branch('drugs','Drogues',kind('drug')),
    branch('mortar-shells','Obus de mortier',kind('shell')),
    branch('prostheses','Prothèses',kind('prosthesis')),
    branch('brewing-products','Brassage',leaves(id=>id==='wort'||id==='beer')),
    branch('brewing-plants','Matières végétales',leaves(id=>id==='hops'||id==='dye')),
    branch('textiles','Textiles',[
      branch('leathers','Cuirs',leaves((id,k)=>k==='textile'&&id!=='cloth'&&id!=='muffalo-wool'&&id!=='devilstrand')),
      branch('wools','Laines',leaves(id=>id==='muffalo-wool')),
      // Schema 358: devilstrand is a fabric, next to cloth.
      ...leaves(id=>id==='cloth'||id==='devilstrand'),
    ]),
    ...leaves((_id,k)=>k==='component'||k==='advanced-component'||k==='chemfuel'||k==='neutroamine'),
  ]),
  branch('raw-resources','Ressources brutes',[
    branch('stone-blocks','Blocs de pierre',kind('blocks')),
    ...leaves((_id,k)=>['jade','steel','gold','uranium','plasteel','silver','wood'].includes(k)),
  ]),
  branch('plants','Plantes déracinées',kind('plant')),
  branch('objects','Objets',[branch('unfinished','Inachevé',kind('unfinished')),branch('books','Livres',kind('book'))]),
  branch('weapons','Armes',[
    branch('ranged','Armes à distance',leaves((id,k)=>k==='weapon'&&id!=='plasteel-knife'&&!isMaceItem269(id)&&!isLongswordItem270(id)&&!isSpearItem272(id))),
    branch('melee','Armes de mêlée',leaves(id=>id==='plasteel-knife'||isMaceItem269(id)||isLongswordItem270(id)||isSpearItem272(id))),
  ]),
  branch('apparel','Vêtements',[
    branch('armor','Armures',[
      branch('armor-headgear','Casques',leaves(id=>id==='flak-helmet'||id==='recon-helmet')),
      ...leaves(id=>id==='flak-vest'||id==='recon-armor'),
    ]),
    branch('apparel-misc','Divers',leaves((id,k)=>k==='apparel'&&id!=='recon-armor'&&id!=='flak-vest'&&id!=='flak-helmet'&&id!=='recon-helmet')),
  ]),
  branch('buildings','Constructions',[{id:'furniture',label:'Constructions emballées',item:'furniture'}]),
  branch('chunks','Morceaux',[
    branch('stone-chunks','Morceaux de roches',leaves((id,k)=>k==='chunk'&&id!=='legacy-chunk')),
    ...leaves(id=>id==='legacy-chunk'),
  ]),
  branch('corpses','Cadavres',[
    branch('human-corpses','Cadavres d’humanoïdes',leaves(id=>id==='human-corpse')),
    branch('animal-corpses','Carcasses d’animaux',leaves((id,k)=>k==='corpse'&&id!=='human-corpse')),
    branch('mech-corpses','Carcasses de mécanoïdes',kind('mech-corpse')),
  ]),
];

export const storageNodeLeaves=(node:StorageFilterNode):readonly StorageLeafId[]=>node.item?[node.item]:(node.children??[]).flatMap(storageNodeLeaves);
export const STORAGE_LEAVES:readonly StorageLeafId[]=STORAGE_FILTER_TREE.flatMap(storageNodeLeaves);
export function storageTreeSelection(filters:StorageFilters,items?:Partial<Record<ItemId,boolean>>):Set<StorageLeafId>{
  return new Set(STORAGE_LEAVES.filter(id=>id==='furniture'?filters.furniture===true:
    filters[ITEM_DEFINITIONS[id].kind]===true&&(items===undefined||items[id]===true)));
}
export function storageTreePermissions(selected:ReadonlySet<StorageLeafId>):{filters:StorageFilters;items:Partial<Record<ItemId,boolean>>|undefined}{
  const filters:StorageFilters={wood:false,food:false},items:Partial<Record<ItemId,boolean>>={};
  for(const id of STORAGE_LEAVES)if(selected.has(id)){
    if(id==='furniture')filters.furniture=true;
    else {filters[ITEM_DEFINITIONS[id].kind]=true;items[id]=true;}
  }
  // Category-only policies need no whitelist repeated on every zone cell.
  // A partial kind requires the whitelist to cover all selected kinds, because
  // the historical acceptance rule intersects categories with this one map.
  const partial=entries.some(([id,definition])=>filters[definition.kind]===true&&!selected.has(id));
  return {filters,items:partial?items:undefined};
}
export function storageNodeState(node:StorageFilterNode,selected:ReadonlySet<StorageLeafId>):'none'|'all'|'mixed'{
  const ids=storageNodeLeaves(node),count=ids.filter(id=>selected.has(id)).length;
  return count===0?'none':count===ids.length?'all':'mixed';
}
export function setStorageNode(node:StorageFilterNode,selected:Set<StorageLeafId>,allowed:boolean):void{
  for(const id of storageNodeLeaves(node))if(allowed)selected.add(id);else selected.delete(id);
}
const searchText=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
/** Search is a view: matching a category displays its whole subtree. */
export function storageSearchNodes(query:string):ReadonlySet<string>{
  const visible=new Set<string>(),needle=searchText(query.trim());
  function visit(node:StorageFilterNode,parentMatch:boolean):boolean{
    const own=parentMatch||searchText(node.label).includes(needle)||searchText(node.id).includes(needle);
    let child=false;for(const next of node.children??[])if(visit(next,own))child=true;
    if(own||child){visible.add(node.id);return true;}return false;
  }
  for(const node of STORAGE_FILTER_TREE)visit(node,false);return visible;
}
