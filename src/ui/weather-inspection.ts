import { activeColdSnap, coldSnapOffset } from '../sim/cold-snap';
import {volcanicTemperatureOffset310,volcanicWinterActive310} from '../sim/volcanic-winter-state-310';
import { activeEclipse } from '../sim/eclipse';
import {toxicFalloutActive294} from '../sim/toxic-fallout-state-294';
import { TICKS_PER_DAY, type World } from '../sim/types';
import { personNotificationTarget,NotificationFocusCycle,type NotificationTarget,type FocusNotification } from './notification-focus';
import { createNotificationLetterDetails } from './notification-letter';

type WeatherWorld = Pick<World, 'tick' | 'miscIncidents'> & {schemaVersion?:number};
export interface WeatherConditionInspection {
  kind: 'cold-snap' | 'eclipse' | 'toxic-fallout' | 'volcanic-winter';
  title: string;
  summary: string;
  body: string;
}
function remainingTime(ticks: number): string {
  const minutes = Math.ceil(Math.max(0, ticks) * 1440 / TICKS_PER_DAY);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

/** Conditions and remaining duration come only from the confirmed snapshot. */
export function weatherConditionInspection(world: WeatherWorld): WeatherConditionInspection[] {
  const conditions: WeatherConditionInspection[] = [];
  const cold = activeColdSnap(world);
  if (cold) {
    const offset = coldSnapOffset(world).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    conditions.push({
      kind: 'cold-snap', title: 'Vague de froid',
      summary: `Vague de froid · ${offset} °C · reste ${remainingTime(cold.end - world.tick)}`,
      body: `La vague de froid modifie actuellement la température extérieure de ${offset} °C. Les pièces se refroidissent progressivement. Préparez un refuge fermé et chauffé, du combustible ou une alimentation électrique, et des vêtements adaptés. Un toit seul ne chauffe pas une pièce. Portez les personnes à terre vers un lit au chaud et surveillez l’hypothermie : les pansements ne remplacent pas le réchauffement. Protégez les cultures par une température et une lumière suffisantes ; une lampe horticole ne garantit pas à elle seule leur survie. La fin de la vague ne guérit pas les personnes et ne rend pas les plantes perdues.`,
    });
  }
  const eclipse = activeEclipse(world);
  if (eclipse) conditions.push({
    kind: 'eclipse', title: 'Éclipse',
    summary: `Éclipse · reste ${remainingTime(eclipse.end - world.tick)}`,
    body: 'La lumière naturelle diminue et la production des panneaux solaires est réduite. Vérifiez les réserves des batteries, le combustible des générateurs et l’alimentation réelle des chauffages, du froid et des ateliers. Les appareils électriques ne sont pas directement neutralisés par une éclipse. Les plantes ont toujours besoin de lumière et d’une température favorable ; les lampes horticoles peuvent les éclairer si elles sont alimentées et dans leur horaire de fonctionnement. L’éclipse ne change pas l’heure et ne protège ni du froid ni des blessures. Une reprise du soleil ne répare pas les pertes déjà subies.',
  });
  if(toxicFalloutActive294(world))conditions.push({
    kind:'toxic-fallout',title:'Retombées toxiques',summary:'Retombées toxiques · restez sous un toit',
    body:'Des retombées toxiques touchent cette carte. Placez les personnes et les animaux sous un toit réellement construit ou naturel, et adaptez leurs zones et leurs travaux. Un mur seul ne protège pas ; les personnes couchées au sol et les animaux dehors restent exposés. Surveillez l’accumulation toxique dans Santé. Les vêtements actuellement disponibles n’offrent pas de protection contre ces retombées. Les plantes et les denrées non couvertes peuvent être perdues ; les objets sensibles à la détérioration s’abîment trois fois plus vite lorsqu’ils sont exposés. Les arrivées spontanées de plantes et de faune sont interrompues. La fin arrête les nouvelles expositions, sans guérir les lésions ni restituer les plantes ou les biens perdus.',
  });
  const volcanic=world.miscIncidents?.volcanicWinter310;
  if(volcanic&&volcanicWinterActive310(world)){
    const offset=volcanicTemperatureOffset310(world).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
    conditions.push({kind:'volcanic-winter',title:'Hiver volcanique',
      summary:`Hiver volcanique · ${offset} °C · reste ${remainingTime(Math.ceil(volcanic.endCore/10)-world.tick)}`,
      body:`Des cendres voilent le ciel : la température extérieure baisse de ${offset} °C, les journées sont plus sombres, les cultures et les panneaux solaires produisent moins, la faune se raréfie et personne ne se détend en plein air. Prévoyez des réserves de nourriture et du chauffage.`});
  }
  return conditions;
}

export function weatherConditionLabel(world: WeatherWorld): string {
  return [activeColdSnap(world) ? 'Vague de froid' : '', activeEclipse(world) ? 'Éclipse' : '',toxicFalloutActive294(world)?'Retombées toxiques':'',volcanicWinterActive310(world)?'Hiver volcanique':''].filter(Boolean).join(' · ');
}

/** Informational letters reuse the existing alerts; they issue no commands. */
export function createWeatherConditionUI(focus?:FocusNotification): { update: (world: World) => void;reset:()=>void } {
  let current:World|undefined;const cycle=new NotificationFocusCycle();
  const targets=()=>current?.pawns.filter(p=>p.state!=='dead'&&(p.health?.hypothermia??0)>0).sort((a,b)=>a.id-b.id).map(p=>personNotificationTarget(current!,p.id)).filter((target):target is NotificationTarget=>!!target)??[];
  const letters = new Map<WeatherConditionInspection['kind'], { button: HTMLButtonElement; dialog: HTMLDialogElement; title: HTMLElement; body: HTMLElement;details:ReturnType<typeof createNotificationLetterDetails> }>();
  for (const kind of ['cold-snap', 'eclipse'] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.id = `${kind}-letter`; button.className = 'arrival-letter';
    const dialog = document.createElement('dialog'); dialog.id = `${kind}-dialog`; dialog.className = 'help-dialog';
    const title = document.createElement('h2'), body = document.createElement('p'), close = document.createElement('button');
    title.id = `${kind}-title`; dialog.setAttribute('aria-labelledby', title.id);
    close.type = 'button'; close.textContent = 'Fermer'; close.onclick = () => dialog.close();
    dialog.append(title, body, close); document.body.append(dialog);const details=createNotificationLetterDetails(button,dialog);button.onclick = () => {
      const target=kind==='cold-snap'?cycle.next('cold-snap',targets()):undefined;
      if(target&&focus)focus(target);else if(!dialog.open)dialog.showModal();};
    letters.set(kind, { button, dialog, title, body,details });
  }
  return { reset:()=>cycle.reset(),update(world) {
    current=world;
    const conditions = weatherConditionInspection(world);
    for (const [kind, letter] of letters) {
      const condition = conditions.find(row => row.kind === kind);
      if (!condition) { letter.details.remove(); if (letter.dialog.open) letter.dialog.close(); continue; }
      letter.button.textContent = condition.summary; letter.title.textContent = condition.title; letter.body.textContent = condition.body;
      const alerts = document.getElementById('alerts');
      if(alerts)letter.details.update(alerts,kind==='cold-snap'&&!!focus&&!!targets().length);
    }
  } };
}
