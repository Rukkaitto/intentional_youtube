import type {
  Subscription,
  VideoItem,
  ChannelRec,
  Settings,
  StorageMeta,
} from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/constants";

// ─── Subs ────────────────────────────────────────────────────────────────────

export async function getSubs(): Promise<Subscription[]> {
  const { subs } = await chrome.storage.local.get("subs");
  return (subs as Subscription[] | undefined) ?? [];
}

export async function setSubs(subs: Subscription[]): Promise<void> {
  await chrome.storage.local.set({ subs });
}

// ─── Uploads by channel ──────────────────────────────────────────────────────

export async function getUploadsByChannel(): Promise<
  Record<string, VideoItem[]>
> {
  const { uploadsByChannel } = await chrome.storage.local.get(
    "uploadsByChannel"
  );
  return (uploadsByChannel as Record<string, VideoItem[]> | undefined) ?? {};
}

export async function setUploadsByChannel(
  uploads: Record<string, VideoItem[]>
): Promise<void> {
  await chrome.storage.local.set({ uploadsByChannel: uploads });
}

// ─── Recs ────────────────────────────────────────────────────────────────────

export async function getRecs(): Promise<ChannelRec[]> {
  const { recs } = await chrome.storage.local.get("recs");
  return (recs as ChannelRec[] | undefined) ?? [];
}

export async function setRecs(recs: ChannelRec[]): Promise<void> {
  await chrome.storage.local.set({ recs });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(
  partial: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ settings: next });
  return next;
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export async function getMeta(): Promise<StorageMeta> {
  const { meta } = await chrome.storage.local.get("meta");
  return (meta as StorageMeta | undefined) ?? {};
}

export async function patchMeta(patch: Partial<StorageMeta>): Promise<void> {
  const current = await getMeta();
  await chrome.storage.local.set({ meta: { ...current, ...patch } });
}
