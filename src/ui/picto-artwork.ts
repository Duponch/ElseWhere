import {ITEM_DEFINITIONS} from '../sim/items';

/** One original drawing per semantic symbol, shared by Canvas, SVG and atlases.
 * Coordinates are authored, not randomly displaced at paint time. Slightly
 * bowed strokes and asymmetric curves keep the hand without the old scribble.
 * This module never changes button shapes, materials, layout or world models. */
type Point=readonly [number,number];
interface Stroke {readonly points:readonly Point[];readonly fill:string|null;readonly closed:boolean;readonly width:number;readonly color:string}
export interface PictoArtwork {readonly id:string;readonly strokes:readonly Stroke[]}
const P={ink:'#44392f',paper:'#f4ead4',sage:'#91a27b',green:'#637f61',blue:'#7d9fa9',darkBlue:'#496b7a',ochre:'#d2a153',wood:'#b48a60',red:'#c85a42',stone:'#a6a69c',silver:'#bdc6c4',plum:'#9e8098'};
const cache=new Map<string,PictoArtwork|null>();
const urls=new Map<string,string>();
const aliases:Readonly<Record<string,string>>={
 architect:'architecte',work:'travail',schedule:'planning',assign:'assignations',animals:'animaux',wildlife:'faune',research:'recherches',quests:'quetes',world:'monde',history:'historique',orders:'ordres',
 structure:'wall',floors:'floor',furniture:'chair',temperature:'thermometer',recreation:'horseshoes',production:'workbench',ship:'rocket',
 pointer:'select',clock:'planning',people:'assignations',leaf:'growing',layers:'zones',eye:'eye',chop:'axe',cut:'scissors','haul-chunks':'haul','build-roof':'roof','ignore-roof':'roof-ignore','snow-clear':'snow',
 'remove-growing':'growing-remove','remove-stockpile':'stockpile-remove','remove-home':'home-remove','remove-roof':'roof-remove','remove-snow-clear':'snow-remove','remove-floor':'floor-remove','build-bridge':'bridge','remove-bridge':'bridge-remove',
 'extract-tree':'extract','replant-tree':'replant',allow:'check',forbid:'forbid',close:'cancel',delete:'cancel',remove:'cancel',settings:'settings',options:'settings',resume:'play',start:'play',info:'information',
 'dining-chair':'chair','standing-lamp':'lamp','tube-television':'television','chess-table':'chess','power-conduit':'wire','wind-turbine':'wind','solar-generator':'solar','pen-marker':'pen',
 'ship-cryptosleep-casket':'ship-casket','cryptosleep-casket':'casket','art-bench':'art-workbench','tailor-bench':'tailor','electric-tailor-bench':'electric-tailor','research-bench':'research-desk','hi-tech-research-bench':'hi-tech-desk',
 'fueled-stove':'wood-stove','electric-stove':'electric-stove','butcher-table':'butcher','butcher-spot':'butcher-spot','crafting-spot':'crafting','machining-table':'machining','fabrication-bench':'fabrication',
 'fueled-smithy':'smithy','electric-smithy':'electric-smithy','hydroponics-basin':'hydroponics','firefoam-popper':'foam','electric-crematorium':'crematorium','electric-smelter':'smelter','nutrient-paste-dispenser':'paste-dispenser',
 'orbital-beacon':'beacon','comms-console':'computer','ground-scanner':'radar','multi-analyzer':'analyzer','deep-drill':'drill','biofuel-refinery':'refinery',
 'wood-planks':'planks','smooth-floor':'smooth','flower-pot':'flower-pot','small-sculpture':'sculpture','large-sculpture':'large-sculpture',
 'small-shelf':'small-shelf',horseshoe:'horseshoes','animal-bed':'animal-sleeping-spot','medical-bed':'hospital-bed',
 sword:'longsword',gun:'revolver',cross:'medicine',shirt:'shirt',limb:'prosthetic-leg',paint:'palette',food:'meal',pot:'cooking-pot',drop:'chemfuel',flag:'factions',sensors:'ship-sensors',
 'rotate-left':'rotate-left','rotate-right':'rotate-right','clear-orders':'cancel','manage-work':'travail','toggle-draft':'shield',mobilize:'shield','target-shot':'target','target-melee':'longsword','fire-at-will':'revolver',
 'tree-sowing':'resource-tree',firefoam:'foam','ship-cryptosleep':'ship-casket','ship-basics':'rocket',prosthetics:'prosthetic-leg',cryptosleep:'casket','long-blades':'longsword',brewing:'brewery','geothermal-power':'geothermal-generator','biofuel-refining':'refinery','nutrient-paste':'paste-dispenser','deep-drilling':'drill','sterile-materials':'sterile-tile','drug-production':'drug-lab','medicine-production':'medicine','gun-turrets':'mini-turret','complex-furniture':'chair',stonecutting:'stonecutter',smithing:'smithy',gunsmithing:'revolver','complex-clothing':'shirt','packaged-survival-meals':'meal',autodoors:'autodoor','flak-armor':'flak-vest',batteries:'battery','solar-power':'solar','air-conditioning':'cooler',microelectronics:'chip','advanced-fabrication':'fabrication','long-range-mineral-scanner':'radar',
};
export function pictoSemanticId(id:string):string {
 let key=id;
 for(const prefix of ['tool-','category-','map-dock:','tab:','menu-','page:','research-node-'])if(key.startsWith(prefix)){key=key.slice(prefix.length).replace(/-select$/,'');break;}
 return key;
}
class Drawing {
 readonly strokes:Stroke[]=[];
 shape(points:readonly Point[],fill:string|null=null,closed=true,width=1.8,color=P.ink){this.strokes.push({points,fill,closed,width,color});}
 line(points:readonly Point[],width=1.8,color=P.ink){this.shape(points,null,false,width,color);}
 rect(x:number,y:number,w:number,h:number,fill:string=P.paper){this.shape([[x+.3,y+.1],[x+w,y],[x+w-.25,y+h],[x,y+h-.2]],fill);}
 ellipse(x:number,y:number,rx:number,ry=rx,fill:string=P.paper,width=1.8,color=P.ink){this.shape(Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return [x+Math.cos(a)*rx*(1+.008*Math.sin(a*3)),y+Math.sin(a)*ry] as Point;}),fill,true,width,color);}
 /** Flatten authored Beziers once so both backends share exactly the same ink. */
 path(data:string,fill:string|null=null,width=1.8,color=P.ink){
  const tokens=data.match(/[MLQCZ]|-?\d*\.?\d+/g)!;let i=0,x=0,y=0,closed=false;let points:Point[]=[];
  while(i<tokens.length){const command=tokens[i++]!;if(command==='Z'){closed=true;continue;}const n=command==='C'?6:command==='Q'?4:2,values=tokens.slice(i,i+n).map(Number);i+=n;
   if(command==='M'||command==='L'){if(command==='M'&&points.length){this.shape(points,fill,closed,width,color);points=[];closed=false;}x=values[0]!;y=values[1]!;points.push([x,y]);}
   else {const startX=x,startY=y;for(let step=1;step<=12;step++){const t=step/12,u=1-t;points.push(command==='Q'?[u*u*startX+2*u*t*values[0]!+t*t*values[2]!,u*u*startY+2*u*t*values[1]!+t*t*values[3]!]:[u*u*u*startX+3*u*u*t*values[0]!+3*u*t*t*values[2]!+t*t*t*values[4]!,u*u*u*startY+3*u*u*t*values[1]!+3*u*t*t*values[3]!+t*t*t*values[5]!]);}const p=points.at(-1)!;x=p[0];y=p[1];}
  }this.shape(points,fill,closed,width,color);
 }
}
const stoneColors:Readonly<Record<string,string>>={granite:'#a69b91',limestone:'#c9bda3',marble:'#dbd5c8',sandstone:'#c9a272',slate:'#829294',steel:'#acb8b4',silver:'#ccd1cb',gold:'#d6b05d',uranium:'#a2ad75',plasteel:'#8ab0bd',machinery:'#a89a72'};
function wheat(d:Drawing,x=32,y=37){d.line([[x-4,y+17],[x+4,y-22]],1.7,P.green);for(let i=0;i<4;i++){const cy=y-14+i*6;d.path(`M ${x+2-i} ${cy+5} Q ${x-11-i} ${cy+1} ${x-5-i} ${cy-5} Q ${x+2-i} ${cy-3} ${x+2-i} ${cy+5} Z`,P.ochre,1.2);d.path(`M ${x+2-i} ${cy+5} Q ${x+13-i} ${cy+1} ${x+9-i} ${cy-5} Q ${x+3-i} ${cy-3} ${x+2-i} ${cy+5} Z`,P.ochre,1.2);}}
function sprout(d:Drawing,x=32,y=32){d.path(`M ${x} ${y+21} Q ${x-1} ${y+5} ${x+1} ${y-8}`);d.path(`M ${x} ${y+5} Q ${x-18} ${y+6} ${x-19} ${y-10} Q ${x-4} ${y-12} ${x} ${y+5} Z`,P.sage);d.path(`M ${x} ${y-2} Q ${x+1} ${y-20} ${x+20} ${y-19} Q ${x+20} ${y-2} ${x} ${y-2} Z`,P.green);}
function bolt(d:Drawing,x=32,y=32,s=1){d.shape([[x+3*s,y-19*s],[x-13*s,y+3*s],[x-2*s,y+3*s],[x-5*s,y+20*s],[x+14*s,y-6*s],[x+3*s,y-6*s]],P.ochre);}
function paw(d:Drawing,x=32,y=34,s=1){d.path(`M ${x-12*s} ${y+8*s} Q ${x-12*s} ${y} ${x-5*s} ${y-3*s} Q ${x} ${y-11*s} ${x+5*s} ${y-3*s} Q ${x+12*s} ${y} ${x+12*s} ${y+8*s} Q ${x+9*s} ${y+14*s} ${x} ${y+10*s} Q ${x-9*s} ${y+14*s} ${x-12*s} ${y+8*s} Z`,P.wood);for(const[xp,yp]of[[-15,-7],[-6,-17],[6,-17],[15,-7]])d.ellipse(x+xp*s,y+yp*s,4.4*s,6*s,P.wood,1.5);}
function worktop(d:Drawing,fill=P.wood){d.rect(7,35,50,7,fill);d.line([[13,43],[12,56]],3);d.line([[51,43],[52,56]],3);}
function book(d:Drawing){d.path('M 7 15 Q 19 10 32 17 Q 46 10 57 15 L 57 52 Q 44 48 32 54 Q 19 48 7 52 Z',P.wood);d.path('M 10 12 Q 21 8 32 15 Q 43 8 54 12 L 54 47 Q 42 44 32 50 Q 22 44 10 47 Z',P.paper);d.line([[32,16],[32,49]],1.6);for(const y of[23,31,39]){d.path(`M 15 ${y} Q 21 ${y-2} 26 ${y+1}`,null,1.3,P.wood);d.path(`M 38 ${y+1} Q 44 ${y-2} 49 ${y}`,null,1.3,P.wood);}}
function bed(d:Drawing,id:string){
 if(id==='sleeping-spot'||id==='animal-sleeping-spot'){d.ellipse(32,39,25,15,P.wood);d.ellipse(32,36,21,12,P.sage);if(id==='animal-sleeping-spot')paw(d,32,36,.48);else d.rect(15,27,14,9,P.paper);return;}
 if(id==='bedroll'){d.path('M 12 18 Q 33 13 53 20 L 51 51 Q 32 55 13 49 Z',P.sage);d.ellipse(32,20,20,7,P.paper);d.line([[17,25],[17,48]]);return;}
 const double=id==='double-bed';d.rect(10,12,44,44,P.wood);d.rect(13,18,38,33,P.paper);if(double){d.rect(16,20,14,9);d.rect(34,20,14,9);}else d.rect(19,20,26,9);d.path('M 13 33 Q 33 30 51 33 L 51 50 L 13 50 Z',id==='hospital-bed'?P.blue:P.sage);d.line([[10,13],[10,57]],3);d.line([[54,13],[54,57]],3);d.rect(10,49,44,6,P.wood);if(id==='hospital-bed'){d.line([[27,41],[37,41]],2.7,P.paper);d.line([[32,36],[32,46]],2.7,P.paper);}
}
function flask(d:Drawing){d.path('M 24 8 L 40 8 L 39 13 L 37 13 L 37 29 L 52 50 Q 54 56 47 57 L 17 57 Q 10 56 12 50 L 27 29 L 27 13 L 24 13 Z',P.paper);d.path('M 23 37 Q 31 40 41 37 L 50 51 Q 51 54 47 54 L 17 54 Q 13 54 15 51 Z',P.blue,1.2);d.ellipse(29,46,2.4,2.4,P.paper,0);d.ellipse(35,33,2,2,P.blue,0);}
function tree(d:Drawing,id:string){d.line([[32,33],[31,56]],5,P.wood);if(id.includes('pine')){d.shape([[32,7],[48,28],[41,28],[55,45],[10,45],[23,28],[16,28]],P.green);return;}if(/saguaro|agave|drago/.test(id)){d.path('M 29 55 L 29 14 Q 32 6 36 14 L 36 31 L 44 31 L 44 22 Q 47 16 50 22 L 50 33 Q 50 40 36 39 L 36 55 Z',P.sage);d.path('M 29 39 Q 15 39 15 31 L 15 25 Q 18 20 21 25 L 21 33 L 29 33',P.sage);return;}d.path('M 16 43 Q 3 36 13 25 Q 9 12 23 13 Q 31 2 40 12 Q 55 8 54 24 Q 66 34 51 42 Q 43 50 32 43 Q 20 49 16 43 Z',id.includes('birch')?P.ochre:P.sage);d.line([[31,47],[29,34],[22,29]],1.4,P.green);d.line([[29,37],[41,26]],1.4,P.green);}
function rock(d:Drawing,color=P.stone){d.shape([[8,44],[12,25],[26,13],[44,18],[56,38],[49,52],[23,55]],color);d.line([[12,25],[31,30],[44,18]],1.3);d.line([[31,30],[27,48],[49,52]],1.3);}
function animal(d:Drawing,id:string,color=P.wood){
 const bird=/hen|chicken|duck|turkey|ostrich|emu|cassowary|goose/.test(id),rabbit=/hare|rabbit/.test(id),elephant=/elephant/.test(id),snake=/cobra|snake/.test(id),turtle=/tortoise/.test(id);
 if(snake){d.path('M 13 47 C 3 33 53 44 47 28 C 42 16 20 29 25 17 Q 32 7 45 16',null,8,P.green);d.ellipse(45,15,8,5,P.sage);d.ellipse(48,14,1,1,P.ink,0);return;}
 if(turtle){d.ellipse(32,35,21,16,P.sage);d.line([[18,31],[29,24],[41,29],[41,41],[28,46],[18,39],[18,31]],1.5,P.green);d.ellipse(55,37,6,5,P.sage);for(const[x,y]of[[16,48],[43,49],[16,22],[42,22]])d.ellipse(x!,y!,4,3,P.sage);return;}
 if(bird){d.ellipse(29,37,19,14,color);d.path('M 38 32 Q 37 17 46 14 Q 55 12 54 22 L 48 39 Z',color);d.shape([[54,19],[62,23],[53,25]],P.ochre);d.line([[25,50],[24,58],[19,58]]);d.line([[37,50],[38,57],[43,57]]);d.path('M 15 37 Q 26 49 35 35',null,1.5);d.ellipse(49,19,1.2,1.2,P.ink,0);return;}
 if(elephant){d.path('M 8 40 L 8 25 Q 12 13 33 19 Q 52 14 56 27 L 56 49 Q 52 55 48 49 L 48 34 L 44 50 L 36 50 L 36 42 L 21 42 L 21 52 L 13 52 L 13 40 Z',color);d.ellipse(41,28,9,12,P.stone);d.ellipse(52,25,1.2,1.2,P.ink,0);return;}
 d.path('M 10 38 Q 4 24 23 25 L 36 27 L 42 18 L 53 20 L 58 30 L 50 36 L 48 50 L 41 50 L 40 39 L 24 39 L 22 51 L 15 51 L 14 39 Z',color);d.path('M 12 30 Q 2 22 5 17',null,2.2);d.ellipse(50,26,1.1,1.1,P.ink,0);
 if(rabbit){d.path('M 43 20 Q 36 1 42 5 L 49 19 Q 46 1 53 5 L 53 22',color);}
 else if(/deer|caribou|elk|gazelle|ibex/.test(id)){d.line([[46,20],[43,11],[36,7],[37,3]]);d.line([[43,12],[47,6],[46,3]]);d.line([[52,20],[55,10],[60,6]]);}
 else if(/fox|wolf|warg|cat|cougar|lynx|panther|husky|labrador|dog/.test(id))d.shape([[42,22],[42,12],[49,21],[54,13],[55,25]],color);
 else if(/alpaca|muffalo|bison|yak|sheep|bear/.test(id)){for(const x of[16,24,32])d.ellipse(x,28,7,7,color);if(/muffalo|bison|yak/.test(id))d.path('M 42 20 Q 37 16 40 11 M 53 20 Q 59 18 57 12');}
}

/** Unknown IDs stay unknown. Callers may deliberately choose the info symbol;
 * a delivered item/tool is never silently assigned an arbitrary stock image. */
export function pictoArtwork(input:string):PictoArtwork|undefined {
 const original=pictoSemanticId(input);if(cache.has(original))return cache.get(original)??undefined;
 let id=Object.hasOwn(aliases,original)?aliases[original]!:original;
 const d=new Drawing();let color=P.sage as string,unfinished=false,item=false;
 if(id.startsWith('item-')){
  const key=id.slice(5),definition=Object.hasOwn(ITEM_DEFINITIONS,key)?ITEM_DEFINITIONS[key as keyof typeof ITEM_DEFINITIONS]:undefined;
  if(!definition){cache.set(original,null);return;}
  item=true;color='#'+definition.color.toString(16).padStart(6,'0');id=key;
  unfinished=id.startsWith('unfinished-');if(unfinished){id=id.slice(11);if(id==='gun')id='revolver';if(id==='prosthetic')id='prosthetic-arm';if(id==='component')id='component';}
  if(/-meat$/.test(id))id='meat';else if(/-corpse$/.test(id)){animal(d,id,color);d.line([[44,6],[55,17]],2.2,P.red);d.line([[44,17],[55,6]],2.2,P.red);id='drawn';}
  else if(/-egg(?:-(?:un)?fertilized)?$/.test(id)||id==='egg')id='egg';
  else if(/-(shirt|tribalwear|parka|pants|duster|tuque|plate-armor|simple-helmet|flak-helmet)$/.test(id))id=id.match(/(shirt|tribalwear|parka|pants|duster|tuque|plate-armor|simple-helmet|flak-helmet)$/)![0];
  else if(/-wool$/.test(id))id='wool';else if(/leather|fur|camelhide/.test(id))id='leather';
  else if(/-blocks$/.test(id))id='blocks';else if(/-chunk$/.test(id))id='chunk';
  else if(/meal/.test(id))id='meal';else if(/longsword$/.test(id))id='longsword';else if(/spear$/.test(id))id='spear';else if(/mace$/.test(id))id='mace';
 }
 if(/^(resource|crop)-/.test(id))id=id.replace(/^(resource|crop)-/,'plant:');
 const remove=id.endsWith('-remove');if(remove)id=id.slice(0,-7);
 const material=Object.keys(stoneColors).find(stone=>id.startsWith(stone+'-'));
 if(/-(tile|flagstone)$/.test(id)||id==='floor'||id==='planks'||id==='smooth'){
  const fill=material?stoneColors[material]!:id==='planks'?P.wood:P.stone;
  d.shape([[7,29],[31,14],[57,28],[33,45]],fill);d.shape([[7,29],[33,45],[57,28],[57,35],[33,52],[7,36]],fill);d.line([[33,45],[33,52]],1.3);
  if(id==='planks'){d.line([[15,25],[41,40]],1.3);d.line([[23,20],[49,35]],1.3);}else if(id.endsWith('flagstone')){d.line([[18,23],[22,32],[13,33]],1.2);d.line([[22,32],[37,26],[41,38]],1.2);d.line([[37,26],[39,19]],1.2);}else if(id==='smooth'){d.rect(30,9,21,7,P.blue);d.line([[40,9],[47,3]],3,P.wood);}else{d.line([[19,21],[45,36]],1.2);d.line([[19,37],[44,20]],1.2);if(id==='sterile-tile'){d.line([[29,28],[36,28]],2,P.paper);d.line([[32,24],[32,32]],2,P.paper);}}
  id='drawn';
 }
 if(id.startsWith('mountain-')){const ore=id.slice(9);rock(d,stoneColors[ore]??P.stone);d.shape([[24,31],[31,23],[39,30],[34,40],[25,40]],stoneColors[ore]??P.ochre);id='drawn';}
 if(id.startsWith('plant:')){
  const plant=id.slice(6);
  if(/tree|oak|birch|pine|poplar|drago|saguaro/.test(plant))tree(d,plant);
  else if(/corn|rice|haygrass/.test(plant))wheat(d);
  else if(/rock/.test(plant))rock(d);
  else if(/berry|berries|brambles/.test(plant)){sprout(d);for(const[x,y]of[[17,30],[26,26],[42,17],[45,25]])d.ellipse(x!,y!,3.4,3.4,P.plum);}
  else if(plant==='potato'){sprout(d,32,24);d.ellipse(23,48,11,6,P.wood);d.ellipse(43,49,9,5,P.wood);}
  else if(plant==='cotton'){sprout(d);for(const[x,y]of[[16,22],[39,15],[45,30]])d.ellipse(x!,y!,8,7,P.paper);}
  else {sprout(d);if(/healroot/.test(plant)){d.line([[25,49],[39,49]],3,P.paper);d.line([[32,42],[32,56]],3,P.paper);}}
  id='drawn';
 }
 switch(id){
 case 'drawn':break;
 case 'architecte':
  d.shape([[11,53],[53,53],[52,11]],P.ochre);d.shape([[29,45],[44,45],[44,30]],P.paper);for(const x of[20,28,36])d.line([[x,50],[x,46]],1.2);d.shape([[9,45],[14,49],[40,19],[35,15]],P.wood);d.path('M 26 12 Q 36 4 48 15 L 44 21 L 37 18 L 31 22 L 24 18 Z',P.silver);break;
 case 'travail':
  d.shape([[13,54],[9,50],[44,13],[49,18]],P.wood);d.path('M 37 15 Q 33 6 43 5 L 41 12 L 47 17 L 54 14 Q 56 25 46 24 Z',P.silver);d.shape([[10,17],[15,11],[52,48],[47,54]],P.wood);d.shape([[7,17],[17,6],[27,15],[17,27]],P.silver);break;
 case 'settings':
  for(let i=0;i<8;i++){const a=i*Math.PI/4;d.line([[32+Math.cos(a)*17,32+Math.sin(a)*17],[32+Math.cos(a)*24,32+Math.sin(a)*24]],6,P.stone);}d.ellipse(32,32,18,18,P.stone);d.ellipse(32,32,7,7,P.paper);break;
 case 'planning':
  d.rect(10,13,44,43,P.paper);d.rect(10,13,44,12,P.red);d.path('M 21 7 Q 17 7 18 18 M 45 7 Q 41 7 42 18',null,3);
  for(const x of[18,29,40])for(const y of[32,43])d.rect(x,y,6,6,x===29&&y===32?P.red:P.sage);break;
 case 'assignations':
  d.rect(12,11,40,46,P.wood);d.rect(16,15,32,37,P.paper);d.rect(24,7,16,9,P.stone);d.ellipse(29,28,5,5,P.sage);d.path('M 21 42 Q 21 33 29 34 Q 37 33 37 42 Z',P.sage);d.line([[36,45],[41,49],[49,38]],2.6,P.green);break;
 case 'animaux':paw(d);break;
 case 'faune':
  d.line([[24,22],[18,13],[18,5]],2);d.line([[18,13],[11,10],[9,5]],2);d.line([[18,9],[23,5]],1.7);d.line([[40,22],[46,13],[47,5]],2);d.line([[46,13],[54,9],[55,5]],2);d.line([[47,9],[42,4]],1.7);
  d.path('M 23 24 Q 12 16 9 23 Q 12 32 24 32 L 27 48 Q 32 56 37 48 L 41 31 Q 52 31 55 22 Q 48 18 40 25 Q 32 18 23 24 Z',P.wood);d.ellipse(26,34,1.3,1.5,P.ink,0);d.ellipse(39,34,1.3,1.5,P.ink,0);d.ellipse(32,45,3,2,P.ink,0);break;
 case 'recherches':flask(d);break;
 case 'quetes':
  d.path('M 17 10 L 49 10 Q 57 11 52 21 L 47 21 L 47 52 L 17 52 Q 7 50 12 43 L 17 43 Z',P.paper);d.path('M 17 10 Q 25 11 22 19 L 14 19 M 17 43 Q 23 44 21 51');d.line([[33,22],[33,35]],4,P.red);d.ellipse(33,42,2.2,2.2,P.red,0);break;
 case 'monde':
  d.ellipse(32,32,25,25,P.blue);d.path('M 16 14 L 28 11 L 34 20 L 28 27 L 19 27 L 23 36 L 33 40 L 29 54 L 23 53 L 13 39 L 10 27 Z',P.sage,1);d.path('M 42 17 L 49 19 L 54 29 L 46 36 L 37 29 Z',P.sage,1);d.path('M 40 42 L 49 43 L 48 50 L 39 50 Z',P.sage,1);break;
 case 'historique':case 'novel':book(d);break;
 case 'factions':
  d.line([[12,56],[14,9]],3,P.wood);d.path('M 15 12 Q 24 6 39 14 L 38 34 Q 25 26 14 33 Z',P.sage);d.line([[39,57],[41,24]],3,P.wood);d.path('M 42 26 Q 50 20 60 27 L 57 46 Q 50 40 41 45 Z',P.red);break;
 case 'menu':for(const y of[18,32,46])d.path(`M 11 ${y} Q 32 ${y-.7} 53 ${y+.2}`,null,3.3);break;
 case 'ordres':d.rect(16,11,34,45,P.paper);d.rect(24,7,17,9,P.wood);for(const y of[25,36,47]){d.line([[22,y],[25,y+3],[29,y-3]],1.8,P.green);d.line([[34,y],[43,y]],1.6);}break;
 case 'zones':
  d.shape([[9,17],[30,10],[54,18],[54,47],[34,55],[10,47]],P.sage);d.line([[30,10],[33,54]],1.3);d.line([[10,32],[54,33]],1.3);for(const[x,y]of[[9,17],[54,18],[54,47],[10,47]])d.ellipse(x!,y!,2.2,2.2,P.ochre);break;
 case 'target':d.ellipse(31,33,21,21,P.paper);d.ellipse(31,33,11,11,P.red);d.line([[32,32],[54,11]],2.8);d.line([[46,11],[54,11],[54,19]],2.8);break;
 case 'mine':d.shape([[15,55],[10,51],[37,16],[43,20]],P.wood);d.path('M 7 19 Q 31 0 57 26 Q 44 20 35 20 L 30 25 L 24 21 Q 15 17 7 19 Z',P.silver);break;
 case 'axe':d.shape([[14,56],[9,52],[37,9],[43,13]],P.wood);d.path('M 31 12 L 41 13 Q 48 11 55 8 Q 61 23 52 34 Q 44 29 36 28 Z',P.silver);d.path('M 54 11 Q 59 23 51 31',null,2,P.paper);break;
 case 'harvest':wheat(d,22,37);d.shape([[40,57],[35,54],[44,35],[49,38]],P.wood);d.path('M 44 37 C 23 27 31 5 53 8 C 37 10 37 25 50 30 Z',P.silver);break;
 case 'slaughter':d.shape([[12,55],[7,50],[25,30],[31,35]],P.wood);d.shape([[24,29],[46,7],[58,19],[38,40]],P.silver);d.ellipse(47,16,2,2,P.paper);break;
 case 'scissors':d.shape([[25,37],[12,8],[33,32]],P.silver);d.shape([[32,34],[53,8],[39,39]],P.silver);d.ellipse(18,47,10,9,P.red);d.ellipse(18,47,5,4,P.paper,1.3);d.ellipse(44,47,10,9,P.red);d.ellipse(44,47,5,4,P.paper,1.3);d.ellipse(31,34,3,3,P.ochre);break;
 case 'haul':
  rock(d,P.stone);d.shape([[7,30],[47,31],[41,44],[15,44]],P.sage);d.line([[44,36],[53,22],[60,22]],3,P.wood);d.ellipse(21,50,6,6,P.wood);d.ellipse(21,50,2,2,P.paper);d.line([[40,44],[43,52]],2.5);break;
 case 'uninstall':d.path('M 11 53 L 7 49 L 34 22 Q 28 12 40 7 L 39 17 L 46 22 L 55 17 Q 58 30 45 29 Z',P.silver);d.ellipse(14,48,2.4,2.4,P.paper);break;
 case 'deconstruct':d.rect(9,38,46,16,P.stone);d.line([[9,46],[55,46]],1.3);d.line([[25,38],[25,46]],1.3);d.line([[40,46],[40,54]],1.3);d.shape([[19,41],[14,37],[40,10],[45,15]],P.wood);d.shape([[30,11],[37,4],[54,20],[46,28]],P.silver);break;
 case 'extract':d.rect(24,6,16,10,P.wood);d.line([[32,16],[32,35]],5,P.wood);d.path('M 21 33 L 43 33 L 42 47 Q 37 56 32 58 Q 27 56 22 47 Z',P.silver);d.line([[32,37],[32,51]],1.3);break;
 case 'replant':sprout(d);d.path('M 8 35 Q 5 12 21 9 M 8 35 L 5 27 M 8 35 L 16 31',null,2.3,P.green);break;
 case 'cancel':d.line([[16,16],[48,48]],4,P.red);d.line([[16,48],[48,16]],4,P.red);break;
 case 'forbid':d.ellipse(32,32,23,23,P.paper,2.5,P.red);d.line([[16,48],[48,16]],3.5,P.red);break;
 case 'check':d.line([[12,33],[26,47],[53,17]],4,P.green);break;
 case 'select':d.shape([[15,7],[15,48],[27,38],[36,57],[44,53],[35,35],[51,32]],P.paper);break;
 case 'wall':d.rect(8,15,48,37,P.red);d.line([[8,28],[56,28]],1.5);d.line([[8,40],[56,40]],1.5);d.line([[24,15],[24,28]],1.5);d.line([[42,28],[42,40]],1.5);d.line([[25,40],[25,52]],1.5);break;
 case 'door':case 'autodoor':d.rect(12,8,40,49,P.wood);d.rect(17,13,30,44,P.darkBlue);d.shape([[18,13],[39,18],[39,56],[18,51]],P.ochre);d.ellipse(34,35,1.6,1.6,P.ink,0);if(id==='autodoor'){d.line([[40,4],[53,4]],1.8,P.blue);d.line([[47,1],[53,4],[47,7]],1.8,P.blue);d.line([[58,18],[58,33]],2,P.blue);}break;
 case 'fence':case 'fence-gate':for(const x of[10,29,48])d.shape([[x,54],[x,17],[x+4,11],[x+8,17],[x+8,54]],P.wood);d.rect(7,25,50,5,P.wood);d.rect(7,41,50,5,P.wood);if(id==='fence-gate'){d.line([[20,48],[43,22]],2);d.ellipse(43,32,2,2,P.ink,0);}break;
 case 'pen':d.line([[13,56],[14,12]],3,P.wood);d.rect(14,12,40,30,P.paper);paw(d,34,26,.55);break;
 case 'sandbags':for(const[x,y]of[[9,39],[31,39],[20,25],[41,25],[9,11],[31,11]]){d.path(`M ${x} ${y+3} Q ${x+11} ${y-2} ${x+21} ${y+3} L ${x+22} ${y+13} Q ${x+11} ${y+17} ${x} ${y+13} Z`,P.wood);d.line([[x+4,y+4],[x+17,y+4]],1,P.paper);}break;
 case 'spike-trap':d.rect(7,41,49,10,P.wood);for(const x of[12,27,42])d.shape([[x,41],[x+6,12],[x+12,41]],P.silver);break;
 case 'mini-turret':d.rect(15,49,35,6,P.stone);d.shape([[25,49],[25,34],[39,34],[42,49]],P.stone);d.rect(17,24,28,12,P.sage);d.rect(42,24,17,6,P.darkBlue);d.ellipse(25,30,3,3,P.ochre);d.line([[27,24],[23,17]],2);break;
 case 'bed':case 'double-bed':case 'hospital-bed':case 'sleeping-spot':case 'animal-sleeping-spot':case 'bedroll':bed(d,id);break;
 case 'vitals-monitor':d.rect(8,11,47,34,P.stone);d.rect(12,15,39,24,P.darkBlue);d.line([[16,29],[24,29],[28,22],[32,34],[37,25],[46,25]],1.8,P.sage);d.line([[31,45],[31,55],[19,55],[43,55]],2.5);break;
 case 'table':case 'table-square':case 'table-long':case 'end-table':{const x=id==='table-square'?17:id==='end-table'?16:8,w=id==='table-long'?48:id==='table-square'?30:id==='end-table'?32:42,h=id==='table-square'?29:21;d.rect(x,17,w,h,P.wood);d.line([[x+4,17+h],[x+4,57]],3);d.line([[x+w-4,17+h],[x+w-4,57]],3);d.line([[x+4,23],[x+w-4,23]],1,P.paper);break;}
 case 'chair':d.rect(18,9,29,26,P.wood);d.rect(13,35,39,8,P.ochre);d.line([[18,43],[16,57]],3);d.line([[46,43],[49,57]],3);d.line([[24,14],[24,29]],1.4);d.line([[40,14],[40,29]],1.4);break;
 case 'armchair':d.path('M 16 40 L 16 18 Q 17 10 25 11 L 43 11 Q 50 12 49 19 L 49 41 Z',P.sage);d.rect(12,35,41,16,P.sage);d.rect(7,28,10,23,P.green);d.rect(48,28,10,23,P.green);d.line([[17,52],[16,57]],3);d.line([[49,52],[50,57]],3);break;
 case 'stool':d.ellipse(32,26,21,9,P.wood);d.line([[17,32],[14,55]],3);d.line([[47,32],[50,55]],3);d.line([[32,35],[32,54]],2.5);break;
 case 'shelf':case 'small-shelf':case 'dresser':d.rect(12,8,40,48,P.wood);for(const y of[23,39])d.line([[14,y],[50,y]],2);if(id==='dresser'){for(const y of[16,31,47])d.line([[28,y],[36,y]],2,P.paper);}else{d.rect(17,12,9,10,P.sage);d.rect(31,10,14,12,P.ochre);if(id==='shelf'){d.rect(18,29,15,9,P.blue);d.rect(36,26,10,12,P.paper);}d.rect(18,45,26,9,P.paper);}break;
 case 'flower-pot':d.shape([[18,37],[47,37],[43,55],[22,55]],P.red);d.line([[32,37],[32,19]],2,P.green);d.ellipse(32,18,9,9,P.ochre);d.ellipse(32,18,3,3,P.red);d.path('M 31 33 Q 16 32 18 24 Q 28 23 31 33 Z',P.sage);break;
 case 'horseshoes':d.path('M 12 10 L 23 10 L 22 34 Q 21 45 32 45 Q 43 45 42 34 L 41 10 L 52 10 L 54 34 Q 55 57 32 58 Q 8 56 10 34 Z',P.silver);for(const x of[16,48])for(const y of[18,29,39])d.ellipse(x,y,1.3,1.5,P.ink,0);break;
 case 'chess':d.shape([[15,55],[18,48],[25,44],[27,29],[20,27],[21,18],[39,8],[48,20],[36,30],[38,44],[46,49],[49,55]],P.paper);d.ellipse(36,18,1.5,1.5,P.ink,0);d.line([[21,49],[43,49]],1.4);break;
 case 'television':case 'computer':d.rect(7,15,49,32,P.stone);d.rect(12,19,34,23,P.darkBlue);d.ellipse(51,26,1.7,1.7,P.ochre);d.ellipse(51,35,1.7,1.7,P.paper);if(id==='television'){d.line([[26,15],[19,6]],2);d.line([[26,15],[36,5]],2);d.line([[16,48],[12,55]],2);d.line([[46,48],[50,55]],2);}else{d.shape([[12,49],[51,49],[57,57],[7,57]],P.paper);d.line([[18,53],[43,53]],1.2);}break;
 case 'thermometer':d.path('M 25 15 Q 25 6 33 8 Q 38 9 37 15 L 37 39 Q 48 50 37 57 Q 24 63 20 51 Q 18 45 25 39 Z',P.paper);d.ellipse(31,48,5,6,P.red,1.2);d.line([[31,19],[31,47]],3,P.red);for(const y of[17,25,33])d.line([[43,y],[50,y]],1.4);break;
 case 'vent':d.rect(8,15,48,35,P.stone);for(const y of[22,30,38,46])d.line([[14,y],[49,y-2]],2,P.darkBlue);break;
 case 'heater':d.rect(10,18,44,33,P.paper);for(const x of[17,27,37,47])d.rect(x,19,5,30,P.red);for(const x of[20,40])d.path(`M ${x} 13 Q ${x-4} 9 ${x+1} 5`,null,1.5,P.red);d.line([[15,51],[15,56]],2);d.line([[49,51],[49,56]],2);break;
 case 'cooler':d.rect(10,13,44,40,P.paper);d.ellipse(31,32,13,13,P.blue);for(let i=0;i<3;i++){const a=i*2*Math.PI/3;d.shape([[32,32],[32+Math.cos(a)*11,32+Math.sin(a)*11],[32+Math.cos(a+.9)*7,32+Math.sin(a+.9)*7]],P.darkBlue);}d.ellipse(32,32,2,2,P.paper);break;
 case 'passive-cooler':d.shape([[18,15],[47,15],[43,55],[22,55]],P.wood);d.ellipse(32,16,15,6,P.blue);for(const y of[29,41])d.line([[21,y],[44,y]],2);d.path('M 9 35 Q 2 26 9 19 M 55 38 Q 62 29 56 20',null,1.5,P.blue);break;
 case 'lamp':case 'sun-lamp':d.line([[32,31],[32,53]],4,P.wood);d.ellipse(32,55,15,3,P.wood);d.path('M 14 30 L 21 11 L 43 11 L 50 30 Z',id==='sun-lamp'?P.ochre:P.paper);d.line([[15,31],[49,31]],2);if(id==='sun-lamp')for(const x of[9,32,55])d.line([[x,35],[x+(x<32?-3:x>32?3:0),42]],1.5,P.ochre);break;
 case 'flame':case 'campfire':case 'torch-lamp':d.path('M 18 42 Q 7 31 25 21 Q 30 14 28 5 Q 44 13 41 28 Q 48 24 47 18 Q 62 40 43 49 Q 29 57 18 42 Z',P.red);d.path('M 24 43 Q 23 36 32 28 Q 44 42 35 48 Z',P.ochre,1.2);if(id==='torch-lamp')d.rect(26,48,12,12,P.wood);else{d.line([[14,57],[48,49]],4,P.wood);d.line([[16,49],[49,57]],4,P.wood);}break;
 case 'power':bolt(d);break;
 case 'wire':d.line([[6,49],[16,49],[16,16],[49,16],[49,48],[58,48]],3,P.darkBlue);d.ellipse(16,49,3,3,P.ochre);d.ellipse(49,16,3,3,P.ochre);break;
 case 'power-switch':d.rect(14,13,36,41,P.stone);d.ellipse(32,38,9,9,P.darkBlue);d.shape([[29,39],[24,13],[31,11],[36,37]],P.red);d.ellipse(28,12,5,4,P.red);break;
 case 'battery':d.rect(12,17,40,37,P.sage);d.rect(19,11,8,6,P.stone);d.rect(38,11,8,6,P.stone);d.line([[20,31],[29,31]],2);d.line([[24,27],[24,35]],2);d.line([[38,31],[46,31]],2);break;
 case 'solar':d.shape([[12,17],[49,17],[57,44],[6,44]],P.blue);for(const x of[23,36])d.line([[x,18],[x+4,43]],1.2,P.paper);d.line([[10,30],[52,30]],1.2,P.paper);d.line([[25,45],[22,56],[42,56],[38,45]],2);d.ellipse(50,8,4,4,P.ochre);break;
 case 'wind':d.line([[32,27],[29,56],[36,56],[33,27]],2,P.stone);d.shape([[31,25],[27,6],[33,3],[35,25]],P.paper);d.shape([[34,27],[54,34],[53,40],[33,31]],P.paper);d.shape([[30,29],[13,43],[8,39],[28,26]],P.paper);d.ellipse(32,27,4,4,P.wood);break;
 case 'wood-generator':case 'chemfuel-generator':case 'geothermal-generator':d.rect(10,27,44,26,P.sage);d.rect(17,33,17,14,P.darkBlue);d.rect(41,16,8,12,P.stone);if(id==='wood-generator'){d.shape([[12,18],[17,12],[34,20],[29,26]],P.wood);d.line([[18,17],[29,22]],1,P.paper);}else if(id==='geothermal-generator'){d.path('M 17 23 Q 12 16 19 8 M 29 23 Q 23 15 31 7',null,2,P.blue);}else d.rect(12,9,19,18,P.red);bolt(d,42,40,.4);break;
 case 'growing':case 'hydroponics':sprout(d);if(id==='hydroponics'){d.shape([[8,43],[56,43],[51,56],[13,56]],P.blue);d.line([[16,48],[48,48]],1.4,P.paper);}else d.path('M 9 54 Q 32 51 55 54',null,2,P.wood);break;
 case 'stockpile':d.shape([[9,24],[31,13],[55,24],[55,48],[33,58],[9,46]],P.ochre);d.line([[9,24],[33,35],[55,24]],1.7);d.line([[33,35],[33,58]],1.7);d.line([[21,19],[44,30]],2,P.paper);break;
 case 'roof':case 'roof-ignore':d.shape([[6,32],[31,10],[58,31],[52,38],[32,20],[12,39]],P.red);d.line([[17,35],[17,53]],2.5,P.wood);d.line([[48,35],[48,53]],2.5,P.wood);if(id==='roof-ignore')d.line([[23,48],[43,48]],3,P.ochre);break;
 case 'home':d.shape([[13,30],[32,13],[52,30],[51,55],[13,55]],P.paper);d.shape([[6,31],[31,9],[58,31],[53,36],[32,19],[11,37]],P.red);d.rect(27,37,12,18,P.wood);break;
 case 'snow':for(let i=0;i<3;i++){const a=i*Math.PI/3,x=Math.cos(a)*23,y=Math.sin(a)*23;d.line([[32-x,32-y],[32+x,32+y]],2,P.darkBlue);for(const s of[-1,1]){const bx=32+x*s*.65,by=32+y*s*.65;d.line([[bx-x*s*.22-y*.2,by-y*s*.22+x*.2],[bx,by],[bx-x*s*.22+y*.2,by-y*s*.22-x*.2]],1.5,P.darkBlue);}}break;
 case 'bridge':d.rect(7,26,50,15,P.wood);for(const x of[16,26,36,46])d.line([[x,27],[x,40]],1.2);d.line([[10,18],[55,18]],2.3);for(const x of[11,32,53])d.line([[x,17],[x,48]],2.3);d.path('M 5 54 Q 15 49 25 54 Q 35 59 45 54 Q 53 49 60 54',null,1.5,P.blue);break;
 case 'grave':case 'stele-large':case 'stele-grand':d.path('M 15 55 L 15 24 Q 15 9 31 8 Q 48 8 49 24 L 49 55 Z',P.stone);d.line([[24,27],[40,27]],2.2);d.line([[32,20],[32,40]],2.2);d.line([[9,56],[55,56]],2,P.green);break;
 case 'casket':case 'ship-casket':d.path('M 20 7 L 44 7 L 51 17 L 51 55 L 13 55 L 13 17 Z',P.stone);d.rect(21,14,22,31,P.blue);d.ellipse(32,25,4,5,P.paper);d.path('M 26 42 L 26 34 Q 32 29 38 34 L 38 42 Z',P.paper,1.3);d.line([[24,50],[40,50]],2,P.ochre);if(id==='ship-casket'){d.rect(7,21,6,22,P.sage);d.rect(51,21,6,22,P.sage);}break;
 case 'workbench':case 'machining':case 'crafting':case 'tailor':case 'electric-tailor':case 'research-desk':case 'hi-tech-desk':case 'art-workbench':case 'butcher':case 'butcher-spot':case 'stonecutter':case 'fabrication':
  worktop(d);if(/tailor/.test(id)){d.path('M 17 31 L 17 17 L 39 17 Q 47 17 47 25 L 47 31 L 40 31 L 40 23 L 27 23 L 27 31 Z',P.stone);d.line([[21,23],[21,33]],1.4);if(id==='electric-tailor')bolt(d,52,18,.3);}
  else if(/research|hi-tech/.test(id)){if(id==='hi-tech-desk'){d.rect(29,10,22,20,P.stone);d.rect(32,13,16,13,P.darkBlue);d.line([[40,30],[40,34]],2);}else {d.shape([[11,20],[24,16],[35,20],[35,33],[22,30],[11,33]],P.paper);d.line([[24,18],[24,30]],1.3);}d.ellipse(47,26,6,7,P.blue);}
  else if(id==='art-workbench'){d.shape([[26,31],[23,24],[30,16],[31,9],[38,9],[40,18],[46,23],[43,31]],P.stone);d.line([[11,29],[21,12]],3,P.wood);}
  else if(/butcher/.test(id)){d.path('M 18 31 Q 9 16 22 14 Q 38 10 38 23 Q 36 34 18 31 Z',P.red);d.shape([[41,26],[48,10],[54,14],[47,29]],P.silver);}
  else if(id==='stonecutter'){rock(d,P.stone);d.line([[12,36],[53,36]],3,P.wood);}
  else if(id==='fabrication'){d.rect(18,12,29,19,P.sage);d.rect(26,17,12,10,P.darkBlue);for(const x of[22,32,42])d.line([[x,8],[x,12]],1.6);}
  else {d.line([[16,29],[35,10]],4,P.wood);d.shape([[28,8],[34,4],[47,16],[41,22]],P.silver);if(id==='machining')d.rect(39,23,11,9,P.blue);}break;
 case 'anvil':case 'smithy':case 'electric-smithy':d.path('M 6 20 L 56 20 L 48 31 L 36 34 L 39 47 L 50 53 L 14 53 L 24 46 L 26 34 L 15 31 Z',P.stone);d.rect(16,14,36,7,P.silver);if(id==='electric-smithy')bolt(d,51,10,.3);break;
 case 'cooking-pot':case 'wood-stove':case 'electric-stove':d.rect(11,30,43,26,P.stone);d.ellipse(32,27,17,6,P.paper);d.rect(18,19,28,11,P.red);d.line([[15,19],[49,19]],2);d.ellipse(32,17,3,2,P.wood);d.line([[7,25],[17,25]],2);d.line([[47,25],[57,25]],2);d.rect(20,38,23,12,id==='wood-stove'?P.red:P.darkBlue);if(id==='electric-stove')bolt(d,50,10,.32);break;
 case 'drug-lab':d.rect(8,48,49,7,P.wood);d.path('M 13 43 L 23 23 L 23 12 L 31 12 L 31 23 L 41 43 Z',P.blue);d.rect(43,18,9,27,P.plum);d.rect(42,14,11,5,P.stone);d.ellipse(27,33,2,2,P.paper);break;
 case 'smelter':case 'crematorium':d.path('M 12 56 L 12 22 L 21 12 L 51 12 L 54 56 Z',P.stone);d.rect(20,24,27,24,P.darkBlue);d.path('M 24 43 Q 19 35 30 30 Q 34 26 32 23 Q 44 33 41 43 Z',P.red);d.rect(38,4,10,8,P.stone);if(id==='crematorium')d.line([[25,51],[43,51]],2,P.paper);else d.shape([[9,50],[5,57],[19,57]],P.ochre);break;
 case 'brewer':case 'brewery':case 'barrel':case 'fermenting-barrel':d.path('M 18 10 Q 32 6 46 10 Q 57 32 46 54 Q 32 59 18 54 Q 7 32 18 10 Z',P.wood);for(const y of[19,44])d.rect(14,y,36,5,P.stone);d.path('M 26 11 Q 21 32 26 54 M 38 11 Q 43 32 38 54',null,1.2);if(id==='brewery'){d.rect(42,30,15,17,P.ochre);d.ellipse(49,29,8,4,P.paper);}break;
 case 'refinery':d.rect(12,18,17,35,P.silver);d.rect(36,11,16,42,P.sage);d.line([[20,18],[20,8],[44,8],[44,11]],3,P.stone);d.line([[29,31],[36,31]],4,P.stone);d.ellipse(21,39,5,7,P.ochre);break;
 case 'hopper':d.shape([[7,17],[57,17],[46,48],[19,48]],P.stone);d.ellipse(32,17,25,7,P.ochre);d.line([[19,48],[17,56]],2.5);d.line([[46,48],[48,56]],2.5);break;
 case 'paste-dispenser':d.rect(12,9,40,46,P.sage);d.rect(18,15,28,15,P.darkBlue);d.rect(21,35,22,15,P.paper);d.line([[32,30],[32,37]],3,P.stone);d.path('M 26 40 Q 30 35 34 40 Q 39 37 39 44 L 25 44 Z',P.ochre);break;
 case 'ship-sensors':d.line([[32,39],[32,55]],3,P.stone);d.line([[19,55],[47,55]],3,P.stone);d.path('M 11 18 Q 25 52 51 29 Z',P.blue);d.line([[29,33],[46,12]],2);d.ellipse(47,10,3,3,P.ochre);d.path('M 51 10 Q 58 12 58 19 M 52 4 Q 63 6 63 18',null,1.5,P.blue);break;
 case 'beacon':d.line([[32,20],[32,53]],3,P.stone);d.rect(22,49,21,8,P.sage);d.ellipse(32,17,4,4,P.ochre);d.path('M 24 26 Q 14 16 24 7 M 40 26 Q 50 16 40 7 M 17 32 Q 1 16 17 2 M 47 32 Q 63 16 47 2',null,1.8,P.blue);break;
 case 'radar':d.rect(11,10,42,35,P.stone);d.ellipse(32,27,13,13,P.darkBlue);d.line([[32,27],[39,17]],1.8,P.sage);d.ellipse(27,31,2,2,P.sage,0);d.line([[20,49],[45,49]],1.5,P.wood);for(const x of[22,42])d.line([[x,52],[x,60],[x-3,57],[x,60],[x+3,57]],1.6,P.blue);break;
 case 'analyzer':d.rect(19,8,28,45,P.stone);d.rect(25,15,16,23,P.blue);d.ellipse(33,27,5,8,P.paper);d.ellipse(28,45,2,2,P.ochre);d.ellipse(39,45,2,2,P.green);d.line([[12,55],[53,55]],3,P.stone);d.path('M 19 33 L 10 33 L 10 22 M 47 33 L 57 33 L 57 22',null,2,P.wood);break;
 case 'drill':d.rect(12,11,39,17,P.sage);d.line([[18,28],[18,54]],3,P.stone);d.line([[47,28],[47,54]],3,P.stone);d.line([[32,28],[32,55]],6,P.silver);for(const y of[31,38,45])d.line([[27,y],[37,y+5]],2,P.darkBlue);d.shape([[27,52],[37,52],[32,60]],P.silver);break;
 case 'foam':d.rect(20,17,25,35,P.paper);d.rect(25,10,15,7,P.red);d.rect(22,6,21,4,P.stone);d.ellipse(32,34,8,8,P.sage);d.line([[27,34],[37,34]],2,P.paper);d.line([[32,29],[32,39]],2,P.paper);for(const[x,y]of[[15,51],[27,55],[43,54],[51,47]])d.ellipse(x!,y!,6,5,P.paper);break;
 case 'ship-beam':d.rect(16,7,32,50,P.stone);for(const y of[12,26,40]){d.rect(19,y,26,8,P.silver);d.line([[21,y+2],[42,y+6]],1.1);}d.line([[21,56],[43,56]],2);break;
 case 'ship-engine':d.rect(17,9,31,33,P.stone);d.rect(21,14,23,16,P.blue);d.shape([[18,41],[48,41],[54,53],[12,53]],P.darkBlue);d.path('M 24 54 L 24 60 M 32 54 L 32 62 M 41 54 L 41 60',null,2.5,P.ochre);break;
 case 'reactor':case 'ship-reactor':d.ellipse(32,32,24,24,P.stone);d.ellipse(32,32,17,17,P.paper);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;d.shape([[32+Math.cos(a)*8,32+Math.sin(a)*8],[32+Math.cos(a-.35)*17,32+Math.sin(a-.35)*17],[32+Math.cos(a+.35)*17,32+Math.sin(a+.35)*17]],P.ochre);}d.ellipse(32,32,4,4,P.darkBlue);break;
 case 'rocket':d.path('M 25 46 L 24 24 Q 25 11 32 5 Q 40 12 41 25 L 40 46 Z',P.paper);d.ellipse(32,25,5,6,P.blue);d.shape([[25,35],[14,48],[24,48]],P.red);d.shape([[40,35],[50,48],[40,48]],P.red);d.path('M 27 49 Q 25 55 32 60 Q 39 55 37 49',P.ochre);break;
 case 'ship-computer':case 'chip':case 'ai-core':d.rect(16,16,33,33,P.sage);d.rect(24,24,17,17,P.darkBlue);for(const n of[22,32,42]){d.line([[n,8],[n,15]],2);d.line([[n,49],[n,57]],2);d.line([[8,n],[15,n]],2);d.line([[49,n],[57,n]],2);}if(id==='ai-core')d.ellipse(32,32,5,5,P.blue);break;
 case 'palette':d.path('M 30 9 C 5 8 2 44 24 53 Q 40 60 44 49 Q 43 42 51 40 C 64 38 57 12 39 10 Z',P.wood);for(const[x,y,c]of[[20,24,P.red],[31,18,P.ochre],[44,23,P.blue],[17,38,P.green]]as const)d.ellipse(x,y,4,4,c,1);d.ellipse(35,43,4,5,P.paper);break;
 case 'sculpture':case 'large-sculpture':d.rect(15,51,35,6,P.wood);d.path('M 20 49 L 24 33 Q 15 27 25 20 L 26 12 Q 33 4 39 13 L 37 22 Q 49 28 40 36 L 44 49 Z',P.stone);if(id==='large-sculpture')d.line([[50,9],[50,37]],2,P.ochre);break;
 case 'column':d.rect(15,8,34,7,P.paper);d.rect(21,15,22,36,P.stone);for(const x of[27,36])d.line([[x,19],[x,47]],1.2);d.rect(14,51,36,7,P.paper);break;
 case 'urn':d.path('M 22 9 L 42 9 L 41 16 Q 58 24 48 43 L 39 51 L 40 57 L 24 57 L 25 51 Q 8 40 13 26 Q 15 19 23 16 Z',P.ochre);d.line([[21,17],[43,17]],1.5);d.line([[20,44],[44,44]],1.5);break;
 case 'sarcophagus':d.shape([[22,7],[42,7],[51,20],[47,57],[17,57],[13,20]],P.stone);d.ellipse(32,20,6,7,P.ochre);d.path('M 25 29 L 40 29 L 42 48 L 23 48 Z',P.ochre);d.line([[25,34],[40,43]],1.4);d.line([[39,34],[25,43]],1.4);break;
 case 'ancient-road-barrier':d.rect(7,22,50,16,P.stone);d.line([[14,38],[14,55]],4);d.line([[50,38],[50,55]],4);for(const x of[16,32,48])d.line([[x-5,36],[x+3,24]],3,P.ochre);break;
 case 'ancient-road-lamp':d.line([[29,56],[29,11],[46,11],[46,19]],4,P.stone);d.path('M 38 21 L 53 21 L 50 34 L 41 34 Z',P.ochre);break;
 case 'wood':d.shape([[11,37],[41,15],[54,31],[24,53]],P.wood);d.ellipse(17,45,10,9,P.ochre);d.ellipse(17,45,5,4,P.wood,1.2);d.line([[28,33],[45,21]],1.3,P.paper);break;
 case 'steel':case 'plasteel':case 'silver':case 'gold':case 'uranium':d.shape([[9,40],[17,23],[45,23],[56,40],[50,49],[15,49]],stoneColors[id]??color);d.line([[9,40],[56,40]],1.4);d.line([[17,24],[24,40]],1.3);break;
 case 'blocks':d.rect(8,34,24,16,color);d.rect(33,34,24,16,color);d.rect(20,17,25,16,color);d.line([[12,38],[27,38]],1.1,P.paper);d.line([[24,21],[40,21]],1.1,P.paper);break;
 case 'chunk':case 'legacy-chunk':rock(d,color);break;
 case 'component':case 'advanced-component':d.rect(11,17,42,31,id==='advanced-component'?P.blue:P.ochre);d.ellipse(25,32,9,9,P.stone);d.ellipse(25,32,3,3,P.paper);d.rect(40,22,7,19,P.darkBlue);for(const x of[19,31,43])d.line([[x,11],[x,17]],2);break;
 case 'medicine':case 'herbal-medicine':case 'glitterworld-medicine':d.rect(10,19,44,34,id==='herbal-medicine'?P.sage:id==='glitterworld-medicine'?P.plum:P.blue);d.rect(24,11,16,8,P.paper);d.line([[23,36],[41,36]],5,P.paper);d.line([[32,27],[32,45]],5,P.paper);break;
 case 'rice':case 'corn':case 'hay':case 'haygrass':wheat(d);if(id==='hay')d.line([[15,42],[46,42]],3,P.wood);break;
 case 'potato':case 'agave-fruit':d.ellipse(25,36,17,12,P.wood);d.ellipse(43,28,13,11,P.ochre);for(const[x,y]of[[16,34],[28,40],[44,24]])d.line([[x!,y!],[x!+2,y!]],1.5);break;
 case 'berries':case 'hops':for(const[x,y]of[[23,25],[38,20],[19,39],[33,36],[45,32],[34,49]])d.ellipse(x!,y!,7,7,id==='hops'?P.sage:P.plum);d.path('M 31 19 Q 32 5 46 7 Q 47 17 31 19 Z',P.green);break;
 case 'meal':case 'legacy-portion':
  if(original.includes('survival')){d.path('M 13 9 L 51 9 L 48 17 L 51 55 L 13 55 L 16 17 Z',P.ochre);d.line([[17,14],[47,14]],1.4);d.line([[17,50],[47,50]],1.4);d.ellipse(32,33,12,9,P.paper);d.line([[25,33],[39,33]],1.3);break;}
  d.ellipse(32,36,25,18,P.paper);d.ellipse(32,35,20,13,P.wood,1.2);
  if(original.includes('nutrient-paste')){d.path('M 18 40 Q 12 29 24 29 Q 24 20 35 26 Q 47 21 47 35 L 45 43 Z',P.sage);d.path('M 23 35 Q 31 29 40 35',null,1.4,P.paper);break;}
  if(original.includes('carnivore')){d.path('M 18 40 Q 12 25 27 26 Q 42 16 47 31 Q 52 44 35 44 Z',P.red);d.ellipse(34,33,4,5,P.paper,1.2);}else{d.path('M 20 39 Q 13 27 26 26 Q 33 18 40 27 Q 53 28 43 41 Z',P.ochre);d.ellipse(24,34,4,3,P.green,1);d.ellipse(40,32,4,3,P.red,1);}
  if(original.includes('vegetarian')){d.path('M 27 40 Q 24 30 36 28 Q 41 39 27 40 Z',P.sage,1.2);}
  if(original.includes('lavish')){d.ellipse(33,45,4,2,original.includes('carnivore')?P.red:P.green,1);d.ellipse(23,25,3,3,original.includes('carnivore')?P.red:P.plum,1);}break;
 case 'pemmican':case 'kibble':d.path('M 8 32 L 56 32 Q 53 52 32 53 Q 11 51 8 32 Z',P.wood);for(const[x,y]of[[18,27],[27,30],[37,25],[46,29],[30,21]])d.ellipse(x!,y!,5,4,P.ochre);break;
 case 'meat':d.path('M 12 40 Q 4 18 23 15 Q 43 7 54 25 Q 63 43 43 50 Q 20 59 12 40 Z',P.red);d.path('M 16 38 Q 10 23 25 20 Q 42 14 49 27 Q 55 41 40 45 Q 22 52 16 38 Z',P.red,2.3,P.paper);d.ellipse(36,31,6,7,P.paper);break;
 case 'egg':d.path('M 15 39 C 14 24 25 8 32 8 C 41 9 52 26 50 41 Q 48 55 32 56 Q 16 55 15 39 Z',P.paper);break;
 case 'raw-fungus':d.path('M 25 32 L 40 32 L 43 54 Q 32 59 22 54 Z',P.paper);d.path('M 7 33 C 4 6 53 0 58 32 Q 34 40 7 33 Z',P.red);for(const[x,y]of[[20,22],[34,16],[46,25]])d.ellipse(x!,y!,3,2,P.paper,0);break;
 case 'insect-jelly':d.ellipse(32,49,24,7,P.paper);d.path('M 11 47 C 6 35 23 37 23 26 C 24 17 37 16 37 27 C 36 35 55 29 54 44 Q 52 53 32 52 Q 16 54 11 47 Z',P.ochre);d.path('M 28 26 Q 27 21 32 22',null,1.8,P.paper);break;
 case 'jade':d.shape([[10,40],[17,17],[39,10],[55,30],[44,53],[23,55]],'#89a78b');d.line([[17,17],[31,31],[39,10]],1.2);d.line([[31,31],[44,53]],1.2);d.line([[31,31],[10,40]],1.2);break;
 case 'milk':case 'neutroamine':case 'chemfuel':case 'wort':d.rect(22,7,20,10,P.stone);d.path('M 22 17 L 42 17 L 49 27 L 49 54 L 15 54 L 15 27 Z',id==='chemfuel'?P.red:id==='wort'?P.ochre:P.paper);if(id==='chemfuel')bolt(d,32,37,.5);else d.ellipse(32,36,8,10,id==='milk'?P.blue:P.sage);break;
 case 'beer':d.rect(13,17,31,36,P.ochre);d.path('M 45 22 Q 62 18 57 40 Q 55 46 45 43',null,3,P.wood);for(const x of[18,27,36])d.ellipse(x,17,6,5,P.paper);d.line([[21,29],[21,44]],1.4,P.paper);break;
 case 'cloth':case 'leather':d.path('M 11 15 L 44 12 L 53 46 L 19 53 L 16 44 L 10 45 L 13 34 L 8 28 Z',color);d.path('M 16 20 L 40 18 L 46 42 L 22 46 Z',null,1,P.paper);break;
 case 'wool':for(const[x,y]of[[21,23],[36,19],[45,30],[37,42],[22,44],[14,33]])d.ellipse(x!,y!,11,10,color,1.4);d.ellipse(30,32,12,12,color,1.4);d.path('M 20 29 Q 31 21 39 30 M 18 36 Q 31 29 41 37',null,1.2,P.paper);break;
 case 'shirt':case 'tribalwear':case 'parka':case 'duster':d.path(`M 23 11 L 15 15 L 5 29 L 15 36 L 21 28 L 20 ${id==='duster'?58:52} L 45 ${id==='duster'?58:52} L 44 28 L 49 36 L 59 29 L 49 15 L 41 11 Q 32 20 23 11 Z`,color);d.path('M 25 13 Q 32 24 39 13',null,1.3,P.paper);if(id==='parka'){d.path('M 21 14 Q 17 2 32 3 Q 47 2 44 15',null,5,P.paper);}if(id==='duster'||id==='parka')d.line([[32,22],[32,51]],1.3);break;
 case 'pants':d.shape([[17,10],[47,10],[50,55],[34,55],[31,31],[28,55],[13,55]],color);d.line([[18,18],[46,18]],1.3,P.paper);d.line([[32,13],[32,23]],1.2);break;
 case 'tuque':d.path('M 14 40 Q 11 13 32 12 Q 53 13 51 40 Z',color);d.rect(10,39,45,13,color);for(const x of[19,29,39,48])d.line([[x,42],[x,49]],1.1,P.paper);d.ellipse(32,8,5,5,color);break;
 case 'flak-vest':case 'plate-armor':case 'recon-armor':case 'shield':d.path('M 22 10 L 15 15 L 10 33 L 19 36 L 18 54 L 46 54 L 45 36 L 54 33 L 49 15 L 42 10 Q 32 22 22 10 Z',id==='shield'?P.blue:color);d.line([[23,27],[41,27]],2,P.paper);d.line([[23,35],[41,35]],2,P.paper);d.line([[32,23],[32,49]],1.4);break;
 case 'flak-helmet':case 'recon-helmet':case 'simple-helmet':d.path('M 10 36 Q 11 10 32 10 Q 54 12 54 38 L 49 41 L 45 50 L 36 50 L 36 36 Z',color);d.line([[11,37],[45,36]],3,P.paper);if(id==='recon-helmet')d.rect(35,28,22,10,P.blue);break;
 case 'revolver':case 'bolt-action-rifle':case 'emp-launcher':d.shape([[8,23],[55,23],[55,32],[32,32],[27,40],[22,39],[17,55],[7,51],[15,33],[8,33]],P.stone);d.rect(7,24,14,9,P.wood);d.line([[30,32],[30,40],[24,40]],1.5);if(id==='bolt-action-rifle'){d.rect(39,19,20,5,P.darkBlue);}if(id==='emp-launcher')d.ellipse(48,28,8,8,P.blue);break;
 case 'plasteel-knife':case 'knife':case 'longsword':case 'spear':case 'mace':{
  const material=item?color:P.silver;
  if(id==='spear'){d.line([[9,57],[42,23]],4,P.wood);d.shape([[35,22],[55,5],[48,32],[41,29]],material);d.line([[41,25],[50,14]],1.1,P.paper);break;}
  d.shape([[12,56],[8,52],[26,34],[31,39]],P.wood);
  if(id==='mace'){d.line([[28,37],[44,17]],5,P.wood);d.ellipse(46,15,11,11,material);for(const[x,y]of[[35,11],[48,4],[58,17]])d.ellipse(x!,y!,3,3,material);}
  else if(id==='knife'||id==='plasteel-knife'){d.path('M 25 34 Q 34 18 54 16 Q 51 29 32 40 Z',material);d.line([[24,32],[33,40]],2.5,P.wood);}
  else{d.shape([[27,34],[47,11],[57,6],[52,17],[32,40]],material);d.line([[23,29],[37,43]],3,P.ochre);}break;
 }
 case 'prosthetic-leg':case 'prosthetic-arm':d.shape(id==='prosthetic-leg'?[[23,7],[39,7],[36,31],[42,36],[40,49],[53,53],[52,59],[27,57],[28,36],[22,31]]:[[17,9],[30,8],[33,29],[46,39],[43,47],[27,40],[21,34]],P.stone);d.ellipse(id==='prosthetic-leg'?33:29,32,5,5,P.ochre);break;
 case 'minified-tree':tree(d,'tree');d.ellipse(32,53,15,7,P.wood);break;
 case 'passion':d.path('M 18 47 Q 8 35 22 24 Q 31 17 29 6 Q 44 14 40 28 Q 46 24 47 17 Q 60 40 43 51 Q 27 61 18 47 Z',P.red);d.path('M 25 48 Q 20 39 32 31 Q 44 43 35 52 Z',P.ochre,1);break;
 case 'eye':d.path('M 5 32 Q 31 5 59 32 Q 32 59 5 32 Z',P.paper);d.ellipse(32,32,11,12,P.blue);d.ellipse(32,32,4,5,P.ink,0);break;
 case 'camera':d.path('M 7 22 L 20 22 L 25 14 L 42 14 L 46 22 L 57 22 L 57 52 L 7 52 Z',P.sage);d.ellipse(33,36,12,12,P.paper);d.ellipse(33,36,7,7,P.blue);d.rect(10,16,10,6,P.wood);d.ellipse(50,27,2,2,P.ochre,0);break;
 case 'season-spring':sprout(d);d.path('M 10 55 Q 32 51 54 55',null,1.8,P.wood);break;
 case 'season-summer':d.ellipse(32,32,16,16,P.ochre);for(let i=0;i<8;i++){const a=i*Math.PI/4;d.line([[32+Math.cos(a)*21,32+Math.sin(a)*21],[32+Math.cos(a)*27,32+Math.sin(a)*27]],1.7,P.wood);}break;
 case 'season-autumn':d.path('M 32 6 L 38 20 L 52 15 L 47 29 L 59 35 L 42 42 L 32 56 L 27 42 L 8 34 L 20 28 L 16 14 L 29 20 Z',P.red);d.path('M 32 21 Q 31 39 28 58 M 31 39 L 21 32 M 32 33 L 43 27',null,1.5,P.wood);break;
 case 'season-winter':for(let i=0;i<3;i++){const a=i*Math.PI/3,x=Math.cos(a)*23,y=Math.sin(a)*23;d.line([[32-x,32-y],[32+x,32+y]],2,P.darkBlue);for(const s of[-1,1]){const bx=32+x*s*.65,by=32+y*s*.65;d.line([[bx-x*s*.22-y*.2,by-y*s*.22+x*.2],[bx,by],[bx-x*s*.22+y*.2,by-y*s*.22-x*.2]],1.5,P.darkBlue);}}break;
 case 'sun':d.ellipse(32,32,16,16,P.ochre);for(let i=0;i<8;i++){const a=i*Math.PI/4;d.line([[32+Math.cos(a)*21,32+Math.sin(a)*21],[32+Math.cos(a)*27,32+Math.sin(a)*27]],1.7,P.wood);}break;
 case 'moon':d.path('M 42 5 C 4 3 1 52 31 59 Q 42 62 48 55 C 17 49 19 17 42 5 Z',P.paper);d.path('M 19 30 Q 15 36 20 42',null,1.5,P.wood);break;
 case 'eclipse':d.ellipse(32,32,25,25,P.ochre);d.ellipse(36,30,20,21,P.darkBlue);break;
 case 'fog':case 'rain':case 'dry-storm':case 'rain-storm':case 'weather-snow':
  d.path('M 7 37 Q 1 25 16 22 Q 19 8 33 14 Q 46 6 52 22 Q 64 23 59 37 Q 41 42 7 37 Z',P.paper);d.path('M 14 33 Q 31 35 51 33',null,1.3,P.blue);
  if(id==='rain'||id==='rain-storm')for(const x of id==='rain'?[15,33,50]:[15,51])d.path(`M ${x} 45 Q ${x-8} 57 ${x} 58 Q ${x+8} 57 ${x} 45 Z`,P.blue,1.2);
  if(id==='dry-storm'||id==='rain-storm')bolt(d,34,48,.45);
  if(id==='weather-snow')for(const[x,y]of[[15,51],[33,55],[51,49]]){d.line([[x!-4,y!],[x!+4,y!]],1.4,P.darkBlue);d.line([[x!,y!-4],[x!,y!+4]],1.4,P.darkBlue);d.line([[x!-3,y!-3],[x!+3,y!+3]],1.1,P.darkBlue);}
  if(id==='fog'){d.line([[8,48],[48,48]],2,P.blue);d.line([[20,57],[58,57]],2,P.blue);}break;
 case 'play':
  d.path('M 21 12 Q 19 10 19 14 Q 20 32 19 51 Q 19 55 22 53 Q 37 44 52 33 Q 55 31 51 29 Q 36 20 21 12 Z',P.green);
  d.path('M 24 19 Q 23 30 24 42',null,1.4,P.sage);break;
 case 'pause':
  d.path('M 17 12 Q 21 11 26 12 Q 27 31 26 52 Q 22 54 16 52 Q 17 32 16 15 Q 16 12 17 12 Z',P.blue);
  d.path('M 39 11 Q 43 12 48 11 Q 47 32 48 51 Q 44 53 38 52 Q 39 32 38 14 Q 38 11 39 11 Z',P.blue);
  d.path('M 20 18 Q 19 31 20 44',null,1.3,'#b7c6bf');
  d.path('M 42 17 Q 41 31 42 43',null,1.3,'#b7c6bf');break;
 case 'speed-double':case 'speed-triple':{
  const count=id==='speed-double'?2:3,w=count===2?21:15;
  for(let i=0;i<count;i++){
   const x=6+i*(w+2),top=14+(i%2),bottom=51-(i%2),tip=32+(i%2);
   d.path(`M ${x+1} ${top} Q ${x-1} ${top-1} ${x} ${top+3} Q ${x+1} 32 ${x} ${bottom-2} Q ${x-1} ${bottom+1} ${x+2} ${bottom-1} Q ${x+w*.6} 41 ${x+w-1} ${tip+1} Q ${x+w+1} ${tip} ${x+w-1} ${tip-2} Q ${x+w*.55} 22 ${x+1} ${top} Z`,P.blue);
   d.path(`M ${x+4} ${top+9} Q ${x+3} 31 ${x+4} ${bottom-10}`,null,1.1,'#b7c6bf');
  }break;
 }
 case 'hourglass':d.path('M 17 9 L 47 9 Q 47 23 36 31 Q 47 41 47 55 L 17 55 Q 17 41 28 31 Q 17 22 17 9 Z',P.paper);d.path('M 20 14 L 44 14 Q 43 23 32 29 Q 22 22 20 14 Z',P.ochre,1);d.path('M 20 52 Q 22 43 32 37 Q 44 45 44 52 Z',P.ochre,1);d.line([[13,8],[51,8]],3,P.wood);d.line([[13,56],[51,56]],3,P.wood);break;
 case 'save':d.shape([[11,10],[44,10],[54,20],[54,55],[11,55]],P.blue);d.rect(20,11,22,15,P.paper);d.rect(20,36,26,18,P.paper);d.line([[26,42],[40,42]],1.2);break;
 case 'load':case 'export':d.path('M 9 34 L 9 54 L 55 54 L 55 34',null,2.7);if(id==='load'){d.line([[32,8],[32,42]],3,P.blue);d.line([[21,31],[32,42],[43,31]],3,P.blue);}else{d.line([[32,42],[32,8]],3,P.green);d.line([[21,19],[32,8],[43,19]],3,P.green);}break;
 case 'copy':case 'paste':d.rect(10,9,31,37,P.wood);d.rect(23,21,31,37,P.paper);if(id==='paste'){d.rect(31,17,15,8,P.stone);d.line([[29,37],[47,37]],1.4);d.line([[29,46],[43,46]],1.4);}break;
 case 'back':d.line([[53,32],[10,32]],3);d.line([[25,17],[10,32],[25,47]],3);break;
 case 'rotate-left':case 'rotate-right':{const right=id==='rotate-right';d.path(right?'M 11 46 C 0 10 54 0 54 31':'M 53 46 C 64 10 10 0 10 31',null,2.8);d.line(right?[[43,22],[54,32],[59,18]]:[[5,18],[10,32],[21,22]],2.8);break;}
 case 'information':d.ellipse(32,32,24,24,P.paper);d.ellipse(32,20,2,2,P.darkBlue,0);d.line([[32,29],[32,46]],3,P.darkBlue);break;
 case 'plus':d.line([[12,32],[52,32]],3);d.line([[32,12],[32,52]],3);break;
 case 'minus':d.line([[12,32],[52,32]],3);break;
 default:
  // All existing animal-derived textiles/food are handled above. Extra future
  // content must get an explicit symbol before it can enter the generated set.
  if(item&&/^(?:animal|corpse|mech-corpse)$/.test(String(ITEM_DEFINITIONS[original.slice(5) as keyof typeof ITEM_DEFINITIONS]?.kind)))animal(d,original,color);
  else {cache.set(original,null);return;}
 }
 if(remove){d.ellipse(49,49,11,11,P.paper,1.8,P.red);d.line([[44,44],[54,54]],2.6,P.red);d.line([[44,54],[54,44]],2.6,P.red);}
 if(unfinished){d.ellipse(49,49,10,10,P.paper);d.line([[49,43],[49,49],[54,52]],1.8,P.wood);}
 const artwork={id:original,strokes:d.strokes};cache.set(original,artwork);return artwork;
}
const fittedBounds=new Map<string,{left:number;top:number;right:number;bottom:number}>();
/** Fit the actual painted silhouette, including its outline, inside a box. */
export function drawPictoInBox(ctx:CanvasRenderingContext2D,id:string,x:number,y:number,width:number,height:number,ink=P.ink):boolean {
 if(!Number.isFinite(x+y+width+height)||width<=0||height<=0)return false;
 const art=pictoArtwork(id);if(!art)return false;
 let bounds=fittedBounds.get(id);
 if(!bounds){bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};for(const stroke of art.strokes)for(const [px,py]of stroke.points){const pad=stroke.width/2;bounds.left=Math.min(bounds.left,px-pad);bounds.top=Math.min(bounds.top,py-pad);bounds.right=Math.max(bounds.right,px+pad);bounds.bottom=Math.max(bounds.bottom,py+pad);}fittedBounds.set(id,bounds);}
 const scale=Math.min(width/(bounds.right-bounds.left),height/(bounds.bottom-bounds.top));
 return drawPicto(ctx,id,x+width/2+(32-(bounds.left+bounds.right)/2)*scale,y+height/2+(32-(bounds.top+bounds.bottom)/2)*scale,27*scale,ink);
}
export function drawPicto(ctx:CanvasRenderingContext2D,id:string,cx:number,cy:number,r:number,ink=P.ink):boolean {
 if(!Number.isFinite(cx+cy+r)||r<=0)return false;const art=pictoArtwork(id);if(!art)return false;
 const scale=r/27;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 for(const shape of art.strokes){ctx.beginPath();shape.points.forEach(([x,y],i)=>{const px=cx+(x-32)*scale,py=cy+(y-32)*scale;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});if(shape.closed)ctx.closePath();if(shape.fill){ctx.fillStyle=shape.fill===P.ink?ink:shape.fill;ctx.fill();}if(shape.width>0){ctx.strokeStyle=shape.color===P.ink?ink:shape.color;ctx.lineWidth=shape.width*scale;ctx.stroke();}}
 ctx.restore();return true;
}
const n=(value:number)=>Number(value.toFixed(2));
export function pictoSvg(id:string):string|undefined {
 const art=pictoArtwork(id);if(!art)return;
 const item=art.id.startsWith('item-')?ITEM_DEFINITIONS[art.id.slice(5) as keyof typeof ITEM_DEFINITIONS]:undefined;
 const title=(item?.label??(art.id==='torch-lamp'?'Lampe-torche':art.id.replaceAll('-',' '))).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64" data-pictogram="${art.id}" data-art="adult-hand-20261107"><title>${title}</title><g stroke-linecap="round" stroke-linejoin="round">${art.strokes.map(s=>`<path d="${s.points.map(([x,y],i)=>`${i?'L':'M'}${n(x)} ${n(y)}`).join('')}${s.closed?'Z':''}" fill="${s.fill??'none'}" stroke="${s.width?s.color:'none'}" stroke-width="${s.width}"/>`).join('')}</g></svg>`;
}
export function pictoDataUrl(id:string):string|undefined {let url=urls.get(id);if(url)return url;const svg=pictoSvg(id);if(!svg)return;url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);urls.set(id,url);return url;}
