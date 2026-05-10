import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Settings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/constants";

// ─── Styles ────────────────────────────────────────────────────────────────────

const css = `
  .popup {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .popup__header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid #eee;
  }

  .popup__title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #111;
  }

  .popup__subtitle {
    font-size: 11px;
    color: #888;
    margin-top: 2px;
  }

  .popup__body {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .setting__label {
    font-size: 13px;
    font-weight: 500;
    color: #222;
  }

  .setting__hint {
    font-size: 11px;
    color: #999;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }

  .toggle input { opacity: 0; width: 0; height: 0; }

  .toggle__track {
    position: absolute;
    inset: 0;
    background: #ddd;
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toggle input:checked + .toggle__track { background: #1a73e8; }

  .toggle__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    pointer-events: none;
  }

  .toggle input:checked ~ .toggle__thumb { transform: translateX(16px); }

  /* Select */
  .setting__select {
    font-size: 13px;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 4px 8px;
    background: #fff;
    cursor: pointer;
    color: #222;
  }

  .popup__footer {
    padding: 12px 16px;
    border-top: 1px solid #eee;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .popup__btn {
    display: block;
    width: 100%;
    padding: 8px 0;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s, border-color 0.15s;
  }

  .popup__btn:hover { background: #f5f5f5; border-color: #bbb; }
  .popup__btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .popup__status {
    font-size: 11px;
    color: #888;
    text-align: center;
  }

  .popup__status--ok { color: #188038; }
  .popup__status--err { color: #c5221f; }

  .divider {
    height: 1px;
    background: #f0f0f0;
    margin: 0 -16px;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle__track" />
      <span className="toggle__thumb" />
    </label>
  );
}

function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{
    msg: string;
    type: "ok" | "err" | "neutral";
  } | null>(null);

  useEffect(() => {
    chrome.storage.local.get("settings").then(({ settings: stored }) => {
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) });
    });
  }, []);

  async function save(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await chrome.storage.local.set({ settings: next });
  }

  async function handleResync() {
    setSyncing(true);
    setStatus(null);
    try {
      const tabs = await chrome.tabs.query({
        url: "https://www.youtube.com/*",
        active: true,
      });
      if (tabs.length > 0) {
        await chrome.tabs.sendMessage(tabs[0].id!, { type: "FORCE_RSS_REFRESH" });
      } else {
        // Trigger via background directly
        await chrome.runtime.sendMessage({ type: "FORCE_RSS_REFRESH" });
      }
      setStatus({ msg: "Refreshed!", type: "ok" });
    } catch {
      // background refresh still works even if content script message fails
      await chrome.runtime.sendMessage({ type: "FORCE_RSS_REFRESH" }).catch(() => undefined);
      setStatus({ msg: "Refresh triggered.", type: "ok" });
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="popup">
        <header className="popup__header">
          <div className="popup__title">Intentional YouTube</div>
          <div className="popup__subtitle">
            Subscriptions without infinite feeds
          </div>
        </header>

        <div className="popup__body">
          <div className="setting">
            <div className="setting__row">
              <label className="setting__label" htmlFor="feedSize">
                Videos in feed
              </label>
              <select
                id="feedSize"
                className="setting__select"
                value={settings.feedSize}
                onChange={(e) => save({ feedSize: Number(e.target.value) })}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>

          <div className="setting">
            <div className="setting__row">
              <label className="setting__label" htmlFor="recCount">
                Channel suggestions
              </label>
              <select
                id="recCount"
                className="setting__select"
                value={settings.recCount}
                onChange={(e) => save({ recCount: Number(e.target.value) })}
              >
                <option value={0}>Off</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            <span className="setting__hint">
              Max suggested channels per session
            </span>
          </div>

          <div className="divider" />

          <div className="setting">
            <div className="setting__row">
              <label className="setting__label" htmlFor="blockShorts">
                Block Shorts
              </label>
              <Toggle
                id="blockShorts"
                checked={settings.blockShorts}
                onChange={(v) => save({ blockShorts: v })}
              />
            </div>
          </div>

          <div className="setting">
            <div className="setting__row">
              <label className="setting__label" htmlFor="frictionPrompt">
                Friction prompt
              </label>
              <Toggle
                id="frictionPrompt"
                checked={settings.frictionPrompt}
                onChange={(v) => save({ frictionPrompt: v })}
              />
            </div>
            <span className="setting__hint">
              Gentle reminder when opening a non-subscribed video
            </span>
          </div>

          <div className="setting">
            <div className="setting__row">
              <label className="setting__label" htmlFor="returnToFeed">
                Return to feed after video
              </label>
              <Toggle
                id="returnToFeed"
                checked={settings.returnToFeedAfterVideo}
                onChange={(v) => save({ returnToFeedAfterVideo: v })}
              />
            </div>
          </div>
        </div>

        <footer className="popup__footer">
          <button
            className="popup__btn"
            onClick={handleResync}
            disabled={syncing}
          >
            {syncing ? "Refreshing…" : "↺ Refresh subscriptions now"}
          </button>
          {status && (
            <p className={`popup__status popup__status--${status.type}`}>
              {status.msg}
            </p>
          )}
        </footer>
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
