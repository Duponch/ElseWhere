/** Developer-mode session flags, held by the Worker for the length of its life.
 *
 * Core keeps the same two switches outside the save: Prefs.DevMode (a user
 * preference) and DebugSettings.godMode (a static of the running game, reset to
 * false when the developer mode is turned off). Elsewhere does the same: the
 * browser keeps the preference, the client sends it to the Worker, and the
 * Worker holds it here. Neither enters a World, a save or a snapshot, so a
 * player who never turns the mode on sees no difference at all. */
const session={enabled:false,god:false};
/** Turns the developer mode on or off; the god mode cannot outlive it. */
export function setDevSession(enabled:boolean,god:boolean):void {
  session.enabled=enabled===true;
  session.god=session.enabled&&god===true;
}
export const devModeEnabled=():boolean=>session.enabled;
export const devGodMode=():boolean=>session.god;
/** Ticks a dev action asked the Worker to play at once (« avancer le temps »).
 * The command only records the request; the Worker, after acknowledging the
 * command at its tick boundary, plays them with the ordinary stepWorld. */
let pendingAdvance=0;
export const requestDevAdvance=(ticks:number):void=>{pendingAdvance=Math.max(0,Math.min(1_000_000,pendingAdvance+Math.floor(ticks)));};
export function takeDevAdvance():number {const n=pendingAdvance;pendingAdvance=0;return n;}
