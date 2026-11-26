import { Globe, LogOut, Music, Plus, User, Volume2, VolumeX } from "lucide-react";

export type AppRouteView =
  | "home"
  | "hangar"
  | "builder"
  | "flight"
  | "play-select"
  | "star-map"
  | "playing"
  | "progress"
  | "online-lobby"
  | "online-arena";

interface AppHeaderProps {
  activeView: AppRouteView;
  onNavigate: (view: AppRouteView) => void;
  onNewShip: () => void;
  muted: boolean;
  onToggleMute: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  username?: string;
  onSignOut?: () => void;
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 L19 18 L12 15.2 L5 18 Z"
        stroke="#5EEAD4"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(94, 234, 212, 0.16)"
      />
      <circle cx="12" cy="11" r="1.4" fill="#5EEAD4" />
    </svg>
  );
}

export default function AppHeader({
  activeView,
  onNavigate,
  onNewShip,
  muted,
  onToggleMute,
  musicEnabled,
  onToggleMusic,
  username,
  onSignOut,
}: AppHeaderProps) {
  const navItems: { id: AppRouteView; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "hangar", label: "Hangar" },
    { id: "builder", label: "Shipyard" },
    { id: "play-select", label: "Flight" },
    { id: "progress", label: "Progress" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#1B2433] bg-[#060910]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1520px] items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6 lg:px-10">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-left transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
        >
          <BrandMark />
          <span className="font-display text-base font-semibold tracking-[0.2em] text-[#E8EDF5]">
            DRYDOCK
          </span>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="flex items-center gap-5 sm:gap-6" aria-label="Primary">
          {navItems.map((item) => {
            const isActive =
              activeView === item.id ||
              (item.id === "play-select" &&
                (activeView === "star-map" || activeView === "playing"));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative shrink-0 whitespace-nowrap py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5EEAD4] ${
                  isActive
                    ? "text-[#E8EDF5]"
                    : "text-[#8895A7] hover:text-[#E8EDF5]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#5EEAD4]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Online Tab, Audio, Primary Action, & Account */}
        <div className="flex shrink-0 items-center gap-2">
          {username && (
            <div className="mr-1 hidden items-center gap-1.5 whitespace-nowrap font-mono text-xs text-[#8895A7] lg:flex">
              <User className="h-3.5 w-3.5 text-[#5EEAD4]" />
              <span>{username}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigate("online-lobby")}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] ${
              activeView === "online-lobby" || activeView === "online-arena"
                ? "border-[#5EEAD4] bg-[#5EEAD4]/15 text-[#5EEAD4]"
                : "border-[#1B2433] bg-[#0C1119] text-[#E8EDF5] hover:border-[#5EEAD4]/50 hover:text-[#5EEAD4]"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Online</span>
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            aria-label={musicEnabled ? "Turn off background music" : "Turn on background music"}
            title={musicEnabled ? "Background music on" : "Background music off"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-[#0C1119] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] ${
              musicEnabled && !muted
                ? "border-[#5EEAD4]/40 text-[#5EEAD4] hover:border-[#5EEAD4]"
                : "border-[#1B2433] text-[#64748B] hover:border-[#2C3A52] hover:text-[#E8EDF5]"
            }`}
          >
            <Music className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute all audio" : "Mute all audio"}
            title={muted ? "Unmute all audio" : "Mute all audio"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119] text-[#8895A7] transition-colors hover:border-[#2C3A52] hover:text-[#E8EDF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onNewShip}
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#5EEAD4] px-4 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
          >
            <Plus className="h-4 w-4" />
            <span>New Vessel</span>
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title={username ? `Sign out (${username})` : "Sign out"}
              className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#1B2433] bg-[#0C1119] px-3 text-xs font-medium text-[#8895A7] transition-colors hover:border-[#2C3A52] hover:text-[#E8EDF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
