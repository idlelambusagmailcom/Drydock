import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Crosshair,
  Shield,
  Users,
} from "lucide-react";
import {
  OnlinePlayerSnapshot,
  OnlineRoomSnapshot,
} from "@/lib/online";
import { cellsFromArray, computeStats, shipBounds } from "@/lib/parts";
import { ShipRecord } from "@/lib/ships";
import { playBoostSound, playHitSound, playLaserSound } from "@/lib/audio";
import ShipPreview from "@/components/ship/ShipPreview";

interface OnlineArenaProps {
  token: string;
  userId: string;
  roomCode: string;
  ship: ShipRecord;
  onLeaveRoom: () => void;
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
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

interface RenderPilot {
  userId: string;
  username: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  thrusting: boolean;
  boosting: boolean;
  cells: OnlinePlayerSnapshot["cells"];
}

export default function OnlineArena({
  token,
  userId,
  roomCode,
  ship,
  onLeaveRoom,
}: OnlineArenaProps) {
  const localCellMap = useMemo(() => cellsFromArray(ship.cells), [ship.cells]);
  const localStats = useMemo(
    () => computeStats(localCellMap, undefined, ship.equipment),
    [localCellMap, ship.equipment]
  );

  const [connStatus, setConnStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [connError, setConnError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [hud, setHud] = useState<{
    nextSpawnIn: number;
    enemyCount: number;
    players: OnlinePlayerSnapshot[];
    me: OnlinePlayerSnapshot | null;
    speed: number;
  }>({
    nextSpawnIn: 5,
    enemyCount: 0,
    players: [],
    me: null,
    speed: 0,
  });

  const [renderState, setRenderState] = useState<{
    camX: number;
    camY: number;
    pilots: RenderPilot[];
  }>({
    camX: 0,
    camY: 0,
    pilots: [],
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<OnlineRoomSnapshot | null>(null);
  const snapshotAtRef = useRef<number>(performance.now());
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({
    left: false,
    right: false,
    thrust: false,
    brake: false,
    fire: false,
  });
  const boostQueuedRef = useRef(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission errors in restricted contexts
    }
  };

  // WebSocket Connection & Reconnect
  useEffect(() => {
    let closedByUser = false;
    let reconnectTimer: number | null = null;
    let inputInterval: number | null = null;

    const sendInput = (forceBoost = false) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const keys = keysRef.current;
      const touch = touchRef.current;
      const boost = forceBoost || boostQueuedRef.current;
      boostQueuedRef.current = false;

      ws.send(
        JSON.stringify({
          type: "input",
          turnLeft: keys.has("a") || keys.has("arrowleft") || touch.left,
          turnRight: keys.has("d") || keys.has("arrowright") || touch.right,
          thrust: keys.has("w") || keys.has("arrowup") || touch.thrust,
          brake: keys.has("s") || keys.has("arrowdown") || touch.brake,
          fire: keys.has(" ") || touch.fire,
          boost,
        })
      );
    };

    const connect = () => {
      if (closedByUser) return;
      setConnStatus("connecting");
      setConnError(null);

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/online`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "join",
            token,
            roomCode,
            ship: {
              id: ship.id,
              name: ship.name,
              cells: ship.cells,
              equipment: ship.equipment ?? [],
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            message?: string;
            snapshot?: OnlineRoomSnapshot;
          };
          if (msg.type === "joined") {
            setConnStatus("connected");
            setConnError(null);
            return;
          }
          if (msg.type === "error") {
            setConnStatus("error");
            setConnError(msg.message || "Unable to connect to room.");
            closedByUser = true;
            return;
          }
          if (msg.type === "state" && msg.snapshot) {
            snapshotRef.current = msg.snapshot;
            snapshotAtRef.current = performance.now();

            for (const ev of msg.snapshot.events) {
              for (let i = 0; i < ev.count; i++) {
                const a = Math.random() * Math.PI * 2;
                const spd = 40 + Math.random() * 150;
                particlesRef.current.push({
                  x: ev.x,
                  y: ev.y,
                  vx: Math.cos(a) * spd,
                  vy: Math.sin(a) * spd,
                  life: 0.35 + Math.random() * 0.35,
                  maxLife: 0.7,
                  color: ev.color,
                  size: 1.8 + Math.random() * 2.2,
                });
              }
            }

            if (msg.snapshot.soundEvents) {
              for (const s of msg.snapshot.soundEvents) {
                if (s === "laser") playLaserSound();
                else if (s === "hit") playHitSound();
                else if (s === "boost") playBoostSound();
              }
            }
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = (ev) => {
        if (closedByUser) return;
        if (ev.code === 4004 || ev.code === 4009 || ev.code === 4001) {
          setConnStatus("error");
          setConnError(ev.reason || "Room connection closed.");
          return;
        }
        setConnStatus("connecting");
        reconnectTimer = window.setTimeout(connect, 1200);
      };
    };

    connect();
    inputInterval = window.setInterval(() => sendInput(false), 50);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        boostQueuedRef.current = true;
        sendInput(true);
        return;
      }
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
      }
      if (!keysRef.current.has(k)) {
        keysRef.current.add(k);
        sendInput(false);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (keysRef.current.has(k)) {
        keysRef.current.delete(k);
        sendInput(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      closedByUser = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (inputInterval !== null) window.clearInterval(inputInterval);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, roomCode, ship.id, ship.name, ship.cells, ship.equipment]);

  // 60FPS Canvas & Smooth Pilot Render Loop
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

    let lastTime = performance.now();
    let lastHudSync = 0;
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const snap = snapshotRef.current;
      const elapsedSinceSnap = Math.min(0.09, Math.max(0, (now - snapshotAtRef.current) / 1000));

      const pilots: RenderPilot[] = snap
        ? snap.players.map((p) => ({
            userId: p.userId,
            username: p.username,
            color: p.color,
            x: p.x + p.vx * elapsedSinceSnap,
            y: p.y + p.vy * elapsedSinceSnap,
            angle: p.angle,
            hull: p.hull,
            maxHull: p.maxHull,
            shield: p.shield,
            maxShield: p.maxShield,
            alive: p.alive,
            thrusting: p.thrusting,
            boosting: p.boosting,
            cells: p.cells,
          }))
        : [];

      const meRender = pilots.find((p) => p.userId === userId) ?? null;
      const camX = meRender ? meRender.x : 0;
      const camY = meRender ? meRender.y : 0;

      // Update local particle bursts
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Draw blank space starfield
      ctx.fillStyle = "#060910";
      ctx.fillRect(0, 0, width, height);

      for (const s of stars) {
        const sx = (((s.x - camX * s.z) % width) + width) % width;
        const sy = (((s.y - camY * s.z) % height) + height) % height;
        ctx.fillStyle = `rgba(232, 237, 245, ${s.alpha})`;
        ctx.fillRect(sx, sy, s.size, s.size);
      }

      const cx = width / 2;
      const cy = height / 2;

      // Draw player shield rings
      for (const p of pilots) {
        if (!p.alive || p.shield <= 0) continue;
        const sx = cx + (p.x - camX);
        const sy = cy + (p.y - camY);
        const sPct = p.shield / Math.max(1, p.maxShield);
        ctx.beginPath();
        ctx.arc(sx, sy, 42, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167, 139, 250, ${0.15 + sPct * 0.25})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw enemies
      if (snap) {
        for (const d of snap.enemies) {
          const sx = cx + (d.x - camX);
          const sy = cy + (d.y - camY);

          if (sx < -80 || sx > width + 80 || sy < -80 || sy > height + 80) {
            // Subtle off-screen enemy indicator on viewport edge
            const ang = Math.atan2(sy - cy, sx - cx);
            const pad = 26;
            const ix = Math.max(pad, Math.min(width - pad, cx + Math.cos(ang) * (width * 0.45)));
            const iy = Math.max(pad + 54, Math.min(height - pad - 60, cy + Math.sin(ang) * (height * 0.42)));
            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(7, 0);
            ctx.lineTo(-5, -4);
            ctx.lineTo(-5, 4);
            ctx.closePath();
            ctx.fillStyle = "rgba(251, 113, 133, 0.7)";
            ctx.fill();
            ctx.restore();
            continue;
          }

          const shieldPct = Math.max(0, d.shield / Math.max(1, d.maxShield));
          const hpPct = Math.max(0, d.hp / Math.max(1, d.maxHp));

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

        // Off-screen teammate beacons
        for (const p of pilots) {
          if (p.userId === userId) continue;
          const sx = cx + (p.x - camX);
          const sy = cy + (p.y - camY);
          if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) {
            const ang = Math.atan2(sy - cy, sx - cx);
            const pad = 28;
            const ix = Math.max(pad, Math.min(width - pad, cx + Math.cos(ang) * (width * 0.44)));
            const iy = Math.max(pad + 54, Math.min(height - pad - 60, cy + Math.sin(ang) * (height * 0.4)));
            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(9, 0);
            ctx.lineTo(-6, -5);
            ctx.lineTo(-6, 5);
            ctx.closePath();
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.restore();
          }
        }

        // Draw Projectiles
        for (const pr of snap.projectiles) {
          const sx = cx + (pr.x - camX);
          const sy = cy + (pr.y - camY);
          ctx.beginPath();
          ctx.arc(sx, sy, pr.radius, 0, Math.PI * 2);
          ctx.fillStyle = pr.color;
          ctx.fill();
        }
      }

      // Draw Particles
      for (const pt of particles) {
        const sx = cx + (pt.x - camX);
        const sy = cy + (pt.y - camY);
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      setRenderState({ camX, camY, pilots });

      if (now - lastHudSync > 90 && snap) {
        lastHudSync = now;
        const me = snap.players.find((p) => p.userId === userId) ?? null;
        setHud({
          nextSpawnIn: snap.nextSpawnIn,
          enemyCount: snap.enemies.length,
          players: snap.players,
          me,
          speed: me ? Math.round(Math.hypot(me.vx, me.vy) * 0.32) : 0,
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [userId]);

  const me = hud.me;
  const healthPct = me
    ? Math.round((me.hull / Math.max(1, me.maxHull)) * 100)
    : 100;
  const shieldPct =
    me && me.maxShield > 0
      ? Math.round((me.shield / me.maxShield) * 100)
      : 0;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#060910]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Live Ships Overlay (Local Player + All Connected Pilots) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {renderState.pilots.map((pilot) => {
          if (!pilot.alive) return null;
          const isMe = pilot.userId === userId;
          const cellMap = isMe ? localCellMap : cellsFromArray(pilot.cells);
          const b = shipBounds(cellMap);
          const shipW = b ? Math.max(72, Math.min(180, b.w * 11)) : 88;
          const shipH = b ? Math.max(72, Math.min(180, b.h * 11)) : 88;
          const dx = pilot.x - renderState.camX;
          const dy = pilot.y - renderState.camY;

          return (
            <div
              key={pilot.userId}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
              }}
            >
              {/* Nameplate for teammates */}
              {!isMe && (
                <div className="mb-1 flex flex-col items-center">
                  <span
                    className="whitespace-nowrap rounded bg-[#0C1119]/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                    style={{ color: pilot.color }}
                  >
                    {pilot.username}
                  </span>
                  <div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-[#151D2B]">
                    <div
                      className="h-full bg-[#FB7185]"
                      style={{
                        width: `${Math.round(
                          (pilot.hull / Math.max(1, pilot.maxHull)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  width: `${shipW}px`,
                  height: `${shipH}px`,
                  transform: `rotate(${pilot.angle}rad)`,
                }}
              >
                <ShipPreview
                  cells={cellMap}
                  thrustPower={pilot.thrusting ? 1 : 0}
                  boostActive={pilot.boosting}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top HUD Bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-4 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#8895A7] transition-colors hover:bg-[#111825] hover:text-[#E8EDF5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Leave Room</span>
          </button>

          <div className="h-4 w-px bg-[#1B2433]" aria-hidden="true" />

          <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#5EEAD4]">
              <Users className="h-3.5 w-3.5" />
              <span>
                {hud.players.length} {hud.players.length === 1 ? "Pilot" : "Pilots"}
              </span>
            </span>
            <span className="text-[#FB7185]">Enemies {hud.enemyCount}</span>
            <span className="text-[#8895A7]">
              Next Spawn {hud.nextSpawnIn.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Squad Roster & Ship Warnings */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 px-3 py-2 font-mono text-xs backdrop-blur-md">
            {hud.players.map((p) => (
              <div
                key={p.userId}
                className="flex items-center gap-1.5 rounded bg-[#060910] px-2 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="font-semibold text-[#E8EDF5]">
                  {p.username}
                </span>
                <span className="text-[#8895A7] tabular-nums">{p.score}</span>
              </div>
            ))}
          </div>

          {!localStats.hasCockpit && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FB7185]/45 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FB7185] backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No cockpit — ship systems are offline</span>
            </div>
          )}

          {localStats.hasCockpit && !localStats.hasThrusters && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FB7185]/45 bg-[#0C1119]/95 px-3.5 py-2 text-xs font-medium text-[#FB7185] backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No thrusters fitted — vessel cannot move</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Center: Room Code */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2 sm:bottom-6">
        <div className="flex items-center gap-3 rounded-xl border border-[#5EEAD4]/45 bg-[#0C1119]/95 px-4 py-2.5 shadow-xl shadow-black/50 backdrop-blur-md">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8895A7]">
              Room Code
            </div>
            <div className="font-mono text-lg font-bold tracking-[0.22em] text-[#5EEAD4] tabular-nums">
              {roomCode}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1B2433] bg-[#111825] px-2.5 font-mono text-xs font-medium text-[#E8EDF5] transition-colors hover:border-[#5EEAD4]/60"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#5EEAD4]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bottom-Left HUD: Health, Shield, Telemetry */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto w-72 space-y-2.5 rounded-xl border border-[#1B2433] bg-[#0C1119]/90 p-3.5 font-mono backdrop-blur-md">
          <div>
            <div className="flex justify-between text-xs tabular-nums">
              <span className="font-semibold text-[#E8EDF5]">Health</span>
              <span className="font-semibold text-[#FB7185]">
                {me ? me.hull : localStats.hullHP} /{" "}
                {me ? me.maxHull : localStats.hullHP}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#151D2B]">
              <div
                className="h-full rounded-full bg-[#FB7185] transition-all duration-150"
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          {(me ? me.maxShield : localStats.shield) > 0 && (
            <div>
              <div className="flex justify-between text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-[#A78BFA]">
                  <Shield className="h-3 w-3" />
                  <span>Shield</span>
                </span>
                <span className="font-semibold text-[#E8EDF5]">
                  {me ? me.shield : localStats.shield} /{" "}
                  {me ? me.maxShield : localStats.shield}
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
            {localStats.boostCharges > 0 && (
              <span className="font-semibold text-[#FBBF24]">
                {me && me.boostTimer > 0
                  ? `2× ${me.boostTimer.toFixed(1)}s`
                  : `Boosts ${me ? me.boostsLeft : localStats.boostCharges}/${
                      me ? me.boostMax : localStats.boostCharges
                    }`}
              </span>
            )}
            <span className="text-[#5EEAD4]">Kills {me ? me.kills : 0}</span>
          </div>
        </div>

        {/* Bottom-Right Touch & Keyboard Controls */}
        <div className="pointer-events-auto hidden flex-col items-end gap-2 lg:flex">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => (touchRef.current.left = true)}
              onPointerUp={() => (touchRef.current.left = false)}
              onPointerLeave={() => (touchRef.current.left = false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5]"
            >
              A
            </button>
            <button
              type="button"
              onPointerDown={() => (touchRef.current.thrust = true)}
              onPointerUp={() => (touchRef.current.thrust = false)}
              onPointerLeave={() => (touchRef.current.thrust = false)}
              className="flex h-10 items-center justify-center rounded-lg border border-[#5EEAD4]/50 bg-[#0C1119]/90 px-3 font-mono text-xs font-semibold text-[#5EEAD4]"
            >
              W Thrust
            </button>
            <button
              type="button"
              onPointerDown={() => (touchRef.current.right = true)}
              onPointerUp={() => (touchRef.current.right = false)}
              onPointerLeave={() => (touchRef.current.right = false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119]/90 font-mono text-xs font-semibold text-[#E8EDF5]"
            >
              D
            </button>
            {localStats.boostCharges > 0 && (
              <button
                type="button"
                onClick={() => {
                  boostQueuedRef.current = true;
                }}
                disabled={!me || me.boostsLeft <= 0 || me.boostTimer > 0}
                className="inline-flex h-10 items-center rounded-lg border border-[#FBBF24]/55 bg-[#0C1119]/90 px-3 font-mono text-xs font-semibold text-[#FBBF24] disabled:opacity-40"
              >
                {me && me.boostTimer > 0
                  ? `2× ${me.boostTimer.toFixed(1)}s`
                  : `Tab Boost (${me ? me.boostsLeft : localStats.boostCharges})`}
              </button>
            )}
            <button
              type="button"
              onPointerDown={() => (touchRef.current.fire = true)}
              onPointerUp={() => (touchRef.current.fire = false)}
              onPointerLeave={() => (touchRef.current.fire = false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#FB7185]/50 bg-[#0C1119]/90 px-3 font-mono text-xs font-semibold text-[#FB7185]"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>Fire</span>
            </button>
          </div>

          <p className="font-mono text-[11px] text-[#8895A7]">
            A / D Turn · W Thrust · S Brake · Tab Boost · Space Fire
          </p>
        </div>
      </div>

      {/* Respawn Overlay */}
      {connStatus === "connected" && me && !me.alive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#060910]/45 backdrop-blur-[2px]">
          <div className="rounded-xl border border-[#1B2433] bg-[#0C1119]/95 px-6 py-5 text-center">
            <div className="font-display text-xl font-semibold text-[#FB7185]">
              Vessel Destroyed
            </div>
            <p className="mt-1 font-mono text-xs text-[#8895A7] tabular-nums">
              Respawning in {me.respawnTimer.toFixed(1)}s...
            </p>
          </div>
        </div>
      )}

      {/* Connecting / Error Overlay */}
      {connStatus !== "connected" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#060910]/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 text-center">
            {connStatus === "connecting" ? (
              <>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#5EEAD4] border-t-transparent" />
                <h2 className="mt-4 font-display text-xl font-semibold text-[#E8EDF5]">
                  Entering Room {roomCode}
                </h2>
                <p className="mt-1 text-sm text-[#8895A7]">
                  Syncing your vessel with the online space sector...
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="mx-auto h-9 w-9 text-[#FB7185]" />
                <h2 className="mt-3 font-display text-xl font-semibold text-[#E8EDF5]">
                  Unable to Connect
                </h2>
                <p className="mt-1.5 text-sm text-[#8895A7]">
                  {connError || "Connection to the online room closed."}
                </p>
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
                >
                  Back to Online Lobby
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
