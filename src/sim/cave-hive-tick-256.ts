import {filteredStructures} from './structure-navigation.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** The real local tick and existing campaign generation-static owner. No
 * captured Rand/static continuation is installed on a failed component plan. */
import {captureCampaignLordIds256} from './cave-hive-lord-ids-256.ts';
import type {World} from './types.ts';
import {registeredCampaign} from './world-map-context.ts';
import {captureMapGenerationRuntime256,finishMapGenerationRuntime256} from './map-generation-runtime-256.ts';
import {planActualHiveRuntime256} from './cave-hive-runtime-256.ts';
import {hiveReproductionFactor256} from './cave-hive-profile-256.ts';
export function advanceActualHiveComponents256(w:World):void {
 if(!filteredStructures(w,'insect-hive-or-glow-pod',s=>s.kind==='insect-hive'||s.kind==='glow-pod').length)return;
 const root=registeredCampaign(w),maps=root.worldMaps,owner=maps?.generationRuntime;
 if(!isSchema256Or257(w.schemaVersion)||!maps||!owner)throw Error('Missing actual campaign Hive generation-static owner');
 const context={...captureMapGenerationRuntime256(owner,w.width,w.height),adjacentUses:0,lordIds:captureCampaignLordIds256(root),enemyReproductionRateFactor:hiveReproductionFactor256(w)},plan=planActualHiveRuntime256(w,context);
 if(plan.status!=='ready')throw Error('Actual Hive runtime refused: '+plan.reason);
 if(!plan.commit())throw Error('Stale actual Hive component continuation');
 maps.generationRuntime=finishMapGenerationRuntime256(owner,context);maps.nextLordId=context.lordIds.nextId;
}
