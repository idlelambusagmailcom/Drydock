import { useMemo } from "react";
import { Copy, Play, Trash2, Wrench } from "lucide-react";
import { cellsFromArray, computeStats } from "@/lib/parts";
import { ShipRecord } from "@/lib/ships";
import ShipPreview from "@/components/ship/ShipPreview";

interface ShipCardProps {
  ship: ShipRecord;
  onEdit: (id: string) => void;
  onFly: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ShipCard({
  ship,
  onEdit,
  onFly,
  onDuplicate,
  onDelete,
}: ShipCardProps) {
  const cellMap = useMemo(() => cellsFromArray(ship.cells), [ship.cells]);
  const stats = useMemo(
    () => computeStats(cellMap, undefined, ship.equipment),
    [cellMap, ship.equipment]
  );
  const equipmentList = ship.equipment ?? [];

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[#1B2433] bg-[#0C1119] transition-colors hover:border-[#2B3A52]">
      {/* Interactive Preview Stage */}
      <button
        type="button"
        onClick={() => onEdit(ship.id)}
        className="blueprint-grid relative aspect-[17/11] w-full overflow-hidden border-b border-[#1B2433] bg-[#080C14] p-6 text-left transition-colors group-hover:bg-[#090E18] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#5EEAD4]"
      >
        <ShipPreview
          cells={cellMap}
          className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03]"
        />
      </button>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-[#E8EDF5]">
              {ship.name}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-[#8895A7] tabular-nums">
              {stats.shipClass} · {stats.cellsCount} hull · {stats.mass}t
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onDuplicate(ship.id)}
              title="Duplicate vessel"
              aria-label={`Duplicate ${ship.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5] focus-visible:outline-2 focus-visible:outline-[#5EEAD4]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(ship.id)}
              title="Delete vessel"
              aria-label={`Delete ${ship.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#8895A7] transition-colors hover:bg-[#FB7185]/10 hover:text-[#FB7185] focus-visible:outline-2 focus-visible:outline-[#FB7185]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clean 4-Metric Telemetry Strip */}
        <div className="mt-4 grid grid-cols-4 gap-3 border-t border-[#1B2433] pt-4 font-mono tabular-nums">
          <div>
            <div className="text-[11px] text-[#8895A7]">Speed</div>
            <div className="mt-0.5 text-sm font-semibold text-[#5EEAD4]">
              {stats.hasThrusters ? stats.topSpeed : "0"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#8895A7]">Firepower</div>
            <div className="mt-0.5 text-sm font-semibold text-[#FB7185]">
              {stats.dmg}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#8895A7]">Shields</div>
            <div className="mt-0.5 text-sm font-semibold text-[#A78BFA]">
              {stats.shield}
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

        {equipmentList.length > 0 && (
          <div className="mt-3 border-t border-[#1B2433] pt-3">
            <div className="text-[11px] font-medium text-[#8895A7]">
              Equipment
            </div>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[#5EEAD4]">
              {equipmentList.map((eq) => (
                <li key={eq.id} className="truncate">
                  {eq.name} · {eq.effectLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onEdit(ship.id)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55] hover:bg-[#162032] focus-visible:outline-2 focus-visible:outline-[#5EEAD4]"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onFly(ship.id)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] focus-visible:outline-2 focus-visible:outline-[#5EEAD4]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Test Flight</span>
          </button>
        </div>
      </div>
    </article>
  );
}
