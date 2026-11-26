import { useRef, useState } from "react";
import {
  COLS,
  PARTS,
  PartId,
  ROWS,
  ShipCellMap,
  cellKey,
} from "@/lib/parts";
import PartGlyph from "./PartGlyph";

interface BuildGridProps {
  cells: ShipCellMap;
  selectedPart: PartId;
  toolMode: "paint" | "erase";
  brushSize: 1 | 2 | 3;
  rotation: number;
  mirror: boolean;
  draggingPart: PartId | null;
  dragSourceCell: { x: number; y: number } | null;
  onStartStroke: () => void;
  onApplyAt: (x: number, y: number, modeOverride?: "paint" | "erase") => void;
  onBeginMoveCell: (x: number, y: number, clientX: number, clientY: number) => void;
  gridRefCallback?: (el: SVGSVGElement | null) => void;
  externalHoverCell?: { x: number; y: number } | null;
}

export function getBrushOffsets(size: 1 | 2 | 3): [number, number][] {
  if (size === 1) return [[0, 0]];
  if (size === 2) {
    return [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
  }
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      out.push([dx, dy]);
    }
  }
  return out;
}

export default function BuildGrid({
  cells,
  selectedPart,
  toolMode,
  brushSize,
  rotation,
  mirror,
  draggingPart,
  dragSourceCell,
  onStartStroke,
  onApplyAt,
  onBeginMoveCell,
  gridRefCallback,
  externalHoverCell,
}: BuildGridProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const paintingModeRef = useRef<"paint" | "erase" | null>(null);
  const lastPaintedRef = useRef<string | null>(null);

  const activeHover = externalHoverCell ?? hoverCell;
  const activePartId = draggingPart ?? selectedPart;
  const activePartDef = PARTS[activePartId];
  const isHullTool = Boolean(activePartDef?.isHullLayer);

  function coordsFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (draggingPart) return;
    const coords = coordsFromPointer(e.clientX, e.clientY);
    if (!coords) return;

    // Right click always erases
    if (e.button === 2) {
      e.preventDefault();
      onStartStroke();
      paintingModeRef.current = "erase";
      lastPaintedRef.current = cellKey(coords.x, coords.y);
      onApplyAt(coords.x, coords.y, "erase");
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    // Alt-click or clicking a mounted module when in module mode lets you drag-reposition it
    const existing = cells[cellKey(coords.x, coords.y)];
    if (toolMode === "paint" && !isHullTool && existing?.mod && !e.shiftKey) {
      // Allow dragging existing module if moved; handled cleanly by parent
      onBeginMoveCell(coords.x, coords.y, e.clientX, e.clientY);
      return;
    }

    onStartStroke();
    const mode = toolMode;
    paintingModeRef.current = mode;
    lastPaintedRef.current = cellKey(coords.x, coords.y);
    onApplyAt(coords.x, coords.y, mode);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const coords = coordsFromPointer(e.clientX, e.clientY);
    setHoverCell(coords);
    if (!paintingModeRef.current || !coords) return;
    const k = cellKey(coords.x, coords.y);
    if (k === lastPaintedRef.current) return;
    lastPaintedRef.current = k;
    onApplyAt(coords.x, coords.y, paintingModeRef.current);
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    paintingModeRef.current = null;
    lastPaintedRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const list = Object.values(cells);
  const effectiveBrush =
    toolMode === "erase" || (isHullTool && !draggingPart) ? brushSize : 1;
  const previewOffsets = getBrushOffsets(effectiveBrush);

  const previewCells: { x: number; y: number; d: number }[] = [];
  if (activeHover) {
    const seen = new Set<string>();
    for (const [dx, dy] of previewOffsets) {
      const px = activeHover.x + dx;
      const py = activeHover.y + dy;
      if (px >= 0 && px < COLS && py >= 0 && py < ROWS) {
        const k = cellKey(px, py);
        if (!seen.has(k)) {
          seen.add(k);
          previewCells.push({ x: px, y: py, d: rotation });
        }
        if (mirror) {
          const mx = COLS - 1 - px;
          const mk = cellKey(mx, py);
          if (!seen.has(mk)) {
            seen.add(mk);
            previewCells.push({ x: mx, y: py, d: (4 - rotation) % 4 });
          }
        }
      }
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#1B2433] bg-[#070B12] p-2 sm:p-3">
      <svg
        ref={(el) => {
          svgRef.current = el;
          gridRefCallback?.(el);
        }}
        viewBox={`0 0 ${COLS} ${ROWS}`}
        className="aspect-[17/13] w-full touch-none select-none rounded-lg bg-[#060910]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          setHoverCell(null);
          paintingModeRef.current = null;
          lastPaintedRef.current = null;
        }}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Shipyard construction grid"
      >
        <defs>
          <pattern id="drydock-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#1B2433"
              strokeWidth="0.03"
            />
          </pattern>
        </defs>

        {/* Grid Background */}
        <rect width={COLS} height={ROWS} fill="url(#drydock-grid)" />
        <rect
          width={COLS}
          height={ROWS}
          fill="none"
          stroke="#1B2433"
          strokeWidth="0.05"
        />

        {/* Centerline Mirror Axis & Nose Indicator */}
        <line
          x1={8.5}
          y1={0}
          x2={8.5}
          y2={ROWS}
          stroke={mirror ? "#5EEAD4" : "#253247"}
          strokeOpacity={mirror ? 0.35 : 0.65}
          strokeWidth="0.035"
          strokeDasharray="0.22 0.22"
        />
        <line
          x1={0}
          y1={6.5}
          x2={COLS}
          y2={6.5}
          stroke="#253247"
          strokeOpacity={0.4}
          strokeWidth="0.025"
          strokeDasharray="0.16 0.22"
        />

        {/* Forward direction chevron marker at top */}
        <path
          d="M 8.2 0.45 L 8.5 0.16 L 8.8 0.45"
          fill="none"
          stroke="#5EEAD4"
          strokeOpacity={0.5}
          strokeWidth="0.05"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Highlight painted hull cells subtly when dragging a system module */}
        {draggingPart &&
          !PARTS[draggingPart]?.isHullLayer &&
          list.map((cell) => (
            <rect
              key={`target-${cell.x}-${cell.y}`}
              x={cell.x + 0.04}
              y={cell.y + 0.04}
              width={0.92}
              height={0.92}
              rx={0.1}
              fill="#5EEAD4"
              fillOpacity={0.05}
              stroke="#5EEAD4"
              strokeOpacity={0.22}
              strokeWidth={0.025}
            />
          ))}

        {/* Hull Base Layer */}
        {list.map((cell) => (
          <g key={`hull-${cell.x}-${cell.y}`} transform={`translate(${cell.x} ${cell.y})`}>
            <PartGlyph type={cell.hull} />
          </g>
        ))}

        {/* Mounted Modules Layer */}
        {list.map((cell) => {
          if (!cell.mod) return null;
          const isBeingMoved =
            dragSourceCell &&
            dragSourceCell.x === cell.x &&
            dragSourceCell.y === cell.y;
          return (
            <g
              key={`mod-${cell.x}-${cell.y}`}
              transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${
                cell.mod.d * 90
              }) translate(-0.5 -0.5)`}
            >
              <PartGlyph type={cell.mod.t} opacity={isBeingMoved ? 0.28 : 1} />
            </g>
          );
        })}

        {/* Hover / Drag Ghost Footprint */}
        {previewCells.map((p) => {
          if (toolMode === "erase" && !draggingPart) {
            return (
              <rect
                key={`ghost-erase-${p.x}-${p.y}`}
                x={p.x + 0.06}
                y={p.y + 0.06}
                width={0.88}
                height={0.88}
                rx={0.1}
                fill="#FB7185"
                fillOpacity={0.18}
                stroke="#FB7185"
                strokeOpacity={0.75}
                strokeWidth={0.045}
              />
            );
          }

          return (
            <g key={`ghost-${p.x}-${p.y}`}>
              <rect
                x={p.x + 0.04}
                y={p.y + 0.04}
                width={0.92}
                height={0.92}
                rx={0.12}
                fill="#5EEAD4"
                fillOpacity={0.08}
                stroke="#5EEAD4"
                strokeOpacity={0.6}
                strokeWidth={0.04}
              />
              <g
                transform={`translate(${p.x + 0.5} ${p.y + 0.5}) rotate(${
                  p.d * 90
                }) translate(-0.5 -0.5)`}
              >
                <PartGlyph type={activePartId} opacity={0.48} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
