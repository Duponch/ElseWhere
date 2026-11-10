import { invalidateTerrainJournal } from './terrain-mutation-journal.ts';
import { createScenarioWorld } from './new-game.ts';
import { startingPawn } from './starting-pawns.ts';
import { startingSkills, type SkillRecord } from './skills.ts';
import { assignBackground } from './background-generation.ts';
import { backgroundWorkRefusal, type ColonistBackground } from './colonist-backgrounds.ts';
import { HUMAN_YEAR_TICKS } from './human-age.ts';
import { tryAddRelationship } from './relationship-runtime.ts';
import { isHabitatFurnitureKind } from './furniture-stats.ts';
import { footprintCells } from './definitions.ts';
import { builtDoorState } from './door-rules.ts';
import { isElectrical, newPowerState } from './power-rules.ts';
import { isPowerTransmitter } from './power-grid.ts';
import { reconcilePower } from './power.ts';
import { BATTERY_ENERGY_SCALE, newBatteryState } from './power-battery.ts';
import { newCoolerState } from './cooler.ts';
import { newHeaterState } from './heater.ts';
import { adoptWind, newWindTurbineState } from './wind.ts';
import { newMiniTurretState } from './mini-turret-state.ts';
import { createFlowerPotState } from './flower-pot.ts';
import { isFueledBuilding, newBuildingFuel, WOOD_BURN_TICKS } from './fuel.ts';
import { newCookingBill } from './cooking-bills.ts';
import { stationRecipe, type ProductionRecipe } from './production-recipes.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { APPAREL, type ApparelItem } from './apparel-rules.ts';
import { DEFAULT_APPAREL_POLICY } from './apparel-policy.ts';
import { createPlantLife } from './plant-life.ts';
import { PLANT_DEFINITIONS } from './plants.ts';
import { adultAgeTicks, animalNutritionMax } from './animal-life.ts';
import { type WildAnimal } from './wildlife-state.ts';
import { createPrisonerState } from './prisoner-state.ts';
import { addResolvedInjury, createMedicalRecord } from './injury-state.ts';
import { HP_UNIT } from './injury-rules.ts';
import { generatePlanet, planetHomeInput } from './planet-generation.ts';
import { adoptColonyEconomy } from './colony-economy.ts';
import { researchCost, RESEARCH_SCALE, type ResearchProject } from './research.ts';
import type { FloorKind } from './flooring.ts';
import type { Cell, Pawn, Resource, StorageFilters, Structure, World } from './types.ts';

export const ADVANCED_COLONY_SCENARIO_ID = 'advanced-colony-v223';

/** A new authored 250² colony, not a resized V221 payload or a played history.
 * People, links, buildings, goods, technologies, crop maturity and the captive
 * below are declared initial conditions. The publisher advances ordinary ticks
 * afterwards: no research result, trade, recruitment or journey is preplayed.
 */
export function prepareAdvancedColonyScenario(): World {
  const world = createScenarioWorld(223350, 250, 'crashlanded', {
    biome: 'temperate-forest', hilliness: 'small-hills',
  });
  const indexOf = (cell: Cell): number => cell.z * world.width + cell.x;
  const cells = (minX: number, minZ: number, maxX: number, maxZ: number): Cell[] => {
    const result: Cell[] = [];
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) result.push({ x, z });
    return result;
  };
  // Only the actual settlement parcels and access lanes are landscaped. The
  // normal map's natural ecology, water, hills and mineral deposits survive.
  const landscaped = new Set<number>();
  for (const rectangle of [
    [101, 86, 155, 105], [156, 91, 158, 109], [158, 84, 172, 112], [106, 110, 158, 133],
    [158, 113, 170, 128], [171, 118, 177, 124],
    [107, 134, 155, 158], [157, 134, 182, 159], [183, 145, 191, 164],
    [69, 78, 97, 106], [69, 109, 104, 144], [77, 144, 104, 159],
    [98, 79, 101, 106], [97, 106, 172, 109], [104, 105, 106, 160],
    [117, 105, 119, 159], [134, 105, 136, 160], [154, 105, 158, 161],
    [105, 159, 175, 167], [127, 133, 129, 158], [98, 151, 107, 153],
  ] as const) for (const cell of cells(rectangle[0], rectangle[1], rectangle[2], rectangle[3])) landscaped.add(indexOf(cell));
  world.resources = world.resources.filter(resource => !landscaped.has(indexOf(resource)));
  for (const index of landscaped) {
    const original = world.tiles[index]!;
    world.tiles[index] = { terrain: original.terrain === 'rich-soil' ? 'rich-soil' : 'grass' };
  }
  // Tile replacements are terrain writes: caches keyed by the write count see them.
  if (landscaped.size) invalidateTerrainJournal(world.tiles);
  world.structures = []; world.jobs = []; world.packed = []; world.stockpiles = [];
  world.growingZones = []; world.growingCursor = 0; world.events = [];
  world.piles = world.piles.filter(pile => pile.owner.type === 'apparel');
  delete world.relationships;
  if (world.scenario) world.scenario.landing = { x: 129, z: 122 };

  const roofs = new Set<number>(), home = new Set<number>(), occupied = new Set<number>();
  const building = (kind: Structure['kind'], x: number, z: number, options: Partial<Structure> = {}): Structure => {
    const structure: Structure = { id: world.nextId++, kind, x, z, orientation: 0,
      footprint: 'standard', material: 'wood', ...options };
    if (isHabitatFurnitureKind(kind)) structure.quality ??= 'normal';
    if (isElectrical(kind)) { structure.material = 'steel'; structure.power = newPowerState(kind); }
    if (kind === 'door' || kind === 'autodoor' || kind === 'fence-gate') structure.door = builtDoorState(world, structure);
    if (isFueledBuilding(kind)) structure.fuel = newBuildingFuel(kind);
    if (kind === 'battery') { structure.battery = newBatteryState(); structure.battery.stored = 250 * BATTERY_ENERGY_SCALE; }
    if (kind === 'cooler') structure.cooler = newCoolerState();
    if (kind === 'heater') structure.heater = newHeaterState();
    if (kind === 'wind-turbine') structure.wind = newWindTurbineState();
    if (kind === 'mini-turret') structure.turret = newMiniTurretState();
    if (kind === 'flower-pot') structure.flower = createFlowerPotState();
    if (kind === 'crafting-spot') delete structure.material;
    if (stationRecipe(structure)) structure.bills = [];
    for (const cell of footprintCells(structure)) {
      const index = indexOf(cell);
      if (kind !== 'power-conduit' && occupied.has(index)) throw new Error(`Prepared building overlap at ${cell.x},${cell.z}`);
      if (['water', 'rock'].includes(world.tiles[index]?.terrain ?? 'rock')) throw new Error('Prepared building on impassable terrain.');
      if (kind !== 'power-conduit') occupied.add(index);
      home.add(index);
    }
    world.structures.push(structure); return structure;
  };
  const room = (minX: number, minZ: number, maxX: number, maxZ: number, entrances: readonly Cell[],
    material: Structure['material'] = 'granite-blocks', floor: FloorKind | null = 'granite-tile', automatic = false): void => {
    for (const cell of cells(minX, minZ, maxX, maxZ)) {
      const index = indexOf(cell); home.add(index);
      if (cell.x === minX || cell.x === maxX || cell.z === minZ || cell.z === maxZ) {
        const entrance = entrances.some(door => door.x === cell.x && door.z === cell.z);
        building(entrance ? automatic ? 'autodoor' : 'door' : 'wall', cell.x, cell.z, { material: entrance ? 'wood' : material });
      } else { roofs.add(index); if (floor) world.tiles[index]!.floor = floor; }
    }
  };
  const skill = (level: number, passion: SkillRecord['passion'] = 1): SkillRecord => ({ level, passion, xp: 0, dailyXp: 0 });
  const bedroomBeds: Structure[][] = [];
  for (const row of [0, 1]) for (let column = 0; column < 6; column++) {
    const x = 102 + column * 9, z = row === 0 ? 87 : 97;
    const double = row === 0 && column === 0 || row === 1 && column === 4;
    room(x, z, x + 7, z + 7, [{ x: x + 3, z: row === 0 ? z + 7 : z }],
      column % 2 === 0 ? 'wood' : 'granite-blocks', column % 2 === 0 ? 'wood-planks' : 'granite-tile');
    const quality = column === 4 ? 'excellent' : column % 3 === 0 ? 'good' : 'normal';
    const beds = [building('bed', x + 2, z + 2, { quality })];
    if (double) beds.push(building('bed', x + 5, z + 2, { quality }));
    bedroomBeds.push(beds);
    building('end-table', x + 3, z + 2, { quality: 'good' });
    building('dresser', x + 4, z + 5, { orientation: 1 });
    building('flower-pot', x + 6, z + 6);
    building('standing-lamp', x + 1, z + 1);
    const heater = building('heater', x + 1, z + 6); heater.heater!.target = 19;
  }
  const assignedBeds = [bedroomBeds[0]![0]!, bedroomBeds[0]![1]!, ...bedroomBeds.slice(1, 10).map(beds => beds[0]!),
    bedroomBeds[10]![0]!, bedroomBeds[10]![1]!, bedroomBeds[11]![0]!];
  const residents: readonly { name: string; years: number; background: ColonistBackground; work: Partial<Pawn['priorities']> }[] = [
    { name: 'Ada', years: 43, background: { childhood: 'workshop-child', adulthood: 'builder' }, work: { build: 1, craft: 3 } },
    { name: 'Noé', years: 41, background: { childhood: 'field-child', adulthood: 'farmer' }, work: { grow: 1, handle: 2, gather: 2 } },
    { name: 'Mina', years: 45, background: { childhood: 'school-child', adulthood: 'medic' }, work: { doctor: 1, clean: 2, cook: 3 } },
    { name: 'Iris', years: 37, background: { childhood: 'school-child', adulthood: 'researcher' }, work: { research: 1, doctor: 3 } },
    { name: 'Sacha', years: 48, background: { childhood: 'workshop-child', adulthood: 'artisan' }, work: { craft: 1, build: 2 } },
    { name: 'Léonie', years: 40, background: { childhood: 'school-child', adulthood: 'merchant' }, work: { warden: 1, haul: 2, clean: 2 } },
    { name: 'Tao', years: 29, background: { childhood: 'field-child', adulthood: 'mercenary' }, work: { hunt: 1, mine: 2, gather: 3 } },
    { name: 'Émile', years: 35, background: { childhood: 'workshop-child', adulthood: 'artisan' }, work: { craft: 1, haul: 2 } },
    { name: 'Alma', years: 31, background: { childhood: 'field-child', adulthood: 'farmer' }, work: { grow: 1, gather: 2 } },
    { name: 'Nils', years: 38, background: { childhood: 'field-child', adulthood: 'hermit' }, work: { handle: 1, grow: 2 } },
    { name: 'Salomé', years: 33, background: { childhood: 'settlement-child', adulthood: 'artisan' }, work: { cook: 1, clean: 2 } },
    { name: 'Basile', years: 44, background: { childhood: 'quiet-child', adulthood: 'artisan' }, work: { art: 1, craft: 2 } },
    { name: 'Rose', years: 42, background: { childhood: 'sheltered-child', adulthood: 'medic' }, work: { doctor: 1, haul: 2, clean: 2 } },
    { name: 'Marin', years: 25, background: { childhood: 'workshop-child', adulthood: 'builder' }, work: { mine: 1, haul: 1, build: 2 } },
  ];
  world.foodPolicies.push({ id: 5, name: 'Quotidien · rations réservées', allowed: ['simple-meal', 'fine-meal', 'vegetarian-fine-meal',
    'carnivore-fine-meal', 'lavish-meal', 'vegetarian-lavish-meal', 'carnivore-lavish-meal'] });
  world.nextFoodPolicyId = 6;
  const civilianItems = (Object.keys(APPAREL) as ApparelItem[]).filter(item => APPAREL[item].family !== undefined);
  if (!world.apparelPolicies) throw new Error('The new colony did not generate its apparel policy registry.');
  world.apparelPolicies.push({ ...DEFAULT_APPAREL_POLICY, id: 3, label: 'Tenue civile entretenue', allowedItems: civilianItems,
    allowedMaterials: [...DEFAULT_APPAREL_POLICY.allowedMaterials], minHitPointsPercent: .51 });
  world.apparelPolicies.push({ ...DEFAULT_APPAREL_POLICY, id: 4, label: 'Défense entretenue',
    allowedItems: [...DEFAULT_APPAREL_POLICY.allowedItems], allowedMaterials: [...DEFAULT_APPAREL_POLICY.allowedMaterials], minHitPointsPercent: .51 });
  world.nextApparelPolicyId = 5;
  const defenders = new Set([0, 1, 4, 6, 8, 13]);
  for (const [index, resident] of residents.entries()) {
    const bed = assignedBeds[index]!;
    const position = index === 0 ? { x: 129, z: 122 } : { x: bed.x + 1, z: bed.z + 2 };
    const pawn = world.pawns[index] ?? startingPawn(world.nextId++, resident.name, position.x, position.z, index, 66, world.seed);
    if (!world.pawns.includes(pawn)) world.pawns.push(pawn);
    pawn.name = resident.name; Object.assign(pawn, position);
    pawn.age = { biologicalTicks: resident.years * HUMAN_YEAR_TICKS,
      chronologicalTicks: (resident.years + (index < 3 ? 240 : 0)) * HUMAN_YEAR_TICKS };
    delete pawn.health; delete pawn.background; pawn.skills = startingSkills(index);
    if (index === 4 || index === 7) pawn.skills.crafting = skill(index === 4 ? 8 : 6, 2);
    if (index === 10) pawn.skills.cooking = skill(10, 2);
    if (index === 11) pawn.skills.artistic = skill(8, 2);
    if (index === 5) pawn.skills.social = skill(5, 2);
    assignBackground(pawn, resident.background);
    pawn.traits = index === 2 || index === 12 ? ['steadfast', 'kind'] : index === 3 ? ['fast-learner', 'nervous']
      : index === 6 ? ['steadfast'] : index === 11 ? ['optimist', 'kind'] : ['optimist'];
    pawn.hunger = 80 + index % 5 * 3; pawn.rest = 82 + index % 4 * 3;
    pawn.mood = 70 + index % 6 * 2; pawn.recreation.level = 56 + index % 5 * 5;
    pawn.foodPolicyId = 5; pawn.apparelPolicyId = defenders.has(index) ? 4 : 3; pawn.bedId = bed.id;
    for (const work of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[]) pawn.priorities[work] = 0;
    Object.assign(pawn.priorities, { patient: 1, bedrest: 2, firefight: 1, basic: 2, haul: 3, clean: 3 }, resident.work);
    for (const work of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[]) if (backgroundWorkRefusal(pawn, work)) pawn.priorities[work] = 0;
    if (index >= 3) addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: pawn.id }, 'cloth-shirt');
    addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: pawn.id }, 'cloth-pants');
  }
  for (const [kind, aIndex, bIndex] of [['spouse', 0, 1], ['spouse', 11, 12], ['sibling', 2, 3]] as const) {
    const aId = world.pawns[aIndex]!.id, bId = world.pawns[bIndex]!.id;
    if (!tryAddRelationship(world, { kind, aId: Math.min(aId, bId), bId: Math.max(aId, bId), recordedAt: 0 }))
      throw new Error('Prepared family graph is invalid.');
  }
  for (const [index, item] of [[0, 'revolver'], [1, 'bolt-action-rifle'], [4, 'plasteel-knife'],
    [6, 'bolt-action-rifle'], [8, 'revolver'], [13, 'bolt-action-rifle']] as const)
    addMaterial(world, 'weapon', 1, { type: 'equipment', pawnId: world.pawns[index]!.id }, item);
  for (const index of [0, 4, 6, 13]) addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: world.pawns[index]!.id }, 'flak-vest');
  for (const index of [0, 4, 13]) addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: world.pawns[index]!.id }, 'flak-helmet');
  addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: world.pawns[6]!.id }, 'recon-helmet');
  for (const [index, item] of [[0, 'cloth-duster'], [1, 'plainleather-duster'], [6, 'cloth-duster'],
    [8, 'cloth-duster'], [9, 'muffalo-wool-parka'], [13, 'plainleather-duster']] as const)
    addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: world.pawns[index]!.id }, item);

  room(159, 96, 169, 111, [{ x: 159, z: 103 }], 'granite-blocks', 'granite-tile', true);
  for (const cell of [{ x: 161, z: 98 }, { x: 165, z: 98 }, { x: 161, z: 105 }])
    building('hospital-bed', cell.x, cell.z, { material: 'steel', quality: 'good', medical: true });
  building('bed', 165, 105, { material: 'steel', medical: true });
  building('heater', 168, 104); building('standing-lamp', 160, 97); building('standing-lamp', 168, 110);
  room(159, 85, 164, 93, [{ x: 161, z: 93 }]);
  room(166, 85, 171, 93, [{ x: 168, z: 93 }]);
  const prisonBed = building('bed', 161, 87, { prisoner: true });
  building('bed', 168, 87, { prisoner: true, medical: true });
  building('table', 163, 89); building('stool', 162, 90); building('standing-lamp', 160, 86);
  building('table', 170, 89); building('stool', 169, 90); building('standing-lamp', 167, 86);
  const prisoner = startingPawn(world.nextId++, 'Dorian', 162, 89, 2, 55, world.seed);
  prisoner.age = { biologicalTicks: 32 * HUMAN_YEAR_TICKS, chronologicalTicks: 32 * HUMAN_YEAR_TICKS };
  delete prisoner.health; delete prisoner.background; prisoner.skills = startingSkills(2);
  assignBackground(prisoner, { childhood: 'settlement-child', adulthood: 'builder' });
  prisoner.faction = 'outlaws'; prisoner.foodPolicyId = 5; prisoner.bedId = prisonBed.id;
  prisoner.prisoner = { ...createPrisonerState(world, prisoner), mode: 'reduce' };
  prisoner.hunger = 86; prisoner.rest = 86; prisoner.mood = 65;
  delete prisoner.apparelPolicyId; delete prisoner.apparelAutomation; delete prisoner.nextApparelCheckAt;
  for (const work of Object.keys(prisoner.priorities) as (keyof Pawn['priorities'])[]) prisoner.priorities[work] = 0;
  prisoner.health = createMedicalRecord();
  addResolvedInjury(prisoner.health, 'left-arm', 'bruise', 4 * HP_UNIT, () => .99);
  world.pawns.push(prisoner);
  addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: prisoner.id }, 'cloth-shirt');
  addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: prisoner.id }, 'cloth-pants');

  room(107, 111, 117, 130, [{ x: 112, z: 111 }, { x: 117, z: 126 }], 'granite-blocks', 'granite-tile', true);
  building('hi-tech-research-bench', 111, 115); building('hi-tech-research-bench', 111, 124);
  building('multi-analyzer', 112, 119); building('standing-lamp', 108, 113); building('standing-lamp', 116, 127);
  room(119, 111, 134, 132, [{ x: 126, z: 111 }, { x: 134, z: 124 }, { x: 126, z: 132 }], 'marble-blocks', 'marble-tile');
  // A real pillar supports the wide salon's central roof cells (6.9 radius).
  building('wall', 126, 121, { material: 'marble-blocks' }); roofs.delete(indexOf({ x: 126, z: 121 }));
  building('tube-television', 125, 114);
  for (const z of [116, 117]) for (const x of [124, 125, 126]) building('armchair', x, z, { material: 'cloth', quality: 'good' });
  building('chess-table', 127, 126); building('dining-chair', 126, 126, { orientation: 1 }); building('dining-chair', 128, 126, { orientation: 3 });
  building('table-square', 122, 123, { gatherSpot: true, quality: 'good' });
  building('dining-chair', 121, 123, { orientation: 1 }); building('dining-chair', 124, 123, { orientation: 3 });
  building('small-sculpture', 131, 114, { material: 'marble-blocks', quality: 'good', art: { authorId: world.pawns[11]!.id, createdAt: 0 } });
  building('large-sculpture', 131, 129, { material: 'wood', quality: 'normal', art: { authorId: world.pawns[11]!.id, createdAt: 0 } });
  building('flower-pot', 120, 112); building('flower-pot', 133, 131); building('heater', 120, 129);
  building('standing-lamp', 120, 119); building('standing-lamp', 133, 120); building('horseshoes', 130, 107);

  room(137, 110, 146, 119, [{ x: 141, z: 119 }]);
  const coolerWall = world.structures.find(structure => structure.kind === 'wall' && structure.x === 137 && structure.z === 114)!;
  world.structures.splice(world.structures.indexOf(coolerWall), 1); occupied.delete(indexOf(coolerWall));
  const cooler = building('cooler', 137, 114, { orientation: 1 }); cooler.cooler!.target = -5;
  const secondCoolerWall = world.structures.find(structure => structure.kind === 'wall' && structure.x === 146 && structure.z === 114)!;
  world.structures.splice(world.structures.indexOf(secondCoolerWall), 1); occupied.delete(indexOf(secondCoolerWall));
  const secondCooler = building('cooler', 146, 114, { orientation: 3 }); secondCooler.cooler!.target = -5;
  room(148, 110, 157, 119, [{ x: 152, z: 119 }], 'granite-blocks', 'granite-tile', true);
  const stove = building('electric-stove', 152, 114, { orientation: 0 });
  const secondStove = building('electric-stove', 152, 117, { orientation: 0 });
  building('standing-lamp', 149, 111);
  room(137, 121, 157, 132, [{ x: 141, z: 121 }, { x: 152, z: 121 }, { x: 137, z: 127 }, { x: 150, z: 132 }], 'granite-blocks', 'marble-tile');
  for (const x of [141, 150]) {
    building('table-long', x, 125, { quality: 'good', gatherSpot: true });
    for (let z = 125; z <= 128; z++) { building('dining-chair', x - 1, z, { orientation: 1 }); building('dining-chair', x + 2, z, { orientation: 3 }); }
  }
  building('standing-lamp', 138, 122); building('standing-lamp', 156, 131); building('flower-pot', 147, 131);
  room(159, 114, 169, 127, [{ x: 159, z: 121 }]);
  const butcher = building('butcher-table', 163, 117);
  const backupStove = building('fueled-stove', 163, 124, { material: 'steel' });
  backupStove.fuel!.ticks = 35 * WOOD_BURN_TICKS; building('standing-lamp', 168, 115);

  room(108, 135, 120, 144, [{ x: 116, z: 135 }, { x: 120, z: 140 }], 'granite-blocks', 'granite-tile', true);
  const machine = building('machining-table', 113, 139);
  room(122, 135, 134, 144, [{ x: 128, z: 135 }, { x: 134, z: 140 }], 'granite-blocks', 'granite-tile', true);
  const fabrication = building('fabrication-bench', 128, 139);
  room(108, 146, 120, 154, [{ x: 116, z: 146 }, { x: 120, z: 150 }]);
  const tailor = building('electric-tailor-bench', 113, 149);
  building('tailor-bench', 116, 152);
  room(122, 146, 134, 154, [{ x: 128, z: 146 }, { x: 134, z: 150 }]);
  const artBench = building('art-bench', 126, 149), stonecutter = building('stonecutter', 130, 152);
  building('crafting-spot', 123, 152);
  for (const cell of [{ x: 109, z: 136 }, { x: 123, z: 136 }, { x: 109, z: 147 }, { x: 123, z: 147 }]) building('standing-lamp', cell.x, cell.z);
  room(136, 135, 144, 157, [{ x: 136, z: 140 }, { x: 136, z: 150 }, { x: 140, z: 135 }]);
  room(146, 135, 154, 157, [{ x: 150, z: 135 }, { x: 150, z: 157 }]);
  building('standing-lamp', 137, 136); building('standing-lamp', 147, 136);

  // Protected power hub; solar/wind footprints and their clearance stay outside
  // every roof. These ordinary finite stores are part of the dotation.
  adoptWind(world);
  room(158, 135, 170, 144, [{ x: 158, z: 140 }]);
  for (const cell of [{ x: 160, z: 138 }, { x: 164, z: 138 }, { x: 168, z: 138 }, { x: 160, z: 141 }, { x: 164, z: 141 }]) {
    const generator = building('wood-generator', cell.x, cell.z); generator.fuel!.ticks = 75 * WOOD_BURN_TICKS;
  }
  room(158, 146, 170, 153, [{ x: 158, z: 149 }]);
  for (const x of [160, 163, 166, 169]) building('battery', x, 149);
  for (const cell of [{ x: 173, z: 137 }, { x: 178, z: 137 }, { x: 173, z: 142 }, { x: 178, z: 142 }]) building('solar-generator', cell.x, cell.z);
  const wind = building('wind-turbine', 187, 152); wind.wind!.autoCut = true;
  building('power-switch', 185, 150); building('standing-lamp', 159, 136);
  room(91, 146, 103, 158, [{ x: 91, z: 152 }], 'granite-blocks', null);
  building('sun-lamp', 97, 152); building('heater', 102, 152);
  room(82, 145, 88, 151, [{ x: 88, z: 149 }]);
  const greenhouseGenerator = building('wood-generator', 84, 148); greenhouseGenerator.fuel!.ticks = 75 * WOOD_BURN_TICKS;
  building('battery', 83, 146); building('battery', 86, 146);
  building('solar-generator', 78, 153); building('solar-generator', 84, 153);

  for (const cell of [{ x: 112, z: 162 }, { x: 148, z: 162 }, { x: 105, z: 123 }, { x: 173, z: 121 }]) {
    building('mini-turret', cell.x, cell.z);
    const south = cell.z === 162;
    for (const offset of [-1, 0, 1]) building('sandbags', south ? cell.x + offset : cell.x + (cell.x < 120 ? -2 : 2),
      south ? cell.z + 2 : cell.z + offset, { material: 'cloth' });
  }

  const wires = new Set<number>();
  const wire = (minX: number, minZ: number, maxX: number, maxZ: number): void => {
    for (const cell of cells(minX, minZ, maxX, maxZ)) {
      const index = indexOf(cell); if (wires.has(index)) continue; wires.add(index);
      if (world.structures.some(structure => isPowerTransmitter(structure.kind) && footprintCells(structure).some(part => indexOf(part) === index))) continue;
      building('power-conduit', cell.x, cell.z);
    }
  };
  wire(103, 92, 169, 92); wire(103, 101, 169, 101); wire(110, 92, 110, 162);
  wire(136, 92, 136, 162); wire(157, 92, 157, 151); wire(110, 108, 169, 108);
  wire(110, 120, 174, 120); wire(110, 134, 169, 134); wire(110, 145, 169, 145);
  wire(136, 139, 181, 139); wire(136, 150, 187, 150); wire(181, 139, 181, 150);
  wire(160, 140, 165, 140); wire(169, 145, 181, 145);
  wire(187, 150, 187, 152); wire(169, 139, 169, 150); wire(110, 162, 148, 162);
  wire(105, 120, 110, 120); wire(105, 120, 105, 123);
  // This western circuit stays more than six cells from the main transmitters.
  wire(80, 149, 99, 149); wire(80, 149, 80, 154); wire(86, 149, 86, 154); wire(97, 149, 97, 152);
  wire(83, 148, 86, 148);

  const stock = (where: readonly Cell[], filters: StorageFilters, priority = 2): void => {
    for (const cell of where) world.stockpiles.push({ id: world.nextId++, ...cell, filters: { ...filters }, priority, capacity: 75 });
  };
  const foodCells = cells(138, 111, 145, 118);
  const storeCells = [...cells(138, 137, 143, 155), ...cells(148, 137, 153, 155)];
  stock(foodCells, { wood: false, food: true });
  stock(storeCells, { wood: true, food: false, steel: true, component: true, 'advanced-component': true, gold: true,
    plasteel: true, textile: true, blocks: true, chunk: true, silver: true, weapon: true, apparel: true, unfinished: true });
  const medicalCells = [{ x: 167, z: 108 }, { x: 168, z: 108 }, { x: 167, z: 109 }];
  stock(medicalCells, { wood: false, food: false, medicine: true }, 3);
  // Local ingredient shelves prevent the distant cloth bill failure found in
  // V221's first static plan, and leave stage/output/service cells unused.
  const localCells = [{ x: 118, z: 142 }, { x: 132, z: 142 }, { x: 118, z: 152 }, { x: 132, z: 147 }, { x: 167, z: 143 }];
  stock(localCells, { wood: true, food: false, steel: true, component: true, 'advanced-component': true,
    textile: true, blocks: true, gold: true, plasteel: true }, 1);
  let foodSlot = 0, storeSlot = 0;
  const put = (item: ItemId, quantity: number, location: 'food' | 'store'): void => {
    const definition = ITEM_DEFINITIONS[item];
    for (let remaining = quantity; remaining > 0;) {
      const quantityHere = Math.min(remaining, definition.stackLimit);
      const cell = location === 'food' ? foodCells[foodSlot++] : storeCells[storeSlot++];
      if (!cell) throw new Error('Prepared stockroom is full.');
      addMaterial(world, definition.kind, quantityHere, { type: 'ground', ...cell }, item); remaining -= quantityHere;
    }
  };
  for (const [item, quantity] of [['simple-meal', 60], ['fine-meal', 30], ['lavish-meal', 8], ['survival-meal', 40],
    ['rice', 600], ['corn', 350], ['potato', 300], ['deer-meat', 160], ['milk', 80]] as const) put(item, quantity, 'food');
  for (const [item, quantity] of [['wood', 1600], ['steel', 1100], ['component', 36], ['advanced-component', 4], ['plasteel', 180],
    ['gold', 30], ['silver', 2000], ['granite-blocks', 650], ['marble-blocks', 180], ['granite-chunk', 8],
    ['cloth', 400], ['muffalo-wool', 180], ['plainleather', 120], ['revolver', 1], ['bolt-action-rifle', 1],
    ['muffalo-wool-parka', 2], ['cloth-shirt', 2], ['cloth-pants', 2]] as const) put(item, quantity, 'store');
  addMaterial(world, 'medicine', 24, { type: 'ground', ...medicalCells[0]! }, 'medicine');
  addMaterial(world, 'medicine', 25, { type: 'ground', ...medicalCells[1]! }, 'herbal-medicine');
  addMaterial(world, 'medicine', 10, { type: 'ground', ...medicalCells[2]! }, 'herbal-medicine');
  addMaterial(world, 'food', 3, { type: 'ground', x: 163, z: 91 }, 'simple-meal');
  addMaterial(world, 'food', 75, { type: 'ground', x: 75, z: 82 }, 'corn');

  const bill = (station: Structure, recipe: ProductionRecipe, target: number, mode: 'until' | 'times' = 'until', radius = 32): void => {
    const prepared = newCookingBill(world.nextId++, recipe); Object.assign(prepared, { mode, target, radius });
    (station.bills ??= []).push(prepared);
  };
  bill(stove, 'cook-simple-meal-bulk', 45); bill(stove, 'cook-fine-meal-bulk', 25); bill(stove, 'cook-survival-meal', 40);
  bill(secondStove, 'cook-vegetarian-fine-meal-bulk', 12); bill(secondStove, 'lavish-meal', 8);
  bill(backupStove, 'cook-simple-meal-bulk', 30); backupStove.bills![0]!.suspended = true;
  bill(butcher, 'butcher-creature', 1, 'times'); bill(machine, 'make-bolt-action-rifle', 1, 'times');
  bill(machine, 'make-flak-vest', 1, 'times'); bill(machine, 'make-flak-helmet', 1, 'times'); bill(machine, 'shred-mechanoid', 1, 'times');
  bill(fabrication, 'make-component', 45); bill(fabrication, 'make-advanced-component', 8);
  bill(tailor, 'pants', 2, 'times'); bill(tailor, 'shirt', 2, 'times'); bill(tailor, 'duster', 2, 'times'); bill(tailor, 'parka', 1, 'times');
  bill(stonecutter, 'stone-blocks', 950); bill(artBench, 'small-sculpture', 1, 'times'); bill(artBench, 'large-sculpture', 1, 'times');

  const fields: readonly { plant: import('./crops').CropKind; rectangle: readonly [number, number, number, number]; growth: number }[] = [
    { plant: 'rice', rectangle: [70, 110, 85, 129], growth: .91 },
    { plant: 'corn', rectangle: [70, 132, 85, 143], growth: .78 },
    { plant: 'potato', rectangle: [88, 110, 103, 121], growth: .82 },
    { plant: 'cotton', rectangle: [88, 124, 103, 133], growth: .66 },
    { plant: 'healroot', rectangle: [88, 136, 97, 141], growth: .72 },
    { plant: 'rice', rectangle: [92, 147, 102, 157], growth: .64 },
  ];
  for (const field of fields) {
    const fieldCells = cells(...field.rectangle).filter(cell => !occupied.has(indexOf(cell)));
    world.growingZones.push({ id: world.nextId++, plant: field.plant, cells: fieldCells.map(indexOf), allowSow: true, allowCut: true });
    for (const [index, cell] of fieldCells.entries()) {
      const plant: Resource = { id: world.nextId++, kind: field.plant, ...cell, amount: PLANT_DEFINITIONS[field.plant].yield,
        growth: Math.max(.1, field.growth - index % 7 * .025), growthTick: 0 };
      world.resources.push({ ...plant, plantLife: createPlantLife(world, plant) });
    }
  }
  for (const cell of cells(70, 79, 96, 105)) if (cell.x === 70 || cell.x === 96 || cell.z === 79 || cell.z === 105)
    building(cell.x === 96 && cell.z === 100 ? 'fence-gate' : 'fence', cell.x, cell.z);
  const marker = building('pen-marker', 92, 100, { pen: { accepted: ['muffalo', 'dromedary'] } });
  for (const cell of cells(71, 80, 95, 104)) if (!occupied.has(indexOf(cell)) && !(cell.x === 75 && cell.z === 82)) {
    const grass: Resource = { id: world.nextId++, kind: 'wild-plant', species: 'grass', ...cell, amount: 0,
      growth: .8 + (cell.x + cell.z) % 5 * .04, growthTick: 0 };
    world.resources.push({ ...grass, plantLife: createPlantLife(world, grass) });
  }
  if (!world.wildlife) throw new Error('The natural site did not generate its wildlife owner.');
  const resourceRock = new Set(world.resources.filter(resource => resource.kind === 'rock').map(indexOf));
  const wildCells = cells(1, 1, 248, 70).filter(cell => !landscaped.has(indexOf(cell))
    && !['water', 'rock'].includes(world.tiles[indexOf(cell)]!.terrain) && !resourceRock.has(indexOf(cell)));
  const wildOccupied = new Set(world.wildlife.animals.filter(animal => !landscaped.has(indexOf(animal))).map(indexOf));
  let wildCursor = 0;
  for (const animal of world.wildlife.animals) if (landscaped.has(indexOf(animal))) {
    while (wildCells[wildCursor] && wildOccupied.has(indexOf(wildCells[wildCursor]!))) wildCursor++;
    const cell = wildCells[wildCursor++]; if (!cell) throw new Error('No natural initial wildlife position.');
    Object.assign(animal, cell); wildOccupied.add(indexOf(cell));
  }
  for (const [index, species] of ['muffalo', 'muffalo', 'muffalo', 'muffalo', 'dromedary', 'dromedary'].entries()) {
    const animal: WildAnimal = { id: world.nextId++, species: species as WildAnimal['species'], sex: index === 3 ? 'male' : 'female',
      ageTicks: adultAgeTicks(species as WildAnimal['species']) + 6000, x: 76 + index * 3, z: 95,
      food: 0, rest: .9, state: 'idle', path: [], nextDecision: 1,
      domestic: { since: 0, care: 'herbal', tameness: 5, nextDecay: 45000, penMarkerId: marker.id, productFullness: index < 4 ? .8 : .6 } };
    animal.food = animalNutritionMax(animal) * .9; world.wildlife.animals.push(animal);
  }
  if (world.flora?.revision===1) world.flora.capacity = Math.max(world.flora.capacity, world.resources.filter(resource => resource.species !== undefined).length);

  world.research = { project: 'recon-armor', points: researchCost('complex-clothing'), completedAt: 0 };
  for (const [project, key] of [
    ['complex-furniture', 'complexFurniture'], ['air-conditioning', 'airConditioning'], ['batteries', 'batteries'], ['solar-power', 'solarPower'],
    ['stonecutting', 'stonecutting'], ['smithing', 'smithing'], ['machining', 'machining'], ['gunsmithing', 'gunsmithing'],
    ['plate-armor', 'plateArmor'], ['flak-armor', 'flakArmor'], ['microelectronics', 'microelectronics'], ['multi-analyzer', 'multiAnalyzer'],
    ['fabrication', 'fabrication'], ['advanced-fabrication', 'advancedFabrication'], ['hospital-bed', 'hospitalBed'],
    ['gun-turrets', 'gunTurrets'], ['tube-television', 'tubeTelevision'], ['packaged-survival-meals', 'packagedSurvivalMeals'], ['autodoors', 'autodoors'],
  ] as const) world.research[key] = { points: researchCost(project as ResearchProject), completedAt: 0 };
  world.research.reconArmor = { points: 1000 * RESEARCH_SCALE };
  // Modest physical future work, no frame deliveries or completion granted.
  for (const [kind, x, z] of [['table-square', 125, 157], ['dining-chair', 124, 157], ['dining-chair', 127, 157],
    ['sandbags', 139, 164], ['sandbags', 140, 164], ['sandbags', 141, 164]] as const) {
    world.jobs.push({ id: world.nextId++, kind, x, z, material: kind === 'sandbags' ? 'cloth' : 'wood',
      construction: 'blueprint', orientation: 0, footprint: 'standard', status: 'pending', reservedBy: null,
      progress: 0, escrow: { wood: 0, food: 0 } });
    for (const cell of footprintCells(world.jobs.at(-1)!)) home.add(indexOf(cell));
  }
  world.roofing = { constructed: [...roofs].sort((a, b) => a - b), build: [], remove: [], cursor: 0 };
  world.home = [...home].sort((a, b) => a - b);
  world.planet = generatePlanet(world.seed, planetHomeInput(world), 0);
  delete world.economy; refreshStock(world); adoptColonyEconomy(world); reconcilePower(world);
  // No group, journey, purchase, raid, mental crisis or new recruitment is
  // fabricated. The normal calendars and every original owner remain active.
  return world;
}
