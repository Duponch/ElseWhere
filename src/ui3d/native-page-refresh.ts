import {registeredMapId} from '../sim/world-map-context';
import type {NativePage,NativeUiActions,NativeUiState} from './native-contract';

/** A page's authority context, independent of tick, publication object identity
 * or its changing facts. Same-tick commands must still rebuild the projection. */
export function nativePageContext(state:NativeUiState):string {
  const world=state.world;
  return JSON.stringify([state.epoch,world?.seed,world?.width,world?.height,world?registeredMapId(world):undefined,state.campaign?.campaignSeed]);
}
/** Attach to a newly built page without changing its identity: info cards and
 * trade owners may retain this exact object as the current session page. */
export function liveNativePage(page:NativePage,state:NativeUiState,build:NonNullable<NativePage['refreshFromState']>):NativePage {
  const context=nativePageContext(state);
  page.refreshFromState=(next,actions)=>nativePageContext(next)===context?build(next,actions):null;
  return page;
}
/** Re-read live owners; static help, modal confirmations and local drafts keep
 * the exact page/session supplied by their owner. Rendering still compares
 * the existing ink signature and rebinds unchanged controls without repaint. */
export function refreshNativePage(page:NativePage,state:NativeUiState,actions:NativeUiActions):NativePage|null {
  return page.refreshFromState?page.refreshFromState(state,actions):page;
}
