import {splicePileEntries} from './pile-identity-directory.ts';
/** Remove only the owned instance. A stale or foreign reference must never
 * turn indexOf=-1 into deletion of the final, unrelated collection member. */
export function removeIdentity<T>(items:T[],value:T):boolean {
  const index=items.indexOf(value);
  if(index<0)return false;
  splicePileEntries(items,index,1);return true;
}
