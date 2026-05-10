/**
 * WatchPage — imperative DOM cleanups for /watch pages.
 *
 * hide.css already handles most hiding. This module handles runtime
 * behaviours that require JS: disabling autoplay, return-to-feed, etc.
 */

import { resolve, SELECTORS } from "../selectors";
import { DEFAULT_SETTINGS, FEED_URL } from "@shared/constants";
import type { Settings } from "@shared/types";

let videoEndedListener: (() => void) | null = null;
let returnLinkEl: HTMLElement | null = null;
let autoplayCheckInterval: ReturnType<typeof setInterval> | null = null;

async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

/**
 * Disable autoplay toggle if it is currently on.
 * Called once per watch navigation; retried until the player is ready.
 */
function disableAutoplay(): void {
  if (autoplayCheckInterval !== null) {
    clearInterval(autoplayCheckInterval);
  }

  let attempts = 0;
  autoplayCheckInterval = setInterval(() => {
    attempts++;
    if (attempts > 20) {
      clearInterval(autoplayCheckInterval!);
      autoplayCheckInterval = null;
      return;
    }

    const toggle = resolve(Array.from(SELECTORS.autoplayToggle));
    if (!toggle) return;

    clearInterval(autoplayCheckInterval!);
    autoplayCheckInterval = null;

    if (toggle.getAttribute("aria-checked") === "true") {
      (toggle as HTMLElement).click();
    }
  }, 500);
}

/**
 * Inject a small "← Feed" link in the masthead, if returnToFeedAfterVideo is on.
 */
function injectReturnLink(): void {
  if (returnLinkEl) return; // already injected

  const masthead = resolve(Array.from(SELECTORS.masthead));
  if (!masthead) return;

  const link = document.createElement("a");
  link.href = FEED_URL;
  link.textContent = "← Feed";
  link.className = "iy-return-link";
  link.title = "Return to Intentional YouTube feed";
  masthead.prepend(link);
  returnLinkEl = link;
}

function removeReturnLink(): void {
  returnLinkEl?.remove();
  returnLinkEl = null;
}

/**
 * Listen for video end and navigate back to the feed.
 */
function attachVideoEndedListener(): void {
  removeVideoEndedListener();

  const tryAttach = () => {
    const video = resolve(Array.from(SELECTORS.videoPlayer)) as HTMLVideoElement | null;
    if (!video) return;

    videoEndedListener = () => {
      window.location.href = FEED_URL;
    };
    video.addEventListener("ended", videoEndedListener, { once: true });
  };

  // Retry until the player element exists
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    tryAttach();
    const video = resolve(Array.from(SELECTORS.videoPlayer));
    if (video || attempts > 20) clearInterval(interval);
  }, 500);
}

function removeVideoEndedListener(): void {
  if (!videoEndedListener) return;
  const video = resolve(Array.from(SELECTORS.videoPlayer)) as HTMLVideoElement | null;
  video?.removeEventListener("ended", videoEndedListener);
  videoEndedListener = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function mountWatchPage(): Promise<void> {
  disableAutoplay();

  const settings = await getSettings();

  if (settings.returnToFeedAfterVideo) {
    injectReturnLink();
    attachVideoEndedListener();
  }
}

export function unmountWatchPage(): void {
  if (autoplayCheckInterval !== null) {
    clearInterval(autoplayCheckInterval);
    autoplayCheckInterval = null;
  }
  removeVideoEndedListener();
  removeReturnLink();
}
