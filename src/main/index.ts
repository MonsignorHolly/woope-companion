import { app } from "electron";
import { DISCORD_CLIENT_ID_CONFIGURED } from "./config";
import { AppState } from "./state";
import { TrayController } from "./tray-controller";
import { DiscordPresenceManager } from "./discord-presence";
import { PresencePoller } from "./presence-poller";
import { closePairingWindow, showPairingWindow } from "./pairing-window";
import { clearToken, loadToken } from "./token-store";

// Tray-only app: a second launch (e.g. double-clicking the installer's
// desktop shortcut again) should not spawn a second tray icon.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Nothing to focus - there is no window to bring forward.
  });

  app.on("window-all-closed", () => {
    // The pairing window is the only window this app ever opens; closing it
    // must never quit the tray app.
  });

  app.whenReady().then(bootstrap).catch((error) => {
    console.error("Failed to start Woope Companion:", error);
    app.quit();
  });
}

let state: AppState;
let discord: DiscordPresenceManager;
let poller: PresencePoller | null = null;

async function bootstrap(): Promise<void> {
  app.dock?.hide();

  state = new AppState();
  new TrayController(state, {
    onPair: () => showPairingWindow(handlePaired),
    onUnpair: () => void handleUnpair(),
    onQuit: () => app.quit(),
  });

  discord = new DiscordPresenceManager((connected) => state.setDiscordConnected(connected));
  if (DISCORD_CLIENT_ID_CONFIGURED) {
    discord.connect();
  } else {
    console.warn(
      "[woope-companion] DISCORD_CLIENT_ID is not configured yet - see README.md. Discord RPC will stay disconnected until it is set.",
    );
  }

  const token = await loadToken();
  if (token) {
    state.setPaired(true);
    startPolling(token);
  } else {
    showPairingWindow(handlePaired);
  }

  app.on("before-quit", () => {
    poller?.stop();
    discord.destroy();
    closePairingWindow();
  });
}

function startPolling(token: string): void {
  poller?.stop();
  poller = new PresencePoller(token, discord, state, handleUnauthorized);
  poller.start();
}

function handlePaired(): void {
  void loadToken().then((token) => {
    if (!token) return;
    state.setPaired(true);
    startPolling(token);
  });
}

async function handleUnpair(): Promise<void> {
  poller?.stop();
  poller = null;
  await clearToken();
  state.setPaired(false);
  await discord.applyPresence({ activityType: "idle", label: null, meta: {}, startedAt: null });
}

function handleUnauthorized(): void {
  poller = null;
  void clearToken();
  state.setPaired(false);
  void discord.applyPresence({ activityType: "idle", label: null, meta: {}, startedAt: null });
  showPairingWindow(handlePaired);
}
