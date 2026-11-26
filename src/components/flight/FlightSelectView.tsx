import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  Plus,
  Wrench,
  Zap,
} from "lucide-react";
import { cellsFromArray, computeStats } from "@/lib/parts";
import { ShipRecord } from "@/lib/ships";
import ShipPreview from "@/components/ship/ShipPreview";

interface FlightSelectViewProps {
  fleet: ShipRecord[];
  selectedShipId: string;
  onStartGame: (shipId: string) => void;
  onEditShip: (shipId: string) => void;
  onCreateShip: () => void;
}

export default function FlightSelectView({
  fleet,
  selectedShipId,
  onStartGame,
  onEditShip,
  onCreateShip,
}: FlightSelectViewProps) {
  const [focusedId, setFocusedId] = useState<string>(
    () => fleet.find((s) => s.id === selectedShipId)?.id ?? fleet[0]?.id ?? ""
  );

  const focusedShip = useMemo(
    () => fleet.find((s) => s.id === focusedId) ?? fleet[0] ?? null,
    [fleet, focusedId]
  );

  const focusedStats = useMemo(() => {
    if (!focusedShip) return null;
    return computeStats(cellsFromArray(focusedShip.cells), undefined, focusedShip.equipment);
  }, [focusedShip]);

  if (fleet.length === 0) {
    return (
      <main className="mx-auto max-w-[1520px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-md rounded-xl border border-[#1B2433] bg-[#0C1119] p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-[#E8EDF5]">
            No ships available
          </h1>
          <p className="mt-2 text-sm text-[#8895A7]">
            Build a ship in the shipyard before launching into flight.
          </p>
          <button
            type="button"
            onClick={onCreateShip}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF]"
          >
            <Plus className="h-4 w-4" />
            <span>Build New Ship</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1520px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
      {/* Header Row */}
      <section className="flex flex-col justify-between gap-6 border-b border-[#1B2433] pb-8 md:flex-row md:items-end">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[#E8EDF5] sm:text-5xl [text-wrap:balance]">
            Choose your <span className="text-[#5EEAD4]">vessel</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#8895A7] sm:text-base">
            Pick any ship from your fleet to enter flight. Your hull armor, shields, thrusters, weapons, and power grid carry straight into combat.
          </p>
        </div>

        {focusedShip && focusedStats && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onEditShip(focusedShip.id)}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#0C1119] px-4 text-sm font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55] hover:bg-[#111825]"
            >
              <Wrench className="h-4 w-4" />
              <span>Edit {focusedShip.name}</span>
            </button>
            <button
              type="button"
              onClick={() => onStartGame(focusedShip.id)}
              disabled={focusedStats.cellsCount === 0}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-5 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Enter Star Map</span>
            </button>
          </div>
        )}
      </section>

      {/* Ship Selection Grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {fleet.map((ship) => {
          const cellMap = cellsFromArray(ship.cells);
          const stats = computeStats(cellMap, undefined, ship.equipment);
          const equipmentList = ship.equipment ?? [];
          const isSelected = focusedShip?.id === ship.id;

          return (
            <article
              key={ship.id}
              onClick={() => setFocusedId(ship.id)}
              className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-colors ${
                isSelected
                  ? "border-[#5EEAD4] bg-[#0E1623]"
                  : "border-[#1B2433] bg-[#0C1119] hover:border-[#2C3B52]"
              }`}
            >
              {/* Preview */}
              <div className="blueprint-grid relative aspect-[17/10] w-full overflow-hidden border-b border-[#1B2433] bg-[#080C14] p-6">
                <ShipPreview
                  cells={cellMap}
                  className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-semibold text-[#E8EDF5]">
                      {ship.name}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-[#8895A7] tabular-nums">
                      {stats.shipClass} · {stats.cellsCount} hull · {stats.mass}t
                    </p>
                  </div>
                  {isSelected && (
                    <span className="font-mono text-xs font-semibold text-[#5EEAD4]">
                      Selected
                    </span>
                  )}
                </div>

                {/* Combat & Flight Stats */}
                <div className="mt-4 grid grid-cols-5 gap-2 border-t border-[#1B2433] pt-4 font-mono tabular-nums">
                  <div>
                    <div className="text-[11px] text-[#8895A7]">Hull</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#E8EDF5]">
                      {stats.hullHP}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8895A7]">Shield</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#A78BFA]">
                      {stats.shield}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8895A7]">Dmg</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#FB7185]">
                      {stats.dmg}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8895A7]">Speed</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#5EEAD4]">
                      {stats.hasThrusters ? stats.topSpeed : 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8895A7]">Power</div>
                    <div
                      className={`mt-0.5 text-sm font-semibold ${
                        stats.powerNet < 0 ? "text-[#FBBF24]" : "text-[#E8EDF5]"
                      }`}
                    >
                      {stats.powerNet >= 0 ? `+${stats.powerNet}` : stats.powerNet}
                    </div>
                  </div>
                </div>

                {/* Readiness Status */}
                <div className="mt-4 border-t border-[#1B2433] pt-3">
                  {stats.cellsCount === 0 ? (
                    <p className="flex items-center gap-1.5 text-xs text-[#FB7185]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Empty hull — paint cells in Shipyard first</span>
                    </p>
                  ) : !stats.hasThrusters ? (
                    <p className="flex items-center gap-1.5 text-xs text-[#FB7185]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>No thrusters — cannot move in flight</span>
                    </p>
                  ) : stats.isPowerOverloaded ? (
                    <p className="flex items-center gap-1.5 text-xs text-[#FBBF24]">
                      <Zap className="h-3.5 w-3.5 shrink-0" />
                      <span>Power deficit — modules will brown out in flight</span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-[#5EEAD4]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Combat ready</span>
                    </p>
                  )}

                  {equipmentList.length > 0 && (
                    <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-[#5EEAD4]">
                      {equipmentList.map((eq) => (
                        <li key={eq.id} className="truncate">
                          {eq.name} · {eq.effectLabel}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Launch Action */}
                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartGame(ship.id);
                    }}
                    disabled={stats.cellsCount === 0}
                    className={`inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isSelected
                        ? "bg-[#5EEAD4] text-[#060910] hover:bg-[#7FF0DF]"
                        : "border border-[#1B2433] bg-[#111825] text-[#E8EDF5] hover:border-[#5EEAD4]/60 hover:bg-[#162032]"
                    }`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Enter Star Map</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
