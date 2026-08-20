import { Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type { AppState, ConnectionStatus } from "./state";
import { isLaunchAtLoginEnabled, setLaunchAtLogin } from "./auto-launch";

const ICONS_DIR = path.join(__dirname, "..", "..", "assets", "tray");

const ICON_FILE_BY_STATUS: Record<ConnectionStatus, string> = {
  connected: "tray-connected.png",
  idle: "tray-idle.png",
  disconnected: "tray-disconnected.png",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "● Připojeno",
  idle: "◐ Idle",
  disconnected: "○ Nepřipojeno",
};

export type TrayHandlers = {
  onPair: () => void;
  onUnpair: () => void;
  onQuit: () => void;
};

export class TrayController {
  private readonly tray: Tray;

  constructor(
    private readonly state: AppState,
    private readonly handlers: TrayHandlers,
  ) {
    this.tray = new Tray(this.iconForStatus("disconnected"));
    this.tray.setToolTip("Woope Companion");
    this.state.on("change", () => this.render());
    this.render();
  }

  private iconForStatus(status: ConnectionStatus) {
    const image = nativeImage.createFromPath(path.join(ICONS_DIR, ICON_FILE_BY_STATUS[status]));
    return image.isEmpty() ? nativeImage.createEmpty() : image;
  }

  private render(): void {
    const status = this.state.status;
    this.tray.setImage(this.iconForStatus(status));

    const menu = Menu.buildFromTemplate([
      { label: STATUS_LABEL[status], enabled: false },
      { type: "separator" },
      this.state.isPaired
        ? { label: "Odpojit zařízení", click: () => this.handlers.onUnpair() }
        : { label: "Zadat párovací kód...", click: () => this.handlers.onPair() },
      { type: "separator" },
      {
        label: "Spouštět při startu systému",
        type: "checkbox",
        checked: isLaunchAtLoginEnabled(),
        click: (item) => setLaunchAtLogin(item.checked),
      },
      { type: "separator" },
      { label: "Ukončit", click: () => this.handlers.onQuit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray.destroy();
  }
}
