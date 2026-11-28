import {tempMapModern261} from './temp-map-incidents-261.ts';
import {enableCassandraRaids} from './cassandra-raids.ts';
import {enableVisitors} from './visitors.ts';
import {storytellerIncidents347} from './game-profile.ts';
import type {World} from './types.ts';

/** Existing local producers and private calendar streams, one global clock
 * and Thing allocator. Calling this never creates an incident or an actor. */
export function adoptSecondaryIncidents(world:World):void {
  if(tempMapModern261(world)||world.schemaVersion<242||!world.expeditionSite||!storytellerIncidents347(world))return;
  if(!world.raids)enableCassandraRaids(world,true);
  if(!world.visitors)enableVisitors(world,false,true);
}
