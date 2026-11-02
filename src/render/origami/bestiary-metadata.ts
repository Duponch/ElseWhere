// New bestiary source-part annotations only; no source vertices or transforms changed.
import type * as Three from 'three/webgpu';
import type {BestiaryGroup,ThreeAPI} from './bestiary-types';
const HEAD_ROLES:Readonly<Record<string,readonly string[]>>={
 thrumbo:['neck','head','horn','eye','eye'],boomalope:['head','eye','ear','eye','ear'],boomrat:['head','eye','ear','eye','ear'],
 megasloth:['head','nose'],megaspider:['head','jaw','eye','jaw','eye'],spelopede:['head','jaw','eye','jaw','eye'],
 warg:['head','jaw','eye','tusk','ear','eye','tusk','ear'],grizzly:['head','jaw','nose','eye','ear','eye','ear'],polar_bear:['head','jaw','nose','eye','ear','eye','ear'],
 cougar:['head','jaw','eye','ear','eye','ear'],panther:['head','jaw','eye','ear','eye','ear'],lynx:['head','jaw','eye','ear','eye','ear'],
 timber_wolf:['head','jaw','nose','eye','ear','ear','eye','ear','ear'],fennec:['head','jaw','nose','eye','ear','ear','eye','ear','ear'],
 bison:['head','horn','horn'],yak:['head','horn','horn'],rhino:['head','horn','horn'],horse:['neck','head','ear','ear'],donkey:['neck','head','ear','ear'],alpaca:['neck','head','ear','ear'],
 caribou:['neck','head','nose','eye','ear','horn','eye','ear','horn'],ibex:['head','horn','horn'],boar:['head','tusk','tusk'],
 ostrich:['neck','head','beak'],emu:['neck','head','beak'],cassowary:['neck','head','beak','head'],turkey:['neck','head','beak','head'],chicken:['neck','head','beak','head'],duck:['neck','head','beak'],
 tortoise:['head'],iguana:['head'],cobra:['head'],capybara:['head'],chinchilla:['head'],raccoon:['head'],squirrel:['head'],guinea_pig:['head'],
};
export function annotateSourceAnimal(THREE:ThreeAPI,id:string,root:BestiaryGroup,sourceHeadChildren:readonly Three.Object3D[]):void {
 const roles=HEAD_ROLES[id];if(!roles||roles.length!==sourceHeadChildren.length)throw Error('Changed literal head topology: '+id);
 sourceHeadChildren.forEach((part,index)=>{
  let role=roles[index];if(role==='eye'||role==='ear'||role==='tusk')role=`${part.position.z>0?'left':'right'}-${role}`;
  part.userData.referenceAnatomyRole=role;
 });
 const direct=root.children.filter(part=>part instanceof THREE.Mesh);
 direct.forEach((part,index)=>{part.userData.referenceAnatomyRole=(id==='megaspider'||id==='spelopede')?(index===0?'pronotum':'shell'):'torso';});
 if(id==='iguana'&&direct[1])direct[1].userData.referenceAnatomyRole='tail';
 if(['ostrich','emu','cassowary','turkey','chicken','duck'].includes(id)){
  direct.slice(1,3).forEach(part=>{part.userData.referenceAnatomyRole=`${part.position.z>0?'left':'right'}-wing`;});
  if(id==='turkey'&&direct[3])direct[3].userData.referenceAnatomyRole='tail';
 }
 root.userData.tailGroup?.traverse(part=>{part.userData.referenceAnatomyRole='tail';});
 root.userData.legs.forEach((limb,index)=>{limb.userData.referenceLimbOrdinal=index;limb.userData.referenceLimbKind='leg';});
}
