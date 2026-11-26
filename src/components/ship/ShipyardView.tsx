import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eraser,
  FlipHorizontal2,
  Paintbrush,
  Play,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  COLS,
  HullMaterialId,
  PARTS,
  PartId,
  ROWS,
  ShipCellMap,
  cellKey,
  cellsFromArray,
  cellsToArray,
  computeStats,
} from "@/lib/parts";
import { ShipRecord } from "@/lib/ships";
import { playEraseSound, playMountSound, playPaintSound } from "@/lib/audio";
import BuildGrid, { getBrushOffsets } from "./BuildGrid";
import PartGlyph from "./PartGlyph";
import PartPalette from "./PartPalette";
import StatsPanel from "./StatsPanel";

interface ShipyardViewProps {
  ship: ShipRecord;
  onSaveShip: (updated: ShipRecord) => void;
  onLaunchFlight: (updated: ShipRecord) => void;
  onBackToHangar: () => void;
}

interface DragState {
  partId: PartId;
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  active: boolean;
  sourceCell: { x: number; y: number; rot: number } | null;
}

const ROTATION_LABELS = ["Up", "Right", "Down", "Left"];

export default function ShipyardView({
  ship,
  onSaveShip,
  onLaunchFlight,
  onBackToHangar,
}: ShipyardViewProps) {
  const [name, setName] = useState(ship.name);
  const [cells, setCells] = useState<ShipCellMap>(() => cellsFromArray(ship.cells));
  const [selectedPart, setSelectedPart] = useState<PartId>("plate");
  const [toolMode, setToolMode] = useState<"paint" | "erase">("paint");
  const [brushSize, setBrushSize] = useState<1 | 2 | 3>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [mirror, setMirror] = useState<boolean>(true);
  const [history, setHistory] = useState<ShipCellMap[]>([]);
  const [dirty, setDirty] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragHoverCell, setDragHoverCell] = useState<{ x: number; y: number } | null>(null);

  const gridSvgRef = useRef<SVGSVGElement | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  // Reset editor state when switching to a different ship ID
  useEffect(() => {
    setName(ship.name);
    setCells(cellsFromArray(ship.cells));
    setHistory([]);
    setDirty(false);
    setJustSaved(false);
  }, [ship.id]);

  const stats = useMemo(
    () => computeStats(cells, undefined, ship.equipment),
    [cells, ship.equipment]
  );

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-29), cellsRef.current]);
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setCells(last);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, []);

  const applyPartToCells = useCallback(
    (
      base: ShipCellMap,
      partId: PartId,
      x: number,
      y: number,
      rot: number,
      useMirror: boolean,
      size: 1 | 2 | 3
    ): { next: ShipCellMap; changed: boolean; isHull: boolean } => {
      const partDef = PARTS[partId];
      if (!partDef) return { next: base, changed: false, isHull: false };
      const next = { ...base };
      const isHull = Boolean(partDef.isHullLayer);
      const offsets = isHull ? getBrushOffsets(size) : [[0, 0]];
      let changed = false;

      const stamp = (tx: number, ty: number, td: number) => {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
        const k = cellKey(tx, ty);
        const existing = next[k];

        if (isHull) {
          const hullId = partId as HullMaterialId;
          if (!existing || existing.hull !== hullId) {
            next[k] = {
              x: tx,
              y: ty,
              hull: hullId,
              mod: existing?.mod,
            };
            changed = true;
          }
        } else {
          const modId = partId as Exclude<PartId, HullMaterialId>;
          const underlyingHull: HullMaterialId = existing?.hull ?? "plate";
          if (
            !existing ||
            existing.mod?.t !== modId ||
            existing.mod?.d !== td
          ) {
            next[k] = {
              x: tx,
              y: ty,
              hull: underlyingHull,
              mod: { t: modId, d: td },
            };
            changed = true;
          }
        }
      };

      for (const [dx, dy] of offsets) {
        const px = x + dx;
        const py = y + dy;
        stamp(px, py, rot);
        if (useMirror) {
          const mx = COLS - 1 - px;
          if (mx !== px) {
            stamp(mx, py, (4 - rot) % 4);
          }
        }
      }

      return { next, changed, isHull };
    },
    []
  );

  const eraseCellsAt = useCallback(
    (
      base: ShipCellMap,
      x: number,
      y: number,
      useMirror: boolean,
      size: 1 | 2 | 3
    ): { next: ShipCellMap; changed: boolean } => {
      const next = { ...base };
      const offsets = getBrushOffsets(size);
      let changed = false;

      const eraseOne = (tx: number, ty: number) => {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
        const k = cellKey(tx, ty);
        const existing = next[k];
        if (!existing) return;
        if (existing.mod) {
          // First erase strips mounted module, keeping painted hull intact
          next[k] = { x: tx, y: ty, hull: existing.hull };
        } else {
          delete next[k];
        }
        changed = true;
      };

      for (const [dx, dy] of offsets) {
        const px = x + dx;
        const py = y + dy;
        eraseOne(px, py);
        if (useMirror) {
          const mx = COLS - 1 - px;
          if (mx !== px) eraseOne(mx, py);
        }
      }

      return { next, changed };
    },
    []
  );

  const handleApplyAt = useCallback(
    (x: number, y: number, modeOverride?: "paint" | "erase") => {
      const mode = modeOverride ?? toolMode;
      if (mode === "erase") {
        const { next, changed } = eraseCellsAt(
          cellsRef.current,
          x,
          y,
          mirror,
          brushSize
        );
        if (changed) {
          setCells(next);
          setDirty(true);
          playEraseSound();
        }
        return;
      }

      const { next, changed, isHull } = applyPartToCells(
        cellsRef.current,
        selectedPart,
        x,
        y,
        rotation,
        mirror,
        brushSize
      );
      if (changed) {
        setCells(next);
        setDirty(true);
        if (isHull) {
          playPaintSound();
        } else {
          playMountSound();
        }
      }
    },
    [toolMode, selectedPart, rotation, mirror, brushSize, applyPartToCells, eraseCellsAt]
  );

  const coordsFromClientPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = gridSvgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
      const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
      return { x, y };
    },
    []
  );

  // Global drag-and-drop pointer listeners attached immediately on drag start
  useEffect(() => {
    if (!dragState) return;

    function onPointerMove(e: PointerEvent) {
      setDragState((prev) => {
        if (!prev) return null;
        const dist = Math.hypot(e.clientX - prev.startX, e.clientY - prev.startY);
        const active = prev.active || dist > 5;
        return { ...prev, clientX: e.clientX, clientY: e.clientY, active };
      });
      setDragHoverCell(coordsFromClientPoint(e.clientX, e.clientY));
    }

    function onPointerUp(e: PointerEvent) {
      const dropCell = coordsFromClientPoint(e.clientX, e.clientY);
      setDragState((current) => {
        if (!current) return null;

        if (current.active) {
          if (dropCell) {
            pushHistory();
            let base = { ...cellsRef.current };

            // If dragging an existing mounted module from a grid cell, remove from source first
            if (current.sourceCell) {
              const srcKey = cellKey(current.sourceCell.x, current.sourceCell.y);
              const srcCell = base[srcKey];
              if (srcCell?.mod) {
                base[srcKey] = { x: srcCell.x, y: srcCell.y, hull: srcCell.hull };
              }
              if (mirror) {
                const mSrcX = COLS - 1 - current.sourceCell.x;
                if (mSrcX !== current.sourceCell.x) {
                  const mKey = cellKey(mSrcX, current.sourceCell.y);
                  const mCell = base[mKey];
                  if (mCell?.mod) {
                    base[mKey] = { x: mCell.x, y: mCell.y, hull: mCell.hull };
                  }
                }
              }
            }

            const rotToUse = current.sourceCell ? current.sourceCell.rot : rotation;
            const { next } = applyPartToCells(
              base,
              current.partId,
              dropCell.x,
              dropCell.y,
              rotToUse,
              mirror,
              1
            );
            setCells(next);
            setDirty(true);
            if (PARTS[current.partId]?.isHullLayer) {
              playPaintSound();
            } else {
              playMountSound();
            }
          } else if (current.sourceCell) {
            // Dragged existing module off the grid -> remove it
            pushHistory();
            const base = { ...cellsRef.current };
            const srcKey = cellKey(current.sourceCell.x, current.sourceCell.y);
            const srcCell = base[srcKey];
            if (srcCell?.mod) {
              base[srcKey] = { x: srcCell.x, y: srcCell.y, hull: srcCell.hull };
            }
            if (mirror) {
              const mSrcX = COLS - 1 - current.sourceCell.x;
              if (mSrcX !== current.sourceCell.x) {
                const mKey = cellKey(mSrcX, current.sourceCell.y);
                const mCell = base[mKey];
                if (mCell?.mod) {
                  base[mKey] = { x: mCell.x, y: mCell.y, hull: mCell.hull };
                }
              }
            }
            setCells(base);
            setDirty(true);
            playEraseSound();
          }
        }
        return null;
      });
      setDragHoverCell(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [Boolean(dragState), coordsFromClientPoint, mirror, rotation, pushHistory, applyPartToCells]);

  const handleSave = useCallback((): ShipRecord => {
    const cleanName = name.trim() || "Untitled Vessel";
    const updated: ShipRecord = {
      id: ship.id,
      name: cleanName,
      updatedAt: Date.now(),
      cells: cellsToArray(cellsRef.current),
      equipment: ship.equipment ?? [],
    };
    onSaveShip(updated);
    setName(cleanName);
    setDirty(false);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
    return updated;
  }, [name, ship.id, onSaveShip]);

  const handleLaunch = useCallback(() => {
    const updated = handleSave();
    onLaunchFlight(updated);
  }, [handleSave, onLaunchFlight]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key.toLowerCase() === "r") {
        setRotation((r) => (r + 1) % 4);
      } else if (e.key.toLowerCase() === "e") {
        setToolMode((m) => (m === "erase" ? "paint" : "erase"));
      } else if (e.key.toLowerCase() === "m") {
        setMirror((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleSave]);

  const isHullSelected = Boolean(PARTS[selectedPart]?.isHullLayer);

  return (
    <main className="mx-auto max-w-[1560px] px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* Vessel Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#1B2433] pb-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onBackToHangar}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#0C1119] px-3 text-sm font-medium text-[#E8EDF5] transition-colors hover:border-[#2C3A52] hover:bg-[#111825]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Hangar</span>
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            aria-label="Vessel name"
            className="h-10 min-w-[180px] max-w-sm flex-1 rounded-lg border border-[#1B2433] bg-[#0C1119] px-3.5 font-display text-lg font-semibold text-[#E8EDF5] focus:border-[#5EEAD4] focus:outline-none"
          />

          <span className="hidden font-mono text-xs text-[#8895A7] sm:inline">
            {justSaved ? "Saved" : dirty ? "Unsaved changes" : "Up to date"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#0C1119] px-4 text-sm font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55] hover:bg-[#111825]"
          >
            {justSaved ? (
              <Check className="h-4 w-4 text-[#5EEAD4]" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{justSaved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={stats.cellsCount === 0}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Test Flight</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Shipyard Workspace */}
      <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)_290px]">
        {/* Left: Parts Palette */}
        <div className="order-2 lg:order-1">
          <PartPalette
            selectedPart={selectedPart}
            toolMode={toolMode}
            onSelectPart={(id) => {
              setSelectedPart(id);
              setToolMode("paint");
            }}
            onStartDragPart={(partId, clientX, clientY) => {
              setSelectedPart(partId);
              setToolMode("paint");
              setDragState({
                partId,
                clientX,
                clientY,
                startX: clientX,
                startY: clientY,
                active: false,
                sourceCell: null,
              });
            }}
          />
        </div>

        {/* Center: Toolbar + Construction Grid */}
        <div className="order-1 flex flex-col gap-3 lg:order-2">
          {/* Paint & Placement Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1B2433] bg-[#0C1119] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolMode("paint")}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                  toolMode === "paint"
                    ? "bg-[#5EEAD4] text-[#060910]"
                    : "text-[#8895A7] hover:bg-[#111825] hover:text-[#E8EDF5]"
                }`}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                <span>Paint / Place</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode("erase")}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                  toolMode === "erase"
                    ? "bg-[#FB7185] text-[#060910]"
                    : "text-[#8895A7] hover:bg-[#111825] hover:text-[#E8EDF5]"
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Erase (E)</span>
              </button>

              {/* Hull Brush Sizes */}
              {(isHullSelected || toolMode === "erase") && (
                <div
                  className="ml-1 flex items-center gap-1 rounded-lg border border-[#1B2433] bg-[#060910] p-0.5"
                  role="group"
                  aria-label="Brush size"
                >
                  {([1, 2, 3] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setBrushSize(sz)}
                      className={`h-7 rounded-md px-2 font-mono text-[11px] font-medium transition-colors ${
                        brushSize === sz
                          ? "bg-[#1B2433] text-[#E8EDF5]"
                          : "text-[#8895A7] hover:text-[#E8EDF5]"
                      }`}
                    >
                      {sz}×{sz}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 1) % 4)}
                title="Rotate part (R)"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55]"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>{ROTATION_LABELS[rotation]}</span>
              </button>

              <button
                type="button"
                onClick={() => setMirror((m) => !m)}
                title="Toggle centerline mirror symmetry (M)"
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                  mirror
                    ? "border-[#5EEAD4]/55 bg-[#5EEAD4]/10 text-[#5EEAD4]"
                    : "border-[#1B2433] bg-[#111825] text-[#8895A7] hover:text-[#E8EDF5]"
                }`}
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
                <span>Mirror</span>
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Undo (Ctrl+Z)"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (Object.keys(cells).length === 0) return;
                  pushHistory();
                  setCells({});
                  setDirty(true);
                  playEraseSound();
                }}
                disabled={stats.cellsCount === 0}
                title="Clear entire grid"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#8895A7] transition-colors hover:border-[#FB7185]/40 hover:text-[#FB7185] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <BuildGrid
            cells={cells}
            selectedPart={selectedPart}
            toolMode={toolMode}
            brushSize={brushSize}
            rotation={rotation}
            mirror={mirror}
            draggingPart={dragState?.active ? dragState.partId : null}
            dragSourceCell={dragState?.active ? dragState.sourceCell : null}
            onStartStroke={pushHistory}
            onApplyAt={handleApplyAt}
            onBeginMoveCell={(x, y, clientX, clientY) => {
              const cell = cells[cellKey(x, y)];
              if (!cell?.mod) return;
              setDragState({
                partId: cell.mod.t,
                clientX,
                clientY,
                startX: clientX,
                startY: clientY,
                active: false,
                sourceCell: { x, y, rot: cell.mod.d },
              });
            }}
            gridRefCallback={(el) => {
              gridSvgRef.current = el;
            }}
            externalHoverCell={dragState?.active ? dragHoverCell : null}
          />

          <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#8895A7]">
            <span>
              Drag any part from the palette onto the hull, or sweep across cells to paint.
            </span>
            <span className="font-mono">
              Right-click removes modules · R rotates · M mirrors
            </span>
          </p>
        </div>

        {/* Right: Live Stats Panel */}
        <div className="order-3">
          <StatsPanel stats={stats} equipment={ship.equipment} />
        </div>
      </div>

      {/* Floating Drag Ghost */}
      {dragState?.active && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-[#5EEAD4]/60 bg-[#0C1119]/90 p-1.5 shadow-xl"
          style={{ left: dragState.clientX, top: dragState.clientY }}
        >
          <svg viewBox="0 0 1 1" className="h-full w-full">
            <g
              transform={`translate(0.5 0.5) rotate(${
                (dragState.sourceCell ? dragState.sourceCell.rot : rotation) * 90
              }) translate(-0.5 -0.5)`}
            >
              <PartGlyph type={dragState.partId} />
            </g>
          </svg>
        </div>
      )}
    </main>
  );
}
