import type {NativeControl,NativePage,NativeRow,NativeUiActions,NativeUiState} from './native-contract';
import {TICKS_PER_DAY,type Command,type WorkType,type World} from '../sim/types';
import type {ArrivalOffer} from '../sim/arrival-state';
import {adulthoodDefinition,childhoodDefinition,BACKGROUND_SKILL_IDS,BACKGROUND_WORK_LABELS,backgroundSkillRefusal,backgroundWorkRefusal,violentWorkRefusal,type BackgroundSkillId} from '../sim/colonist-backgrounds';
import {previewBackgroundSkills} from '../sim/background-generation';
import {startingSkills} from '../sim/skills';
import {TRAITS} from '../sim/traits';
import {biologicalYears,chronologicalYears} from '../sim/human-age';
import {captureRelationshipPeople} from '../sim/relationship-namespace';

type StateReader=()=>NativeUiState;
const inFlight=new WeakSet<StateReader>();
const skillLabels:Readonly<Record<BackgroundSkillId,string>>={shooting:'Tir',melee:'Mêlée',construction:'Construction',mining:'Minage',cooking:'Cuisine',plants:'Plantes',animals:'Animaux',crafting:'Artisanat',artistic:'Artistique',medicine:'Médecine',social:'Social',intellectual:'Intellectuel'};
const tagLabels={ 'manual-dumb':'Travail manuel simple','manual-skilled':'Travail manuel qualifié',caring:'Soins aux autres',social:'Travail social',intellectual:'Recherche','plant-work':'Travail des plantes',artistic:'Art',animals:'Dressage',hunting:'Chasse',violent:'Violence',firefighting:'Lutte contre les incendies',
  commoner:'Travail ordinaire',crafting:'Artisanat',cooking:'Cuisine',cleaning:'Nettoyage',hauling:'Transport',mining:'Minage',constructing:'Construction',shooting:'Tir','all-work':'Tout travail' } as const;
const relationshipLabels={parent:'Parent',child:'Enfant',sibling:'Fratrie'} as const;
const statusLabels={present:'Présent',away:'En voyage',departed:'Absent',dead:'Décédé'} as const;
const row=(id:string,label:string,value?:string,detail?:string,controls?:NativeControl[]):NativeRow=>({id,label,value,detail,controls});
const control=(id:string,label:string,onActivate:NativeControl['onActivate'],disabled=false,hint?:string):NativeControl=>({id,label,onActivate,disabled,hint});
const message=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
const mapId=(world:World)=>world.campaignMap?.revision===2?world.campaignMap.activeMapId:world.worldMaps?.selectedMapId??0;
function anchor(state:NativeUiState):string {const w=state.world;return JSON.stringify([state.epoch??null,w?.seed,w?.width,w?.height,w?mapId(w):null]);}
const offerSignature=(offer:ArrivalOffer)=>JSON.stringify(offer);
function blocked(state:NativeUiState,actions:NativeUiActions):string|undefined {
 if(!actions.readState)return 'La lecture de l’état actuel est indisponible.';
 if(!state.world)return 'Affichez la carte locale concernée pour répondre.';
 if(state.fault)return state.fault;
 if(state.busy||inFlight.has(actions.readState))return 'Attendez la fin de l’opération en cours.';
}

/** The original letter's recorded offer only. This never constructs a Pawn,
 * grants a relationship, predicts medical health or edits simulation owners. */
function offerRows(world:World,offer:ArrivalOffer):NativeRow[]{
 const skills=offer.background?previewBackgroundSkills(offer.profile,offer.background):startingSkills(offer.profile);
 const rows:NativeRow[]=[
  row('arrival-offer',`${offer.name} souhaite rejoindre la colonie`,undefined,'Ce voyageur cherche un nouveau foyer. Prévoyez sa nourriture, son couchage et son travail.'),
  row('arrival-refusal-effect','Conséquence d’un refus','Les colons seront attristés pendant six jours.','Différer ne constitue pas un refus ; sans réponse, la demande expire.'),
  row('arrival-time','Temps restant',`${Math.max(0,Math.ceil((offer.expiresAt-world.tick)*24/TICKS_PER_DAY))} h`,world.tick>=offer.expiresAt?'Cette demande a expiré. Une réponse ne sera plus admise.':'La demande reste ouverte pendant que la simulation avance.'),
 ];
 if(offer.age)rows.push(row('arrival-age','Âge biologique / chronologique',`${biologicalYears(offer.age)} / ${chronologicalYears(offer.age)} ans`));
 for(const id of offer.traits??[])rows.push(row(`arrival-trait-${id}`,TRAITS[id].label,undefined,TRAITS[id].description));
 if(!offer.traits?.length)rows.push(row('arrival-traits-empty','Traits','Aucun trait attribué'));
 if(offer.background){
  const stories=[{phase:'Enfance',definition:childhoodDefinition(offer.background.childhood)},...offer.background.adulthood?[{phase:'Adulte',definition:adulthoodDefinition(offer.background.adulthood)}]:[]];
  for(const [index,{phase,definition}]of stories.entries()){
   const gains=BACKGROUND_SKILL_IDS.filter(skill=>definition.gains[skill]!==undefined).map(skill=>`${skillLabels[skill]} +${definition.gains[skill]}`).join(' · ');
   rows.push(row(`arrival-background-${index}`,`${phase} · ${definition.label}`,undefined,definition.description),row(`arrival-background-effects-${index}`,'Effets du passé',`Gains prévus : ${gains||'Aucun'}`,`Interdictions : ${definition.disables.map(tag=>tagLabels[tag]).join(' · ')||'Aucune'}. Ces gains sont déjà inclus dans les compétences prévues ; ils ne seront pas appliqués une seconde fois.`));
  }
 }else rows.push(row('arrival-background-unknown','Passé','Non renseigné'));
 for(const skill of BACKGROUND_SKILL_IDS){const record=skills[skill],reason=backgroundSkillRefusal(offer,skill);rows.push(row(`arrival-skill-${skill}`,skillLabels[skill],reason?`Indisponible · niveau prévu ${record?.level??0}`:`Niveau prévu ${record?.level??0}`,reason));}
 for(const work of Object.keys(BACKGROUND_WORK_LABELS) as WorkType[]){const reason=backgroundWorkRefusal(offer,work);if(reason)rows.push(row(`arrival-incapable-${work}`,`Incapable : ${BACKGROUND_WORK_LABELS[work]}`,undefined,reason));}
 const violent=violentWorkRefusal(offer);if(violent)rows.push(row('arrival-incapable-combat','Incapable : Combat',undefined,violent));
 if(offer.relationship){
  const relationship=offer.relationship,person=captureRelationshipPeople(world).get(relationship.otherId),name=person?.name??'Personne non renseignée';
  const direction=relationship.kind==='parent'?`${name} est le parent de ${offer.name}.`:relationship.kind==='child'?`${name} est l’enfant de ${offer.name}.`:`${offer.name} et ${name} appartiennent à la même fratrie.`;
  rows.push(row('arrival-relationship','Lien annoncé',`${relationshipLabels[relationship.kind]} · ${name}${person?` · ${statusLabels[person.status]}`:''}`,`${direction} Le lien sera enregistré après l’entrée réelle de la personne accueillie. Le statut indique la situation actuelle du proche.`));
 }
 return rows;
}

/** Independent native page; not imported into the active panels yet. A current
 * readState hook is mandatory for writes. The server retains all admission,
 * physical entry, capacity, faction, relationship and clothing validation.
 * Successful/failed requests update this page object in place: a delayed result
 * cannot reopen it over a newer page that the player has selected meanwhile. */
export function buildNativeArrivals(initial:NativeUiState,actions:NativeUiActions):NativePage {
 const origin=anchor(initial),initialTick=initial.world?.tick??0;
 let status='',closed=false,resolvedOffer:string|undefined,enabledHere=false;
 const model:NativePage={id:'native-arrivals',title:'Demandes d’accueil',modal:true,width:7.8,rows:[]};
 const current=()=>actions.readState?.()??initial;
 const close=()=>{if(actions.readState&&inFlight.has(actions.readState))return;closed=true;if(actions.closePage)actions.closePage();else void actions.panel(null);};
 model.onClose=close;
 function context():NativeUiState {
  const state=current();
  if(anchor(state)!==origin||state.world&&state.world.tick<initialTick)throw Error('La partie ou la carte a changé. Rouvrez la demande depuis la carte concernée.');
  return state;
 }
 function repaint():void {
  let state:NativeUiState;
  try{state=context();}catch(cause){model.rows=[row('arrival-stale','Demande à rouvrir',message(cause))];model.actions=[control('arrival-close','Fermer',close)];return;}
  const world=state.world,reason=blocked(state,actions),pending=world?.arrivals?.pending;
  const rows:NativeRow[]=[];if(status)rows.push(row('arrival-feedback','Réponse de la demande',status));
  if(reason)rows.push(row('arrival-blocked','Action indisponible',reason));
  const controls:NativeControl[]=[];
  if(!world)rows.push(row('arrival-no-map','Carte locale requise',undefined,'Le globe seul ne possède pas cette demande d’accueil. Affichez la carte concernée.'));
  else if(pending){
   rows.push(...offerRows(world,pending));const signature=offerSignature(pending),expired=world.tick>=pending.expiresAt,answered=resolvedOffer===signature,hint=expired?'Cette demande a expiré.':answered?'Votre décision a déjà été transmise. Attendez l’état confirmé.':reason;
   controls.push(control('arrival-accept','Accueillir',()=>submit({type:'answer-arrival',offerId:pending.id,accept:true},signature),!!reason||expired||answered,hint),control('arrival-decline','Refuser',()=>submit({type:'answer-arrival',offerId:pending.id,accept:false},signature),!!reason||expired||answered,hint));
  }else if(world.arrivals)rows.push(row('arrival-empty','Aucune demande d’accueil en attente.','Le calendrier existant est actif.'),row('arrival-history','Décisions enregistrées',`${world.arrivals.accepted} accueils · ${world.arrivals.declined} refus · ${world.arrivals.expired} expirations`));
  else if(world.gameProfile)rows.push(row('arrival-storyteller','Calendrier historique indisponible','Le calendrier d’accueil historique n’est pas disponible avec ce narrateur.'));
  else {
   rows.push(row('arrival-enable-info','Événements d’une ancienne colonie',undefined,'Activer les demandes d’accueil ajoute des événements futurs. Aucun voyageur ni événement passé n’est créé par cette activation.'));
   controls.push(control('arrival-enable','Activer les demandes d’accueil',()=>submit({type:'enable-arrivals'}),!!reason||enabledHere,enabledHere?'Activation déjà transmise. Attendez l’état confirmé.':reason));
  }
  controls.push(control('arrival-refresh','Actualiser',()=>{repaint();actions.refresh();},!!actions.readState&&inFlight.has(actions.readState)),control('arrival-postpone',pending?'Décider plus tard':'Fermer',close,!!actions.readState&&inFlight.has(actions.readState)));
  model.rows=rows;model.actions=controls;
 }
 async function submit(command:Extract<Command,{type:'answer-arrival'|'enable-arrivals'}>,signature?:string):Promise<void> {
  if(closed)throw Error('Cette page a été fermée. Rouvrez les demandes d’accueil.');
  const state=context(),reason=blocked(state,actions);if(reason)throw Error(reason);
  const world=state.world!,reader=actions.readState!;
  if(command.type==='answer-arrival'){
   const offer=world.arrivals?.pending;
   if(!offer||offer.id!==command.offerId||offerSignature(offer)!==signature||world.tick>=offer.expiresAt||resolvedOffer===signature)throw Error('Cette demande n’est plus disponible ou son contenu a changé. Actualisez-la avant de répondre.');
  }else if(world.gameProfile||world.arrivals||enabledHere)throw Error(world.gameProfile?'Le calendrier d’accueil historique n’est pas disponible avec ce narrateur.':'Le calendrier d’accueil est déjà actif.');
  inFlight.add(reader);status='Envoi de votre décision…';repaint();actions.refresh();
  try{
   const result=await actions.command(command);
   if(result&&typeof result==='object'&&'ok'in result&&result.ok===false)throw Error('reason'in result&&typeof result.reason==='string'?result.reason:'La commande d’accueil a été refusée.');
   if(command.type==='enable-arrivals')enabledHere=true;else resolvedOffer=signature;
   status=command.type==='enable-arrivals'?'Le calendrier d’accueil futur est activé.':command.accept?'Votre accueil a été accepté par la simulation.':'Votre refus a été enregistré par la simulation.';
  }catch(cause){status=message(cause);throw cause;}
  finally{inFlight.delete(reader);repaint();actions.refresh();}
 }
 repaint();return model;
}

/** Reusable entry rows for Quêtes, menu, or alerts. Opening is a genuine native
 * action and never consumes, accepts, refuses or postpones a simulation offer. */
export function nativeArrivalRows(state:NativeUiState,actions:NativeUiActions):NativeRow[]{
 const world=state.world;if(!world)return [];
 const offer=world.arrivals?.pending;
 if(!offer&&(world.arrivals||world.gameProfile))return [];
 const origin=anchor(state),tick=world.tick;
 const open=()=>{const fresh=actions.readState?.()??state;if(anchor(fresh)!==origin||fresh.world&&fresh.world.tick<tick)throw Error('La partie ou la carte a changé. Actualisez cette entrée.');actions.showPage(buildNativeArrivals(fresh,actions));};
 return [row('native-arrival-entry',offer?`${offer.name} · demande d’accueil`:'Demandes d’accueil historiques',offer?`${Math.max(0,Math.ceil((offer.expiresAt-world.tick)*24/TICKS_PER_DAY))} h restantes`:undefined,offer?'Un refus attristera les colons pendant six jours. Vous pouvez décider plus tard.':'Activer seulement les événements futurs de cette ancienne colonie.',[control('native-arrival-open',offer?'Lire la demande':'Configurer les accueils',open)])];
}
