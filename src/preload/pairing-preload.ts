import { contextBridge, ipcRenderer } from "electron";
import type { ExchangeResult } from "../main/api-client";

const api = {
  submitPairingCode: (code: string): Promise<ExchangeResult> => ipcRenderer.invoke("pairing:submit", code),
};

export type PairingBridge = typeof api;

contextBridge.exposeInMainWorld("woope", api);
