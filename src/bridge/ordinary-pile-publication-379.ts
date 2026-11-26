import {captureOrdinaryPileSource379,ordinaryPileSourceVersion379} from '../sim/ordinary-pile-source-379.ts';
import {verifyResourceJournal} from '../sim/resource-mutation-journal.ts';
import {verifyPileIndex} from '../sim/pile-index.ts';
import type {MaterialPile} from '../sim/types.ts';

/** The left values are private codec/frozen copies whose equality was proved
 * at their own construction. Each reader keeps independent copy bindings;
 * nothing is advanced merely by preparing/abandoning a publication. */
export class OrdinaryPilePublication379 {
 private readonly copies=new WeakMap<object,{source:MaterialPile;version:object}>();
 constructor(private readonly owner:object){}
 remember(source:MaterialPile,copy:object):void {
  const version=captureOrdinaryPileSource379(source,this.owner);if(version)this.copies.set(copy,{source,version});
 }
 unchanged(source:MaterialPile,copy:object,verify:()=>boolean):boolean {
  const old=this.copies.get(copy),version=ordinaryPileSourceVersion379(source,this.owner);
  if(!version||old?.source!==source||old.version!==version)return false;
  if((verifyResourceJournal||verifyPileIndex)&&!verify())throw Error('Unmarked ordinary pile source write');
  return true;
 }
}
