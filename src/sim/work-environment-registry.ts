import type { LightEnvironmentCache } from './light-environment.ts';
import type { WorkEnvironmentCache } from './work-environment.ts';

/* Breaks an import cycle found after schema 366: light-environment → … →
 * recreation-space → view-art-366 → work-environment, whose WorkEnvironment
 * extends LightEnvironment before light-environment has finished loading.
 * view-art-366 needs the cache class only when it runs, so work-environment.ts
 * registers it here when it loads; this module imports nothing at run time. */
type WorkEnvironmentCacheClass=new(light?:LightEnvironmentCache)=>WorkEnvironmentCache;
let workEnvironmentCacheClass:WorkEnvironmentCacheClass|undefined;

export function registerWorkEnvironmentCache(value:WorkEnvironmentCacheClass):void {workEnvironmentCacheClass=value;}
export function newWorkEnvironmentCache(light?:LightEnvironmentCache):WorkEnvironmentCache {
  if(!workEnvironmentCacheClass)throw new Error('work-environment.ts has not been loaded.');
  return new workEnvironmentCacheClass(light);
}
