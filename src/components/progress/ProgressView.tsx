import { useMemo } from "react";
import { Award, CheckCircle2, Circle, TrendingUp, X } from "lucide-react";
import { cellsFromArray, computeStats } from "@/lib/parts";
import { STAR_MAP_BOSS_SECTOR, STAR_SECTORS } from "@/lib/sectors";
import { FleetEquipmentGrant, ShipRecord } from "@/lib/ships";

interface ProgressViewProps {
  fleet: ShipRecord[];
  playerLevel: number;
  clearedSectorIds: string[];
  recentGrants: FleetEquipmentGrant[];
  onDismissGrants: () => void;
}

export default function ProgressView({
  fleet,
  playerLevel,
  clearedSectorIds,
  recentGrants,
  onDismissGrants,
}: ProgressViewProps) {
  const clearedSet = useMemo(() => new Set(clearedSectorIds), [clearedSectorIds]);
  const clearedCount = clearedSectorIds.length;
  const totalSectors = STAR_SECTORS.length;
  const progressPct = Math.round((clearedCount / Math.max(1, totalSectors)) * 100);
  const starsRemaining = Math.max(0, totalSectors - clearedCount);

  const bossReady = starsRemaining === 0;
  const nextSector = useMemo(() => {
    if (bossReady) return STAR_MAP_BOSS_SECTOR;
    return (
      STAR_SECTORS.find((s) => !clearedSet.has(s.id)) ?? STAR_SECTORS[0]
    );
  }, [bossReady, clearedSet]);

  const totalEquipmentCount = useMemo(
    () => fleet.reduce((sum, ship) => sum + (ship.equipment?.length ?? 0), 0),
    [fleet]
  );

  const fleetSummary = useMemo(
    () =>
      fleet.map((ship) => ({
        ship,
        stats: computeStats(cellsFromArray(ship.cells), undefined, ship.equipment),
      })),
    [fleet]
  );

  return (
    <main className="mx-auto max-w-[1520px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
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
                  The star map refreshed and every vessel in your fleet received new special Equipment:
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

      {/* Header */}
      <section className="border-b border-[#1B2433] pb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[#E8EDF5] sm:text-5xl [text-wrap:balance]">
          Campaign <span className="text-[#5EEAD4]">Progress</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#8895A7] sm:text-base">
          Track cleared star sectors, fleet readiness, special Equipment earned, and your Commander Level across full map clears.
        </p>

        {/* Commander Level Card */}
        <div className="mt-8 rounded-xl border border-[#1B2433] bg-[#0C1119] p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#5EEAD4]/35 bg-[#5EEAD4]/10 text-[#5EEAD4]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-[#8895A7]">Commander Level</div>
                <div className="mt-0.5 font-display text-2xl font-semibold text-[#E8EDF5] tabular-nums">
                  Level {playerLevel}
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="font-mono text-sm font-medium text-[#5EEAD4] tabular-nums">
                {bossReady
                  ? "Boss Ready · Difficulty 15/10"
                  : `${starsRemaining} ${starsRemaining === 1 ? "star" : "stars"} to Boss`}
              </div>
              <div className="mt-0.5 text-xs text-[#8895A7]">
                Clear all {totalSectors} star systems and defeat the Sector Boss to level up and earn fleet Equipment
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[#8895A7]">
              <span>Star Map Completion</span>
              <span className="font-mono tabular-nums text-[#E8EDF5]">
                {clearedCount} / {totalSectors} stars blacked out ({progressPct}%)
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#111825]">
              <div
                className="h-full bg-[#5EEAD4] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4 Core Progress Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-6 rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 sm:grid-cols-4">
          <div>
            <div className="text-xs text-[#8895A7]">Fleet Size</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-[#E8EDF5] tabular-nums">
              {fleet.length}
            </div>
            <div className="mt-0.5 text-xs text-[#8895A7]">
              {fleet.length === 1 ? "active vessel" : "active vessels"}
            </div>
          </div>

          <div>
            <div className="text-xs text-[#8895A7]">Stars Cleared</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-[#5EEAD4] tabular-nums">
              {clearedCount}/{totalSectors}
            </div>
            <div className="mt-0.5 font-mono text-xs text-[#8895A7] tabular-nums">
              {progressPct}% sector map
            </div>
          </div>

          <div>
            <div className="text-xs text-[#8895A7]">Fleet Equipment</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-[#A78BFA] tabular-nums">
              {totalEquipmentCount}
            </div>
            <div className="mt-0.5 text-xs text-[#8895A7]">
              special upgrades
            </div>
          </div>

          <div>
            <div className="text-xs text-[#8895A7]">
              {bossReady ? "Boss Encounter" : "Next Sector"}
            </div>
            <div
              className={`mt-1 truncate font-display text-base font-semibold ${
                bossReady ? "text-[#FB7185]" : "text-[#E8EDF5]"
              }`}
            >
              {nextSector.name}
            </div>
            <div
              className={`mt-0.5 font-mono text-xs tabular-nums ${
                bossReady ? "text-[#FB7185]" : "text-[#FBBF24]"
              }`}
            >
              {bossReady
                ? "Diff 15/10 · 10× HP Boss"
                : `Diff ${nextSector.difficulty}/10 · ${nextSector.waves} ${
                    nextSector.waves === 1 ? "Wave" : "Waves"
                  }`}
            </div>
          </div>
        </div>
      </section>

      {/* Star Sectors & Fleet Equipment */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="rounded-xl border border-[#1B2433] bg-[#0C1119] lg:col-span-8">
          <div className="flex items-baseline justify-between border-b border-[#1B2433] px-5 py-4">
            <h2 className="font-display text-base font-semibold text-[#E8EDF5]">
              Star Systems
            </h2>
            <span className="font-mono text-xs text-[#8895A7] tabular-nums">
              {starsRemaining} remaining
            </span>
          </div>

          <div className="grid sm:grid-cols-2">
            {STAR_SECTORS.map((sector) => {
              const cleared = clearedSet.has(sector.id);
              return (
                <div
                  key={sector.id}
                  className="flex items-center justify-between gap-3 border-b border-[#1B2433] px-5 py-3 last:border-b-0 sm:odd:border-r"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {cleared ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
                    ) : (
                      <Circle
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: sector.color }}
                      />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`truncate text-sm font-medium ${
                          cleared ? "text-[#64748B] line-through" : "text-[#E8EDF5]"
                        }`}
                      >
                        {sector.name}
                      </div>
                      <div className="truncate text-xs text-[#8895A7]">
                        {sector.traitLabel}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                    <div className={cleared ? "text-[#5EEAD4]" : "text-[#E8EDF5]"}>
                      {cleared ? "Cleared" : `Diff ${sector.difficulty}/10`}
                    </div>
                    <div className="text-[#8895A7]">
                      {sector.waves} {sector.waves === 1 ? "Wave" : "Waves"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#1B2433] bg-[#0C1119] lg:col-span-4">
          <div className="flex items-baseline justify-between border-b border-[#1B2433] px-5 py-4">
            <h2 className="font-display text-base font-semibold text-[#E8EDF5]">
              Fleet &amp; Equipment
            </h2>
            <span className="font-mono text-xs text-[#8895A7] tabular-nums">
              {fleet.length} {fleet.length === 1 ? "ship" : "ships"}
            </span>
          </div>

          <div className="divide-y divide-[#1B2433]">
            {fleetSummary.map(({ ship, stats }) => {
              const eqList = ship.equipment ?? [];
              return (
                <div key={ship.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate font-display text-sm font-semibold text-[#E8EDF5]">
                      {ship.name}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-[#8895A7] tabular-nums">
                      {stats.shipClass} · {stats.mass}t
                    </span>
                  </div>

                  {eqList.length > 0 ? (
                    <ul className="mt-2 space-y-1 font-mono text-xs text-[#5EEAD4]">
                      {eqList.map((eq) => (
                        <li key={eq.id} className="truncate">
                          {eq.name} · {eq.effectLabel}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-xs text-[#64748B]">
                      No special Equipment yet — clear all 25 stars and defeat the Sector Boss to unlock.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
