import { createRoot, type Root } from "react-dom/client";
import { FEED_URL } from "@shared/constants";

function ShortsBlockScreen() {
  return (
    <div className="iy-shorts-block">
      <div className="iy-shorts-block__inner">
        <p className="iy-shorts-block__title">Shorts are hidden.</p>
        <p className="iy-shorts-block__body">
          Intentional YouTube keeps Shorts out of the way.
          You can turn this off in the extension settings.
        </p>
        <div className="iy-shorts-block__actions">
          <a href={FEED_URL} className="iy-btn">
            Go to your feed
          </a>
        </div>
      </div>
    </div>
  );
}

let shortsRoot: Root | null = null;
let shortsContainer: HTMLDivElement | null = null;

export function mountShortsBlock(): void {
  if (shortsContainer) return;

  // Prevent YouTube from rendering anything
  document.body.style.overflow = "hidden";

  const container = document.createElement("div");
  container.id = "iy-shorts-block-root";
  document.body.appendChild(container);
  shortsContainer = container;

  shortsRoot = createRoot(container);
  shortsRoot.render(<ShortsBlockScreen />);
}

export function unmountShortsBlock(): void {
  shortsRoot?.unmount();
  shortsRoot = null;
  shortsContainer?.remove();
  shortsContainer = null;
  document.body.style.overflow = "";
}
