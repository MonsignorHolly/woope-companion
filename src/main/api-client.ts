import { WOOPE_API_BASE } from "./config";

export type PresenceActivityType = "browsing" | "community" | "blog" | "messages" | "roleplay" | "idle";

export type PresenceResponse = {
  activityType: PresenceActivityType;
  label: string | null;
  meta: Record<string, unknown>;
  startedAt: string | null;
};

export type PairingError = "invalid_or_expired_code" | "rate_limited" | "network_error" | "unknown";

export type ExchangeResult = { ok: true; token: string } | { ok: false; error: PairingError };

/** POST {WOOPE_API_BASE}/api/companion/pair/exchange - see app/api/companion/pair/exchange/route.ts. */
export async function exchangePairingCode(code: string, deviceLabel: string): Promise<ExchangeResult> {
  let response: Response;
  try {
    response = await fetch(`${WOOPE_API_BASE}/api/companion/pair/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, deviceLabel }),
    });
  } catch (error) {
    console.error("Pairing exchange request failed:", error);
    return { ok: false, error: "network_error" };
  }

  const json = await response.json().catch(() => null);

  if (response.ok && typeof json?.token === "string") return { ok: true, token: json.token };
  if (response.status === 429) return { ok: false, error: "rate_limited" };
  if (response.status === 400) return { ok: false, error: "invalid_or_expired_code" };
  return { ok: false, error: "unknown" };
}

export type PresenceFetchResult =
  | { ok: true; presence: PresenceResponse }
  | { ok: false; status: "unauthorized" | "network_error" | "server_error" };

/** GET {WOOPE_API_BASE}/api/companion/presence - see app/api/companion/presence/route.ts. */
export async function fetchPresence(token: string): Promise<PresenceFetchResult> {
  let response: Response;
  try {
    response = await fetch(`${WOOPE_API_BASE}/api/companion/presence`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error("Presence fetch failed:", error);
    return { ok: false, status: "network_error" };
  }

  if (response.status === 401) return { ok: false, status: "unauthorized" };
  if (!response.ok) return { ok: false, status: "server_error" };

  try {
    const presence = (await response.json()) as PresenceResponse;
    return { ok: true, presence };
  } catch (error) {
    console.error("Failed to parse presence response:", error);
    return { ok: false, status: "server_error" };
  }
}
