import type {NativeUiState,NativeUiActions,NativePage,NativeRow,NativeControl} from './native-contract';
import type {World,Pawn,Command,MaterialPile} from '../sim/types';
import {TICKS_PER_DAY} from '../sim/types';
import type {CampaignGroupSummary,WorldGroupRecord} from '../sim/world-map-state';
import type {GroupPanelSnapshot,GroupPanelFacts,GroupDraft} from '../ui/group-panel';
import type {GroupFormationPreview,GroupMassView} from '../sim/group-panel-state';
import type {RetainedArrival261} from '../sim/caravan-encounter-state-261';
import type {CommercialBuyLine} from '../sim/commercial-state';
import {ITEM_DEFINITIONS} from '../sim/items';
import {QUALITY_LABELS} from '../sim/equipment-rules';
import {isColonist} from '../sim/affiliation';
import {campaignUIFacts,mapDisplayName,groupDisplayLabel,readMapRegistryState,type CampaignUIState} from '../ui/map-registry-adapter';
import {groupWorld,groupEntryActions} from '../sim/world-map-authority';
import {groupMemberChoices,groupSourceChoices,previewGroupFormation,groupRoutePreview,groupPermission,groupTradeQuote} from '../sim/group-authority';
import {actualCampReform260,reformMemberReason260,reformSourceChoices260,previewGroupReform260} from '../sim/group-reform-260';
import {worldTargetRetreatAvailable263} from '../sim/world-target-access-263';
import {previewPlayerRetreat261} from '../sim/caravan-player-retreat-261';
import {groupAnimalChoices256} from '../sim/group-animal-formation-256';
import {groupBedrollChoices256} from '../sim/group-bedroll-loading-256';
import {validGroupFreightPack258,groupFreightUnitMass258,groupPackedMassGrams258} from '../sim/group-freight-contract-258';
import {groupSplitCommand256,groupMergeCommand256} from '../ui/group-reorganization-panel-256';
import {travelActorLabel256,travelAnimalNeeds256,travelPackLabel256,travelAnimals256,travelPacks256} from '../ui/group-travel-readers-256';
import {quoteGroupGift274} from '../sim/group-gift-274';
import {quoteTradeRequestFulfill284} from '../sim/trade-request-fulfill-284';
import {quoteMeetingTrade261,type MeetingTradeLine261} from '../sim/caravan-meeting-trade-261';
import {previewGroupItinerary,previewGenericItinerary261,type GroupTravelEstimateResult} from '../sim/group-travel-estimate';
import {worldTargetChoices263,worldSiteLabel263} from '../ui/world-target-ui-263';
import {effectiveCore297} from '../sim/core-phase-297';
import type {WorldSite263} from '../sim/world-sites-state-263';
import {worldSettlementAccess256} from '../sim/world-faction-access';
import {settlementProximityWarning263} from '../sim/world-settlement-proximity-263';
import {settlementProximityText263} from '../ui/settlement-proximity-263';
import {planetTile,planetTileCount,planetGeography256} from '../sim/planet-geography-256';
import {scoutEligible} from '../sim/caravan-trip';
import {commercialPreparationReason,previewCommercialLoading} from '../sim/commercial-loading';
import {commercialPhaseView,commercialCargoSources} from '../ui/commercial-panel';
import {quoteCommercial,quoteCommercialSell} from '../sim/commercial-post';
import {reservedSourcesByPile} from '../sim/materials';
import type {CaravanEncounterProgressMessage261,CampEntryProgressMessage256} from '../bridge/protocol';

/** Every draft below contains choices/quantities only, never cloned owners. */
type NativeWorldState=NativeUiState&{caravanProgress?:CaravanEncounterProgressMessage261;campProgress?:CampEntryProgressMessage256};
type NativeWorldActions=NativeUiActions&{cancelCampEntry?:(id:number,groupId:number)=>Promise<unknown>};
let state:NativeWorldState|undefined,actions:NativeWorldActions|undefined;
let tab:'maps'|'groups'|'individual'|'factions'='maps';
let selectedTile:number|undefined;
let scope='',campaignIdentity='',scopeRevision=0,lastTick=-1,pending=false;
const kg=(grams:number)=>`${(grams/1000).toLocaleString('fr-FR',{maximumFractionDigits:3})} kg`;
const days=(core:number)=>`${Math.max(0,core/(TICKS_PER_DAY*10)).toLocaleString('fr-FR',{maximumFractionDigits:2})} j`;
const b=(id:string,label:string,onActivate:NativeControl['onActivate'],extra:Partial<NativeControl>={}):NativeControl=>({id,label,onActivate,...extra});
const r=(id:string,label:string,value?:string,detail?:string,controls?:NativeControl[]):NativeRow=>({id,label,value,detail,controls});
const source=():CampaignUIState=>{const value=state?.world??state?.campaign;if(!value)throw Error('La campagne n’est plus disponible.');return value;};
const local=():World=>{if(!state?.world)throw Error('Affichez la vraie carte locale avant cette opération.');return state.world;};
function show(page:NativePage):void {actions?.showPage(page);}
function rootPage():void {if(state&&actions)show(buildNativeWorld(state,actions));}
function page(id:string,title:string,rows:NativeRow[],controls:NativeControl[]=[],back:()=>void=rootPage):NativePage {return {id,title,rows,width:8.2,modal:true,actions:[...controls,b(`${id}-back`,'Retour',back)],onClose:back};}
function integer(value:string,min=0,max=Number.MAX_SAFE_INTEGER):number {const n=Number(value);if(value.trim()===''||!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Entier de ${min} à ${max} requis.`);return n;}
function numberRow(id:string,label:string,value:number,commit:(value:number)=>void,min=0,max=Number.MAX_SAFE_INTEGER,detail?:string):NativeRow{
 const input:NonNullable<NativeRow['input']>={value:String(value),kind:'number',onCommit:text=>{const next=integer(text,min,max);commit(next);input.value=String(next);return true;}};
 return {id,label,detail,input};
}
function quantities(values:ReadonlyMap<number,number>):CommercialBuyLine[]{return [...values].filter(([,n])=>n!==0).map(([pileId,quantity])=>{if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('Quantité entière positive ou nulle requise.');return {pileId,quantity};}).sort((a,b)=>a.pileId-b.pileId);}
function toggle(set:Set<number>,id:number):void {set.has(id)?set.delete(id):set.add(id);}
function actorNeeds(pawn:Pawn):string{return `Faim ${Math.round(pawn.hunger)} % · repos ${Math.round(pawn.rest)} % · ${pawn.state}${pawn.prisoner?' · Prisonnier':''}`;}
function tileLabel(id:number):string {const planet=source().planet,tile=planet&&planetTile(planet,id);return tile?`Case ${id} · ${tile.biome} · ${tile.hilliness}`:`Case ${id}`;}
function changeTab(next:typeof tab):void {tab=next;rootPage();}
export function setNativeWorldTab(next:'maps'|'groups'|'individual'|'factions'):void {tab=next;}
async function send(command:Command):Promise<unknown>{
 const current=actions?.readState?.()??state;
 if(!actions||current?.busy||current?.fault||pending)throw Error(current?.fault??'Attendez la fin de l’opération courante.');
 pending=true;
 try {const result=await actions.command(command);if(result&&typeof result==='object'&&'ok'in result&&result.ok===false)throw Error('reason'in result&&typeof result.reason==='string'?result.reason:'Commande refusée.');return result;}
 finally {pending=false;actions.refresh();}
}
async function pause():Promise<void>{if(!actions)throw Error('La pause est indisponible.');await actions.speed(0);}
function confirm(id:string,title:string,rows:NativeRow[],commit:()=>Promise<unknown>,back:()=>void=rootPage):void {show(page(id,title,rows,[b(`${id}-confirm`,'Confirmer',async()=>{await commit();back();})],back));}
function groupRow(id:number):CampaignGroupSummary {const row=campaignUIFacts(source())?.groups.find(g=>g.id===id);if(!row)throw Error('Cette caravane n’existe plus.');return row;}
function snapshot(groupId:number|null=null):GroupPanelSnapshot {
 const input=source(),campaign=campaignUIFacts(input),row=groupId===null?undefined:campaign?.groups.find(g=>g.id===groupId),world=groupId===null?('width'in input?input:groupWorld(input,null)):groupWorld(input,groupId);
 if(!world||groupId!==null&&!row)throw Error('Le contexte confirmé de cette caravane n’est plus disponible.');
 return {world,planet:input.planet,group:groupId===null?world.group:row!.state,losses:world.groupLosses??[],campaign,originMapId:row?.localMapId??row?.originMapId??campaign?.activeMapId??world.worldMaps?.selectedMapId??0,...groupId!==null?{entryActions:groupEntryActions(input,groupId)}:{}};
}
/** Same sim readers as group-adapter, without its transitive legacy globe/CSS. */
function facts(s:GroupPanelSnapshot,retreat=false):GroupPanelFacts {
 const world=s.world,site=(world.worldMaps?.sites??(world.campaignMap?.revision===2?world.campaignMap.maps:[])).find(m=>m.id===(world.campaignMap?.revision===2?world.campaignMap.activeMapId:world.worldMaps?.selectedMapId));
 const canRetreat=world.schemaVersion>=261&&!world.group&&!!site&&(site.kind==='battlefield'||worldTargetRetreatAvailable263(world,site)),reform=actualCampReform260(world)&&!world.group&&!(canRetreat&&retreat),origin=s.campaign?.maps.find(m=>m.id===s.originMapId)??world.worldMaps?.sites.find(m=>m.id===s.originMapId);
 return {...groupPermission(world),...!s.group&&origin?.tile!==null&&origin?.tile!==undefined?{originTile:origin.tile,originLabel:mapDisplayName(origin)}:{},canRetreat,retreat:canRetreat&&retreat,reform,maximumSources:world.piles.length,...canRetreat&&site?.tile!==null?{retreatTile:site?.tile??undefined}:{},candidates:reform?world.pawns.filter(p=>p.state!=='dead').map(pawn=>{const reason=reformMemberReason260(world,pawn);return {pawn,ok:!reason,...reason?{reason}:{}};}):groupMemberChoices(world),sources:reform?reformSourceChoices260(world):groupSourceChoices(world),animals:groupAnimalChoices256(world),bedrolls:reform?world.packed.filter(p=>p.owner.type==='ground'||p.owner.type==='inventory').map(pack=>{const ok=validGroupFreightPack258(pack,world,world.schemaVersion);return {pack,ok,...!ok?{reason:'Miniature ou composants inadmissibles.'}:{}};}):groupBedrollChoices256(world)};
}
const warnings:Record<string,string>={'no-food':'Presque aucune nourriture admissible.','short-food':'Moins de cinq jours de nourriture estimés.','rot-soon':'Au moins 75 % de la nutrition risque de pourrir avant cinq jours.','disliked-food':'Au moins la moitié des aliments humains risque de déplaire.','no-social':'Aucun membre choisi ne peut assurer les échanges sociaux.'};
function provisionsRows(value:GroupTravelEstimateResult|undefined):NativeRow[]{if(!value)return [];if(!value.ok)return [r('provisions-refused','Estimation indisponible',value.reason)];return [r('provisions-food','Autonomie alimentaire',`${value.foodDays.toLocaleString('fr-FR',{maximumFractionDigits:2})} j`,`${value.nutrition.toLocaleString('fr-FR',{maximumFractionDigits:2})} nutrition · cueillette ${value.forageNutritionPerDay.toLocaleString('fr-FR',{maximumFractionDigits:2})}/jour · conservation ${value.rotDays.toLocaleString('fr-FR',{maximumFractionDigits:2})} j`),...value.warnings.map(w=>r(`warning-${w}`,'Avertissement',warnings[w]??w))];}
function massRows(mass:GroupMassView):NativeRow[]{return [r('mass-total','Charge',`${kg(mass.grams)} / ${kg(mass.capacityGrams)}`,`Rations ${mass.rations} · pemmican ${mass.pemmicanUnits} · nutrition ${mass.provisionNutrition.toLocaleString('fr-FR',{maximumFractionDigits:2})}${mass.ridingFactor!==undefined?` · monture ×${mass.ridingFactor.toFixed(2)}`:''}`),...mass.byMember.map(m=>r(`mass-${m.pawnId}`,`Porteur #${m.pawnId}`,`${kg(m.grams)} / ${kg(m.capacityGrams)}`))];}
function tradeDraftRows(world:World,direction:'buy'|'sell'|'gift',lines:CommercialBuyLine[]):NativeRow[]{
 if(!lines.length)return [r('trade-draft-empty','Panier du brouillon','Aucun bien choisi')];
 if(direction==='gift'){const q=quoteGroupGift274(world,lines);return q.ok?[r('trade-draft-value','Valeur reconnue du cadeau',String(q.recognizedValue)),r('trade-draft-goodwill','Relations prévues',`${q.goodwillBefore} → ${q.goodwillAfter}`),...massRows(q.mass)]:[r('trade-draft-refusal','Brouillon non admissible',q.reason)];}
 const q=groupTradeQuote(world,direction,lines);return q.ok?[r('trade-draft-total','Total du panier',`${q.totalSilver} argent`),...massRows(q.mass)]:[r('trade-draft-refusal','Brouillon non admissible',q.reason)];
}
function meetingDraftRows(input:CampaignUIState,group:CampaignGroupSummary,lines:MeetingTradeLine261[]):NativeRow[]{
 if(!lines.length)return [r('meeting-draft-empty','Panier du brouillon','Aucun échange choisi')];
 const q=quoteMeetingTrade261(input,encounterRecord(group),lines);return q.ok?[r('meeting-draft-payment','Paiement du panier',`${q.paid} argent`,`${q.forgone} argent sans contrepartie, soumis à acceptation explicite`)]:[r('meeting-draft-refusal','Brouillon non admissible',q.reason)];
}
function commercialDraftRows(world:World,pawnId:number|undefined,quantity:number,silver:number,cargo:CommercialBuyLine[]):NativeRow[]{
 const pawn=world.pawns.find(pawn=>pawn.id===pawnId);if(!pawn)return [r('commercial-draft-missing','Choisissez le voyageur pour calculer la charge.')];
 const mass=previewCommercialLoading(world,pawn,quantity,silver,cargo.length?cargo:undefined);return mass?[r('commercial-draft-mass','Charge du brouillon',`${kg(mass.grams)} / ${kg(mass.capacityGrams)}`,mass.grams>mass.capacityGrams?'La charge dépasse la capacité du voyageur.':undefined)]:[r('commercial-draft-refusal','Chargement du brouillon non admissible')];
}
function individualDraftRows(direction:'buy'|'sell',lines:CommercialBuyLine[]):NativeRow[]{
 if(!lines.length)return [r('individual-draft-empty','Panier du brouillon','Aucun bien choisi')];
 const q=direction==='buy'?quoteCommercial(local(),lines):quoteCommercialSell(local(),lines);return q.ok?[r('individual-draft-total','Total du panier',`${q.totalSilver} argent`,`${q.remainingSilver} argent après l’échange`),r('individual-draft-mass','Charge après l’échange',`${kg(q.mass.grams)} / ${kg(q.mass.capacityGrams)}`)]:[r('individual-draft-refusal','Brouillon non admissible',q.reason)];
}

interface Formation {scope:string;mapId:number;retreat:boolean;members:Set<number>;animals:Set<number>;packs:Set<number>;sources:Map<number,number>;sourceItem?:MaterialPile['item'];sourcePage:number;destination?:number;stationary:boolean}
let formation:Formation|undefined;
function formationContext(draft:Formation):{s:GroupPanelSnapshot;f:GroupPanelFacts}{
 if(draft.scope!==scope)throw Error('La partie a changé. Préparez de nouveau le départ.');
 const s=snapshot();if(s.originMapId!==draft.mapId||s.group)throw Error('La carte ou sa formation a changé. Reprenez le départ.');return {s,f:facts(s,draft.retreat)};
}
function formationDraft(d:Formation,f:GroupPanelFacts):GroupDraft {return {memberIds:[...d.members],sources:quantities(d.sources),animalIds:[...d.animals],packedIds:[...d.packs],...f.reform&&d.stationary?{}:{destination:d.destination}};}
function previewFormation(d:Formation):GroupFormationPreview {const {s,f}=formationContext(d),draft=formationDraft(d,f);if(f.retreat)return draft.destination===undefined?{ok:false,reason:'Choisissez la direction de fuite.'}:previewPlayerRetreat261(s.world,{type:'group-start',retreat261:true,originMapId:s.originMapId,...draft,destination:draft.destination});return f.reform?previewGroupReform260(s.world,{originMapId:s.originMapId!,...draft}):draft.destination===undefined?{ok:false,reason:'Choisissez une destination.'}:previewGroupFormation(s.world,draft.memberIds,draft.sources,draft.destination,draft.packedIds,draft.animalIds);}
function openFormation(retreat=false):void {
 const s=snapshot(),f=facts(s,retreat);if(s.group)throw Error('Une formation est déjà engagée sur cette carte.');
 if(!f.actions.start.ok&&!f.reform&&!f.retreat)throw Error(f.actions.start.reason??'Ce départ n’est pas admissible.');
 formation={scope,mapId:s.originMapId!,retreat,members:new Set(),animals:new Set(),packs:new Set(),sources:new Map(),sourcePage:0,destination:retreat?f.retreatTile:selectedTile,stationary:!!f.reform};renderFormation(formation);
}
function renderFormation(d:Formation):void {
 const {s,f}=formationContext(d),rows:NativeRow[]=[r('formation-origin','Origine',f.originLabel,`Case ${f.originTile}. ${f.reform?'Reformation directe depuis les originaux du camp.':'Rassemblement, prises et sortie physiques des mêmes personnes et biens.'}`),r('formation-choice','Sélection',`${d.members.size} personnes · ${d.animals.size} animaux · ${d.packs.size} meubles`)];
 if(f.reform)rows.push(r('formation-stationary','Destination',d.stationary?'Rester sur place':'Partir vers une destination',undefined,[b('formation-stationary-toggle',d.stationary?'Sans destination':'Avec destination',()=>{d.stationary=!d.stationary;renderFormation(d);},{active:d.stationary})]));
 if(!d.stationary)rows.push(numberRow('formation-destination','Case de destination',d.destination??0,n=>{d.destination=n;renderFormation(d);},0,s.planet?planetTileCount(s.planet)-1:0));
 for(const choice of f.candidates){const p=choice.pawn;rows.push(r(`formation-person-${p.id}`,p.name,actorNeeds(p),choice.reason,[b(`formation-person-${p.id}-toggle`,d.members.has(p.id)?'Choisi':'Choisir',()=>{toggle(d.members,p.id);renderFormation(d);},{active:d.members.has(p.id),disabled:!choice.ok&&!d.members.has(p.id)})]));}
 for(const choice of f.animals??[]){const a=choice.animal;rows.push(r(`formation-animal-${a.id}`,travelActorLabel256(a),travelAnimalNeeds256(a),choice.reason,[b(`formation-animal-${a.id}-toggle`,d.animals.has(a.id)?'Choisi':'Choisir',()=>{toggle(d.animals,a.id);renderFormation(d);},{active:d.animals.has(a.id),disabled:!choice.ok&&!d.animals.has(a.id)})]));}
 for(const choice of f.bedrolls??[]){const pack=choice.pack,grams=groupPackedMassGrams258(pack,s.world.schemaVersion);rows.push(r(`formation-pack-${pack.building.id}`,travelPackLabel256(pack),grams===undefined?'Masse inconnue':kg(grams),choice.reason,[b(`formation-pack-${pack.building.id}-toggle`,d.packs.has(pack.building.id)?'Choisi':'Choisir',()=>{toggle(d.packs,pack.building.id);renderFormation(d);},{active:d.packs.has(pack.building.id),disabled:!choice.ok&&!d.packs.has(pack.building.id)})]));}
 const sourceItems=new Map<MaterialPile['item'],string>();
 for(const choice of f.sources)if(!sourceItems.has(choice.pile.item))sourceItems.set(choice.pile.item,ITEM_DEFINITIONS[choice.pile.item].label);
 if(d.sourceItem!==undefined&&!sourceItems.has(d.sourceItem)){delete d.sourceItem;d.sourcePage=0;}
 rows.push(r('formation-sources-filter','Type de bien',undefined,undefined,[b('formation-item-filter',d.sourceItem===undefined?'Tous les biens':sourceItems.get(d.sourceItem)!,()=>{},{select:{
  value:d.sourceItem??'',options:[{value:'',label:'Tous les biens'},...[...sourceItems].map(([value,label])=>({value,label}))],onChange:value=>{
   if(formation!==d)throw Error('Reprenez le brouillon courant.');
   const fresh=formationContext(d).f.sources,item=value===''?undefined:fresh.find(choice=>choice.pile.item===value)?.pile.item;
   if(value!==''&&item===undefined)throw Error('Ce type de bien n’est plus dans les sources disponibles.');
   d.sourceItem=item;d.sourcePage=0;renderFormation(d);
  },
 }})]));
 const sourceChoices=d.sourceItem===undefined?f.sources:f.sources.filter(choice=>choice.pile.item===d.sourceItem);
 const sourcePageSize=16,totalSources=sourceChoices.length;
 d.sourcePage=Math.min(d.sourcePage,Math.max(0,Math.ceil(totalSources/sourcePageSize)-1));
 const sourceStart=d.sourcePage*sourcePageSize;
 for(const choice of sourceChoices.slice(sourceStart,sourceStart+sourcePageSize)){const pile=choice.pile,unit=groupFreightUnitMass258(pile,s.world.schemaVersion);rows.push({...numberRow(`formation-pile-${pile.id}`,`${ITEM_DEFINITIONS[pile.item].label} · ${choice.available} dispo.`,d.sources.get(pile.id)??0,n=>{d.sources.set(pile.id,n);renderFormation(d);},0,choice.available),hint:`${ITEM_DEFINITIONS[pile.item].label} · pile ${pile.id}\n${pile.quantity} présentes · ${choice.reserved} réservées · ${choice.available} disponibles${unit===undefined?'':` · ${kg(unit)}/unité`}${pile.owner.type==='ground'?` · sol (${pile.owner.x}, ${pile.owner.z})`:'pawnId'in pile.owner?` · détenteur #${pile.owner.pawnId}`:''}${choice.reason?` · ${choice.reason}`:''}`,controls:[b(`formation-pile-${pile.id}-clear`,'Retirer',()=>{d.sources.delete(pile.id);renderFormation(d);},{icon:'cancel',presentation:'icon',hint:'Retirer cette pile du chargement.'})]});}
 if(totalSources>sourcePageSize)rows.push(r('formation-sources-page','Sources au sol',`${sourceStart+1}–${Math.min(totalSources,sourceStart+sourcePageSize)} / ${totalSources}`,undefined,[
  b('formation-sources-previous','Précédents',()=>{d.sourcePage=Math.max(0,d.sourcePage-1);renderFormation(d);},{disabled:d.sourcePage===0,hint:'Afficher les sources précédentes. Les quantités choisies sont conservées.'}),
  b('formation-sources-next','Suivants',()=>{d.sourcePage++;renderFormation(d);},{disabled:sourceStart+sourcePageSize>=totalSources,hint:'Afficher les sources suivantes. Les quantités choisies sont conservées.'}),
 ]));
 const preview=previewFormation(d);rows.push(r('formation-draft-preview','Vérification du brouillon',preview.ok?'Choix admissibles':preview.reason));if(preview.ok)rows.push(...massRows(preview.mass),...provisionsRows(preview.provisions));
 rows.push(r('formation-cleanup','Choix devenus indisponibles',undefined,'Les choix ne sont jamais remplacés silencieusement.',[b('formation-cleanup-action','Retirer les indisponibles',()=>{const fresh=formationContext(d).f;for(const id of d.members)if(!fresh.candidates.some(c=>c.pawn.id===id&&c.ok))d.members.delete(id);for(const id of d.animals)if(!fresh.animals?.some(c=>c.animal.id===id&&c.ok))d.animals.delete(id);for(const id of d.packs)if(!fresh.bedrolls?.some(c=>c.pack.building.id===id&&c.ok))d.packs.delete(id);for(const [id,n]of d.sources)if(!fresh.sources.some(c=>c.pile.id===id&&!c.reason&&n<=c.available))d.sources.delete(id);renderFormation(d);})]));
 show(page('formation',f.retreat?'Fuir par la bordure':f.reform?'Reformer la caravane':'Former une caravane',rows,[b('formation-preview','Vérifier la formation',()=>formationConfirmation(d)),b('formation-plan','Planifier des étapes',()=>itinerary(undefined,d))]));
}
function formationConfirmation(d:Formation):void {
 const {s,f}=formationContext(d),draft=formationDraft(d,f),preview=previewFormation(d);if(!preview.ok)throw Error(preview.reason);if(preview.provisions&&!preview.provisions.ok)throw Error(preview.provisions.reason);
 const key=JSON.stringify(draft),quote=preview.quote,warningKey=preview.provisions?.ok?preview.provisions.warnings.join(','):'';
 show(page('formation-confirm',f.reform?'Confirmer la reformation':'Confirmer le départ',[...massRows(preview.mass),r('formation-route','Itinéraire',preview.route.map(tileLabel).join(' → ')),...provisionsRows(preview.provisions),...preview.carriers.map(c=>r(`formation-carrier-${c.pileId}`,`Pile ${c.pileId}`,`${c.quantity} unités · porteur #${c.pawnId}`))],[b('formation-commit',warningKey?'Former malgré ces avertissements':'Confirmer la formation',async()=>{
  const fresh=formationContext(d),next=formationDraft(d,fresh.f),checked=previewFormation(d);if(JSON.stringify(next)!==key||!checked.ok)throw Error(checked.ok?'Le choix de départ a changé.':checked.reason);if(checked.provisions&&!checked.provisions.ok)throw Error(checked.provisions.reason);const warningsNow=checked.provisions?.ok?checked.provisions.warnings.join(','):'';if(warningsNow!==warningKey||fresh.f.reform&&(!quote||checked.quote!==quote))throw Error('Les propriétaires, l’accès ou les avertissements ont changé. Vérifiez à nouveau.');
  if(fresh.f.reform){if(!checked.quote)throw Error('Le devis réel de reformation est absent.');await send({type:'group-reform',originMapId:fresh.s.originMapId!,...next,quote:checked.quote});}else {if(next.destination===undefined)throw Error('Destination absente.');await send({type:'group-start',...fresh.f.retreat?{retreat261:true as const}:{},originMapId:fresh.s.originMapId!,...next,destination:next.destination});}formation=undefined;rootPage();
 })],()=>renderFormation(d)));
}

function groupPeople(s:GroupPanelSnapshot):Pawn[]{const g=s.group;return !g?[]:'members'in g?g.members:g.memberIds.map(id=>{const p=s.world.pawns.find(p=>p.id===id);if(!p)throw Error('Un membre ne possède plus son propriétaire local.');return p;});}
function groupDetail(id:number):void {
 const s=snapshot(id),g=s.group;if(!g)throw Error('Cette caravane n’existe plus.');const f=facts(s),row=groupRow(id),people=groupPeople(s),animals=travelAnimals256(s),owners=new Set([...people.map(p=>p.id),...animals.map(a=>a.id)]);
 const goods='items'in g?g.items:s.world.piles.filter(p=>'pawnId'in p.owner&&owners.has(p.owner.pawnId)),packs=travelPacks256(s,owners);
 const rows:NativeRow[]=[r('group-phase',groupDisplayLabel(row),`Destination ${tileLabel(g.destination)}`,`Origine ${tileLabel(f.originTile)}${'tile'in g?` · position ${tileLabel(g.tile)}`:''}${'stop'in g&&g.stop?` · arrêt ${g.stop.kind}`:''}`),...f.mass?massRows(f.mass):[]];
 if(row.arrival261)rows.push(r('group-arrival-confirmed','Action d’arrivée confirmée',arrivalLabel(row.arrival261.action),tileLabel(row.arrival261.tile)));
 else rows.push(r('group-arrival-confirmed','Action d’arrivée confirmée','S’arrêter sur la tuile'));
 for(const p of people)rows.push(r(`group-person-${p.id}`,p.name,actorNeeds(p),p.caravanCarrySick===false?'Portage en cas de maladie désactivé':'Portage en cas de maladie autorisé',[
  ...s.world.pawns.includes(p)?[b(`group-person-${p.id}-inspect`,'Dossier',()=>actions?.selectPawn(p.id))]:[],
  ...'members'in g&&s.world.schemaVersion>=256?[b(`group-person-${p.id}-carry`,p.caravanCarrySick===false?'Autoriser le portage':'Désactiver le portage',()=>send({type:'group-carry-sick',groupId:id,pawnId:p.id,enabled:groupPeople(snapshot(id)).find(q=>q.id===p.id)?.caravanCarrySick===false}),{disabled:g.travel?.revision!==1})]:[],
 ]));
 for(const a of animals)rows.push(r(`group-animal-${a.id}`,travelActorLabel256(a),travelAnimalNeeds256(a),undefined,'members'in g?[b(`group-animal-${a.id}-carry`,a.caravanCarrySick===false?'Autoriser le portage':'Désactiver le portage',()=>send({type:'group-carry-sick',groupId:id,pawnId:a.id,enabled:travelAnimals256(snapshot(id)).find(q=>q.id===a.id)?.caravanCarrySick===false}),{disabled:g.travel?.revision!==1&&!g.animalOwners?.interval})]:undefined));
 for(const pile of goods){const holderId='pawnId'in pile.owner?pile.owner.pawnId:undefined,holder=[...people,...animals].find(p=>p.id===holderId),unit=groupFreightUnitMass258(pile,s.world.schemaVersion),quality=pile.apparel?.quality??pile.weapon?.quality??pile.book?.quality;rows.push(r(`group-good-${pile.id}`,`${pile.quantity} ${pile.book?.title??ITEM_DEFINITIONS[pile.item].label}`,holder?travelActorLabel256(holder):pile.owner.type,`Pile ${pile.id} · ${pile.owner.type}${unit===undefined?'':` · ${kg(unit*pile.quantity)}`}${quality?` · ${QUALITY_LABELS[quality]}`:''}`));}
 for(const pack of packs){const mass=groupPackedMassGrams258(pack,s.world.schemaVersion);rows.push(r(`group-pack-${pack.building.id}`,travelPackLabel256(pack),mass===undefined?'Masse indisponible':kg(mass),pack.owner.type==='ground'?`Au sol ${pack.owner.x}, ${pack.owner.z}`:`Détenu par #${pack.owner.pawnId}`));}
 if('manifest'in g)for(const [index,line]of g.manifest.entries())rows.push(r(`manifest-${index}`,`${line.quantity} ${ITEM_DEFINITIONS[line.item].label}`,`Porteur #${line.carrierId}`,line.carriedPileId===undefined?'Prise physique en attente':line.animalCarrierId!==undefined?line.deliveredToAnimal?'Remis à l’animal':'Pris ; remise à l’animal attendue':'Pris au contact'));
 const controls:NativeControl[]=[];
 for(const [action,label,command]of [
  ['cancel','Annuler la formation',():Command=>({type:'group-cancel',groupId:id})],
  ['pause','members'in g&&g.paused?'Reprendre la marche':'Suspendre la marche',():Command=>{const current=snapshot(id).group;if(!current||!('members'in current))throw Error('Cette caravane n’est plus hors carte.');return {type:'group-pause',groupId:id,paused:!current.paused};}],
  ['return','Revenir à l’origine',():Command=>({type:'group-route',groupId:id,destination:f.originTile})],
  ['unload','Décharger les biens portés',():Command=>({type:'group-unload',originMapId:s.originMapId!,groupId:id,memberIds:people.map(p=>p.id),animalIds:animals.map(a=>a.id)})],
 ] as const){const permission=f.actions[action];if(permission.ok)controls.push(b(`group-${action}`,label,async()=>{await send(command());groupDetail(id);}));}
 if('members'in g){
  controls.push(b('group-route','Destination et arrivée',()=>routeEditor(id),{disabled:!f.actions.route.ok,hint:f.actions.route.reason}),b('group-split','Séparer',()=>splitEditor(id)),b('group-merge','Regrouper',()=>mergeEditor(id)),b('group-itinerary','Planifier des étapes',()=>itinerary(id)));
  if(f.trade)controls.push(b('group-buy','Acheter',()=>tradeEditor(id,'buy'),{disabled:!f.actions.buy.ok,hint:f.actions.buy.reason}),b('group-sell','Vendre',()=>tradeEditor(id,'sell'),{disabled:!f.actions.sell.ok,hint:f.actions.sell.reason}));
  const gift=quoteGroupGift274(s.world,[]);if(gift.ok)controls.push(b('group-gift','Faire un cadeau',()=>tradeEditor(id,'gift')));
  for(const request of s.world.tradeRequests284?.entries??[])if(request.status==='accepted'&&request.tile===g.tile)controls.push(b(`group-deliver-${request.id}`,'Remplir la demande commerciale',()=>deliverRequest(id,request.id)));
  for(const mode of ['visit','camp','settle'] as const){const permission=s.entryActions?.[mode];if(permission?.ok)controls.push(b(`group-enter-${mode}`,{visit:'Entrer sur la carte',camp:'Former un camp temporaire',settle:'S’installer'}[mode],()=>enterGroup(id,mode)));}
  if(['at-site','stationary','awaiting-entry'].includes(g.phase))for(const choice of worldTargetChoices263(s.world,g.tile))controls.push(b(`target-${choice.key}`,choice.label,()=>targetOrder(id,g.tile,choice.key),{disabled:!choice.ok,hint:choice.reason}));
 }
 show(page(`group-${id}`,'Caravane',rows,controls));
}
function arrivalLabel(action:RetainedArrival261):string {if(!action)return 'S’arrêter sur la tuile';switch(action.kind){case 'enter':return `Entrer sur la carte ${action.mapId}`;case 'trade':return `Commercer à l’établissement ${action.settlementId}`;case 'attack-settlement':return `Attaquer l’établissement ${action.settlementId}`;case 'visit-site':return `Visiter le site ${action.siteId}`;case 'peace-talks':return `Participer aux pourparlers ${action.siteId}`;}}
function arrivalChoices(s:GroupPanelSnapshot,tile:number):{id:string;label:string;action:RetainedArrival261;disabled?:boolean;reason?:string;confirmAttack?:boolean}[]{
 const result:{id:string;label:string;action:RetainedArrival261;disabled?:boolean;reason?:string;confirmAttack?:boolean}[]=[{id:'none',label:'S’arrêter sur la tuile',action:null}];
 for(const map of s.campaign?.maps??[])if(map.tile===tile)result.push({id:`map-${map.id}`,label:`Entrer · ${mapDisplayName(map)}`,action:{kind:'enter',mapId:map.id}});
 for(const settlement of s.world.worldFactions?.settlements??[])if(settlement.tile===tile){const access=worldSettlementAccess256(s.world.worldFactions!,settlement.id);if(access.ok&&access.canTrade)result.push({id:`trade-${settlement.id}`,label:`Commerce · ${settlement.name}`,action:{kind:'trade',settlementId:settlement.id,factionId:settlement.factionId,postId:settlement.postId}});}
 for(const choice of worldTargetChoices263(s.world,tile))result.push({id:choice.key,label:choice.label,action:choice.target,disabled:!choice.ok,reason:choice.reason,confirmAttack:choice.confirmAttack});return result;
}
function routeEditor(id:number,initialDestination=selectedTile):void {
 const s=snapshot(id),g=s.group;if(!g||!('members'in g))throw Error('La caravane doit être hors carte.');let destination=initialDestination??g.destination,arrival='none';
 const make=():NativePage=>{const current=snapshot(id),choices=arrivalChoices(current,destination);return page(`route-${id}`,'Destination et action à l’arrivée',[
  numberRow('route-tile','Destination',destination,n=>{destination=n;arrival='none';show(make());},0,current.planet?planetTileCount(current.planet)-1:0),
  ...choices.map(choice=>r(`arrival-${choice.id}`,choice.label,undefined,choice.reason,[b(`arrival-${choice.id}-choose`,arrival===choice.id?'Choisie':'Choisir',()=>{arrival=choice.id;show(make());},{active:arrival===choice.id,disabled:choice.disabled})])),
 ],[b('route-check','Calculer la route',()=>{const fresh=snapshot(id),preview=groupRoutePreview(fresh.world,destination),choice=arrivalChoices(fresh,destination).find(c=>c.id===arrival);if(!preview.ok)throw Error(preview.reason);if(!choice||choice.disabled)throw Error(choice?.reason??'L’action d’arrivée n’est plus disponible.');const target=JSON.stringify(choice.action),warning=choice.confirmAttack?'Cet établissement appartient à une faction neutre ou amie. L’attaque aura les conséquences diplomatiques ordinaires.':undefined;
  show(page('route-confirm','Confirmer le nouvel ordre',[r('route-result',tileLabel(destination),`${preview.route.length} cases · ${days(preview.durationCore)}`,choice.label),...provisionsRows(preview.provisions),...warning?[r('route-attack-warning','Confirmer l’attaque',warning)]:[]],[b('route-commit','Confirmer l’ordre',async()=>{const checked=snapshot(id),permission=facts(checked).actions.route,route=groupRoutePreview(checked.world,destination),now=arrivalChoices(checked,destination).find(c=>c.id===arrival);if(!permission.ok||!route.ok||!now||now.disabled||JSON.stringify(now.action)!==target||now.confirmAttack&&!choice.confirmAttack)throw Error('La route, la permission ou la cible a changé. Vérifiez à nouveau.');await send(checked.world.schemaVersion>=261?{type:'caravan-order',groupId:id,destination,action:now.action}:{type:'group-route',groupId:id,destination});groupDetail(id);})],()=>show(make())));
 })],()=>groupDetail(id));};show(make());
}
function targetOrder(id:number,tile:number,key:string):void {
 const s=snapshot(id),choice=worldTargetChoices263(s.world,tile).find(c=>c.key===key);if(!choice?.ok)throw Error(choice?.reason??'Cette cible est indisponible.');const captured=JSON.stringify(choice.target);
 confirm('world-target-confirm',choice.label,[r('target-tile',tileLabel(tile)),...choice.confirmAttack?[r('target-warning','Conséquences diplomatiques','Cette faction est neutre ou amie. Confirmer l’attaque et les conséquences ordinaires ?')]:[]],async()=>{const fresh=snapshot(id),now=worldTargetChoices263(fresh.world,tile).find(c=>c.key===key),route=groupRoutePreview(fresh.world,tile);if(!now?.ok||JSON.stringify(now.target)!==captured||now.confirmAttack&&!choice.confirmAttack||!route.ok)throw Error('La cible ou son accès a changé. Vérifiez à nouveau.');await send({type:'caravan-order',groupId:id,destination:tile,action:now.target});},()=>groupDetail(id));
}
async function enterGroup(id:number,mode:'visit'|'camp'|'settle'):Promise<void> {
 const s=snapshot(id),g=s.group;if(!g||!('members'in g))throw Error('La caravane n’est plus hors carte.');const tile=g.tile,warning=mode==='settle'?settlementProximityText263(settlementProximityWarning263(s.world,tile)):'';
 const commit=async()=>{const fresh=snapshot(id);if(!fresh.group||!('members'in fresh.group)||fresh.group.tile!==tile||!fresh.entryActions?.[mode].ok||mode==='settle'&&settlementProximityText263(settlementProximityWarning263(fresh.world,tile))!==warning)throw Error('La situation de l’entrée a changé.');await send({type:'group-enter',groupId:id,mode});rootPage();};
 if(warning)confirm('settlement-entry-confirm','S’installer ici ?',[r('settlement-warning',warning)],commit,()=>groupDetail(id));else await commit();
}

async function splitEditor(id:number):Promise<void>{
 await pause();const s=snapshot(id),g=s.group;if(!g||!('members'in g))throw Error('La caravane doit être hors carte.');
 const people=new Set<number>(),animals=new Set<number>(),packs=new Set<number>(),inventory=new Map<number,string>();
 const make=():NativePage=>{const current=snapshot(id),group=current.group;if(!group||!('members'in group))throw Error('La caravane confirmée a changé.');return page(`split-${id}`,'Séparer la caravane',[
  r('split-help','Le jeu reste en pause',undefined,'Les vêtements et équipements suivent leur personne. Les originaux choisis vont dans la nouvelle caravane stationnée ; la caravane d’origine conserve route et progression.'),
  ...group.members.map(p=>r(`split-person-${p.id}`,p.name,actorNeeds(p),undefined,[b(`split-person-${p.id}-toggle`,people.has(p.id)?'Nouvelle caravane':'Caravane d’origine',()=>{toggle(people,p.id);show(make());},{active:people.has(p.id)})])),
  ...(group.animalOwners?.members??[]).map(a=>r(`split-animal-${a.id}`,travelActorLabel256(a),travelAnimalNeeds256(a),undefined,[b(`split-animal-${a.id}-toggle`,animals.has(a.id)?'Nouvelle caravane':'Caravane d’origine',()=>{toggle(animals,a.id);show(make());},{active:animals.has(a.id)})])),
  ...group.items.filter(p=>p.owner.type==='inventory').map(p=>({...numberRow(`split-pile-${p.id}`,`${ITEM_DEFINITIONS[p.item].label} · pile ${p.id}`,Number(inventory.get(p.id)??0),n=>{inventory.set(p.id,String(n));show(make());},0,p.quantity,`${p.quantity} unités dans l’inventaire original`)})),
  r('split-draft-summary','Nouvelle caravane',`${people.size} personnes · ${animals.size} animaux · ${packs.size} meubles · ${[...inventory.values()].reduce((sum,value)=>sum+Number(value),0)} unités d’inventaire choisies`),
  ...(group.packed??[]).map(pack=>r(`split-pack-${pack.building.id}`,travelPackLabel256(pack),undefined,undefined,[b(`split-pack-${pack.building.id}-toggle`,packs.has(pack.building.id)?'Nouvelle caravane':'Caravane d’origine',()=>{toggle(packs,pack.building.id);show(make());},{active:packs.has(pack.building.id)})])),
 ],[b('split-confirm','Confirmer la séparation',async()=>{const command=groupSplitCommand256(snapshot(id),{people,animals,packs,inventory});await send(command);rootPage();})],()=>groupDetail(id));};show(make());
}
async function mergeEditor(id:number):Promise<void>{
 await pause();const selected:number[]=[];
 const make=():NativePage=>{const s=snapshot(id);return page(`merge-${id}`,'Regrouper des caravanes',[
  r('merge-help','Le jeu reste en pause',undefined,'L’ordre de sélection est conservé. Le serveur vérifie la proximité réelle ; aucun membre ni bien ne se déplace à distance.'),
  ...(s.campaign?.groups??[]).filter(g=>g.localMapId===null&&'members'in g.state).map(g=>r(`merge-${g.id}`,groupDisplayLabel(g),g.tile===null?undefined:tileLabel(g.tile),undefined,[b(`merge-${g.id}-toggle`,selected.includes(g.id)?`Choix ${selected.indexOf(g.id)+1}`:'Choisir',()=>{const at=selected.indexOf(g.id);at<0?selected.push(g.id):selected.splice(at,1);show(make());},{active:selected.includes(g.id)})])),
 ],[b('merge-confirm','Confirmer le regroupement',async()=>{await send(groupMergeCommand256(snapshot(id),selected));rootPage();},{disabled:selected.length<2})],()=>groupDetail(id));};show(make());
}

async function tradeEditor(id:number,direction:'buy'|'sell'|'gift'):Promise<void>{
 await pause();const values=new Map<number,number>();
 const make=():NativePage=>{const s=snapshot(id),f=facts(s),gift=direction==='gift'?quoteGroupGift274(s.world,[]):undefined,goods=direction==='gift'?gift?.ok?gift.goods:[]:direction==='buy'?f.trade?.buys??[]:f.trade?.sells??[];
  if(direction==='gift'&&!gift?.ok)throw Error(gift?.reason??'Ce cadeau est indisponible.');if(direction!=='gift'&&!f.trade)throw Error('La caravane n’est plus au véritable comptoir.');
  return page(`group-${direction}-${id}`,direction==='buy'?'Achats au comptoir':direction==='sell'?'Ventes de l’inventaire':'Cadeau diplomatique',[
   r('trade-funds','Comptoir réel',f.trade?`Caravane ${f.trade.groupSilver} argent · poste ${f.trade.postSilver} argent`:undefined,f.trade?.negotiator?`Négociateur ${f.trade.negotiator.name}`:f.trade?.refusal),
   ...goods.map(g=>numberRow(`trade-good-${g.pile.id}`,`${ITEM_DEFINITIONS[g.pile.item].label} · pile ${g.pile.id}`,values.get(g.pile.id)??0,n=>{values.set(g.pile.id,n);show(make());},0,g.available,`${g.available} disponibles · ${g.unitPrice.toLocaleString('fr-FR',{maximumFractionDigits:2})} argent/unité${'reason'in g&&g.reason?` · ${g.reason}`:''}`)),
   ...tradeDraftRows(s.world,direction,quantities(values)),
  ],[b('trade-quote','Vérifier le panier',()=>{
   const current=snapshot(id),lines=quantities(values);if(!lines.length)throw Error('Choisissez au moins un bien.');
   if(direction==='gift'){const q=quoteGroupGift274(current.world,lines);if(!q.ok)throw Error(q.reason);confirm('gift-confirm',`Cadeau à ${q.factionName}`,[r('gift-value','Valeur reconnue',String(q.recognizedValue)),r('gift-goodwill','Relations',`${q.goodwillBefore} → ${q.goodwillAfter}`,`Gain demandé ${q.requestedGain} · gain appliqué ${q.appliedGain}`),...massRows(q.mass)],async()=>{const checked=quoteGroupGift274(snapshot(id).world,lines);if(!checked.ok||checked.signature!==q.signature)throw Error('Le devis du cadeau a changé.');await send({type:'group-gift274',groupId:id,lines,quote:q.signature});},()=>groupDetail(id));return;}
   const q=groupTradeQuote(current.world,direction,lines);if(!q.ok)throw Error(q.reason);confirm('trade-confirm',direction==='buy'?'Confirmer les achats':'Confirmer les ventes',[r('trade-total','Total',`${q.totalSilver} argent`),...massRows(q.mass)],async()=>{const checked=groupTradeQuote(snapshot(id).world,direction,lines);if(!checked.ok||checked.signature!==q.signature)throw Error('Le devis, le stock ou les propriétaires ont changé.');await send({type:direction==='buy'?'group-buy':'group-sell',groupId:id,lines,quote:q.signature});},()=>groupDetail(id));
  })],()=>groupDetail(id));};show(make());
}
async function deliverRequest(id:number,requestId:number):Promise<void>{
 await pause();const q=quoteTradeRequestFulfill284(snapshot(id).world,requestId,id);if(!q.ok)throw Error(q.reason);
 confirm('delivery-confirm','Remplir la demande commerciale',[r('delivery-count','Objets remis',`${q.required} admissibles sur ${q.available}`),...q.rewards.map(p=>r(`delivery-reward-${p.id}`,`${p.quantity} ${ITEM_DEFINITIONS[p.item].label}`,p.quality?QUALITY_LABELS[p.quality]:undefined)),r('delivery-bonus','Relations','Bonus de livraison +12 ; récompense de l’option choisie.'),r('delivery-mass','Charge après remise',`${kg(q.mass.grams)} / ${kg(q.mass.capacityGrams)}`,q.mass.grams>q.mass.capacityGrams?'La récompense surchargera la caravane ; sa marche attendra une charge admissible.':undefined)],async()=>{const checked=quoteTradeRequestFulfill284(snapshot(id).world,requestId,id);if(!checked.ok||checked.quote!==q.quote)throw Error('La remise ou ses propriétaires ont changé.');await send({type:'trade-request-fulfill',requestId,groupId:id,quote:q.quote,confirm:true});},()=>groupDetail(id));
}

async function itinerary(groupId?:number,draft?:Formation):Promise<void>{
 await pause();const s=groupId===undefined?snapshot():snapshot(groupId),f=facts(s),g=s.group;
 const plan=draft?previewFormation(draft):undefined,mass=plan?.ok?plan.mass:f.mass;
 const generic=!mass,origin=g&&'tile'in g?g.tile:f.originTile;let points:number[]=generic?[]:[origin],next=selectedTile??origin;
 const query=()=>{const current=groupId===undefined?snapshot():snapshot(groupId);return generic?previewGenericItinerary261(current.world,points):previewGroupItinerary(current.world,points,mass!);};
 const make=():NativePage=>page('world-itinerary',generic?'Estimation sans caravane':'Planifier des étapes',[
  r('itinerary-help','Plan temporaire',undefined,generic?'Estimation selon une vitesse moyenne ; aucune autonomie alimentaire n’est inventée.':'Accepter choisit seulement la première destination. Les étapes suivantes ne sont pas enregistrées comme des ordres.'),
  numberRow('itinerary-next','Case à ajouter',next,n=>{next=n;show(make());},0,s.planet?planetTileCount(s.planet)-1:0),
  ...points.map((tile,index)=>r(`itinerary-point-${index}`,`${index+1}. ${tileLabel(tile)}`,undefined,undefined,index>0||generic?[b(`itinerary-point-${index}-remove`,'Retirer',()=>{points=points.filter((_,i)=>i!==index).filter((v,i,a)=>i===0||v!==a[i-1]);show(make());})]:undefined)),
 ],[b('itinerary-add','Ajouter la case',()=>{if(points.length>=25)throw Error('Le plan accepte au plus 25 points.');if(points.at(-1)===next)throw Error('Cette case est déjà la dernière étape.');points=[...points,next];const result=query();if(!result.ok){points=points.slice(0,-1);throw Error(result.reason);}show(make());}),b('itinerary-check','Calculer les étapes',()=>{const result=query();if(!result.ok)throw Error(result.reason);show(page('itinerary-result','Itinéraire calculé',[r('itinerary-duration','Durée finale',days(result.durationCore)),...result.points.map((tile,index)=>r(`itinerary-result-${index}`,tileLabel(tile),days(result.waypointCore[index]??0)))],!generic&&points.length>=2?[b('itinerary-accept','Choisir la première destination',()=>{if(draft){draft.destination=points[1]!;draft.stationary=false;renderFormation(draft);}else if(groupId!==undefined)routeEditor(groupId,points[1]);})]:[],()=>show(make())));})],draft?()=>renderFormation(draft):groupId===undefined?rootPage:()=>groupDetail(groupId));show(make());
}

function encounterRecord(row:CampaignGroupSummary):WorldGroupRecord{return {originMapId:row.originMapId,localMapId:row.localMapId,context:row.context,state:row.state,...row.encounters261?{encounters261:row.encounters261}:{},...row.pending261?{pending261:row.pending261}:{}};}
function encounterPage(row:CampaignGroupSummary):NativePage {
 const p=row.pending261,pendingEntry=row.pendingEntry263,g=row.state,progress=state?.caravanProgress?.groupId===row.id?state.caravanProgress:undefined;
 if(pendingEntry){const controls:NativeControl[]=[];if('tile'in g){if(progress?.phase==='refused')controls.push(b('entry-retry','Réessayer cette entrée',()=>send({type:'caravan-order',groupId:row.id,destination:g.tile,action:pendingEntry.target})));controls.push(b('entry-cancel','Annuler cette entrée',()=>send({type:'caravan-order',groupId:row.id,destination:g.tile,action:null})));}return {id:`encounter-entry-${row.id}`,title:pendingEntry.target.kind==='attack-settlement'?'Entrée dans l’établissement':'Visite du site',modal:true,width:7.8,rows:[r('entry-state','Préparation des mêmes voyageurs et biens',progress?.reason??progress?.phase??'Préparation de l’entrée','La décision réelle possède la pause.'),r('entry-location',tileLabel('tile'in g?g.tile:g.destination))],actions:controls,onClose:()=>{}};}
 if(!p)throw Error('Cette rencontre n’est plus présente.');
 const title=p.kind==='meeting'?'Rencontre de caravanes':p.kind==='demand'?'Demande de paiement':p.kind==='peace-talks'?'Attaque après les pourparlers':'Embuscade';
 const rows:NativeRow[]=[r('encounter-state',p.decision==='open'?'Votre décision est attendue':'Préparation du champ de bataille',progress?.reason??progress?.phase,'La caravane et ses interlocuteurs sont les propriétaires réels. La simulation reste en pause.')];
 if(p.kind==='demand'&&'members'in g)for(const [index,line]of p.demands.entries()){
  let label:string;
  if(line.kind==='human')label=g.members.find(a=>a.id===line.id)?.name??`Personne ${line.id}`;
  else if(line.kind==='animal'){const a=g.animalOwners?.members.find(a=>a.id===line.id);label=a?travelActorLabel256(a):`Animal ${line.id}`;}
  else if(line.kind==='packed'){const pack=g.packed?.find(pack=>pack.building.id===line.id);label=pack?`${line.quantity} ${travelPackLabel256(pack)}`:`Mobilier ${line.id}`;}
  else {if(!('quantity'in line))throw Error('La quantité de cette demande est absente.');const pile=g.items.find(i=>i.id===line.id);label=`${line.quantity} ${pile?ITEM_DEFINITIONS[pile.item].label:'bien'} · pile ${line.id}`;}
  rows.push(r(`demand-${index}`,'Demandé',label));
 }
 const controls:NativeControl[]=[];
 if(p.decision==='open'){
  if(p.kind==='meeting')controls.push(b('encounter-trade','Commerce',()=>meetingTrade(row.id)),b('encounter-attack','Attaquer',()=>confirm('encounter-attack-confirm','Attaquer cette caravane ?',[r('encounter-attack-warning','Les mêmes adversaires et voyageurs entreront dans leur vrai champ de bataille.')],()=>send({type:'caravan-encounter-choice',groupId:row.id,choice:'attack'}),()=>show(encounterPage(groupRow(row.id))))),b('encounter-continue','Continuer',()=>send({type:'caravan-encounter-choice',groupId:row.id,choice:'continue'})));
  else if(p.kind==='demand')controls.push(b('encounter-give','Donner',()=>confirm('encounter-give-confirm','Céder les biens et personnes demandés ?',rows.slice(1),()=>send({type:'caravan-encounter-choice',groupId:row.id,choice:'give'}),()=>show(encounterPage(groupRow(row.id))))),b('encounter-fight','Combattre',()=>send({type:'caravan-encounter-choice',groupId:row.id,choice:'fight'})));
 }else if(progress?.phase==='refused')controls.push(b('encounter-retry','Réessayer cette entrée',()=>send({type:'caravan-encounter-choice',groupId:row.id,choice:'retry'})));
 return {id:`encounter-${row.id}`,title,rows,actions:controls,modal:true,width:7.8,onClose:()=>{}};
}
function meetingTrade(id:number):void {
 const values=new Map<number,number>();let shortfall=false;
 const make=():NativePage=>{const input=source(),row=groupRow(id),q=quoteMeetingTrade261(input,encounterRecord(row),[]);if(!q.ok)throw Error(q.reason);return page(`meeting-trade-${id}`,'Commerce de rencontre',[
  r('meeting-trade-help','Stocks réellement portés',undefined,'Achats et ventes utilisent seulement les inventaires originaux de cette rencontre. L’équipement porté et les meubles gardent leurs propriétaires.'),
  ...q.goods.map(g=>numberRow(`meeting-good-${g.id}`,`${g.side==='buy'?'Acheter':'Vendre'} ${ITEM_DEFINITIONS[g.item].label}`,values.get(g.id)??0,n=>{values.set(g.id,n);show(make());},0,g.available,`${g.available} disponibles · ${g.refusal??`${g.unitPrice} argent/unité`}`)),
  ...meetingDraftRows(input,row,quantities(values).map(line=>({...line,quantity:line.quantity*(q.goods.find(g=>g.id===line.pileId)?.side==='buy'?1:-1)}))),
  r('meeting-shortfall','Part sans contrepartie',shortfall?'Acceptée explicitement':'Refusée','Si le marchand manque d’argent, céder ce solde exige votre acceptation.',[b('meeting-shortfall-toggle',shortfall?'Accepter la perte':'Ne pas abandonner le solde',()=>{shortfall=!shortfall;show(make());},{active:shortfall})]),
 ],[b('meeting-quote','Vérifier le panier',()=>{const row=groupRow(id),empty=quoteMeetingTrade261(source(),encounterRecord(row),[]);if(!empty.ok)throw Error(empty.reason);const lines:MeetingTradeLine261[]=quantities(values).map(line=>({...line,quantity:line.quantity*(empty.goods.find(g=>g.id===line.pileId)?.side==='buy'?1:-1)}));if(!lines.length)throw Error('Choisissez au moins un échange.');const quote=quoteMeetingTrade261(source(),encounterRecord(row),lines);if(!quote.ok)throw Error(quote.reason);if(quote.forgone&&!shortfall)throw Error('Le marchand manque d’argent. Acceptez explicitement la part sans contrepartie ou réduisez les ventes.');confirm('meeting-confirm','Confirmer le commerce',[r('meeting-payment','Paiement',`${quote.paid} argent`,`${quote.forgone} argent abandonné explicitement`)],async()=>{const current=quoteMeetingTrade261(source(),encounterRecord(groupRow(id)),lines);if(!current.ok||current.signature!==quote.signature)throw Error('Le panier de rencontre a changé.');await send({type:'caravan-meeting-trade',groupId:id,lines,quote:quote.signature,acceptShortfall:shortfall});},()=>show(encounterPage(groupRow(id))));})],()=>show(encounterPage(groupRow(id))));};show(make());
}

/** Root may give this page priority over any ordinary panel. No UI close resumes it. */
export function buildNativeEncounter(next:NativeUiState,callbacks:NativeUiActions):NativePage|null {
 update(next,callbacks);if(!next.world&&!next.campaign)return null;const rows=campaignUIFacts(source())?.groups??[],pendingRow=rows.find(g=>g.pending261||g.pendingEntry263);return pendingRow?encounterPage(pendingRow):null;
}

function scoutEditor():void {
 const world=local();let pawnId=world.pawns.find(p=>scoutEligible(world,p)===null)?.id,pileId=world.piles.find(p=>p.item==='survival-meal'&&p.owner.type==='ground'&&p.quantity>=2&&!p.foodPoison)?.id,quantity:2|3=2;
 const make=():NativePage=>{const current=local();if(current.scout)throw Error('Une reconnaissance est déjà engagée.');const candidates=current.pawns.filter(p=>scoutEligible(current,p)===null),foods=current.piles.filter(p=>p.item==='survival-meal'&&p.owner.type==='ground'&&p.quantity>=2&&!p.foodPoison);return page('scout-draft','Préparer la reconnaissance',[
  r('scout-help','Voyage individuel',undefined,'Ce circuit reste une sortie abstraite de six heures vers le même foyer. Le chargement et la sortie sont physiques ; aucune récompense n’est créée.'),
  ...candidates.map(p=>r(`scout-person-${p.id}`,p.name,actorNeeds(p),undefined,[b(`scout-person-${p.id}-choose`,pawnId===p.id?'Choisi':'Choisir',()=>{pawnId=p.id;show(make());},{active:pawnId===p.id})])),
  ...foods.map(p=>r(`scout-food-${p.id}`,`Repas de survie · pile ${p.id}`,`${p.quantity} unités`,p.owner.type==='ground'?`Sol ${p.owner.x}, ${p.owner.z}`:undefined,[b(`scout-food-${p.id}-choose`,pileId===p.id?'Choisie':'Choisir',()=>{pileId=p.id;show(make());},{active:pileId===p.id})])),
  r('scout-food-quantity','Provisions',`${quantity} repas`,undefined,([2,3] as const).map(n=>b(`scout-quantity-${n}`,String(n),()=>{quantity=n;show(make());},{active:quantity===n}))),
 ],[b('scout-start','Préparer la reconnaissance',async()=>{const w=local(),p=w.pawns.find(p=>p.id===pawnId),food=w.piles.find(p=>p.id===pileId);if(!p||scoutEligible(w,p)!==null||!food||food.owner.type!=='ground'||food.item!=='survival-meal'||food.quantity<quantity||food.foodPoison)throw Error('La personne ou les rations ne sont plus admissibles.');await send({type:'scout-start',pawnId:p.id,pileId:food.id,quantity});rootPage();},{disabled:pawnId===undefined||pileId===undefined})]);};show(make());
}
function commercialEditor():void {
 const world=local();let pawnId=world.pawns.find(p=>scoutEligible(world,p)===null&&commercialPreparationReason(world,p)===null)?.id,foodId=world.piles.find(p=>p.item==='survival-meal'&&p.owner.type==='ground'&&p.quantity>=2&&!p.foodPoison)?.id,quantity:2|3=2,silver=100;const cargo=new Map<number,number>();
 const make=():NativePage=>{const w=local();if(w.commercialTrip||w.scout)throw Error('Terminez le voyage individuel engagé avant un autre départ.');const reserved=reservedSourcesByPile(w),candidates=w.pawns.filter(p=>scoutEligible(w,p)===null&&commercialPreparationReason(w,p)===null),foods=w.piles.filter(p=>p.item==='survival-meal'&&p.owner.type==='ground'&&p.quantity>=2&&!p.foodPoison),money=w.piles.reduce((n,p)=>n+(p.item==='silver'&&p.owner.type==='ground'?Math.max(0,p.quantity-(reserved.get(p.id)??0)):0),0);return page('commercial-draft','Préparer le voyage commercial',[
  r('commercial-help','Comptoir civil',undefined,'Trois heures à l’aller, trois heures au retour. Rations, argent et textiles sont chargés au contact. Les invendus reviennent avec leur propriétaire.'),
  ...candidates.map(p=>r(`commercial-person-${p.id}`,p.name,actorNeeds(p),undefined,[b(`commercial-person-${p.id}-choose`,pawnId===p.id?'Choisi':'Choisir',()=>{pawnId=p.id;show(make());},{active:pawnId===p.id})])),
  ...foods.map(p=>r(`commercial-food-${p.id}`,`Repas de survie · pile ${p.id}`,`${Math.max(0,p.quantity-(reserved.get(p.id)??0))} disponibles`,undefined,[b(`commercial-food-${p.id}-choose`,foodId===p.id?'Choisie':'Choisir',()=>{foodId=p.id;show(make());},{active:foodId===p.id})])),
  r('commercial-rations','Provisions',`${quantity} repas`,undefined,([2,3] as const).map(n=>b(`commercial-quantity-${n}`,String(n),()=>{quantity=n;show(make());},{active:quantity===n}))),
  numberRow('commercial-silver','Argent à embarquer',silver,n=>{silver=n;show(make());},0,money,`${money} argent au sol disponibles`),
  ...commercialCargoSources(w).map(p=>numberRow(`commercial-cargo-${p.pileId}`,`${ITEM_DEFINITIONS[p.item].label} · pile ${p.pileId}`,cargo.get(p.pileId)??0,n=>{cargo.set(p.pileId,n);show(make());},0,p.available,`${p.quantity} présentes · ${p.reserved} réservées · sol ${p.cell}`)),
  ...commercialDraftRows(w,pawnId,quantity,silver,quantities(cargo)),
 ],[b('commercial-preview','Vérifier le chargement',()=>{const current=local(),p=current.pawns.find(p=>p.id===pawnId),food=current.piles.find(p=>p.id===foodId),lines=quantities(cargo),reserved=reservedSourcesByPile(current);if(!p||scoutEligible(current,p)!==null||commercialPreparationReason(current,p)!==null||!food||food.owner.type!=='ground'||food.item!=='survival-meal'||food.quantity-(reserved.get(food.id)??0)<quantity||food.foodPoison)throw Error('La personne ou les rations ne sont plus disponibles.');if(silver===0&&!lines.length)throw Error('Embarquez de l’argent ou des textiles.');const mass=previewCommercialLoading(current,p,quantity,silver,lines.length?lines:undefined);if(!mass||mass.grams>mass.capacityGrams)throw Error('La charge ou les possessions ne sont pas admissibles.');confirm('commercial-confirm','Confirmer le voyage',[r('commercial-load','Charge prévue',`${kg(mass.grams)} / ${kg(mass.capacityGrams)}`),r('commercial-money','Argent',String(silver)),r('commercial-rations','Repas de survie',String(quantity))],async()=>{const w=local(),pawn=w.pawns.find(q=>q.id===p.id),checked=pawn&&previewCommercialLoading(w,pawn,quantity,silver,lines.length?lines:undefined);if(!pawn||scoutEligible(w,pawn)!==null||commercialPreparationReason(w,pawn)!==null||!checked||checked.grams>checked.capacityGrams)throw Error('La situation du départ a changé.');await send({type:'commercial-start',pawnId:p.id,foodPileId:food.id,quantity,silver,...lines.length?{cargo:lines}:{}});},rootPage);})]);};show(make());
}
async function individualTrade(direction:'buy'|'sell'):Promise<void>{
 await pause();const values=new Map<number,number>(),quote=(lines:CommercialBuyLine[])=>direction==='buy'?quoteCommercial(local(),lines):quoteCommercialSell(local(),lines);
 const make=():NativePage=>{const q=quote([]);if(!q.ok)throw Error(q.reason);return page(`individual-${direction}`,direction==='buy'?'Achats individuels':'Ventes individuelles',[
  r('individual-trade-help','Paniers successifs',undefined,'Les achats et ventes sont arrondis et confirmés séparément. Les stocks et fonds du poste restent finis.'),
   ...q.goods.map(g=>numberRow(`individual-good-${g.pileId}`,ITEM_DEFINITIONS[g.item].label,values.get(g.pileId)??0,n=>{values.set(g.pileId,n);show(make());},0,g.available,`${g.available} disponibles · ${g.unitPrice} argent/unité`)),
   ...individualDraftRows(direction,quantities(values)),
 ],[b('individual-trade-check','Vérifier le panier',()=>{const lines=quantities(values);if(!lines.length)throw Error('Choisissez au moins un bien.');const q=quote(lines);if(!q.ok)throw Error(q.reason);confirm('individual-trade-confirm','Confirmer l’échange',[r('individual-total','Total',`${q.totalSilver} argent`,`${q.remainingSilver} argent portés après l’échange`),r('individual-mass','Charge finale',`${kg(q.mass.grams)} / ${kg(q.mass.capacityGrams)}`)],async()=>{const checked=quote(lines);if(!checked.ok||checked.signature!==q.signature)throw Error('Le panier ou ses propriétaires ont changé.');await send({type:direction==='buy'?'commercial-buy':'commercial-sell',lines,quote:q.signature});},rootPage);})]);};show(make());
}
function individualRows():NativeRow[]{
 const w=state?.world;if(!w)return [r('individual-no-map','Voyages individuels','Affichez une carte locale pour préparer un départ.')];
 const rows:NativeRow[]=[];
 if(w.scout){const trip=w.scout,pawn='pawn'in trip?trip.pawn:w.pawns.find(p=>p.id===trip.pawnId);rows.push(r('individual-scout','Reconnaissance',trip.phase,pawn?actorNeeds(pawn):undefined,trip.phase==='loading'||trip.phase==='leaving'?[b('scout-cancel','Annuler la préparation',()=>send({type:'scout-cancel'}))]:undefined));if('returnAt'in trip)rows.push(r('scout-time','Retour prévu',days((trip.returnAt-w.tick)*10),`${trip.consumed} rations consommées`));if('items'in trip)for(const p of trip.items)rows.push(r(`scout-good-${p.id}`,`${p.quantity} ${ITEM_DEFINITIONS[p.item].label}`,p.owner.type));}
 else {rows.push(r('individual-scout','Reconnaissance',undefined,'Un colon part six heures puis revient au même foyer.',[b('scout-prepare','Préparer la reconnaissance',scoutEditor)]));for(const p of w.pawns.filter(p=>isColonist(p)&&!p.visitor&&!p.prisoner)){const inventory=w.piles.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);if(inventory.length===1&&inventory[0]!.item==='survival-meal'&&inventory[0]!.quantity>=1&&inventory[0]!.quantity<=3)rows.push(r(`scout-unload-${p.id}`,p.name,`${inventory[0]!.quantity} rations restantes`,undefined,[b(`scout-unload-${p.id}-action`,'Décharger les rations',()=>send({type:'scout-unload',pawnId:p.id}))]));}}
 const view=commercialPhaseView(w);rows.push(r('individual-commercial','Voyage commercial',view.status,view.needs));if(view.possessions)rows.push(r('commercial-possessions','Possessions',view.possessions));if(view.mass)rows.push(r('commercial-mass','Charge',`${kg(view.mass.grams)} / ${kg(view.mass.capacityGrams)}`));
 if(!w.commercialTrip&&!w.scout)rows.push(r('commercial-prepare','Commerce individuel',undefined,undefined,[b('commercial-prepare-action','Préparer l’expédition',commercialEditor)]));
 if(view.canCancel)rows.push(r('commercial-cancel','Préparation / dépôt',undefined,undefined,[b('commercial-cancel-action',w.commercialTrip?.phase==='unloading'?'Arrêter le déchargement':'Annuler la préparation',()=>send({type:'commercial-cancel'}))]));
 if(view.atPost)rows.push(r('commercial-shop','Comptoir civil',undefined,undefined,[b('commercial-buy','Acheter',()=>individualTrade('buy')),b('commercial-sell','Vendre',()=>individualTrade('sell')),b('commercial-return','Repartir',()=>send({type:'commercial-return'}))]));
 if(!w.commercialTrip)for(const p of w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor)){const inventory=w.piles.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);if(inventory.length)rows.push(r(`commercial-unload-${p.id}`,`${p.name} · inventaire`,inventory.map(i=>`${i.quantity} ${ITEM_DEFINITIONS[i.item].label}`).join(', '),undefined,[b(`commercial-unload-${p.id}-action`,'Décharger les biens',()=>send({type:'commercial-unload',pawnId:p.id}))]));}
 return rows;
}

/** Confirmed scalar presentation only. Paid information is never a delivered
 * reward; hidden ambush tickets, points and held contents are not displayed. */
export function nativePaidAiSiteFacts298(site:WorldSite263,atCore:number):{title:string;status:string;deadline:string;detail:string;risk:string}|undefined {
 if(site.kind!=='item-stash'||!site.aiCoreInformation298)return;
 const remaining=site.expiresAtCore===null?undefined:Math.max(0,site.expiresAtCore-atCore),closed=site.closed;
 const status=closed?(closed.reason==='expired'?'Expirée':'Site clos'):site.mapId!==null?'Carte locale ouverte':remaining===0?'Délai écoulé':'Cache signalée';
 const deadline=closed?'Dossier conservé':site.mapId!==null?'La carte locale conserve les objets restants':remaining===undefined?'Délai indisponible':`Expire dans ${days(remaining)}`;
 return {title:'Cache de cœur d’IA',status,deadline,detail:closed?'Ce dossier ne garantit plus un objet disponible.': 'L’information a été payée. Il faut encore atteindre le site, récupérer le cœur physique et le rapporter ; le paiement n’a livré aucun objet.',risk:'Non vérifié : des dangers peuvent se révéler sur place.'};
}
function nativeWorldSiteLabel263(site:WorldSite263,atCore:number):string {const paid=nativePaidAiSiteFacts298(site,atCore);return paid?`${paid.title} · ${paid.status} · ${paid.deadline}`:worldSiteLabel263(site,atCore);}
/** View-only focus: resolve the same live Site, show the actual maps tab and
 * selected tile. This emits no travel, formation, entry or reward command. */
export function focusNativePaidAiSite298(siteId:number):void {
 const input=source(),site=input.worldSites263?.entries.find(s=>s.id===siteId);
 if(!site||!nativePaidAiSiteFacts298(site,effectiveCore297(input)))throw Error('La cache de cœur d’IA n’est plus dans ce dossier.');
 if(!input.planet||!planetTile(input.planet,site.tile))throw Error('La case réelle de cette cache est indisponible.');
 tab='maps';selectedTile=site.tile;rootPage();
}
function mapRows():NativeRow[]{
 const input=source(),registry=readMapRegistryState(input),rows:NativeRow[]=[];
 if(registry){rows.push(r('world-map-count','Cartes',`${registry.settlements} colonie(s) · plafond ${registry.maxSettlements}`,`${registry.maps.length} cartes conservées. Afficher une carte ne déplace personne.`));for(const map of registry.maps)rows.push(r(`map-${map.id}`,map.name,`${map.people} personnes · ${map.kind}`,map.campPressure?`Prochain raid du camp dans ${days(map.campPressure.raidAtCore-input.tick*10)} · ${map.campPressure.raidsSent} raids déjà envoyés${map.campPressure.alert?' · alerte active':''}`:undefined,[
  b(`map-${map.id}-view`,map.active?'Carte active':'Afficher',()=>send({type:'map-view',mapId:map.id}),{active:map.active,disabled:!map.view.ok,hint:map.view.reason}),
  b(`map-${map.id}-prepare`,'Préparer une caravane',async()=>{if(!map.active)await send({type:'map-view',mapId:map.id});await send({type:'group-select',groupId:null});openFormation();},{disabled:!map.view.ok,hint:map.view.reason}),
  b(`map-${map.id}-settle`,'S’installer',()=>{const warning=map.settleWarning263?.();confirm(`settle-${map.id}`,'S’installer sur cette carte ?',[r('settle-map',map.name,warning)],async()=>{const current=readMapRegistryState(source())?.maps.find(m=>m.id===map.id);if(!current?.settle.ok||current.settleWarning263?.()!==warning)throw Error('La situation de l’installation a changé.');await send({type:'map-settle',mapId:map.id});});},{disabled:!map.settle.ok,hint:map.settle.reason}),
  b(`map-${map.id}-abandon`,'Abandonner',()=>{const fingerprint=JSON.stringify([map.abandonedPeople,map.groundItems,map.structures]);confirm(`abandon-${map.id}`,'Abandonner cette carte ?',[r('abandon-map',map.name),r('abandon-people','Personnes',map.abandonedPeople.map(p=>p.name).join(', ')||'Aucune'),r('abandon-goods','Biens laissés',`${map.groundItems} objets au sol · ${map.structures} structures`)],async()=>{const current=readMapRegistryState(source())?.maps.find(m=>m.id===map.id);if(!current?.abandon.ok||JSON.stringify([current.abandonedPeople,current.groundItems,current.structures])!==fingerprint)throw Error('Les propriétaires ou conséquences ont changé. Vérifiez à nouveau l’abandon.');await send({type:'map-abandon',mapId:map.id,confirm:true});});},{disabled:!map.abandon.ok,hint:map.abandon.reason}),
 ]));}
 const planet=input.planet;if(!planet){rows.push(r('world-adopt','Géographie historique',undefined,'Adopter le circuit existant conserve les propriétaires actuels.',[b('world-adopt-action','Ouvrir le globe',()=>send({type:'planet-adopt'}))]));return rows;}
 rows.push(numberRow('world-tile','Numéro de case à inspecter',selectedTile??planet.homeTile,n=>{selectedTile=n;rootPage();},0,planetTileCount(planet)-1));
 const tile=selectedTile??planet.homeTile,value=planetTile(planet,tile);if(value)rows.push(r('world-selected-tile',tileLabel(tile),'meanTemperature'in value?`${value.meanTemperature.toFixed(1)} °C`:'',`Voisines : ${value.neighbours.join(', ')}`,[b('world-plan-generic','Estimer un trajet',()=>itinerary()),...campaignUIFacts(input)?.groups.filter(g=>'members'in g.state).map(g=>b(`world-route-group-${g.id}`,`Destination caravane ${g.id}`,()=>routeEditor(g.id,tile)))??[]]));
 for(const settlement of input.worldFactions?.settlements??[])rows.push(r(`world-settlement-${settlement.id}`,settlement.name,tileLabel(settlement.tile),input.worldFactions?.factions.find(f=>f.id===settlement.factionId)?.name,[b(`world-settlement-${settlement.id}-inspect`,'Inspecter la case',()=>{selectedTile=settlement.tile;rootPage();})]));
 for(const site of input.worldSites263?.entries??[])rows.push(r(`world-site-${site.id}`,nativeWorldSiteLabel263(site,effectiveCore297(input)),tileLabel(site.tile),'closed'in site&&site.closed?'Site clos':undefined,[b(`world-site-${site.id}-inspect`,'Inspecter la case',()=>{selectedTile=site.tile;rootPage();})]));
 return rows;
}
function groupRows():NativeRow[]{
 const input=source(),campaign=campaignUIFacts(input),rows:NativeRow[]=[];
 if(state?.world){const s=snapshot(),f=facts(s);if(!s.group)rows.push(r('group-formation','Départ depuis la carte actuelle',f.originLabel,undefined,[b('group-formation-open',f.reform?'Reformer la caravane':'Former une caravane',()=>openFormation(),{disabled:!f.actions.start.ok&&!f.reform,hint:f.actions.start.reason}),...f.canRetreat?[b('group-retreat-open','Fuir par la bordure',()=>openFormation(true))]:[]]));}
 for(const group of campaign?.groups??[])rows.push(r(`world-group-${group.id}`,groupDisplayLabel(group),group.mass?`${kg(group.mass.grams)} / ${kg(group.mass.capacityGrams)}`:undefined,`${group.tile===null?'Sur carte':tileLabel(group.tile)} · destination ${tileLabel(group.state.destination)}`,[b(`world-group-${group.id}-open`,'Dossier et actions',()=>groupDetail(group.id)),b(`world-group-${group.id}-select`,'Sélectionner',()=>send({type:'group-select',groupId:group.id}),{active:campaign?.selectedGroupId===group.id}),...group.pending261||group.pendingEntry263?[b(`world-group-${group.id}-encounter`,'Décision de rencontre',()=>show(encounterPage(groupRow(group.id))))]:[]]));
 if(!campaign?.groups.length)rows.push(r('groups-empty','Aucune caravane engagée.'));
 for(const loss of input.groupLosses??[])rows.push(r(`group-loss-${loss.groupId}-${loss.pawn.id}`,`${loss.pawn.name} · décès hors carte`,tileLabel(loss.tile),`Jour ${1+Math.floor(loss.tick/TICKS_PER_DAY)} · ${loss.items.map(p=>`${p.quantity} ${ITEM_DEFINITIONS[p.item].label}`).join(', ')||'Aucun bien'}`));
 for(const loss of campaign?.animalLosses??[])rows.push(r(`animal-loss-${loss.animal.id}`,travelActorLabel256(loss.animal),`Décès hors carte · ${tileLabel(loss.tile)}`));
 return rows;
}
function factionRows():NativeRow[]{
 const registry=source().worldFactions;if(!registry)return [r('factions-empty','Cette partie ne possède pas de registre de factions.')];
 const rows:NativeRow[]=[];
 for(const faction of registry.factions.filter(f=>!f.hidden)){const relation=registry.relations.find(r=>r.aId===Math.min(faction.id,registry.playerFactionId)&&r.bId===Math.max(faction.id,registry.playerFactionId)),leader=registry.leaders.find(l=>l.factionId===faction.id);rows.push(r(`faction-${faction.id}`,faction.name,faction.id===registry.playerFactionId?'Votre faction':relation?`${relation.kind} · ${relation.goodwill>0?'+':''}${relation.goodwill}`:'Relation inconnue',`${faction.def}${leader?` · dirigeant ${leader.pawn.name}`:''}${faction.lifecycle259?.defeated?' · vaincue':''}`));for(const settlement of registry.settlements.filter(s=>s.factionId===faction.id))rows.push(r(`faction-settlement-${settlement.id}`,settlement.name,tileLabel(settlement.tile),undefined,[b(`faction-settlement-${settlement.id}-view`,'Inspecter la case',()=>{selectedTile=settlement.tile;changeTab('maps');})]));}
 return rows;
}
function update(next:NativeUiState,callbacks:NativeUiActions):void {
 state=next;actions=callbacks;const input=next.world??next.campaign,key=input?String(campaignUIFacts(input)?.campaignSeed??('seed'in input?input.seed:input.campaignSeed)):'none';
 if(campaignIdentity!==key||input&&input.tick<lastTick){campaignIdentity=key;scope=`${key}:${++scopeRevision}`;formation=undefined;selectedTile=undefined;}lastTick=input?.tick??-1;
}
export function syncNativeWorldState(next:NativeUiState,callbacks:NativeUiActions):void {update(next,callbacks);}
/** Main has already checked the authoritative settlement-arrival notice.
 * Resolve its actual group again; opening the dossier never selects a basket
 * or sends an order, and a group that has since left keeps the current page. */
export function focusNativeCaravanTrade(next:NativeUiState,callbacks:NativeUiActions,groupId:number):boolean {
 update(next,callbacks);const input=next.world??next.campaign;if(!input)return false;
 const row=campaignUIFacts(input)?.groups.find(group=>group.id===groupId);
 if(!row||!('members'in row.state)||row.state.phase!=='at-site')return false;
 const current=snapshot(groupId);if(!facts(current).trade)return false;
 tab='groups';groupDetail(groupId);return true;
}
/** Globe selection and tile-list selection share the same native draft value. */
export function nativeWorldChooseTile(tile:number):void {const planet=source().planet;if(!planet||!planetTile(planet,tile))throw Error('Cette case géographique n’existe pas.');selectedTile=tile;rootPage();}
export function buildNativeWorld(next:NativeUiState,callbacks:NativeUiActions):NativePage {
 update(next,callbacks);if(!next.world&&!next.campaign)return {id:'world',title:'Monde',rows:[r('world-no-game','Aucune partie active.')],onClose:()=>void callbacks.panel(null)};
 const controls:NativeControl[]=(['maps','groups','individual','factions'] as const).map(id=>b(`world-tab-${id}`,{maps:'Cartes et globe',groups:'Caravanes',individual:'Voyages individuels',factions:'Factions'}[id],()=>changeTab(id),{active:tab===id}));
 const rows:NativeRow[]=[r('world-tabs','Monde',undefined,undefined,controls)];
 const preparation=state?.campProgress;if(preparation)rows.push(r('camp-preparation','Préparation de la carte locale',preparation.progress.phase,undefined,[b('camp-preparation-cancel','Annuler la préparation',()=>{if(!actions?.cancelCampEntry)throw Error('L’annulation de cette préparation est indisponible.');return actions.cancelCampEntry(preparation.id,preparation.groupId);},{disabled:!actions?.cancelCampEntry})]));
 rows.push(...(tab==='maps'?mapRows():tab==='groups'?groupRows():tab==='individual'?individualRows():factionRows()));
 const input=source(),planet=input.planet,geography=tab==='maps'&&planet?.revision===3?planetGeography256(planet):undefined;
 let visual:NativePage['visual'];
 if(geography&&planet){
  const campaign=campaignUIFacts(input),factions=input.worldFactions;
  const markers:NonNullable<NativePage['visual']>['markers']=[
   ...(campaign?.maps??[]).flatMap(map=>map.tile===null?[]:[{tile:map.tile,label:mapDisplayName(map),color:map.selected?0xe5cc94:0x71958b}]),
   ...(campaign?.groups??[]).flatMap(group=>group.tile===null?[]:[{tile:group.tile,label:groupDisplayLabel(group),color:campaign?.selectedGroupId===group.id?0xe5bc72:0xa66f5d}]),
   ...(factions?.settlements??[]).filter(settlement=>factions?.factions.some(faction=>faction.id===settlement.factionId&&!faction.hidden)).map(settlement=>({tile:settlement.tile,label:settlement.name,color:0x8d7e9c})),
   ...(input.worldSites263?.entries??[]).filter(site=>!('closed'in site)||!site.closed).map(site=>({tile:site.tile,label:nativeWorldSiteLabel263(site,effectiveCore297(input)),color:0xbb8792})),
  ];
  visual={kind:'planet',surface:geography.surface,roads:geography.roads,selected:selectedTile??planet.homeTile,markers,onSelect:nativeWorldChooseTile};
 }
 return {id:'world',title:'Monde',subtitle:'Les mêmes personnes et biens conservent leurs propriétaires pendant chaque voyage.',rows,width:1120,height:740,visual,onClose:()=>void callbacks.panel(null)};
}
type NativeFactionRegistry=NonNullable<CampaignUIState['worldFactions']>;
type NativeFaction=NativeFactionRegistry['factions'][number];
type NativeFactionSort='name'|'relation'|'settlements';
const factionBrowser={identity:'',search:'',sort:'name' as NativeFactionSort};
const factionTypeLabel=(def:NativeFaction['def']):string=>({PlayerColony:'Colonie',PlayerTribe:'Tribu du joueur',OutlanderCivil:'Union civile',OutlanderRough:'Union hostile',TribeCivil:'Tribu paisible',TribeRough:'Tribu hostile',TribeSavage:'Tribu farouche',Pirate:'Pirates',Mechanoid:'Mécanoïdes',Insect:'Insectes',Ancients:'Anciens',AncientsHostile:'Anciens hostiles'} as const)[def];
const factionSearchText=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
function factionBrowserIdentity(next:NativeUiState):string {
 const input=next.world??next.campaign;if(!input)return 'none';const campaign=campaignUIFacts(input);
 return ['factions',next.epoch,campaign?.campaignSeed??('seed'in input?input.seed:input.campaignSeed),campaign?.activeMapId??('seed'in input?input.seed:'none')].join(':');
}
/** These controls navigate borrowed current registry facts, never cached owners. */
function factionBrowserGuard<T extends unknown[]>(next:NativeUiState,callbacks:NativeUiActions,run:(fresh:NativeUiState,...args:T)=>void|Promise<unknown>):(...args:T)=>void|Promise<unknown> {
 const identity=factionBrowserIdentity(next);
 return (...args)=>{const fresh=callbacks.readState?.()??state;if(!fresh||fresh.busy||factionBrowserIdentity(fresh)!==identity)return;update(fresh,callbacks);return run(fresh,...args);};
}
function factionRelationFact(registry:NativeFactionRegistry,faction:NativeFaction):{label:string;goodwill:number|undefined} {
 if(faction.id===registry.playerFactionId)return{label:'Votre faction',goodwill:undefined};
 const relation=registry.relations.find(value=>value.aId===Math.min(faction.id,registry.playerFactionId)&&value.bId===Math.max(faction.id,registry.playerFactionId));
 return relation?{label:({hostile:'Hostile',neutral:'Neutre',ally:'Alliée'} as const)[relation.kind]+' · '+(relation.goodwill>0?'+':'')+relation.goodwill,goodwill:relation.goodwill}:{label:'Relation inconnue',goodwill:undefined};
}
function factionDossier(next:NativeUiState,callbacks:NativeUiActions,id:number):void {
 const registry=(next.world??next.campaign)?.worldFactions,faction=registry?.factions.find(value=>value.id===id&&!value.hidden);if(!registry||!faction)return;
 const relation=factionRelationFact(registry,faction),leader=registry.leaders.find(value=>value.factionId===id),settlements=registry.settlements.filter(value=>value.factionId===id);
 const back=factionBrowserGuard(next,callbacks,fresh=>show(buildNativeFactions(fresh,callbacks)));
 const rows:NativeRow[]=[
  {...r('faction-detail-type','Type',factionTypeLabel(faction.def),faction.def),presentation:'plain',compact:true},
  {...r('faction-detail-relation','Relations',relation.label),presentation:'plain',compact:true},
  {...r('faction-detail-leader','Dirigeant',leader?.pawn.name??'Non enregistré'),presentation:'plain',compact:true},
  {...r('faction-detail-status','État',faction.lifecycle259?.defeated?'Vaincue':faction.lifecycle259?.temporary?'Temporaire':faction.lifecycle259?'Persistante':'Non enregistré'),presentation:'plain',compact:true},
  {id:'faction-detail-settlements',label:'Établissements · '+settlements.length,emphasis:'heading',presentation:'plain',compact:true},
 ];
 for(const settlement of settlements){
  const access=worldSettlementAccess256(registry,settlement.id),target={id:settlement.id,factionId:settlement.factionId,tile:settlement.tile};
  rows.push({...r('faction-settlement-'+target.id,settlement.name,tileLabel(target.tile),access.ok?(access.canTrade?'Commerce admissible à destination.':'Commerce indisponible à destination.'):access.reason,[b('faction-settlement-'+target.id+'-view','Inspecter la case',factionBrowserGuard(next,callbacks,fresh=>{
   const current=(fresh.world??fresh.campaign)?.worldFactions,owner=current?.factions.find(value=>value.id===id&&!value.hidden),actual=current?.settlements.find(value=>value.id===target.id);
   if(!owner||!actual||actual.factionId!==target.factionId||actual.tile!==target.tile)return;
   selectedTile=actual.tile;changeTab('maps');
  }))]),presentation:'plain',compact:true});
 }
 if(!settlements.length)rows.push({id:'faction-detail-no-settlements',label:'Aucun établissement enregistré.',presentation:'plain',compact:true});
 show({id:'faction-detail-'+id,title:faction.name,layout:'dialog',modal:true,width:820,rows,actions:[b('faction-detail-back','Retour aux factions',back)],onClose:back});
}
export function buildNativeFactions(next:NativeUiState,callbacks:NativeUiActions):NativePage {
 update(next,callbacks);const identity=factionBrowserIdentity(next);if(factionBrowser.identity!==identity){factionBrowser.identity=identity;factionBrowser.search='';factionBrowser.sort='name';}
 const input=next.world??next.campaign,registry=input?.worldFactions;
 const close=factionBrowserGuard(next,callbacks,()=>callbacks.panel(null));
 if(!input)return{id:'factions',title:'Factions',rows:[r('factions-no-game','Aucune partie active.')],onClose:close};
 if(!registry)return{id:'factions',title:'Factions',rows:[r('factions-empty','Cette partie ne possède pas de registre de factions.')],onClose:close};
 const refresh=factionBrowserGuard(next,callbacks,fresh=>show(buildNativeFactions(fresh,callbacks)));
 const all=registry.factions.filter(faction=>!faction.hidden).map(faction=>{
  const relation=factionRelationFact(registry,faction),leader=registry.leaders.find(value=>value.factionId===faction.id)?.pawn.name,settlements=registry.settlements.filter(value=>value.factionId===faction.id);
  return{faction,relation,leader,settlements};
 });
 const needle=factionSearchText(factionBrowser.search.trim()),visible=all.filter(value=>!needle||factionSearchText([value.faction.name,value.faction.def,factionTypeLabel(value.faction.def),value.relation.label,value.leader??'',...value.settlements.map(settlement=>settlement.name)].join(' ')).includes(needle));
 visible.sort((a,b)=>{
  const compare=factionBrowser.sort==='settlements'?b.settlements.length-a.settlements.length:factionBrowser.sort==='relation'?(b.relation.goodwill??-Infinity)-(a.relation.goodwill??-Infinity):0;
  return (Number.isNaN(compare)?0:compare)||a.faction.name.localeCompare(b.faction.name,'fr',{numeric:true})||a.faction.id-b.faction.id;
 });
 const rows:NativeRow[]=[
  {id:'factions-search',label:'Rechercher',region:'navigation',presentation:'plain',compact:true,input:{value:factionBrowser.search,placeholder:'Faction, dirigeant ou établissement…',maxLength:160,onCommit:factionBrowserGuard(next,callbacks,(_fresh,value:string)=>{factionBrowser.search=value;refresh();})}},
  {id:'factions-sort',label:'Trier',region:'navigation',presentation:'plain',compact:true,controls:([['name','Nom'],['relation','Relations'],['settlements','Établissements']] as const).map(([sort,label])=>b('factions-sort-'+sort,label,factionBrowserGuard(next,callbacks,()=>{factionBrowser.sort=sort;refresh();}),{active:factionBrowser.sort===sort}))},
  {id:'factions-count',label:'Factions',value:visible.length+' / '+all.length,region:'navigation',presentation:'plain',compact:true},
  {id:'factions-heading',label:'Faction',columns:[{label:'Type'},{label:'Relations'},{label:'Dirigeant'},{label:'Établissements'},{label:'État'},{label:'Dossier'}],compact:true},
 ];
 for(const value of visible){
  const faction=value.faction,open=factionBrowserGuard(next,callbacks,fresh=>factionDossier(fresh,callbacks,faction.id));
  const facts=[factionTypeLabel(faction.def),value.relation.label,value.leader??'Non enregistré',String(value.settlements.length),faction.lifecycle259?.defeated?'Vaincue':faction.lifecycle259?.temporary?'Temporaire':faction.lifecycle259?'Persistante':'Non enregistré','Ouvrir'];
  rows.push({id:'faction-'+faction.id,label:faction.name,compact:true,controls:facts.map((label,index)=>b('faction-'+faction.id+'-field-'+index,label,open,{hint:index===0?faction.def:'Ouvrir le dossier de '+faction.name}))});
 }
 if(!visible.length)rows.push({id:'factions-search-empty',label:'Aucune faction ne correspond à la recherche.',presentation:'plain',compact:true});
 return{id:'factions',title:'Factions',contentKey:JSON.stringify([identity,factionBrowser.search,factionBrowser.sort]),layout:'table',tableProfile:'factions',width:1280,rows,actions:[b('factions-back','Retour',close)],onClose:close};
}
