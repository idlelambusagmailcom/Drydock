import {
  Award,
  Compass,
  Crosshair,
  Keyboard,
  Layers,
  Shield,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { SHIP_CLASS_THRESHOLDS } from "@/lib/parts";
import { FleetEquipmentGrant } from "@/lib/ships";

interface HomeViewProps {
  playerLevel: number;
  recentGrants: FleetEquipmentGrant[];
  onDismissGrants: () => void;
  onCreateShip: () => void;
}

const SECTOR_MODIFIER_GUIDE = [
  {
    name: "Swarm Formations",
    detail: "Spawns extra enemy Bubble Drones in every wave.",
  },
  {
    name: "Boosted Firepower",
    detail: "Enemy plasma bolts and collisions deal heavier hull damage.",
  },
  {
    name: "Armored Hulls",
    detail: "Drones carry reinforced inner health and thicker shield pools.",
  },
  {
    name: "Rapid Volleys",
    detail: "Enemy turrets fire more frequently across the arena.",
  },
  {
    name: "Surging Shields",
    detail: "Outer bubble shields regenerate noticeably faster between hits.",
  },
  {
    name: "Agile Interceptors",
    detail: "Drones close distance and orbit your vessel at higher speeds.",
  },
];

const FLIGHT_CONTROLS = [
  { key: "W / Up Arrow", action: "Fire main thrusters forward" },
  { key: "A / D or Left / Right", action: "Rotate ship heading" },
  { key: "S / Down Arrow", action: "Retro-brake to slow velocity" },
  { key: "Tab", action: "Activate Booster for 2× speed (5s)" },
  { key: "Spacebar", action: "Fire all powered weapons" },
  { key: "P or Esc", action: "Pause or resume combat" },
];

const SHIPYARD_SHORTCUTS = [
  { key: "Drag & Drop", action: "Mount or reposition hull modules" },
  { key: "R", action: "Rotate selected thruster or turret" },
  { key: "M", action: "Toggle centerline mirror symmetry" },
  { key: "Ctrl + Z", action: "Undo recent grid edits" },
  { key: "Right Click", action: "Erase hull cell or module" },
];

export default function HomeView({
  playerLevel,
  recentGrants,
  onDismissGrants,
  onCreateShip,
}: HomeViewProps) {
  return (
    <main className="mx-auto max-w-[1520px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      {recentGrants.length > 0 && (
        <section
          aria-label="Sector Completion Rewards"
          className="mb-8 rounded-xl border border-[#5EEAD4]/55 bg-[#0C1520] p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5EEAD4]/15 text-[#5EEAD4]">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[#E8EDF5]">
                  Level {playerLevel} Reached — Sector Boss Defeated
                </h2>
                <p className="mt-0.5 text-sm text-[#8895A7]">
                  The star map refreshed and every vessel in your fleet received new special Equipment with random effects:
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onDismissGrants}
              aria-label="Dismiss reward notice"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {recentGrants.map((g) => (
              <div
                key={`${g.shipId}-${g.equipment.id}`}
                className="rounded-lg border border-[#1B2433] bg-[#080C14] px-3.5 py-2.5 font-mono text-xs"
              >
                <div className="font-semibold text-[#E8EDF5]">{g.shipName}</div>
                <div className="mt-0.5 text-[#5EEAD4]">
                  {g.equipment.name} · {g.equipment.effectLabel}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="border-b border-[#1B2433] pb-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#5EEAD4]">
              Naval Shipyard &amp; Sector Combat
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[#E8EDF5] sm:text-5xl [text-wrap:balance]">
              Engineer your fleet.{" "}
              <span className="text-[#5EEAD4]">Clear the star map.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#8895A7] sm:text-base">
              Assemble custom ships cell by cell in the Shipyard, test flight handling directly from your Hangar, and deploy into multi-wave star systems to earn fleet-wide Equipment upgrades and level up.
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onCreateShip}
              className="inline-flex h-14 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl bg-[#5EEAD4] px-8 text-base font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] focus-visible:outline-2 focus-visible:outline-[#5EEAD4]"
            >
              <Wrench className="h-5 w-5" />
              <span>Build New Ship</span>
            </button>
          </div>
        </div>
      </section>

      {/* Core Loop */}
      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
          <div className="flex items-center gap-2.5 text-[#5EEAD4]">
            <Layers className="h-4 w-4 shrink-0" />
            <h2 className="font-display text-base font-semibold text-[#E8EDF5]">
              01. Construct &amp; Balance
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[#8895A7]">
            Paint structural hulls on the 17×13 grid and mount power reactors, thrusters, shields, and weapons. Total mass determines your ship class, while power deficits trigger live module brownouts.
          </p>
        </div>

        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
          <div className="flex items-center gap-2.5 text-[#5EEAD4]">
            <Compass className="h-4 w-4 shrink-0" />
            <h2 className="font-display text-base font-semibold text-[#E8EDF5]">
              02. Test &amp; Chart Sectors
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[#8895A7]">
            Run solo Test Flights from under any vessel card in the Hangar, or enter Flight to pick a star system. Each star features 1–5 waves, Difficulty 1–10, and its own combat modifier.
          </p>
        </div>

        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
          <div className="flex items-center gap-2.5 text-[#5EEAD4]">
            <Crosshair className="h-4 w-4 shrink-0" />
            <h2 className="font-display text-base font-semibold text-[#E8EDF5]">
              03. Break Bubble Drones
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[#8895A7]">
            Bubble Drones regenerate an outer shield layer before taking inner hull damage. Clear all 25 stars to unlock the Difficulty 15/10 Sector Boss, defeat it to claim new fleet Equipment, and level up.
          </p>
        </div>
      </section>

      {/* Ship Engineering & Flight Mechanics */}
      <section className="mt-12 border-t border-[#1B2433] pt-10">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[#E8EDF5]">
            Ship Engineering &amp; Combat Systems
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8895A7]">
            Every cell and module on your grid directly affects how your ship moves, fires, and survives during battle.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
            <div className="flex items-center gap-2.5 text-[#FBBF24]">
              <Zap className="h-4 w-4 shrink-0" />
              <h3 className="font-display text-base font-semibold text-[#E8EDF5]">
                Power Generation &amp; Brownouts
              </h3>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-[#8895A7]">
              A Cockpit control station is required to bring any ship online—without one, no power turns on and nothing on the vessel operates. With a Cockpit active, power deficits cause modules to switch off for 3–5 seconds at a time before cycling power to another system.
            </p>
            <div className="mt-4 border-t border-[#1B2433] pt-4 text-sm text-[#8895A7]">
              <span className="font-medium text-[#E8EDF5]">Thruster Requirement:</span>{" "}
              A ship without at least one propulsion thruster cannot accelerate forward in either Test Flight or star combat.
            </div>
          </div>

          <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
            <div className="flex items-center gap-2.5 text-[#A78BFA]">
              <Shield className="h-4 w-4 shrink-0" />
              <h3 className="font-display text-base font-semibold text-[#E8EDF5]">
                Two-Layer Bubble Drones &amp; Rewards
              </h3>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-[#8895A7]">
              Every enemy Bubble Drone has two defense layers: a glowing outer shield bubble that continuously regenerates over time, and an inner health bar. Sustained fire strips the outer shield so shots damage the core until the drone is destroyed.
            </p>
            <div className="mt-4 border-t border-[#1B2433] pt-4 text-sm text-[#8895A7]">
              <span className="font-medium text-[#E8EDF5]">Sector Completion &amp; Boss Loop:</span>{" "}
              Defeating all waves in a star system blacks it out on the Star Map. Once all 25 stars are cleared, a Difficulty 15/10 Boss with 10× HP unlocks while spawning small drones every 3 seconds—defeating it levels up your Commander rank, grants every vessel random special Equipment, and refreshes the map.
            </div>
          </div>
        </div>
      </section>

      {/* Ship Class Mass Thresholds & Sector Difficulty Modifiers */}
      <section className="mt-12 grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 lg:col-span-5">
          <h3 className="font-display text-base font-semibold text-[#E8EDF5]">
            Ship Class by Total Mass
          </h3>
          <p className="mt-1.5 text-sm text-[#8895A7]">
            Adding hull armor and heavier modules pushes your ship into larger vessel classes.
          </p>
          <dl className="mt-4 divide-y divide-[#1B2433] border-t border-[#1B2433]">
            {SHIP_CLASS_THRESHOLDS.map((tier) => (
              <div
                key={tier.name}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <dt className="font-medium text-[#E8EDF5]">{tier.name}</dt>
                <dd className="font-mono text-xs text-[#5EEAD4] tabular-nums">
                  {tier.range} mass
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 lg:col-span-7">
          <h3 className="font-display text-base font-semibold text-[#E8EDF5]">
            Star System Difficulty (1–10) &amp; Modifiers
          </h3>
          <p className="mt-1.5 text-sm text-[#8895A7]">
            Each star features 1 to 5 enemy waves, a 1–10 difficulty rating, and a specific combat modifier shown when hovering over its star on the map.
          </p>
          <div className="mt-4 grid gap-4 border-t border-[#1B2433] pt-4 sm:grid-cols-2">
            {SECTOR_MODIFIER_GUIDE.map((mod) => (
              <div key={mod.name}>
                <div className="text-sm font-medium text-[#E8EDF5]">
                  {mod.name}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[#8895A7]">
                  {mod.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Controls & Shipyard Shortcuts */}
      <section className="mt-12 rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
        <div className="flex items-center gap-2.5 text-[#5EEAD4]">
          <Keyboard className="h-4 w-4 shrink-0" />
          <h3 className="font-display text-base font-semibold text-[#E8EDF5]">
            Flight Controls &amp; Shipyard Shortcuts
          </h3>
        </div>

        <div className="mt-5 grid gap-8 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-[#8895A7]">
              In-Flight Controls
            </div>
            <dl className="mt-2.5 divide-y divide-[#1B2433] border-t border-[#1B2433]">
              {FLIGHT_CONTROLS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <dt className="font-mono text-xs text-[#5EEAD4]">
                    {row.key}
                  </dt>
                  <dd className="text-right text-xs text-[#8895A7]">
                    {row.action}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <div className="text-xs font-medium text-[#8895A7]">
              Shipyard Editor
            </div>
            <dl className="mt-2.5 divide-y divide-[#1B2433] border-t border-[#1B2433]">
              {SHIPYARD_SHORTCUTS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <dt className="font-mono text-xs text-[#5EEAD4]">
                    {row.key}
                  </dt>
                  <dd className="text-right text-xs text-[#8895A7]">
                    {row.action}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
