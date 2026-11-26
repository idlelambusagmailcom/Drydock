import { ShipEquipment, rollRandomEquipment } from "./equipment";
import {
  COLS,
  HullMaterialId,
  PartId,
  ShipCell,
  ShipCellMap,
  cellKey,
  cellsFromArray,
  cellsToArray,
} from "./parts";

export interface ShipRecord {
  id: string;
  name: string;
  updatedAt: number;
  cells: ShipCell[];
  equipment?: ShipEquipment[];
}

export interface FleetEquipmentGrant {
  shipId: string;
  shipName: string;
  equipment: ShipEquipment;
}

const STORAGE_KEY = "drydock_fleet_v1";

type SeedRow = [
  x: number,
  y: number,
  hull: HullMaterialId,
  mod?: Exclude<PartId, HullMaterialId>,
  d?: number
];

function buildMirrored(rows: SeedRow[]): ShipCell[] {
  const map: ShipCellMap = {};
  for (const [x, y, hull, mod, d = 0] of rows) {
    map[cellKey(x, y)] = {
      x,
      y,
      hull,
      mod: mod ? { t: mod, d } : undefined,
    };
    const mx = COLS - 1 - x;
    if (mx !== x) {
      map[cellKey(mx, y)] = {
        x: mx,
        y,
        hull,
        mod: mod ? { t: mod, d: (4 - d) % 4 } : undefined,
      };
    }
  }
  return cellsToArray(map);
}

export function createStarterFleet(): ShipRecord[] {
  const now = Date.now();

  const kestrel: ShipRecord = {
    id: "ship-kestrel",
    name: "Kestrel Mk II",
    updatedAt: now - 3600_000 * 6,
    equipment: [],
    cells: buildMirrored([
      [8, 2, "plate", "cockpit"],
      [8, 3, "spine", "sensor"],
      [7, 4, "plate"],
      [8, 4, "plate", "reactor_s"],
      [6, 5, "frame", "laser"],
      [7, 5, "plate", "shield_cap"],
      [8, 5, "bulkhead"],
      [5, 6, "frame", "maneuvering"],
      [6, 6, "plate", "fuel"],
      [7, 6, "plate", "engine_s"],
      [8, 6, "spine", "engine_s"],
    ]),
  };

  const vanguard: ShipRecord = {
    id: "ship-vanguard",
    name: "Vanguard Aegis",
    updatedAt: now - 3600_000 * 3,
    equipment: [],
    cells: buildMirrored([
      [8, 1, "armor", "railgun"],
      [7, 2, "armor"],
      [8, 2, "spine", "cockpit"],
      [6, 3, "plate", "pd"],
      [7, 3, "bulkhead", "shield_emit"],
      [8, 3, "bulkhead", "reactor_l"],
      [5, 4, "armor", "laser"],
      [6, 4, "plate", "missile"],
      [7, 4, "bulkhead", "shield_cap"],
      [8, 4, "spine"],
      [4, 5, "frame", "maneuvering"],
      [5, 5, "plate", "solar"],
      [6, 5, "plate", "fuel"],
      [7, 5, "bulkhead", "cargo"],
      [8, 5, "bulkhead", "reactor_s"],
      [5, 6, "armor"],
      [6, 6, "plate", "engine_l"],
      [7, 6, "plate", "engine_s"],
      [8, 6, "spine", "engine_l"],
    ]),
  };

  const nyx: ShipRecord = {
    id: "ship-nyx",
    name: "Nyx Driftwing",
    updatedAt: now - 3600_000,
    equipment: [],
    cells: buildMirrored([
      [8, 2, "frame", "cockpit"],
      [7, 3, "frame"],
      [8, 3, "plate", "capacitor"],
      [6, 4, "frame", "laser"],
      [7, 4, "plate", "shield_emit"],
      [8, 4, "plate", "reactor_s"],
      [5, 5, "frame", "laser"],
      [6, 5, "plate", "missile"],
      [7, 5, "plate", "fuel"],
      [8, 5, "spine", "engine_l"],
      [4, 6, "frame", "maneuvering"],
      [6, 6, "frame", "engine_s"],
    ]),
  };

  return [kestrel, vanguard, nyx];
}

export function createBlankShip(name = "Untitled Vessel"): ShipRecord {
  return {
    id: `ship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    updatedAt: Date.now(),
    equipment: [],
    cells: buildMirrored([
      [8, 5, "plate", "cockpit"],
      [7, 6, "frame"],
      [8, 6, "plate", "reactor_s"],
      [8, 7, "plate", "engine_s"],
    ]),
  };
}

export function loadFleet(): ShipRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const starter = createStarterFleet();
      saveFleet(starter);
      return starter;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const starter = createStarterFleet();
      saveFleet(starter);
      return starter;
    }
    return parsed;
  } catch {
    return createStarterFleet();
  }
}

export function saveFleet(fleet: ShipRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fleet));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function upsertShip(ship: ShipRecord): ShipRecord[] {
  const fleet = loadFleet();
  const existing = fleet.find((s) => s.id === ship.id);
  const normalized: ShipRecord = {
    ...ship,
    updatedAt: Date.now(),
    cells: cellsToArray(cellsFromArray(ship.cells)),
    equipment: ship.equipment ?? existing?.equipment ?? [],
  };
  const idx = fleet.findIndex((s) => s.id === normalized.id);
  if (idx >= 0) {
    fleet[idx] = normalized;
  } else {
    fleet.unshift(normalized);
  }
  saveFleet(fleet);
  return fleet;
}

export function deleteShipById(id: string): ShipRecord[] {
  const fleet = loadFleet().filter((s) => s.id !== id);
  saveFleet(fleet);
  return fleet;
}

export function duplicateShipById(id: string): { fleet: ShipRecord[]; copy: ShipRecord | null } {
  const fleet = loadFleet();
  const source = fleet.find((s) => s.id === id);
  if (!source) return { fleet, copy: null };
  const copy: ShipRecord = {
    id: `ship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${source.name} Copy`,
    updatedAt: Date.now(),
    equipment: source.equipment ? source.equipment.map((e) => ({ ...e, effect: { ...e.effect } })) : [],
    cells: source.cells.map((c) => ({
      ...c,
      mod: c.mod ? { ...c.mod } : undefined,
    })),
  };
  fleet.unshift(copy);
  saveFleet(fleet);
  return { fleet, copy };
}

export function grantRandomEquipmentToFleet(): {
  fleet: ShipRecord[];
  grants: FleetEquipmentGrant[];
} {
  const fleet = loadFleet();
  const grants: FleetEquipmentGrant[] = [];
  const nextFleet = fleet.map((ship) => {
    const eq = rollRandomEquipment();
    grants.push({
      shipId: ship.id,
      shipName: ship.name,
      equipment: eq,
    });
    return {
      ...ship,
      updatedAt: Date.now(),
      equipment: [...(ship.equipment ?? []), eq],
    };
  });
  saveFleet(nextFleet);
  return { fleet: nextFleet, grants };
}
