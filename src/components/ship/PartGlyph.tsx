import { PARTS, PartId, categoryColor } from "@/lib/parts";

interface PartGlyphProps {
  type: PartId;
  opacity?: number;
  offline?: boolean;
}

export default function PartGlyph({ type, opacity = 1, offline = false }: PartGlyphProps) {
  const part = PARTS[type];
  if (!part) return null;
  const c = offline ? "#475569" : categoryColor(part.cat);
  const effectiveOpacity = offline ? opacity * 0.35 : opacity;

  switch (type) {
    case "frame":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.1}
            y={0.1}
            width={0.8}
            height={0.8}
            rx={0.14}
            fill={c}
            fillOpacity={0.1}
            stroke={c}
            strokeOpacity={0.48}
            strokeWidth={0.07}
          />
          <path
            d="M0.24 0.24 L0.76 0.76 M0.76 0.24 L0.24 0.76"
            stroke={c}
            strokeOpacity={0.22}
            strokeWidth={0.045}
          />
        </g>
      );

    case "plate":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.06}
            y={0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill={c}
            fillOpacity={0.22}
            stroke={c}
            strokeOpacity={0.68}
            strokeWidth={0.075}
          />
        </g>
      );

    case "bulkhead":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.06}
            y={0.06}
            width={0.88}
            height={0.88}
            rx={0.1}
            fill={c}
            fillOpacity={0.32}
            stroke={c}
            strokeOpacity={0.82}
            strokeWidth={0.09}
          />
          <path
            d="M0.2 0.8 L0.8 0.2 M0.2 0.2 L0.8 0.8"
            stroke={c}
            strokeWidth={0.065}
            strokeOpacity={0.55}
          />
        </g>
      );

    case "spine":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.08}
            y={0.08}
            width={0.84}
            height={0.84}
            rx={0.12}
            fill={c}
            fillOpacity={0.12}
            stroke={c}
            strokeOpacity={0.35}
            strokeWidth={0.05}
          />
          <rect
            x={0.34}
            y={0.04}
            width={0.32}
            height={0.92}
            rx={0.08}
            fill={c}
            fillOpacity={0.42}
            stroke={c}
            strokeOpacity={0.85}
            strokeWidth={0.065}
          />
        </g>
      );

    case "armor":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.04}
            y={0.04}
            width={0.92}
            height={0.92}
            rx={0.08}
            fill={c}
            fillOpacity={0.28}
            stroke="#CBD5E1"
            strokeWidth={0.11}
            strokeOpacity={0.85}
          />
          <path
            d="M0.22 0.5 H0.78"
            stroke="#E2E8F0"
            strokeWidth={0.07}
            strokeOpacity={0.65}
          />
        </g>
      );

    case "cockpit":
      return (
        <g opacity={effectiveOpacity}>
          <path
            d="M0.22 0.78 L0.34 0.22 Q0.5 0.08 0.66 0.22 L0.78 0.78 Z"
            fill="#5EEAD4"
            fillOpacity={0.28}
            stroke="#5EEAD4"
            strokeWidth={0.08}
            strokeLinejoin="round"
          />
          <circle cx={0.5} cy={0.5} r={0.12} fill="#5EEAD4" />
        </g>
      );

    case "solar":
      return (
        <g opacity={effectiveOpacity}>
          {[
            [0.1, 0.1],
            [0.54, 0.1],
            [0.1, 0.54],
            [0.54, 0.54],
          ].map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={0.36}
              height={0.36}
              rx={0.06}
              fill={c}
              fillOpacity={0.34}
              stroke={c}
              strokeWidth={0.06}
              strokeOpacity={0.82}
            />
          ))}
        </g>
      );

    case "capacitor":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.16}
            y={0.14}
            width={0.68}
            height={0.72}
            rx={0.14}
            fill={c}
            fillOpacity={0.16}
            stroke={c}
            strokeWidth={0.08}
            strokeOpacity={0.8}
          />
          <rect x={0.38} y={0.26} width={0.24} height={0.48} rx={0.06} fill={c} fillOpacity={0.88} />
        </g>
      );

    case "reactor_s":
      return (
        <g opacity={effectiveOpacity}>
          <circle
            cx={0.5}
            cy={0.5}
            r={0.31}
            fill={c}
            fillOpacity={0.14}
            stroke={c}
            strokeWidth={0.09}
            strokeOpacity={0.9}
          />
          <circle cx={0.5} cy={0.5} r={0.11} fill={c} />
        </g>
      );

    case "reactor_l":
      return (
        <g opacity={effectiveOpacity}>
          <circle
            cx={0.5}
            cy={0.5}
            r={0.38}
            fill={c}
            fillOpacity={0.16}
            stroke={c}
            strokeWidth={0.08}
            strokeOpacity={0.92}
          />
          <circle cx={0.5} cy={0.5} r={0.19} fill={c} fillOpacity={0.85} />
          <path
            d="M0.5 0.08 V0.24 M0.5 0.76 V0.92 M0.08 0.5 H0.24 M0.76 0.5 H0.92"
            stroke={c}
            strokeWidth={0.07}
            strokeLinecap="round"
          />
        </g>
      );

    case "maneuvering":
      return (
        <g opacity={effectiveOpacity}>
          <path
            d="M0.24 0.54 L0.5 0.18 L0.76 0.54"
            fill="none"
            stroke={c}
            strokeWidth={0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0.24 0.84 L0.5 0.48 L0.76 0.84"
            fill="none"
            stroke={c}
            strokeWidth={0.09}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.55}
          />
        </g>
      );

    case "engine_s":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.26}
            y={0.08}
            width={0.48}
            height={0.52}
            rx={0.1}
            fill={c}
            fillOpacity={0.32}
            stroke={c}
            strokeWidth={0.08}
            strokeOpacity={0.85}
          />
          <path
            d="M0.32 0.62 V0.9 M0.5 0.62 V0.94 M0.68 0.62 V0.9"
            stroke={c}
            strokeWidth={0.08}
            strokeLinecap="round"
            strokeOpacity={0.78}
          />
        </g>
      );

    case "engine_l":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.14}
            y={0.06}
            width={0.72}
            height={0.48}
            rx={0.12}
            fill={c}
            fillOpacity={0.34}
            stroke={c}
            strokeWidth={0.08}
            strokeOpacity={0.88}
          />
          <path
            d="M0.22 0.58 V0.92 M0.41 0.58 V0.96 M0.59 0.58 V0.96 M0.78 0.58 V0.92"
            stroke={c}
            strokeWidth={0.085}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        </g>
      );

    case "engine_xl":
      return (
        <g opacity={effectiveOpacity}>
          <path
            d="M0.1 0.05 H0.9 V0.42 L0.74 0.58 H0.26 L0.1 0.42 Z"
            fill={c}
            fillOpacity={0.36}
            stroke={c}
            strokeWidth={0.08}
            strokeOpacity={0.92}
            strokeLinejoin="round"
          />
          <path
            d="M0.22 0.62 V0.95 M0.4 0.62 V0.98 M0.6 0.62 V0.98 M0.78 0.62 V0.95"
            stroke={c}
            strokeWidth={0.09}
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
        </g>
      );

    case "booster":
      return (
        <g opacity={effectiveOpacity}>
          <path
            d="M0.22 0.14 L0.5 0.04 L0.78 0.14 L0.78 0.62 L0.22 0.62 Z"
            fill={c}
            fillOpacity={0.28}
            stroke={c}
            strokeWidth={0.08}
            strokeLinejoin="round"
          />
          <path
            d="M0.34 0.4 L0.5 0.22 L0.66 0.4"
            fill="none"
            stroke="#FBBF24"
            strokeWidth={0.085}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0.32 0.65 V0.94 M0.5 0.65 V0.97 M0.68 0.65 V0.94"
            stroke="#FBBF24"
            strokeWidth={0.08}
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
        </g>
      );

    case "pd":
      return (
        <g opacity={effectiveOpacity}>
          <circle
            cx={0.5}
            cy={0.5}
            r={0.25}
            fill={c}
            fillOpacity={0.18}
            stroke={c}
            strokeWidth={0.08}
          />
          <path
            d="M0.5 0.1 V0.26 M0.5 0.74 V0.9 M0.1 0.5 H0.26 M0.74 0.5 H0.9"
            stroke={c}
            strokeWidth={0.08}
            strokeLinecap="round"
          />
        </g>
      );

    case "laser":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.4}
            y={0.12}
            width={0.2}
            height={0.72}
            rx={0.07}
            fill={c}
            fillOpacity={0.45}
            stroke={c}
            strokeWidth={0.065}
          />
          <circle cx={0.5} cy={0.14} r={0.11} fill={c} />
        </g>
      );

    case "missile":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.26}
            y={0.12}
            width={0.48}
            height={0.76}
            rx={0.14}
            fill={c}
            fillOpacity={0.24}
            stroke={c}
            strokeWidth={0.075}
          />
          <circle cx={0.5} cy={0.31} r={0.085} fill={c} />
          <circle cx={0.5} cy={0.52} r={0.085} fill={c} fillOpacity={0.78} />
          <circle cx={0.5} cy={0.73} r={0.085} fill={c} fillOpacity={0.52} />
        </g>
      );

    case "railgun":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.32}
            y={0.04}
            width={0.36}
            height={0.92}
            rx={0.08}
            fill={c}
            fillOpacity={0.32}
            stroke={c}
            strokeWidth={0.08}
          />
          <path d="M0.5 0.1 V0.9" stroke={c} strokeWidth={0.075} strokeLinecap="round" />
          <path d="M0.32 0.24 H0.68" stroke={c} strokeWidth={0.06} />
        </g>
      );

    case "shield_cap":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.14}
            y={0.14}
            width={0.72}
            height={0.72}
            rx={0.18}
            fill={c}
            fillOpacity={0.18}
            stroke={c}
            strokeWidth={0.08}
          />
          <circle cx={0.5} cy={0.5} r={0.16} fill={c} fillOpacity={0.85} />
        </g>
      );

    case "shield_emit":
      return (
        <g opacity={effectiveOpacity}>
          <circle
            cx={0.5}
            cy={0.5}
            r={0.37}
            fill={c}
            fillOpacity={0.14}
            stroke={c}
            strokeWidth={0.08}
          />
          <circle
            cx={0.5}
            cy={0.5}
            r={0.18}
            fill="none"
            stroke={c}
            strokeWidth={0.085}
          />
        </g>
      );

    case "fuel":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.16}
            y={0.14}
            width={0.68}
            height={0.72}
            rx={0.16}
            fill={c}
            fillOpacity={0.14}
            stroke={c}
            strokeWidth={0.08}
          />
          <rect x={0.23} y={0.56} width={0.54} height={0.22} rx={0.06} fill={c} fillOpacity={0.58} />
          <path d="M0.24 0.56 H0.76" stroke={c} strokeWidth={0.07} />
        </g>
      );

    case "cargo":
      return (
        <g opacity={effectiveOpacity}>
          <rect
            x={0.1}
            y={0.18}
            width={0.8}
            height={0.64}
            rx={0.08}
            fill={c}
            fillOpacity={0.18}
            stroke={c}
            strokeWidth={0.08}
          />
          <path d="M0.12 0.4 H0.88 M0.12 0.6 H0.88" stroke={c} strokeWidth={0.06} strokeOpacity={0.65} />
        </g>
      );

    case "sensor":
      return (
        <g opacity={effectiveOpacity}>
          <path
            d="M0.18 0.72 A0.32 0.32 0 0 1 0.82 0.72"
            fill="none"
            stroke={c}
            strokeWidth={0.09}
            strokeLinecap="round"
          />
          <path
            d="M0.32 0.72 A0.18 0.18 0 0 1 0.68 0.72"
            fill="none"
            stroke={c}
            strokeWidth={0.07}
            strokeLinecap="round"
            strokeOpacity={0.65}
          />
          <circle cx={0.5} cy={0.74} r={0.09} fill={c} />
        </g>
      );

    default:
      return null;
  }
}
