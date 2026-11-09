import { describe, expect, test } from 'vitest';
import { gameLayout, workColumns } from '../src/ui/layout';

// The French Core 1.6.4871 WorkTypeDef naturalPriority order, with Smithing
// and Tailoring between Plant cutting and Art since schema 302.
const coreOrder = [
  'firefight', 'patient', 'doctor', 'bedrest', 'basic', 'warden',
  'handle', 'cook', 'hunt', 'build', 'grow', 'mine', 'gather',
  'smith', 'tailor', 'art', 'craft', 'haul', 'clean', 'research',
];

describe('Travail V118', () => {
  test('uses Core work priority order for every existing category', () => {
    expect(workColumns.map(column => column.id)).toEqual(coreOrder);
    expect(new Set(workColumns.map(column => column.id)).size).toBe(coreOrder.length);
    expect(workColumns.find(column=>column.id==='basic')?.label).toBe('Manutention');
    expect(workColumns.find(column=>column.id==='handle')?.label).toBe('Dressage');
    expect(workColumns.find(column=>column.id==='gather')?.label).toBe('Foresterie');
  });

  test('renders column headings in the same sequence as pawn work controls', () => {
    const markup = gameLayout();
    const headings = [...markup.matchAll(/<th data-work-heading="([^"]+)"/g)].map(match => match[1]);
    expect(headings).toEqual(coreOrder);
  });
});
