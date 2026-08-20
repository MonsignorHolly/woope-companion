import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import os from "node:os";
import { exchangePairingCode, type ExchangeResult } from "./api-client";
import { saveToken } from "./token-store";

let pairingWindow: BrowserWindow | null = null;

/** Opens the pairing window, or focuses it if already open. No-op-safe to call repeatedly. */
export function showPairingWindow(onPaired: () => void): void {
  if (pairingWindow) {
    pairingWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 380,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    title: "Woope Companion",
    backgroundColor: "#1e1f26",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "pairing-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pairingWindow = win;

  ipcMain.handle("pairing:submit", async (_event, code: string): Promise<ExchangeResult> => {
    const result = await exchangePairingCode(code, os.hostname());
    if (result.ok) {
      await saveToken(result.token);
      win.close();
      onPaired();
    }
    return result;
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    ipcMain.removeHandler("pairing:submit");
    pairingWindow = null;
  });

  void win.loadFile(path.join(__dirname, "..", "renderer", "pairing", "index.html"));
}

export function closePairingWindow(): void {
  pairingWindow?.close();
}
