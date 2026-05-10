/**
 * One-time (or on-demand) subscription scraper.
 *
 * Strategy:
 * 1. Try to read channel renderers from /feed/channels (YouTube's "Manage subscriptions" page).
 *    We fetch the page as text, parse the JSON payload embedded in the HTML, and extract
 *    channelId, name, handle, and avatar from the `ytInitialData` object.
 * 2. If that yields nothing, fall back to the left-rail guide subscription section
 *    which is already present in the current DOM.
 */

import type { Subscription } from "@shared/types";

// ─── Strategy 1: ytInitialData from /feed/channels ───────────────────────────

async function scrapeFromFeedChannels(): Promise<Subscription[]> {
  try {
    const res = await fetch("https://www.youtube.com/feed/channels", {
      credentials: "include",
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseYtInitialData(html);
  } catch {
    return [];
  }
}

function parseYtInitialData(html: string): Subscription[] {
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) return [];

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const subs: Subscription[] = [];
  collectChannelItems(data, subs);
  return subs;
}

function collectChannelItems(node: unknown, out: Subscription[]): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectChannelItems(item, out);
    return;
  }

  const obj = node as Record<string, unknown>;

  // channelRenderer appears in /feed/channels ytInitialData
  if ("channelRenderer" in obj) {
    const cr = obj.channelRenderer as Record<string, unknown>;
    const id = cr.channelId as string | undefined;
    if (id) {
      const name = extractText(cr.title) ?? id;
      const handle = extractHandle(cr);
      const avatarUrl = extractThumbnail(cr.thumbnail);
      out.push({ id, name, handle, avatarUrl });
    }
    return;
  }

  // gridChannelRenderer also appears
  if ("gridChannelRenderer" in obj) {
    const cr = obj.gridChannelRenderer as Record<string, unknown>;
    const id = cr.channelId as string | undefined;
    if (id) {
      const name = extractText(cr.title) ?? id;
      const handle = extractHandle(cr);
      const avatarUrl = extractThumbnail(cr.thumbnail);
      out.push({ id, name, handle, avatarUrl });
    }
    return;
  }

  for (const val of Object.values(obj)) {
    collectChannelItems(val, out);
  }
}

function extractText(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const obj = node as Record<string, unknown>;
  if (typeof obj.simpleText === "string") return obj.simpleText;
  if (Array.isArray(obj.runs)) {
    return (obj.runs as Array<{ text?: string }>)
      .map((r) => r.text ?? "")
      .join("");
  }
  return undefined;
}

function extractHandle(cr: Record<string, unknown>): string | undefined {
  // Try navigationEndpoint -> commandMetadata -> webCommandMetadata -> url
  const ne = cr.navigationEndpoint as Record<string, unknown> | undefined;
  const url: string | undefined =
    (
      (ne?.commandMetadata as Record<string, unknown> | undefined)
        ?.webCommandMetadata as Record<string, unknown> | undefined
    )?.url as string | undefined ?? undefined;
  if (url?.startsWith("/@")) return url.slice(2);
  if (typeof cr.canonicalBaseUrl === "string" && cr.canonicalBaseUrl.startsWith("/@"))
    return cr.canonicalBaseUrl.slice(2);
  return undefined;
}

function extractThumbnail(thumbnail: unknown): string | undefined {
  if (!thumbnail || typeof thumbnail !== "object") return undefined;
  const obj = thumbnail as Record<string, unknown>;
  const thumbnails = obj.thumbnails as Array<{ url?: string }> | undefined;
  if (!thumbnails?.length) return undefined;
  // pick the highest-resolution one
  const last = thumbnails[thumbnails.length - 1];
  return last?.url ?? undefined;
}

// ─── Strategy 2: DOM guide sidebar ───────────────────────────────────────────

function scrapeFromGuideSidebar(): Subscription[] {
  const subs: Subscription[] = [];
  const items = document.querySelectorAll(
    "ytd-guide-subscription-section-renderer ytd-guide-entry-renderer"
  );
  items.forEach((item) => {
    const a = item.querySelector("a");
    const href = a?.getAttribute("href") ?? "";
    // href is usually /@handle or /channel/UCxxx
    let id: string | undefined;
    let handle: string | undefined;
    if (href.startsWith("/channel/")) {
      id = href.replace("/channel/", "");
    } else if (href.startsWith("/@")) {
      handle = href.slice(2);
    }
    if (!id && !handle) return;

    const name =
      item.querySelector("yt-formatted-string#title")?.textContent?.trim() ??
      handle ??
      id ??
      "";
    const avatarUrl =
      (item.querySelector("img") as HTMLImageElement | null)?.src ?? undefined;

    subs.push({
      id: id ?? `handle:${handle}`,
      name,
      handle,
      avatarUrl,
    });
  });
  return subs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function bootstrapSubscriptions(): Promise<Subscription[]> {
  let subs = await scrapeFromFeedChannels();

  if (subs.length === 0) {
    subs = scrapeFromGuideSidebar();
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return subs.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}
