/**
 * Service Worker — entry point.
 * Handles:
 * - chrome.alarms for periodic RSS refresh
 * - Message routing from content scripts
 */

import type { ExtensionMessage, MessageResponse } from "@shared/messages";
import {
  ALARM_RSS_REFRESH,
  RSS_REFRESH_INTERVAL_MIN,
} from "@shared/constants";
import {
  getSubs,
  setSubs,
  getUploadsByChannel,
  setUploadsByChannel,
  getRecs,
  setRecs,
  getSettings,
  getMeta,
  patchMeta,
} from "./storage";
import { refreshAllUploads } from "./rss";
import { computeRecs } from "./recommender";

// ─── Install / startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await setupAlarm();
  await runRssRefresh();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupAlarm();
});

async function setupAlarm(): Promise<void> {
  await chrome.alarms.clear(ALARM_RSS_REFRESH);
  chrome.alarms.create(ALARM_RSS_REFRESH, {
    periodInMinutes: RSS_REFRESH_INTERVAL_MIN,
    delayInMinutes: 1,
  });
}

// ─── Alarm handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_RSS_REFRESH) {
    await runRssRefresh();
  }
});

// ─── RSS refresh pipeline ─────────────────────────────────────────────────────

async function runRssRefresh(): Promise<void> {
  const subs = await getSubs();
  if (subs.length === 0) return;

  const newUploads = await refreshAllUploads(subs);

  // Merge with existing uploads (preserve channels that didn't update)
  const existing = await getUploadsByChannel();
  const merged = { ...existing, ...newUploads };
  await setUploadsByChannel(merged);
  await patchMeta({ lastSubsSyncAt: Date.now() });

  // Recompute recommendations
  const settings = await getSettings();
  const existingRecs = await getRecs();
  const meta = await getMeta();
  const subIds = new Set(subs.map((s) => s.id));

  const { recs, didRecompute } = await computeRecs(
    merged,
    subIds,
    existingRecs,
    meta.lastRecsComputedAt,
    settings.recCount
  );

  if (didRecompute) {
    await setRecs(recs);
    await patchMeta({ lastRecsComputedAt: Date.now() });
  }
}

// ─── Message routing ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    handleMessage(message, sendResponse);
    return true; // keep message channel open for async response
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    switch (message.type) {
      case "BOOTSTRAP_SUBS": {
        const existing = await getSubs();
        // Merge: prefer newly scraped data, keep existing entries not in new list
        const existingById = new Map(existing.map((s) => [s.id, s]));
        for (const sub of message.subs) {
          existingById.set(sub.id, { ...existingById.get(sub.id), ...sub });
        }
        const merged = Array.from(existingById.values());
        await setSubs(merged);
        // Kick off a fresh RSS refresh
        runRssRefresh().catch(() => undefined);
        sendResponse({ ok: true });
        break;
      }

      case "FORCE_RSS_REFRESH": {
        await runRssRefresh();
        sendResponse({ ok: true });
        break;
      }

      case "GET_FEED": {
        // Content script can request feed data directly; we just confirm readiness
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  } catch (err) {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
