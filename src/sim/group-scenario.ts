import {filterPileEntries} from './pile-identity-directory.ts';
import {createScenarioWorld} from './new-game.ts';
import {newDoorState} from './door-rules.ts';
import {addMaterial,refreshStock} from './materials.ts';
import {isHabitatFurnitureKind} from './furniture-stats.ts';
import type {Pawn,Structure,World} from './types.ts';

export const GROUP_SCENARIO_ID='globe-voyage-v216';
export const GROUP_SCENARIO_PATH='public/test-saves/v216/globe-voyage.json';
export const GROUP_SCENARIO_SEED=216;
export const GROUP_SCENARIO_CELLS=Object.freeze({
  food:{x:13,z:20},silver:{x:15,z:20},cloth:{x:17,z:20},medicine:{x:19,z:20},
  beds:[{x:12,z:11},{x:15,z:11},{x:18,z:11}],
});
export const GROUP_SCENARIO_FOOD_CELLS=[GROUP_SCENARIO_CELLS.food,{x:13,z:21},{x:13,z:22}] as const;

/** Prepared initial camp only. No World tick, planet adoption, loading,
 * departure, segment, consumption or transaction is performed here. */
export function prepareGroupScenario():World {
  const world=createScenarioWorld(GROUP_SCENARIO_SEED,32,'survivors');
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.structures=[];world.jobs=[];world.packed=[];
  world.stockpiles=[];world.growingZones=[];world.growingCursor=0;world.events=[];
  // Keep only the actual starting shirts. The finite scene supplies below
  // replace this preparation's ground dotation, never a historical save.
  world.piles=filterPileEntries(world.piles,pile=>pile.owner.type==='apparel');
  delete world.arrivals;delete world.raids;delete world.heatwaves;delete world.wildlife;delete world.filth;delete world.home;
  for(const [i,pawn] of world.pawns.entries()){
    pawn.name=['Ada','Noé','Mina'][i]!;pawn.x=12+i*3;pawn.z=14;
    pawn.hunger=100;pawn.rest=100;pawn.recreation.level=100;pawn.schedule.fill('anything');pawn.apparelAutomation=false;
    // Health is an explicit preparation. Adult age, appearance, traits,
    // backstories and any genuine creation-time family link stay intact.
    delete pawn.health;
    for(const work of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[])pawn.priorities[work]=0;
  }
  // Authored preparation, not XP or a negotiation already carried out.
  world.pawns[0]!.skills.social={level:8,xp:0,dailyXp:0,passion:0};
  const building=(kind:Structure['kind'],x:number,z:number):Structure=>({id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood',
    ...isHabitatFurnitureKind(kind)?{quality:'normal' as const}:{},...kind==='door'?{door:newDoorState(world.tick)}:{}});
  for(let x=10;x<=20;x++)world.structures.push(building('wall',x,9),building(x===15?'door':'wall',x,18));
  for(let z=10;z<18;z++)world.structures.push(building('wall',10,z),building('wall',20,z));
  for(const [i,cell] of GROUP_SCENARIO_CELLS.beds.entries()){
    const bed=building('bed',cell.x,cell.z);world.structures.push(bed);world.pawns[i]!.bedId=bed.id;
  }
  world.structures.push(building('table',14,14),building('stool',13,14),building('stool',15,14),building('stool',13,15));
  const roof:number[]=[];for(let z=10;z<18;z++)for(let x=11;x<20;x++)roof.push(z*world.width+x);
  world.roofing={constructed:roof,build:[],remove:[],cursor:0};
  for(const [i,quantity] of [10,10,4].entries())addMaterial(world,'food',quantity,{type:'ground',...GROUP_SCENARIO_FOOD_CELLS[i]!},'survival-meal');
  addMaterial(world,'silver',500,{type:'ground',...GROUP_SCENARIO_CELLS.silver},'silver');
  addMaterial(world,'textile',60,{type:'ground',...GROUP_SCENARIO_CELLS.cloth},'cloth');
  addMaterial(world,'medicine',6,{type:'ground',...GROUP_SCENARIO_CELLS.medicine},'medicine');
  refreshStock(world);
  return world;
}

/** Uses the existing hashed-file catalogue and ordinary validated load
 * protocol. Only the V216 publisher may append this entry/payload. */
export function groupScenarioEntry(world:World,sha256:string){return {
  id:GROUP_SCENARIO_ID,release:'v216',label:'Globe · voyage collectif et commerce',filename:'globe-voyage.json',
  description:'Adopter le globe, préparer un groupe et ses provisions, marcher jusqu’au comptoir, échanger puis rentrer avec les mêmes personnes et biens.',
  pawns:world.pawns.length,colonists:3,width:world.width,height:world.height,tick:world.tick,
  focus:['adoption explicite du globe','rassemblement et prises réels','voyage collectif','masse et besoins','commerce au comptoir','retour et dépôts physiques','sauvegarde et reprise'],
  steps:[
    'Charger en pause au tick 0. Le foyer est préparé, mais aucune planète, préparation de groupe, provision chargée ou progression de voyage n’existe. Ouvrir Monde puis adopter le globe.',
    'Dans Globe et groupe, choisir Ada et Noé, laisser Mina au foyer, sélectionner le comptoir civil et prévisualiser la formation. Charger par exemple 12 rations, quatre dans chacune des trois piles, 500 argent et 60 tissus au sol ; les six médicaments restent disponibles au foyer. Confirmer puis reprendre pour voir rassemblement, prises et sortie collective.',
    'Suivre la route et les vrais besoins. La nuit, la pause, une surcharge ou un membre incapable peuvent arrêter la marche ; la santé et les besoins continuent. Le groupe emporte ses vêtements réels. Sauvegarder puis recharger pendant un segment engagé.',
    'Au comptoir, prévisualiser la vente d’une partie du tissu puis confirmer. Prévisualiser un achat de médicaments ou composants avec l’argent réellement détenu, puis confirmer. Les fonds sont finis ; aucune transaction n’a été jouée dans la préparation.',
    'Choisir le foyer comme destination et confirmer la route de retour. Après l’entrée des personnes originales sur des cellules distinctes, reprendre le déchargement réel ; comparer les biens et le journal avant et après sauvegarde/reprise. Une arrivée sur le globe n’est pas une téléportation sur la carte.',
  ],prepared:true,
  provenance:'Préparation originale V216, createScenarioWorld(216,32,Survivants), schéma 196 au tick 0 sans campagne simulée. Trois adultes libres aux âges, apparences, traits et passés de création, santé explicitement saine et besoins à 100 ; Ada Social 8 préparé sans apprentissage. Chemises originales conservées, éventuels liens de création conservés. Clairière 32×32, foyer de bois clos, toit, table, tabourets et trois lits individuels attribués préparés. Stocks finis réellement au sol : 24 repas de survie en piles de 10/10/4, 500 argent, 60 tissus et six médicaments industriels. Aucune planète, groupe, perte, comptoir généré, manifeste, réservation, prise, départ, route, segment, ingestion, soin, paiement, vente, achat, retour ou dépôt accompli. Calendriers d’accueil, raids, canicule et faune exclus ; calendrier et climat existants non adoptés ou déplacés. La préparation ne certifie ni parcours natif, fréquence naturelle, équilibre de campagne, parité Core ni performance générale.',
  sha256,
};}
