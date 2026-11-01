import {PALETTE,drawHandBlob,drawHandPaintedIcon,drawHandRect,drawMarkerLine,seededRandom} from './prototype-art';

type OriginalIcon='architecte'|'travail'|'planning'|'assignations'|'animaux'|'faune'|'recherches'|'quetes'|'monde'|'historique'|'factions'|'menu'|'ordres'|'zones';
export type NativeActionIconKind=OriginalIcon|'wall'|'floor'|'floor-remove'|'bridge'|'bridge-remove'|'chair'|'bed'|'medical-bed'|'animal-bed'|'table'|'shelf'|'door'|'fence'|'flag'|'grave'|'thermometer'|'flame'|'lamp'|'horseshoe'|'chess'|'television'|'workbench'|'anvil'|'sword'|'gun'|'shield'|'shirt'|'power'|'wire'|'battery'|'solar'|'wind'|'rocket'|'reactor'|'casket'|'computer'|'sensors'|'mine'|'haul'|'axe'|'harvest'|'scissors'|'uninstall'|'deconstruct'|'cancel'|'growing'|'growing-remove'|'stockpile'|'stockpile-remove'|'roof'|'roof-remove'|'roof-ignore'|'home'|'home-remove'|'snow'|'snow-remove'|'pot'|'food'|'barrel'|'drop'|'drill'|'radar'|'chip'|'cross'|'limb'|'paint'|'foam'|'play'|'pause'|'save'|'load'|'export'|'copy'|'paste'|'back'|'rotate-left'|'rotate-right'|'information'|'plus'|'minus'|'check'|'fallback';

// Semantic IDs belong to the catalogue, never to text translated for display.
// Every delivered tool/project has an explicit entry or a floor-material rule.
const families:Readonly<Record<string,NativeActionIconKind>>={
  architecte:'architecte',architect:'architecte',travail:'travail',work:'travail',planning:'planning',schedule:'planning',assignations:'assignations',assign:'assignations',animaux:'animaux',animals:'animaux',faune:'faune',wildlife:'faune',recherches:'recherches',research:'recherches',quetes:'quetes',quests:'quetes',monde:'monde',world:'monde',historique:'historique',history:'historique',factions:'factions',menu:'menu',ordres:'ordres',orders:'ordres',zones:'zones',
  structure:'wall',floors:'floor',furniture:'chair',temperature:'thermometer',recreation:'horseshoe',production:'workbench',power:'power',ship:'rocket',
  allow:'check',forbid:'cancel',
  select:'information',mine:'mine','haul-chunks':'haul',haul:'haul',chop:'axe',harvest:'harvest',cut:'scissors',uninstall:'uninstall',deconstruct:'deconstruct',cancel:'cancel',
  wall:'wall',door:'door',autodoor:'door','mini-turret':'gun',sandbags:'wall',fence:'fence','fence-gate':'fence','pen-marker':'flag','spike-trap':'sword','firefoam-popper':'foam',
  'build-bridge':'bridge','remove-bridge':'bridge-remove','smooth-floor':'floor','remove-floor':'floor-remove','wood-planks':'floor',
  'animal-sleeping-spot':'animal-bed','sleeping-spot':'bed',bedroll:'bed',bed:'bed','double-bed':'bed','hospital-bed':'medical-bed','vitals-monitor':'cross',
  table:'table','table-square':'table','table-long':'table','dining-chair':'chair',armchair:'chair','end-table':'table',dresser:'shelf',shelf:'shelf','small-shelf':'shelf',stool:'chair',grave:'grave','flower-pot':'growing',
  horseshoes:'horseshoe','chess-table':'chess','tube-television':'television','torch-lamp':'flame',vent:'thermometer',heater:'thermometer',cooler:'thermometer','passive-cooler':'thermometer',campfire:'flame','standing-lamp':'lamp','sun-lamp':'lamp',
  'wind-turbine':'wind','wood-generator':'power','chemfuel-generator':'power','power-conduit':'wire','power-switch':'wire',battery:'battery','geothermal-generator':'power','solar-generator':'solar',
  'hydroponics-basin':'growing','deep-drill':'drill','ground-scanner':'radar','orbital-beacon':'radar','comms-console':'television','nutrient-paste-dispenser':'pot',hopper:'stockpile','research-bench':'recherches','hi-tech-research-bench':'recherches','multi-analyzer':'radar',
  'tailor-bench':'shirt','electric-tailor-bench':'shirt','drug-lab':'recherches','electric-crematorium':'flame','electric-smelter':'flame','fueled-smithy':'anvil','electric-smithy':'anvil',brewery:'barrel','fermenting-barrel':'barrel','biofuel-refinery':'drop','art-bench':'paint','machining-table':'workbench','fabrication-bench':'chip','crafting-spot':'workbench','fueled-stove':'pot','electric-stove':'pot','butcher-table':'food','butcher-spot':'food',stonecutter:'mine',
  growing:'growing','remove-growing':'growing-remove',stockpile:'stockpile','remove-stockpile':'stockpile-remove','build-roof':'roof','remove-roof':'roof-remove','ignore-roof':'roof-ignore','snow-clear':'snow','remove-snow-clear':'snow-remove',home:'home','remove-home':'home-remove',
  'ai-core':'chip','ship-computer':'computer','ship-sensors':'sensors','long-range-mineral-scanner':'radar',
  'ship-cryptosleep-casket':'casket','ship-beam':'rocket','ship-reactor':'reactor','ship-engine':'rocket',
  'tree-sowing':'faune',firefoam:'foam','ship-cryptosleep':'casket','ship-basics':'rocket',prosthetics:'limb',cryptosleep:'casket','long-blades':'sword',brewing:'barrel','geothermal-power':'power','biofuel-refining':'drop','nutrient-paste':'pot','deep-drilling':'drill','sterile-materials':'floor','drug-production':'recherches','medicine-production':'cross',hydroponics:'growing','gun-turrets':'gun','complex-furniture':'chair',stonecutting:'mine',smithing:'anvil',machining:'workbench',gunsmithing:'gun','complex-clothing':'shirt',pemmican:'food','packaged-survival-meals':'food',autodoors:'door','plate-armor':'shield','flak-armor':'shield',batteries:'battery','solar-power':'solar','air-conditioning':'thermometer',microelectronics:'chip',fabrication:'workbench','advanced-fabrication':'chip','recon-armor':'shield',
  'cryptosleep-casket':'casket',
  settings:'travail',options:'travail',save:'save',load:'load',export:'export',resume:'play',start:'play',pause:'pause',close:'cancel',back:'back',copy:'copy',paste:'paste',delete:'cancel',remove:'cancel',plus:'plus',minus:'minus',check:'check',information:'information',info:'information',
  'rotate-left':'rotate-left','rotate-right':'rotate-right','clear-orders':'cancel','manage-work':'travail','toggle-draft':'shield',mobilize:'shield','target-shot':'ordres','target-melee':'sword','fire-at-will':'gun',
};
const originals=new Set<NativeActionIconKind>(['architecte','travail','planning','assignations','animaux','faune','recherches','quetes','monde','historique','factions','menu','ordres','zones']);
function semanticId(id:string):string {
  let result=id;
  if(result.startsWith('tool-'))result=result.slice(5).replace(/-select$/,'');
  else if(result.startsWith('category-'))result=result.slice(9);
  else if(result.startsWith('map-dock:'))result=result.slice(9);
  else if(result.startsWith('tab:'))result=result.slice(4);
  else if(result.startsWith('menu-'))result=result.slice(5);
  else if(result.startsWith('page:'))result=result.slice(5);
  else if(result.startsWith('research-node-'))result=result.slice(14);
  else if(result.startsWith('research-'))result=result.slice(9).replace(/-select$/,'');
  return result;
}
export function nativeActionIconKind(id:string):NativeActionIconKind {
  const exact=Object.hasOwn(families,id)?families[id]:undefined;if(exact)return exact;
  const key=semanticId(id),known=Object.hasOwn(families,key)?families[key]:undefined;
  if(known)return known;
  if(key.endsWith('-tile')||key.endsWith('-flagstone'))return 'floor';
  return 'fallback';
}

/** Marker/gouache ink only, painted when the owner's existing texture changes.
 * No canvas, image, geometry, material, animation or GPU work is allocated here. */
export function drawNativeActionIcon(ctx:CanvasRenderingContext2D,id:string,cx:number,cy:number,r:number,ink='#261e18',accent='#f4ecda'):void {
  if(!Number.isFinite(cx+cy+r)||r<=0)return;
  const kind=nativeActionIconKind(id),semantic=semanticId(id);
  if(semantic==='forbid')ink=PALETTE.terracotta;else if(semantic==='allow')ink=PALETTE.pineDark;
  if(originals.has(kind)){drawHandPaintedIcon(ctx,kind,cx,cy,r,ink,accent);return;}
  let seed=97;for(const char of kind)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;
  const rng=seededRandom(seed),lw=Math.max(1.3,r*.13);
  const line=(x1:number,y1:number,x2:number,y2:number,w=1)=>drawMarkerLine(ctx,cx+x1*r,cy+y1*r,cx+x2*r,cy+y2*r,ink,lw*w,rng);
  const rect=(x:number,y:number,w:number,h:number,fill:string|null=accent)=>drawHandRect(ctx,cx+x*r,cy+y*r,w*r,h*r,fill,ink,lw,rng);
  const blob=(x:number,y:number,size:number,fill:string=accent)=>drawHandBlob(ctx,cx+x*r,cy+y*r,size*r,fill,ink,lw,rng);
  const polygon=(points:readonly (readonly[number,number])[],fill=accent)=>{
    ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],index)=>index?ctx.lineTo(cx+x*r,cy+y*r):ctx.moveTo(cx+x*r,cy+y*r));ctx.closePath();ctx.fill();
    for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!;line(a[0],a[1],b[0],b[1]);}
  };
  const leaf=(x:number,y:number)=>{polygon([[x,y],[x-.4,y-.32],[x-.4,y-.6],[x-.12,y-.55],[x,y]],'#82986a');};
  const arrow=(direction=1)=>{line(-.5*direction,0,.5*direction,0);line(.5*direction,0,.1*direction,-.3);line(.5*direction,0,.1*direction,.3);};
  const remove=kind.endsWith('-remove'),base=remove?kind.slice(0,-7):kind;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.fillStyle=accent;ctx.strokeStyle=ink;
  switch(base){
    case 'wall':
      rect(-.76,-.53,1.52,1.06);line(-.74,0,.74,0);line(-.22,-.52,-.22,0);line(.34,0,.34,.52);break;
    case 'floor':
      polygon([[-.78,.08],[-.06,-.58],[.76,-.08],[.08,.6]]);line(-.4,.4,.35,-.34);line(-.4,-.3,.43,.32);break;
    case 'bridge':
      line(-.8,.42,.8,.42,1.4);line(-.7,-.2,.7,-.2);for(const x of[-.6,-.2,.2,.6])line(x,-.2,x,.44);line(-.66,.44,-.66,.75);line(.66,.44,.66,.75);break;
    case 'chair':
      rect(-.43,-.68,.86,.67);rect(-.58,-.04,1.16,.24);line(-.43,.19,-.5,.7);line(.42,.18,.5,.7);break;
    case 'bed':case 'medical-bed':case 'animal-bed':case 'casket':
      rect(-.65,-.68,1.3,1.35);rect(-.45,-.48,.9,.33);line(-.64,-.02,.64,-.02);line(-.52,.67,-.52,.8);line(.52,.67,.52,.8);
      if(base==='medical-bed'){line(-.2,.31,.2,.31);line(0,.1,0,.52);}else if(base==='casket'){rect(-.52,-.59,1.04,1.14,null);line(-.15,.15,.15,.15);}else if(base==='animal-bed'){blob(0,.3,.13,ink);for(const x of[-.25,0,.25])blob(x,.1,.07,ink);}break;
    case 'table':
      polygon([[-.76,-.38],[.5,-.5],[.77,-.12],[-.53,.02]]);line(-.55,.02,-.55,.68);line(.58,-.1,.58,.56);line(-.76,-.36,-.76,.26);break;
    case 'shelf':
      rect(-.65,-.7,1.3,1.4);line(-.64,-.2,.65,-.2);line(-.64,.26,.65,.26);rect(-.46,-.57,.29,.32);rect(.09,-.52,.35,.26);break;
    case 'door':
      rect(-.61,-.76,1.22,1.49);polygon([[-.46,-.58],[.34,-.7],[.34,.69],[-.46,.52]]);blob(.1,.07,.065,ink);break;
    case 'fence':
      for(const x of[-.61,0,.61]){polygon([[x-.11,.68],[x-.11,-.5],[x,-.7],[x+.11,-.5],[x+.11,.68]]);}line(-.73,-.17,.73,-.17);line(-.73,.36,.73,.36);break;
    case 'flag':
      line(-.48,.75,-.48,-.76);polygon([[-.46,-.68],[.67,-.56],[.36,-.19],[.65,.13],[-.45,.02]]);break;
    case 'grave':
      polygon([[-.5,.67],[-.5,-.45],[-.29,-.68],[.3,-.68],[.5,-.45],[.5,.67]]);line(-.24,-.08,.24,-.08);line(0,-.34,0,.34);line(-.75,.7,.75,.7);break;
    case 'thermometer':
      rect(-.18,-.73,.36,1.02);blob(0,.44,.3);line(0,-.53,0,.46,1.25);for(const y of[-.45,-.15,.15])line(.36,y,.63,y);break;
    case 'flame':
      polygon([[-.48,.57],[-.67,.15],[-.24,-.32],[-.12,-.76],[.19,-.34],[.48,-.56],[.62,.2],[.32,.65]],'#cf8853');line(-.54,.71,.58,.71);break;
    case 'lamp':
      blob(0,-.26,.48);rect(-.25,.25,.5,.24);line(-.19,.61,.21,.61);for(const [x,y]of[[-.75,-.5],[0,-.96],[.75,-.5]])line(x,y,x*.8,y*.8);break;
    case 'horseshoe':
      polygon([[-.7,-.7],[-.3,-.68],[-.3,.2],[-.14,.4],[.15,.4],[.32,.2],[.31,-.68],[.7,-.69],[.71,.23],[.5,.62],[0,.8],[-.5,.62],[-.72,.2]]);for(const x of[-.5,.5]){blob(x,-.35,.06,ink);blob(x,.05,.06,ink);}break;
    case 'chess':
      polygon([[-.57,.7],[-.42,.39],[-.29,.22],[-.2,-.2],[-.42,-.29],[-.34,-.6],[.17,-.77],[.52,-.38],[.13,-.1],[.29,.3],[.47,.43],[.59,.71]]);blob(.14,-.51,.055,ink);line(-.57,.73,.6,.73);break;
    case 'television':
      rect(-.75,-.45,1.5,1);rect(-.56,-.29,.94,.65,null);blob(.57,-.07,.06,ink);blob(.57,.2,.06,ink);line(-.27,-.46,-.46,-.78);line(-.27,-.46,.04,-.78);break;
    case 'workbench':
      rect(-.75,-.17,1.5,.32);line(-.6,.15,-.6,.71);line(.59,.15,.59,.71);line(-.4,-.62,.34,-.25,1.4);rect(-.55,-.79,.44,.25);break;
    case 'anvil':
      polygon([[-.81,-.43],[.69,-.43],[.45,-.1],[.1,.07],[.21,.48],[.64,.67],[-.57,.67],[-.19,.47],[-.12,.04],[-.54,-.06]]);break;
    case 'sword':
      polygon([[-.64,.62],[-.25,.03],[.32,-.75],[.68,-.85],[.6,-.45],[-.07,.18]]);line(-.48,-.1,.16,.39,1.35);line(-.57,.54,-.78,.79,1.6);break;
    case 'gun':
      polygon([[-.77,-.3],[.77,-.3],[.77,-.02],[.17,-.02],[.03,.19],[-.13,.19],[-.26,.72],[-.64,.64],[-.49,.08],[-.77,.03]]);line(-.08,.01,-.18,.34);break;
    case 'shield':
      polygon([[-.61,-.62],[0,-.8],[.64,-.6],[.5,.2],[0,.77],[-.5,.2]]);line(0,-.59,0,.47);line(-.35,-.12,.35,-.12);break;
    case 'shirt':
      polygon([[-.24,-.66],[-.54,-.58],[-.83,-.21],[-.48,.05],[-.35,-.13],[-.36,.71],[.38,.7],[.35,-.11],[.5,.08],[.81,-.18],[.53,-.58],[.24,-.66]]);line(-.24,-.65,0,-.44);line(0,-.44,.24,-.65);break;
    case 'power':case 'wire':
      if(base==='wire'){line(-.87,-.5,-.38,-.5);line(.38,.49,.86,.49);}
      polygon([[.04,-.82],[-.55,.11],[-.03,.1],[-.17,.82],[.57,-.2],[.07,-.18]],'#d5a64f');break;
    case 'battery':
      rect(-.49,-.58,.98,1.3);rect(-.24,-.78,.48,.2);line(-.22,-.17,.22,-.17);line(0,-.39,0,.04);line(-.2,.37,.2,.37);break;
    case 'solar':
      polygon([[-.68,-.47],[.57,-.47],[.78,.32],[-.47,.32]],'#8ca3ab');line(-.29,-.46,-.08,.31);line(.15,-.46,.36,.31);line(-.6,-.08,.68,-.08);line(.12,.34,.12,.7);line(-.22,.72,.46,.72);break;
    case 'wind':
      blob(0,-.21,.1,ink);for(const angle of[-Math.PI/2,Math.PI/6,Math.PI*5/6]){const x=Math.cos(angle),y=Math.sin(angle);polygon([[x*.1,y*.1-.21],[x*.79-y*.12,y*.79+x*.12-.21],[x*.62+y*.1,y*.62-x*.1-.21]]);}line(0,-.1,-.09,.77);line(0,-.1,.12,.77);break;
    case 'rocket':
      polygon([[0,-.83],[-.36,-.3],[-.31,.47],[.31,.47],[.36,-.3]]);blob(0,-.13,.15,'#a2afb0');polygon([[-.3,.11],[-.64,.58],[-.3,.48]]);polygon([[.3,.11],[.64,.58],[.3,.48]]);line(-.13,.55,-.18,.86);line(.11,.54,.14,.86);break;
    case 'computer':
      polygon([[-.72,-.62],[.63,-.66],[.7,.22],[-.65,.24]],'#91a9a8');rect(-.51,-.46,1.03,.49,'#566e7b');
      line(-.29,-.28,-.09,-.28);line(.05,-.28,.3,-.28);line(-.24,-.13,.22,-.13);
      polygon([[-.61,.3],[.62,.27],[.78,.63],[-.76,.66]]);line(-.5,.48,.48,.47);line(-.26,.4,-.26,.55);line(.07,.39,.07,.54);line(.35,.39,.35,.54);break;
    case 'sensors':
      polygon([[-.79,-.55],[-.25,-.2],[.24,-.28],[.68,-.73],[.5,-.02],[.04,.32],[-.47,.14]],'#9bb4b0');
      line(-.65,-.43,.38,-.04);line(-.23,-.23,.16,.22);line(.04,.3,-.1,.67,1.3);line(-.45,.71,.43,.71);
      line(.23,-.3,.58,-.58);blob(.61,-.61,.075,'#cfb16f');line(.71,-.79,.86,-.9);break;
    case 'reactor':
      blob(0,0,.68);blob(0,0,.15,ink);for(const angle of[-Math.PI/2,Math.PI/6,Math.PI*5/6]){const x=Math.cos(angle),y=Math.sin(angle);polygon([[x*.28-y*.08,y*.28+x*.08],[x*.56-y*.25,y*.56+x*.25],[x*.56+y*.25,y*.56-x*.25]],'#d5a64f');}break;
    case 'mine':
      line(-.59,.72,.35,-.59,1.6);polygon([[-.78,-.47],[-.2,-.76],[.4,-.68],[.76,-.33],[.26,-.48],[-.2,-.46]]);break;
    case 'haul':case 'stockpile':
      rect(-.63,-.46,1.15,1.1);line(-.59,-.44,-.05,-.07);line(-.05,-.07,.49,-.43);line(-.05,-.07,-.05,.62);if(base==='haul'){line(.34,-.69,.83,-.69);line(.83,-.69,.59,-.91);line(.83,-.69,.59,-.45);}break;
    case 'axe':
      line(-.48,.76,.25,-.7,1.6);polygon([[-.04,-.56],[.47,-.68],[.79,-.31],[.58,.04],[.02,-.23]]);break;
    case 'harvest':
      line(-.4,.75,.1,-.42);leaf(.08,.05);leaf(.25,-.17);line(.13,-.57,.44,-.51);line(.44,-.51,.65,-.1);line(.65,-.1,.53,.27);line(.53,.27,.27,.44);break;
    case 'scissors':
      blob(-.42,.41,.22);blob(.4,.43,.22);line(-.3,.25,.56,-.69,1.15);line(.25,.25,-.51,-.7,1.15);blob(0,-.02,.07,ink);break;
    case 'uninstall':
      polygon([[-.62,.77],[-.77,.61],[.15,-.35],[.13,-.64],[.38,-.83],[.38,-.51],[.64,-.43],[.8,-.65],[.78,-.25],[.51,-.12],[.28,-.13]]);break;
    case 'deconstruct':
      rect(-.71,.02,1.42,.64);line(-.65,.33,.66,.33);line(-.06,.03,-.06,.33);line(.3,.33,.3,.62);line(-.4,-.74,.47,.27,1.5);rect(-.66,-.84,.54,.25);break;
    case 'cancel':
      line(-.61,-.62,.62,.64,1.8);line(-.61,.63,.63,-.64,1.8);break;
    case 'growing':
      line(-.71,.61,.74,.61);line(0,.57,.02,-.15);leaf(0,.11);polygon([[.02,-.08],[.15,-.46],[.57,-.6],[.49,-.18],[.02,-.08]],'#82986a');break;
    case 'roof':case 'roof-ignore':
      polygon([[-.8,.08],[-.05,-.63],[.8,.03],[.64,.22],[-.04,-.34],[-.66,.25]]);line(-.55,.17,-.55,.69);line(.54,.15,.54,.68);if(base==='roof-ignore'){blob(.45,.47,.24);line(.3,.64,.62,.32);}break;
    case 'home':
      polygon([[-.59,-.05],[0,-.61],[.6,-.04],[.58,.67],[-.58,.67]]);line(-.83,-.04,0,-.81);line(0,-.81,.83,-.04);rect(-.16,.17,.35,.49);break;
    case 'snow':
      for(const angle of[0,Math.PI/3,Math.PI*2/3]){const x=Math.cos(angle)*.72,y=Math.sin(angle)*.72;line(-x,-y,x,y);for(const sign of[-1,1]){const bx=x*sign*.62,by=y*sign*.62;line(bx,by,bx-x*sign*.2-y*.28,by-y*sign*.2+x*.28);line(bx,by,bx-x*sign*.2+y*.28,by-y*sign*.2-x*.28);}}break;
    case 'pot':
      polygon([[-.64,-.18],[.67,-.19],[.5,.62],[-.46,.62]]);line(-.75,-.23,.76,-.23);line(-.45,-.41,.49,-.41);blob(0,-.54,.08,ink);line(-.85,.03,-.64,.07);line(.66,.07,.86,.03);break;
    case 'food':
      polygon([[-.65,-.49],[.53,-.6],[.72,.44],[-.48,.64]]);line(-.45,-.28,.42,-.35);line(-.33,.04,.46,-.01);line(-.23,.34,.5,.29);break;
    case 'barrel':
      polygon([[-.46,-.66],[.47,-.66],[.66,-.28],[.66,.3],[.43,.68],[-.44,.68],[-.65,.29],[-.65,-.27]]);line(-.59,-.29,.61,-.29);line(-.59,.32,.61,.32);line(-.17,-.63,-.17,.64);line(.2,-.63,.2,.63);break;
    case 'drop':
      polygon([[0,-.85],[-.55,-.01],[-.59,.35],[-.32,.7],[.18,.77],[.52,.54],[.62,.12]]);line(-.28,.12,-.29,.38);break;
    case 'drill':
      rect(-.61,-.6,1.21,.47);line(-.12,-.11,-.12,.59,1.4);line(.14,-.11,.14,.59,1.4);for(const y of[.01,.21,.41])line(-.22,y,.25,y+.17);line(0,.62,0,.83);break;
    case 'radar':
      blob(0,-.02,.68);line(0,-.02,.42,-.51);line(0,-.02,.55,.25);blob(-.29,.2,.08,ink);line(-.16,.66,-.25,.84);line(.17,.66,.25,.84);break;
    case 'chip':
      rect(-.47,-.46,.94,.93);rect(-.25,-.24,.5,.49,null);for(const p of[-.3,0,.3]){line(p,-.75,p,-.48);line(p,.48,p,.75);line(-.75,p,-.48,p);line(.48,p,.75,p);}break;
    case 'cross':
      polygon([[-.22,-.75],[.23,-.75],[.23,-.22],[.76,-.22],[.76,.24],[.23,.24],[.23,.77],[-.23,.77],[-.23,.24],[-.76,.24],[-.76,-.22],[-.22,-.22]]);break;
    case 'limb':
      polygon([[-.31,-.78],[.19,-.78],[.15,-.13],[.39,.11],[.35,.67],[.65,.76],[.61,.9],[-.13,.8],[-.14,.2],[-.42,-.09]]);blob(.02,.12,.13);break;
    case 'paint':
      blob(-.1,.05,.65);blob(-.26,-.23,.08,'#bd7448');blob(.12,-.35,.08,'#82986a');blob(-.32,.24,.08,'#6a8794');line(.19,.59,.66,-.65,1.45);break;
    case 'foam':
      rect(-.31,-.64,.62,1.07);rect(-.13,-.83,.26,.18);for(const[x,y]of[[-.45,.52],[0,.65],[.46,.52]])blob(x,y,.26);line(-.13,-.12,.14,-.12);line(0,-.28,0,.05);break;
    case 'play':polygon([[-.43,-.68],[.68,0],[-.43,.7]]);break;
    case 'pause':rect(-.52,-.7,.35,1.4);rect(.18,-.7,.35,1.4);break;
    case 'save':
      polygon([[-.69,-.71],[.43,-.71],[.7,-.46],[.7,.7],[-.69,.7]]);rect(-.4,-.66,.75,.46);rect(-.44,.16,.89,.5);break;
    case 'load':case 'export':
      rect(-.65,.01,1.3,.67);line(0,-.79,0,.33);if(base==='load'){line(0,.33,-.3,.04);line(0,.33,.3,.04);}else{line(0,-.79,-.3,-.5);line(0,-.79,.3,-.5);}break;
    case 'copy':case 'paste':
      rect(-.65,-.69,1.03,1.09);rect(-.31,-.32,1.01,1.04);if(base==='paste'){line(-.1,.05,.44,.05);line(-.1,.31,.42,.31);}break;
    case 'back':arrow(-1);break;
    case 'rotate-left':case 'rotate-right':{
      const sign=base==='rotate-left'?-1:1;line(-.52*sign,.4,-.59*sign,-.12);line(-.59*sign,-.12,-.17*sign,-.54);line(-.17*sign,-.54,.42*sign,-.42);line(.42*sign,-.42,.64*sign,-.04);line(-.61*sign,-.13,-.83*sign,-.42);line(-.61*sign,-.13,-.24*sign,-.15);break;
    }
    case 'information':blob(0,0,.71);blob(0,-.37,.075,ink);line(0,-.08,0,.42,1.35);break;
    case 'plus':line(-.59,0,.59,0,1.5);line(0,-.59,0,.59,1.5);break;
    case 'minus':line(-.59,0,.59,0,1.5);break;
    case 'check':line(-.64,.04,-.13,.57,1.4);line(-.13,.57,.71,-.6,1.4);break;
    default:
      blob(0,0,.71);line(-.29,-.3,-.13,-.52);line(-.13,-.52,.21,-.49);line(.21,-.49,.35,-.25);line(.35,-.25,.01,.07);line(.01,.07,.01,.22);blob(.01,.46,.065,ink);break;
  }
  if(remove){ctx.strokeStyle=ink;line(.22,.22,.72,.72,1.4);line(.22,.72,.72,.22,1.4);}
  ctx.restore();
}
