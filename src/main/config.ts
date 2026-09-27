/**
 * Central config for the companion app. Everything here can be overridden by
 * an environment variable of the same name, for pointing a dev build at a
 * local Woope instance without touching source.
 */

export const WOOPE_API_BASE = process.env.WOOPE_API_BASE?.trim() || "https://woope.eu";

export const WOOPE_WEBSITE_URL = WOOPE_API_BASE;

// The Discord application ID is served by Woope itself (GET
// /api/companion/config, from the DISCORD_CLIENT_ID env var on Vercel), so a
// released installer never has to be rebuilt to set or change it. The env
// var here only overrides it for local development.
export const DISCORD_CLIENT_ID_OVERRIDE = process.env.DISCORD_CLIENT_ID?.trim() || null;

const SNOWFLAKE = /^\d{17,20}$/;

/** Resolves the Discord application ID: the dev override, else Woope's config endpoint. Null when neither has one. */
export async function resolveDiscordClientId(): Promise<string | null> {
  if (DISCORD_CLIENT_ID_OVERRIDE) return DISCORD_CLIENT_ID_OVERRIDE;
  try {
    const response = await fetch(`${WOOPE_API_BASE}/api/companion/config`);
    if (!response.ok) return null;
    const json = (await response.json()) as { discordClientId?: unknown };
    return typeof json.discordClientId === "string" && SNOWFLAKE.test(json.discordClientId) ? json.discordClientId : null;
  } catch (error) {
    console.error("Failed to load the companion config:", error);
    return null;
  }
}

/** Custom URL scheme the installer registers: woope-companion://pair?code=123456 pairs in one click from the website. */
export const PROTOCOL_SCHEME = "woope-companion";

/** How often the companion polls GET /api/companion/presence. */
export const POLL_INTERVAL_MS = 15_000;

/** How long to wait before retrying a dropped/failed Discord IPC connection. */
export const DISCORD_RECONNECT_INTERVAL_MS = 10_000;

/** Consecutive failed presence polls before the tray reports "Nepřipojeno". */
export const PRESENCE_FAILURE_THRESHOLD = 3;

/**
 * Rich Presence asset keys, as uploaded under the Discord application's
 * Rich Presence -> Art Assets tab. Keep these names in sync with README.md.
 */
export const ASSET_KEYS = {
  largeImage: "woope_logo",
  smallImageByActivity: {
    community: "icon_community",
    blog: "icon_blog",
    messages: "icon_messages",
    roleplay: "icon_roleplay",
  },
  /** Not currently used for a live payload (idle clears the activity entirely) - kept reserved for future use. */
  idle: "icon_idle",
} as const;
