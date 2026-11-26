import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Globe,
  Plus,
  Rocket,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { createOnlineRoom, verifyOnlineRoom } from "@/lib/online";
import { cellsFromArray, computeStats } from "@/lib/parts";
import { ShipRecord } from "@/lib/ships";
import ShipPreview from "@/components/ship/ShipPreview";

interface OnlineLobbyViewProps {
  token: string;
  fleet: ShipRecord[];
  selectedShipId: string;
  onSelectShip: (shipId: string) => void;
  onEditShip: (shipId: string) => void;
  onCreateShip: () => void;
  onEnterRoom: (roomCode: string) => void;
}

export default function OnlineLobbyView({
  token,
  fleet,
  selectedShipId,
  onSelectShip,
  onEditShip,
  onCreateShip,
  onEnterRoom,
}: OnlineLobbyViewProps) {
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const selectedShip = useMemo(
    () => fleet.find((s) => s.id === selectedShipId) ?? fleet[0] ?? null,
    [fleet, selectedShipId]
  );

  const shipStats = useMemo(() => {
    if (!selectedShip) return null;
    return computeStats(
      cellsFromArray(selectedShip.cells),
      undefined,
      selectedShip.equipment
    );
  }, [selectedShip]);

  const handleAddRoom = async () => {
    if (!selectedShip || creating || joining) return;
    setCreateError(null);
    setJoinError(null);
    setCreating(true);
    try {
      const { roomCode } = await createOnlineRoom(token);
      onEnterRoom(roomCode);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to create room."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShip || creating || joining) return;

    const clean = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(clean)) {
      setJoinError("Enter a valid room code (for example A7K9M2).");
      return;
    }

    setJoinError(null);
    setCreateError(null);
    setJoining(true);
    try {
      const { roomCode } = await verifyOnlineRoom(token, clean);
      onEnterRoom(roomCode);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Unable to enter room."
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1520px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#1B2433] pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#5EEAD4]">
            <Globe className="h-3.5 w-3.5" />
            <span>Multiplayer Space</span>
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#E8EDF5]">
            Online Sector
          </h1>
          <p className="mt-1 text-sm text-[#8895A7]">
            Create a new open room or enter an existing room code to fly and fight together in real time.
          </p>
        </div>

        {selectedShip && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#1B2433] bg-[#0C1119] px-4 py-2.5">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-[#1B2433] bg-[#060910] p-1">
              <ShipPreview cells={cellsFromArray(selectedShip.cells)} />
            </div>
            <div>
              <label
                htmlFor="online-ship-select"
                className="block font-mono text-[10px] uppercase tracking-wider text-[#8895A7]"
              >
                Active Vessel
              </label>
              <select
                id="online-ship-select"
                value={selectedShip.id}
                onChange={(e) => onSelectShip(e.target.value)}
                className="mt-0.5 rounded bg-transparent font-display text-sm font-semibold text-[#E8EDF5] focus:outline-none"
              >
                {fleet.map((ship) => (
                  <option key={ship.id} value={ship.id} className="bg-[#0C1119]">
                    {ship.name}
                  </option>
                ))}
              </select>
            </div>
            {shipStats && (
              <div className="hidden items-center gap-3 border-l border-[#1B2433] pl-3 font-mono text-xs text-[#8895A7] tabular-nums sm:flex">
                <span>HP {shipStats.hullHP}</span>
                {shipStats.shield > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#A78BFA]">
                    <Shield className="h-3 w-3" />
                    {shipStats.shield}
                  </span>
                )}
                <span className="text-[#FB7185]">DMG {shipStats.dmg}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onEditShip(selectedShip.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#1B2433] bg-[#111825] px-2.5 text-xs font-medium text-[#E8EDF5] transition-colors hover:border-[#2E3D55]"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          </div>
        )}
      </div>

      {!selectedShip ? (
        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119] p-8 text-center">
          <Rocket className="mx-auto h-10 w-10 text-[#5EEAD4]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[#E8EDF5]">
            Build a vessel before launching online
          </h2>
          <p className="mt-1.5 text-sm text-[#8895A7]">
            Create a ship in the Shipyard first so you can pilot it into multiplayer rooms.
          </p>
          <button
            type="button"
            onClick={onCreateShip}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#5EEAD4] px-5 text-sm font-semibold text-[#060910] hover:bg-[#7FF0DF]"
          >
            <Plus className="h-4 w-4" />
            <span>Build First Vessel</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Option: Add a Room */}
          <section className="flex flex-col justify-between rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 sm:p-8">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#5EEAD4]/35 bg-[#5EEAD4]/10 text-[#5EEAD4]">
                <Plus className="h-5 w-5" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-[#E8EDF5]">
                Add a Room
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#8895A7]">
                Launch into a blank open space arena with a live room code at the bottom center. Enemy drones spawn every 5 seconds for you and any pilots who join.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-[#1B2433] bg-[#060910] p-3.5 font-mono text-xs">
                <div>
                  <div className="text-[#64748B]">Enemy Spawns</div>
                  <div className="mt-0.5 font-semibold text-[#5EEAD4]">Every 5s</div>
                </div>
                <div>
                  <div className="text-[#64748B]">Squad Capacity</div>
                  <div className="mt-0.5 font-semibold text-[#E8EDF5]">Up to 8 Pilots</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {createError && (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-lg border border-[#F87171]/35 bg-[#F87171]/10 px-3 py-2 text-xs text-[#FCA5A5]"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F87171]" />
                  <span>{createError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddRoom}
                disabled={creating || joining}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-5 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>{creating ? "Creating Room..." : "Add Room"}</span>
              </button>
            </div>
          </section>

          {/* Right Option: Enter an Existing Room */}
          <section className="flex flex-col justify-between rounded-xl border border-[#1B2433] bg-[#0C1119] p-6 sm:p-8">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#60A5FA]/35 bg-[#60A5FA]/10 text-[#60A5FA]">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-[#E8EDF5]">
                Enter Existing Room
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#8895A7]">
                Have a room code from another pilot? Enter the code below to warp directly into their live room.
              </p>
            </div>

            <form onSubmit={handleJoinRoom} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="online-room-code"
                  className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-[#8895A7]"
                >
                  Room Code
                </label>
                <input
                  id="online-room-code"
                  name="roomCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="A7K9M2"
                  maxLength={8}
                  disabled={creating || joining}
                  className="h-11 w-full rounded-lg border border-[#1B2433] bg-[#060910] px-4 font-mono text-base font-semibold tracking-[0.25em] text-[#E8EDF5] placeholder-[#475569] uppercase focus:border-[#60A5FA] focus:outline-none disabled:opacity-60"
                />
              </div>

              {joinError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[#F87171]/35 bg-[#F87171]/10 px-3 py-2 text-xs text-[#FCA5A5]"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F87171]" />
                  <span>{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={creating || joining}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#60A5FA]/50 bg-[#60A5FA]/15 px-5 text-sm font-semibold text-[#93C5FD] transition-colors hover:bg-[#60A5FA]/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{joining ? "Joining Room..." : "Enter Room"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
