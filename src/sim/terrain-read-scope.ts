/* Only a closed synchronous simulation call may reuse a checked terrain view.
 * Its first read still observes every direct, unmarked fixture replacement;
 * nested scopes belong to the same call. No scope survives a public return. */
let depth=0,generation=0,journalOwner:object|undefined;
export function terrainReadScope():number|undefined {return depth?generation:undefined;}
/** Fixed SIM Worker owns its deserialized maps exclusively; there is no
 * mutable caller between clock tasks. Only that closed driver may retain a
 * checked journal witness across calls. Public simulations/fixture readers
 * still validate the first observation of every independent call. */
export function terrainJournalReadOwner():object|undefined {return depth?journalOwner:undefined;}
export function withJournalTerrainReadScope<T>(owner:object,run:()=>T):T {
 const before=journalOwner;journalOwner=owner;
 try{return withTerrainBlockedReadScope(run);}finally{journalOwner=before;}
}
export function withTerrainBlockedReadScope<T>(run:()=>T):T {
 if(depth===0)generation++;
 depth++;
 try{return run();}finally{depth--;}
}
