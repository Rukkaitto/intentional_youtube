import type { ChannelRec } from "@shared/types";
import { CHANNEL_URL, HANDLE_URL } from "@shared/constants";

interface ChannelCardProps {
  channel: ChannelRec;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const href = channel.handle
    ? HANDLE_URL(channel.handle)
    : CHANNEL_URL(channel.id);

  return (
    <article className="iy-channel-card">
      <div className="iy-channel-card__avatar-wrap">
        {channel.avatarUrl ? (
          <img
            className="iy-channel-card__avatar"
            src={channel.avatarUrl}
            alt={channel.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="iy-channel-card__avatar-placeholder" aria-hidden>
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="iy-channel-card__info">
        <h3 className="iy-channel-card__name">{channel.name}</h3>
        {channel.topicChip && (
          <span className="iy-channel-card__topic">{channel.topicChip}</span>
        )}
        {channel.description && (
          <p className="iy-channel-card__desc">
            {channel.description.length > 120
              ? channel.description.slice(0, 120) + "…"
              : channel.description}
          </p>
        )}
      </div>
      <a
        href={href}
        className="iy-channel-card__btn"
        aria-label={`Open channel ${channel.name}`}
      >
        Explore
      </a>
    </article>
  );
}
