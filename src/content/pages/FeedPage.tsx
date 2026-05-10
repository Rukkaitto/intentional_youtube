import { useEffect, useState, useCallback } from "react";
import type { VideoItem, ChannelRec, Settings } from "@shared/types";
import { DEFAULT_SETTINGS, FEED_URL } from "@shared/constants";
import { Section } from "../components/Section";
import { VideoCard } from "../components/VideoCard";
import { ChannelCard } from "../components/ChannelCard";
import { EndOfFeed } from "../components/EndOfFeed";

// ─── Storage helpers (content-script side; no import from background) ─────────

async function getStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function loadFeedData(): Promise<{
  videos: VideoItem[];
  recs: ChannelRec[];
  settings: Settings;
  subIds: Set<string>;
}> {
  const [uploadsByChannel, recs, settings, subs] = await Promise.all([
    getStorage<Record<string, VideoItem[]>>("uploadsByChannel", {}),
    getStorage<ChannelRec[]>("recs", []),
    getStorage<Partial<Settings>>("settings", {}),
    getStorage<Array<{ id: string }>>("subs", []),
  ]);

  const mergedSettings: Settings = { ...DEFAULT_SETTINGS, ...settings };
  const subIds = new Set(subs.map((s) => s.id));

  // Flatten, sort by date, cap
  const allVideos: VideoItem[] = Object.values(uploadsByChannel).flat();
  allVideos.sort((a, b) => b.publishedAt - a.publishedAt);
  const videos = allVideos.slice(0, mergedSettings.feedSize);

  return { videos, recs: recs.slice(0, mergedSettings.recCount), settings: mergedSettings, subIds };
}

// ─── Friction prompt ──────────────────────────────────────────────────────────

let frictionSeenThisSession = false;

function FrictionBanner({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className="iy-friction" role="status" aria-live="polite">
      <span className="iy-friction__msg">
        This video is outside your subscriptions.
      </span>
      <button className="iy-friction__dismiss" onClick={onDismiss}>
        Continue anyway
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FeedState = "loading" | "ready" | "empty" | "signed-out";

export function FeedPage() {
  const [state, setState] = useState<FeedState>("loading");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [recs, setRecs] = useState<ChannelRec[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [subIds, setSubIds] = useState<Set<string>>(new Set());
  const [frictionVisible, setFrictionVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const data = await loadFeedData();
    setVideos(data.videos);
    setRecs(data.recs);
    setSettings(data.settings);
    setSubIds(data.subIds);

    if (data.subIds.size === 0) {
      setState("signed-out");
    } else if (data.videos.length === 0) {
      setState("empty");
    } else {
      setState("ready");
    }
  }, []);

  useEffect(() => {
    load();

    // Re-load when storage changes (e.g. RSS refresh completes in background)
    const listener = () => load();
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [load]);

  function handleOutsideSubsClick(_videoId: string) {
    if (!settings.frictionPrompt) return;
    if (frictionSeenThisSession) return;
    frictionSeenThisSession = true;
    setFrictionVisible(true);
    setTimeout(() => setFrictionVisible(false), 8000);
  }

  async function handleResync() {
    setSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: "FORCE_RSS_REFRESH" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="iy-feed" id="iy-feed-root">
      {frictionVisible && (
        <FrictionBanner onDismiss={() => setFrictionVisible(false)} />
      )}

      <header className="iy-feed__header">
        <h1 className="iy-feed__wordmark">Intentional YouTube</h1>
        <button
          className="iy-feed__resync"
          onClick={handleResync}
          disabled={syncing}
          title="Refresh subscription feed"
        >
          {syncing ? "Refreshing…" : "↺"}
        </button>
      </header>

      {state === "loading" && (
        <div className="iy-state iy-state--loading">
          <div className="iy-spinner" aria-label="Loading…" />
        </div>
      )}

      {state === "signed-out" && (
        <div className="iy-state iy-state--empty">
          <p>Sign in to YouTube so your subscriptions can be loaded.</p>
          <a
            className="iy-btn"
            href="https://accounts.google.com/ServiceLogin?service=youtube"
          >
            Sign in
          </a>
        </div>
      )}

      {state === "empty" && (
        <div className="iy-state iy-state--empty">
          <p>No uploads found yet.</p>
          <button className="iy-btn" onClick={handleResync} disabled={syncing}>
            {syncing ? "Refreshing…" : "Refresh now"}
          </button>
          <p className="iy-hint">
            Make sure you have subscriptions on{" "}
            <a href={FEED_URL}>YouTube</a>.
          </p>
        </div>
      )}

      {state === "ready" && (
        <>
          <Section title="From your subscriptions">
            <div className="iy-video-grid">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isSubscribed={subIds.has(video.channelId)}
                  onClickOutsideSubs={handleOutsideSubsClick}
                />
              ))}
            </div>
          </Section>

          {recs.length > 0 && (
            <Section title="Discover new creators" className="iy-section--recs">
              <div className="iy-channel-list">
                {recs.map((rec) => (
                  <ChannelCard key={rec.id} channel={rec} />
                ))}
              </div>
            </Section>
          )}

          <EndOfFeed />
        </>
      )}
    </div>
  );
}
