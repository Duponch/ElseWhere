/** Cold import admission for real saved items. Unlike addMaterial (production,
 * which merges stacks and starts fresh clocks), preserve each source owner's
 * stack and condition independently, including ordinary inventory stacks. */
import {buildStructure,placeGear,ImportContext} from './convert.ts';
import type {Cell,MaterialPile,MaterialOwner} from '../../sim/types.ts';
import {TICKS_PER_DAY} from '../../sim/types.ts';
import {readThing,referencedThingId,type RwsThing} from './rws-save.ts';
import {at,num,text,items as listItems} from './xml.ts';
import {lookup,isDropped,mappingStatus} from './mapping.ts';
import {ITEM_MAP,QUALITY_MAP,APPAREL_MAP,WEAPON_MAP,FILTH_MAP,knownItemGapOrigin} from './map-items.ts';
import {BUILDING_MAP} from './map-buildings.ts';
import {PLANT_MAP} from './map-plants.ts';
import {placeRwsFootprint} from './local-coordinates.ts';
import {importPlantCondition} from './convert-environment.ts';
import {ImportNotes} from './notes.ts';
import type {GapOrigin} from './gap-origin.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../../sim/items.ts';
import {freshRot,isPerishable,ROT_DAYS} from '../../sim/food-preservation.ts';
import {foodCanCarryPoison,type FoodContaminationCause} from '../../sim/food-poisoning.ts';
import {pileMaxHp} from '../../sim/thing-damage-rules.ts';
import {ANIMAL_EGG_CONTENT_256,eggSpeciesForItem256} from '../../sim/animal-egg-content-v256.ts';
import {validEggPile256} from '../../sim/animal-egg-save-v256.ts';
import {EGG_BOX_MAX_CONTENT_374} from '../../sim/egg-box-state-374.ts';
import {groundCapacity,groundPilesAt,nearbyGround} from '../../sim/ground-placement.ts';
import {groundMaxStacks} from '../../sim/shelf-storage.ts';
import {minifiable,type PackedFurniture} from '../../sim/furniture-rules.ts';
import {validatePackedFurnitureRecords} from '../../sim/furniture-transfer-save.ts';
import {groundOccupancyAllows} from '../../sim/occupancy.ts';
import {shelfAt} from '../../sim/shelf-storage.ts';
import {validTradeInventoryCustody} from '../../sim/trade-save.ts';
import {setMaterialForbidden256} from '../../sim/material-permission-256.ts';
import {appendPileEntries} from '../../sim/pile-identity-directory.ts';
import {markPileContentWrite379} from '../../sim/ordinary-pile-source-379.ts';
import {filthAppended379} from '../../sim/filth-directory-379.ts';
import {ensureFilth,FILTH_DEFINITIONS,filthCheckPeriod} from '../../sim/filth-rules.ts';
import {terrainAcceptsFilth256} from '../../sim/natural-terrain-runtime-256.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {isNovelBook295,NOVEL_JOY_FACTORS_295,NOVEL_TITLE_MAX_LENGTH_295,NOVEL_DESCRIPTION_MAX_LENGTH_295} from '../../sim/book-state-295.ts';
import {WEAPON_QUALITIES} from '../../sim/equipment-rules.ts';
import {validStartingApparelColor256} from '../../sim/starting-apparel-color-256.ts';
import {createWildPlantResource256} from '../../sim/wild-plant-acquisition-v256.ts';
import {extractTreeDefinition} from '../../sim/tree-transfer-rules.ts';
import {TREE_PACK_LIFETIME,type MinifiedTreePile} from '../../sim/tree-transfer-state.ts';
import {validTreePileShape} from '../../sim/tree-transfer-save.ts';
import {validOriginalTreeResource} from '../../sim/tree-transfer-resource-save.ts';

const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(n,hi));
const POISON_CAUSE:Readonly<Record<string,FoodContaminationCause>>={FilthyKitchen:'filthy-kitchen',IncompetentCook:'incompetent-cook',Unknown:'unknown'};
type PendingEggParents={readonly ids:number[];readonly source:RwsThing};
const pendingEggParents=new WeakMap<ImportContext,PendingEggParents[]>();

/** Existing apparel supports a limited native tint palette. Preserve the
 * saved pigment only if the actual source active color fits that model.
 * A custom dye color or alpha is not a legal native palette entry. */
export function importRwsGearExtras(ctx:ImportContext,t:RwsThing,pile:MaterialPile):void {
 if(!pile.apparel||text(t.node,'colorActive')!=='True')return;
 const raw=text(t.node,'color'),m=raw&&/^RGBA\(\s*([.\d]+),\s*([.\d]+),\s*([.\d]+),\s*([.\d]+)\s*\)$/.exec(raw);
 if(!m)return;
 const color={r:Math.fround(Number(m[1])),g:Math.fround(Number(m[2])),b:Math.fround(Number(m[3]))};
 const projected={...pile.apparel,birthColor:color};
 if(Number(m[4])===1&&validStartingApparelColor256(projected,pile.item,ctx.w.schemaVersion)){
  pile.apparel.birthColor=color;
  ctx.notes.def('apparel',t.def+' : couleur','adapted',pile.item,'Couleur active reproduite sur la palette existante, origine du pigment non représentée.',1,'model');
 }else ctx.notes.def('apparel',t.def+' : couleur','dropped',pile.item,'Cette couleur active ne correspond pas à la palette représentable par Elsewhere.',1,'model');
}
/** CompArt persists a full name (possibly rich-text/quoted nickname), not
 * an author Thing reference. Only a unique exact normalized full identity
 * among actually imported humans establishes a valid native attribution. */
export function resolveRwsArtAuthor(ctx:ImportContext,source:string|undefined):import('../../sim/types.ts').Pawn|undefined {
 const normalize=(name:string)=>name.replace(/<[^>]*>/g,'').normalize('NFKC').replace(/['’‘"«»]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
 if(!source)return;
 const name=normalize(source);if(!name)return;
 const actual=new Set(ctx.thingIds.values());
 const candidates=ctx.w.pawns.filter(p=>actual.has(p.id)&&normalize(p.name)===name);
 return candidates.length===1?candidates[0]:undefined;
}

/** Build the actual condition of this saved stack, without committing it.
 * Parent references absent from the imported roster remain absent; never mint
 * a fictional parent identity just to satisfy the hatcher's optional fields. */
export function rwsItemCondition(ctx:ImportContext,t:RwsThing,item:ItemId):{condition:Partial<MaterialPile>;adaptations:string[]} {
 const w=ctx.w,condition:Partial<MaterialPile>={...freshRot(item,w.tick)},adaptations:string[]=[];
 const sourceAge=num(t.node,'rotProg');
 if(sourceAge!==undefined&&sourceAge>0){
  if(isPerishable(item)){
   const max=ROT_DAYS[item]*TICKS_PER_DAY,requested=sourceAge/10;
   condition.rot={progress:clamp(requested,0,max-0.000001),atTick:w.tick};
   if(requested>=max)adaptations.push('Âge de pourriture ramené sous le seuil de disparition d’Elsewhere.');
  }else adaptations.push('Cet objet n’a pas de compteur de pourriture dans Elsewhere.');
 }
 const poison=num(t.node,'poisonPct');
 if(poison!==undefined&&poison>0){
  if(foodCanCarryPoison(item))condition.foodPoison={fraction:clamp(poison,0,1),cause:POISON_CAUSE[text(t.node,'cause')??'Unknown']??'unknown'};
  else adaptations.push('Contamination alimentaire non représentable pour cet objet.');
 }
 const species=eggSpeciesForItem256(item);
 if(species&&item===ANIMAL_EGG_CONTENT_256[species].fertilizedItem){
  const parent=(path:string)=>{const source=referencedThingId(text(t.node,path));return source?ctx.thingIds.get(source):undefined;};
  const mother=parent('hatcheeParent'),father=parent('otherParent'),faction=text(t.node,'hatcheeFaction');
  const progress=num(t.node,'gestateProgress')??0,temperatureDamage=num(t.node,'ruinProgress')??num(t.node,'ruinedProgress')??0;
  condition.egg={progress:clamp(progress,0,1+1/(ANIMAL_EGG_CONTENT_256[species].hatchDays*60000)),temperatureDamage:clamp(temperatureDamage,0,1),faction:faction===ctx.save.playerFaction?'player':'wild',atTick:w.tick,...mother===undefined?{}:{motherId:mother},...father===undefined||father===mother?{}:{fatherId:father}};
 }
 const hp=pileMaxHp({kind:ITEM_DEFINITIONS[item].kind,item},w.schemaVersion);
 if(t.hp!==undefined&&hp>0){
  const damage=clamp(Math.round(hp-t.hp),0,hp-1);
  if(damage>0)condition.damage=damage;
  if(t.hp>hp)adaptations.push('Points de vie limités au maximum de cet objet dans Elsewhere.');
 }
 return {condition,adaptations};
}

/** Import one actual source stack. An exceptional cell/stack limit may need
 * another nearby physical slot; never merge unrelated ages or permission
 * flags. All destination slots are reserved before committing any quantity. */
export function placeRwsMaterial(ctx:ImportContext,t:RwsThing,owner:MaterialOwner):MaterialPile|undefined {
 if(t.def==='MinifiedTree')return placeRwsMinifiedTree(ctx,t,owner);
 const {w,notes}=ctx,m=lookup(ITEM_MAP,t.def);
 notes.countBefore('items');
 const label=owner.type==='inventory'?`${t.def} (inventaire)`:t.def;
 if(!m||isDropped(m)){notes.def('items',label,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Objet inconnu : non importé.',1,knownItemGapOrigin(t.def));return;}
 const item=m.to,definition=ITEM_DEFINITIONS[item];
 if(!definition){notes.def('items',label,'dropped',item,'Objet absent du catalogue courant.');return;}
 // Corpses, works etc. have dedicated physical owners, not generic piles.
 if(['corpse','mech-corpse','unfinished','plant','weapon','apparel'].includes(definition.kind)){notes.def('items',label,'dropped',item,'Propriétaire physique spécifique non repris ici.');return;}
 const total=Math.max(1,Math.round(t.stack)),limit=definition.stackLimit;
 const {condition,adaptations}=rwsItemCondition(ctx,t,item);
 // Core Novel's numeric joy factor is unambiguous for quality even when the
 // save omits a separate quality value. Keep the real title/flavor.
 if(item==='novel'){
  const rawTitle=text(t.node,'title'),rawFlavor=text(t.node,'descriptionFlavor')??text(t.node,'description'),factor=num(t.node,'joyFactor');
  const index=factor===undefined?-1:NOVEL_JOY_FACTORS_295.findIndex(n=>Math.abs(n-factor)<1e-6);
  const quality=t.quality?QUALITY_MAP[t.quality]:WEAPON_QUALITIES[index];
  const clean=(v:string,max:number)=>v.replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,max).trim();
  if(total!==1||!rawTitle||!rawFlavor||!quality){notes.def('items',label,'dropped',item,'Roman sans qualité ou contenu original identifiable.');return;}
  const title=clean(rawTitle,NOVEL_TITLE_MAX_LENGTH_295),description=clean(rawFlavor,NOVEL_DESCRIPTION_MAX_LENGTH_295);
  const book={revision:1 as const,quality,title,description};
  if(!isNovelBook295(book)){notes.def('items',label,'dropped',item,'Texte du roman non représentable.');return;}
  condition.book=book;
  if(title!==rawTitle||description!==rawFlavor)adaptations.push('Texte ajusté aux limites de longueur et caractères d’Elsewhere.');
 }
 const newPile=(quantity:number,target:MaterialOwner):MaterialPile=>({id:0,kind:definition.kind,item,quantity,owner:{...target},...structuredClone(condition)});
 const created:MaterialPile[]=[];
 const failure=(why:string,origin:GapOrigin='model')=>{notes.def('items',label,'dropped',item,why,1,origin);return undefined;};
 if(!Number.isSafeInteger(total)||total<1||total>limit*32768)return failure('Quantité non valide.','source');
 if(owner.type==='ground'){
  let remaining=total;
  const place=(cell:Cell)=>{
   if(!remaining||!ctx.inside(cell))return;
   const slots=groundMaxStacks(w,cell)-groundPilesAt(w,cell).length;
   if(slots<1)return;
   const preview=newPile(Math.min(remaining,limit),{type:'ground',...cell});
   if(t.forbidden)setMaterialForbidden256(preview,true);
   let capacity=groundCapacity(w,cell,preview);
   for(let n=0;n<slots&&remaining>0&&capacity>0;n++){
    const moved=Math.min(remaining,limit,capacity);
    const pile=newPile(moved,{type:'ground',...cell});if(t.forbidden)setMaterialForbidden256(pile,true);
    created.push(pile);remaining-=moved;capacity-=moved;
   }
  };
  place(owner);
  if(remaining)for(const c of nearbyGround(w,owner))if(c.x!==owner.x||c.z!==owner.z){place(c);if(!remaining)break;}
  if(remaining)return failure('Aucune place admise pour toutes les unités près de cette case.');
  if(created.some(p=>p.owner.type==='ground'&&(p.owner.x!==owner.x||p.owner.z!==owner.z)))adaptations.push('Pile déplacée vers une case disponible.');
 }else if(owner.type==='egg-box374'){
  if(!w.structures.some(s=>s.kind==='egg-box'&&s.id===owner.structureId)||!eggSpeciesForItem256(item)||total>EGG_BOX_MAX_CONTENT_374||w.piles.some(p=>p.owner.type==='egg-box374'&&p.owner.structureId===owner.structureId))return failure('Contenu non admis dans une boîte à œufs d’Elsewhere.');
  if(t.forbidden)adaptations.push('Permission des œufs contenue non représentable dans la boîte.');
  created.push(newPile(total,owner));
 }else{
  for(let remaining=total;remaining;){const quantity=Math.min(limit,remaining),pile=newPile(quantity,owner);remaining-=quantity;
   if(!validTradeInventoryCustody(w,pile,w.schemaVersion))return failure('Objet non autorisé dans cet inventaire par Elsewhere.');
   if(t.forbidden)setMaterialForbidden256(pile,true);created.push(pile);
  }
 }
 if(w.piles.length+created.length>32768||!Number.isSafeInteger(w.nextId+created.length)||created.some(p=>!validEggPile256(p,w.schemaVersion,w.tick,w.nextId)))return failure('Limite de piles ou état d’œuf non représentable.');
 for(const p of created){p.id=w.nextId++;appendPileEntries(w.piles,p);}
 if(condition.egg){
  const rawMother=referencedThingId(text(t.node,'hatcheeParent')),rawFather=referencedThingId(text(t.node,'otherParent'));
  if(rawMother&&condition.egg.motherId===undefined||rawFather&&condition.egg.fatherId===undefined){
   const pending=pendingEggParents.get(ctx)??[];pending.push({ids:created.map(p=>p.id),source:t});pendingEggParents.set(ctx,pending);
  }
 }
 if(created.length>1)adaptations.push('Pile divisée selon les limites du catalogue.');
 if(t.id)ctx.thingIds.set(t.id,created[0]!.id);
 notes.countAfter('items');
 const note=[...('adapt' in m&&m.adapt?[m.adapt]:[]),...adaptations].join(' ');
 const ordinaryOrigin=knownItemGapOrigin(t.def)??(adaptations.length?'model':undefined);
 notes.def('items',label,note?'adapted':mappingStatus(m),item,note||undefined,1,ordinaryOrigin);
 return created[0];
}

/** The wrapper serializes its original Plant in MinifiedThing.innerContainer
 * and its still-running numeric ticksTillDeath (Core MinifiedTree.ExposeData).
 * The destination already has the same 420000-Core-tick lifetime. Keep the
 * source Plant frozen at its true packing frontier, not a new Resource. */
export function placeRwsMinifiedTree(ctx:ImportContext,t:RwsThing,requested:MaterialOwner):MinifiedTreePile|undefined {
 const {w,notes}=ctx;notes.countBefore('items');
 const raw=listItems(at(t.node,'innerContainer/innerList'))[0],inner=raw?readThing(raw):undefined;
 const failure=(message:string,origin:GapOrigin='model')=>{notes.def('items','MinifiedTree','dropped',undefined,message,1,origin);return undefined;};
 if(!inner||!inner.id||t.stack!==1)return failure('Arbre emballé sans plante originale unique.','source');
 const mapped=lookup(PLANT_MAP,inner.def);
 if(!mapped||isDropped(mapped)||!('wild' in mapped.to)||!extractTreeDefinition({kind:'tree',species:mapped.to.wild}))return failure('Cette espèce ne peut pas être conservée comme arbre emballé dans Elsewhere.');
 const remaining=num(t.node,'ticksTillDeath'),growth=num(inner.node,'growth')??0; // Core Plant.ExposeData default.
 if(remaining===undefined||!Number.isSafeInteger(remaining)||remaining<1||remaining>420000||growth<0||growth>1)return failure('Compte à rebours ou croissance originale non représentable.','source');
 const why:string[]=[],nowCore=effectiveCore297(w),deadline=Math.min(w.tick+TREE_PACK_LIFETIME,Math.ceil((nowCore+remaining)/10));
 if(deadline*10!==nowCore+remaining)why.push('Reste du compte à rebours Core borné à la précision du pas local.');
 const sourcePacked=num(inner.node,'despawnedTick'),offset=w.tick-Math.floor(ctx.save.ticksGame/10);
 const knownPacked=sourcePacked!==undefined&&sourcePacked>=0&&sourcePacked<=ctx.save.ticksGame?Math.floor(sourcePacked/10)+offset:undefined;
 let packedAt=knownPacked??deadline-TREE_PACK_LIFETIME;
 if(knownPacked===undefined)why.push('Date historique de déracinement déduite du délai réel restant.');
 if(!Number.isSafeInteger(packedAt)||packedAt<0||packedAt>w.tick)return failure('Date de déracinement hors de l’horloge locale.');
 if(packedAt+TREE_PACK_LIFETIME>deadline){
  // The wrapper can run a shorter life after a Core debug action; the
  // current model has only an original deadline and a nonnegative pause.
  const delta=packedAt+TREE_PACK_LIFETIME-deadline;
  if(delta>1)return failure('Délai de mort réduit en dehors de la durée native de l’emballage.');
  packedAt=deadline-TREE_PACK_LIFETIME;
  why.push('Frontière de déracinement adaptée à l’arrondi du compte à rebours.');
 }
 if(packedAt<0)return failure('Déracinement antérieur au début de la partie.');
 const pause=deadline-packedAt-TREE_PACK_LIFETIME;
 if(pause>w.tick-packedAt)return failure('Suspension du délai non représentable.');
 const pos=inner.pos?ctx.coordinates.cell(inner.pos):undefined;
 const holder=requested.type==='ground'?requested:requested.type==='pawn'||requested.type==='inventory'?w.pawns.find(p=>p.id===requested.pawnId):undefined;
 const historical=pos&&ctx.inside(pos)?pos:holder;
 if(!historical||!ctx.inside(historical))return failure('Cellule historique et porteur original introuvables.');
 if(historical!==pos)why.push('Pose originale absente ou hors map, cellule réelle du porteur utilisée pour le record intérieur.');
 const trial={...w,tick:packedAt,phaseCore297:0,nextId:w.nextId+2},staged=new ImportContext({...ctx.save,ticksGame:Math.max(0,packedAt-offset)*10},ctx.map,trial,new ImportNotes(),ctx.geographic,ctx.factionIds);
 const tree=createWildPlantResource256(trial,w.nextId,historical.x,historical.z,mapped.to.wild,growth,false);
 if(!tree||tree.kind!=='tree')return failure('Plante intérieure non représentable.');
 if(!w.climate)delete tree.plantLife;
 importPlantCondition(staged,tree,inner);
 const pile:MinifiedTreePile={id:w.nextId+1,kind:'plant',item:'minified-tree',quantity:1,owner:{...requested},innerResource:tree,plantPack:{packedAt,expiresAt:packedAt+TREE_PACK_LIFETIME,...pause>0?{suspendedTicks271:pause}:{}}};
 if(t.hp!==undefined&&t.hp>=1&&t.hp<100)pile.damage=100-Math.round(t.hp);
 if(t.forbidden)why.push('Permission du paquet non représentable par le modèle des arbres emballés.');
 if(requested.type==='ground'){
  const free=(c:Cell)=>ctx.inside(c)&&groundPilesAt(w,c).length<groundMaxStacks(w,c)&&groundCapacity(w,c,pile)>=1;
  const cell=free(requested)?requested:nearbyGround(w,requested).find(free);
  if(!cell)return failure('Aucune case de stockage disponible pour l’arbre emballé.');
  pile.owner={type:'ground',x:cell.x,z:cell.z};if(cell.x!==requested.x||cell.z!==requested.z)why.push('Paquet déplacé vers une case disponible.');
 }else if(!validTradeInventoryCustody(w,pile,w.schemaVersion))return failure('Inventaire de l’arbre non admis.');
 if(!validTreePileShape(pile,w.schemaVersion,w.tick,trial.nextId,(resource,tick)=>validOriginalTreeResource(resource,trial,w.schemaVersion,tick)))return failure('Le paquet ne respecte pas le propriétaire et la chronologie de l’arbre d’Elsewhere.');
 if(w.piles.length>=32768||!Number.isSafeInteger(trial.nextId))return failure('Limite de piles ou identités atteinte.');
 appendPileEntries(w.piles,pile);w.nextId=trial.nextId;ctx.thingIds.set(t.id,pile.id);ctx.thingIds.set(inner.id,tree.id);
 for(const [family,table] of staged.notes.tallies)for(const row of table.values())notes.def(family,row.def,row.status,row.to,row.note,row.count,row.origin);
 notes.countAfter('items');notes.def('items','MinifiedTree',why.length?'adapted':'exact','minified-tree',why.join(' ')||undefined,1,why.length?'model':undefined);
 return pile;
}

/** Restore actual saved traces, not a new deposit (generation may reject a
 * legal already-present trace or move it to a random neighboring tile). */
export function importRwsFilth(ctx:ImportContext):void {
 const {map,w,notes}=ctx,state=ensureFilth(w),now=effectiveCore297(w),period=filthCheckPeriod(w);
 const existing=new Set(state.items.map(f=>`${f.x}:${f.z}:${f.kind}`));let restored=0,limited=0;
 for(const t of map.things){
  if(t.cls!=='Filth'||!t.pos)continue;
  notes.countBefore('items');const kind=Object.hasOwn(FILTH_MAP,t.def)?FILTH_MAP[t.def]:undefined;
  if(!kind){notes.def('items',t.def,'dropped',undefined,'Type de saleté non représenté dans Elsewhere.',1,'model');continue;}
  const cell=ctx.coordinates.cell(t.pos),key=`${cell.x}:${cell.z}:${kind}`;
  if(!ctx.inside(cell)||existing.has(key)||!terrainAcceptsFilth256(w.tiles[ctx.index(cell)]!)){notes.def('items',t.def,'dropped',kind,'Trace sur une case non admise par Elsewhere.',1,'model');continue;}
  const d=FILTH_DEFINITIONS[kind],elapsed=Math.max(0,ctx.save.ticksGame-(num(t.node,'growTick')??ctx.save.ticksGame));
  // The destination starts at a short local clock. The current schema cannot
  // encode a negative origin; preserve age where possible and explicitly
  // report when the lifetime must stay within the current validated domain.
  const grownCore=Math.max(0,now-elapsed),age=now-grownCore;
  const sourceLifetime=Math.round(num(t.node,'disappearAfterTicks')??d.minDays*60000);
  const expiresAfterCore=clamp(sourceLifetime-Math.max(0,elapsed-age),d.minDays*60000,d.maxDays*60000-(kind==='rock-rubble'?0:1));
  const phase=(Math.imul(ctx.index(cell),1103515245)>>>0)%period;
  // Filth aging itself runs at the macro frontier; only a newly grown
  // trace may have a substep origin. Its strict save interval is bounded
  // by max(macroNow, grownCore), not the current physical phase.
  const checkAnchor=Math.max(w.tick*10,grownCore);
  const nextCheckCore=checkAnchor+((phase-checkAnchor%period+period)%period||period);
  const rawThickness=Math.round(num(t.node,'thickness')??1),thickness=clamp(rawThickness,1,5),adapted=sourceLifetime-elapsed+age!==expiresAfterCore||thickness!==rawThickness;
  const record={id:w.nextId++,kind,...cell,thickness,grownCore,expiresAfterCore,nextCheckCore};
  state.items.push(record);filthAppended379(w,record);existing.add(key);
  ctx.thingIds.set(t.id,record.id);notes.countAfter('items');restored++;
  if(adapted)limited++;
  notes.def('items',t.def,adapted?'adapted':'exact',kind,adapted?'Durée ou épaisseur limitée par la chronologie locale.':undefined,1,adapted?'model':undefined);
 }
 if(restored)notes.mapped('items',`${restored} saletés réelles à leur emplacement (${limited} états de durée/épaisseur adaptés).`);
}

/** Egg containers are restored after animal IDs exist. Called after the
 * ground stage, as their contents are not ground piles. */
export function importRwsEggBoxContents(ctx:ImportContext):void {
 for(const box of ctx.map.things){
  if(box.def!=='EggBox')continue;
  const structureId=ctx.thingIds.get(box.id);
  if(structureId===undefined||!ctx.w.structures.some(s=>s.id===structureId&&s.kind==='egg-box'))continue;
  for(const entry of listItems(at(box.node,'innerContainer/innerList')))
   placeRwsMaterial(ctx,readThing(entry),{type:'egg-box374',structureId});
 }
 // Colonist inventories are read before the animal roster. Resolve actual
 // source parent identities only now, after both animal and corpse owners
 // exist. If the original reference cannot be represented, leave it absent.
 bindRwsEggParents(ctx);
}
export function bindRwsEggParents(ctx:ImportContext):void {
 const staged=pendingEggParents.get(ctx);if(!staged?.length)return;
 const {w,notes}=ctx;
 for(const {ids,source} of staged){
  const mother=referencedThingId(text(source.node,'hatcheeParent')),father=referencedThingId(text(source.node,'otherParent'));
  const motherId=mother?ctx.thingIds.get(mother):undefined,fatherId=father?ctx.thingIds.get(father):undefined;
  for(const id of ids){
   const pile=w.piles.find(p=>p.id===id);if(!pile?.egg)continue;
   const egg={...pile.egg,...motherId===undefined?{}:{motherId},...fatherId===undefined||fatherId===motherId?{}:{fatherId}};
   if(validEggPile256({...pile,egg},w.schemaVersion,w.tick,w.nextId))markPileContentWrite379(pile).egg=egg;
  }
  if(mother&&motherId===undefined||father&&(fatherId===undefined||fatherId===motherId))notes.def('animals',source.def+' : parent','dropped',undefined,'Parent réellement référencé sans identité représentée ; aucun parent inventé.',1,'unresolved');
 }
 pendingEggParents.delete(ctx);
}

/** A MinifiedThing is a held original Structure, not a pile of materials.
 * Preserve its inner historical pose and exact quality/damage where valid. */
export function placeRwsPacked(ctx:ImportContext,t:RwsThing,owner:PackedFurniture['owner']):PackedFurniture|undefined {
 const {w,notes}=ctx;notes.countBefore('items');
 const original=listItems(at(t.node,'innerContainer/innerList'))[0],inner=original?readThing(original):undefined;
 const failure=(why:string,origin:GapOrigin='model')=>{notes.def('items',inner?.def?`MinifiedThing (${inner.def})`:t.def,'dropped',undefined,why,1,origin);return undefined;};
 if(!inner||t.stack!==1)return failure('Emballage sans bâtiment original unique.','source');
 const mapping=lookup(BUILDING_MAP,inner.def);
 if(!mapping||isDropped(mapping)||!minifiable(mapping.to.kind))return failure('Bâtiment emballé absent ou non minifiable dans Elsewhere.');
 const spec=mapping.to,raw=inner.pos??(t.pos??{x:Math.floor(w.width/2),z:Math.floor(w.height/2)});
 const placed=placeRwsFootprint(ctx.coordinates,spec.kind,raw,inner.rot,spec.size);
 if(!placed||placed.x<0||placed.z<0)return failure('Emprise intérieure non représentable.');
 const building=buildStructure(ctx,inner,spec.kind,placed);if(!building)return failure('Bâtiment emballé non représentable.');
 if(building.power)building.power={...building.power,on:false,parentId:null};
 if(building.kind==='urn'&&w.worldFactions)building.factionId=inner.faction===ctx.save.playerFaction?w.worldFactions.playerFactionId:null;
 if(building.kind==='small-sculpture'||building.kind==='large-sculpture'){
  const author=resolveRwsArtAuthor(ctx,text(inner.node,'authorName'));
  if(!author)return failure('Auteur original de la sculpture emballée absent.','source');
  building.art={authorId:author.id,createdAt:w.tick};
  notes.def('items','MinifiedThing : date de création examinée','adapted',undefined,'La date exacte de création n’est pas enregistrée avec la sculpture ; date d’observation locale utilisée.',1,'source');
 }
 let target=owner;
 if(owner.type==='ground'){
  const free=(c:Cell)=>ctx.inside(c)&&groundOccupancyAllows(w,c)&&!shelfAt(w,c)&&!groundPilesAt(w,c).length&&!w.packed.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z);
  const cell=free(owner)?owner:nearbyGround(w,owner).find(free);
  if(!cell)return failure('Aucune case disponible pour le meuble emballé.');
  target={type:'ground',x:cell.x,z:cell.z};
 }
 const packed:PackedFurniture={building,owner:target};
 if(validatePackedFurnitureRecords([packed],w,w.schemaVersion,new Set<number>()).length)return failure('Le record original n’entre pas dans le modèle d’Elsewhere.');
 w.packed.push(packed);ctx.thingIds.set(t.id,building.id);ctx.thingIds.set(inner.id,building.id);
 const why=[...('adapt' in mapping&&mapping.adapt?[mapping.adapt]:[]),...(!inner.pos?['Pose historique du meuble absente de la source.']:[]),...(owner.type==='ground'&&target.type==='ground'&&(owner.x!==target.x||owner.z!==target.z)?['Emballage déplacé vers une case disponible.']:[]),...t.forbidden?['Permission du paquet original non représentable.']:[]].join(' ');
 notes.countAfter('items');notes.def('items',`MinifiedThing (${inner.def})`,why?'adapted':'exact',spec.kind,why||undefined);
 return packed;
}

/** Preserve actual carried quantity without inventing the in-flight job. The
 * model's interruptedCargo state retains the real held original until work
 * resumes. Only use it for its one-owner contract; other owners are explicit
 * adaptations to inventory. */
export function importRwsCarried(ctx:ImportContext):void {
 for(const t of ctx.map.things){
  if(t.def!=='Human'||!t.pos)continue;
  const id=ctx.thingIds.get(t.id),pawn=ctx.w.pawns.find(p=>p.id===id);if(!pawn)continue;
  for(const entry of listItems(at(t.node,'carryTracker/innerContainer/innerList'))){
   const thing=readThing(entry);
   if(!thing.def)continue;
   if(thing.cls==='Corpse')continue; // The deceased owner and real corpse were restored together.
   const m=lookup(ITEM_MAP,thing.def),item=m&&!isDropped(m)?m.to:undefined;
   const limit=item?ITEM_DEFINITIONS[item]?.stackLimit:undefined;
   const gear=Object.hasOwn(APPAREL_MAP,thing.def)||Object.hasOwn(WEAPON_MAP,thing.def);
   const held=ctx.w.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||ctx.w.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
   const carry=!held&&!pawn.jobId&&!pawn.haul&&!pawn.cooking&&!pawn.need&&pawn.state==='idle'&&!pawn.path.length&&pawn.orders.active===null&&(thing.def==='MinifiedThing'||gear&&thing.stack===1||limit!==undefined&&thing.stack<=limit);
   const owner=carry?{type:'pawn' as const,pawnId:pawn.id}:{type:'inventory' as const,pawnId:pawn.id};
   const result=thing.def==='MinifiedThing'?placeRwsPacked(ctx,thing,owner):gear?placeGear(ctx,thing,owner):placeRwsMaterial(ctx,thing,owner);
   if(result){
    if(carry)pawn.interruptedCargo=true;
    ctx.notes.adapted('items',`${thing.def} transporté : ${carry?'conservé dans le portage interrompu':'conservé dans l’inventaire'} (travail en cours non reconstitué).`);
   }
  }
 }
 bindRwsEggParents(ctx);
}
