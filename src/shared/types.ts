export interface Subscription {
  id: string; // UCxxxx channel ID
  name: string;
  handle?: string; // @handle without leading @
  avatarUrl?: string;
  lastFetched?: number; // epoch ms of last RSS fetch
}

export interface VideoItem {
  id: string; // video ID (yt:videoId)
  channelId: string;
  channelName: string;
  title: string;
  publishedAt: number; // epoch ms
  thumbnailUrl: string;
  url: string;
  description: string; // raw, used for rec mining
}

export interface ChannelRec {
  id: string; // channel ID
  name: string;
  handle?: string;
  avatarUrl?: string;
  description?: string;
  topicChip?: string;
  mentionScore: number;
  resolvedAt: number; // epoch ms
}

export interface Settings {
  feedSize: number; // default 20
  recCount: number; // default 3, max 5
  blockShorts: boolean;
  frictionPrompt: boolean;
  returnToFeedAfterVideo: boolean;
}

export type StorageKey =
  | "subs"
  | "uploadsByChannel"
  | "recs"
  | "settings"
  | "meta";

export interface StorageMeta {
  lastSubsSyncAt?: number;
  lastRecsComputedAt?: number;
}

export type RouteType = "home" | "subs" | "watch" | "shorts" | "other";
