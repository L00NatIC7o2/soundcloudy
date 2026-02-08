import { useEffect, useState, type MouseEvent } from "react";

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

  useEffect(() => {
    setRecentlyPlayed([]);

    // Use recently played items as "more of what you like"
    fetch("/api/recently-played")
      .then((res) => res.json())
      .then((data) => setMoreOfWhatYouLike((data.items || []).slice(0, 10)));

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
        <div className="horizontal-scroll">
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
        <div className="horizontal-scroll">
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
        <div className="horizontal-scroll">
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
        <div className="horizontal-scroll">
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
