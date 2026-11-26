import { useMemo } from "react";
import { PARTS, ShipCellMap, cellKey, shipBounds } from "@/lib/parts";
import PartGlyph from "./PartGlyph";

interface ShipPreviewProps {
  cells: ShipCellMap;
  className?: string;
  offlineKeys?: Set<string>;
  thrustPower?: number; // 0..1 active thrust visual
  boostActive?: boolean;
}

export default function ShipPreview({
  cells,
  className = "h-full w-full",
  offlineKeys,
  thrustPower = 0,
  boostActive = false,
}: ShipPreviewProps) {
  const list = useMemo(() => Object.values(cells || {}), [cells]);
  const bounds = useMemo(() => shipBounds(cells || {}), [cells]);

  if (!bounds || list.length === 0) {
    return (
      <svg viewBox="0 0 4 4" className={className} aria-label="Empty hull">
        <path
          d="M2 1.2 V2.8 M1.2 2 H2.8"
          stroke="#1B2433"
          strokeWidth="0.12"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const effectiveThrust = boostActive ? Math.max(thrustPower, 1.35) : thrustPower;
  const pad = 0.65;
  const vb = `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.w + pad * 2} ${
    bounds.h + pad * 2 + (effectiveThrust > 0 ? 0.65 : 0)
  }`;

  return (
    <svg
      viewBox={vb}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Ship silhouette"
    >
      {/* Hull base layer */}
      {list.map((cell) => (
        <g key={`hull-${cell.x}-${cell.y}`} transform={`translate(${cell.x} ${cell.y})`}>
          <PartGlyph type={cell.hull} />
        </g>
      ))}

      {/* Thruster flame exhausts when actively thrusting or boosting */}
      {effectiveThrust > 0 &&
        list.map((cell) => {
          if (!cell.mod) return null;
          const part = PARTS[cell.mod.t];
          if (!part || (!part.thrust && !part.boostCharges)) return null;
          const key = cellKey(cell.x, cell.y);
          if (offlineKeys?.has(key)) return null;
          const baseLen =
            part.id === "engine_xl"
              ? 0.95
              : part.id === "engine_l"
              ? 0.78
              : part.id === "booster"
              ? 0.85
              : 0.58;
          const flameLen = baseLen * effectiveThrust;
          return (
            <g
              key={`flame-${key}`}
              transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${
                cell.mod.d * 90
              }) translate(-0.5 -0.5)`}
            >
              <path
                d={`M0.3 0.9 L0.5 ${0.9 + flameLen} L0.7 0.9 Z`}
                fill={boostActive ? "#FBBF24" : "#5EEAD4"}
                fillOpacity={boostActive ? 0.9 : 0.8}
              />
              <path
                d={`M0.4 0.9 L0.5 ${0.9 + flameLen * 0.62} L0.6 0.9 Z`}
                fill="#E8EDF5"
                fillOpacity={0.92}
              />
            </g>
          );
        })}

      {/* Mounted modules layer */}
      {list.map((cell) => {
        if (!cell.mod) return null;
        const key = cellKey(cell.x, cell.y);
        const isOffline = offlineKeys ? offlineKeys.has(key) : false;
        return (
          <g
            key={`mod-${key}`}
            transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${
              cell.mod.d * 90
            }) translate(-0.5 -0.5)`}
          >
            <PartGlyph type={cell.mod.t} offline={isOffline} />
          </g>
        );
      })}
    </svg>
  );
}
