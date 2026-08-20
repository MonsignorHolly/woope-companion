import { EventEmitter } from "node:events";
import type { PresenceResponse } from "./api-client";

export type ConnectionStatus = "connected" | "idle" | "disconnected";

/**
 * Single source of truth for tray rendering. Nothing here does I/O - callers
 * (pairing, the presence poller, the Discord RPC manager) push updates in,
 * and TrayController re-renders on "change". `status` is always computed
 * live from the current fields, so it doesn't matter whether a listener was
 * attached before or after a given update.
 */
export class AppState extends EventEmitter {
  private paired = false;
  private discordConnected = false;
  private apiUnreachable = false;
  private latestPresence: PresenceResponse | null = null;

  setPaired(paired: boolean): void {
    this.paired = paired;
    if (!paired) this.latestPresence = null;
    this.emit("change");
  }

  setDiscordConnected(connected: boolean): void {
    this.discordConnected = connected;
    this.emit("change");
  }

  setApiUnreachable(unreachable: boolean): void {
    if (this.apiUnreachable === unreachable) return;
    this.apiUnreachable = unreachable;
    this.emit("change");
  }

  setLatestPresence(presence: PresenceResponse | null): void {
    this.latestPresence = presence;
    this.emit("change");
  }

  get isPaired(): boolean {
    return this.paired;
  }

  get status(): ConnectionStatus {
    if (!this.paired || this.apiUnreachable || !this.discordConnected) return "disconnected";
    if (this.latestPresence?.activityType === "idle") return "idle";
    return "connected";
  }
}
