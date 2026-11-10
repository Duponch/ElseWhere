import { invalidateTerrainJournal } from './terrain-mutation-journal.ts';
import { createScenarioWorld } from './new-game.ts';
import { startingPawn } from './starting-pawns.ts';
import { startingSkills } from './skills.ts';
import { assignBackground } from './background-generation.ts';
import { backgroundWorkRefusal, type ColonistBackground } from './colonist-backgrounds.ts';
import { HUMAN_YEAR_TICKS } from './human-age.ts';
import { tryAddRelationship } from './relationship-runtime.ts';
import { isHabitatFurnitureKind } from './furniture-stats.ts';
import { footprintCells } from './definitions.ts';
import { newDoorState } from './door-rules.ts';
import { isElectrical, newPowerState } from './power-rules.ts';
import { isPowerTransmitter } from './power-grid.ts';
import { reconcilePower } from './power.ts';
import { newBatteryState } from './power-battery.ts';
import { newCoolerState } from './cooler.ts';
import { newMiniTurretState } from './mini-turret-state.ts';
import { isFueledBuilding, newBuildingFuel, WOOD_BURN_TICKS } from './fuel.ts';
import { newCookingBill } from './cooking-bills.ts';
import { stationRecipe, type ProductionRecipe } from './production-recipes.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { createPlantLife } from './plant-life.ts';
import { PLANT_DEFINITIONS } from './plants.ts';
import { adultAgeTicks, animalNutritionMax } from './animal-life.ts';
import { type WildAnimal } from './wildlife-state.ts';
import { generatePlanet, planetHomeInput } from './planet-generation.ts';
import { adoptColonyEconomy } from './colony-economy.ts';
import { researchCost, type ResearchProject } from './research.ts';
import type { Cell, Pawn, StorageFilters, Structure, World } from './types.ts';

export const ESTABLISHED_COLONY_SCENARIO_ID = 'established-colony-v221';

/** Authored new-world preparation, never a migrated or progressed campaign.
 * Buildings, knowledge, biographies, links, crops and stocks below are the
 * declared initial state. The publisher subsequently runs ordinary ticks;
 * this factory supplies no completed job, conversation, injury or transaction.
 */
export function prepareEstablishedColonyScenario(): World {
  const world = createScenarioWorld(221350, 64, 'crashlanded', {
    biome: 'temperate-forest', hilliness: 'small-hills',
  });
  const cellIndex = (cell: Cell): number => cell.z * world.width + cell.x;
  const cells = (minX: number, minZ: number, maxX: number, maxZ: number): Cell[] => {
    const result: Cell[] = [];
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) result.push({ x, z });
    return result;
  };

  // The local village has been landscaped. The untouched forest, hills,
  // deposits and biome producers outside these specific parcels remain real.
  const landscaped = new Set<number>();
  const clear = (minX: number, minZ: number, maxX: number, maxZ: number): void => {
    for (const cell of cells(minX, minZ, maxX, maxZ)) landscaped.add(cellIndex(cell));
  };
  for (const rectangle of [
    [10, 12, 20, 30], [19, 12, 56, 21], [19, 21, 26, 30], [36, 21, 54, 30],
    [26, 25, 40, 36], [40, 30, 55, 41], [28, 37, 40, 48], [17, 33, 28, 44],
    [40, 42, 55, 53], [6, 33, 18, 50], [2, 1, 18, 12],
    [18, 30, 55, 32], [26, 21, 43, 25], [18, 44, 28, 48], [6, 51, 55, 53],
    [28, 47, 40, 53], [31, 53, 33, 63], [23, 48, 25, 51],
  ] as const) clear(rectangle[0], rectangle[1], rectangle[2], rectangle[3]);
  world.resources = world.resources.filter(resource => !landscaped.has(cellIndex(resource)));
  for (const index of landscaped) {
    const original = world.tiles[index]!;
    world.tiles[index] = { terrain: original.terrain === 'rich-soil' ? 'rich-soil' : 'grass' };
  }
  // Tile replacements are terrain writes: caches keyed by the write count see them.
  if (landscaped.size) invalidateTerrainJournal(world.tiles);
  world.structures = []; world.jobs = []; world.packed = []; world.stockpiles = [];
  world.growingZones = []; world.growingCursor = 0; world.events = [];
  // Replace only this new preparation's ground dotation. Keep the original
  // three shirts and their owners; four additional residents receive new ones.
  world.piles = world.piles.filter(pile => pile.owner.type === 'apparel');
  delete world.relationships;

  const roofs = new Set<number>(), home = new Set<number>();
  const occupied = new Set<number>();
  const building = (kind: Structure['kind'], x: number, z: number,
    options: Partial<Structure> = {}): Structure => {
    const structure: Structure = { id: world.nextId++, kind, x, z, orientation: 0,
      footprint: 'standard', material: 'wood', ...options };
    if (isHabitatFurnitureKind(kind)) structure.quality ??= 'normal';
    if (kind === 'door' || kind === 'fence-gate') structure.door = newDoorState(world.tick);
    if (isElectrical(kind)) { structure.material = 'steel'; structure.power = newPowerState(kind); }
    if (isFueledBuilding(kind)) structure.fuel = newBuildingFuel(kind);
    if (kind === 'battery') structure.battery = newBatteryState();
    if (kind === 'cooler') structure.cooler = newCoolerState();
    if (kind === 'mini-turret') structure.turret = newMiniTurretState();
    if (kind === 'crafting-spot') delete structure.material;
    if (stationRecipe(structure)) structure.bills = [];
    const footprint = footprintCells(structure);
    for (const cell of footprint) {
      const index = cellIndex(cell);
      if (kind !== 'power-conduit' && occupied.has(index)) throw new Error(`Prepared building overlap at ${cell.x},${cell.z}`);
      if (world.tiles[index]?.terrain === 'rock' || world.tiles[index]?.terrain === 'water') throw new Error('Prepared building on impassable terrain.');
      if (kind !== 'power-conduit') occupied.add(index);
      home.add(index);
    }
    world.structures.push(structure); return structure;
  };
  const room = (minX: number, minZ: number, maxX: number, maxZ: number, entrances: readonly Cell[], stone = false): void => {
    for (const cell of cells(minX, minZ, maxX, maxZ)) {
      const index = cellIndex(cell); home.add(index);
      if (cell.x === minX || cell.x === maxX || cell.z === minZ || cell.z === maxZ) {
        building(entrances.some(door => door.x === cell.x && door.z === cell.z) ? 'door' : 'wall', cell.x, cell.z,
          { material: stone ? 'granite-blocks' : 'wood' });
      } else {
        roofs.add(index); world.tiles[index]!.floor = stone ? 'granite-tile' : 'wood-planks';
      }
    }
  };

  // Six bedrooms for seven people. The oldest wooden house accommodates the
  // original couple; later individual rooms differ in material and furniture.
  room(20, 13, 28, 20, [{ x: 24, z: 20 }]);
  room(30, 13, 35, 20, [{ x: 32, z: 20 }]);
  room(37, 13, 42, 20, [{ x: 39, z: 20 }]);
  room(44, 13, 49, 20, [{ x: 46, z: 20 }]);
  room(20, 22, 25, 29, [{ x: 25, z: 25 }]);
  room(37, 22, 42, 29, [{ x: 37, z: 25 }]);
  const beds = [
    building('bed', 22, 15, { quality: 'good' }), building('bed', 25, 15, { quality: 'good' }),
    building('bed', 46, 15), building('bed', 32, 15), building('bed', 39, 15),
    building('bed', 22, 24), building('bed', 39, 24, { quality: 'poor' }),
  ];
  building('end-table', 23, 15); building('dresser', 22, 18, { orientation: 1 });

  const residents: readonly { name: string; years: number; cell: Cell; background: ColonistBackground; work: Partial<Pawn['priorities']> }[] = [
    { name: 'Ada', years: 34, cell: { x: 24, z: 18 }, background: { childhood: 'workshop-child', adulthood: 'builder' }, work: { build: 1, cook: 2, craft: 3 } },
    { name: 'Noé', years: 31, cell: { x: 25, z: 18 }, background: { childhood: 'field-child', adulthood: 'farmer' }, work: { grow: 1, handle: 2, gather: 2 } },
    { name: 'Mina', years: 37, cell: { x: 46, z: 18 }, background: { childhood: 'school-child', adulthood: 'medic' }, work: { doctor: 1, cook: 2, research: 3 } },
    { name: 'Iris', years: 29, cell: { x: 32, z: 18 }, background: { childhood: 'school-child', adulthood: 'researcher' }, work: { research: 1, doctor: 2 } },
    { name: 'Sacha', years: 42, cell: { x: 39, z: 18 }, background: { childhood: 'workshop-child', adulthood: 'artisan' }, work: { craft: 1, art: 2, build: 2 } },
    { name: 'Léonie', years: 33, cell: { x: 22, z: 27 }, background: { childhood: 'settlement-child', adulthood: 'merchant' }, work: { warden: 1, haul: 1, clean: 2 } },
    { name: 'Tao', years: 25, cell: { x: 39, z: 27 }, background: { childhood: 'field-child', adulthood: 'mercenary' }, work: { mine: 1, gather: 2, haul: 2 } },
  ];
  for (const [index, resident] of residents.entries()) {
    const pawn = world.pawns[index] ?? startingPawn(world.nextId++, resident.name, resident.cell.x, resident.cell.z, index, 62, world.seed);
    if (!world.pawns.includes(pawn)) world.pawns.push(pawn);
    // These authorship choices happen only at creation, before the first tick.
    pawn.name = resident.name; Object.assign(pawn, resident.cell);
    pawn.age = { biologicalTicks: resident.years * HUMAN_YEAR_TICKS, chronologicalTicks: (resident.years + (index < 3 ? 240 : 0)) * HUMAN_YEAR_TICKS };
    delete pawn.health; delete pawn.background; pawn.skills = startingSkills(index);
    assignBackground(pawn, resident.background);
    pawn.traits = index === 2 ? ['steadfast', 'kind'] : index === 3 ? ['fast-learner', 'nervous'] : index === 6 ? ['steadfast'] : ['optimist'];
    pawn.hunger = 84 - index * 2; pawn.rest = 88 - index; pawn.mood = 72 + index;
    pawn.recreation.level = 58 + index * 3; pawn.foodPolicyId = 2; pawn.bedId = beds[index]!.id;
    for (const work of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[]) pawn.priorities[work] = 0;
    Object.assign(pawn.priorities, { patient: 1, bedrest: 2, doctor: 3, firefight: 1, basic: 1, haul: 3, clean: 3 }, resident.work);
    for (const work of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[]) if (backgroundWorkRefusal(pawn, work)) pawn.priorities[work] = 0;
    // Four additional shirts are prepared, rather than granted by an arrival.
    if (index >= 3) addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: pawn.id }, 'cloth-shirt');
    addMaterial(world, 'apparel', 1, { type: 'apparel', pawnId: pawn.id }, 'cloth-pants');
  }
  const [ada, noe, mina, iris, , , tao] = world.pawns;
  if (!tryAddRelationship(world, { kind: 'spouse', aId: Math.min(ada!.id, noe!.id), bId: Math.max(ada!.id, noe!.id), recordedAt: 0 })
    || !tryAddRelationship(world, { kind: 'sibling', aId: Math.min(mina!.id, iris!.id), bId: Math.max(mina!.id, iris!.id), recordedAt: 0 })) throw new Error('Prepared family graph is invalid.');
  addMaterial(world, 'weapon', 1, { type: 'equipment', pawnId: ada!.id }, 'revolver');
  addMaterial(world, 'weapon', 1, { type: 'equipment', pawnId: tao!.id }, 'bolt-action-rifle');

  room(11, 13, 19, 20, [{ x: 15, z: 20 }], true);
  // Replace a single western wall with the cooler: cold east, exhaust west.
  const coolerWall = world.structures.find(structure => structure.kind === 'wall' && structure.x === 11 && structure.z === 16)!;
  world.structures.splice(world.structures.indexOf(coolerWall), 1); occupied.delete(cellIndex(coolerWall));
  const cooler = building('cooler', 11, 16, { orientation: 1 }); cooler.cooler!.target = -5;
  room(11, 22, 19, 29, [{ x: 15, z: 22 }], true);
  const stove = building('electric-stove', 14, 26, { orientation: 2 });
  const butcher = building('butcher-table', 14, 23, { material: 'wood' });
  room(27, 26, 35, 35, [{ x: 32, z: 26 }, { x: 32, z: 35 }]);
  // An attached recreation room has its own door, rather than mixing chairs
  // into workstation service cells or drawing a furniture catalogue outdoors.
  room(37, 31, 40, 37, [{ x: 37, z: 34 }]);
  building('table-long', 30, 28, { quality: 'good', gatherSpot: true });
  for (let z = 28; z <= 31; z++) { building('dining-chair', 29, z); building('dining-chair', 32, z, { orientation: 2 }); }
  // Narrow annex holds an actual chess corner; TV is in the larger dining room.
  building('chess-table', 38, 33); building('stool', 38, 32); building('stool', 38, 35);
  building('tube-television', 33, 28, { orientation: 0 });
  building('armchair', 33, 31, { material: 'cloth' }); building('armchair', 33, 32, { material: 'cloth' });
  building('horseshoes', 29, 24);

  room(44, 22, 53, 29, [{ x: 44, z: 26 }], true);
  building('hospital-bed', 46, 24, { material: 'steel', quality: 'good', medical: true });
  building('bed', 50, 24, { material: 'steel', medical: true });
  room(50, 13, 55, 20, [{ x: 52, z: 20 }], true);
  building('bed', 52, 15, { prisoner: true });

  room(41, 31, 54, 40, [{ x: 47, z: 31 }, { x: 41, z: 39 }], true);
  const machine = building('machining-table', 45, 34, { material: 'steel' });
  const tailor = building('tailor-bench', 50, 34);
  const stonecutter = building('stonecutter', 45, 38);
  building('crafting-spot', 50, 38);
  room(29, 38, 39, 47, [{ x: 34, z: 38 }], true);
  building('hi-tech-research-bench', 34, 41, { material: 'steel' });
  building('multi-analyzer', 37, 44, { material: 'steel' });
  room(18, 34, 26, 43, [{ x: 26, z: 37 }]);
  room(41, 43, 54, 48, [{ x: 41, z: 45 }], true);
  for (const x of [43, 49]) { const generator = building('wood-generator', x, 45); generator.fuel!.ticks = 75 * WOOD_BURN_TICKS; }
  building('battery', 46, 45); building('battery', 52, 45);
  building('solar-generator', 42, 49); building('solar-generator', 48, 49);
  for (const cell of [{ x: 24, z: 17 }, { x: 12, z: 27 }, { x: 28, z: 27 }, { x: 34, z: 33 }, { x: 51, z: 27 }, { x: 42, z: 33 }, { x: 30, z: 40 }, { x: 19, z: 41 }]) building('standing-lamp', cell.x, cell.z);

  // Prepared real circuit: cardinal conduits join the solar/fuel/storage hub,
  // western fridge and northern housing without diagonal wireless links.
  const wires = new Set<number>();
  const wire = (minX: number, minZ: number, maxX: number, maxZ: number): void => {
    for (const cell of cells(minX, minZ, maxX, maxZ)) {
      const index = cellIndex(cell); if (wires.has(index)) continue; wires.add(index);
      // The source/battery footprint already transmits here. A second
      // transmitter would violate the construction layer, unlike a consumer.
      if (world.structures.some(structure => isPowerTransmitter(structure.kind)
        && footprintCells(structure).some(part => cellIndex(part) === index))) continue;
      building('power-conduit', cell.x, cell.z);
    }
  };
  wire(24, 21, 49, 21); wire(24, 21, 24, 45); wire(12, 25, 49, 25);
  wire(12, 16, 12, 25); wire(24, 36, 49, 36); wire(34, 36, 34, 45);
  wire(49, 21, 49, 50); wire(42, 45, 52, 45); wire(43, 48, 43, 50);
  wire(24, 45, 49, 45); wire(24, 45, 24, 51); wire(24, 51, 39, 51);
  const guns = [building('mini-turret', 24, 51), building('mini-turret', 39, 51)];
  for (const gun of guns) for (const dx of [-1, 0, 1]) building('sandbags', gun.x + dx, 53, { material: 'cloth' });

  const stock = (where: readonly Cell[], filters: StorageFilters, priority = 2): void => {
    for (const cell of where) world.stockpiles.push({ id: world.nextId++, ...cell, filters: { ...filters }, priority, capacity: 75 });
  };
  const foodCells = cells(13, 14, 17, 19), storeCells = cells(20, 36, 25, 41);
  stock(foodCells, { wood: false, food: true });
  stock(storeCells, { wood: true, food: false, steel: true, component: true, textile: true, blocks: true, chunk: true, silver: true, weapon: true, apparel: true, unfinished: true });
  stock([{ x: 48, z: 28 }, { x: 49, z: 28 }], { wood: false, food: false, medicine: true }, 3);
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
  put('simple-meal', 20, 'food'); put('survival-meal', 20, 'food'); put('rice', 150, 'food');
  put('corn', 100, 'food'); put('hare-meat', 50, 'food'); put('milk', 30, 'food');
  put('wood', 300, 'store'); put('steel', 300, 'store'); put('component', 16, 'store');
  put('cloth', 90, 'store'); put('granite-blocks', 150, 'store'); put('silver', 500, 'store');
  put('granite-chunk', 4, 'store'); put('plasteel-knife', 1, 'store');
  addMaterial(world, 'medicine', 8, { type: 'ground', x: 48, z: 28 }, 'medicine');
  addMaterial(world, 'medicine', 6, { type: 'ground', x: 49, z: 28 }, 'herbal-medicine');

  const bill = (station: Structure, recipe: ProductionRecipe, target: number, mode: 'until' | 'times' = 'until', radius = 24): void => {
    const prepared = newCookingBill(world.nextId++, recipe); Object.assign(prepared, { mode, target, radius });
    (station.bills ??= []).push(prepared);
  };
  bill(stove, 'cook-simple-meal-bulk', 21); bill(stove, 'fine-meal', 7); bill(stove, 'cook-survival-meal', 20);
  bill(butcher, 'butcher-creature', 1, 'times'); bill(tailor, 'pants', 2, 'times', 32);
  bill(stonecutter, 'stone-blocks', 200); bill(machine, 'shred-mechanoid', 1, 'times');

  const fields: readonly { plant: import('./crops').CropKind; rectangle: readonly [number, number, number, number]; growth: number }[] = [
    { plant: 'rice', rectangle: [7, 34, 12, 39], growth: .93 },
    { plant: 'corn', rectangle: [7, 42, 11, 47], growth: .81 },
    { plant: 'cotton', rectangle: [14, 42, 17, 46], growth: .62 },
    { plant: 'healroot', rectangle: [14, 48, 17, 50], growth: .74 },
  ];
  for (const field of fields) {
    const fieldCells = cells(...field.rectangle);
    world.growingZones.push({ id: world.nextId++, plant: field.plant, cells: fieldCells.map(cellIndex), allowSow: true, allowCut: true });
    for (const [index, cell] of fieldCells.entries()) {
      const plant = { id: world.nextId++, kind: field.plant, ...cell, amount: PLANT_DEFINITIONS[field.plant].yield,
        growth: Math.max(.1, field.growth - index % 4 * .025), growthTick: 0 };
      world.resources.push({ ...plant, plantLife: createPlantLife(world, plant) });
    }
  }

  // Prepared pasture contains physical edible plants, not a synthetic forage
  // balance. Consumption, tameness, products and conception follow real ticks.
  for (const cell of cells(3, 2, 17, 11)) if (cell.x === 3 || cell.x === 17 || cell.z === 2 || cell.z === 11)
    building(cell.x === 17 && cell.z === 8 ? 'fence-gate' : 'fence', cell.x, cell.z);
  const marker = building('pen-marker', 8, 8, { pen: { accepted: ['muffalo'] } });
  for (const cell of cells(4, 3, 16, 10)) if (!(cell.x === 8 && cell.z === 8)) {
    const grass = { id: world.nextId++, kind: 'wild-plant' as const, species: 'grass' as const, ...cell, amount: 0, growth: .95, growthTick: 0 };
    world.resources.push({ ...grass, plantLife: createPlantLife(world, grass) });
  }
  if (!world.wildlife) throw new Error('The natural site did not generate its wildlife owner.');
  // Move only initial fauna accidentally placed in the authored village, using
  // remaining natural ground. No movement is attributed to runtime animals.
  const wildCells = cells(1, 1, 62, 10).filter(cell => !landscaped.has(cellIndex(cell)) && !['water', 'rock'].includes(world.tiles[cellIndex(cell)]!.terrain)
    && !world.resources.some(resource => resource.kind === 'rock' && resource.x === cell.x && resource.z === cell.z));
  const wildOccupied = new Set(world.wildlife.animals.filter(animal => !landscaped.has(cellIndex(animal))).map(cellIndex));
  let wildCursor = 0;
  for (const animal of world.wildlife.animals) if (landscaped.has(cellIndex(animal))) {
    while (wildCells[wildCursor] && wildOccupied.has(cellIndex(wildCells[wildCursor]!))) wildCursor++;
    const cell = wildCells[wildCursor++]; if (!cell) throw new Error('No natural initial wildlife position.');
    Object.assign(animal, cell); wildOccupied.add(cellIndex(cell));
  }
  for (const [index, sex] of ['female', 'male'].entries()) {
    const animal: WildAnimal = { id: world.nextId++, species: 'muffalo', sex: sex as WildAnimal['sex'], ageTicks: adultAgeTicks('muffalo') + 6000,
      x: 7 + index * 4, z: 6, food: 0, rest: .9, state: 'idle', path: [], nextDecision: 1,
      domestic: { since: 0, care: 'herbal', tameness: 4, nextDecay: 45000, penMarkerId: marker.id, productFullness: .6 } };
    animal.food = animalNutritionMax(animal) * .9; world.wildlife.animals.push(animal);
  }
  if (world.flora?.revision===1) world.flora.capacity = Math.max(world.flora.capacity, world.resources.filter(resource => resource.species !== undefined).length);

  // Explicit prepared technologies are distinct from the real future project.
  world.research = { project: 'fabrication', points: researchCost('complex-clothing'), completedAt: 0 };
  for (const [project, key] of [
    ['complex-furniture', 'complexFurniture'], ['air-conditioning', 'airConditioning'], ['batteries', 'batteries'], ['solar-power', 'solarPower'],
    ['stonecutting', 'stonecutting'], ['smithing', 'smithing'], ['machining', 'machining'], ['gunsmithing', 'gunsmithing'],
    ['microelectronics', 'microelectronics'], ['multi-analyzer', 'multiAnalyzer'], ['hospital-bed', 'hospitalBed'],
    ['gun-turrets', 'gunTurrets'], ['tube-television', 'tubeTelevision'], ['packaged-survival-meals', 'packagedSurvivalMeals'],
  ] as const) world.research[key] = { points: researchCost(project as ResearchProject), completedAt: 0 };
  world.research.fabrication = { points: 900 * 1_000_000 };
  // Two small garden seats are genuine future blueprints with no deliveries.
  for (const [kind, x, z] of [['table', 23, 46], ['stool', 22, 46], ['stool', 24, 46]] as const)
    world.jobs.push({ id: world.nextId++, kind, x, z, material: 'wood', construction: 'blueprint', orientation: 0, footprint: 'standard',
      status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } });

  world.roofing = { constructed: [...roofs].sort((a, b) => a - b), build: [], remove: [], cursor: 0 };
  world.home = [...home].sort((a, b) => a - b);
  world.planet = generatePlanet(world.seed, planetHomeInput(world), 0);
  delete world.economy; refreshStock(world); adoptColonyEconomy(world); reconcilePower(world);
  // Preserve the ordinary weather, clinical, ecology and Cassandra agendas.
  // No quest acceptance, visitor, raid, trade, crisis or clinical result exists.
  return world;
}
