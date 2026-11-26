export type SectorTrait =
  | "swarm"
  | "firepower"
  | "armored"
  | "rapid"
  | "regen"
  | "agile";

export interface StarSector {
  id: string;
  name: string;
  x: number; // percentage 8..92
  y: number; // percentage 14..86
  size: number; // px radius 4..8
  color: string;
  difficulty: number; // 1..10 (15 for sector boss)
  waves: 1 | 2 | 3 | 4 | 5;
  trait: SectorTrait;
  traitLabel: string;
  isBoss?: boolean;
}

export const STAR_MAP_BOSS_SECTOR: StarSector = {
  id: "omega-dreadcore",
  name: "Omega Dreadcore",
  x: 50,
  y: 50,
  size: 11,
  color: "#FB7185",
  difficulty: 15,
  waves: 1,
  trait: "firepower",
  traitLabel: "10× HP Boss · Spawns drones every 3s",
  isBoss: true,
};

export const STAR_SECTORS: StarSector[] = [
  { id: "vega-drift", name: "Vega Drift", x: 14, y: 24, size: 5, color: "#5EEAD4", difficulty: 1, waves: 1, trait: "swarm", traitLabel: "Light scout patrol" },
  { id: "aquila-spire", name: "Aquila Spire", x: 13, y: 81, size: 5, color: "#E8EDF5", difficulty: 2, waves: 2, trait: "agile", traitLabel: "Swift flanker drones" },
  { id: "cygnus-reach", name: "Cygnus Reach", x: 25, y: 18, size: 5, color: "#60A5FA", difficulty: 2, waves: 2, trait: "regen", traitLabel: "Steady shield recharge" },
  { id: "lyra-crossing", name: "Lyra Crossing", x: 35, y: 43, size: 6, color: "#5EEAD4", difficulty: 3, waves: 2, trait: "firepower", traitLabel: "Boosted bolt damage" },
  { id: "perseus-corridor", name: "Perseus Corridor", x: 58, y: 57, size: 5, color: "#E8EDF5", difficulty: 3, waves: 3, trait: "swarm", traitLabel: "Extra drones per wave" },

  { id: "kestrel-rift", name: "Kestrel Rift", x: 38, y: 22, size: 6, color: "#E8EDF5", difficulty: 4, waves: 3, trait: "agile", traitLabel: "High-speed interceptors" },
  { id: "helios-verge", name: "Helios Verge", x: 11, y: 45, size: 6, color: "#FBBF24", difficulty: 4, waves: 2, trait: "rapid", traitLabel: "Rapid enemy fire rate" },
  { id: "deneb-outpost", name: "Deneb Outpost", x: 42, y: 83, size: 5, color: "#60A5FA", difficulty: 4, waves: 3, trait: "armored", traitLabel: "Reinforced bubble hulls" },
  { id: "ashen-belt", name: "Ashen Belt", x: 52, y: 17, size: 6, color: "#FBBF24", difficulty: 5, waves: 3, trait: "swarm", traitLabel: "Dense drone swarms" },
  { id: "altair-shoals", name: "Altair Shoals", x: 63, y: 42, size: 6, color: "#60A5FA", difficulty: 5, waves: 3, trait: "regen", traitLabel: "Fast regenerating shields" },

  { id: "cassiopeia-crown", name: "Cassiopeia Crown", x: 30, y: 58, size: 7, color: "#FBBF24", difficulty: 6, waves: 4, trait: "firepower", traitLabel: "High-damage plasma bolts" },
  { id: "fomalhaut-rim", name: "Fomalhaut Rim", x: 56, y: 79, size: 6, color: "#FBBF24", difficulty: 6, waves: 3, trait: "rapid", traitLabel: "Accelerated enemy volleys" },
  { id: "solstice-gate", name: "Solstice Gate", x: 67, y: 21, size: 7, color: "#5EEAD4", difficulty: 7, waves: 4, trait: "armored", traitLabel: "Heavy shield & hull plating" },
  { id: "draco-basin", name: "Draco Basin", x: 23, y: 39, size: 6, color: "#FB7185", difficulty: 7, waves: 4, trait: "firepower", traitLabel: "Heavy projectile impact" },
  { id: "rigel-abyss", name: "Rigel Abyss", x: 17, y: 63, size: 6, color: "#60A5FA", difficulty: 7, waves: 4, trait: "regen", traitLabel: "Surging outer shields" },

  { id: "sirius-forge", name: "Sirius Forge", x: 44, y: 62, size: 7, color: "#5EEAD4", difficulty: 8, waves: 4, trait: "swarm", traitLabel: "Large multi-drone waves" },
  { id: "orion-expanse", name: "Orion Expanse", x: 82, y: 19, size: 7, color: "#A78BFA", difficulty: 8, waves: 4, trait: "agile", traitLabel: "Aggressive fast orbits" },
  { id: "taurus-bastion", name: "Taurus Bastion", x: 89, y: 44, size: 6, color: "#FB7185", difficulty: 8, waves: 5, trait: "armored", traitLabel: "Fortified heavy bubbles" },
  { id: "carina-nebula", name: "Carina Nebula", x: 28, y: 78, size: 7, color: "#FB7185", difficulty: 8, waves: 4, trait: "rapid", traitLabel: "Relentless turret fire" },
  { id: "arcturus-well", name: "Arcturus Well", x: 70, y: 82, size: 7, color: "#5EEAD4", difficulty: 9, waves: 5, trait: "regen", traitLabel: "Rapidly mending shields" },

  { id: "polaris-crucible", name: "Polaris Crucible", x: 77, y: 38, size: 7, color: "#E8EDF5", difficulty: 9, waves: 5, trait: "firepower", traitLabel: "Lethal overcharged bolts" },
  { id: "nyx-hollow", name: "Nyx Hollow", x: 49, y: 37, size: 8, color: "#A78BFA", difficulty: 9, waves: 5, trait: "swarm", traitLabel: "Massive drone formations" },
  { id: "antares-deep", name: "Antares Deep", x: 85, y: 65, size: 7, color: "#FB7185", difficulty: 10, waves: 5, trait: "rapid", traitLabel: "Hyper-velocity barrage" },
  { id: "andromeda-vault", name: "Andromeda Vault", x: 72, y: 61, size: 8, color: "#A78BFA", difficulty: 10, waves: 5, trait: "armored", traitLabel: "Apex armored dread-bubbles" },
  { id: "betelgeuse-core", name: "Betelgeuse Core", x: 84, y: 80, size: 8, color: "#FB7185", difficulty: 10, waves: 5, trait: "firepower", traitLabel: "Maximum firepower threat" },
];

const CLEARED_KEY = "drydock_cleared_sectors_v1";
const LEVEL_KEY = "drydock_player_level_v1";

export function loadClearedSectors(): string[] {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveClearedSectors(ids: string[]): void {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(ids));
  } catch {
    // Ignore quota errors
  }
}

export function loadPlayerLevel(): number {
  try {
    const raw = localStorage.getItem(LEVEL_KEY);
    if (!raw) return 1;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  } catch {
    return 1;
  }
}

export function savePlayerLevel(level: number): void {
  try {
    localStorage.setItem(LEVEL_KEY, String(Math.max(1, Math.floor(level))));
  } catch {
    // Ignore quota errors
  }
}
