import { describe, expect, test, vi } from 'vitest';
import {
  colonistInspectorLayoutContract,
  colonistInspectorScaffold,
  colonistInspectorState,
  colonistInspectorTabs,
  resolveColonistInspectorTab,
  mountColonistInspector,
} from '../src/ui/colonist-inspector';

describe('colonist inspector structure', () => {
  test('a reused legacy tab reads its current callback and prisoner status instead of the first mounted person',()=>{
    // Narrow host port: no DOM parser/rendering claim. The real mount/update
    // functions install and invoke their original event callback on this tab.
    const events=new Map<string,()=>void>(),attributes=new Set<string>();let mounted=false;
    const button={dataset:{colonistTab:'prisoner'},textContent:'Prisonnier',hasAttribute:(name:string)=>attributes.has(name),setAttribute:(name:string)=>{attributes.add(name);},removeAttribute:(name:string)=>{attributes.delete(name);},addEventListener:(name:string,callback:()=>void)=>{events.set(name,callback);}};
    const root={dataset:{colonistInspectorTab:'bio'},style:{setProperty:vi.fn()},classList:{add:vi.fn()},insertAdjacentHTML:()=>{mounted=true;},querySelector:(selector:string)=>selector==='.colonist-inspector-tabs'&&mounted?{}:null,querySelectorAll:(selector:string)=>selector==='[data-colonist-tab]'?[button]:[]};
    const old=vi.fn(),current=vi.fn();
    mountColonistInspector(root as unknown as HTMLElement,{pawnId:1,activeTab:'bio',prisoner:true,onTabChange:old});
    mountColonistInspector(root as unknown as HTMLElement,{pawnId:2,activeTab:'bio',prisoner:false,onTabChange:current});
    events.get('click')!();expect(old).not.toHaveBeenCalled();expect(current).toHaveBeenCalledExactlyOnceWith('bio');
  });
  test('offers the six human records in Core order and only exposes Prisonnier for a captive', () => {
    expect(colonistInspectorTabs(false).map(tab => tab.label)).toEqual(['Journal', 'Matériel', 'Social', 'Bio', 'Besoins', 'Santé']);
    expect(colonistInspectorTabs(true).map(tab => tab.label)).toEqual(['Journal', 'Matériel', 'Prisonnier', 'Social', 'Bio', 'Besoins', 'Santé']);
  });

  test('keeps the chosen record across identity selection and rejects an inapplicable prisoner record', () => {
    const health = colonistInspectorState(undefined, 3, false, 'health');
    expect(colonistInspectorState(health, 7, false)).toEqual({ pawnId: 7, activeTab: 'health' });
    expect(colonistInspectorState({ pawnId: 4, activeTab: 'prisoner' }, 7, false)).toEqual({ pawnId: 7, activeTab: 'bio' });
    expect(resolveColonistInspectorTab('prisoner', true)).toBe('prisoner');
  });

  test('pairs every tab with one labelled panel and a single selected-state contract', () => {
    const markup = colonistInspectorScaffold(true);
    for (const { id } of colonistInspectorTabs(true)) {
      expect(markup).toContain(`role="tab" id="colonist-tab-${id}" aria-controls="colonist-panel-${id}"`);
      expect(markup).toContain(`role="tabpanel" id="colonist-panel-${id}" aria-labelledby="colonist-tab-${id}"`);
    }
    expect(markup.match(/role="tab"/g)).toHaveLength(7);
    expect(markup.match(/role="tabpanel"/g)).toHaveLength(7);
    expect(markup.indexOf('colonist-inspector-pages')).toBeLessThan(markup.indexOf('colonist-inspector-tabs'));
    expect(markup.indexOf('colonist-inspector-tabs')).toBeLessThan(markup.indexOf('colonist-inspector-summary'));
    expect(markup).toContain('aria-label="Résumé du personnage sélectionné"');
    expect(markup).toContain('aria-label="Actions du personnage"');
  });

  test('reuses every existing command surface inside the composed inspector', () => {
    const layout = colonistInspectorLayoutContract();
    expect(layout.actions).toEqual(expect.arrayContaining([
      '#draft-controls', '#manage-work', '#clear-orders',
    ]));
    expect(layout.panels.health).toContain('#health-inspection');
    expect(layout.summary).not.toContain('#room-description');
    expect(layout.panels.needs).toContain('#room-description');
    expect(layout.panels.health).toEqual(expect.arrayContaining(['#hygiene-controls', '#burial-controls']));
    expect(layout.panels.gear).toContain('#equipment-details');
    expect(layout.panels.social).toContain('#social-inspection');
    expect(layout.panels.journal).toContain('#pawn-journal');
    expect(layout.panels.prisoner).toContain('#prisoner-inspection');
  });
});
