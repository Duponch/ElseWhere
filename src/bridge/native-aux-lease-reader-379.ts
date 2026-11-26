/** Read-only lazy bridge. Decoders are shared by producer, public readers and
 * Native MAIN; a static import of the fixed Native lane would close the
 * Native -> vegetation -> auxiliary -> decoder initialization cycle.
 * No registration/mint is exported here. Until the genuine verifier module
 * has finished evaluating, ordinary public validation remains authoritative. */
type Verifier=typeof import('./native-clone-resident').ownsPrivateNativeAuxSection379;
let verifier:Verifier|undefined;
let loading:Promise<void>|undefined;
export function prepareNativeAuxLeaseReader379():void {
 loading??=import('./native-clone-resident').then(module=>{verifier=module.ownsPrivateNativeAuxSection379;},()=>{/* Strict decoder remains available. */});
}
export function readPrivateNativeAuxLease379(...args:Parameters<Verifier>):boolean {
 return verifier?.(...args)===true;
}
