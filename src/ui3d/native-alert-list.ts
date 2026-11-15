import {animalSpecies} from '../sim/animal-species';
import {ITEM_DEFINITIONS} from '../sim/items';
import {mechanoidDefinition} from '../sim/mechanoid-definition';
import type {World} from '../sim/types';
import {CORE_ALERT_PRIORITY_RANK,coreAlertPriority,coreAlertsStarted,type CoreAlertPriority} from '../ui/alert-priority';
import {buildingLabels} from '../ui/building-labels';
import type {FoodReadability} from '../sim/food-readability';
import type {NotificationTarget} from '../ui/notification-focus';
import {readStatusAlerts,type StatusAlert} from '../ui/status-alerts';
import {readNativeDomainAlerts,type NativeDomainAlert} from './native-domain-alerts';

/** One right-hand row: a Core alert equivalent or a letter projection. */
export type HudAlert=StatusAlert&{domain?:NativeDomainAlert};
export type PrioritizedHudAlert=HudAlert&{priority:CoreAlertPriority};

/** Core rechecks every alert once per 24 frames (≈ 0.4 s at 60 FPS). */
export const ALERT_RECHECK_MS=400;

/** Core alerts appear only once 600 Core ticks have passed (AlertsReadout);
 * letter projections (domain rows) are messages, not alerts, and stay visible
 * from the start, like the arrival of the starting pods. Pure, no mutation. */
export function readNativeAlertRows(world:World,food:FoodReadability|undefined,speed?:number):PrioritizedHudAlert[] {
  const status:HudAlert[]=coreAlertsStarted(world)?readStatusAlerts(world,food):[];
  const domain:HudAlert[]=readNativeDomainAlerts(world,speed).map(row=>({...row,domain:row}));
  return [...status,...domain].map(row=>({...row,priority:coreAlertPriority(row)}));
}

/** Core keeps the active alerts in activation order and draws them Critical,
 * then High, then Medium. An alert that disappears and comes back starts again.
 * A fresh session (load, new game) adopts its current alerts silently. */
export class AlertActivationTracker {
  private order=new Map<string,number>();
  private serial=0;
  update<T extends {key:string;priority:CoreAlertPriority}>(rows:readonly T[],fresh:boolean):{ordered:T[];started:T[]} {
    const started:T[]=[],keys=new Set<string>();
    if(fresh)this.order.clear();
    for(const row of rows){
      keys.add(row.key);
      if(this.order.has(row.key))continue;
      this.order.set(row.key,this.serial++);
      if(!fresh)started.push(row);
    }
    for(const key of [...this.order.keys()])if(!keys.has(key))this.order.delete(key);
    const ordered=[...new Map(rows.map(row=>[row.key,row])).values()]
      .sort((a,b)=>CORE_ALERT_PRIORITY_RANK[b.priority]-CORE_ALERT_PRIORITY_RANK[a.priority]||this.order.get(a.key)!-this.order.get(b.key)!);
    return {ordered,started};
  }
  reset():void {this.order.clear();}
}

/** Core AlertBounce: horizontal offset in pixels, starting 300 px away from the
 * edge (velocity −200 px/s, acceleration −1200 px/s², rebound −v/3 − 1, step
 * capped at 0.05 s). Core keeps sub-pixel rebounds forever at ordinary frame
 * rates; here the card rests once no rebound can exceed one pixel, so the HUD
 * stops repainting. Real time, presentation only. */
export const ALERT_BOUNCE_REST_SPEED=Math.sqrt(2*1200);
export class AlertBounce {
  position=300;
  velocity=-200;
  idle=false;
  step(seconds:number):number {
    if(this.idle)return this.position;
    const dt=Math.min(Math.max(0,seconds),.05);
    this.velocity-=1200*dt;this.position+=this.velocity*dt;
    if(this.position<0){this.position=0;this.velocity=Math.max(-this.velocity/3-1,0);}
    if(this.position<1&&Math.abs(this.velocity)<ALERT_BOUNCE_REST_SPEED){this.velocity=0;this.position=0;this.idle=true;}
    return this.position;
  }
}

/** Core Alert_Critical background: Pulser at 0.5 Hz, nested amplitude 0.6;
 * brightness swings between 0.6 and 1 over two real seconds. */
export function alertPulseBrightness(seconds:number):number {
  const t=(1-Math.cos(seconds*Math.PI*2*.5))*.5,inner=1-.6+.6*t;
  return 1-inner+inner*t;
}
/** Quantised pulse level, so a critical card repaints a handful of times per
 * second instead of every frame. */
export const ALERT_PULSE_LEVELS=4;
export const alertPulseLevel=(seconds:number):number=>Math.round((alertPulseBrightness(seconds)-.6)/.4*(ALERT_PULSE_LEVELS-1));

/** Display name of a culprit, resolved against the current snapshot only. */
export function alertTargetLabel(world:World,target:NotificationTarget):string {
  if(target.kind==='actor'){
    const pawn=world.pawns.find(p=>p.id===target.id);if(pawn)return pawn.name;
    const animal=world.wildlife?.animals.find(a=>a.id===target.id);if(animal)return animalSpecies(animal.species).label;
    const machine=world.mechanoids?.find(m=>m.id===target.id);if(machine)return mechanoidDefinition(machine.mechKind).label;
    return 'Personne';
  }
  if(target.kind==='cell')return `Lieu (${target.cell.x}, ${target.cell.z})`;
  const {kind,id}=target.object;
  if(kind==='structure'){const s=world.structures.find(item=>item.id===id);if(s)return `${buildingLabels[s.kind]} (${s.x}, ${s.z})`;}
  if(kind==='pile'){const pile=world.piles.find(item=>item.id===id);if(pile)return ITEM_DEFINITIONS[pile.item].label;}
  if(kind==='resource')return `Plante (${target.cell.x}, ${target.cell.z})`;
  if(kind==='job')return `Ordre (${target.cell.x}, ${target.cell.z})`;
  return `(${target.cell.x}, ${target.cell.z})`;
}

const MAX_HOVER_NAMES=8;
/** Hover explanation (Core info pane): the row's explanation, then the names
 * of its culprits and how to reach them. A row without either keeps its text. */
export function alertHoverText(world:World|undefined,alert:HudAlert):string {
  const lines=[alert.text];
  if(alert.explanation)lines.push(alert.explanation);
  const tip=alert.tooltip;
  if(tip){
    if(tip.title&&tip.title!==alert.text)lines.push(tip.title);
    if(tip.body)lines.push(tip.body);
    for(const row of tip.rows??[])lines.push(`${row.label} : ${row.value}`);
  }
  const targets=[...new Map(alert.targets.map(target=>[target.key,target])).values()];
  if(targets.length){
    const named=`${alert.explanation??''} ${tip?.body??''}`;
    if(world&&!named.includes(alertTargetLabel(world,targets[0]!))){
      const labels=targets.slice(0,MAX_HOVER_NAMES).map(target=>alertTargetLabel(world,target));
      lines.push(`Concerné${targets.length>1?'s':''} : ${labels.join(', ')}${targets.length>MAX_HOVER_NAMES?` et ${targets.length-MAX_HOVER_NAMES} autre${targets.length-MAX_HOVER_NAMES>1?'s':''}`:''}`);
    }
    lines.push('Clic : aller au cas suivant · clic droit : au précédent');
  }
  return lines.join('\n');
}
