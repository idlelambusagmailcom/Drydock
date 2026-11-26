import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";

const PORT = 3000;
const HOST = "0.0.0.0";
const DATA_DIR = path.resolve(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "accounts.json");

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const ALLOWED_VIEWS = new Set([
  "home",
  "hangar",
  "builder",
  "flight",
  "play-select",
  "star-map",
  "playing",
  "progress",
]);

interface StoredAccountState {
  fleet: unknown[];
  clearedSectorIds: string[];
  playerLevel: number;
  activeShipId: string;
  lastView: string;
  updatedAt: number;
}

interface StoredUser {
  id: string;
  username: string;
  usernameLower: string;
  createdAt: number;
  state: StoredAccountState;
}

interface AccountsStoreFile {
  users: StoredUser[];
}

interface TokenPayload {
  sub: string;
  username: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUserId?: string;
  authUsername?: string;
}

let writeQueue: Promise<void> = Promise.resolve();

async function readStore(): Promise<AccountsStoreFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AccountsStoreFile>;
    if (Array.isArray(parsed.users)) {
      return { users: parsed.users };
    }
    return { users: [] };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return { users: [] };
    }
    throw err;
  }
}

function enqueueStoreWrite(mutator: (store: AccountsStoreFile) => AccountsStoreFile | Promise<AccountsStoreFile>): Promise<void> {
  const run = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const current = await readStore();
    const next = await mutator(current);
    const tmpPath = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(next, null, 2), "utf8");
    await fs.rename(tmpPath, STORE_PATH);
  };
  const pending = writeQueue.then(run, run);
  writeQueue = pending.catch(() => {});
  return pending;
}

function signToken(userId: string, username: string): string {
  const payload: TokenPayload = {
    sub: userId,
    username,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<TokenPayload>;
    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return {
      sub: parsed.sub,
      username: parsed.username,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

function validateUsername(raw: unknown): { ok: true; username: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Username is required." };
  }
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    return { ok: false, error: "Username must be between 3 and 24 characters." };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Username may only contain letters, numbers, underscores, and hyphens.",
    };
  }
  return { ok: true, username: trimmed };
}

function sanitizeFleet(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  const clean: unknown[] = [];
  for (const item of raw.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const ship = item as Record<string, unknown>;
    if (typeof ship.id !== "string" || typeof ship.name !== "string" || !Array.isArray(ship.cells)) {
      continue;
    }
    clean.push({
      id: ship.id.slice(0, 80),
      name: ship.name.slice(0, 64),
      updatedAt: typeof ship.updatedAt === "number" ? ship.updatedAt : Date.now(),
      cells: ship.cells.slice(0, 400),
      equipment: Array.isArray(ship.equipment) ? ship.equipment.slice(0, 40) : [],
    });
  }
  return clean;
}

function sanitizeState(raw: unknown): StoredAccountState {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fleet = sanitizeFleet(input.fleet);

  const clearedSectorIds: string[] = [];
  if (Array.isArray(input.clearedSectorIds)) {
    const seen = new Set<string>();
    for (const id of input.clearedSectorIds.slice(0, 100)) {
      if (typeof id === "string" && id.length > 0 && id.length <= 64 && !seen.has(id)) {
        seen.add(id);
        clearedSectorIds.push(id);
      }
    }
  }

  const rawLevel = typeof input.playerLevel === "number" ? Math.floor(input.playerLevel) : 1;
  const playerLevel = Number.isFinite(rawLevel) && rawLevel >= 1 ? Math.min(rawLevel, 9999) : 1;

  const activeShipId =
    typeof input.activeShipId === "string" ? input.activeShipId.slice(0, 80) : "";

  const lastView =
    typeof input.lastView === "string" && ALLOWED_VIEWS.has(input.lastView)
      ? input.lastView
      : "home";

  return {
    fleet,
    clearedSectorIds,
    playerLevel,
    activeShipId,
    lastView,
    updatedAt: Date.now(),
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    return;
  }
  req.authUserId = payload.sub;
  req.authUsername = payload.username;
  next();
}

// ============================================================================
// Server-Authoritative Online Multiplayer Rooms & Simulation
// ============================================================================

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ONLINE_ROOMS = 200;
const MAX_PLAYERS_PER_ROOM = 8;
const ROOM_IDLE_TTL_MS = 60_000;
const ENEMY_SPAWN_INTERVAL_SEC = 5.0;
const MAX_ENEMIES_PER_ROOM = 18;
const PILOT_COLORS = [
  "#5EEAD4",
  "#60A5FA",
  "#FBBF24",
  "#A78BFA",
  "#FB7185",
  "#34D399",
  "#38BDF8",
  "#F472B6",
];

interface SanitizedShipCell {
  x: number;
  y: number;
  hull: string;
  mod?: { t: string; d: number };
}

interface WeaponMount {
  lx: number;
  ly: number;
  dir: number;
  id: "pd" | "laser" | "missile" | "railgun";
  dmg: number;
}

interface OnlinePlayer {
  userId: string;
  username: string;
  color: string;
  shipName: string;
  cells: SanitizedShipCell[];
  weapons: WeaponMount[];
  shipRadius: number;
  hasCockpit: boolean;
  hasThrusters: boolean;
  maxHull: number;
  maxShield: number;
  hull: number;
  shield: number;
  mass: number;
  activeThrust: number;
  handling: number;
  topSpeed: number;
  dmgMult: number;
  dmgFlatBonus: number;
  fireRateMult: number;
  shieldRegenBonus: number;
  boostMax: number;
  boostsLeft: number;
  boostTimer: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  respawnTimer: number;
  lastHitMs: number;
  lastFireMs: number;
  lastCollisionMs: number;
  kills: number;
  score: number;
  input: {
    turnLeft: boolean;
    turnRight: boolean;
    thrust: boolean;
    brake: boolean;
    fire: boolean;
  };
  boostQueued: boolean;
  sockets: Set<WebSocket>;
}

interface OnlineEnemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  coreRadius: number;
  shieldRadius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRegen: number;
  fireCooldown: number;
  hullFlash: number;
  shieldFlash: number;
  tier: "light" | "medium" | "heavy";
}

interface OnlineProjectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number;
  dmg: number;
  fromEnemy: boolean;
}

interface OnlineParticleEvent {
  x: number;
  y: number;
  color: string;
  count: number;
}

interface OnlineRoom {
  code: string;
  createdAt: number;
  lastActiveAt: number;
  spawnTimer: number;
  elapsedSec: number;
  nextEntityId: number;
  players: Map<string, OnlinePlayer>;
  enemies: OnlineEnemy[];
  projectiles: OnlineProjectile[];
  pendingEvents: OnlineParticleEvent[];
  pendingSounds: Set<"laser" | "hit" | "boost">;
}

const PART_SPECS: Record<
  string,
  {
    isHull?: boolean;
    mass: number;
    armor?: number;
    thrust?: number;
    gen?: number;
    draw?: number;
    dmg?: number;
    shield?: number;
    agility?: number;
    boostCharges?: number;
  }
> = {
  frame: { isHull: true, mass: 1, armor: 1 },
  plate: { isHull: true, mass: 2, armor: 3 },
  bulkhead: { isHull: true, mass: 4, armor: 7 },
  spine: { isHull: true, mass: 3, armor: 4 },
  armor: { isHull: true, mass: 4, armor: 10 },
  cockpit: { mass: 3, armor: 2 },
  solar: { mass: 1, gen: 5 },
  capacitor: { mass: 2, gen: 6 },
  reactor_s: { mass: 3, gen: 14 },
  reactor_l: { mass: 7, gen: 40 },
  maneuvering: { mass: 1, thrust: 3, agility: 3, draw: 1 },
  engine_s: { mass: 2, thrust: 8, draw: 3 },
  engine_l: { mass: 4, thrust: 24, draw: 9 },
  engine_xl: { mass: 7, thrust: 42, draw: 16 },
  booster: { mass: 2, thrust: 4, draw: 2, boostCharges: 3 },
  pd: { mass: 1, draw: 3, dmg: 5 },
  laser: { mass: 2, draw: 4, dmg: 10 },
  missile: { mass: 3, draw: 1, dmg: 16 },
  railgun: { mass: 6, draw: 12, dmg: 34 },
  shield_cap: { mass: 2, shield: 12 },
  shield_emit: { mass: 3, draw: 9, shield: 24 },
  fuel: { mass: 2 },
  cargo: { mass: 3 },
  sensor: { mass: 1, draw: 2 },
};

const VALID_HULLS = new Set(["frame", "plate", "bulkhead", "spine", "armor"]);

function generateRoomCode(existing: Map<string, OnlineRoom>): string {
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += ROOM_ALPHABET[crypto.randomInt(0, ROOM_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function buildPlayerShipStats(rawShip: unknown) {
  const input = rawShip && typeof rawShip === "object" ? (rawShip as Record<string, unknown>) : {};
  const shipName =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 48)
      : "Starfighter";

  const cells: SanitizedShipCell[] = [];
  const seen = new Set<string>();
  const rawCells = Array.isArray(input.cells) ? input.cells.slice(0, 260) : [];

  for (const item of rawCells) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const x = typeof c.x === "number" ? Math.floor(c.x) : -1;
    const y = typeof c.y === "number" ? Math.floor(c.y) : -1;
    if (x < 0 || x >= 17 || y < 0 || y >= 13) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hull = typeof c.hull === "string" && VALID_HULLS.has(c.hull) ? c.hull : "plate";
    let mod: { t: string; d: number } | undefined;
    if (c.mod && typeof c.mod === "object") {
      const m = c.mod as Record<string, unknown>;
      if (typeof m.t === "string" && PART_SPECS[m.t] && !PART_SPECS[m.t].isHull) {
        const d = typeof m.d === "number" ? ((Math.floor(m.d) % 4) + 4) % 4 : 0;
        mod = { t: m.t, d };
      }
    }
    cells.push({ x, y, hull, mod });
  }

  let dmgFlatBonus = 0;
  let dmgPctBonus = 0;
  let hullFlatBonus = 0;
  let shieldFlatBonus = 0;
  let speedPctBonus = 0;
  let fireRatePctBonus = 0;
  let shieldRegenBonus = 0;

  const rawEquip = Array.isArray(input.equipment) ? input.equipment.slice(0, 24) : [];
  for (const eq of rawEquip) {
    if (!eq || typeof eq !== "object") continue;
    const eff = (eq as Record<string, unknown>).effect;
    if (!eff || typeof eff !== "object") continue;
    const e = eff as Record<string, unknown>;
    if (typeof e.dmgFlat === "number" && Number.isFinite(e.dmgFlat)) {
      dmgFlatBonus += Math.max(0, Math.min(30, e.dmgFlat));
    }
    if (typeof e.dmgPct === "number" && Number.isFinite(e.dmgPct)) {
      dmgPctBonus += Math.max(0, Math.min(60, e.dmgPct));
    }
    if (typeof e.hullFlat === "number" && Number.isFinite(e.hullFlat)) {
      hullFlatBonus += Math.max(0, Math.min(120, e.hullFlat));
    }
    if (typeof e.shieldFlat === "number" && Number.isFinite(e.shieldFlat)) {
      shieldFlatBonus += Math.max(0, Math.min(80, e.shieldFlat));
    }
    if (typeof e.speedPct === "number" && Number.isFinite(e.speedPct)) {
      speedPctBonus += Math.max(0, Math.min(50, e.speedPct));
    }
    if (typeof e.fireRatePct === "number" && Number.isFinite(e.fireRatePct)) {
      fireRatePctBonus += Math.max(0, Math.min(50, e.fireRatePct));
    }
    if (typeof e.shieldRegenFlat === "number" && Number.isFinite(e.shieldRegenFlat)) {
      shieldRegenBonus += Math.max(0, Math.min(15, e.shieldRegenFlat));
    }
  }

  let minX = 17;
  let maxX = -1;
  let minY = 13;
  let maxY = -1;
  let mass = 0;
  let armor = 0;
  let thrust = 0;
  let shield = 0;
  let agility = 0;
  let boostCharges = 0;
  let hasCockpit = false;
  let hasThrusters = false;

  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);

    const h = PART_SPECS[c.hull];
    mass += h.mass;
    armor += h.armor ?? 0;

    if (c.mod) {
      const m = PART_SPECS[c.mod.t];
      mass += m.mass;
      armor += m.armor ?? 0;
      thrust += m.thrust ?? 0;
      shield += m.shield ?? 0;
      agility += m.agility ?? 0;
      boostCharges += m.boostCharges ?? 0;
      if (c.mod.t === "cockpit") hasCockpit = true;
      if ((m.thrust ?? 0) > 0) hasThrusters = true;
    }
  }

  const w = cells.length > 0 ? maxX - minX + 1 : 3;
  const h = cells.length > 0 ? maxY - minY + 1 : 3;
  const cx = cells.length > 0 ? minX + w / 2 : 8.5;
  const cy = cells.length > 0 ? minY + h / 2 : 6.5;
  const cellPx = 11;

  const weapons: WeaponMount[] = [];
  for (const c of cells) {
    if (!c.mod) continue;
    if (c.mod.t === "pd" || c.mod.t === "laser" || c.mod.t === "missile" || c.mod.t === "railgun") {
      const spec = PART_SPECS[c.mod.t];
      weapons.push({
        lx: (c.x + 0.5 - cx) * cellPx,
        ly: (c.y + 0.5 - cy) * cellPx,
        dir: c.mod.d,
        id: c.mod.t,
        dmg: spec.dmg ?? 5,
      });
    }
  }

  const speedMult = 1 + speedPctBonus / 100;
  const effectiveMass = Math.max(1, mass);
  const maxHull = Math.max(25, Math.round(armor * 6 + cells.length * 4 + hullFlatBonus));
  const maxShield = Math.max(0, Math.round(shield + (shield > 0 ? shieldFlatBonus : 0)));
  const topSpeed =
    hasCockpit && hasThrusters
      ? Math.round((thrust / effectiveMass) * 90 * speedMult)
      : 0;
  const handling =
    cells.length > 0 && hasCockpit
      ? Math.round(((thrust * 0.4 + agility * 4.5 + 14) / effectiveMass) * 10)
      : 0;

  return {
    shipName,
    cells,
    weapons,
    shipRadius: Math.max(18, Math.min(48, Math.max(w, h) * 4.5)),
    hasCockpit,
    hasThrusters,
    maxHull,
    maxShield,
    mass: effectiveMass,
    activeThrust: hasCockpit ? thrust : 0,
    handling,
    topSpeed,
    dmgMult: 1 + dmgPctBonus / 100,
    dmgFlatBonus,
    fireRateMult: 1 + fireRatePctBonus / 100,
    shieldRegenBonus,
    boostMax: hasCockpit ? boostCharges : 0,
  };
}

const onlineRooms = new Map<string, OnlineRoom>();
const socketSessionMap = new WeakMap<WebSocket, { roomCode: string; userId: string }>();

function spawnEnemyInRoom(room: OnlineRoom): void {
  const players = Array.from(room.players.values());
  const anchor = players.length > 0 ? players[crypto.randomInt(0, players.length)] : null;
  const ax = anchor ? anchor.x : 0;
  const ay = anchor ? anchor.y : 0;
  const ang = Math.random() * Math.PI * 2;
  const dist = 340 + Math.random() * 190;

  const progressTier = Math.min(8, Math.floor(room.elapsedSec / 30));
  const roll = Math.random();
  const heavyChance = Math.min(0.45, 0.1 + progressTier * 0.04);
  const mediumChance = Math.min(0.82, heavyChance + 0.34);
  const tier: OnlineEnemy["tier"] =
    roll < heavyChance ? "heavy" : roll < mediumChance ? "medium" : "light";

  const diffScale = 0.8 + progressTier * 0.08;
  const baseHp =
    tier === "heavy"
      ? 70 + Math.floor(Math.random() * 40)
      : tier === "medium"
      ? 36 + Math.floor(Math.random() * 26)
      : 18 + Math.floor(Math.random() * 14);
  const maxHp = Math.max(24, Math.round(baseHp * diffScale * 2));
  const maxShield = Math.max(
    10,
    Math.round((tier === "heavy" ? 54 : tier === "medium" ? 30 : 16) * diffScale)
  );
  const coreRadius = tier === "heavy" ? 22 : tier === "medium" ? 16 : 12;

  const ex = ax + Math.cos(ang) * dist;
  const ey = ay + Math.sin(ang) * dist;

  room.enemies.push({
    id: room.nextEntityId++,
    x: ex,
    y: ey,
    vx: (Math.random() - 0.5) * 40,
    vy: (Math.random() - 0.5) * 40,
    coreRadius,
    shieldRadius: coreRadius + 9,
    hp: maxHp,
    maxHp,
    shield: maxShield,
    maxShield,
    shieldRegen: tier === "heavy" ? 3.2 : tier === "medium" ? 2.3 : 1.6,
    fireCooldown: 1.0 + Math.random() * 1.2,
    hullFlash: 0,
    shieldFlash: 0,
    tier,
  });

  room.pendingEvents.push({ x: ex, y: ey, color: "#5EEAD4", count: 8 });
}

function stepOnlineRoom(room: OnlineRoom, dt: number, nowMs: number): void {
  const players = Array.from(room.players.values());
  const hasConnectedSockets = players.some((p) => p.sockets.size > 0);
  if (hasConnectedSockets) {
    room.lastActiveAt = nowMs;
  }

  room.elapsedSec += dt;

  // Spawn an enemy every 5 seconds while players are in the room
  if (players.length > 0) {
    room.spawnTimer -= dt;
    if (room.spawnTimer <= 0) {
      room.spawnTimer = ENEMY_SPAWN_INTERVAL_SEC;
      if (room.enemies.length < MAX_ENEMIES_PER_ROOM) {
        spawnEnemyInRoom(room);
      }
    }
  }

  // Update Players
  for (const p of players) {
    if (!p.alive) {
      p.respawnTimer = Math.max(0, p.respawnTimer - dt);
      if (p.respawnTimer <= 0) {
        p.alive = true;
        p.hull = p.maxHull;
        p.shield = p.maxShield;
        p.boostsLeft = p.boostMax;
        p.boostTimer = 0;
        p.vx = 0;
        p.vy = 0;
        p.x = (Math.random() - 0.5) * 140;
        p.y = (Math.random() - 0.5) * 140;
        room.pendingEvents.push({ x: p.x, y: p.y, color: p.color, count: 14 });
      }
      continue;
    }

    if (p.boostQueued) {
      p.boostQueued = false;
      if (p.hasCockpit && p.boostMax > 0 && p.boostsLeft > 0 && p.boostTimer <= 0) {
        p.boostsLeft -= 1;
        p.boostTimer = 5.0;
        room.pendingSounds.add("boost");
      }
    }

    if (p.boostTimer > 0) {
      p.boostTimer = Math.max(0, p.boostTimer - dt);
    }

    const turnSpeed = p.hasCockpit ? 2.0 + Math.min(3.2, p.handling * 0.06) : 0;
    if (p.hasCockpit) {
      if (p.input.turnLeft) p.angle -= turnSpeed * dt;
      if (p.input.turnRight) p.angle += turnSpeed * dt;
    }

    const boostMult = p.boostTimer > 0 && p.hasCockpit ? 2 : 1;
    const canAccel = p.hasCockpit && p.hasThrusters && p.activeThrust > 0;

    if (!canAccel) {
      p.vx = 0;
      p.vy = 0;
    } else {
      const baseSpeedRatio = (p.activeThrust / p.mass) * 90;
      const speedMult =
        p.topSpeed > 0 && baseSpeedRatio > 0 ? p.topSpeed / baseSpeedRatio : 1;
      const accel =
        (125 + (p.activeThrust / p.mass) * 225) * speedMult * boostMult;
      const maxSpeed =
        (95 + (p.activeThrust / p.mass) * 265) * speedMult * boostMult;

      if (p.input.thrust) {
        p.vx += Math.sin(p.angle) * accel * dt;
        p.vy -= Math.cos(p.angle) * accel * dt;
      }

      const drag = p.input.brake ? 0.9 : 0.992;
      p.vx *= Math.pow(drag, dt * 60);
      p.vy *= Math.pow(drag, dt * 60);

      const spd = Math.hypot(p.vx, p.vy);
      if (spd > maxSpeed) {
        p.vx = (p.vx / spd) * maxSpeed;
        p.vy = (p.vy / spd) * maxSpeed;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Keep players gently inside a generous 4000x4000 sector arena
    if (p.x < -2000) { p.x = -2000; p.vx = Math.max(0, p.vx); }
    if (p.x > 2000) { p.x = 2000; p.vx = Math.min(0, p.vx); }
    if (p.y < -2000) { p.y = -2000; p.vy = Math.max(0, p.vy); }
    if (p.y > 2000) { p.y = 2000; p.vy = Math.min(0, p.vy); }

    // Shield recharge
    if (p.maxShield > 0 && nowMs - p.lastHitMs > 3000 && p.shield < p.maxShield) {
      p.shield = Math.min(p.maxShield, p.shield + (6 + p.shieldRegenBonus) * dt);
    }

    // Fire player weapons
    const fireCooldownMs = 195 / Math.max(0.5, p.fireRateMult);
    if (
      p.hasCockpit &&
      p.input.fire &&
      p.weapons.length > 0 &&
      nowMs - p.lastFireMs > fireCooldownMs
    ) {
      p.lastFireMs = nowMs;
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      const perWeaponFlat = p.dmgFlatBonus / p.weapons.length;

      for (const w of p.weapons) {
        const wx = w.lx * cos - w.ly * sin;
        const wy = w.lx * sin + w.ly * cos;
        const shotAngle = p.angle + w.dir * (Math.PI / 2);
        const shotSpeed =
          w.id === "railgun" ? 840 : w.id === "missile" ? 470 : 650;

        room.projectiles.push({
          id: room.nextEntityId++,
          ownerId: p.userId,
          x: p.x + wx,
          y: p.y + wy,
          vx: p.vx + Math.sin(shotAngle) * shotSpeed,
          vy: p.vy - Math.cos(shotAngle) * shotSpeed,
          color:
            w.id === "railgun"
              ? "#5EEAD4"
              : w.id === "missile"
              ? "#FBBF24"
              : "#FB7185",
          radius: w.id === "railgun" ? 3.5 : w.id === "missile" ? 3.2 : 2.4,
          life: 1.5,
          dmg: Math.max(1, Math.round((w.dmg + perWeaponFlat) * p.dmgMult)),
          fromEnemy: false,
        });
      }
      room.pendingSounds.add("laser");
    }
  }

  const damagePlayer = (p: OnlinePlayer, rawDmg: number, hitX: number, hitY: number) => {
    if (!p.alive) return;
    p.lastHitMs = nowMs;
    let remaining = rawDmg;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, remaining);
      p.shield -= absorbed;
      remaining -= absorbed;
      room.pendingEvents.push({ x: hitX, y: hitY, color: "#A78BFA", count: 5 });
    }
    if (remaining > 0) {
      p.hull = Math.max(0, p.hull - remaining);
      room.pendingEvents.push({ x: hitX, y: hitY, color: "#FB7185", count: 6 });
    }
    room.pendingSounds.add("hit");

    if (p.hull <= 0) {
      p.alive = false;
      p.respawnTimer = 3.0;
      room.pendingEvents.push({ x: p.x, y: p.y, color: "#FB7185", count: 26 });
    }
  };

  // Update Enemies
  const alivePlayers = players.filter((p) => p.alive);
  for (const e of room.enemies) {
    if (e.shield < e.maxShield) {
      e.shield = Math.min(e.maxShield, e.shield + e.shieldRegen * dt);
    }
    if (e.hullFlash > 0) e.hullFlash = Math.max(0, e.hullFlash - dt * 5);
    if (e.shieldFlash > 0) e.shieldFlash = Math.max(0, e.shieldFlash - dt * 5);

    if (alivePlayers.length > 0) {
      let target = alivePlayers[0];
      let bestDist = Math.hypot(target.x - e.x, target.y - e.y);
      for (let k = 1; k < alivePlayers.length; k++) {
        const cand = alivePlayers[k];
        const d = Math.hypot(cand.x - e.x, cand.y - e.y);
        if (d < bestDist) {
          bestDist = d;
          target = cand;
        }
      }

      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.max(1, bestDist);
      const desiredDist = e.tier === "heavy" ? 235 : 185;
      const speed = e.tier === "light" ? 115 : e.tier === "medium" ? 95 : 70;

      if (dist > desiredDist) {
        e.vx += (dx / dist) * speed * 1.15 * dt;
        e.vy += (dy / dist) * speed * 1.15 * dt;
      } else {
        e.vx += (-dy / dist) * speed * 0.65 * dt;
        e.vy += (dx / dist) * speed * 0.65 * dt;
      }

      const dSpd = Math.hypot(e.vx, e.vy);
      if (dSpd > speed) {
        e.vx = (e.vx / dSpd) * speed;
        e.vy = (e.vy / dSpd) * speed;
      }

      if (
        dist < target.shipRadius + e.coreRadius &&
        nowMs - target.lastCollisionMs > 650
      ) {
        target.lastCollisionMs = nowMs;
        damagePlayer(target, 7, target.x, target.y);
      }

      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && dist < 560) {
        e.fireCooldown = e.tier === "heavy" ? 1.7 : e.tier === "medium" ? 2.1 : 2.5;
        const aim = Math.atan2(dx, -dy);
        const projSpd = e.tier === "heavy" ? 310 : 270;
        const shotDmg = e.tier === "heavy" ? 11 : e.tier === "medium" ? 8 : 5;
        room.projectiles.push({
          id: room.nextEntityId++,
          ownerId: `enemy:${e.id}`,
          x: e.x + Math.sin(aim) * e.shieldRadius,
          y: e.y - Math.cos(aim) * e.shieldRadius,
          vx: Math.sin(aim) * projSpd,
          vy: -Math.cos(aim) * projSpd,
          color: "#FBBF24",
          radius: e.tier === "heavy" ? 3.2 : 2.5,
          life: 2.0,
          dmg: shotDmg,
          fromEnemy: true,
        });
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  // Update Projectiles
  for (let i = room.projectiles.length - 1; i >= 0; i--) {
    const pr = room.projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.life <= 0) {
      room.projectiles.splice(i, 1);
      continue;
    }

    if (!pr.fromEnemy) {
      let hitEnemy = false;
      for (let j = room.enemies.length - 1; j >= 0; j--) {
        const e = room.enemies[j];
        const hitRadius = e.shield > 0 ? e.shieldRadius : e.coreRadius;
        if (Math.hypot(pr.x - e.x, pr.y - e.y) < hitRadius + pr.radius) {
          hitEnemy = true;
          let dmgLeft = pr.dmg;

          if (e.shield > 0) {
            const absorbed = Math.min(e.shield, dmgLeft);
            e.shield -= absorbed;
            dmgLeft -= absorbed;
            e.shieldFlash = 1;
            room.pendingEvents.push({ x: pr.x, y: pr.y, color: "#A78BFA", count: 5 });
          }

          if (dmgLeft > 0) {
            e.hp = Math.max(0, e.hp - dmgLeft);
            e.hullFlash = 1;
            room.pendingEvents.push({ x: pr.x, y: pr.y, color: "#FB7185", count: 5 });
          }

          room.pendingSounds.add("hit");

          if (e.hp <= 0) {
            room.pendingEvents.push({ x: e.x, y: e.y, color: "#5EEAD4", count: 14 });
            room.pendingEvents.push({ x: e.x, y: e.y, color: "#FB7185", count: 10 });
            room.enemies.splice(j, 1);
            const shooter = room.players.get(pr.ownerId);
            if (shooter) {
              shooter.kills += 1;
              shooter.score += Math.round(e.maxHp * 2.5);
            }
          }
          break;
        }
      }
      if (hitEnemy) {
        room.projectiles.splice(i, 1);
      }
    } else {
      for (const p of alivePlayers) {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.shipRadius + pr.radius) {
          damagePlayer(p, pr.dmg, pr.x, pr.y);
          room.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }
}

function broadcastRoomSnapshot(room: OnlineRoom): void {
  const payload = JSON.stringify({
    type: "state",
    snapshot: {
      roomCode: room.code,
      nextSpawnIn: Math.max(0, room.spawnTimer),
      players: Array.from(room.players.values()).map((p) => ({
        userId: p.userId,
        username: p.username,
        color: p.color,
        shipName: p.shipName,
        cells: p.cells,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        angle: Math.round(p.angle * 1000) / 1000,
        hull: Math.ceil(p.hull),
        maxHull: p.maxHull,
        shield: Math.ceil(p.shield),
        maxShield: p.maxShield,
        thrusting: p.alive && p.hasCockpit && p.hasThrusters && p.input.thrust,
        boosting: p.alive && p.boostTimer > 0,
        boostsLeft: p.boostsLeft,
        boostMax: p.boostMax,
        boostTimer: Math.round(p.boostTimer * 10) / 10,
        alive: p.alive,
        respawnTimer: Math.round(p.respawnTimer * 10) / 10,
        kills: p.kills,
        score: p.score,
        hasCockpit: p.hasCockpit,
        hasThrusters: p.hasThrusters,
      })),
      enemies: room.enemies.map((e) => ({
        id: e.id,
        x: Math.round(e.x * 10) / 10,
        y: Math.round(e.y * 10) / 10,
        coreRadius: e.coreRadius,
        shieldRadius: e.shieldRadius,
        hp: Math.ceil(e.hp),
        maxHp: e.maxHp,
        shield: Math.ceil(e.shield),
        maxShield: e.maxShield,
        tier: e.tier,
        hullFlash: e.hullFlash,
        shieldFlash: e.shieldFlash,
      })),
      projectiles: room.projectiles.map((pr) => ({
        id: pr.id,
        x: Math.round(pr.x * 10) / 10,
        y: Math.round(pr.y * 10) / 10,
        color: pr.color,
        radius: pr.radius,
        fromEnemy: pr.fromEnemy,
      })),
      events: room.pendingEvents,
      soundEvents: Array.from(room.pendingSounds),
    },
  });

  room.pendingEvents = [];
  room.pendingSounds.clear();

  for (const p of room.players.values()) {
    for (const ws of p.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const userCheck = validateUsername(body.username);
      if (!userCheck.ok) {
        res.status(400).json({ error: userCheck.error });
        return;
      }

      const username = userCheck.username;
      const usernameLower = username.toLowerCase();

      const initialFleet = sanitizeFleet(body.initialFleet);
      const firstShip = initialFleet[0] as { id?: string } | undefined;
      const initialState: StoredAccountState = {
        fleet: initialFleet,
        clearedSectorIds: [],
        playerLevel: 1,
        activeShipId: typeof firstShip?.id === "string" ? firstShip.id : "",
        lastView: "home",
        updatedAt: Date.now(),
      };

      const userId = `usr_${crypto.randomUUID()}`;
      let conflict = false;

      await enqueueStoreWrite((store) => {
        if (store.users.some((u) => u.usernameLower === usernameLower)) {
          conflict = true;
          return store;
        }
        const created: StoredUser = {
          id: userId,
          username,
          usernameLower,
          createdAt: Date.now(),
          state: initialState,
        };
        return { users: [...store.users, created] };
      });

      if (conflict) {
        res.status(409).json({ error: "That username is already taken." });
        return;
      }

      const token = signToken(userId, username);
      res.status(201).json({
        token,
        user: { id: userId, username },
        state: initialState,
      });
    } catch {
      res.status(500).json({ error: "Unable to create account right now." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawUsername = typeof body.username === "string" ? body.username.trim() : "";

      if (!rawUsername) {
        res.status(400).json({ error: "Username is required." });
        return;
      }

      const store = await readStore();
      const found = store.users.find((u) => u.usernameLower === rawUsername.toLowerCase());
      if (!found) {
        res.status(404).json({ error: "No account found with that username." });
        return;
      }

      const token = signToken(found.id, found.username);
      res.json({
        token,
        user: { id: found.id, username: found.username },
        state: found.state,
      });
    } catch {
      res.status(500).json({ error: "Unable to sign in right now." });
    }
  });

  app.get("/api/account/state", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const store = await readStore();
      const user = store.users.find((u) => u.id === req.authUserId);
      if (!user) {
        res.status(401).json({ error: "Account not found." });
        return;
      }
      res.json({
        user: { id: user.id, username: user.username },
        state: user.state,
      });
    } catch {
      res.status(500).json({ error: "Unable to load saved progress." });
    }
  });

  app.put("/api/account/state", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const nextState = sanitizeState(req.body);
      let found = false;

      await enqueueStoreWrite((store) => {
        const idx = store.users.findIndex((u) => u.id === req.authUserId);
        if (idx < 0) {
          return store;
        }
        found = true;
        const updatedUsers = [...store.users];
        updatedUsers[idx] = {
          ...updatedUsers[idx],
          state: nextState,
        };
        return { users: updatedUsers };
      });

      if (!found) {
        res.status(401).json({ error: "Account not found." });
        return;
      }

      res.json({ ok: true, updatedAt: nextState.updatedAt });
    } catch {
      res.status(500).json({ error: "Unable to save progress." });
    }
  });

  app.post("/api/online/rooms", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const now = Date.now();
    // Prune stale empty rooms if approaching limit
    if (onlineRooms.size >= MAX_ONLINE_ROOMS) {
      for (const [code, room] of onlineRooms.entries()) {
        if (room.players.size === 0 && now - room.lastActiveAt > 10_000) {
          onlineRooms.delete(code);
        }
      }
    }
    if (onlineRooms.size >= MAX_ONLINE_ROOMS) {
      res.status(503).json({ error: "All online sectors are currently busy. Try again shortly." });
      return;
    }

    const code = generateRoomCode(onlineRooms);
    const room: OnlineRoom = {
      code,
      createdAt: now,
      lastActiveAt: now,
      spawnTimer: ENEMY_SPAWN_INTERVAL_SEC,
      elapsedSec: 0,
      nextEntityId: 1,
      players: new Map(),
      enemies: [],
      projectiles: [],
      pendingEvents: [],
      pendingSounds: new Set(),
    };
    onlineRooms.set(code, room);
    res.status(201).json({ roomCode: code });
  });

  app.get("/api/online/rooms/:code", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rawCode = typeof req.params.code === "string" ? req.params.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{4,8}$/.test(rawCode)) {
      res.status(400).json({ error: "Enter a valid 6-character room code." });
      return;
    }
    const room = onlineRooms.get(rawCode);
    if (!room) {
      res.status(404).json({ error: "Room code not found or already closed." });
      return;
    }
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      res.status(409).json({ error: "That room is currently full." });
      return;
    }
    res.json({ roomCode: room.code, playerCount: room.players.size });
  });

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API route not found." });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    try {
      const host = request.headers.host || "localhost";
      const parsed = new URL(request.url || "/", `http://${host}`);
      if (parsed.pathname !== "/ws/online") {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  const detachSocket = (ws: WebSocket) => {
    const sess = socketSessionMap.get(ws);
    if (!sess) return;
    socketSessionMap.delete(ws);

    const room = onlineRooms.get(sess.roomCode);
    if (!room) return;
    const player = room.players.get(sess.userId);
    if (!player) return;

    player.sockets.delete(ws);
    if (player.sockets.size === 0) {
      room.players.delete(sess.userId);
    }
    room.lastActiveAt = Date.now();
  };

  wss.on("connection", (ws: WebSocket) => {
    const authTimeout = setTimeout(() => {
      if (!socketSessionMap.has(ws)) {
        ws.close(4001, "Authentication timeout");
      }
    }, 8000);

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      const type = msg.type;
      if (type === "join") {
        clearTimeout(authTimeout);
        const token = typeof msg.token === "string" ? msg.token.trim() : "";
        const payload = verifyToken(token);
        if (!payload) {
          ws.send(JSON.stringify({ type: "error", message: "Authentication required." }));
          ws.close(4001, "Unauthorized");
          return;
        }

        const roomCode =
          typeof msg.roomCode === "string" ? msg.roomCode.trim().toUpperCase() : "";
        const room = onlineRooms.get(roomCode);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room code not found or closed." }));
          ws.close(4004, "Room not found");
          return;
        }

        const existingPlayer = room.players.get(payload.sub);
        if (!existingPlayer && room.players.size >= MAX_PLAYERS_PER_ROOM) {
          ws.send(JSON.stringify({ type: "error", message: "Room is full." }));
          ws.close(4009, "Room full");
          return;
        }

        // Clean up any previous room association on this socket
        detachSocket(ws);

        const stats = buildPlayerShipStats(msg.ship);
        const color =
          existingPlayer?.color ??
          PILOT_COLORS[room.players.size % PILOT_COLORS.length];

        if (existingPlayer) {
          existingPlayer.sockets.add(ws);
          existingPlayer.shipName = stats.shipName;
          existingPlayer.cells = stats.cells;
          existingPlayer.weapons = stats.weapons;
          existingPlayer.shipRadius = stats.shipRadius;
          existingPlayer.hasCockpit = stats.hasCockpit;
          existingPlayer.hasThrusters = stats.hasThrusters;
          existingPlayer.maxHull = stats.maxHull;
          existingPlayer.maxShield = stats.maxShield;
          existingPlayer.hull = Math.min(existingPlayer.hull, stats.maxHull);
          existingPlayer.shield = Math.min(existingPlayer.shield, stats.maxShield);
          existingPlayer.mass = stats.mass;
          existingPlayer.activeThrust = stats.activeThrust;
          existingPlayer.handling = stats.handling;
          existingPlayer.topSpeed = stats.topSpeed;
          existingPlayer.dmgMult = stats.dmgMult;
          existingPlayer.dmgFlatBonus = stats.dmgFlatBonus;
          existingPlayer.fireRateMult = stats.fireRateMult;
          existingPlayer.shieldRegenBonus = stats.shieldRegenBonus;
          existingPlayer.boostMax = stats.boostMax;
          existingPlayer.boostsLeft = Math.min(existingPlayer.boostsLeft, stats.boostMax);
        } else {
          const spawnAngle = (room.players.size * Math.PI * 2) / 6;
          const spawnDist = room.players.size === 0 ? 0 : 120;
          room.players.set(payload.sub, {
            userId: payload.sub,
            username: payload.username,
            color,
            shipName: stats.shipName,
            cells: stats.cells,
            weapons: stats.weapons,
            shipRadius: stats.shipRadius,
            hasCockpit: stats.hasCockpit,
            hasThrusters: stats.hasThrusters,
            maxHull: stats.maxHull,
            maxShield: stats.maxShield,
            hull: stats.maxHull,
            shield: stats.maxShield,
            mass: stats.mass,
            activeThrust: stats.activeThrust,
            handling: stats.handling,
            topSpeed: stats.topSpeed,
            dmgMult: stats.dmgMult,
            dmgFlatBonus: stats.dmgFlatBonus,
            fireRateMult: stats.fireRateMult,
            shieldRegenBonus: stats.shieldRegenBonus,
            boostMax: stats.boostMax,
            boostsLeft: stats.boostMax,
            boostTimer: 0,
            x: Math.cos(spawnAngle) * spawnDist,
            y: Math.sin(spawnAngle) * spawnDist,
            vx: 0,
            vy: 0,
            angle: 0,
            alive: true,
            respawnTimer: 0,
            lastHitMs: 0,
            lastFireMs: 0,
            lastCollisionMs: 0,
            kills: 0,
            score: 0,
            input: {
              turnLeft: false,
              turnRight: false,
              thrust: false,
              brake: false,
              fire: false,
            },
            boostQueued: false,
            sockets: new Set([ws]),
          });
        }

        room.lastActiveAt = Date.now();
        socketSessionMap.set(ws, { roomCode: room.code, userId: payload.sub });
        ws.send(JSON.stringify({ type: "joined", roomCode: room.code, userId: payload.sub }));
        return;
      }

      const sess = socketSessionMap.get(ws);
      if (!sess) return;
      const room = onlineRooms.get(sess.roomCode);
      if (!room) return;
      const player = room.players.get(sess.userId);
      if (!player) return;

      if (type === "input") {
        player.input.turnLeft = Boolean(msg.turnLeft);
        player.input.turnRight = Boolean(msg.turnRight);
        player.input.thrust = Boolean(msg.thrust);
        player.input.brake = Boolean(msg.brake);
        player.input.fire = Boolean(msg.fire);
        if (msg.boost === true) {
          player.boostQueued = true;
        }
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      detachSocket(ws);
    });

    ws.on("error", () => {
      clearTimeout(authTimeout);
      detachSocket(ws);
    });
  });

  // Authoritative 20Hz Online Room Simulation & State Broadcast
  let lastTickMs = Date.now();
  setInterval(() => {
    const nowMs = Date.now();
    const dt = Math.min(0.1, Math.max(0.01, (nowMs - lastTickMs) / 1000));
    lastTickMs = nowMs;

    for (const [code, room] of onlineRooms.entries()) {
      if (room.players.size === 0 && nowMs - room.lastActiveAt > ROOM_IDLE_TTL_MS) {
        onlineRooms.delete(code);
        continue;
      }
      if (room.players.size > 0) {
        stepOnlineRoom(room, dt, nowMs);
        broadcastRoomSnapshot(room);
      }
    }
  }, 50);

  httpServer.listen(PORT, HOST, () => {
    console.log(`DRYDOCK server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
