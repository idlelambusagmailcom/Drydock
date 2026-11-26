import { FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Music,
  User,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AuthResponse, loginAccount, registerAccount } from "@/lib/account";
import { createStarterFleet } from "@/lib/ships";

interface AuthScreenProps {
  onAuthenticated: (auth: AuthResponse) => void;
  muted: boolean;
  onToggleMute: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
}

type AuthMode = "signin" | "signup";

export default function AuthScreen({
  onAuthenticated,
  muted,
  onToggleMute,
  musicEnabled,
  onToggleMusic,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3 || trimmedUser.length > 24) {
      setError("Username must be between 3 and 24 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
      setError("Username may only use letters, numbers, underscores, and hyphens.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response =
        mode === "signup"
          ? await registerAccount(trimmedUser, createStarterFleet())
          : await loginAccount(trimmedUser);
      onAuthenticated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#060910] text-[#E8EDF5]">
      {/* Subtle atmospheric backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 68% 48% at 50% 0%, rgba(94, 234, 212, 0.08), transparent 70%), radial-gradient(circle at 18% 72%, rgba(56, 189, 248, 0.05), transparent 45%), radial-gradient(circle at 84% 78%, rgba(94, 234, 212, 0.04), transparent 45%)",
        }}
      />

      {/* Minimal top strip */}
      <header className="relative z-10 border-b border-[#1B2433]/80 bg-[#060910]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
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
            <span className="font-display text-base font-semibold tracking-[0.2em] text-[#E8EDF5]">
              DRYDOCK
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMusic}
              aria-label={musicEnabled ? "Turn off background music" : "Turn on background music"}
              title={musicEnabled ? "Background music on" : "Background music off"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-[#0C1119] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] ${
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1B2433] bg-[#0C1119] text-[#8895A7] transition-colors hover:border-[#2C3A52] hover:text-[#E8EDF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4]"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main auth card */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.26em] text-[#5EEAD4]">
            Commander Access
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#E8EDF5]">
            {mode === "signin" ? "Sign in to Drydock" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8895A7]">
            {mode === "signin"
              ? "Enter your username to load your saved fleet, commander level, and cleared star sectors."
              : "Pick a username to save your ships, equipment, and campaign progress."}
          </p>
        </div>

        <div className="rounded-xl border border-[#1B2433] bg-[#0C1119]/95 p-6 shadow-2xl shadow-black/50 sm:p-7">
          {/* Mode Tabs */}
          <div className="mb-6 grid grid-cols-2 border-b border-[#1B2433]">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`relative pb-3 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "text-[#E8EDF5]"
                  : "text-[#64748B] hover:text-[#94A3B8]"
              }`}
            >
              Sign In
              {mode === "signin" && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#5EEAD4]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`relative pb-3 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "text-[#E8EDF5]"
                  : "text-[#64748B] hover:text-[#94A3B8]"
              }`}
            >
              Create Account
              {mode === "signup" && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#5EEAD4]" />
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="auth-username"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-[#8895A7]"
              >
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="commander_nova"
                  disabled={submitting}
                  className="h-11 w-full rounded-lg border border-[#1B2433] bg-[#060910] pl-10 pr-3.5 text-sm text-[#E8EDF5] placeholder-[#475569] transition-colors focus:border-[#5EEAD4] focus:outline-none disabled:opacity-60"
                />
              </div>
              {mode === "signup" && (
                <p className="mt-1.5 text-xs text-[#64748B]">
                  3–24 characters using letters, numbers, underscores, or hyphens.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#F87171]/35 bg-[#F87171]/10 px-3.5 py-2.5 text-xs leading-relaxed text-[#FCA5A5]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F87171]" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5EEAD4] px-5 text-sm font-semibold text-[#060910] transition-colors hover:bg-[#7FF0DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "signin" ? (
                <>
                  <span>{submitting ? "Signing in..." : "Sign In"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>{submitting ? "Creating account..." : "Create Account & Enter"}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#1B2433]/60 py-4 text-center text-xs text-[#64748B]">
        Fleet blueprints, star map progression, and commander levels sync automatically to your account.
      </footer>
    </div>
  );
}
