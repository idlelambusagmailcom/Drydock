import { useState } from "react";
import { Zap } from "lucide-react";
import {
  CATEGORIES,
  CategoryId,
  PART_LIST,
  PartDef,
  PartId,
  partPowerLabel,
  partSummary,
} from "@/lib/parts";
import PartGlyph from "./PartGlyph";

interface PartPaletteProps {
  selectedPart: PartId;
  toolMode: "paint" | "erase";
  onSelectPart: (partId: PartId) => void;
  onStartDragPart: (partId: PartId, clientX: number, clientY: number) => void;
}

export default function PartPalette({
  selectedPart,
  toolMode,
  onSelectPart,
  onStartDragPart,
}: PartPaletteProps) {
  const [activeCat, setActiveCat] = useState<"all" | CategoryId>("all");

  const visibleParts: PartDef[] =
    activeCat === "all"
      ? PART_LIST
      : PART_LIST.filter((p) => p.cat === activeCat);

  return (
    <aside className="flex flex-col overflow-hidden rounded-xl border border-[#1B2433] bg-[#0C1119]">
      {/* Header & Power Legend */}
      <div className="border-b border-[#1B2433] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-[#E8EDF5]">
            Ship Parts
          </h2>
          <span className="font-mono text-[11px] text-[#8895A7]">
            Drag or click
          </span>
        </div>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8895A7]">
          <span className="inline-flex items-center gap-1 text-[#5EEAD4]">
            <Zap className="h-3 w-3" />
            <span>+ Generates</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#FBBF24]">- Consumes</span>
          <span aria-hidden="true">·</span>
          <span>0 Passive</span>
        </p>

        {/* Category Filter Tabs */}
        <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Part categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeCat === "all"
                ? "bg-[#1B2433] text-[#E8EDF5]"
                : "text-[#8895A7] hover:bg-[#111825] hover:text-[#E8EDF5]"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const selected = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCat(cat.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-[#1B2433] text-[#E8EDF5]"
                    : "text-[#8895A7] hover:bg-[#111825] hover:text-[#E8EDF5]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Part List */}
      <div className="scroll-thin max-h-[540px] flex-1 space-y-1.5 overflow-y-auto p-3 lg:max-h-[660px]">
        {visibleParts.map((part) => {
          const isSelected = toolMode === "paint" && selectedPart === part.id;
          const power = partPowerLabel(part);

          return (
            <button
              key={part.id}
              type="button"
              onClick={() => onSelectPart(part.id)}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                onStartDragPart(part.id, e.clientX, e.clientY);
              }}
              className={`group flex w-full cursor-grab items-start gap-3 rounded-lg border p-2.5 text-left transition-colors active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-[#5EEAD4] ${
                isSelected
                  ? "border-[#5EEAD4]/65 bg-[#5EEAD4]/10"
                  : "border-[#1B2433]/80 bg-[#080C14]/70 hover:border-[#2C3B52] hover:bg-[#111825]"
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#1B2433] bg-[#060910] p-1.5">
                <svg viewBox="0 0 1 1" className="h-full w-full" aria-hidden="true">
                  <PartGlyph type={part.id} />
                </svg>
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-[#E8EDF5]">
                    {part.name}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                      power.kind === "gen"
                        ? "text-[#5EEAD4]"
                        : power.kind === "draw"
                        ? "text-[#FBBF24]"
                        : "text-[#8895A7]"
                    }`}
                    title={
                      power.kind === "gen"
                        ? `Generates ${part.gen} power`
                        : power.kind === "draw"
                        ? `Consumes ${part.draw} power`
                        : "Requires no power"
                    }
                  >
                    <Zap className="h-3 w-3" />
                    <span>{power.text}</span>
                  </span>
                </div>

                <div className="mt-0.5 font-mono text-[11px] text-[#8895A7] tabular-nums">
                  {partSummary(part)}
                  {part.isHullLayer ? " · Hull" : ""}
                </div>

                <p className="mt-1 text-xs leading-snug text-[#9AA7B8]">
                  {part.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
