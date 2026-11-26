/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader, { AppRouteView } from "@/components/AppHeader";
import AuthScreen from "@/components/auth/AuthScreen";
import HomeView from "@/components/home/HomeView";
import HangarView from "@/components/hangar/HangarView";
import ShipyardView from "@/components/ship/ShipyardView";
import FlightArena from "@/components/flight/FlightArena";
import FlightSelectView from "@/components/flight/FlightSelectView";
import StarMapView from "@/components/flight/StarMapView";
import RealFlightGame from "@/components/flight/RealFlightGame";
import ProgressView from "@/components/progress/ProgressView";
import OnlineLobbyView from "@/components/online/OnlineLobbyView";
import OnlineArena from "@/components/online/OnlineArena";
import { AuthResponse, AuthUser, saveAccountState } from "@/lib/account";
import {
  isAudioMuted,
  isMusicEnabled,
  setAudioMuted,
  setMusicEnabled,
  setMusicMood,
  stopMusicLoop,
  unlockAndStartMusic,
} from "@/lib/audio";
import { rollRandomEquipment } from "@/lib/equipment";
import { cellsFromArray, cellsToArray } from "@/lib/parts";
import { STAR_MAP_BOSS_SECTOR, STAR_SECTORS, StarSector } from "@/lib/sectors";
import {
  FleetEquipmentGrant,
  ShipRecord,
  createBlankShip,
  createStarterFleet,
} from "@/lib/ships";

interface AuthSession {
  token: string;
  user: AuthUser;
}

function normalizeShipRecord(ship: ShipRecord, existing?: ShipRecord): ShipRecord {
  return {
    ...ship,
    updatedAt: Date.now(),
    cells: cellsToArray(cellsFromArray(ship.cells)),
    equipment: ship.equipment ?? existing?.equipment ?? [],
  };
}

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [fleet, setFleet] = useState<ShipRecord[]>([]);
  const [activeView, setActiveView] = useState<AppRouteView>("home");
  const [activeShipId, setActiveShipId] = useState<string>("");
  const [activeSector, setActiveSector] = useState<StarSector>(STAR_SECTORS[0]);
  const [activeRoomCode, setActiveRoomCode] = useState<string>("");
  const [clearedSectorIds, setClearedSectorIds] = useState<string[]>([]);
  const [playerLevel, setPlayerLevel] = useState<number>(1);
  const [recentGrants, setRecentGrants] = useState<FleetEquipmentGrant[]>([]);
  const [muted, setMuted] = useState<boolean>(() => isAudioMuted());
  const [musicEnabled, setMusicEnabledState] = useState<boolean>(() =>
    isMusicEnabled()
  );

  // Skip auto-saving during initial hydration immediately after login
  const skipNextSyncRef = useRef<boolean>(false);

  const activeShip = useMemo(
    () => fleet.find((s) => s.id === activeShipId) ?? fleet[0] ?? null,
    [fleet, activeShipId]
  );

  const resolvedActiveShipId = activeShip?.id ?? activeShipId;

  // Keep latest snapshot ref for immediate flush on sign out or tab backgrounding
  const latestStateRef = useRef({
    token: "",
    fleet,
    clearedSectorIds,
    playerLevel,
    activeShipId: resolvedActiveShipId,
    lastView: activeView,
  });

  latestStateRef.current = {
    token: authSession?.token ?? "",
    fleet,
    clearedSectorIds,
    playerLevel,
    activeShipId: resolvedActiveShipId,
    lastView: activeView,
  };

  // Persist signed-in user progress to server whenever state updates
  useEffect(() => {
    if (!authSession) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const token = authSession.token;
    const payload = {
      fleet,
      clearedSectorIds,
      playerLevel,
      activeShipId: resolvedActiveShipId,
      lastView: activeView,
    };

    const timer = window.setTimeout(() => {
      void saveAccountState(token, payload).catch(() => {
        // Ignore transient background save errors; next mutation retries
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    authSession,
    fleet,
    clearedSectorIds,
    playerLevel,
    resolvedActiveShipId,
    activeView,
  ]);

  // Flush state with keepalive if user closes/hides tab while signed in
  useEffect(() => {
    const flushKeepalive = () => {
      const snap = latestStateRef.current;
      if (!snap.token) return;
      try {
        void fetch("/api/account/state", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${snap.token}`,
          },
          body: JSON.stringify({
            fleet: snap.fleet,
            clearedSectorIds: snap.clearedSectorIds,
            playerLevel: snap.playerLevel,
            activeShipId: snap.activeShipId,
            lastView: snap.lastView,
          }),
          keepalive: true,
        });
      } catch {
        // Ignore browser shutdown abort errors
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushKeepalive();
      }
    };

    window.addEventListener("pagehide", flushKeepalive);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flushKeepalive);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Keep hash synchronized for smooth back/forward navigation while signed in
  useEffect(() => {
    if (!authSession) {
      window.history.replaceState(null, "", "#auth");
      return;
    }
    if (activeView === "home") {
      window.history.replaceState(null, "", "#home");
    } else if (activeView === "hangar") {
      window.history.replaceState(null, "", "#hangar");
    } else if (activeView === "builder" && activeShip) {
      window.history.replaceState(null, "", `#ship/${activeShip.id}`);
    } else if (activeView === "flight" && activeShip) {
      window.history.replaceState(null, "", `#test-flight/${activeShip.id}`);
    } else if (activeView === "play-select") {
      window.history.replaceState(null, "", "#flight");
    } else if (activeView === "star-map" && activeShip) {
      window.history.replaceState(null, "", `#flight/${activeShip.id}/map`);
    } else if (activeView === "playing" && activeShip) {
      window.history.replaceState(
        null,
        "",
        `#flight/${activeShip.id}/${activeSector.id}`
      );
    } else if (activeView === "progress") {
      window.history.replaceState(null, "", "#progress");
    } else if (activeView === "online-lobby") {
      window.history.replaceState(null, "", "#online");
    } else if (activeView === "online-arena" && activeRoomCode) {
      window.history.replaceState(null, "", `#online/${activeRoomCode}`);
    }
  }, [authSession, activeView, activeShip?.id, activeSector.id, activeRoomCode]);

  // Sync calm ambient music mood & unlock Web Audio on first user interaction
  useEffect(() => {
    if (!authSession) {
      setMusicMood("dock");
      return;
    }
    setMusicMood(
      activeView === "flight" ||
        activeView === "playing" ||
        activeView === "online-arena"
        ? "battle"
        : "dock"
    );
  }, [authSession, activeView]);

  useEffect(() => {
    const onGesture = () => {
      unlockAndStartMusic();
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      stopMusicLoop();
    };
  }, []);

  const handleAuthenticated = useCallback((auth: AuthResponse) => {
    const incomingFleet =
      Array.isArray(auth.state.fleet) && auth.state.fleet.length > 0
        ? auth.state.fleet
        : createStarterFleet();

    const matchedShip =
      incomingFleet.find((s) => s.id === auth.state.activeShipId) ??
      incomingFleet[0];

    skipNextSyncRef.current = auth.state.fleet.length > 0;
    setFleet(incomingFleet);
    setClearedSectorIds(
      Array.isArray(auth.state.clearedSectorIds)
        ? auth.state.clearedSectorIds
        : []
    );
    setPlayerLevel(
      typeof auth.state.playerLevel === "number" && auth.state.playerLevel >= 1
        ? auth.state.playerLevel
        : 1
    );
    setActiveShipId(matchedShip?.id ?? "");
    setActiveView("home");
    setRecentGrants([]);
    setAuthSession({ token: auth.token, user: auth.user });
  }, []);

  const handleSignOut = useCallback(async () => {
    const snap = latestStateRef.current;
    if (snap.token) {
      try {
        await saveAccountState(snap.token, {
          fleet: snap.fleet,
          clearedSectorIds: snap.clearedSectorIds,
          playerLevel: snap.playerLevel,
          activeShipId: snap.activeShipId,
          lastView: snap.lastView,
        });
      } catch {
        // Proceed with sign out even if network flush fails
      }
    }
    setAuthSession(null);
    setFleet([]);
    setClearedSectorIds([]);
    setPlayerLevel(1);
    setActiveShipId("");
    setActiveRoomCode("");
    setActiveView("home");
    setRecentGrants([]);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setAudioMuted(next);
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicEnabledState((prev) => {
      const next = !prev;
      setMusicEnabled(next);
      return next;
    });
  }, []);

  const handleCreateShip = useCallback(() => {
    const fresh = createBlankShip();
    setFleet((prev) => [normalizeShipRecord(fresh), ...prev]);
    setActiveShipId(fresh.id);
    setActiveView("builder");
  }, []);

  const handleEditShip = useCallback((id: string) => {
    setActiveShipId(id);
    setActiveView("builder");
  }, []);

  const handleFlyShip = useCallback((id: string) => {
    setActiveShipId(id);
    setActiveView("flight");
  }, []);

  const handleChooseShipForMap = useCallback((id: string) => {
    setActiveShipId(id);
    setActiveView("star-map");
  }, []);

  const handleSelectSector = useCallback((sector: StarSector) => {
    setActiveSector(sector);
    setActiveView("playing");
  }, []);

  const handleSectorCleared = useCallback(
    (sectorId: string) => {
      // Defeating the Sector Boss (after clearing all 25 stars) grants rewards, levels up, and resets the star map
      if (sectorId === STAR_MAP_BOSS_SECTOR.id) {
        const grants: FleetEquipmentGrant[] = [];
        const nextFleet = fleet.map((ship) => {
          const eq = rollRandomEquipment();
          grants.push({
            shipId: ship.id,
            shipName: ship.name,
            equipment: eq,
          });
          return {
            ...ship,
            updatedAt: Date.now(),
            equipment: [...(ship.equipment ?? []), eq],
          };
        });

        setPlayerLevel((lvl) => lvl + 1);
        setFleet(nextFleet);
        setRecentGrants(grants);
        setClearedSectorIds([]);
        return;
      }

      const updatedSet = new Set(clearedSectorIds);
      updatedSet.add(sectorId);
      setClearedSectorIds(Array.from(updatedSet));
    },
    [clearedSectorIds, fleet]
  );

  const handleResetCleared = useCallback(() => {
    setClearedSectorIds([]);
  }, []);

  const handleDuplicateShip = useCallback(
    (id: string) => {
      const source = fleet.find((s) => s.id === id);
      if (!source) return;
      const copy: ShipRecord = {
        id: `ship-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        name: `${source.name} Copy`,
        updatedAt: Date.now(),
        equipment: source.equipment
          ? source.equipment.map((e) => ({ ...e, effect: { ...e.effect } }))
          : [],
        cells: source.cells.map((c) => ({
          ...c,
          mod: c.mod ? { ...c.mod } : undefined,
        })),
      };
      setFleet((prev) => [copy, ...prev]);
      setActiveShipId(copy.id);
    },
    [fleet]
  );

  const handleDeleteShip = useCallback(
    (id: string) => {
      const nextFleet = fleet.filter((s) => s.id !== id);
      setFleet(nextFleet);
      if (activeShipId === id) {
        setActiveShipId(nextFleet[0]?.id ?? "");
        if (nextFleet.length === 0) {
          setActiveView("hangar");
        }
      }
    },
    [fleet, activeShipId]
  );

  const handleRestoreStarters = useCallback(() => {
    const starters = createStarterFleet();
    setFleet(starters);
    setActiveShipId(starters[0]?.id ?? "");
  }, []);

  const handleSaveShip = useCallback((updated: ShipRecord) => {
    setFleet((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      const existing = idx >= 0 ? prev[idx] : undefined;
      const normalized = normalizeShipRecord(updated, existing);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalized;
        return next;
      }
      return [normalized, ...prev];
    });
    setActiveShipId(updated.id);
  }, []);

  const handleLaunchFlight = useCallback(
    (updated: ShipRecord) => {
      handleSaveShip(updated);
      setActiveView("flight");
    },
    [handleSaveShip]
  );

  const handleHeaderNavigate = useCallback(
    (view: AppRouteView) => {
      if ((view === "builder" || view === "flight") && !activeShip) {
        handleCreateShip();
        return;
      }
      setActiveView(view);
    },
    [activeShip, handleCreateShip]
  );

  if (!authSession) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        muted={muted}
        onToggleMute={handleToggleMute}
        musicEnabled={musicEnabled}
        onToggleMusic={handleToggleMusic}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#060910] text-[#E8EDF5]">
      <AppHeader
        activeView={activeView}
        onNavigate={handleHeaderNavigate}
        onNewShip={handleCreateShip}
        muted={muted}
        onToggleMute={handleToggleMute}
        musicEnabled={musicEnabled}
        onToggleMusic={handleToggleMusic}
        username={authSession.user.username}
        onSignOut={handleSignOut}
      />

      {activeView === "home" && (
        <HomeView
          playerLevel={playerLevel}
          recentGrants={recentGrants}
          onDismissGrants={() => setRecentGrants([])}
          onCreateShip={handleCreateShip}
        />
      )}

      {activeView === "progress" && (
        <ProgressView
          fleet={fleet}
          playerLevel={playerLevel}
          clearedSectorIds={clearedSectorIds}
          recentGrants={recentGrants}
          onDismissGrants={() => setRecentGrants([])}
        />
      )}

      {activeView === "hangar" && (
        <HangarView
          fleet={fleet}
          recentGrants={recentGrants}
          onDismissGrants={() => setRecentGrants([])}
          onCreateShip={handleCreateShip}
          onEditShip={handleEditShip}
          onFlyShip={handleFlyShip}
          onDuplicateShip={handleDuplicateShip}
          onDeleteShip={handleDeleteShip}
          onRestoreStarters={handleRestoreStarters}
        />
      )}

      {activeView === "builder" && activeShip && (
        <ShipyardView
          ship={activeShip}
          onSaveShip={handleSaveShip}
          onLaunchFlight={handleLaunchFlight}
          onBackToHangar={() => setActiveView("hangar")}
        />
      )}

      {activeView === "flight" && activeShip && (
        <FlightArena
          ship={activeShip}
          fleet={fleet}
          onSelectShip={(id) => setActiveShipId(id)}
          onEditShip={handleEditShip}
          onBackToHangar={() => setActiveView("hangar")}
        />
      )}

      {activeView === "play-select" && (
        <FlightSelectView
          fleet={fleet}
          selectedShipId={activeShip?.id ?? ""}
          onStartGame={handleChooseShipForMap}
          onEditShip={handleEditShip}
          onCreateShip={handleCreateShip}
        />
      )}

      {activeView === "star-map" && activeShip && (
        <StarMapView
          ship={activeShip}
          clearedSectorIds={clearedSectorIds}
          onSelectSector={handleSelectSector}
          onChangeShip={() => setActiveView("play-select")}
          onResetCleared={handleResetCleared}
        />
      )}

      {activeView === "playing" && activeShip && (
        <RealFlightGame
          key={`${activeShip.id}-${activeSector.id}`}
          ship={activeShip}
          sector={activeSector}
          willUnlockBossOnClear={
            !activeSector.isBoss &&
            clearedSectorIds.length >= STAR_SECTORS.length
          }
          onChallengeBoss={() => {
            setActiveSector(STAR_MAP_BOSS_SECTOR);
            setActiveView("playing");
          }}
          onSectorCleared={handleSectorCleared}
          onReturnHome={() => setActiveView("home")}
          onBackToMap={() => setActiveView("star-map")}
          onChangeShip={() => setActiveView("play-select")}
          onEditShip={handleEditShip}
        />
      )}

      {activeView === "online-lobby" && (
        <OnlineLobbyView
          token={authSession.token}
          fleet={fleet}
          selectedShipId={activeShip?.id ?? ""}
          onSelectShip={(id) => setActiveShipId(id)}
          onEditShip={handleEditShip}
          onCreateShip={handleCreateShip}
          onEnterRoom={(code) => {
            setActiveRoomCode(code);
            setActiveView("online-arena");
          }}
        />
      )}

      {activeView === "online-arena" && activeShip && activeRoomCode && (
        <OnlineArena
          key={`${activeRoomCode}-${activeShip.id}`}
          token={authSession.token}
          userId={authSession.user.id}
          roomCode={activeRoomCode}
          ship={activeShip}
          onLeaveRoom={() => {
            setActiveRoomCode("");
            setActiveView("online-lobby");
          }}
        />
      )}
    </div>
  );
}
