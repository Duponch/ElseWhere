import type {AwayGroup} from '../sim/group-capture';
import type {World} from '../sim/types';

/** The colony's caravans away on the world map (Core Caravan): every group of
 * the world registry that holds its members and is not inside a local map, or
 * the single group of a campaign from before the registry. Groups still being
 * formed or unloading on a map are not caravans yet or any more. */
export function worldCaravans(world:World):{group:AwayGroup;record?:NonNullable<World['worldGroups']>['groups'][number]}[] {
  if(world.worldGroups)return world.worldGroups.groups.flatMap(record=>record.localMapId===null&&'members' in record.state?[{group:record.state,record}]:[]);
  const g=world.group;return g&&'members' in g?[{group:g}]:[];
}
