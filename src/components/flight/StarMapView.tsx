import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Skull } from "lucide-react";
import { cellsFromArray, computeStats } from "@/lib/parts";
import { STAR_MAP_BOSS_SECTOR, STAR_SECTORS, StarSector } from "@/lib/sectors";
import { ShipRecord } from "@/lib/ships";
import ShipPreview from "@/components/ship/ShipPreview";

const CONSTELLATION_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  [6, 13], [7, 14], [8, 15], [9, 16], [10, 17], [12, 18],
  [13, 14], [14, 15], [15, 16], [16, 17], [17, 18],
  [13, 19], [14, 20], [15, 21], [16, 22], [17, 23], [18, 24],
  [19, 20], [20, 21], [21, 22], [22, 23], [23, 24],
];

interface StarMapViewProps {
  ship: ShipRecord;
  clearedSectorIds: string[];
  onSelectSector: (sector: StarSector) => void;
  onChangeShip: () => void;
  onResetCleared: () => void;
}

export default function StarMapView({
  ship,
  clearedSectorIds,
  onSelectSector,
  onChangeShip,
  onResetCleared,
}: StarMapViewProps) {
  const [hoveredSector, setHoveredSector] = useState<StarSector | null>(null);
  const clearedSet = useMemo(() => new Set(clearedSectorIds), [clearedSectorIds]);
  const bossUnlocked = clearedSet.size >= STAR_SECTORS.length;
  const cellMap = useMemo(() => cellsFromArray(ship.cells), [ship.cells]);
  const stats = useMemo(
    () => computeStats(cellMap, undefined, ship.equipment),
    [cellMap, ship.equipment]
  );

  const ambientStars = useMemo(() => {
    const dots: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 150; i++) {
      const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 78.233) * 24634.6345) % 1 + 1) % 1;
      const ro = ((Math.sin(i * 41.17) * 19283.11) % 1 + 1) % 1;
      dots.push({
        x: rx * 100,
        y: ry * 100,
        r: 0.6 + (i % 3) * 0.45,
        o: 0.16 + ro * 0.36,
      });
    }
    return dots;
  }, []);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#060910] select-none">
      {/* Subtle Nebula Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(650px 420px at 26% 36%, rgba(94, 234, 212, 0.06), transparent 68%), radial-gradient(600px 460px at 74% 64%, rgba(167, 139, 250, 0.07), transparent 68%)",
        }}
      />

      {/* Ambient Stars & Constellation Lines */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {ambientStars.map((d, idx) => (
          <circle
            key={idx}
            cx={d.x}
            cy={d.y}
            r={d.r * 0.08}
            fill="#E8EDF5"
            fillOpacity={d.o}
          />
        ))}

        {CONSTELLATION_LINKS.map(([aIdx, bIdx], i) => {
          const a = STAR_SECTORS[aIdx];
          const b = STAR_SECTORS[bIdx];
          const aCleared = clearedSet.has(a.id);
          const bCleared = clearedSet.has(b.id);
          const highlighted =
            hoveredSector &&
            !clearedSet.has(hoveredSector.id) &&
            (hoveredSector.id === a.id || hoveredSector.id === b.id);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={highlighted ? "#5EEAD4" : "#1B2433"}
              strokeOpacity={
                aCleared && bCleared ? 0.2 : highlighted ? 0.55 : 0.65
              }
              strokeWidth={highlighted ? 0.16 : 0.1}
              strokeDasharray="0.5 0.6"
            />
          );
        })}
      </svg>

      {/* Top HUD Bar */}
      <div className="pointer-events-none relative z-20 flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-4 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={onChangeShip}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change Ship</span>
          </button>

          <div className="h-4 w-px bg-[#1B2433]" aria-hidden="true" />

          <div className="h-7 w-7 shrink-0">
            <ShipPreview cells={cellMap} className="h-full w-full" />
          </div>

          <div>
            <div className="font-display text-sm font-semibold text-[#E8EDF5]">
              {ship.name}
            </div>
            <div className="font-mono text-[11px] text-[#8895A7] tabular-nums">
              {stats.shipClass} · Health {stats.hullHP} · Shield {stats.shield}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-4 py-2.5 backdrop-blur-md">
          <div className="text-right">
            <div className="font-display text-sm font-semibold text-[#E8EDF5]">
              {bossUnlocked ? "Boss Encounter Unlocked" : "Sector Star Map"}
            </div>
            <div className="font-mono text-xs text-[#8895A7] tabular-nums">
              {bossUnlocked
                ? "All 25 stars cleared · Defeat Omega Dreadcore (15/10)"
                : `${clearedSet.size}/${STAR_SECTORS.length} cleared · Hover a star to inspect`}
            </div>
          </div>

          {bossUnlocked && (
            <button
              type="button"
              onClick={() => onSelectSector(STAR_MAP_BOSS_SECTOR)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FB7185] px-3 text-xs font-semibold text-[#060910] transition-colors hover:bg-[#FDA4AF]"
            >
              <Skull className="h-3.5 w-3.5" />
              <span>Fight Boss · Diff 15/10</span>
            </button>
          )}

          {clearedSet.size > 0 && (
            <button
              type="button"
              onClick={onResetCleared}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#8895A7] transition-colors hover:border-[#2E3D55] hover:text-[#E8EDF5]"
              title="Reset cleared stars"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Map</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Star Dots */}
      <div className="absolute inset-0 z-10">
        {STAR_SECTORS.map((sector) => {
          const isCleared = clearedSet.has(sector.id);
          const isHovered = hoveredSector?.id === sector.id;

          return (
            <div
              key={sector.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${sector.x}%`, top: `${sector.y}%` }}
            >
              {/* Hover Name Tooltip Above Star */}
              {isHovered && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#2C3B52] bg-[#0C1119]/95 px-3.5 py-2.5 text-center shadow-2xl backdrop-blur-md"
                >
                  <div
                    className={`font-display text-sm font-semibold ${
                      isCleared ? "text-[#8895A7]" : "text-[#E8EDF5]"
                    }`}
                  >
                    {sector.name}
                  </div>
                  {isCleared ? (
                    <div className="mt-0.5 font-mono text-[11px] text-[#8895A7]">
                      Area Cleared
                    </div>
                  ) : (
                    <>
                      <div className="mt-0.5 font-mono text-[11px] text-[#5EEAD4] tabular-nums">
                        Difficulty {sector.difficulty}/10 · {sector.waves}{" "}
                        {sector.waves === 1 ? "Wave" : "Waves"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#8895A7]">
                        {sector.traitLabel}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Star Hit Target */}
              <button
                type="button"
                onMouseEnter={() => setHoveredSector(sector)}
                onMouseLeave={() =>
                  setHoveredSector((prev) => (prev?.id === sector.id ? null : prev))
                }
                onFocus={() => setHoveredSector(sector)}
                onBlur={() =>
                  setHoveredSector((prev) => (prev?.id === sector.id ? null : prev))
                }
                onClick={() => {
                  if (!isCleared) {
                    onSelectSector(sector);
                  }
                }}
                aria-disabled={isCleared}
                aria-label={
                  isCleared
                    ? `${sector.name} — Cleared`
                    : `Enter ${sector.name} (Difficulty ${sector.difficulty} of 10, ${sector.waves} waves)`
                }
                className={`group relative flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#5EEAD4] ${
                  isCleared ? "cursor-default" : "cursor-pointer"
                }`}
              >
                {/* Hover Ring */}
                <span
                  aria-hidden="true"
                  className={`absolute rounded-full border transition-transform duration-150 ${
                    isHovered
                      ? isCleared
                        ? "h-7 w-7 scale-100 border-[#2B3548] bg-black/40"
                        : "h-8 w-8 scale-100 border-[#5EEAD4]/80 bg-[#5EEAD4]/10"
                      : "h-6 w-6 scale-75 border-transparent"
                  }`}
                />

                {/* Outer Glow (absent when blacked out) */}
                {!isCleared && (
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full transition-opacity duration-150"
                    style={{
                      width: `${sector.size * 3.2}px`,
                      height: `${sector.size * 3.2}px`,
                      backgroundColor: sector.color,
                      opacity: isHovered ? 0.36 : 0.16,
                      filter: "blur(4px)",
                    }}
                  />
                )}

                {/* Star Dot (Blacked Out when Cleared) */}
                <span
                  aria-hidden="true"
                  className={`relative rounded-full transition-transform duration-150 ${
                    isCleared ? "border border-[#232D3F]" : "group-hover:scale-125"
                  }`}
                  style={{
                    width: `${sector.size * 1.65}px`,
                    height: `${sector.size * 1.65}px`,
                    backgroundColor: isCleared ? "#05070B" : sector.color,
                    boxShadow: isCleared ? "none" : `0 0 10px ${sector.color}`,
                  }}
                />
              </button>
            </div>
          );
        })}

        {/* Unlocked Sector Boss Star Node */}
        {bossUnlocked && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${STAR_MAP_BOSS_SECTOR.x}%`,
              top: `${STAR_MAP_BOSS_SECTOR.y}%`,
            }}
          >
            {hoveredSector?.id === STAR_MAP_BOSS_SECTOR.id && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#FB7185]/60 bg-[#0C1119]/95 px-4 py-2.5 text-center shadow-2xl backdrop-blur-md"
              >
                <div className="font-display text-sm font-semibold text-[#FB7185]">
                  {STAR_MAP_BOSS_SECTOR.name}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[#E8EDF5] tabular-nums">
                  Sector Boss · Difficulty 15/10
                </div>
                <div className="mt-0.5 text-[11px] text-[#8895A7]">
                  {STAR_MAP_BOSS_SECTOR.traitLabel}
                </div>
              </div>
            )}

            <button
              type="button"
              onMouseEnter={() => setHoveredSector(STAR_MAP_BOSS_SECTOR)}
              onMouseLeave={() =>
                setHoveredSector((prev) =>
                  prev?.id === STAR_MAP_BOSS_SECTOR.id ? null : prev
                )
              }
              onFocus={() => setHoveredSector(STAR_MAP_BOSS_SECTOR)}
              onBlur={() =>
                setHoveredSector((prev) =>
                  prev?.id === STAR_MAP_BOSS_SECTOR.id ? null : prev
                )
              }
              onClick={() => onSelectSector(STAR_MAP_BOSS_SECTOR)}
              aria-label="Enter Omega Dreadcore Boss Battle (Difficulty 15 of 10)"
              className="group relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#FB7185]"
            >
              <span
                aria-hidden="true"
                className="absolute h-14 w-14 animate-ping rounded-full bg-[#FB7185]/25"
              />
              <span
                aria-hidden="true"
                className="absolute h-12 w-12 rounded-full border border-[#FB7185]/70 bg-[#FB7185]/15 transition-transform duration-150 group-hover:scale-110"
              />
              <span
                aria-hidden="true"
                className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#FB7185] text-[#060910] shadow-[0_0_20px_#FB7185] transition-transform duration-150 group-hover:scale-125"
              >
                <Skull className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
