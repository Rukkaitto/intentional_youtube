import type { Subscription } from "./types";

export type MessageType =
  | "BOOTSTRAP_SUBS"
  | "FORCE_RSS_REFRESH"
  | "GET_FEED"
  | "FEED_READY";

export interface BootstrapSubsMessage {
  type: "BOOTSTRAP_SUBS";
  subs: Subscription[];
}

export interface ForceRssRefreshMessage {
  type: "FORCE_RSS_REFRESH";
}

export interface GetFeedMessage {
  type: "GET_FEED";
}

export type ExtensionMessage =
  | BootstrapSubsMessage
  | ForceRssRefreshMessage
  | GetFeedMessage;

export type MessageResponse = { ok: true } | { ok: false; error: string };
