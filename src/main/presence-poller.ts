import { POLL_INTERVAL_MS, PRESENCE_FAILURE_THRESHOLD } from "./config";
import { fetchPresence } from "./api-client";
import type { DiscordPresenceManager } from "./discord-presence";
import type { AppState } from "./state";

/**
 * Polls GET /api/companion/presence every POLL_INTERVAL_MS and forwards the
 * result to Discord. A network hiccup doesn't reset the Discord activity
 * immediately - the last known activity is left showing until
 * PRESENCE_FAILURE_THRESHOLD consecutive failures, at which point the tray
 * reports "Nepřipojeno" (Discord is left alone either way; only the tray
 * status reflects the outage).
 */
export class PresencePoller {
  private timer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private stopped = true;

  constructor(
    private readonly token: string,
    private readonly discord: DiscordPresenceManager,
    private readonly state: AppState,
    private readonly onUnauthorized: () => void,
  ) {}

  start(): void {
    this.stopped = false;
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), POLL_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    const result = await fetchPresence(this.token);

    if (!result.ok && result.status === "unauthorized") {
      this.stop();
      this.onUnauthorized();
      return;
    }

    if (!result.ok) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= PRESENCE_FAILURE_THRESHOLD) this.state.setApiUnreachable(true);
      this.scheduleNext();
      return;
    }

    this.consecutiveFailures = 0;
    this.state.setApiUnreachable(false);
    this.state.setLatestPresence(result.presence);
    await this.discord.applyPresence(result.presence);
    this.scheduleNext();
  }
}
