/**
 * Central config for the companion app. Everything here can be overridden by
 * an environment variable of the same name, for pointing a dev build at a
 * local Woope instance without touching source.
 */

export const WOOPE_API_BASE = process.env.WOOPE_API_BASE?.trim() || "https://woope.eu";

export const WOOPE_WEBSITE_URL = WOOPE_API_BASE;

// TODO Holly: create an application at https://discord.com/developers/applications
// and paste its "Application ID" here (or set DISCORD_CLIENT_ID in the environment).
export const DISCORD_CLIENT_ID =
  process.env.DISCORD_CLIENT_ID?.trim() || "TODO_DOPLNIT_Z_DISCORD_DEVELOPER_PORTALU";

export const DISCORD_CLIENT_ID_CONFIGURED = DISCORD_CLIENT_ID !== "TODO_DOPLNIT_Z_DISCORD_DEVELOPER_PORTALU";

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
