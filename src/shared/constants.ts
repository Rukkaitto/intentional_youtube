export const DEFAULT_SETTINGS = {
  feedSize: 20,
  recCount: 3,
  blockShorts: true,
  frictionPrompt: true,
  returnToFeedAfterVideo: false,
} as const;

export const RSS_FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

export const CHANNEL_URL = (channelId: string) =>
  `https://www.youtube.com/channel/${channelId}`;

export const HANDLE_URL = (handle: string) =>
  `https://www.youtube.com/@${handle}`;

export const FEED_URL = "https://www.youtube.com/feed/subscriptions";

/** Maximum videos stored per channel in uploadsByChannel */
export const MAX_VIDEOS_PER_CHANNEL = 10;

/** Maximum recommended channels stored */
export const MAX_RECS = 5;

/** Minimum ms between rec recomputes (24 h) */
export const REC_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum ms between full RSS refresh cycles (30 min) */
export const RSS_REFRESH_INTERVAL_MIN = 30;

/** How long (ms) a session friction-prompt dismissal is remembered */
export const FRICTION_SESSION_KEY = "iy_friction_dismissed";

export const ALARM_RSS_REFRESH = "iy_rss_refresh";
