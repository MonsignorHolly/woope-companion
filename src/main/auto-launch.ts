import { app } from "electron";

/**
 * "Spouštět při startu systému" - Electron's built-in login-item API rather
 * than the third-party `auto-launch` package. On Windows (our primary
 * target) this writes/removes the installed app's Run-key entry directly, no
 * extra native dependency needed. In dev (`electron .`) it points at the
 * Electron binary itself, which is harmless but not meaningful until the app
 * is installed via the NSIS build.
 */

export function isLaunchAtLoginEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

export function setLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
}
