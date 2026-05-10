# Intentional YouTube

A Chrome extension that transforms YouTube from an infinite engagement feed into a finite, subscription-first viewing experience.

## What it does

- **Replaces the Home feed** with a finite, chronological list of uploads from your subscriptions (fetched via YouTube's public RSS feeds — no API key required).
- **Removes infinite recommendation surfaces**: Up Next sidebar, end-screen suggestions, and autoplay are all disabled.
- **Hides Shorts** throughout the UI (toggle in settings).
- **Suggests channels, not videos**: a small curated set of channel recommendations is derived locally from mentions in your subscriptions' video descriptions.
- **Gentle friction prompt**: an optional subtle reminder when you navigate to a video outside your subscriptions.

The tone is calm and non-judgmental. There are no timers, no guilt messages, no hard lockouts.

---

## Install (development)

### Prerequisites

- Node.js >= 18
- npm (comes with Node.js) or pnpm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build
# Output: dist/

# 3. Load as unpacked extension in Chrome
#    Open chrome://extensions
#    Enable "Developer mode" (top-right toggle)
#    Click "Load unpacked"
#    Select the dist/ folder
```

### Development (watch mode)

```bash
npm run dev
# Vite rebuilds on file changes.
# Reload the extension in chrome://extensions after each build
# (or use the CRXJS HMR support — see CRXJS docs).
```

---

## First use

1. Sign in to YouTube in Chrome.
2. Open [youtube.com](https://www.youtube.com) — you should see the custom feed instead of the default home.
3. The extension automatically scrapes your subscription list on first load and fetches their RSS feeds.
4. If no videos appear, click the **↺** refresh button in the feed header, or use the popup's "Refresh subscriptions now" button.

---

## Architecture

```
src/
  background/       Service worker: RSS fetching, recommendation engine, storage
    index.ts        Alarm setup, message router
    rss.ts          Per-channel YouTube RSS feed fetching + parsing
    recommender.ts  Local heuristic: mines channel mentions from video descriptions
    storage.ts      Typed chrome.storage.local wrappers
  content/          Injected into youtube.com pages
    index.tsx       Orchestrator: router init, React mounts, subscription bootstrap
    router.ts       SPA navigation observer (yt-navigate-finish + fallbacks)
    selectors.ts    Selector abstraction with fallbacks for YouTube DOM changes
    hide.css        Injected at document_start — hides native feeds & recs
    feed.css        Custom feed UI styles
    bootstrap-subs.ts  One-time subscription list scraper (/feed/channels)
    pages/
      FeedPage.tsx  Custom subscriptions + discovery feed
      WatchPage.ts  Autoplay disable, return-to-feed
      ShortsPage.tsx  Calm Shorts block screen
    components/
      VideoCard.tsx, ChannelCard.tsx, EndOfFeed.tsx, Section.tsx
  popup/            Extension popup (settings)
  shared/           Types, constants, message protocol (shared by all entry points)
```

### Data flow

1. **Bootstrap**: on first load, `bootstrap-subs.ts` fetches `/feed/channels`, parses `ytInitialData` for channel IDs, and sends them to the service worker via `BOOTSTRAP_SUBS`.
2. **RSS refresh**: the service worker fetches each channel's public Atom feed (`youtube.com/feeds/videos.xml?channel_id=...`) every 30 minutes via `chrome.alarms`, storing the latest 10 uploads per channel in `chrome.storage.local`.
3. **Recommendations**: after each RSS refresh, `recommender.ts` scans video descriptions for mentioned YouTube channel URLs, tallies cross-subscription mentions, resolves top candidates' metadata, and persists up to 5 recommendations (refreshed at most once every 24 hours).
4. **Feed UI**: `FeedPage` reads from `chrome.storage.local` and re-renders when storage changes.

### Resilience

- `selectors.ts` provides primary + fallback CSS selectors for every YouTube DOM target.
- `hide.css` uses attribute selectors (`[page-subtype="home"]`) that are stable across YouTube redesigns.
- The SPA router listens for `yt-navigate-finish` (YouTube's internal event) with `popstate` + title `MutationObserver` as fallbacks.

---

## Settings

Open the extension popup to configure:

| Setting | Default | Description |
|---|---|---|
| Videos in feed | 20 | How many subscription uploads to show |
| Channel suggestions | 3 | Max recommended channels per session (0 = off) |
| Block Shorts | On | Replace Shorts pages with a calm screen |
| Friction prompt | On | Gentle reminder when opening non-subscribed videos |
| Return to feed after video | Off | Auto-navigate back to the feed when a video ends |

---

## Limitations / known issues

- **Sign-in required**: the extension can only read subscriptions when you are signed in to YouTube in Chrome.
- **RSS delay**: YouTube's public RSS feeds may lag 15–30 minutes behind the actual upload time.
- **Handle-only subs**: channels discovered only by `@handle` (no `UCxxx` ID) cannot be fetched via RSS until their ID is resolved. The guide sidebar scraper captures IDs for most channels.
- **Recommendation cold start**: channel recommendations require a few RSS refresh cycles to accumulate description data.
- **YouTube DOM changes**: YouTube updates its DOM frequently. The selector abstraction layer reduces breakage, but some surfaces may stop hiding until selectors are updated.

---

## Future ideas

- Weekly creator discovery (surface 1–2 new channels per week only)
- Topic exploration mode
- Firefox support
- Soft daily session suggestions (no hard limits)
