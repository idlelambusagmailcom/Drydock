import { useMemo, useState } from "react";
import { Award, Plus, RotateCcw, Search, X } from "lucide-react";
import {
  SHIP_CLASS_THRESHOLDS,
  cellsFromArray,
  computeStats,
} from "@/lib/parts";
import { FleetEquipmentGrant, ShipRecord } from "@/lib/ships";
import ShipCard from "./ShipCard";

interface HangarViewProps {
  fleet: ShipRecord[];
  recentGrants: FleetEquipmentGrant[];
  onDismissGrants: () => void;
  onCreateShip: () => void;
  onEditShip: (id: string) => void;
  onFlyShip: (id: string) => void;
  onDuplicateShip: (id: string) => void;
  onDeleteShip: (id: string) => void;
  onRestoreStarters: () => void;
}

export default function HangarView({
  fleet,
  recentGrants,
  onDismissGrants,
  onCreateShip,
  onEditShip,
  onFlyShip,
  onDuplicateShip,
  onDeleteShip,
  onRestoreStarters,
}: HangarViewProps) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("All");

  const classesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const s of fleet) {
      const st = computeStats(cellsFromArray(s.cells), undefined, s.equipment);
      set.add(st.shipClass);
    }
    return ["All", ...Array.from(set)];
  }, [fleet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleet.filter((ship) => {
      if (q && !ship.name.toLowerCase().includes(q)) return false;
      if (classFilter !== "All") {
        const st = computeStats(cellsFromArray(ship.cells), undefined, ship.equipment);
        if (st.shipClass !== classFilter) return false;
      }
      return true;
    });
  }, [fleet, query, classFilter]);

  return (
    <main className="mx-auto max-w-[1520px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
      {/* Fleet Equipment Reward Banner when all stars are blacked out */}
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
                  All Stars Cleared — Star Map Refreshed
                </h2>
                <p className="mt-0.5 text-sm text-[#8895A7]">
                  Every vessel in your fleet received new special Equipment with random effects:
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

      {/* Hero Header */}
      <section className="flex flex-col justify-between gap-6 border-b border-[#1B2433] pb-8 md:flex-row md:items-end">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[#E8EDF5] sm:text-5xl [text-wrap:balance]">
            Your <span className="text-[#5EEAD4]">fleet</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#8895A7] sm:text-base">
            Paint custom hulls cell by cell, drag reactors, thrusters, and weapons into place, and launch straight into test flight.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {fleet.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8895A7]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vessels..."
                aria-label="Search vessels"
                className="h-10 w-56 rounded-lg border border-[#1B2433] bg-[#0C1119] pl-9 pr-3 text-sm text-[#E8EDF5] placeholder:text-[#8895A7] focus:border-[#5EEAD4] focus:outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={onCreateShip}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] focus-visible:outline-2 focus-visible:outline-[#5EEAD4]"
          >
            <Plus className="h-4 w-4" />
            <span>Build New Ship</span>
          </button>
        </div>
      </section>

      {/* Class Filter Bar */}
      {fleet.length > 0 && classesPresent.length > 2 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by vessel class">
            {classesPresent.map((cls) => {
              const active = classFilter === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#1B2433] text-[#E8EDF5]"
                      : "text-[#8895A7] hover:bg-[#0C1119] hover:text-[#E8EDF5]"
                  }`}
                >
                  {cls}
                </button>
              );
            })}
          </div>

          <span className="font-mono text-xs text-[#8895A7] tabular-nums">
            {filtered.length} {filtered.length === 1 ? "vessel" : "vessels"}
          </span>
        </div>
      )}

      {/* Fleet Grid or Empty State */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ship) => (
            <ShipCard
              key={ship.id}
              ship={ship}
              onEdit={onEditShip}
              onFly={onFlyShip}
              onDuplicate={onDuplicateShip}
              onDelete={onDeleteShip}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-[#1B2433] bg-[#0C1119] px-6 py-16 text-center">
          <h2 className="font-display text-xl font-semibold text-[#E8EDF5]">
            {fleet.length === 0 ? "No vessels in drydock" : "No matching vessels"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#8895A7]">
            {fleet.length === 0
              ? "Start with a fresh hull template or restore the starter fleet to inspect working layouts."
              : "Clear your search filter or build a brand-new vessel from scratch."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onCreateShip}
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF]"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Ship</span>
            </button>
            {fleet.length === 0 && (
              <button
                type="button"
                onClick={onRestoreStarters}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restore Starter Fleet</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ship Class Mass Thresholds */}
      <section
        aria-label="Ship Class Mass Thresholds"
        className="mt-10 rounded-xl border border-[#1B2433] bg-[#0C1119]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1B2433] px-5 py-3">
          <h2 className="font-display text-sm font-semibold text-[#E8EDF5]">
            Ship Class by Total Mass
          </h2>
          <span className="text-xs text-[#8895A7]">
            Determined by combined hull and module mass
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-y-3 px-5 py-3.5 sm:grid-cols-4 lg:grid-cols-7 lg:gap-0 lg:p-0">
          {SHIP_CLASS_THRESHOLDS.map((tier) => {
            const active = classFilter === tier.name;
            return (
              <div
                key={tier.name}
                className={`transition-colors lg:border-r lg:border-[#1B2433] lg:px-4 lg:py-3 lg:last:border-r-0 ${
                  active ? "lg:bg-[#111825]" : ""
                }`}
              >
                <dt
                  className={`text-xs font-medium ${
                    active ? "text-[#5EEAD4]" : "text-[#E8EDF5]"
                  }`}
                >
                  {tier.name}
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-[#8895A7] tabular-nums">
                  {tier.range} mass
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </main>
  );
}
