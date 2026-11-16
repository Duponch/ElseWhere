/** Core4871 Medium, label adventure story: explicit XML value .5. The class
 * default1 is not a fallback for absent or unknown product profiles. */
import type {World} from './types.ts';
import {supportedCoreProfile347} from './game-profile.ts';
export function hiveReproductionFactor256(w:Pick<World,'gameProfile'>):number {
 const p=w.gameProfile;
 if(!supportedCoreProfile347(p))throw Error('Hive runtime requires the actual supported AdventureStory profile');
 // Schema 347: the tutorial's Easy ("community builder") value is .15.
 return p!.difficulty==='community-builder'?.15:.5;
}
