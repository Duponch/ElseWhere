export type ColonistInspectorTab = 'journal' | 'gear' | 'social' | 'bio' | 'needs' | 'health' | 'prisoner';

export interface ColonistInspectorState {
  pawnId: number;
  activeTab: ColonistInspectorTab;
}

import { dismissTooltip, setTooltip } from './tooltip';

export interface ColonistInspectorOptions extends ColonistInspectorState {
  prisoner: boolean;
  onTabChange: (tab: ColonistInspectorTab) => void;
}
const mountedInspectorOptions=new WeakMap<HTMLElement,ColonistInspectorOptions>();

interface InspectorTabDefinition {
  id: ColonistInspectorTab;
  label: string;
  selectors: readonly string[];
}

const TAB_DEFINITIONS: readonly InspectorTabDefinition[] = Object.freeze([
  { id: 'journal', label: 'Journal', selectors: ['#pawn-journal'] },
  { id: 'gear', label: 'Matériel', selectors: ['#equipment-details'] },
  { id: 'prisoner', label: 'Prisonnier', selectors: ['#prisoner-inspection'] },
  { id: 'social', label: 'Social', selectors: ['#social-inspection'] },
  { id: 'bio', label: 'Bio', selectors: ['.skills-inspection'] },
  { id: 'needs', label: 'Besoins', selectors: ['.needs', '#party-participation', '#recreation-tolerance', '#mood-inspection', '#room-description'] },
  { id: 'health', label: 'Santé', selectors: ['#health-inspection', '#hygiene-controls', '#burial-controls'] },
]);

const SUMMARY_SELECTORS = ['.panel-heading', '#selected-identity', '#selected-action', '#enemy-mandate'] as const;
const ACTION_SELECTORS = ['#draft-controls', '#manage-work', '#selected-orders', '#clear-orders'] as const;

export function colonistInspectorLayoutContract(): {
  summary: readonly string[];
  actions: readonly string[];
  panels: Readonly<Record<ColonistInspectorTab, readonly string[]>>;
} {
  return {
    summary: SUMMARY_SELECTORS,
    actions: ACTION_SELECTORS,
    panels: Object.fromEntries(TAB_DEFINITIONS.map(tab => [tab.id, tab.selectors])) as Record<ColonistInspectorTab, readonly string[]>,
  };
}

export function colonistInspectorTabs(prisoner: boolean): readonly Pick<InspectorTabDefinition, 'id' | 'label'>[] {
  return TAB_DEFINITIONS.filter(tab => prisoner || tab.id !== 'prisoner').map(({ id, label }) => ({ id, label }));
}

export function resolveColonistInspectorTab(tab: ColonistInspectorTab, prisoner: boolean): ColonistInspectorTab {
  return tab === 'prisoner' && !prisoner ? 'bio' : tab;
}

/** Keeps the inspected category while moving between people, as long as that
 * category exists for the newly selected person. The caller remains the owner
 * of this presentation state. */
export function colonistInspectorState(
  previous: ColonistInspectorState | undefined,
  pawnId: number,
  prisoner: boolean,
  requested?: ColonistInspectorTab,
): ColonistInspectorState {
  const activeTab = resolveColonistInspectorTab(requested ?? previous?.activeTab ?? 'bio', prisoner);
  return { pawnId, activeTab };
}

/** Static markup is exported so its accessibility contract can be checked
 * without requiring a second browser DOM in the unit-test process. */
export function colonistInspectorScaffold(prisoner: boolean): string {
  const tabs = colonistInspectorTabs(prisoner);
  return `<div class="colonist-inspector-scroll"><div class="colonist-inspector-pages">${tabs.map(tab => `<section role="tabpanel" id="colonist-panel-${tab.id}" aria-labelledby="colonist-tab-${tab.id}" tabindex="0" data-colonist-panel="${tab.id}" hidden><h3 class="inspector-page-title">${tab.label}</h3></section>`).join('')}</div><div class="colonist-inspector-tabs" role="tablist" aria-label="Dossiers du personnage">${tabs.map(tab => `<button type="button" role="tab" id="colonist-tab-${tab.id}" aria-controls="colonist-panel-${tab.id}" aria-selected="false" tabindex="-1" data-colonist-tab="${tab.id}">${tab.label}</button>`).join('')}</div><div class="colonist-inspector-footer"><section class="colonist-inspector-summary" aria-label="Résumé du personnage sélectionné"></section><section class="colonist-inspector-actions" aria-label="Actions du personnage"></section></div></div>`;
}

function directMatches(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter(node =>
    !node.closest('.colonist-inspector-tabs') && !node.closest('[data-colonist-panel]') &&
    !node.closest('.colonist-inspector-summary') && !node.closest('.colonist-inspector-actions'));
}

function moveMatches(root: HTMLElement, selectors: readonly string[], destination: HTMLElement): void {
  for (const selector of selectors) {
    for (const node of directMatches(root, selector)) destination.append(node);
  }
}

/** Rehomes existing inspection nodes instead of recreating them. This retains
 * every command listener, data attribute and live update target installed by
 * the domain-specific inspection helpers. */
export function refreshColonistInspectorLayout(root: HTMLElement): void {
  const context = root.querySelector<HTMLElement>('#room-description');
  const summary = root.querySelector<HTMLElement>('.colonist-inspector-summary');
  const actions = root.querySelector<HTMLElement>('.colonist-inspector-actions');
  if (!summary || !actions) return;
  // RoomInspection inserts next to the action even after the summary is mounted.
  // Rehome this late-created node explicitly; normal collection skips summary nodes.
  const needs = root.querySelector<HTMLElement>('[data-colonist-panel="needs"]');
  if (context && needs && !context.closest('[data-colonist-panel="needs"]')) needs.append(context);
  moveMatches(root, SUMMARY_SELECTORS, summary);
  moveMatches(root, ACTION_SELECTORS, actions);
  for (const definition of TAB_DEFINITIONS) {
    const panel = root.querySelector<HTMLElement>(`[data-colonist-panel="${definition.id}"]`);
    if (!panel) continue;
    moveMatches(root, definition.selectors, panel);
  }
  // One left need list and one right thought list; each domain still owns its
  // live nodes and command listeners. Collect late room descriptions as well.
  if (needs) {
    let columns = needs.querySelector<HTMLElement>('.pawn-needs-columns');
    if (!columns) {
      columns = document.createElement('div'); columns.className = 'pawn-needs-columns';
      const left = document.createElement('section'); left.className = 'pawn-needs-list';
      left.setAttribute('aria-label', 'Besoins');
      const right = document.createElement('section'); right.className = 'pawn-thoughts-list';
      right.setAttribute('aria-label', 'Humeur et pensées'); columns.append(left, right); needs.append(columns);
    }
    for (const node of needs.querySelectorAll<HTMLElement>(':scope > .needs, :scope > #party-participation, :scope > #recreation-tolerance, :scope > #room-description')) columns.children[0]!.append(node);
    const mood = needs.querySelector<HTMLElement>(':scope > #mood-inspection');
    if (mood) columns.children[1]!.append(mood);
  }
}

export function setColonistInspectorTab(root: HTMLElement, requested: ColonistInspectorTab, prisoner: boolean): ColonistInspectorTab {
  const active = resolveColonistInspectorTab(requested, prisoner);
  if (root.dataset.colonistInspectorTab === active) return active;
  dismissTooltip();
  const dimensions = { journal:[630,510], gear:[460,450], social:[540,510], bio:[514,489], needs:[580,520], health:[630,430], prisoner:[460,450] } as const;
  root.style.setProperty('--dossier-width', `${dimensions[active][0]}px`);
  root.style.setProperty('--dossier-height', `${dimensions[active][1]}px`);
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-colonist-tab]')) {
    const selected = button.dataset.colonistTab === active;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  for (const panel of root.querySelectorAll<HTMLElement>('[data-colonist-panel]')) {
    const selected = panel.dataset.colonistPanel === active;
    panel.hidden = !selected;
    for (const details of panel.querySelectorAll<HTMLDetailsElement>(':scope > details')) details.open = selected;
    const mood=panel.querySelector<HTMLDetailsElement>('#mood-inspection');if(mood)mood.open=selected;
  }
  root.dataset.colonistInspectorTab = active;
  return active;
}

export function updateColonistInspector(root: HTMLElement, state: ColonistInspectorState, prisoner: boolean): ColonistInspectorTab {
  root.dataset.colonistInspectorPawn = String(state.pawnId);
  root.dataset.colonistInspectorPrisoner = String(prisoner);
  refreshColonistInspectorLayout(root);
  return setColonistInspectorTab(root, state.activeTab, prisoner);
}

export function mountColonistInspector(root: HTMLElement, options: ColonistInspectorOptions): ColonistInspectorTab {
  mountedInspectorOptions.set(root,options);
  if (root.querySelector('.colonist-inspector-tabs')) return updateColonistInspector(root, options, options.prisoner);

  root.insertAdjacentHTML('afterbegin', colonistInspectorScaffold(options.prisoner));
  root.classList.add('colonist-inspector-host');
  // Existing nodes remain direct children after the scaffold is inserted.
  // Moving rather than cloning them preserves all action closures.
  refreshColonistInspectorLayout(root);

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-colonist-tab]')];
  const choose = (button: HTMLButtonElement): void => {
    const tab = button.dataset.colonistTab as ColonistInspectorTab;
    const current=mountedInspectorOptions.get(root)!;
    const prisoner=root.dataset.colonistInspectorPrisoner==='true';
    const active=setColonistInspectorTab(root, tab, prisoner);
    current.onTabChange(active);
  };
  for (const button of buttons) {
    const title = button.textContent ?? '';
    const descriptions: Record<ColonistInspectorTab, string> = {
      bio:'Âge, traits et compétences. Survoler une compétence pour consulter son expérience et ses effets.',
      needs:'Nourriture, sommeil, confort, loisirs et pensées qui influencent l’humeur.',
      health:'Capacités, blessures, maladies et politiques de soins. Les opérations se demandent dans leur sous-onglet.',
      gear:'Arme, vêtements et objets réellement possédés ou transportés.',
      social:'Opinions réciproques et interactions consignées avec les autres personnes.',
      journal:'Échanges et combats consignés pour cette personne.',
      prisoner:'Mode de détention, résistance, régime et recrutement.',
    };
    setTooltip(button, { title, body: descriptions[button.dataset.colonistTab as ColonistInspectorTab] });
    button.addEventListener('click', () => choose(button));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(button);
      const target = event.key === 'Home' ? buttons[0]
        : event.key === 'End' ? buttons.at(-1)
          : buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      target?.focus();
      if (target) choose(target);
    });
  }
  return updateColonistInspector(root, options, options.prisoner);
}
