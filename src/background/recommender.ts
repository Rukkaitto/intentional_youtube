/**
 * Local channel recommendation heuristic.
 *
 * After each RSS refresh, we scan video descriptions for YouTube channel URLs
 * mentioned by channels the user is already subscribed to.
 * Channels that are frequently mentioned across multiple subscriptions
 * (and that the user doesn't already subscribe to) rise to the top.
 *
 * We cap at MAX_RECS and recompute at most once per REC_TTL_MS.
 */

import type { ChannelRec, VideoItem } from "@shared/types";
import { MAX_RECS, REC_TTL_MS } from "@shared/constants";

// Patterns that appear in YouTube video descriptions
const CHANNEL_ID_RE = /youtube\.com\/channel\/(UC[\w-]{21,22})/g;
const HANDLE_RE = /youtube\.com\/@([\w.-]{2,})/g;
const LEGACY_C_RE = /youtube\.com\/c\/([\w.-]{2,})/g;

export interface MentionCandidate {
  ref: string; // either "UC..." channel ID or "@handle"
  score: number;
}

/**
 * Scan uploads from subscribed channels and tally external channel mentions.
 * Returns sorted candidates (highest score first) that are NOT already in subIds.
 */
export function mineChannelMentions(
  uploadsByChannel: Record<string, VideoItem[]>,
  subIds: Set<string>
): MentionCandidate[] {
  const scores = new Map<string, number>();
  const sourceCounts = new Map<string, Set<string>>(); // ref -> which channels mention it

  for (const [channelId, videos] of Object.entries(uploadsByChannel)) {
    for (const video of videos) {
      const desc = video.description;
      const refsInVideo = new Set<string>();

      let m: RegExpExecArray | null;

      CHANNEL_ID_RE.lastIndex = 0;
      while ((m = CHANNEL_ID_RE.exec(desc)) !== null) {
        refsInVideo.add(m[1]);
      }

      HANDLE_RE.lastIndex = 0;
      while ((m = HANDLE_RE.exec(desc)) !== null) {
        refsInVideo.add(`@${m[1]}`);
      }

      LEGACY_C_RE.lastIndex = 0;
      while ((m = LEGACY_C_RE.exec(desc)) !== null) {
        refsInVideo.add(`@c/${m[1]}`);
      }

      for (const ref of refsInVideo) {
        // Skip self-references
        if (ref === channelId || subIds.has(ref)) continue;
        scores.set(ref, (scores.get(ref) ?? 0) + 1);
        if (!sourceCounts.has(ref)) sourceCounts.set(ref, new Set());
        sourceCounts.get(ref)!.add(channelId);
      }
    }
  }

  // Weight by number of distinct subscribing sources (diversity bonus)
  const candidates: MentionCandidate[] = [];
  for (const [ref, rawScore] of scores.entries()) {
    const sourceCount = sourceCounts.get(ref)?.size ?? 1;
    const score = rawScore * Math.sqrt(sourceCount);
    candidates.push({ ref, score });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Resolve a channel ref (UC id or @handle) to full metadata by fetching
 * the channel page and reading Open Graph / meta tags.
 * Returns null if resolution fails.
 */
export async function resolveChannelRef(
  ref: string
): Promise<Omit<ChannelRec, "mentionScore" | "resolvedAt"> | null> {
  let url: string;
  if (ref.startsWith("UC")) {
    url = `https://www.youtube.com/channel/${ref}`;
  } else if (ref.startsWith("@c/")) {
    url = `https://www.youtube.com/c/${ref.slice(3)}`;
  } else if (ref.startsWith("@")) {
    url = `https://www.youtube.com/${ref}`;
  } else {
    return null;
  }

  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const html = await res.text();

    const channelId =
      extractMeta(html, 'meta itemprop="channelId"') ||
      extractMeta(html, 'meta itemprop="identifier"') ||
      (ref.startsWith("UC") ? ref : null);

    if (!channelId) return null;

    const name =
      extractMeta(html, 'meta property="og:title"') ||
      extractMeta(html, 'meta name="title"') ||
      channelId;

    const avatarUrl =
      extractMeta(html, 'meta property="og:image"') ?? undefined;

    const description =
      extractMeta(html, 'meta property="og:description"') ||
      extractMeta(html, 'meta name="description"') ||
      undefined;

    const handleMatch = html.match(/"canonicalBaseUrl":"\/(@[\w.-]+)"/);
    const handle = handleMatch ? handleMatch[1].slice(1) : undefined;

    return { id: channelId, name, handle, avatarUrl, description };
  } catch {
    return null;
  }
}

function extractMeta(html: string, selector: string): string | null {
  // We can't use DOMParser in a service worker, so use regex
  const attrMap: Record<string, string> = {};
  const parts = selector.split(" ");
  for (const part of parts.slice(1)) {
    const [k, v] = part.split("=");
    if (k && v) attrMap[k] = v.replace(/"/g, "");
  }

  const tag = parts[0];
  const attrPattern = Object.entries(attrMap)
    .map(([k, v]) => `${k}="${v}"`)
    .join("[^>]*");

  const re = new RegExp(`<${tag}[^>]*${attrPattern}[^>]*content="([^"]*)"`, "i");
  const altRe = new RegExp(`<${tag}[^>]*content="([^"]*)"[^>]*${attrPattern}`, "i");

  const m = html.match(re) ?? html.match(altRe);
  return m ? decodeHTMLEntities(m[1]) : null;
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Full recommendation recompute. Called by the service worker after RSS refresh.
 * Returns updated recs list (may be empty if not enough data yet).
 */
export async function computeRecs(
  uploadsByChannel: Record<string, VideoItem[]>,
  subIds: Set<string>,
  existingRecs: ChannelRec[],
  lastComputedAt: number | undefined,
  recCount: number
): Promise<{ recs: ChannelRec[]; didRecompute: boolean }> {
  const now = Date.now();

  // Throttle recomputation
  if (lastComputedAt && now - lastComputedAt < REC_TTL_MS) {
    return { recs: existingRecs, didRecompute: false };
  }

  const candidates = mineChannelMentions(uploadsByChannel, subIds);
  const topCandidates = candidates.slice(0, Math.min(recCount * 3, 15)); // resolve extra as fallback

  // Re-use already-resolved recs to avoid unnecessary fetches
  const resolvedById = new Map<string, ChannelRec>(
    existingRecs.map((r) => [r.id, r])
  );

  const resolved: ChannelRec[] = [];
  for (const candidate of topCandidates) {
    if (resolved.length >= Math.min(recCount, MAX_RECS)) break;

    // Check if we already have a resolved version with matching ref
    const cached = existingRecs.find(
      (r) => r.id === candidate.ref || `@${r.handle}` === candidate.ref
    );
    if (cached && now - cached.resolvedAt < REC_TTL_MS * 7) {
      resolved.push({ ...cached, mentionScore: candidate.score });
      continue;
    }

    const meta = await resolveChannelRef(candidate.ref);
    if (!meta) continue;
    if (subIds.has(meta.id)) continue;
    if (resolvedById.has(meta.id)) {
      resolved.push({ ...resolvedById.get(meta.id)!, mentionScore: candidate.score });
      continue;
    }

    resolved.push({
      ...meta,
      mentionScore: candidate.score,
      resolvedAt: now,
    });
  }

  return { recs: resolved, didRecompute: true };
}
