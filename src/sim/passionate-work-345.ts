import {productionRecipeSkill283} from './bill-worker-rules-283.ts';
import {backgroundSkillRefusal,type BackgroundSkillId} from './colonist-backgrounds.ts';
import {taskRecipe} from './production-recipes.ts';
import {usesConstructionSkill} from './skills.ts';
import type {MoodThought} from './mood.ts';
import type {Job,Pawn,World} from './types.ts';

/* Schema 345, ThoughtDef DoingPassionateWork (Thoughts_Situation_Special,
 * ThoughtWorker_PassionateWork): while the current toil of the pawn's job has
 * an active skill (JobDriver.ActiveSkill = CurToil.activeSkill), a minor
 * passion for that skill gives +8 and a burning passion +14. Walking to the
 * work, fetching materials, hauling and waiting have no active skill. */
const THOUGHTS:readonly [MoodThought,MoodThought]=Object.freeze([
  Object.freeze({id:'passionate-work',label:'Passion pour son travail',offset:8,kind:'situation' as const,description:'Ce colon exerce une compétence pour laquelle il a une passion. La pensée dure le temps du travail effectif.'}),
  Object.freeze({id:'passionate-work',label:'Passion brûlante pour son travail',offset:14,kind:'situation' as const,description:'Ce colon exerce une compétence pour laquelle il a une passion brûlante. La pensée dure le temps du travail effectif.'}),
]);

/** The skill of a map job's work toil: JobDriver_Mine (Mining); PlantWork,
 * PlantSow and ExtractTree (Plants; a plant cut out of a construction site is
 * PlantWork too); ConstructFinishFrame, AffectFloor, AffectRoof,
 * RemoveBuilding, Repair, FixBrokenDownBuilding and SmoothWall (Construction).
 * Flick and Replant have none. An installation follows the construction
 * skill that the local install already uses (learning and speed). */
function jobSkill(job:Job):BackgroundSkillId|undefined {
  if(job.clearance)return 'plants';
  switch(job.kind){
    case 'mine':return 'mining';
    case 'chop':case 'harvest':case 'cut':case 'sow':case 'extract-tree':return 'plants';
    case 'flick':case 'replant-tree':return undefined;
    case 'repair':case 'fix-breakdown':case 'smooth-floor':return 'construction';
  }
  return usesConstructionSkill(job)?'construction':undefined;
}

/** JobDriver.ActiveSkill of the pawn's current activity, or undefined.
 * Combat: an explicit or responding attack (AttackStatic with a ranged
 * weapon: Shooting; AttackMelee and its social, berserk and retaliation
 * forms: Melee) and a hunter's shot (CastVerb, not the walk to the firing
 * position). A drafted pawn's automatic fire or blow comes from its Wait job
 * and has no active skill. Work, at its work phase only: a bill
 * (Toils_Recipe: the recipe's workSkill), research (Intellectual), tending a
 * person or an animal and surgery (Medicine), a prisoner chat and its final
 * recruit attempt (Social),
 * taming and training except while feeding, milking and shearing (Animals),
 * a deep drill (Mining) or a ground scanner (Intellectual), and the map jobs
 * above. Reading, recreation, hauling, cleaning, firefighting, feeding,
 * burial, slaughter and leading an animal have none. */
export function activeSkill345(world:World,pawn:Pawn):BackgroundSkillId|undefined {
  if(pawn.state==='dead'||pawn.state==='downed'||pawn.state==='sleeping'||pawn.medicalSleep)return;
  const shot=pawn.shooting?.order;
  if(shot&&shot.auto?.kind!=='draft'&&(!shot.hunt||pawn.shooting!.stance))return 'shooting';
  const blow=pawn.melee?.order;
  if(blow&&blow.auto!=='draft')return 'melee';
  if(pawn.state!=='working'||pawn.haul)return;
  const cooking=pawn.cooking;
  if(cooking)return cooking.phase==='work'?productionRecipeSkill283(taskRecipe(cooking))??undefined:undefined;
  if(pawn.research)return pawn.x===pawn.research.spot.x&&pawn.z===pawn.research.spot.z?'intellectual':undefined;
  if(pawn.tend)return pawn.tend.phase==='tend'?'medicine':undefined;
  if(pawn.animalCare)return pawn.animalCare.phase==='treat'?'medicine':undefined;
  if(pawn.surgery)return pawn.surgery.phase==='work'?'medicine':undefined;
  // ConvinceRecruitee and the closing TryRecruit wait (its effect precedes it); not the approach.
  if(pawn.ward)return pawn.ward.kind==='chat'&&(pawn.ward.phase==='rapport'||pawn.ward.phase==='closing')?'social':undefined;
  const handling=pawn.animalHandling;
  if(handling){
    if(handling.phase!=='interact')return;
    if(handling.kind==='milk'||handling.kind==='shear')return 'animals';
    // JobDriver_InteractAnimal: talking and the final attempt, not the feed toils.
    if(handling.kind==='tame'||handling.kind==='maintain'||handling.kind==='train')return handling.step===2||handling.step===4?undefined:'animals';
    return;
  }
  if(pawn.deepWork)return pawn.x===pawn.deepWork.spot.x&&pawn.z===pawn.deepWork.spot.z?pawn.deepWork.kind==='drill'?'mining':'intellectual':undefined;
  if(pawn.jobId===null)return;
  const job=world.jobs.find(j=>j.id===pawn.jobId);
  return job&&jobSkill(job);
}

/** A skill this pawn cannot use (its background) never carries a passion. */
export function passionateWorkThought345(world:World,pawn:Pawn):MoodThought|undefined {
  const skill=activeSkill345(world,pawn);if(!skill||backgroundSkillRefusal(pawn,skill))return;
  const passion=pawn.skills[skill]?.passion??0;
  return passion?THOUGHTS[passion-1]:undefined;
}
