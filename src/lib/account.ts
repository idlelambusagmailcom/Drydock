import type { ShipRecord } from "./ships";

export interface AuthUser {
  id: string;
  username: string;
}

export interface AccountGameState {
  fleet: ShipRecord[];
  clearedSectorIds: string[];
  playerLevel: number;
  activeShipId: string;
  lastView: string;
  updatedAt: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  state: AccountGameState;
}

export interface AccountSavePayload {
  fleet: ShipRecord[];
  clearedSectorIds: string[];
  playerLevel: number;
  activeShipId: string;
  lastView: string;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }
  } catch {
    // Ignore non-JSON error responses
  }
  return fallback;
}

export async function registerAccount(
  username: string,
  initialFleet: ShipRecord[]
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, initialFleet }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not create account."));
  }

  return (await res.json()) as AuthResponse;
}

export async function loginAccount(username: string): Promise<AuthResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not sign in."));
  }

  return (await res.json()) as AuthResponse;
}

export async function saveAccountState(
  token: string,
  payload: AccountSavePayload
): Promise<void> {
  const res = await fetch("/api/account/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not save progress."));
  }
}
