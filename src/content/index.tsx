/**
 * Content script entry — injected into every YouTube page.
 *
 * 1. Initialises the SPA router.
 * 2. On "home" or "subs" routes: mounts the React FeedPage.
 * 3. On "watch" routes: runs WatchPage imperative cleanups.
 * 4. On "shorts" routes: optionally shows the block screen.
 * 5. On first load, triggers subscription bootstrap if subs are empty.
 */

import { createRoot, type Root } from "react-dom/client";
import "./feed.css";
import { initRouter } from "./router";
import { bootstrapSubscriptions } from "./bootstrap-subs";
import { mountWatchPage, unmountWatchPage } from "./pages/WatchPage";
import { mountShortsBlock, unmountShortsBlock } from "./pages/ShortsPage";
import { FeedPage } from "./pages/FeedPage";
import type { RouteType, Settings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/constants";
import type { BootstrapSubsMessage } from "@shared/messages";

// ─── Feed mount point ─────────────────────────────────────────────────────────

let feedRoot: Root | null = null;
let feedContainer: HTMLDivElement | null = null;

function mountFeed() {
  if (feedContainer) {
    // Already mounted — nothing to do (storage listener handles updates)
    return;
  }

  const container = document.createElement("div");
  container.id = "iy-root";
  document.body.appendChild(container);
  feedContainer = container;

  feedRoot = createRoot(container);
  feedRoot.render(<FeedPage />);
}

function unmountFeed() {
  feedRoot?.unmount();
  feedRoot = null;
  feedContainer?.remove();
  feedContainer = null;
}

// ─── Settings loader ──────────────────────────────────────────────────────────

async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

// ─── Per-route handler ────────────────────────────────────────────────────────

let prevRoute: RouteType = "other";

async function handleRoute(route: RouteType) {
  // Teardown previous route
  if (prevRoute === "watch") unmountWatchPage();
  if (prevRoute === "shorts") unmountShortsBlock();
  if (prevRoute === "home" || prevRoute === "subs") {
    if (route !== "home" && route !== "subs") unmountFeed();
  }

  prevRoute = route;

  switch (route) {
    case "home":
    case "subs":
      mountFeed();
      break;

    case "watch":
      unmountFeed();
      await mountWatchPage();
      break;

    case "shorts": {
      const settings = await getSettings();
      if (settings.blockShorts) {
        mountShortsBlock();
      }
      break;
    }

    default:
      unmountFeed();
      break;
  }
}

// ─── Subscription bootstrap ───────────────────────────────────────────────────

async function maybeBootstrapSubs() {
  const { subs } = await chrome.storage.local.get("subs");
  const existing = (subs as Array<unknown> | undefined) ?? [];
  if (existing.length > 0) return; // already have subs

  const scraped = await bootstrapSubscriptions();
  if (scraped.length === 0) return;

  const message: BootstrapSubsMessage = { type: "BOOTSTRAP_SUBS", subs: scraped };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // Service worker may not be ready yet; that's OK, we'll retry next load
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Run sub bootstrap once per page load (async; doesn't block UI)
maybeBootstrapSubs();

// Start the router — this fires handleRoute immediately for the current URL
initRouter((route) => {
  handleRoute(route).catch(() => undefined);
});
