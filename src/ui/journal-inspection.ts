import type { Pawn, World } from '../sim/types';
import { SOCIAL_LABELS } from '../sim/social-state';
import { TICKS_PER_DAY } from '../sim/types';
import { setTooltip } from './tooltip';

export type JournalFilter = 'all' | 'social' | 'combat' | 'mental';
export interface JournalRow { tick: number; kind: 'social' | 'combat' | 'mental'; text: string }

const socialLabels = Object.values(SOCIAL_LABELS);

/** The existing bounded event log is the only source of journal entries. Do not
 * invent dialogue, blows or a durable history from transient opinion scores. */
export function pawnJournalRows(world: World, pawn: Pawn): JournalRow[] {
  const escapedName=pawn.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const named=new RegExp(`(?<![\\p{L}\\p{N}])${escapedName}(?![\\p{L}\\p{N}])`,'iu');
  return world.events.flatMap(event => {
    const text = event.message;
    if (!named.test(text)) return [];
    const lower = text.toLocaleLowerCase('fr-FR');
    const mental=event.type==='need'&&['errance triste','frénésie alimentaire','crise de destruction','fureur violente','colère meurtrière','frénésie incendiaire'].some(label=>lower.includes(label));
    const kind: JournalRow['kind'] | undefined = mental?'mental':socialLabels.some(label => text.startsWith(`${label} entre `)) || ['a vexé', 'a insulté', 'bagarre'].some(word => lower.includes(word))
      ||event.type==='need'&&['deviennent partenaires','repousse l’avance de','se sépare de'].some(word=>lower.includes(word))
      ? 'social' : ['tir', 'touché', 'blessé', 'attaque', 'frappé', 'combat'].some(word => lower.includes(word)) ? 'combat' : undefined;
    return kind ? [{ tick: event.tick, kind, text }] : [];
  }).reverse();
}

export function createJournalInspection(panel: HTMLElement): void {
  const details = document.createElement('details');
  details.id = 'pawn-journal';
  const summary = document.createElement('summary');
  summary.textContent = 'Journal';
  const filters = document.createElement('div');
  filters.className = 'pawn-journal-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filtrer le journal');
  for (const [id, label] of [['all', 'Voir tout'], ['social', 'Voir social'], ['combat', 'Voir combat'], ['mental', 'Voir crises']] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.journalFilter = id;
    button.textContent = label;
    button.setAttribute('role','checkbox');button.setAttribute('aria-checked',String(id!=='all'));
    button.setAttribute('aria-pressed', String(id!=='all'));
    setTooltip(button,{title:label,body:id==='all'?'Afficher toutes les entrées conservées, quels que soient les filtres.':`Afficher ou masquer les entrées ${id==='social'?'sociales':id==='combat'?'de combat':'de crises mentales'}. Ce réglage est indépendant des autres filtres.`});
    button.addEventListener('click', () => {
      details.dataset[id]=String(details.dataset[id]!=='true');
      button.setAttribute('aria-checked',details.dataset[id]!);button.setAttribute('aria-pressed',details.dataset[id]!);
      refreshJournalFilter(details);
    });
    filters.append(button);
  }
  const list = document.createElement('ol');
  list.id = 'pawn-journal-rows';
  const empty = document.createElement('p');
  empty.id = 'pawn-journal-empty';
  empty.textContent = 'Aucune entrée conservée.';
  const limit = document.createElement('p');
  limit.className = 'pawn-journal-limit';
  limit.textContent = 'Historique des événements';limit.tabIndex=0;
  setTooltip(limit,{title:'Journal',body:'Les entrées proviennent des événements conservés dans cette partie. Un événement ancien qui n’a pas été consigné ne peut pas être reconstitué.'});
  details.dataset.all='false';details.dataset.social='true';details.dataset.combat='true';details.dataset.mental='true';
  details.append(summary, filters, list, empty, limit);
  panel.append(details);
}

function refreshJournalFilter(details: HTMLDetailsElement): void {
  let visible = 0;
  for (const row of details.querySelectorAll<HTMLElement>('#pawn-journal-rows > li')) {
    row.hidden = details.dataset.all!=='true'&&details.dataset[row.dataset.kind!]==='false';
    if (!row.hidden) visible++;
  }
  const empty = details.querySelector<HTMLElement>('#pawn-journal-empty');
  if (empty) empty.hidden = visible > 0;
}

export function updateJournalInspection(panel: HTMLElement, world: World, pawn: Pawn): void {
  const details = panel.querySelector<HTMLDetailsElement>('#pawn-journal');
  if (!details?.open) return;
  const rows = pawnJournalRows(world, pawn);
  const signature = JSON.stringify([pawn.id, rows]);
  const list = details.querySelector<HTMLOListElement>('#pawn-journal-rows');
  if (!list) return;
  if(list.dataset.signature!==signature){list.dataset.signature = signature;
  list.replaceChildren(...rows.map(row => {
    const entry = document.createElement('li');
    entry.dataset.kind = row.kind;
    const icon = document.createElement('span');
    icon.className = `pawn-journal-icon pawn-journal-icon-${row.kind}`;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = row.text;
    entry.tabIndex=0;
    entry.append(icon, text);
    return entry;
  }));}
  rows.forEach((row,index)=>setTooltip(list.children[index] as HTMLElement,{title:row.kind==='social'?'Interaction sociale':row.kind==='combat'?'Combat':'Crise mentale',body:`Il y a ${((world.tick-row.tick)/(TICKS_PER_DAY/24)).toFixed(1)} h.\n${row.text}`}));
  refreshJournalFilter(details);
}
