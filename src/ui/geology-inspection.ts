import { ORE_DEFINITIONS } from '../sim/ore';
import { ITEM_DEFINITIONS } from '../sim/items';
import { rockMaxHP } from '../sim/mining-rules';
import { STONE_LABELS } from '../sim/geology';
import {isSmoothedStone281,smoothedStoneLabel281} from '../sim/smooth-floor-terrain-281';
import {smoothedWallLabel367,smoothedWallDescription367,SMOOTHED_WALL_BEAUTY_367} from '../sim/smooth-wall-367';
import {isRockBeautySchema373,ROUGH_ROCK_BEAUTY_373,roughRockBeauty373,signedBeauty373} from '../sim/rock-beauty-373';
import type { Resource, Tile } from '../sim/types';

/** The rock Thing's own name, as Core's inspect pane title and mouseover line
 * (`Thing.LabelCap`): the stone (`Granite`), the ore (`MineableSteel`
 * « compacted steel »), the smoothed wall or the collapsed rocks. */
export function rockThingLabel(tile: Tile): string {
  if (tile.collapsedRock) return 'Roches effondrées';
  if (tile.smoothedWall367) return smoothedWallLabel367(tile.stone);
  if (tile.ore) return ORE_DEFINITIONS[tile.ore].label;
  return tile.stone ? STONE_LABELS[tile.stone] : 'Massif rocheux';
}

/** `version`: the schema of the inspected game; from 373 the walls tell the
 * Beauty they give the room they border (absent: no Beauty line). */
export function rockInspection(tile: Tile, resource?: Resource, version?: number): { title: string; description: string } | null {
  const v373=version!==undefined&&isRockBeautySchema373(version);
  if (resource?.kind === 'rock') return {
    title: resource.stone ? `Rochers · ${STONE_LABELS[resource.stone]}` : 'Rochers · type historique non défini',
    description: 'Pierres au sol encore non transportables. La quantité de matériau exploitable n’est pas encore définie.',
  };
  if(!resource&&isSmoothedStone281(tile.terrain)&&!tile.floor)return {title:smoothedStoneLabel281(tile.stone),description:'Sol non fertile lissé dans la roche. Supporte les constructions ; peut être recouvert, sans retrait direct de la roche lissée.'};
  if (resource || tile.terrain !== 'rock' && tile.terrain !== 'rough-stone') return null;
  if(tile.terrain==='rough-stone')return {title:`Sol rocheux brut${tile.stone?' · '+STONE_LABELS[tile.stone]:''}`,description:'Sol non fertile. Supporte les constructions ; une roche connue et découverte peut être lissée.'};
  if(tile.smoothedWall367){const description=smoothedWallDescription367(tile,rockMaxHP(tile));return {title:smoothedWallLabel367(tile.stone),description:v373&&tile.stone?`${description} Avant lissage, la roche brute comptait ${signedBeauty373(ROUGH_ROCK_BEAUTY_373[tile.stone])}.`:description};}
  const rough=v373?roughRockBeauty373(tile,version!):0;
  if(tile.ore){const ore=ORE_DEFINITIONS[tile.ore];return {title:ore.label,description:`${rockMaxHP(tile)-(tile.miningDamage??0)} / ${rockMaxHP(tile)} PV. Extraction : ${ore.yield} ${ITEM_DEFINITIONS[ore.item].label.toLowerCase()} à rendement neutre, déposés sur le sol découvert.`};}
  return {
    title: tile.stone ? `Massif · ${STONE_LABELS[tile.stone]}` : 'Massif rocheux · type historique non défini',
    description: `Roche : ${rockMaxHP(tile)-(tile.miningDamage??0)} / ${rockMaxHP(tile)} PV. Miner révèle le sol rocheux ; 25 % de chance de laisser un fragment.${rough!==0&&tile.stone?` Beauté ${signedBeauty373(rough)} pour la pièce qu’elle borde ; lissée, elle compterait ${SMOOTHED_WALL_BEAUTY_367[tile.stone]}.`:''}`,
  };
}
