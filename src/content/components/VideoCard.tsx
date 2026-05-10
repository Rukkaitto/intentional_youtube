import type { VideoItem } from "@shared/types";

interface VideoCardProps {
  video: VideoItem;
  onClickOutsideSubs?: (videoId: string) => void;
  isSubscribed: boolean;
}

function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function VideoCard({
  video,
  onClickOutsideSubs,
  isSubscribed,
}: VideoCardProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!isSubscribed && onClickOutsideSubs) {
      // Friction prompt is handled at the page level; just notify
      onClickOutsideSubs(video.id);
      // Don't prevent default — the click still navigates
    }
    // Remove autoplay param by modifying the href before navigation
    const url = new URL(video.url, "https://www.youtube.com");
    url.searchParams.delete("autoplay");
    url.searchParams.set("autoplay", "0");
    e.currentTarget.href = url.toString();
  }

  return (
    <article className="iy-video-card">
      <a
        href={video.url}
        className="iy-video-card__link"
        onClick={handleClick}
      >
        <div className="iy-video-card__thumb-wrap">
          <img
            className="iy-video-card__thumb"
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="iy-video-card__meta">
          <p className="iy-video-card__channel">{video.channelName}</p>
          <h3 className="iy-video-card__title">{video.title}</h3>
          <time className="iy-video-card__time">
            {formatRelativeTime(video.publishedAt)}
          </time>
        </div>
      </a>
    </article>
  );
}
