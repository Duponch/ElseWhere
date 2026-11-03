/** Transfer only AFTER borrowed preparation sources have retired successfully.
 * A rejected promise must not strand a render target the caller never received. */
export function completeLegacyPageTransfer<T extends{dispose():void}>(resource:T,releaseSources:()=>void):T{
 try{releaseSources();return resource;}catch(error){const failures:unknown[]=[error];try{resource.dispose();}catch(cleanup){failures.push(cleanup);}throw new AggregateError(failures,'Legacy page source cleanup failed; GPU result not published');}
}
