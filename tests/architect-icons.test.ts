import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toolDefinitions } from '../src/ui/layout';
import {
  ARCHITECT_ICON_ATLASES,
  ARCHITECT_ICON_MAPPING,
  ARCHITECT_ICON_ORDER,
  ARCHITECT_ICON_URLS,
  installArchitectIcons,
} from '../src/ui/architect-icons';

describe('Architect generated icon atlases', () => {
  it('keeps marker cell addresses while every UI tool has its own complete image', () => {
    const rendered = toolDefinitions.map(tool => tool.id);
    expect(rendered).toHaveLength(123);
    expect(new Set(rendered).size).toBe(123);
    expect(rendered).toContain('spike-trap');
    expect(rendered).toContain('double-bed');
    expect(rendered).toContain('mini-turret');
    expect(rendered).toContain('tube-television');
    expect(rendered).toContain('sandbags');
    expect(rendered).toContain('sun-lamp');
    expect(ARCHITECT_ICON_ORDER).toEqual(expect.arrayContaining(rendered));
    expect(new Set(ARCHITECT_ICON_ORDER).size).toBe(ARCHITECT_ICON_ORDER.length);
    expect(Object.keys(ARCHITECT_ICON_MAPPING)).toEqual(expect.arrayContaining(rendered));
    for(const id of rendered)expect(ARCHITECT_ICON_MAPPING[id],id).toBeDefined();
    expect(new Set(Object.values(ARCHITECT_ICON_URLS)).size).toBe(ARCHITECT_ICON_ORDER.length);
    expect(ARCHITECT_ICON_URLS['machining-table']).not.toBe(ARCHITECT_ICON_URLS['electric-tailor-bench']);
    expect(ARCHITECT_ICON_URLS['mini-turret']).not.toBe(ARCHITECT_ICON_URLS['standing-lamp']);
    for(const id of rendered){const url=ARCHITECT_ICON_URLS[id]!,svg=url.startsWith('data:image/svg+xml')?decodeURIComponent(url.slice(url.indexOf(',')+1)):readFileSync(new URL(`../public${url}`,import.meta.url),'utf8');expect(svg,id).toContain('<svg');expect(svg,id).toContain('<path');}
  });

  it('ships transparent SVG sheets with equal cells for unchanged marker UVs', () => {
    for (const asset of ARCHITECT_ICON_ATLASES) {
      const svg=readFileSync(new URL(`../public${asset}`,import.meta.url),'utf8');
      expect(svg).toContain('width="576" height="480"');expect(svg).toContain('viewBox="0 0 576 480"');
      expect(svg.match(/<g transform="translate/g)).toHaveLength(30);
    }
  });

  it('replaces the glyph and reports the installed atlas cell', () => {
    const classes: string[] = [];
    const attributes = new Map<string, string>();
    const style: Record<string, string> = {};
    const icon = {
      classList: { add: (name: string) => classes.push(name) },
      style,
      textContent: '⚒',
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    };
    const button = { dataset: { tool: 'mine' }, querySelector: () => icon };
    const root = { querySelectorAll: () => [button] } as unknown as HTMLElement;

    expect(installArchitectIcons(root)).toEqual({ installed: ['mine'], missing: [], absent: ARCHITECT_ICON_ORDER.filter(id => id !== 'mine') });
    expect(icon.textContent).toBe('');
    expect(classes).toContain('ui-icon');
    expect(attributes.get('aria-hidden')).toBe('true');
    expect(style.backgroundImage).toContain('/elsewhere/pictograms-20261107/mine.svg');
    expect(style.backgroundSize).toBe('contain');
  });
});
