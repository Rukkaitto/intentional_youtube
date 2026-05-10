/**
 * Selector abstraction layer.
 * resolve() tries each candidate and returns the first match, or null.
 * This makes the extension resilient to YouTube DOM changes.
 */

export function resolve(
  selectors: string[],
  root: Document | Element = document
): Element | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      // invalid selector from a future YouTube DOM change; skip
    }
  }
  return null;
}

export function resolveAll(
  selectors: string[],
  root: Document | Element = document
): Element[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(root.querySelectorAll(sel));
      if (els.length) return els;
    } catch {
      // skip
    }
  }
  return [];
}

// ─── Specific selector sets ────────────────────────────────────────────────

export const SELECTORS = {
  masthead: [
    "ytd-masthead",
    "#masthead",
    "#masthead-container",
  ],

  primaryContent: [
    "#primary",
    "ytd-watch-flexy #primary",
    "#columns #primary",
  ],

  autoplayToggle: [
    ".ytp-autonav-toggle-button[aria-checked='true']",
    ".ytp-autonav-toggle-button",
    "[data-tooltip-target-id='ytp-autonav-toggle-button']",
  ],

  relatedPanel: [
    "#related",
    "ytd-watch-next-secondary-results-renderer",
    "#secondary-inner ytd-watch-next-secondary-results-renderer",
  ],

  channelAvatar: [
    "#channel-header img#avatar",
    "ytd-channel-page-header-renderer #avatar img",
    "#channel-header-container img.style-scope.yt-img-shadow",
  ],

  channelName: [
    "#channel-header #channel-name",
    "ytd-channel-page-header-renderer yt-formatted-string#text",
    "#inner-header-container #channel-name yt-formatted-string",
  ],

  videoPlayer: ["video.html5-main-video", "#movie_player video"],

  subscriptionsLeftRail: [
    "#guide-section-renderer ytd-guide-subscription-section-renderer",
    "ytd-guide-subscription-section-renderer",
  ],

  channelRenderers: [
    "ytd-channel-renderer",
    "ytd-grid-channel-renderer",
    "ytd-browse-card-renderer",
  ],

  channelId: [
    "meta[itemprop='channelId']",
    "meta[itemprop='identifier']",
    "yt-channel-external-id-renderer",
  ],
} as const;
