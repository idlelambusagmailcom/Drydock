import { AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { ShipEquipment } from "@/lib/equipment";
import { ShipStats } from "@/lib/parts";

interface StatsPanelProps {
  stats: ShipStats;
  equipment?: ShipEquipment[];
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color: string;
}

function StatBar({ label, value, max, unit = "", color }: StatBarProps) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[#8895A7]">{label}</span>
        <span className="font-mono font-semibold text-[#E8EDF5] tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function StatsPanel({ stats, equipment = [] }: StatsPanelProps) {
  const powerMax = Math.max(1, stats.gen, stats.draw);
  const genPct = Math.round((stats.gen / powerMax) * 100);
  const drawPct = Math.round((stats.draw / powerMax) * 100);

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-[#1B2433] bg-[#0C1119] p-4">
      {/* Ship Classification & Mass Header */}
      <div className="border-b border-[#1B2433] pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-[#8895A7]">Vessel Class</div>
            <div className="mt-0.5 font-display text-xl font-semibold text-[#E8EDF5]">
              {stats.shipClass}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums">
            <div className="text-xs text-[#8895A7]">Total Mass</div>
            <div className="mt-0.5 text-lg font-semibold text-[#E8EDF5]">
              {stats.mass}t
            </div>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-[#8895A7] tabular-nums">
          {stats.cellsCount} hull cells · {stats.modulesCount} systems
        </p>
      </div>

      {/* Power Grid Balance */}
      <div className="border-b border-[#1B2433] pb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#E8EDF5]">
            <Zap className="h-3.5 w-3.5 text-[#FBBF24]" />
            <span>Power Grid</span>
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              !stats.hasCockpit
                ? "text-[#FB7185]"
                : stats.isPowerOverloaded
                ? "text-[#FBBF24]"
                : "text-[#5EEAD4]"
            }`}
          >
            {!stats.hasCockpit
              ? "Offline"
              : stats.powerNet >= 0
              ? `+${stats.powerNet} surplus`
              : `${stats.powerNet} deficit`}
          </span>
        </div>

        <div className="mt-2.5 space-y-2 font-mono text-[11px] tabular-nums">
          <div>
            <div className="flex justify-between text-[#8895A7]">
              <span>Generation</span>
              <span className="text-[#5EEAD4]">+{stats.gen}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
              <div
                className="h-full rounded-full bg-[#5EEAD4] transition-all duration-200"
                style={{ width: `${genPct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[#8895A7]">
              <span>Consumption</span>
              <span className={stats.isPowerOverloaded ? "text-[#FB7185]" : "text-[#FBBF24]"}>
                -{stats.draw}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  stats.isPowerOverloaded ? "bg-[#FB7185]" : "bg-[#FBBF24]"
                }`}
                style={{ width: `${drawPct}%` }}
              />
            </div>
          </div>
        </div>

        {stats.isPowerOverloaded && (
          <p className="mt-2.5 text-xs leading-snug text-[#FBBF24]">
            Draw exceeds generation. Powered modules will randomly cycle off and on during flight.
          </p>
        )}
      </div>

      {/* Combat & Propulsion Metrics */}
      <div className="space-y-3.5 border-b border-[#1B2433] pb-4">
        <StatBar label="Top Speed" value={stats.topSpeed} max={140} unit=" m/s" color="#5EEAD4" />
        <StatBar label="Handling" value={stats.handling} max={60} color="#60A5FA" />
        <StatBar label="Firepower" value={stats.dmg} max={120} color="#FB7185" />
        <StatBar label="Shields" value={stats.shield} max={100} color="#A78BFA" />
        <StatBar label="Hull Integrity" value={stats.hullHP} max={350} color="#94A3B8" />
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-[#8895A7]">Range / Cargo</span>
          <span className="font-mono text-[#E8EDF5] tabular-nums">
            {stats.range} ly · {stats.cargo} t
          </span>
        </div>
        {stats.boostCharges > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8895A7]">Boosters (Tab)</span>
            <span className="font-mono text-[#FBBF24] tabular-nums">
              {stats.boostCharges} {stats.boostCharges === 1 ? "boost" : "boosts"} · 2× / 5s
            </span>
          </div>
        )}
      </div>

      {/* Special Equipment */}
      {equipment.length > 0 && (
        <div className="space-y-2 border-b border-[#1B2433] pb-4">
          <div className="text-xs font-medium text-[#E8EDF5]">
            Special Equipment
          </div>
          <ul className="space-y-1.5">
            {equipment.map((eq) => (
              <li key={eq.id} className="font-mono text-xs">
                <div className="text-[#E8EDF5]">{eq.name}</div>
                <div className="text-[11px] text-[#5EEAD4]">{eq.effectLabel}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flight Readiness Checklist */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-[#E8EDF5]">Flight Readiness</div>

        {stats.warnings.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-[#5EEAD4]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>All flight systems nominal</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {stats.warnings.map((w) => (
              <li
                key={w.id}
                className={`flex items-start gap-2 text-xs leading-snug ${
                  w.level === "error" ? "text-[#FB7185]" : "text-[#FBBF24]"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
