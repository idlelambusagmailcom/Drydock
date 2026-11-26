export interface EquipmentEffect {
  dmgFlat?: number;
  dmgPct?: number;
  hullFlat?: number;
  shieldFlat?: number;
  powerFlat?: number;
  speedPct?: number;
  fireRatePct?: number;
  shieldRegenFlat?: number;
}

export interface ShipEquipment {
  id: string;
  templateId: string;
  name: string;
  effectLabel: string;
  effect: EquipmentEffect;
}

interface EquipmentTemplate {
  templateId: string;
  name: string;
  effectLabel: string;
  effect: EquipmentEffect;
}

export const EQUIPMENT_POOL: EquipmentTemplate[] = [
  {
    templateId: "overcharged-coils",
    name: "Overcharged Coils",
    effectLabel: "+25% Weapon Damage",
    effect: { dmgPct: 25 },
  },
  {
    templateId: "kinetic-amplifier",
    name: "Kinetic Amplifier",
    effectLabel: "+12 Weapon Damage",
    effect: { dmgFlat: 12 },
  },
  {
    templateId: "nanite-plating",
    name: "Nanite Hull Plating",
    effectLabel: "+50 Hull Health",
    effect: { hullFlat: 50 },
  },
  {
    templateId: "aegis-capacitor",
    name: "Aegis Capacitor",
    effectLabel: "+30 Max Shields",
    effect: { shieldFlat: 30 },
  },
  {
    templateId: "ion-overdrive",
    name: "Ion Overdrive",
    effectLabel: "+20% Top Speed",
    effect: { speedPct: 20 },
  },
  {
    templateId: "reactor-supercharger",
    name: "Reactor Supercharger",
    effectLabel: "+12 Power Generation",
    effect: { powerFlat: 12 },
  },
  {
    templateId: "cryo-vents",
    name: "Cryo Cooling Vents",
    effectLabel: "+20% Fire Rate",
    effect: { fireRatePct: 20 },
  },
  {
    templateId: "harmonic-shield-core",
    name: "Harmonic Shield Core",
    effectLabel: "+5/s Shield Recharge",
    effect: { shieldRegenFlat: 5 },
  },
];

export function rollRandomEquipment(): ShipEquipment {
  const pick =
    EQUIPMENT_POOL[Math.floor(Math.random() * EQUIPMENT_POOL.length)];
  return {
    id: `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    templateId: pick.templateId,
    name: pick.name,
    effectLabel: pick.effectLabel,
    effect: { ...pick.effect },
  };
}

export interface AggregatedEquipmentBonuses {
  dmgFlat: number;
  dmgMult: number;
  hullFlat: number;
  shieldFlat: number;
  powerFlat: number;
  speedMult: number;
  fireRateMult: number;
  shieldRegenBonus: number;
}

export function aggregateEquipment(
  list: ShipEquipment[] | undefined
): AggregatedEquipmentBonuses {
  const acc: AggregatedEquipmentBonuses = {
    dmgFlat: 0,
    dmgMult: 1,
    hullFlat: 0,
    shieldFlat: 0,
    powerFlat: 0,
    speedMult: 1,
    fireRateMult: 1,
    shieldRegenBonus: 0,
  };

  if (!Array.isArray(list)) return acc;

  for (const item of list) {
    const ef = item?.effect;
    if (!ef) continue;
    if (ef.dmgFlat) acc.dmgFlat += ef.dmgFlat;
    if (ef.dmgPct) acc.dmgMult += ef.dmgPct / 100;
    if (ef.hullFlat) acc.hullFlat += ef.hullFlat;
    if (ef.shieldFlat) acc.shieldFlat += ef.shieldFlat;
    if (ef.powerFlat) acc.powerFlat += ef.powerFlat;
    if (ef.speedPct) acc.speedMult += ef.speedPct / 100;
    if (ef.fireRatePct) acc.fireRateMult += ef.fireRatePct / 100;
    if (ef.shieldRegenFlat) acc.shieldRegenBonus += ef.shieldRegenFlat;
  }

  return acc;
}
