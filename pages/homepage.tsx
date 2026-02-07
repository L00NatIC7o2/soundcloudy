import { useEffect, useRef, useState, type MouseEvent } from "react";

export default function HomePage({
  onTrackClick,
  onTrackContextMenu,
  onCardPlayClick,
  onInfoClick,
  isTrackPlaying,
  isItemPlaying,
  onPlaylistClick,
  currentTrack,
  onPrevious,
  onNext,
  onTrackEnd,
}: {
  onTrackClick: (
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[],
  ) => void;
  onTrackContextMenu?: (
    event: MouseEvent,
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList?: any[],
  ) => void;
  onCardPlayClick?: (
    event: MouseEvent,
    item: any,
    source: "playlist" | "search" | "search-related",
    trackList?: any[],
  ) => void;
  onInfoClick?: (event: MouseEvent, item: any) => void;
  isTrackPlaying?: (trackId: number) => boolean;
  isItemPlaying?: (item: any) => boolean;
  onPlaylistClick?: (playlist: any) => void;
  currentTrack: any;
  onPrevious: () => void;
  onNext: () => void;
  onTrackEnd: () => void;
}) {
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [moreOfWhatYouLike, setMoreOfWhatYouLike] = useState<any[]>([]);
  const [recentlyReleased, setRecentlyReleased] = useState<any[]>([]);
  const [recommendedAlbums, setRecommendedAlbums] = useState<any[]>([]);

  const getCardCover = (item: any) => {
    if (!item) return "/placeholder.png";
    if (item.artwork_url) {
      return item.artwork_url.replace("-large", "-t500x500");
    }
    if (Array.isArray(item.tracks) && item.tracks[0]?.artwork_url) {
      return item.tracks[0].artwork_url.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getCardCoverStyle = (item: any) => ({
    backgroundImage: `url(${getCardCover(item)})`,
  });

  const useDragScroll = () => {
    const ref = useRef<HTMLDivElement | null>(null);
    const isDown = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const velocity = useRef(0);
    const lastX = useRef(0);
    const lastTime = useRef(0);
    const rafId = useRef<number | null>(null);

    const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;
      isDown.current = true;
      ref.current.classList.add("dragging");
      startX.current = event.pageX - ref.current.offsetLeft;
      scrollLeft.current = ref.current.scrollLeft;
      lastX.current = event.pageX;
      lastTime.current = performance.now();
      velocity.current = 0;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };

    const endDrag = () => {
      if (!ref.current) return;
      isDown.current = false;
      ref.current.classList.remove("dragging");
      const startMomentum = () => {
        if (!ref.current) return;
        velocity.current *= 0.95;
        if (Math.abs(velocity.current) < 0.1) {
          velocity.current = 0;
          return;
        }
        ref.current.scrollLeft -= velocity.current * 16;
        rafId.current = requestAnimationFrame(startMomentum);
      };

      if (Math.abs(velocity.current) > 0.2) {
        rafId.current = requestAnimationFrame(startMomentum);
      }
    };

    const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
      if (!isDown.current || !ref.current) return;
      event.preventDefault();
      const x = event.pageX - ref.current.offsetLeft;
      const walk = (x - startX.current) * 1.2;
      ref.current.scrollLeft = scrollLeft.current - walk;

      const now = performance.now();
      const dx = event.pageX - lastX.current;
      const dt = Math.max(1, now - lastTime.current);
      velocity.current = dx / dt;
      lastX.current = event.pageX;
      lastTime.current = now;
    };

    return {
      ref,
      onMouseDown,
      onMouseLeave: endDrag,
      onMouseUp: endDrag,
      onMouseMove,
    };
  };

  const recentlyScroll = useDragScroll();
  const moreScroll = useDragScroll();
  const releasedScroll = useDragScroll();
  const albumsScroll = useDragScroll();

  useEffect(() => {
    // Fetch recently played items (tracks, playlists, albums)
    fetch("/api/recently-played")
      .then((res) => res.json())
      .then((data) => setRecentlyPlayed(data.items || []));

    // Fetch related tracks ("more of what you like")
    fetch("/api/related-tracks?for=homepage")
      .then((res) => res.json())
      .then((data) => setMoreOfWhatYouLike(data.tracks || []));

    // Fetch recently released songs from favorite artists (stub, implement endpoint)
    fetch("/api/recently-released")
      .then((res) => res.json())
      .then((data) => setRecentlyReleased(data.tracks || []));

    // Fetch recommended albums from favorite artists (stub, implement endpoint)
    fetch("/api/recommended-albums")
      .then((res) => res.json())
      .then((data) => setRecommendedAlbums(data.albums || []));
  }, []);

  const handleItemClick = (item: any) => {
    if (item.kind === "track") {
      const tracks = recentlyPlayed.filter((i) => i.kind === "track");
      onTrackClick(item, "playlist", tracks);
    } else if (item.kind === "playlist" || item.kind === "playlist-like") {
      onPlaylistClick?.(item);
    }
  };

  return (
    <div className="homepage-container">
      <section className="homepage-section">
        <h2>Recently Played</h2>
        <div
          className="horizontal-scroll drag-scroll"
          ref={recentlyScroll.ref}
          onMouseDown={recentlyScroll.onMouseDown}
          onMouseLeave={recentlyScroll.onMouseLeave}
          onMouseUp={recentlyScroll.onMouseUp}
          onMouseMove={recentlyScroll.onMouseMove}
        >
          {recentlyPlayed.map((item) => (
            <div
              key={item.id}
              className="track-card home-track-card"
              onClick={() => handleItemClick(item)}
              onContextMenu={(event) =>
                onTrackContextMenu?.(event, item, "playlist", recentlyPlayed)
              }
            >
              <button
                type="button"
                className={`card-play-btn ${
                  isItemPlaying?.(item) ? "pause" : "play"
                }`}
                style={getCardCoverStyle(item)}
                onClick={(event) =>
                  onCardPlayClick?.(event, item, "playlist", recentlyPlayed)
                }
                aria-label={isItemPlaying?.(item) ? "Pause" : "Play"}
              >
                {isItemPlaying?.(item) ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <img
                src={
                  item.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={item.title}
                className="track-cover home-track-cover"
                draggable={false}
              />
              <div
                className="track-info clickable"
                onClick={(event) => onInfoClick?.(event, item)}
              >
                <div className="track-title">{item.title}</div>
                <div className="track-artist">
                  {item.kind === "track" && (item.user?.username || "Unknown")}
                  {(item.kind === "playlist" ||
                    item.kind === "playlist-like") &&
                    `Playlist • ${item.track_count || 0} tracks`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>More of What You Like</h2>
        <div
          className="horizontal-scroll drag-scroll"
          ref={moreScroll.ref}
          onMouseDown={moreScroll.onMouseDown}
          onMouseLeave={moreScroll.onMouseLeave}
          onMouseUp={moreScroll.onMouseUp}
          onMouseMove={moreScroll.onMouseMove}
        >
          {moreOfWhatYouLike.map((track) => (
            <div
              key={track.id}
              className="track-card home-track-card"
              onClick={() => onTrackClick(track, "search", moreOfWhatYouLike)}
              onContextMenu={(event) =>
                onTrackContextMenu?.(event, track, "search", moreOfWhatYouLike)
              }
            >
              <button
                type="button"
                className={`card-play-btn ${
                  isItemPlaying?.(track) ? "pause" : "play"
                }`}
                style={getCardCoverStyle(track)}
                onClick={(event) =>
                  onCardPlayClick?.(event, track, "search", moreOfWhatYouLike)
                }
                aria-label={isItemPlaying?.(track) ? "Pause" : "Play"}
              >
                {isItemPlaying?.(track) ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <img
                src={
                  track.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={track.title}
                className="track-cover home-track-cover"
                draggable={false}
              />
              <div
                className="track-info clickable"
                onClick={(event) => onInfoClick?.(event, track)}
              >
                <div className="track-title">{track.title}</div>
                <div className="track-artist">
                  {track.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>Recently Released</h2>
        <div
          className="horizontal-scroll drag-scroll"
          ref={releasedScroll.ref}
          onMouseDown={releasedScroll.onMouseDown}
          onMouseLeave={releasedScroll.onMouseLeave}
          onMouseUp={releasedScroll.onMouseUp}
          onMouseMove={releasedScroll.onMouseMove}
        >
          {recentlyReleased.map((track) => (
            <div
              key={track.id}
              className="track-card home-track-card"
              onClick={() => onTrackClick(track, "search", recentlyReleased)}
              onContextMenu={(event) =>
                onTrackContextMenu?.(event, track, "search", recentlyReleased)
              }
            >
              <button
                type="button"
                className={`card-play-btn ${
                  isItemPlaying?.(track) ? "pause" : "play"
                }`}
                style={getCardCoverStyle(track)}
                onClick={(event) =>
                  onCardPlayClick?.(event, track, "search", recentlyReleased)
                }
                aria-label={isItemPlaying?.(track) ? "Pause" : "Play"}
              >
                {isItemPlaying?.(track) ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <img
                src={
                  track.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={track.title}
                className="track-cover home-track-cover"
                draggable={false}
              />
              <div
                className="track-info clickable"
                onClick={(event) => onInfoClick?.(event, track)}
              >
                <div className="track-title">{track.title}</div>
                <div className="track-artist">
                  {track.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>Recommended Albums</h2>
        <div
          className="horizontal-scroll drag-scroll"
          ref={albumsScroll.ref}
          onMouseDown={albumsScroll.onMouseDown}
          onMouseLeave={albumsScroll.onMouseLeave}
          onMouseUp={albumsScroll.onMouseUp}
          onMouseMove={albumsScroll.onMouseMove}
        >
          {recommendedAlbums.map((album) => (
            <div
              key={album.id}
              className="track-card home-track-card"
              onClick={() => onPlaylistClick?.(album)}
              onContextMenu={(event) =>
                onTrackContextMenu?.(event, album, "search", recommendedAlbums)
              }
            >
              <button
                type="button"
                className="card-play-btn play"
                style={getCardCoverStyle(album)}
                onClick={(event) =>
                  onCardPlayClick?.(event, album, "search", recommendedAlbums)
                }
                aria-label="Play"
              >
                {isItemPlaying?.(album) ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <img
                src={
                  album.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={album.title}
                className="track-cover home-track-cover"
                draggable={false}
              />
              <div
                className="track-info clickable"
                onClick={(event) => onInfoClick?.(event, album)}
              >
                <div className="track-title">{album.title}</div>
                <div className="track-artist">
                  {album.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
