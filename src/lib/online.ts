import { ShipEquipment } from "@/lib/equipment";
import { ShipCell } from "@/lib/parts";

export interface OnlineShipPayload {
  id: string;
  name: string;
  cells: ShipCell[];
  equipment: ShipEquipment[];
}

export interface OnlinePlayerSnapshot {
  userId: string;
  username: string;
  color: string;
  shipName: string;
  cells: ShipCell[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  thrusting: boolean;
  boosting: boolean;
  boostsLeft: number;
  boostMax: number;
  boostTimer: number;
  alive: boolean;
  respawnTimer: number;
  kills: number;
  score: number;
  hasCockpit: boolean;
  hasThrusters: boolean;
}

export interface OnlineEnemySnapshot {
  id: number;
  x: number;
  y: number;
  coreRadius: number;
  shieldRadius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  tier: "light" | "medium" | "heavy";
  hullFlash: number;
  shieldFlash: number;
}

export interface OnlineProjectileSnapshot {
  id: number;
  x: number;
  y: number;
  color: string;
  radius: number;
  fromEnemy: boolean;
}

export interface OnlineParticleEvent {
  x: number;
  y: number;
  color: string;
  count: number;
}

export interface OnlineRoomSnapshot {
  roomCode: string;
  nextSpawnIn: number;
  players: OnlinePlayerSnapshot[];
  enemies: OnlineEnemySnapshot[];
  projectiles: OnlineProjectileSnapshot[];
  events: OnlineParticleEvent[];
  soundEvents?: ("laser" | "hit" | "boost")[];
}

export interface OnlineInputState {
  turnLeft: boolean;
  turnRight: boolean;
  thrust: boolean;
  brake: boolean;
  fire: boolean;
}

export async function createOnlineRoom(token: string): Promise<{ roomCode: string }> {
  const res = await fetch("/api/online/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    roomCode?: string;
    error?: string;
  };
  if (!res.ok || !data.roomCode) {
    throw new Error(data.error || "Unable to create online room.");
  }
  return { roomCode: data.roomCode };
}

export async function verifyOnlineRoom(
  token: string,
  roomCode: string
): Promise<{ roomCode: string; playerCount: number }> {
  const normalized = roomCode.trim().toUpperCase();
  const res = await fetch(`/api/online/rooms/${encodeURIComponent(normalized)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    roomCode?: string;
    playerCount?: number;
    error?: string;
  };
  if (!res.ok || !data.roomCode) {
    throw new Error(data.error || "Room not found.");
  }
  return {
    roomCode: data.roomCode,
    playerCount: typeof data.playerCount === "number" ? data.playerCount : 0,
  };
}
