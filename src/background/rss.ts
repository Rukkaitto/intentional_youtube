/**
 * RSS feed fetching and parsing for YouTube channel uploads.
 *
 * YouTube exposes a public Atom feed per channel:
 *   https://www.youtube.com/feeds/videos.xml?channel_id=<UCxxx>
 * No API key required.
 */

import { XMLParser } from "fast-xml-parser";
import type { Subscription, VideoItem } from "@shared/types";
import {
  RSS_FEED_URL,
  MAX_VIDEOS_PER_CHANNEL,
} from "@shared/constants";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "entry",
});

interface RssEntry {
  "yt:videoId"?: string;
  "yt:channelId"?: string;
  title?: string;
  published?: string;
  "media:group"?: {
    "media:title"?: string;
    "media:description"?: string;
    "media:thumbnail"?: { "@_url"?: string };
    "media:content"?: { "@_url"?: string };
  };
  link?: { "@_href"?: string } | Array<{ "@_href"?: string }>;
  author?: { name?: string; uri?: string };
}

export async function fetchChannelUploads(
  sub: Subscription
): Promise<VideoItem[]> {
  if (!sub.id.startsWith("UC")) return []; // handle-only stub; can't fetch RSS yet

  const url = RSS_FEED_URL(sub.id);
  let xml: string;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  try {
    const parsed = parser.parse(xml) as {
      feed?: { entry?: RssEntry[] };
    };

    const entries = parsed.feed?.entry ?? [];
    const items: VideoItem[] = [];

    for (const entry of entries.slice(0, MAX_VIDEOS_PER_CHANNEL)) {
      const videoId = entry["yt:videoId"];
      if (!videoId) continue;

      const mediaGroup = entry["media:group"];
      const thumbnailUrl =
        mediaGroup?.["media:thumbnail"]?.["@_url"] ??
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

      const linkHref = Array.isArray(entry.link)
        ? entry.link[0]?.["@_href"]
        : entry.link?.["@_href"];

      const publishedStr = entry.published;
      const publishedAt = publishedStr
        ? new Date(publishedStr).getTime()
        : Date.now();

      items.push({
        id: videoId,
        channelId: sub.id,
        channelName: sub.name,
        title:
          mediaGroup?.["media:title"] ?? entry.title ?? "(untitled)",
        publishedAt,
        thumbnailUrl,
        url: linkHref ?? `https://www.youtube.com/watch?v=${videoId}`,
        description: mediaGroup?.["media:description"] ?? "",
      });
    }

    return items;
  } catch {
    return [];
  }
}

export async function refreshAllUploads(
  subs: Subscription[]
): Promise<Record<string, VideoItem[]>> {
  const result: Record<string, VideoItem[]> = {};

  // Fetch in small parallel batches to avoid rate-limiting
  const BATCH = 5;
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((sub) => fetchChannelUploads(sub))
    );
    settled.forEach((res, idx) => {
      const sub = batch[idx];
      if (sub && res.status === "fulfilled" && res.value.length > 0) {
        result[sub.id] = res.value;
      }
    });
  }

  return result;
}
