import { ShipEquipment, aggregateEquipment } from "./equipment";

export const COLS = 17;
export const ROWS = 13;
export const CENTER_X = 8;
export const CENTER_Y = 6;

export type CategoryId =
  | "hull"
  | "power"
  | "propulsion"
  | "weapons"
  | "defense"
  | "utility";

export type HullMaterialId = "frame" | "plate" | "bulkhead" | "spine" | "armor";

export type PartId =
  | HullMaterialId
  | "cockpit"
  | "solar"
  | "capacitor"
  | "reactor_s"
  | "reactor_l"
  | "maneuvering"
  | "engine_s"
  | "engine_l"
  | "engine_xl"
  | "booster"
  | "pd"
  | "laser"
  | "missile"
  | "railgun"
  | "shield_cap"
  | "shield_emit"
  | "fuel"
  | "cargo"
  | "sensor";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "hull", label: "Structure", color: "#94A3B8" },
  { id: "power", label: "Power", color: "#FBBF24" },
  { id: "propulsion", label: "Propulsion", color: "#5EEAD4" },
  { id: "weapons", label: "Weapons", color: "#FB7185" },
  { id: "defense", label: "Defense", color: "#A78BFA" },
  { id: "utility", label: "Utility", color: "#60A5FA" },
];

export interface PartDef {
  id: PartId;
  name: string;
  cat: CategoryId;
  isHullLayer?: boolean;
  mass: number;
  armor?: number;
  thrust?: number;
  gen?: number;
  draw?: number;
  dmg?: number;
  shield?: number;
  fuel?: number;
  cargo?: number;
  agility?: number;
  boostCharges?: number;
  rotatable?: boolean;
  desc: string;
}

export const PARTS: Record<PartId, PartDef> = {
  // Structure & Hull Paint
  frame: {
    id: "frame",
    name: "Light Frame",
    cat: "hull",
    isHullLayer: true,
    mass: 1,
    armor: 1,
    desc: "Lightweight structural lattice for shaping fast, nimble hulls.",
  },
  plate: {
    id: "plate",
    name: "Hull Plate",
    cat: "hull",
    isHullLayer: true,
    mass: 2,
    armor: 3,
    desc: "Standard armored fuselage plating for balanced multi-role ships.",
  },
  bulkhead: {
    id: "bulkhead",
    name: "Bulkhead",
    cat: "hull",
    isHullLayer: true,
    mass: 4,
    armor: 7,
    desc: "Heavy load-bearing core section that anchors large hulls.",
  },
  spine: {
    id: "spine",
    name: "Keel Spine",
    cat: "hull",
    isHullLayer: true,
    mass: 3,
    armor: 4,
    rotatable: true,
    desc: "Rigid structural backbone engineered for long capital vessels.",
  },
  armor: {
    id: "armor",
    name: "Ablative Armor",
    cat: "hull",
    isHullLayer: true,
    mass: 4,
    armor: 10,
    desc: "Thick outer battle plating built to absorb heavy incoming fire.",
  },
  cockpit: {
    id: "cockpit",
    name: "Cockpit",
    cat: "hull",
    mass: 3,
    armor: 2,
    rotatable: true,
    desc: "Command bridge module. Every spaceworthy vessel requires one.",
  },

  // Power Generation
  solar: {
    id: "solar",
    name: "Solar Array",
    cat: "power",
    mass: 1,
    gen: 5,
    desc: "Absorbs sunlight to trickle-charge the ship's power grid.",
  },
  capacitor: {
    id: "capacitor",
    name: "Power Cell",
    cat: "power",
    mass: 2,
    gen: 6,
    desc: "Compact auxiliary energy cell delivering steady baseline output.",
  },
  reactor_s: {
    id: "reactor_s",
    name: "Fusion Cell",
    cat: "power",
    mass: 3,
    gen: 14,
    desc: "Compact fusion core sized for fighters and light corvettes.",
  },
  reactor_l: {
    id: "reactor_l",
    name: "Reactor Core",
    cat: "power",
    mass: 7,
    gen: 40,
    desc: "High-output main reactor built to feed heavy weapons and shields.",
  },

  // Propulsion
  maneuvering: {
    id: "maneuvering",
    name: "Vector Thruster",
    cat: "propulsion",
    mass: 1,
    thrust: 3,
    agility: 3,
    draw: 1,
    rotatable: true,
    desc: "Micro-nozzles that sharpen turn rate and lateral handling.",
  },
  engine_s: {
    id: "engine_s",
    name: "Ion Thruster",
    cat: "propulsion",
    mass: 2,
    thrust: 8,
    draw: 3,
    rotatable: true,
    desc: "Efficient ion drive suited for scouts and agile interceptors.",
  },
  engine_l: {
    id: "engine_l",
    name: "Plasma Drive",
    cat: "propulsion",
    mass: 4,
    thrust: 24,
    draw: 9,
    rotatable: true,
    desc: "High-thrust fusion exhaust built for corvettes and frigates.",
  },
  engine_xl: {
    id: "engine_xl",
    name: "Warp Engine",
    cat: "propulsion",
    mass: 7,
    thrust: 42,
    draw: 16,
    rotatable: true,
    desc: "Massive capital thruster delivering extreme forward acceleration.",
  },
  booster: {
    id: "booster",
    name: "Booster",
    cat: "propulsion",
    mass: 2,
    thrust: 4,
    draw: 2,
    boostCharges: 3,
    rotatable: true,
    desc: "Press Tab in flight for 2× speed for 5s. Each Booster holds 3 boosts.",
  },

  // Weapons
  pd: {
    id: "pd",
    name: "Point Defense",
    cat: "weapons",
    mass: 1,
    draw: 3,
    dmg: 5,
    rotatable: true,
    desc: "Rapid-fire defense turret for intercepting agile targets.",
  },
  laser: {
    id: "laser",
    name: "Pulse Laser",
    cat: "weapons",
    mass: 2,
    draw: 4,
    dmg: 10,
    rotatable: true,
    desc: "Reliable energy cannon firing focused high-heat laser bolts.",
  },
  missile: {
    id: "missile",
    name: "Missile Rack",
    cat: "weapons",
    mass: 3,
    draw: 1,
    dmg: 16,
    rotatable: true,
    desc: "Low-draw ordnance pod launching self-propelled warheads.",
  },
  railgun: {
    id: "railgun",
    name: "Rail Cannon",
    cat: "weapons",
    mass: 6,
    draw: 12,
    dmg: 34,
    rotatable: true,
    desc: "Electromagnetic accelerator firing devastating hyper-velocity slugs.",
  },

  // Defense
  shield_cap: {
    id: "shield_cap",
    name: "Shield Capacitor",
    cat: "defense",
    mass: 2,
    shield: 12,
    desc: "Passive energy bank that reinforces your shield envelope.",
  },
  shield_emit: {
    id: "shield_emit",
    name: "Shield Emitter",
    cat: "defense",
    mass: 3,
    draw: 9,
    shield: 24,
    desc: "Active deflector projector creating a high-capacity barrier.",
  },

  // Utility
  fuel: {
    id: "fuel",
    name: "Fuel Tank",
    cat: "utility",
    mass: 2,
    fuel: 25,
    desc: "Pressurized propellant reservoir that extends jump range.",
  },
  cargo: {
    id: "cargo",
    name: "Cargo Hold",
    cat: "utility",
    mass: 3,
    cargo: 20,
    desc: "Modular freight bay for hauling salvage and expedition gear.",
  },
  sensor: {
    id: "sensor",
    name: "Sensor Array",
    cat: "utility",
    mass: 1,
    draw: 2,
    desc: "Long-range scanner dish improving telemetry and target lock.",
  },
};

export const PART_LIST: PartDef[] = Object.values(PARTS);

export const HULL_MATERIALS: HullMaterialId[] = [
  "frame",
  "plate",
  "bulkhead",
  "spine",
  "armor",
];

export function categoryColor(cat: CategoryId): string {
  return CATEGORIES.find((c) => c.id === cat)?.color ?? "#94A3B8";
}

export interface MountedModule {
  t: Exclude<PartId, HullMaterialId>;
  d: number; // 0 = up, 1 = right, 2 = down, 3 = left
}

export interface ShipCell {
  x: number;
  y: number;
  hull: HullMaterialId;
  mod?: MountedModule;
}

export type ShipCellMap = Record<string, ShipCell>;

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export function cellsFromArray(arr: ShipCell[] | undefined | null): ShipCellMap {
  const out: ShipCellMap = {};
  if (!Array.isArray(arr)) return out;
  for (const item of arr) {
    if (
      typeof item?.x === "number" &&
      typeof item?.y === "number" &&
      item.x >= 0 &&
      item.x < COLS &&
      item.y >= 0 &&
      item.y < ROWS
    ) {
      out[cellKey(item.x, item.y)] = {
        x: item.x,
        y: item.y,
        hull: PARTS[item.hull]?.isHullLayer ? item.hull : "plate",
        mod: item.mod && PARTS[item.mod.t] ? { t: item.mod.t, d: item.mod.d ?? 0 } : undefined,
      };
    }
  }
  return out;
}

export function cellsToArray(map: ShipCellMap): ShipCell[] {
  return Object.values(map).sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

export interface ShipBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

export function shipBounds(cells: ShipCellMap): ShipBounds | null {
  const list = Object.values(cells);
  if (list.length === 0) return null;
  let minX = COLS;
  let minY = ROWS;
  let maxX = -1;
  let maxY = -1;
  for (const c of list) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

export const SHIP_CLASS_THRESHOLDS = [
  { name: "Frame", range: "0" },
  { name: "Scout", range: "1–27" },
  { name: "Corvette", range: "28–57" },
  { name: "Frigate", range: "58–99" },
  { name: "Cruiser", range: "100–154" },
  { name: "Battleship", range: "155–224" },
  { name: "Dreadnought", range: "225+" },
] as const;

export function shipClassFromMass(mass: number): string {
  if (mass === 0) return "Frame";
  if (mass < 28) return "Scout";
  if (mass < 58) return "Corvette";
  if (mass < 100) return "Frigate";
  if (mass < 155) return "Cruiser";
  if (mass < 225) return "Battleship";
  return "Dreadnought";
}

export interface ShipWarning {
  id: string;
  level: "error" | "warn";
  label: string;
}

export interface ShipStats {
  cellsCount: number;
  modulesCount: number;
  mass: number;
  armor: number;
  hullHP: number;
  thrust: number;
  activeThrust: number;
  gen: number;
  draw: number;
  powerNet: number;
  dmg: number;
  activeDmg: number;
  dmgFlatBonus: number;
  dmgMult: number;
  fireRateMult: number;
  shieldRegenBonus: number;
  shield: number;
  activeShield: number;
  fuel: number;
  cargo: number;
  agility: number;
  boostCharges: number;
  activeBoostCharges: number;
  topSpeed: number;
  handling: number;
  range: number;
  shipClass: string;
  hasCockpit: boolean;
  hasThrusters: boolean;
  hasWeapons: boolean;
  isPowerOverloaded: boolean;
  poweredCellKeys: string[];
  warnings: ShipWarning[];
}

export function computeStats(
  cells: ShipCellMap,
  offlineKeys?: Set<string>,
  equipment?: ShipEquipment[]
): ShipStats {
  const eq = aggregateEquipment(equipment);
  const list = Object.values(cells || {});
  let mass = 0;
  let armor = 0;
  let thrust = 0;
  let activeThrust = 0;
  let gen = eq.powerFlat;
  let draw = 0;
  let dmg = 0;
  let activeDmg = 0;
  let shield = 0;
  let activeShield = 0;
  let fuel = 0;
  let cargo = 0;
  let agility = 0;
  let activeAgility = 0;
  let boostCharges = 0;
  let activeBoostCharges = 0;
  let modulesCount = 0;
  let hasCockpit = false;
  let hasWeapons = false;
  const poweredCellKeys: string[] = [];

  for (const cell of list) {
    const hullDef = PARTS[cell.hull];
    if (hullDef) {
      mass += hullDef.mass;
      armor += hullDef.armor ?? 0;
    }

    if (cell.mod) {
      const modDef = PARTS[cell.mod.t];
      if (!modDef) continue;
      modulesCount += 1;
      const key = cellKey(cell.x, cell.y);
      const isOffline = offlineKeys ? offlineKeys.has(key) : false;

      if (modDef.id === "cockpit") hasCockpit = true;
      if (modDef.dmg && modDef.dmg > 0) hasWeapons = true;

      mass += modDef.mass;
      armor += modDef.armor ?? 0;
      gen += modDef.gen ?? 0;
      draw += modDef.draw ?? 0;
      fuel += modDef.fuel ?? 0;
      cargo += modDef.cargo ?? 0;

      if ((modDef.draw ?? 0) > 0) {
        poweredCellKeys.push(key);
      }

      const modThrust = modDef.thrust ?? 0;
      const modDmg = modDef.dmg ?? 0;
      const modShield = modDef.shield ?? 0;
      const modAgility = modDef.agility ?? 0;
      const modBoost = modDef.boostCharges ?? 0;

      thrust += modThrust;
      dmg += modDmg;
      shield += modShield;
      agility += modAgility;
      boostCharges += modBoost;

      if (!isOffline) {
        activeThrust += modThrust;
        activeDmg += modDmg;
        activeShield += modShield;
        activeAgility += modAgility;
        activeBoostCharges += modBoost;
      }
    }
  }

  const effectiveGen = hasCockpit ? gen : 0;
  const effectiveDraw = hasCockpit ? draw : 0;
  const effectiveActiveThrust = hasCockpit ? activeThrust : 0;
  const effectiveActiveAgility = hasCockpit ? activeAgility : 0;

  const totalDmg =
    hasCockpit && (dmg > 0 || eq.dmgFlat > 0)
      ? Math.round((dmg + eq.dmgFlat) * eq.dmgMult)
      : 0;
  const totalActiveDmg =
    hasCockpit && activeDmg > 0
      ? Math.round((activeDmg + eq.dmgFlat) * eq.dmgMult)
      : 0;

  const totalShield = hasCockpit ? shield + eq.shieldFlat : 0;
  const totalActiveShield = hasCockpit ? activeShield + eq.shieldFlat : 0;

  const powerNet = effectiveGen - effectiveDraw;
  const isPowerOverloaded = hasCockpit && effectiveDraw > effectiveGen;
  const hasThrusters = thrust > 0;

  const topSpeed =
    hasCockpit && mass > 0 && effectiveActiveThrust > 0
      ? Math.round((effectiveActiveThrust / mass) * 90 * eq.speedMult)
      : 0;
  const handling =
    hasCockpit && mass > 0
      ? Math.round(
          ((3 + effectiveActiveAgility + effectiveActiveThrust * 0.35) /
            Math.sqrt(mass)) *
            6
        )
      : 0;
  const hullHP = list.length > 0 ? Math.round(25 + armor * 6 + eq.hullFlat) : 0;
  const range = hasCockpit ? Math.round(fuel * 2 + effectiveGen * 0.5) : 0;
  const shipClass = shipClassFromMass(mass);

  const warnings: ShipWarning[] = [];
  if (list.length === 0) {
    warnings.push({
      id: "empty",
      level: "error",
      label: "Paint hull cells to start building",
    });
  } else {
    if (!hasCockpit) {
      warnings.push({
        id: "no-cockpit",
        level: "error",
        label: "No cockpit — ship systems and power cannot turn on",
      });
    }
    if (!hasThrusters) {
      warnings.push({
        id: "no-thrust",
        level: "error",
        label: "No thrusters — cannot accelerate in flight",
      });
    }
    if (isPowerOverloaded) {
      warnings.push({
        id: "power-deficit",
        level: "warn",
        label: `Power deficit (${Math.abs(powerNet)} short) — modules will brown out`,
      });
    }
  }

  return {
    cellsCount: list.length,
    modulesCount,
    mass,
    armor,
    hullHP,
    thrust: hasCockpit ? thrust : 0,
    activeThrust: effectiveActiveThrust,
    gen: effectiveGen,
    draw: effectiveDraw,
    powerNet,
    dmg: totalDmg,
    activeDmg: totalActiveDmg,
    dmgFlatBonus: hasCockpit ? eq.dmgFlat : 0,
    dmgMult: hasCockpit ? eq.dmgMult : 1,
    fireRateMult: hasCockpit ? eq.fireRateMult : 1,
    shieldRegenBonus: hasCockpit ? eq.shieldRegenBonus : 0,
    shield: totalShield,
    activeShield: totalActiveShield,
    fuel,
    cargo,
    agility: hasCockpit ? agility : 0,
    boostCharges: hasCockpit ? boostCharges : 0,
    activeBoostCharges: hasCockpit ? activeBoostCharges : 0,
    topSpeed,
    handling,
    range,
    shipClass,
    hasCockpit,
    hasThrusters,
    hasWeapons: hasCockpit && hasWeapons,
    isPowerOverloaded,
    poweredCellKeys: hasCockpit ? poweredCellKeys : [],
    warnings,
  };
}

export function partPowerLabel(part: PartDef): {
  text: string;
  kind: "gen" | "draw" | "neutral";
} {
  if (part.gen && part.gen > 0) {
    return { text: `+${part.gen}`, kind: "gen" };
  }
  if (part.draw && part.draw > 0) {
    return { text: `-${part.draw}`, kind: "draw" };
  }
  return { text: "0", kind: "neutral" };
}

export function partSummary(part: PartDef): string {
  const bits: string[] = [`Mass ${part.mass}`];
  if (part.boostCharges) bits.push(`${part.boostCharges} Boosts`);
  if (part.armor) bits.push(`Armor ${part.armor}`);
  if (part.thrust) bits.push(`Thrust ${part.thrust}`);
  if (part.dmg) bits.push(`Dmg ${part.dmg}`);
  if (part.shield) bits.push(`Shield ${part.shield}`);
  if (part.fuel) bits.push(`Fuel ${part.fuel}`);
  if (part.cargo) bits.push(`Cargo ${part.cargo}`);
  if (part.agility) bits.push(`Turn +${part.agility}`);
  return bits.slice(0, 3).join(" · ");
}

export function selectNextBrownoutKeys(
  poweredKeys: string[],
  prevOffline: Set<string>,
  gen: number,
  draw: number
): Set<string> {
  if (poweredKeys.length === 0 || draw <= gen) {
    return new Set();
  }
  if (gen <= 0) {
    return new Set(poweredKeys);
  }
  if (poweredKeys.length === 1) {
    return prevOffline.size > 0 ? new Set() : new Set(poweredKeys);
  }

  const deficitRatio = Math.min(
    0.9,
    Math.max(0.25, (draw - gen) / Math.max(1, draw))
  );
  const countToDrop = Math.min(
    poweredKeys.length - 1,
    Math.max(1, Math.ceil(poweredKeys.length * deficitRatio))
  );

  const shuffle = (arr: string[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const previouslyOn = shuffle(poweredKeys.filter((k) => !prevOffline.has(k)));
  const previouslyOff = shuffle(poweredKeys.filter((k) => prevOffline.has(k)));
  const rotationPool = [...previouslyOn, ...previouslyOff];

  return new Set(rotationPool.slice(0, countToDrop));
}
