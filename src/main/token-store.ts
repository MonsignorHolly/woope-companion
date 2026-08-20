import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Companion token persistence. Deliberately NOT electron-store: the token is
 * a bearer credential, so it goes through Electron's `safeStorage` (backed by
 * the OS keychain / DPAPI / libsecret) and the resulting ciphertext is
 * written to userData ourselves - no plaintext ever touches disk.
 */

const TOKEN_FILE_NAME = "token.enc";

function tokenFilePath(): string {
  return path.join(app.getPath("userData"), TOKEN_FILE_NAME);
}

export async function saveToken(token: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS-level secret encryption is not available on this machine.");
  }
  const encrypted = safeStorage.encryptString(token);
  await fs.writeFile(tokenFilePath(), encrypted);
}

export async function loadToken(): Promise<string | null> {
  let encrypted: Buffer;
  try {
    encrypted = await fs.readFile(tokenFilePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    console.error("Failed to read stored companion token:", error);
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.error("Stored companion token found, but OS-level decryption is unavailable.");
    return null;
  }

  try {
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    console.error("Failed to decrypt stored companion token:", error);
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(tokenFilePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to remove stored companion token:", error);
    }
  }
}
