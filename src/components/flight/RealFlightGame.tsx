import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Zap,
} from "lucide-react";
import {
  PARTS,
  ShipCellMap,
  cellKey,
  cellsFromArray,
  computeStats,
  selectNextBrownoutKeys,
  shipBounds,
} from "@/lib/parts";
import { StarSector } from "@/lib/sectors";
import { ShipRecord } from "@/lib/ships";
import {
  playBoostSound,
  playBrownoutSound,
  playHitSound,
  playLaserSound,
} from "@/lib/audio";
import ShipPreview from "@/components/ship/ShipPreview";

interface RealFlightGameProps {
  ship: ShipRecord;
  sector: StarSector;
  willUnlockBossOnClear?: boolean;
  onChallengeBoss?: () => void;
  onSectorCleared: (sectorId: string) => void;
  onReturnHome: () => void;
  onBackToMap: () => void;
  onChangeShip: () => void;
  onEditShip: (shipId: string) => void;
}

type GamePhase = "PLAYING" | "PAUSED" | "VICTORY" | "GAME_OVER";

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
}

interface Projectile {
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

interface BubbleDrone {
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
  radialCooldown?: number;
  hullFlash: number;
  shieldFlash: number;
  tier: "light" | "medium" | "heavy" | "boss";
  isBoss?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export default function RealFlightGame({
  ship,
  sector,
  willUnlockBossOnClear = false,
  onChallengeBoss,
  onSectorCleared,
  onReturnHome,
  onBackToMap,
  onChangeShip,
  onEditShip,
}: RealFlightGameProps) {
  const cellMap = useMemo(() => cellsFromArray(ship.cells), [ship.cells]);
  const baseStats = useMemo(
    () => computeStats(cellMap, undefined, ship.equipment),
    [cellMap, ship.equipment]
  );
  const bounds = useMemo(() => shipBounds(cellMap), [cellMap]);

  const [phase, setPhase] = useState<GamePhase>("PLAYING");
  const [runId, setRunId] = useState(0);
  const [hitFlash, setHitFlash] = useState(false);
  const [offlineKeys, setOfflineKeys] = useState<Set<string>>(() => new Set());
  const allModuleKeys = useMemo(
    () =>
      new Set(
        Object.values(cellMap)
          .filter((c) => Boolean(c.mod))
          .map((c) => cellKey(c.x, c.y))
      ),
    [cellMap]
  );
  const effectiveOfflineKeys = baseStats.hasCockpit ? offlineKeys : allModuleKeys;
  const liveStats = useMemo(
    () => computeStats(cellMap, effectiveOfflineKeys, ship.equipment),
    [cellMap, effectiveOfflineKeys, ship.equipment]
  );

  const isBossSector = Boolean(sector.isBoss);
  const totalWaves = sector.waves;

  const [hud, setHud] = useState({
    hull: baseStats.hullHP,
    maxHull: Math.max(1, baseStats.hullHP),
    shield: baseStats.shield,
    maxShield: baseStats.shield,
    speed: 0,
    thrustActive: false,
    wave: 1,
    waveRemaining: isBossSector
      ? 1
      : 6 +
        Math.floor(sector.difficulty * 0.75) +
        (sector.trait === "swarm" ? 3 + Math.ceil(sector.difficulty * 0.5) : 0),
    kills: 0,
    score: 0,
    waveBanner: isBossSector
      ? `${sector.name} · Difficulty 15/10`
      : `Wave 1 of ${sector.waves}`,
    bossHp: isBossSector ? 3600 : 0,
    bossMaxHp: isBossSector ? 3600 : 0,
    bossShield: isBossSector ? 900 : 0,
    bossMaxShield: isBossSector ? 900 : 0,
    boostsLeft: baseStats.boostCharges,
    boostTimer: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shipNodeRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const boostTriggerRef = useRef<boolean>(false);
  const touchRef = useRef({
    left: false,
    right: false,
    thrust: false,
    brake: false,
    fire: false,
  });

  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const liveStatsRef = useRef(liveStats);
  liveStatsRef.current = liveStats;
  const offlineKeysRef = useRef(offlineKeys);
  offlineKeysRef.current = offlineKeys;
  const cellMapRef = useRef<ShipCellMap>(cellMap);
  cellMapRef.current = cellMap;

  const onSectorClearedRef = useRef(onSectorCleared);
  onSectorClearedRef.current = onSectorCleared;

  // Automatically return to Home Page after sector victory (skip auto-redirect when unlocking Boss so player can launch Boss directly)
  useEffect(() => {
    if (phase !== "VICTORY" || willUnlockBossOnClear) return;
    const timer = window.setTimeout(() => {
      onReturnHome();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [phase, willUnlockBossOnClear, onReturnHome]);

  // Power Overload Brownout Simulation (switches between modules every 3-5 seconds)
  useEffect(() => {
    if (
      phase !== "PLAYING" ||
      !baseStats.isPowerOverloaded ||
      baseStats.poweredCellKeys.length === 0
    ) {
      setOfflineKeys(new Set());
      return;
    }

    let cancelled = false;
    let timerId: number | null = null;
    let prevOffline = new Set<string>();

    const cycle = () => {
      if (cancelled) return;
      const nextOffline = selectNextBrownoutKeys(
        baseStats.poweredCellKeys,
        prevOffline,
        baseStats.gen,
        baseStats.draw
      );
      prevOffline = nextOffline;
      setOfflineKeys(nextOffline);
      if (nextOffline.size > 0) {
        playBrownoutSound();
      }

      const delayMs =
        nextOffline.size === 0 ? 1200 : 3000 + Math.random() * 2000;
      timerId = window.setTimeout(cycle, delayMs);
    };

    cycle();
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [phase, baseStats.isPowerOverloaded, baseStats.draw, baseStats.gen, baseStats.poweredCellKeys]);

  // Keyboard bindings
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        boostTriggerRef.current = true;
        return;
      }
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
      }
      if (k === "escape" || k === "p") {
        setPhase((prev) =>
          prev === "PLAYING" ? "PAUSED" : prev === "PAUSED" ? "PLAYING" : prev
        );
        return;
      }
      keysRef.current.add(k);
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Main Flight & 3-Wave Bubble Drone Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const stars: Star[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * 2400,
      y: Math.random() * 1600,
      z: 0.16 + Math.random() * 0.84,
      size: 0.8 + Math.random() * 1.6,
      alpha: 0.25 + Math.random() * 0.72,
    }));

    const diff = sector.difficulty; // 1..10 (15 for Boss)
    const diffScale = 0.7 + diff * 0.1; // 0.8x at Lv1, 1.7x at Lv10, 2.2x at Lv15
    const hpMult =
      diffScale * (sector.trait === "armored" ? 1 + diff * 0.05 : 1);
    const dmgMult =
      (0.75 + diff * 0.08) *
      (!isBossSector && sector.trait === "firepower" ? 1 + diff * 0.06 : 1);
    const regenMult =
      (0.8 + diff * 0.08) * (sector.trait === "regen" ? 1 + diff * 0.1 : 1);
    const fireRateScale =
      (1 + diff * 0.04) * (sector.trait === "rapid" ? 1 + diff * 0.06 : 1);
    const speedScale =
      (0.85 + diff * 0.04) * (sector.trait === "agile" ? 1 + diff * 0.05 : 1);

    let nextDroneId = 1;
    const createBubbleDrone = (
      waveNum: number,
      camX: number,
      camY: number,
      minDist = 340,
      forcedTier?: "light" | "medium" | "heavy"
    ): BubbleDrone => {
      const ang = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * 220;
      const roll = Math.random();
      const heavyChance = Math.min(0.6, 0.12 + diff * 0.03 + (waveNum - 1) * 0.06);
      const mediumChance = Math.min(0.85, heavyChance + 0.32);
      const tier: BubbleDrone["tier"] =
        forcedTier ??
        (roll < heavyChance ? "heavy" : roll < mediumChance ? "medium" : "light");

      const waveScale = 1 + (waveNum - 1) * 0.12;
      const baseHp =
        tier === "heavy"
          ? 70 + Math.floor(Math.random() * 40)
          : tier === "medium"
          ? 36 + Math.floor(Math.random() * 26)
          : 18 + Math.floor(Math.random() * 14);

      const maxHp = Math.max(24, Math.round(baseHp * hpMult * waveScale * 2));
      const maxShield = Math.max(
        10,
        Math.round(
          (tier === "heavy" ? 54 : tier === "medium" ? 30 : 16) *
            hpMult *
            waveScale
        )
      );
      const coreRadius = tier === "heavy" ? 22 : tier === "medium" ? 16 : 12;

      return {
        id: nextDroneId++,
        x: camX + Math.cos(ang) * dist,
        y: camY + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        coreRadius,
        shieldRadius: coreRadius + 9,
        hp: maxHp,
        maxHp,
        shield: maxShield,
        maxShield,
        shieldRegen:
          (tier === "heavy" ? 3.2 : tier === "medium" ? 2.3 : 1.6) * regenMult,
        fireCooldown: (1.0 + Math.random() * 1.4) / fireRateScale,
        hullFlash: 0,
        shieldFlash: 0,
        tier,
      };
    };

    const createBossDrone = (camX: number, camY: number): BubbleDrone => {
      // ~10x HP of a heavy sector drone (3600 HP + 900 outer shield)
      const maxHp = 3600;
      const maxShield = 900;
      return {
        id: nextDroneId++,
        x: camX,
        y: camY - 360,
        vx: 35,
        vy: 0,
        coreRadius: 56,
        shieldRadius: 76,
        hp: maxHp,
        maxHp,
        shield: maxShield,
        maxShield,
        shieldRegen: 6.5,
        fireCooldown: 1.4,
        radialCooldown: 3.8,
        hullFlash: 0,
        shieldFlash: 0,
        tier: "boss",
        isBoss: true,
      };
    };

    const waveTotalFor = (waveNum: number) => {
      if (isBossSector) return 1;
      const base = 4 + waveNum * 2 + Math.floor(diff * 0.75);
      const swarmBonus =
        sector.trait === "swarm" ? 3 + Math.ceil(diff * 0.5) : 0;
      return base + swarmBonus;
    };

    const shipRadius = bounds
      ? Math.max(18, Math.min(48, Math.max(bounds.w, bounds.h) * 4.5))
      : 24;

    const initialWaveTotal = waveTotalFor(1);
    const initialBurst = Math.min(6, initialWaveTotal);

    const initialDrones: BubbleDrone[] = isBossSector
      ? [
          createBossDrone(0, 0),
          createBubbleDrone(1, 0, 0, 290, "light"),
          createBubbleDrone(1, 0, 0, 320, "light"),
        ]
      : Array.from({ length: initialBurst }, () =>
          createBubbleDrone(1, 0, 0, 290)
        );

    const state = {
      angle: 0,
      vx: 0,
      vy: 0,
      camX: 0,
      camY: 0,
      hull: Math.max(1, baseStats.hullHP),
      maxHull: Math.max(1, baseStats.hullHP),
      shield: baseStats.shield,
      lastHitTime: 0,
      lastCollisionTime: 0,
      lastFire: 0,
      wave: 1,
      waveQueue: isBossSector ? 0 : initialWaveTotal - initialBurst,
      spawnTimer: 1.0,
      bossAddSpawnTimer: 3.0,
      waveTransitionTimer: 0,
      waveBannerTimer: 2.2,
      waveBannerText: isBossSector
        ? `${sector.name} · Difficulty 15/10`
        : `Wave 1 of ${totalWaves}`,
      kills: 0,
      score: 0,
      boostsLeft: baseStats.boostCharges,
      boostTimer: 0,
      projectiles: [] as Projectile[],
      drones: initialDrones,
      particles: [] as Particle[],
    };

    let lastTime = performance.now();
    let lastHudSync = 0;
    let rafId = 0;

    const spawnBurst = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 150;
        state.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7,
          color,
          size: 1.8 + Math.random() * 2.2,
        });
      }
    };

    const applyDamageToPlayer = (rawDmg: number, now: number, hitX: number, hitY: number) => {
      state.lastHitTime = now;
      let remaining = rawDmg;
      if (state.shield > 0) {
        const absorbed = Math.min(state.shield, remaining);
        state.shield -= absorbed;
        remaining -= absorbed;
        spawnBurst(hitX, hitY, "#A78BFA", 5);
      }
      if (remaining > 0) {
        state.hull = Math.max(0, state.hull - remaining);
        spawnBurst(hitX, hitY, "#FB7185", 6);
        setHitFlash(true);
        window.setTimeout(() => setHitFlash(false), 150);
      }
      playHitSound();

      if (state.hull <= 0) {
        spawnBurst(state.camX, state.camY, "#FB7185", 28);
        setPhase("GAME_OVER");
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const stats = liveStatsRef.current;
      const isPlaying = phaseRef.current === "PLAYING";

      let isThrusting = false;

      if (isPlaying) {
        const keys = keysRef.current;
        const touch = touchRef.current;

        if (boostTriggerRef.current) {
          boostTriggerRef.current = false;
          if (
            stats.hasCockpit &&
            stats.activeBoostCharges > 0 &&
            state.boostsLeft > 0 &&
            state.boostTimer <= 0
          ) {
            state.boostsLeft -= 1;
            state.boostTimer = 5.0;
            playBoostSound();
          }
        }
        if (state.boostTimer > 0) {
          state.boostTimer = Math.max(0, state.boostTimer - dt);
        }

        const turnLeft = keys.has("a") || keys.has("arrowleft") || touch.left;
        const turnRight = keys.has("d") || keys.has("arrowright") || touch.right;
        const wantThrust = keys.has("w") || keys.has("arrowup") || touch.thrust;
        const wantBrake = keys.has("s") || keys.has("arrowdown") || touch.brake;
        const wantFire = keys.has(" ") || touch.fire;

        const turnSpeed = stats.hasCockpit
          ? 2.0 + Math.min(3.2, stats.handling * 0.06)
          : 0;
        if (stats.hasCockpit) {
          if (turnLeft) state.angle -= turnSpeed * dt;
          if (turnRight) state.angle += turnSpeed * dt;
        }

        // No cockpit or no thrusters -> dead in space (nothing turns on)
        const canAccel =
          stats.hasCockpit && stats.hasThrusters && stats.activeThrust > 0;
        isThrusting = wantThrust && canAccel;
        const boostMult = state.boostTimer > 0 && stats.hasCockpit ? 2 : 1;

        if (!stats.hasCockpit || !stats.hasThrusters) {
          state.vx = 0;
          state.vy = 0;
        } else {
          const speedMult = stats.topSpeed > 0 && stats.activeThrust > 0 && stats.mass > 0
            ? stats.topSpeed / ((stats.activeThrust / stats.mass) * 90)
            : 1;
          const accel = canAccel
            ? (125 + (stats.activeThrust / Math.max(1, stats.mass)) * 225) *
              speedMult *
              boostMult
            : 0;
          const maxSpeed =
            (95 + (stats.activeThrust / Math.max(1, stats.mass)) * 265) *
            speedMult *
            boostMult;

          if (isThrusting) {
            state.vx += Math.sin(state.angle) * accel * dt;
            state.vy -= Math.cos(state.angle) * accel * dt;
          }

          const drag = wantBrake ? 0.9 : 0.992;
          state.vx *= Math.pow(drag, dt * 60);
          state.vy *= Math.pow(drag, dt * 60);

          const spd = Math.hypot(state.vx, state.vy);
          if (spd > maxSpeed) {
            state.vx = (state.vx / spd) * maxSpeed;
            state.vy = (state.vy / spd) * maxSpeed;
          }
        }

        state.camX += state.vx * dt;
        state.camY += state.vy * dt;

        if (state.waveBannerTimer > 0) {
          state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);
        }

        // Player shield cap & recharge (boosted by shieldRegenBonus equipment)
        const activeMaxShield = stats.activeShield;
        if (state.shield > activeMaxShield) {
          state.shield = activeMaxShield;
        } else if (
          activeMaxShield > 0 &&
          now - state.lastHitTime > 3000 &&
          state.shield < activeMaxShield
        ) {
          state.shield = Math.min(
            activeMaxShield,
            state.shield + (6 + stats.shieldRegenBonus) * dt
          );
        }

        // Fire player weapons (requires cockpit and non-browned-out weapons)
        const fireCooldownMs = 195 / Math.max(0.5, stats.fireRateMult);
        if (stats.hasCockpit && wantFire && now - state.lastFire > fireCooldownMs) {
          const offline = offlineKeysRef.current;
          const cells = Object.values(cellMapRef.current);
          const cx = bounds ? bounds.minX + bounds.w / 2 : 8.5;
          const cy = bounds ? bounds.minY + bounds.h / 2 : 6.5;
          const cellPx = 11;
          let fired = false;

          const weaponList = cells.filter((c) => {
            if (!c.mod) return false;
            const p = PARTS[c.mod.t];
            return Boolean(p?.dmg && p.dmg > 0) && !offline.has(cellKey(c.x, c.y));
          });
          const perWeaponFlat =
            weaponList.length > 0 ? stats.dmgFlatBonus / weaponList.length : 0;

          for (const c of weaponList) {
            if (!c.mod) continue;
            const p = PARTS[c.mod.t];
            if (!p?.dmg || p.dmg <= 0) continue;

            fired = true;
            const lx = (c.x + 0.5 - cx) * cellPx;
            const ly = (c.y + 0.5 - cy) * cellPx;
            const cos = Math.cos(state.angle);
            const sin = Math.sin(state.angle);
            const wx = lx * cos - ly * sin;
            const wy = lx * sin + ly * cos;

            const shotAngle = state.angle + c.mod.d * (Math.PI / 2);
            const shotSpeed =
              p.id === "railgun" ? 840 : p.id === "missile" ? 470 : 650;

            state.projectiles.push({
              x: state.camX + wx,
              y: state.camY + wy,
              vx: state.vx + Math.sin(shotAngle) * shotSpeed,
              vy: state.vy - Math.cos(shotAngle) * shotSpeed,
              color:
                p.id === "railgun"
                  ? "#5EEAD4"
                  : p.id === "missile"
                  ? "#FBBF24"
                  : "#FB7185",
              radius: p.id === "railgun" ? 3.5 : p.id === "missile" ? 3.2 : 2.4,
              life: 1.5,
              dmg: Math.max(1, Math.round((p.dmg + perWeaponFlat) * stats.dmgMult)),
              fromEnemy: false,
            });
          }

          if (fired) {
            state.lastFire = now;
            playLaserSound();
          }
        }

        // Spawning logic: Boss arena spawns small enemies every 3 seconds; regular sectors stagger wave drones
        if (isBossSector) {
          const bossAlive = state.drones.some((d) => d.isBoss);
          if (bossAlive) {
            state.bossAddSpawnTimer -= dt;
            if (state.bossAddSpawnTimer <= 0) {
              state.bossAddSpawnTimer = 3.0;
              if (state.drones.length < 11) {
                const addTier = Math.random() < 0.2 ? "medium" : "light";
                const spawned = createBubbleDrone(
                  1,
                  state.camX,
                  state.camY,
                  280,
                  addTier
                );
                state.drones.push(spawned);
                spawnBurst(spawned.x, spawned.y, "#5EEAD4", 8);
              }
            }
          }
        } else if (state.waveQueue > 0) {
          state.spawnTimer -= dt;
          if (state.spawnTimer <= 0 && state.drones.length < 12) {
            state.drones.push(createBubbleDrone(state.wave, state.camX, state.camY, 360));
            state.waveQueue -= 1;
            state.spawnTimer = sector.trait === "swarm" ? 0.45 : 0.6;
          }
        } else if (state.drones.length === 0) {
          // Wave cleared!
          if (state.wave < totalWaves) {
            state.waveTransitionTimer += dt;
            if (state.waveTransitionTimer === dt) {
              state.waveBannerText = `Wave ${state.wave} Cleared`;
              state.waveBannerTimer = 1.2;
            }
            if (state.waveTransitionTimer >= 1.3) {
              state.wave += 1;
              state.waveTransitionTimer = 0;
              const nextTotal = waveTotalFor(state.wave);
              const initial = Math.min(6, nextTotal);
              state.waveQueue = nextTotal - initial;
              state.drones = Array.from({ length: initial }, () =>
                createBubbleDrone(state.wave, state.camX, state.camY, 340)
              );
              state.waveBannerText = `Wave ${state.wave} of ${totalWaves}`;
              state.waveBannerTimer = 1.8;
            }
          } else {
            // All waves defeated -> Sector cleared!
            onSectorClearedRef.current(sector.id);
            setPhase("VICTORY");
          }
        }

        // Update Bubble Drones & Boss
        for (const d of state.drones) {
          if (d.shield < d.maxShield) {
            d.shield = Math.min(d.maxShield, d.shield + d.shieldRegen * dt);
          }

          const dx = state.camX - d.x;
          const dy = state.camY - d.y;
          const dist = Math.hypot(dx, dy) || 1;
          const desiredDist = d.isBoss ? 275 : d.tier === "heavy" ? 235 : 180;
          const speed = d.isBoss
            ? 68
            : (d.tier === "light" ? 115 : d.tier === "medium" ? 95 : 70) *
              speedScale;

          if (dist > desiredDist) {
            d.vx += (dx / dist) * speed * 1.15 * dt;
            d.vy += (dy / dist) * speed * 1.15 * dt;
          } else {
            d.vx += (-dy / dist) * speed * 0.65 * dt;
            d.vy += (dx / dist) * speed * 0.65 * dt;
          }

          const dSpd = Math.hypot(d.vx, d.vy);
          if (dSpd > speed) {
            d.vx = (d.vx / dSpd) * speed;
            d.vy = (d.vy / dSpd) * speed;
          }
          d.x += d.vx * dt;
          d.y += d.vy * dt;

          // Body collision with player ship decreases health
          if (
            dist < shipRadius + d.coreRadius &&
            now - state.lastCollisionTime > 650
          ) {
            state.lastCollisionTime = now;
            applyDamageToPlayer(
              Math.max(4, Math.round((d.isBoss ? 14 : 7) * dmgMult)),
              now,
              state.camX,
              state.camY
            );
          }

          if (d.hullFlash > 0) d.hullFlash = Math.max(0, d.hullFlash - dt * 5);
          if (d.shieldFlash > 0) d.shieldFlash = Math.max(0, d.shieldFlash - dt * 5);

          d.fireCooldown -= dt;
          if (d.isBoss) {
            if (d.fireCooldown <= 0 && dist < 760) {
              d.fireCooldown = 1.3;
              const aim = Math.atan2(dx, -dy);
              const projSpd = 340;
              for (const offset of [-0.17, 0, 0.17]) {
                const a = aim + offset;
                state.projectiles.push({
                  x: d.x + Math.sin(a) * d.shieldRadius,
                  y: d.y - Math.cos(a) * d.shieldRadius,
                  vx: Math.sin(a) * projSpd,
                  vy: -Math.cos(a) * projSpd,
                  color: "#FB7185",
                  radius: 4,
                  life: 2.4,
                  dmg: Math.max(8, Math.round(9 * dmgMult)),
                  fromEnemy: true,
                });
              }
            }

            d.radialCooldown = (d.radialCooldown ?? 4.2) - dt;
            if (d.radialCooldown <= 0) {
              d.radialCooldown = 4.4;
              const count = 8;
              const baseRot = (now * 0.001) % (Math.PI * 2);
              for (let k = 0; k < count; k++) {
                const a = baseRot + (k * Math.PI * 2) / count;
                state.projectiles.push({
                  x: d.x + Math.sin(a) * d.shieldRadius,
                  y: d.y - Math.cos(a) * d.shieldRadius,
                  vx: Math.sin(a) * 265,
                  vy: -Math.cos(a) * 265,
                  color: "#FBBF24",
                  radius: 3.4,
                  life: 2.5,
                  dmg: Math.max(6, Math.round(7 * dmgMult)),
                  fromEnemy: true,
                });
              }
            }
          } else if (d.fireCooldown <= 0 && dist < 540) {
            d.fireCooldown =
              (d.tier === "heavy" ? 1.7 : d.tier === "medium" ? 2.1 : 2.5) /
              fireRateScale;
            const aim = Math.atan2(dx, -dy);
            const projSpd = (d.tier === "heavy" ? 310 : 270) * Math.min(1.35, 0.9 + diff * 0.04);
            const baseShotDmg = d.tier === "heavy" ? 11 : d.tier === "medium" ? 8 : 5;
            state.projectiles.push({
              x: d.x + Math.sin(aim) * d.shieldRadius,
              y: d.y - Math.cos(aim) * d.shieldRadius,
              vx: Math.sin(aim) * projSpd,
              vy: -Math.cos(aim) * projSpd,
              color: "#FBBF24",
              radius: d.tier === "heavy" ? 3.2 : 2.5,
              life: 2.0,
              dmg: Math.max(2, Math.round(baseShotDmg * dmgMult)),
              fromEnemy: true,
            });
          }
        }

        // Projectiles & Two-Layer Bubble Drone / Boss Damage
        for (let i = state.projectiles.length - 1; i >= 0; i--) {
          const pr = state.projectiles[i];
          pr.x += pr.vx * dt;
          pr.y += pr.vy * dt;
          pr.life -= dt;
          if (pr.life <= 0) {
            state.projectiles.splice(i, 1);
            continue;
          }

          if (!pr.fromEnemy) {
            let hitDrone = false;
            for (let j = state.drones.length - 1; j >= 0; j--) {
              const d = state.drones[j];
              const hitRadius = d.shield > 0 ? d.shieldRadius : d.coreRadius;
              if (Math.hypot(pr.x - d.x, pr.y - d.y) < hitRadius + pr.radius) {
                hitDrone = true;
                let dmgLeft = pr.dmg;

                if (d.shield > 0) {
                  const absorbed = Math.min(d.shield, dmgLeft);
                  d.shield -= absorbed;
                  dmgLeft -= absorbed;
                  d.shieldFlash = 1;
                  spawnBurst(pr.x, pr.y, "#A78BFA", 5);
                }

                if (dmgLeft > 0) {
                  d.hp = Math.max(0, d.hp - dmgLeft);
                  d.hullFlash = 1;
                  spawnBurst(pr.x, pr.y, "#FB7185", 5);
                }

                playHitSound();

                if (d.hp <= 0) {
                  const wasBoss = Boolean(d.isBoss);
                  spawnBurst(d.x, d.y, "#5EEAD4", wasBoss ? 42 : 14);
                  spawnBurst(d.x, d.y, "#FB7185", wasBoss ? 36 : 10);
                  state.drones.splice(j, 1);
                  state.kills += 1;
                  state.score += Math.round(d.maxHp * 2.5);

                  if (wasBoss) {
                    for (const rem of state.drones) {
                      spawnBurst(rem.x, rem.y, "#5EEAD4", 10);
                    }
                    state.drones = [];
                    onSectorClearedRef.current(sector.id);
                    setPhase("VICTORY");
                  }
                }
                break;
              }
            }
            if (hitDrone) {
              state.projectiles.splice(i, 1);
            }
          } else {
            if (Math.hypot(pr.x - state.camX, pr.y - state.camY) < shipRadius + pr.radius) {
              applyDamageToPlayer(pr.dmg, now, pr.x, pr.y);
              state.projectiles.splice(i, 1);
            }
          }
        }

        // Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const pt = state.particles[i];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.life -= dt;
          if (pt.life <= 0) {
            state.particles.splice(i, 1);
          }
        }
      }

      if (shipNodeRef.current) {
        shipNodeRef.current.style.transform = `translate(-50%, -50%) rotate(${state.angle}rad)`;
      }

      // Render Starfield
      ctx.fillStyle = "#060910";
      ctx.fillRect(0, 0, width, height);

      for (const s of stars) {
        const sx = (((s.x - state.camX * s.z) % width) + width) % width;
        const sy = (((s.y - state.camY * s.z) % height) + height) % height;
        ctx.fillStyle = `rgba(232, 237, 245, ${s.alpha})`;
        ctx.fillRect(sx, sy, s.size, s.size);
      }

      const cx = width / 2;
      const cy = height / 2;

      if (state.shield > 0 && phaseRef.current !== "GAME_OVER") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, shipRadius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Render Two-Layer Bubble Drones
      for (const d of state.drones) {
        const sx = cx + (d.x - state.camX);
        const sy = cy + (d.y - state.camY);

        if (sx < 16 || sx > width - 16 || sy < 16 || sy > height - 16) {
          const ang = Math.atan2(sy - cy, sx - cx);
          const edgeX = Math.max(24, Math.min(width - 24, cx + Math.cos(ang) * (width * 0.44)));
          const edgeY = Math.max(72, Math.min(height - 72, cy + Math.sin(ang) * (height * 0.42)));
          ctx.save();
          ctx.translate(edgeX, edgeY);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, -4);
          ctx.lineTo(-5, 4);
          ctx.closePath();
          ctx.fillStyle = sector.color;
          ctx.fill();
          ctx.restore();
          continue;
        }

        const shieldPct = Math.max(0, d.shield / d.maxShield);
        const hpPct = Math.max(0, d.hp / d.maxHp);

        ctx.save();
        if (d.shield > 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, d.shieldRadius, 0, Math.PI * 2);
          ctx.fillStyle =
            d.shieldFlash > 0
              ? "rgba(167, 139, 250, 0.36)"
              : `rgba(167, 139, 250, ${0.08 + shieldPct * 0.14})`;
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = `rgba(167, 139, 250, ${0.35 + shieldPct * 0.55})`;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(
            sx,
            sy,
            d.shieldRadius + 2.5,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * shieldPct
          );
          ctx.strokeStyle = "#A78BFA";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.setLineDash([3, 4]);
          ctx.arc(sx, sy, d.shieldRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(167, 139, 250, 0.22)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(sx, sy, d.coreRadius, 0, Math.PI * 2);
        const coreColor = d.isBoss
          ? "#FB7185"
          : d.tier === "heavy"
          ? "#FB7185"
          : d.tier === "medium"
          ? "#FBBF24"
          : "#5EEAD4";
        ctx.fillStyle =
          d.hullFlash > 0 ? "rgba(255, 255, 255, 0.78)" : "rgba(17, 24, 37, 0.92)";
        ctx.fill();
        ctx.lineWidth = d.isBoss ? 3 : 1.8;
        ctx.strokeStyle = coreColor;
        ctx.stroke();

        if (d.isBoss) {
          const rot = now * 0.0008;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(rot);
          ctx.strokeStyle = "rgba(251, 113, 133, 0.55)";
          ctx.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (d.coreRadius * 0.45), Math.sin(a) * (d.coreRadius * 0.45));
            ctx.lineTo(Math.cos(a) * d.coreRadius, Math.sin(a) * d.coreRadius);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, d.coreRadius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = coreColor;
        ctx.fill();
        ctx.restore();

        const barW = Math.max(36, d.shieldRadius * 2.1);
        const barX = sx - barW / 2;
        const topY = sy - d.shieldRadius - 17;

        ctx.fillStyle = "rgba(12, 17, 25, 0.9)";
        ctx.fillRect(barX, topY, barW, 4);
        ctx.fillStyle = "#A78BFA";
        ctx.fillRect(barX, topY, barW * shieldPct, 4);

        ctx.fillStyle = "rgba(12, 17, 25, 0.9)";
        ctx.fillRect(barX, topY + 5, barW, 4);
        ctx.fillStyle = "#FB7185";
        ctx.fillRect(barX, topY + 5, barW * hpPct, 4);
      }

      for (const pr of state.projectiles) {
        const sx = cx + (pr.x - state.camX);
        const sy = cy + (pr.y - state.camY);
        ctx.beginPath();
        ctx.arc(sx, sy, pr.radius, 0, Math.PI * 2);
        ctx.fillStyle = pr.color;
        ctx.fill();
      }

      for (const pt of state.particles) {
        const sx = cx + (pt.x - state.camX);
        const sy = cy + (pt.y - state.camY);
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      if (now - lastHudSync > 70) {
        lastHudSync = now;
        const bossEntity = state.drones.find((d) => d.isBoss);
        setHud({
          hull: Math.ceil(state.hull),
          maxHull: state.maxHull,
          shield: Math.ceil(state.shield),
          maxShield: stats.activeShield,
          speed: Math.round(Math.hypot(state.vx, state.vy) * 0.32),
          thrustActive: isThrusting,
          wave: state.wave,
          waveRemaining: state.drones.length + state.waveQueue,
          kills: state.kills,
          score: state.score,
          waveBanner: state.waveBannerTimer > 0 ? state.waveBannerText : "",
          bossHp: bossEntity ? Math.ceil(bossEntity.hp) : 0,
          bossMaxHp: bossEntity ? bossEntity.maxHp : isBossSector ? 3600 : 0,
          bossShield: bossEntity ? Math.ceil(bossEntity.shield) : 0,
          bossMaxShield: bossEntity ? bossEntity.maxShield : isBossSector ? 900 : 0,
          boostsLeft: state.boostsLeft,
          boostTimer: state.boostTimer,
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [
    ship.id,
    sector.id,
    sector.waves,
    sector.difficulty,
    sector.trait,
    sector.color,
    sector.name,
    isBossSector,
    runId,
    bounds,
    baseStats.hullHP,
    baseStats.shield,
    baseStats.boostCharges,
  ]);

  const shipWidthPx = bounds ? Math.max(72, Math.min(180, bounds.w * 11)) : 88;
  const shipHeightPx = bounds ? Math.max(72, Math.min(180, bounds.h * 11)) : 88;

  const healthPct = Math.round((hud.hull / Math.max(1, hud.maxHull)) * 100);
  const shieldPct =
    hud.maxShield > 0 ? Math.round((hud.shield / hud.maxShield) * 100) : 0;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#060910]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Brief Damage Vignette Flash */}
      {hitFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border-4 border-[#FB7185]/45 bg-[#FB7185]/10"
        />
      )}

      {/* Player Vessel */}
      {phase !== "GAME_OVER" && (
        <div
          ref={shipNodeRef}
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{
            width: `${shipWidthPx}px`,
            height: `${shipHeightPx}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <ShipPreview
            cells={cellMap}
            offlineKeys={effectiveOfflineKeys}
            thrustPower={hud.thrustActive ? 1 : 0}
            boostActive={hud.boostTimer > 0}
          />
        </div>
      )}

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-4 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Star Map</span>
          </button>

          <div className="h-4 w-px bg-[#1B2433]" aria-hidden="true" />

          <div>
            <div className="font-display text-sm font-semibold text-[#E8EDF5]">
              {sector.name}
            </div>
            <div className="font-mono text-[11px] text-[#8895A7] tabular-nums">
              {ship.name} · Difficulty {sector.difficulty}/10 · {sector.traitLabel}
            </div>
          </div>

          <div className="h-4 w-px bg-[#1B2433]" aria-hidden="true" />

          <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
            <span className="font-semibold text-[#5EEAD4]">
              {isBossSector ? "BOSS FIGHT" : `Wave ${hud.wave}/${totalWaves}`}
            </span>
            <span className="text-[#A78BFA]">
              {isBossSector ? `Hostiles ${hud.waveRemaining}` : `Remaining ${hud.waveRemaining}`}
            </span>
            <span className="text-[#E8EDF5]">Score {hud.score}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() =>
              setPhase((p) => (p === "PLAYING" ? "PAUSED" : p === "PAUSED" ? "PLAYING" : p))
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#1B2433] bg-[#0C1119]/90 px-3 text-xs font-medium text-[#E8EDF5] backdrop-blur-md transition-colors hover:border-[#2E3D55]"
          >
            {phase === "PAUSED" ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current text-[#5EEAD4]" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            )}
          </button>

          {!baseStats.hasCockpit && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FB7185]/45 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FB7185] backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No cockpit — ship power and all systems are offline</span>
            </div>
          )}

          {baseStats.hasCockpit && !baseStats.hasThrusters && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FB7185]/45 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FB7185] backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No thrusters fitted — vessel cannot move</span>
            </div>
          )}

          {baseStats.isPowerOverloaded && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FBBF24]/50 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FBBF24] backdrop-blur-md">
              <Zap className="h-4 w-4 shrink-0" />
              <span className="font-mono tabular-nums">
                Power deficit · {offlineKeys.size}{" "}
                {offlineKeys.size === 1 ? "module" : "modules"} offline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Boss Health & Shield Bar */}
      {isBossSector && hud.bossMaxHp > 0 && phase === "PLAYING" && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-10 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-[#FB7185]/45 bg-[#0C1119]/92 px-4 py-2.5 backdrop-blur-md sm:w-[420px]">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="flex items-center gap-1.5 font-semibold text-[#FB7185]">
              <Skull className="h-3.5 w-3.5" />
              <span>{sector.name} · Diff 15/10</span>
            </span>
            <span className="text-[#E8EDF5]">
              {hud.bossHp} / {hud.bossMaxHp} HP
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
            <div
              className="h-full bg-[#FB7185] transition-all duration-150"
              style={{
                width: `${Math.round((hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100)}%`,
              }}
            />
          </div>
          {hud.bossMaxShield > 0 && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
              <div
                className="h-full bg-[#A78BFA] transition-all duration-150"
                style={{
                  width: `${Math.round(
                    (hud.bossShield / Math.max(1, hud.bossMaxShield)) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Wave Announcement */}
      {hud.waveBanner && phase === "PLAYING" && !isBossSector && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-lg border border-[#1B2433] bg-[#0C1119]/90 px-4 py-2 font-display text-base font-semibold text-[#E8EDF5] backdrop-blur-md">
          {hud.waveBanner}
        </div>
      )}

      {/* Bottom HUD: Health Bar & Controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto w-80 space-y-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/92 p-4 font-mono backdrop-blur-md">
          {/* Player Health Bar */}
          <div>
            <div className="flex justify-between text-xs tabular-nums">
              <span className="font-semibold text-[#E8EDF5]">Health</span>
              <span className="font-semibold text-[#FB7185]">
                {hud.hull} / {hud.maxHull}
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-[#151D2B]">
              <div
                className="h-full rounded-full bg-[#FB7185] transition-all duration-150"
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          {baseStats.shield > 0 && (
            <div>
              <div className="flex justify-between text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-[#A78BFA]">
                  <Shield className="h-3 w-3" />
                  <span>Shield</span>
                </span>
                <span className="font-semibold text-[#E8EDF5]">
                  {hud.shield} / {hud.maxShield}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#151D2B]">
                <div
                  className="h-full rounded-full bg-[#A78BFA] transition-all duration-150"
                  style={{ width: `${shieldPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-0.5 text-xs text-[#8895A7] tabular-nums">
            <span>Speed {hud.speed} m/s</span>
            {baseStats.boostCharges > 0 && (
              <span className="font-semibold text-[#FBBF24]">
                {hud.boostTimer > 0
                  ? `2× ${hud.boostTimer.toFixed(1)}s`
                  : `Boosts ${hud.boostsLeft}/${baseStats.boostCharges}`}
              </span>
            )}
            <span>Firepower {liveStats.activeDmg}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => (touchRef.current.left = true)}
              onPointerUp={() => (touchRef.current.left = false)}
              onPointerLeave={() => (touchRef.current.left = false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5] active:bg-[#1B2433]"
            >
              A
            </button>
            {baseStats.hasThrusters && (
              <button
                type="button"
                onPointerDown={() => (touchRef.current.thrust = true)}
                onPointerUp={() => (touchRef.current.thrust = false)}
                onPointerLeave={() => (touchRef.current.thrust = false)}
                className="flex h-11 items-center justify-center rounded-lg border border-[#5EEAD4]/50 bg-[#0C1119]/90 px-3.5 font-mono text-xs font-semibold text-[#5EEAD4] active:bg-[#5EEAD4]/20"
              >
                W Thrust
              </button>
            )}
            <button
              type="button"
              onPointerDown={() => (touchRef.current.right = true)}
              onPointerUp={() => (touchRef.current.right = false)}
              onPointerLeave={() => (touchRef.current.right = false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5] active:bg-[#1B2433]"
            >
              D
            </button>
            {baseStats.boostCharges > 0 && (
              <button
                type="button"
                onClick={() => {
                  boostTriggerRef.current = true;
                }}
                disabled={hud.boostsLeft <= 0 || hud.boostTimer > 0}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#FBBF24]/55 bg-[#0C1119]/90 px-3.5 font-mono text-xs font-semibold text-[#FBBF24] active:bg-[#FBBF24]/20 disabled:opacity-40"
              >
                <span>
                  {hud.boostTimer > 0
                    ? `2× ${hud.boostTimer.toFixed(1)}s`
                    : `Tab Boost (${hud.boostsLeft})`}
                </span>
              </button>
            )}
            <button
              type="button"
              onPointerDown={() => (touchRef.current.fire = true)}
              onPointerUp={() => (touchRef.current.fire = false)}
              onPointerLeave={() => (touchRef.current.fire = false)}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#FB7185]/50 bg-[#0C1119]/90 px-3.5 font-mono text-xs font-semibold text-[#FB7185] active:bg-[#FB7185]/20"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>Fire</span>
            </button>
          </div>

          <p className="font-mono text-[11px] text-[#8895A7]">
            {baseStats.hasThrusters
              ? baseStats.boostCharges > 0
                ? "A / D Turn · W Thrust · S Brake · Tab Boost · Space Fire · P Pause"
                : "A / D Turn · W Thrust · S Brake · Space Fire · P Pause"
              : "A / D Turn · Space Fire · Add thrusters in Shipyard to fly"}
          </p>
        </div>
      </div>

      {/* Pause Overlay */}
      {phase === "PAUSED" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#E8EDF5]">
              Flight Paused
            </h2>
            <p className="mt-1.5 text-sm text-[#8895A7]">
              {sector.name} · Wave {hud.wave}/{totalWaves} · {hud.score} pts
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase("PLAYING")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Resume Flight</span>
              </button>
              <button
                type="button"
                onClick={onBackToMap}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] hover:border-[#2E3D55]"
              >
                <span>Return to Star Map</span>
              </button>
              <button
                type="button"
                onClick={onChangeShip}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#8895A7] hover:text-[#E8EDF5]"
              >
                <span>Choose Another Ship</span>
              </button>
              <button
                type="button"
                onClick={() => onEditShip(ship.id)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#8895A7] hover:text-[#E8EDF5]"
              >
                <span>Edit in Shipyard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Overlay */}
      {phase === "VICTORY" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#5EEAD4]/50 bg-[#0C1119] p-6 text-center">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                isBossSector
                  ? "bg-[#FB7185]/15 text-[#FB7185]"
                  : "bg-[#5EEAD4]/15 text-[#5EEAD4]"
              }`}
            >
              {isBossSector ? (
                <Skull className="h-6 w-6" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-[#E8EDF5]">
              {isBossSector
                ? `${sector.name} Defeated`
                : `${sector.name} Cleared`}
            </h2>
            <p className="mt-1.5 text-sm text-[#8895A7]">
              {isBossSector
                ? "Sector Boss eliminated! Fleet Equipment rewards unlocked and Commander Level increased."
                : willUnlockBossOnClear
                ? "All 25 stars in this sector map are cleared! The Sector Boss (Difficulty 15/10) is ready."
                : `All ${totalWaves} ${totalWaves === 1 ? "wave" : "waves"} defeated. Returning to home hangar...`}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#1B2433] py-4 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-[#8895A7]">Drones Popped</div>
                <div className="mt-0.5 text-base font-semibold text-[#5EEAD4]">
                  {hud.kills}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8895A7]">Score</div>
                <div className="mt-0.5 text-base font-semibold text-[#E8EDF5]">
                  {hud.score}
                </div>
              </div>
            </div>

            {willUnlockBossOnClear && onChallengeBoss ? (
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onChallengeBoss}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FB7185] px-4 text-sm font-semibold text-[#060910] hover:bg-[#FDA4AF]"
                >
                  <Skull className="h-4 w-4" />
                  <span>Challenge Boss (Diff 15/10)</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToMap}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] hover:border-[#2E3D55]"
                >
                  <span>Return to Star Map</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onReturnHome}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
              >
                <span>Return Home Now</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {phase === "GAME_OVER" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#FB7185]">
              Vessel Destroyed
            </h2>
            <p className="mt-1.5 text-sm text-[#8895A7]">
              {ship.name} was lost on Wave {hud.wave} in {sector.name}.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#1B2433] py-4 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-[#8895A7]">Drones Popped</div>
                <div className="mt-0.5 text-base font-semibold text-[#FB7185]">
                  {hud.kills}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8895A7]">Score</div>
                <div className="mt-0.5 text-base font-semibold text-[#5EEAD4]">
                  {hud.score}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRunId((r) => r + 1);
                  setPhase("PLAYING");
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={onBackToMap}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] hover:border-[#2E3D55]"
              >
                <span>Return to Star Map</span>
              </button>
              <button
                type="button"
                onClick={onChangeShip}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#8895A7] hover:text-[#E8EDF5]"
              >
                <span>Choose Another Ship</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
