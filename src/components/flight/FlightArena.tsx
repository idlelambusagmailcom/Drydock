import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Crosshair,
  RotateCcw,
  Shield,
  Target,
  Wrench,
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
import { ShipRecord } from "@/lib/ships";
import {
  playBoostSound,
  playBrownoutSound,
  playHitSound,
  playLaserSound,
} from "@/lib/audio";
import ShipPreview from "@/components/ship/ShipPreview";

interface FlightArenaProps {
  ship: ShipRecord;
  fleet: ShipRecord[];
  onSelectShip: (id: string) => void;
  onEditShip: (id: string) => void;
  onBackToHangar: () => void;
}

interface Star {
  x: number;
  y: number;
  z: number; // parallax factor 0.2..1.0
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

interface TargetDrone {
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

export default function FlightArena({
  ship,
  fleet,
  onSelectShip,
  onEditShip,
  onBackToHangar,
}: FlightArenaProps) {
  const cellMap = useMemo(() => cellsFromArray(ship.cells), [ship.cells]);
  const baseStats = useMemo(
    () => computeStats(cellMap, undefined, ship.equipment),
    [cellMap, ship.equipment]
  );
  const bounds = useMemo(() => shipBounds(cellMap), [cellMap]);

  const [difficulty, setDifficulty] = useState<number>(1);
  const [runId, setRunId] = useState<number>(0);
  const [destroyed, setDestroyed] = useState<boolean>(false);
  const [hitFlash, setHitFlash] = useState<boolean>(false);
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

  const [dronesEnabled, setDronesEnabled] = useState(true);
  const [hud, setHud] = useState({
    hull: Math.max(1, baseStats.hullHP),
    maxHull: Math.max(1, baseStats.hullHP),
    shield: baseStats.shield,
    maxShield: baseStats.shield,
    speed: 0,
    thrustActive: false,
    score: 0,
    kills: 0,
    dronesLeft: 0,
    boostsLeft: baseStats.boostCharges,
    boostTimer: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shipNodeRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const boostTriggerRef = useRef<boolean>(false);
  const touchControlsRef = useRef({
    left: false,
    right: false,
    thrust: false,
    brake: false,
    fire: false,
  });

  const liveStatsRef = useRef(liveStats);
  liveStatsRef.current = liveStats;
  const offlineKeysRef = useRef(offlineKeys);
  offlineKeysRef.current = offlineKeys;
  const cellMapRef = useRef<ShipCellMap>(cellMap);
  cellMapRef.current = cellMap;
  const dronesEnabledRef = useRef(dronesEnabled);
  dronesEnabledRef.current = dronesEnabled;
  const destroyedRef = useRef(destroyed);
  destroyedRef.current = destroyed;

  // Power Overload Brownout Simulation:
  // When draw exceeds generation, power switches between modules with each turned-off module staying off 3-5 seconds
  useEffect(() => {
    if (
      destroyed ||
      !baseStats.isPowerOverloaded ||
      baseStats.poweredCellKeys.length === 0
    ) {
      setOfflineKeys(new Set());
      return;
    }

    let cancelled = false;
    let timerId: number | null = null;
    let prevOffline = new Set<string>();

    const cycleBrownout = () => {
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
      timerId = window.setTimeout(cycleBrownout, delayMs);
    };

    cycleBrownout();
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [
    destroyed,
    baseStats.isPowerOverloaded,
    baseStats.draw,
    baseStats.gen,
    baseStats.poweredCellKeys,
  ]);

  // Keyboard Listeners
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

  // Main Flight, Starfield, Weapons & Armed Drone Loop
  useEffect(() => {
    setDestroyed(false);
    setHitFlash(false);

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

    const stars: Star[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * 2400,
      y: Math.random() * 1600,
      z: 0.18 + Math.random() * 0.82,
      size: 0.8 + Math.random() * 1.6,
      alpha: 0.25 + Math.random() * 0.7,
    }));

    const diff = difficulty; // 1..10
    const diffScale = 0.7 + diff * 0.1; // 0.8x at Lv1 .. 1.7x at Lv10
    const dmgMult = 0.75 + diff * 0.08;
    const regenMult = 0.8 + diff * 0.08;
    const fireRateScale = 1 + diff * 0.04;
    const speedScale = 0.85 + diff * 0.04;
    const squadSize = 5 + Math.floor(diff * 0.5);

    let nextDroneId = 1;
    const createDrone = (camX: number, camY: number, minDist = 280): TargetDrone => {
      const ang = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * 210;
      const roll = Math.random();
      const heavyChance = Math.min(0.55, 0.08 + diff * 0.04);
      const mediumChance = Math.min(0.85, heavyChance + 0.34);
      const tier: TargetDrone["tier"] =
        roll < heavyChance ? "heavy" : roll < mediumChance ? "medium" : "light";

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

      return {
        id: nextDroneId++,
        x: camX + Math.cos(ang) * dist,
        y: camY + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 42,
        vy: (Math.random() - 0.5) * 42,
        coreRadius,
        shieldRadius: coreRadius + 9,
        hp: maxHp,
        maxHp,
        shield: maxShield,
        maxShield,
        shieldRegen:
          (tier === "heavy" ? 3.2 : tier === "medium" ? 2.3 : 1.6) * regenMult,
        fireCooldown: (0.9 + Math.random() * 1.4) / fireRateScale,
        hullFlash: 0,
        shieldFlash: 0,
        tier,
      };
    };

    const spawnDrones = (camX: number, camY: number): TargetDrone[] =>
      Array.from({ length: squadSize }, () => createDrone(camX, camY));

    const shipRadius = bounds
      ? Math.max(18, Math.min(48, Math.max(bounds.w, bounds.h) * 4.5))
      : 24;

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
      score: 0,
      kills: 0,
      boostsLeft: baseStats.boostCharges,
      boostTimer: 0,
      projectiles: [] as Projectile[],
      drones: spawnDrones(0, 0),
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

    const applyDamageToPlayer = (
      rawDmg: number,
      now: number,
      hitX: number,
      hitY: number
    ) => {
      if (destroyedRef.current || !dronesEnabledRef.current) return;
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
        setDestroyed(true);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const stats = liveStatsRef.current;
      const isActive = !destroyedRef.current;
      let isThrusting = false;

      if (isActive) {
        const keys = keysRef.current;
        const touch = touchControlsRef.current;

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
          ? 1.8 + Math.min(3.2, stats.handling * 0.06)
          : 0;
        if (stats.hasCockpit) {
          if (turnLeft) state.angle -= turnSpeed * dt;
          if (turnRight) state.angle += turnSpeed * dt;
        }

        const canAccelerate =
          stats.hasCockpit && stats.hasThrusters && stats.activeThrust > 0;
        isThrusting = wantThrust && canAccelerate;
        const boostMult = state.boostTimer > 0 && stats.hasCockpit ? 2 : 1;

        if (!stats.hasCockpit || !stats.hasThrusters) {
          state.vx = 0;
          state.vy = 0;
        } else {
          const speedMult =
            stats.topSpeed > 0 && stats.activeThrust > 0 && stats.mass > 0
              ? stats.topSpeed / ((stats.activeThrust / stats.mass) * 90)
              : 1;
          const accel = canAccelerate
            ? (120 + (stats.activeThrust / Math.max(1, stats.mass)) * 220) *
              speedMult *
              boostMult
            : 0;
          const maxSpeed =
            (90 + (stats.activeThrust / Math.max(1, stats.mass)) * 260) *
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

        // Player shield cap & recharge
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

        // Fire active (non-browned-out) player weapons
        const fireCooldownMs = 220 / Math.max(0.5, stats.fireRateMult);
        if (stats.hasCockpit && wantFire && now - state.lastFire > fireCooldownMs) {
          const offline = offlineKeysRef.current;
          const cells = Object.values(cellMapRef.current);
          const cx = bounds ? bounds.minX + bounds.w / 2 : 8.5;
          const cy = bounds ? bounds.minY + bounds.h / 2 : 6.5;
          const cellPx = 11;
          let firedAny = false;

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

            firedAny = true;
            const lx = (c.x + 0.5 - cx) * cellPx;
            const ly = (c.y + 0.5 - cy) * cellPx;
            const cos = Math.cos(state.angle);
            const sin = Math.sin(state.angle);
            const wx = lx * cos - ly * sin;
            const wy = lx * sin + ly * cos;

            const shotAngle = state.angle + c.mod.d * (Math.PI / 2);
            const shotSpeed =
              p.id === "railgun" ? 820 : p.id === "missile" ? 440 : 620;
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
              radius: p.id === "railgun" ? 3.5 : p.id === "missile" ? 3 : 2.3,
              life: 1.5,
              dmg: Math.max(1, Math.round((p.dmg + perWeaponFlat) * stats.dmgMult)),
              fromEnemy: false,
            });
          }

          if (firedAny) {
            state.lastFire = now;
            playLaserSound();
          }
        }

        // Update armed drones if enabled
        if (dronesEnabledRef.current) {
          if (state.drones.length === 0) {
            state.drones = spawnDrones(state.camX, state.camY);
          }

          for (const d of state.drones) {
            if (d.shield < d.maxShield) {
              d.shield = Math.min(d.maxShield, d.shield + d.shieldRegen * dt);
            }

            const dx = state.camX - d.x;
            const dy = state.camY - d.y;
            const dist = Math.hypot(dx, dy) || 1;
            const desiredDist = d.tier === "heavy" ? 235 : 185;
            const speed =
              (d.tier === "light" ? 115 : d.tier === "medium" ? 95 : 70) *
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

            // Body collision damage
            if (
              dist < shipRadius + d.coreRadius &&
              now - state.lastCollisionTime > 650
            ) {
              state.lastCollisionTime = now;
              applyDamageToPlayer(
                Math.max(4, Math.round(7 * dmgMult)),
                now,
                state.camX,
                state.camY
              );
            }

            if (d.hullFlash > 0) d.hullFlash = Math.max(0, d.hullFlash - dt * 5);
            if (d.shieldFlash > 0) d.shieldFlash = Math.max(0, d.shieldFlash - dt * 5);

            // All enemy drones fire projectiles at the player
            d.fireCooldown -= dt;
            if (d.fireCooldown <= 0 && dist < 560) {
              d.fireCooldown =
                (d.tier === "heavy" ? 1.7 : d.tier === "medium" ? 2.1 : 2.5) /
                fireRateScale;
              const aim = Math.atan2(dx, -dy);
              const projSpd =
                (d.tier === "heavy" ? 310 : 270) *
                Math.min(1.35, 0.9 + diff * 0.04);
              const baseShotDmg =
                d.tier === "heavy" ? 11 : d.tier === "medium" ? 8 : 5;
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
        } else {
          // Clear active enemy bolts when target drones are turned off
          state.projectiles = state.projectiles.filter((pr) => !pr.fromEnemy);
        }

        // Update projectiles & collisions
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
            if (!dronesEnabledRef.current) continue;
            let hit = false;
            for (let j = state.drones.length - 1; j >= 0; j--) {
              const d = state.drones[j];
              const hitRadius = d.shield > 0 ? d.shieldRadius : d.coreRadius;
              if (Math.hypot(pr.x - d.x, pr.y - d.y) < hitRadius + pr.radius) {
                hit = true;
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
                  spawnBurst(d.x, d.y, "#5EEAD4", 14);
                  spawnBurst(d.x, d.y, "#FB7185", 10);
                  state.drones.splice(j, 1);
                  state.kills += 1;
                  state.score += Math.round(d.maxHp * 2.5);
                }
                break;
              }
            }
            if (hit) {
              state.projectiles.splice(i, 1);
            }
          } else if (dronesEnabledRef.current) {
            if (
              Math.hypot(pr.x - state.camX, pr.y - state.camY) <
              shipRadius + pr.radius
            ) {
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

      // Apply ship DOM rotation
      if (shipNodeRef.current) {
        shipNodeRef.current.style.transform = `translate(-50%, -50%) rotate(${state.angle}rad)`;
      }

      // Render Starfield + World Objects
      ctx.fillStyle = "#060910";
      ctx.fillRect(0, 0, width, height);

      for (const s of stars) {
        const sx = (((s.x - state.camX * s.z) % width) + width) % width;
        const sy = (((s.y - state.camY * s.z) % height) + height) % height;
        ctx.fillStyle = `rgba(232, 237, 245, ${s.alpha})`;
        ctx.fillRect(sx, sy, s.size, s.size);
      }

      const centerX = width / 2;
      const centerY = height / 2;

      // Render player shield ring if fitted
      if (state.shield > 0 && isActive) {
        const sPct = state.shield / Math.max(1, stats.activeShield);
        ctx.beginPath();
        ctx.arc(centerX, centerY, shipRadius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167, 139, 250, ${0.15 + sPct * 0.25})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Render Armed Bubble Drones
      if (dronesEnabledRef.current) {
        for (const d of state.drones) {
          const sx = centerX + (d.x - state.camX);
          const sy = centerY + (d.y - state.camY);
          if (sx < -80 || sx > width + 80 || sy < -80 || sy > height + 80) continue;

          const shieldPct = Math.max(0, d.shield / d.maxShield);
          const hpPct = Math.max(0, d.hp / d.maxHp);

          // Outer Shield Bubble
          if (d.shield > 0) {
            ctx.beginPath();
            ctx.arc(sx, sy, d.shieldRadius, 0, Math.PI * 2);
            ctx.fillStyle =
              d.shieldFlash > 0
                ? "rgba(167, 139, 250, 0.32)"
                : `rgba(167, 139, 250, ${0.08 + shieldPct * 0.14})`;
            ctx.fill();
            ctx.lineWidth = 1.5;
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
            ctx.arc(sx, sy, d.shieldRadius, 0, Math.PI * 2);
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = "rgba(167, 139, 250, 0.25)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Drone Inner Core
          ctx.beginPath();
          ctx.arc(sx, sy, d.coreRadius, 0, Math.PI * 2);
          ctx.fillStyle =
            d.hullFlash > 0 ? "rgba(251, 113, 133, 0.72)" : "#131C2B";
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle =
            d.hullFlash > 0
              ? "#FB7185"
              : d.tier === "heavy"
              ? "#FBBF24"
              : d.tier === "medium"
              ? "#60A5FA"
              : "#5EEAD4";
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(sx, sy, d.coreRadius * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = d.tier === "heavy" ? "#FBBF24" : "#FB7185";
          ctx.fill();

          // Overhead Shield + HP bars
          const barW = Math.max(36, d.shieldRadius * 2.1);
          const barX = sx - barW / 2;
          const topY = sy - d.shieldRadius - 17;

          ctx.fillStyle = "rgba(6, 9, 16, 0.85)";
          ctx.fillRect(barX, topY, barW, 4);
          ctx.fillStyle = "#A78BFA";
          ctx.fillRect(barX, topY, barW * shieldPct, 4);

          ctx.fillStyle = "rgba(6, 9, 16, 0.85)";
          ctx.fillRect(barX, topY + 5, barW, 4);
          ctx.fillStyle = "#FB7185";
          ctx.fillRect(barX, topY + 5, barW * hpPct, 4);
        }
      }

      // Render Projectiles
      for (const pr of state.projectiles) {
        const sx = centerX + (pr.x - state.camX);
        const sy = centerY + (pr.y - state.camY);
        ctx.beginPath();
        ctx.arc(sx, sy, pr.radius, 0, Math.PI * 2);
        ctx.fillStyle = pr.color;
        ctx.fill();
      }

      // Render Particles
      for (const pt of state.particles) {
        const sx = centerX + (pt.x - state.camX);
        const sy = centerY + (pt.y - state.camY);
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // Sync HUD at ~12Hz
      if (now - lastHudSync > 85) {
        lastHudSync = now;
        const speedVal = Math.round(Math.hypot(state.vx, state.vy) * 0.32);
        setHud({
          hull: Math.ceil(state.hull),
          maxHull: state.maxHull,
          shield: Math.ceil(state.shield),
          maxShield: stats.activeShield,
          speed: speedVal,
          thrustActive: isThrusting,
          score: state.score,
          kills: state.kills,
          dronesLeft: state.drones.length,
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
    bounds,
    baseStats.hullHP,
    baseStats.shield,
    baseStats.boostCharges,
    difficulty,
    runId,
  ]);

  const shipWidthPx = bounds ? Math.max(72, Math.min(200, bounds.w * 12)) : 96;
  const shipHeightPx = bounds ? Math.max(72, Math.min(200, bounds.h * 12)) : 96;
  const healthPct = Math.round((hud.hull / Math.max(1, hud.maxHull)) * 100);
  const shieldPct =
    hud.maxShield > 0 ? Math.round((hud.shield / hud.maxShield) * 100) : 0;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#060910]">
      {/* Starfield & Combat Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Brief Damage Vignette Flash */}
      {hitFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border-4 border-[#FB7185]/45 bg-[#FB7185]/10"
        />
      )}

      {/* Player Vessel Centered SVG */}
      {!destroyed && (
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

      {/* Top HUD Overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-3.5 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={onBackToHangar}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Hangar</span>
          </button>

          <div className="h-4 w-px bg-[#1B2433]" aria-hidden="true" />

          <select
            value={ship.id}
            onChange={(e) => onSelectShip(e.target.value)}
            aria-label="Select vessel for test flight"
            className="h-8 rounded-md border border-[#1B2433] bg-[#060910] px-2.5 font-display text-sm font-semibold text-[#E8EDF5] focus:border-[#5EEAD4] focus:outline-none"
          >
            {fleet.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <span className="font-mono text-xs text-[#8895A7]">
            {baseStats.shipClass}
          </span>

          <button
            type="button"
            onClick={() => onEditShip(ship.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55]"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Difficulty 1-10 Selector (Top Bar) */}
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-3 py-2 backdrop-blur-md"
          role="group"
          aria-label="Test Flight Difficulty"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#8895A7]">
            Difficulty
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => {
              const selected = difficulty === lvl;
              const activeClass =
                lvl >= 8
                  ? "border-[#FB7185] bg-[#FB7185] text-[#060910]"
                  : lvl >= 5
                  ? "border-[#FBBF24] bg-[#FBBF24] text-[#060910]"
                  : "border-[#5EEAD4] bg-[#5EEAD4] text-[#060910]";
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  aria-pressed={selected}
                  className={`h-7 w-7 rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                    selected
                      ? activeClass
                      : "border-[#1B2433] bg-[#060910] text-[#8895A7] hover:border-[#2E3D55] hover:text-[#E8EDF5]"
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drone Toggle & Critical Flight Warning Banners */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setDronesEnabled((v) => !v)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium backdrop-blur-md transition-colors ${
              dronesEnabled
                ? "border-[#5EEAD4]/50 bg-[#0C1119]/90 text-[#5EEAD4]"
                : "border-[#1B2433] bg-[#0C1119]/90 text-[#8895A7] hover:text-[#E8EDF5]"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>{dronesEnabled ? "Armed Drones On" : "Armed Drones Off"}</span>
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
              <span>No thrusters fitted — ship cannot fly</span>
            </div>
          )}

          {baseStats.isPowerOverloaded && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FBBF24]/50 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FBBF24] backdrop-blur-md">
              <Zap className="h-4 w-4 shrink-0" />
              <span className="font-mono tabular-nums">
                Power deficit ({Math.abs(baseStats.powerNet)} short) · {offlineKeys.size}{" "}
                {offlineKeys.size === 1 ? "module" : "modules"} offline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD: Live Telemetry + Controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-4 p-4 sm:p-6">
        {/* Hull, Shield & Telemetry Readout */}
        <div className="pointer-events-auto w-88 max-w-full space-y-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 p-4 font-mono backdrop-blur-md">
          <div>
            <div className="flex justify-between text-xs tabular-nums">
              <span className="font-semibold text-[#E8EDF5]">Health</span>
              <span className="font-semibold text-[#FB7185]">
                {hud.hull} / {hud.maxHull}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
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

          <div className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-[#1B2433] pt-2.5">
            <div>
              <div className="text-[11px] text-[#8895A7]">Velocity</div>
              <div className="text-xs font-semibold text-[#5EEAD4] tabular-nums">
                {hud.speed} m/s
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8895A7]">Firepower</div>
              <div className="text-xs font-semibold text-[#FB7185] tabular-nums">
                {liveStats.activeDmg}
                {liveStats.activeDmg < baseStats.dmg ? `/${baseStats.dmg}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8895A7]">Power</div>
              <div
                className={`text-xs font-semibold tabular-nums ${
                  baseStats.isPowerOverloaded ? "text-[#FBBF24]" : "text-[#E8EDF5]"
                }`}
              >
                {baseStats.gen}/{baseStats.draw}
              </div>
            </div>
            {baseStats.boostCharges > 0 && (
              <div>
                <div className="text-[11px] text-[#8895A7]">Boosters</div>
                <div className="text-xs font-semibold text-[#FBBF24] tabular-nums">
                  {hud.boostTimer > 0
                    ? `2× ${hud.boostTimer.toFixed(1)}s`
                    : `${hud.boostsLeft}/${baseStats.boostCharges}`}
                </div>
              </div>
            )}
            {dronesEnabled && (
              <>
                <div>
                  <div className="text-[11px] text-[#8895A7]">Difficulty</div>
                  <div className="text-xs font-semibold text-[#FBBF24] tabular-nums">
                    {difficulty}/10
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8895A7]">Targets</div>
                  <div className="text-xs font-semibold text-[#60A5FA] tabular-nums">
                    {hud.score} pts
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Keyboard Hints & Touch Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => (touchControlsRef.current.left = true)}
              onPointerUp={() => (touchControlsRef.current.left = false)}
              onPointerLeave={() => (touchControlsRef.current.left = false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5] active:bg-[#1B2433]"
              aria-label="Turn left"
            >
              A
            </button>

            {baseStats.hasThrusters && (
              <button
                type="button"
                onPointerDown={() => (touchControlsRef.current.thrust = true)}
                onPointerUp={() => (touchControlsRef.current.thrust = false)}
                onPointerLeave={() => (touchControlsRef.current.thrust = false)}
                className="flex h-11 items-center justify-center rounded-lg border border-[#5EEAD4]/50 bg-[#0C1119]/90 px-3.5 font-mono text-xs font-semibold text-[#5EEAD4] active:bg-[#5EEAD4]/20"
              >
                W Thrust
              </button>
            )}

            <button
              type="button"
              onPointerDown={() => (touchControlsRef.current.right = true)}
              onPointerUp={() => (touchControlsRef.current.right = false)}
              onPointerLeave={() => (touchControlsRef.current.right = false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5] active:bg-[#1B2433]"
              aria-label="Turn right"
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

            {baseStats.hasWeapons && (
              <button
                type="button"
                onPointerDown={() => (touchControlsRef.current.fire = true)}
                onPointerUp={() => (touchControlsRef.current.fire = false)}
                onPointerLeave={() => (touchControlsRef.current.fire = false)}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#FB7185]/50 bg-[#0C1119]/90 px-3.5 font-mono text-xs font-semibold text-[#FB7185] active:bg-[#FB7185]/20"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>Fire</span>
              </button>
            )}
          </div>

          <p className="font-mono text-[11px] text-[#8895A7]">
            {baseStats.hasThrusters
              ? baseStats.boostCharges > 0
                ? "A / D Turn · W Thrust · S Brake · Tab Boost · Space Fire"
                : "A / D Turn · W Thrust · S Brake · Space Fire"
              : "A / D Turn · Space Fire (Add thrusters in Shipyard to fly)"}
          </p>
        </div>
      </div>

      {/* Test Vessel Destroyed Overlay */}
      {destroyed && baseStats.cellsCount > 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#FB7185]">
              Test Vessel Destroyed
            </h2>
            <p className="mt-1.5 text-sm text-[#8895A7]">
              {ship.name} was defeated at Test Difficulty {difficulty}/10.
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
                  setDestroyed(false);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Respawn Vessel</span>
              </button>
              <button
                type="button"
                onClick={() => onEditShip(ship.id)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#E8EDF5] hover:border-[#2E3D55]"
              >
                <Wrench className="h-4 w-4" />
                <span>Edit in Shipyard</span>
              </button>
              <button
                type="button"
                onClick={onBackToHangar}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1B2433] bg-[#111825] px-4 text-sm font-medium text-[#8895A7] hover:text-[#E8EDF5]"
              >
                <span>Return to Hangar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty ship guard */}
      {baseStats.cellsCount === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/85 p-6">
          <div className="max-w-sm rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 text-center">
            <h2 className="font-display text-lg font-semibold text-[#E8EDF5]">
              Hull has no structure
            </h2>
            <p className="mt-2 text-sm text-[#8895A7]">
              Paint hull cells and mount thrusters in the shipyard before launching.
            </p>
            <button
              type="button"
              onClick={() => onEditShip(ship.id)}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Return to Shipyard</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
