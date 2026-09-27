import { Client, type SetActivity } from "@xhayper/discord-rpc";
import { ASSET_KEYS, DISCORD_RECONNECT_INTERVAL_MS, WOOPE_WEBSITE_URL, resolveDiscordClientId } from "./config";
import type { PresenceActivityType, PresenceResponse } from "./api-client";

type SmallImageActivityType = keyof typeof ASSET_KEYS.smallImageByActivity;

const DETAILS_BY_ACTIVITY: Record<PresenceActivityType, string> = {
  browsing: "Prohlíží Woope",
  community: "V komunitě",
  blog: "Čte blog",
  messages: "Píše zprávy",
  roleplay: "Live roleplay",
  idle: "",
};

function hasSmallImage(activityType: PresenceActivityType): activityType is SmallImageActivityType {
  return activityType in ASSET_KEYS.smallImageByActivity;
}

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Maps a Woope presence row to a Discord activity payload, or null for "clear the activity". */
function mapPresenceToActivity(presence: PresenceResponse): SetActivity | null {
  if (presence.activityType === "idle") return null;

  const meta = presence.meta ?? {};
  let state: string | undefined;
  if (presence.activityType === "community") {
    state = metaString(meta, "community_name") ?? presence.label ?? undefined;
  } else if (presence.activityType === "roleplay") {
    state = metaString(meta, "world_name") ?? presence.label ?? undefined;
  }

  const activity: SetActivity = {
    details: DETAILS_BY_ACTIVITY[presence.activityType],
    state,
    largeImageKey: ASSET_KEYS.largeImage,
    largeImageText: "Woope",
    buttons: [{ label: "Otevřít Woope", url: WOOPE_WEBSITE_URL }],
  };

  if (hasSmallImage(presence.activityType)) {
    activity.smallImageKey = ASSET_KEYS.smallImageByActivity[presence.activityType];
    activity.smallImageText = presence.label ?? undefined;
  }

  if (presence.startedAt) {
    const startedAt = new Date(presence.startedAt);
    if (!Number.isNaN(startedAt.getTime())) activity.startTimestamp = startedAt;
  }

  return activity;
}

function presenceSignature(presence: PresenceResponse): string {
  return JSON.stringify([presence.activityType, presence.label, presence.meta, presence.startedAt]);
}

/**
 * Owns the @xhayper/discord-rpc client. The library has no built-in
 * reconnect (a dropped IPC pipe just emits "disconnected" and stays dropped),
 * so reconnection here is explicit: on a failed connect or a disconnect, wait
 * DISCORD_RECONNECT_INTERVAL_MS and try again, indefinitely. This is also
 * what recovers when the user quits and relaunches Discord itself.
 */
export class DiscordPresenceManager {
  private client: Client | null = null;
  private ready = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastSignature: string | null = null;
  private destroyed = false;

  constructor(private readonly onConnectionChange: (connected: boolean) => void) {}

  /** The application ID comes from Woope (see config.ts), so the client is only created once that answered. */
  private async ensureClient(): Promise<Client | null> {
    if (this.client) return this.client;
    const clientId = await resolveDiscordClientId();
    if (!clientId) {
      console.warn("[woope-companion] No Discord application ID yet (Woope did not provide one) - retrying later.");
      return null;
    }
    const client = new Client({ clientId });
    client.on("ready", () => {
      this.ready = true;
      this.lastSignature = null; // force a resend so a reconnect doesn't leave Discord blank
      this.onConnectionChange(true);
    });
    client.on("disconnected", () => {
      this.ready = false;
      this.onConnectionChange(false);
      this.scheduleReconnect();
    });
    this.client = client;
    return client;
  }

  connect(): void {
    void this.ensureClient().then((client) => {
      if (!client) {
        this.scheduleReconnect();
        return;
      }
      client.login().catch((error) => {
        console.error("Discord RPC connection failed (is Discord running?):", error?.message ?? error);
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, DISCORD_RECONNECT_INTERVAL_MS);
  }

  async applyPresence(presence: PresenceResponse): Promise<void> {
    if (!this.ready || !this.client?.user) return;

    const signature = presenceSignature(presence);
    if (signature === this.lastSignature) return;

    try {
      const activity = mapPresenceToActivity(presence);
      if (activity) await this.client.user.setActivity(activity);
      else await this.client.user.clearActivity();
      this.lastSignature = signature;
    } catch (error) {
      console.error("Failed to update Discord activity:", error);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    void this.client?.destroy();
  }
}
