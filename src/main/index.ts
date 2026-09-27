import { app, Notification } from "electron";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PROTOCOL_SCHEME } from "./config";
import { AppState } from "./state";
import { TrayController } from "./tray-controller";
import { DiscordPresenceManager } from "./discord-presence";
import { PresencePoller } from "./presence-poller";
import { closePairingWindow, showPairingWindow } from "./pairing-window";
import { clearToken, loadToken, saveToken } from "./token-store";
import { exchangePairingCode } from "./api-client";
import { setLaunchAtLogin } from "./auto-launch";

/**
 * "Connect with the app" on Woope's Discord settings page opens
 * woope-companion://pair?code=123456. The OS hands that URL to this app: in
 * argv of the launch (or of a second launch, forwarded through
 * "second-instance") on Windows/Linux, and through "open-url" on macOS.
 */
function pairingCodeFromUrl(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith(`${PROTOCOL_SCHEME}://`)) return null;
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("code")?.replace(/\D/g, "") ?? "";
    return url.hostname === "pair" && code.length >= 6 ? code : null;
  } catch {
    return null;
  }
}

function pairingCodeFromArgv(argv: string[]): string | null {
  for (const arg of argv) {
    const code = pairingCodeFromUrl(arg);
    if (code) return code;
  }
  return null;
}

// Register the scheme. In development (`electron .`) the executable is
// Electron itself, so the app path has to be passed along for the OS to
// launch the right thing.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

let pendingCode: string | null = pairingCodeFromArgv(process.argv);
let booted = false;

// macOS delivers the URL as an event, possibly before "ready".
app.on("open-url", (event, url) => {
  event.preventDefault();
  const code = pairingCodeFromUrl(url);
  if (!code) return;
  if (booted) void pairWithCode(code);
  else pendingCode = code;
});

// Tray-only app: a second launch (e.g. double-clicking the installer's
// desktop shortcut again, or a pairing link while it is running) must not
// spawn a second tray icon - it forwards its argv here instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const code = pairingCodeFromArgv(argv);
    if (code && booted) void pairWithCode(code);
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
  await enableLaunchAtLoginOnFirstRun();

  state = new AppState();
  new TrayController(state, {
    onPair: () => showPairingWindow(handlePaired),
    onUnpair: () => void handleUnpair(),
    onQuit: () => app.quit(),
  });

  discord = new DiscordPresenceManager((connected) => state.setDiscordConnected(connected));
  discord.connect();

  booted = true;
  const code = pendingCode;
  pendingCode = null;

  const token = await loadToken();
  if (code) {
    await pairWithCode(code);
  } else if (token) {
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

/** Installed apps start with the system by default - the point is that it is simply there. The tray toggle turns it off. */
async function enableLaunchAtLoginOnFirstRun(): Promise<void> {
  if (!app.isPackaged) return;
  const marker = path.join(app.getPath("userData"), "first-run-done");
  try {
    await fs.access(marker);
  } catch {
    setLaunchAtLogin(true);
    await fs.writeFile(marker, new Date().toISOString()).catch(() => {});
  }
}

function notify(body: string): void {
  if (Notification.isSupported()) new Notification({ title: "Woope Companion", body }).show();
}

/** Pairing from a woope-companion:// link: same exchange as typing the code into the pairing window. */
async function pairWithCode(code: string): Promise<void> {
  const result = await exchangePairingCode(code, os.hostname());
  if (!result.ok) {
    notify(result.error === "invalid_or_expired_code"
      ? "Párovací odkaz vypršel. Vygeneruj na Woope nový."
      : "Spárování se nepovedlo. Zkus to znovu nebo zadej kód ručně.");
    showPairingWindow(handlePaired);
    return;
  }
  await saveToken(result.token);
  closePairingWindow();
  handlePaired();
  notify("Spárováno! Tvoje aktivita na Woope se teď ukazuje na Discordu.");
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
