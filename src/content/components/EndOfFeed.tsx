export function EndOfFeed() {
  return (
    <div className="iy-end-of-feed" aria-label="End of feed">
      <span className="iy-end-of-feed__icon" aria-hidden>
        ✓
      </span>
      <p className="iy-end-of-feed__msg">You're caught up.</p>
      <p className="iy-end-of-feed__sub">
        Nothing more to see right now.
      </p>
    </div>
  );
}
