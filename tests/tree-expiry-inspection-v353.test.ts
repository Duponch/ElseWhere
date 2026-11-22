import {expect,test} from 'vitest';
import {preparedTreeWrapper} from './scenarios/tree-transfer-v349';
import {minifiedTreeDescription} from '../src/ui/minified-tree-inspection';
import {itemInformation} from '../src/ui/item-information';
import {mapObjectActions} from '../src/ui/map-object-actions';

// Presentation of a declared dead/output-pending object. Strict domain and
// physical expiry are covered separately, not inferred from this text test.
test('V353 dead pending tree inspection reports every captured rest and never offers a new lifetime',()=>{
 const {w,pile}=preparedTreeWrapper();pile.plantPack.pendingExpiry={quantity:17,retryAt:pile.plantPack.expiresAt+20};
 const before=structuredClone(pile),text=minifiedTreeDescription(pile,pile.plantPack.expiresAt+1),info=itemInformation(pile);
 expect(text).toContain('Arbre mort');expect(text).toContain('Bois à déposer : 17');expect(text).not.toContain('À replanter');
 expect(info.title).toBe('Arbre mort · restes en attente');expect(info.rows).toContainEqual(expect.objectContaining({label:'Bois à déposer',value:'17'}));
 expect(info.rows.some(row=>row.label==='Croissance'||row.label==='Conservation')).toBe(false);expect(pile).toEqual(before);expect(mapObjectActions(w,{kind:'pile',id:pile.id}).some(a=>a.id==='replant')).toBe(false);
});
test('V353 living tree keeps its exact existing inspection text and seven-day advice',()=>{
 const {w,pile}=preparedTreeWrapper(),before=structuredClone(pile);
 expect(minifiedTreeDescription(pile,w.tick)).toBe('Chêne · Croissance : 80 % · À replanter sous 7 jour(s) · 150 kg');
 const info=itemInformation(pile);expect(info.title).toBe('Arbre déraciné');expect(info.rows).toContainEqual(expect.objectContaining({label:'Conservation',value:'7 jours après le déracinement'}));expect(pile).toEqual(before);expect(mapObjectActions(w,{kind:'pile',id:pile.id}).some(a=>a.id==='replant')).toBe(true);
});
