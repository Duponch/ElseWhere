import {mechRaidGroups261} from '../sim/mechanical-raid-groups-261';
import {raidGroups261} from '../sim/temp-map-raids-261';
import type { Command,World } from '../sim/types';
import { mechanoidDefinition,type MechanoidKind } from '../sim/mechanoid-definition';
import { actorNotificationTarget,personNotificationTarget,pileNotificationTarget,NotificationFocusCycle,type NotificationTarget,type FocusNotification } from './notification-focus';
import { createNotificationLetterDetails } from './notification-letter';

const mechanicalSummary=(kinds:readonly MechanoidKind[]):string=>{
  const counts=new Map<MechanoidKind,number>();for(const kind of kinds)counts.set(kind,(counts.get(kind)??0)+1);
  return [...counts].map(([kind,count])=>`${mechanoidDefinition(kind).label} ×${count}`).join(' · ')||'0 machine';
};

export interface ObservedRaidMembers {id:number;mechanical:boolean;members:readonly number[];}
/** Only this raid's present physical owners. A downed raider remains locatable.
 * Mechanical bodies retain their original ID but no persisted raid group;
 * observed membership is UI metadata and cannot fabricate history after load. */
export function raidNotificationTargets(world:World,observed?:ObservedRaidMembers):NotificationTarget[] {
  const mechanicalGroups=mechRaidGroups261(world),humanGroups=raidGroups261(world),mechanical=mechanicalGroups[0],active=humanGroups[0],last=world.raids?.last;
  const group=mechanical??active??last;if(!group)return [];
  const isMechanical=!!mechanical||!active&&!!last?.mechanoid;
  const ids=new Set<number>(mechanical?mechanicalGroups.flatMap(g=>g.members):active?humanGroups.flatMap(g=>g.members):(observed?.id===group.id&&observed.mechanical===isMechanical?observed.members:[]));
  if(isMechanical){
    for(const m of world.mechanoids??[])if(mechanicalGroups.some(g=>g.id===m.raid?.group)||!mechanical&&m.raid?.group===group.id)ids.add(m.id);
    return [...ids].sort((a,b)=>a-b).flatMap(id=>{
      const actor=world.mechanoids?.find(m=>m.id===id);if(actor)return [actorNotificationTarget(id)];
      const body=world.piles.find(p=>p.id===id&&p.mechCorpse),target=body?pileNotificationTarget(world,body,`actor:${id}`):undefined;
      return target?[target]:[];
    });
  }
  for(const p of world.pawns)if(humanGroups.some(g=>g.id===p.raid?.group)||!active&&p.raid?.group===group.id)ids.add(p.id);
  return [...ids].sort((a,b)=>a-b).map(id=>personNotificationTarget(world,id)).filter((target):target is NotificationTarget=>!!target);
}

export function createRaidUI(send:(c:Command)=>Promise<unknown>,focus:FocusNotification):{update:(w:World)=>void;reset:()=>void} {
  const letter=document.createElement('button');letter.id='raid-letter';letter.className='arrival-letter';
  const dialog=document.createElement('dialog');dialog.id='raid-dialog';dialog.className='help-dialog';
  const title=document.createElement('h2'),body=document.createElement('p'),locate=document.createElement('button'),close=document.createElement('button');
  locate.id='locate-raid';locate.textContent='Voir les assaillants';close.textContent='Fermer';close.onclick=()=>dialog.close();
  dialog.append(title,body,locate,close);document.body.append(dialog);
  const details=createNotificationLetterDetails(letter,dialog);
  let world:World|undefined,busy=false,mechBusy=false,mechError='',observed:ObservedRaidMembers|undefined;
  const cycle=new NotificationFocusCycle();
  const locateNext=()=>{if(!world)return false;const group=mechRaidGroups261(world)[0]??raidGroups261(world)[0]??world.raids?.last;
    const target=cycle.next(`raid:${group?.id}`,raidNotificationTargets(world,observed));if(target)focus(target);return !!target;};
  letter.onclick=()=>{if(!locateNext()&&!dialog.open)dialog.showModal();};locate.onclick=()=>{locateNext();dialog.close();};
  const enable=document.getElementById('enable-raids') as HTMLButtonElement;
  enable.title='Calendrier provisoire : première attaque dans 3,5 à 4 jours, puis 6 à 8 jours après chaque issue.';
  enable.onclick=()=>{if(busy)return;busy=true;enable.disabled=true;void send({type:'enable-raids'}).catch(e=>enable.title=String(e)).finally(()=>{busy=false;enable.disabled=false;});};
  const enableMech=document.getElementById('enable-mech-raids') as HTMLButtonElement|null;
  const updateAdoption=()=>{
    if(!enableMech||!world)return;
    const policy=world.raids?.mechanoid,missingRanged=world.schemaVersion>=197&&!policy?.ranged;
    enableMech.hidden=!!policy&&!missingRanged;
    enableMech.disabled=mechBusy||world.schemaVersion<194||world.raids?.profile!=='cassandra-raids-v1';
    enableMech.textContent=policy&&missingRanged?'Admettre les raids mécaniques à distance futurs':'Admettre les raids mécaniques futurs';
    const explanation=world.raids?.profile==='cassandra-raids-v1'
      ?policy&&missingRanged?'Autoriser les modèles à distance lors des prochaines occasions mécaniques. Aucun raid n’est créé maintenant ; les groupes déjà présents restent inchangés.'
        :'Autoriser prospectivement la concurrence mécanique aux occasions Cassandra, à partir du jour 45 et avec une menace suffisante. Aucun raid n’est créé par ce bouton.'
      :'Une colonie avec le calendrier Cassandra est nécessaire.';
    enableMech.title=mechError?`${mechError}\n${explanation}`:explanation;
  };
  if(enableMech)enableMech.onclick=()=>{if(mechBusy||enableMech.disabled)return;mechBusy=true;mechError='';updateAdoption();void send({type:'enable-mech-raids'}).catch(e=>{mechError=String(e);}).finally(()=>{mechBusy=false;updateAdoption();});};
  return {reset(){cycle.reset();observed=undefined;},update(w){world=w;enable.hidden=!!w.raids;enable.disabled=busy;
    updateAdoption();
    const humanGroups=raidGroups261(w),mechanicalGroups=mechRaidGroups261(w),raid=humanGroups[0],mech=mechanicalGroups[0],last=w.raids?.last;
    if(mech)observed={id:mech.id,mechanical:true,members:[...mech.members]};else if(raid)observed={id:raid.id,mechanical:false,members:[...raid.members]};
    if(!raid&&!mech&&!last){details.remove();if(dialog.open)dialog.close();return;}
    const remaining=raid?w.pawns.filter(p=>humanGroups.some(g=>g.members.includes(p.id))&&p.state!=='dead'&&p.state!=='downed').length:0;
    const mechanicalRemaining=mech?w.mechanoids?.filter(m=>mechanicalGroups.some(g=>g.members.includes(m.id))&&m.state!=='dead'&&m.state!=='downed')??[]:[];
    title.textContent=mech?`Raid mécanique : ${mechanicalSummary(mechanicalRemaining.map(m=>m.mechKind))}${mechanicalGroups.length>1?' · '+mechanicalGroups.length+' groupes':''} · ${mechanicalGroups.some(g=>g.phase==='assault')?'assaut':'regroupement'}`:raid?raid.phase==='assault'?`Raid : ${remaining} assaillant(s)${raid.stage330?' · regroupement':''}`:'Retraite des assaillants':last?.mechanoid?'Assaut mécanique terminé':'Assaut terminé';
    letter.textContent=title.textContent;locate.hidden=!raidNotificationTargets(w,observed).length;
    body.textContent=mech?mech.phase==='staging'?'Les machines hostiles se regroupent avant leur assaut. Leur défense est déjà active. Préparez vos positions et votre circuit de défense.':'Les machines hostiles attaquent la colonie. Leur anatomie et les phases de leurs gestes sont inspectables ; aucun soin, recrutement ou ordre colonial ne leur est accordé.':raid?raid.stage330?'Les assaillants se regroupent près du bord de la carte avant leur assaut. Ils se défendent déjà autour de leur point de regroupement. Préparez vos positions ; l’assaut viendra après un délai ou s’ils perdent près d’un tiers des leurs.':raid.phase==='assault'?'Des ennemis arrivent par le bord et attaquent la colonie. Mobilisez les défenseurs, placez-les et préparez les secours. Les assaillants peuvent frapper les murs ou portes qui leur barrent l’accès.':'Les assaillants cherchent une sortie physique. Surveillez les blessés ; les survivants encore sur la carte restent hostiles.':last?.mechanoid?`Bilan confirmé : ${mechanicalSummary(last.mechComposition?.roster??[])} neutralisé(s). Une carcasse entière devient disponible après la fin de son déplacement et de sa récupération. Transportez-la pour une facture de concassage ou de broyage ; l’acier est produit à la finition réelle.`:`Bilan à la fin de l’assaut : ${last!.killed} ennemi(s) mort(s), ${last!.downed} à terre, ${last!.escaped} parti(s). Démobilisez, soignez les colons et réparez les ouvrages dans la zone de foyer. Les corps restent sur place pour les secours et la sépulture.`;
    details.update(document.getElementById('alerts')!,!locate.hidden,true);
  }};
}
