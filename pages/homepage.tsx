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
  const [discoverSections, setDiscoverSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    // Fetch discover page data (personalized playlists, stations, etc.)
    fetch("/api/discover")
      .then((res) => res.json())
      .then((data) => {
        console.log("Discover API response:", data);
        if (data.sections && Array.isArray(data.sections)) {
          console.log("Setting discover sections:", data.sections.length);
          setDiscoverSections(data.sections);
        } else {
          console.warn("No sections in discover response");
        }
      })
      .catch((error) => {
        console.error("Error fetching discover data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleItemClick = (item: any, trackList: any[]) => {
    if (item.kind === "track") {
      onTrackClick(item, "search", trackList);
    } else if (
      item.kind === "playlist" ||
      item.kind === "playlist-like" ||
      item.kind === "system-playlist"
    ) {
      // For system playlists (Daily Drops, stations, etc.), we need to resolve the URL first
      if (item.permalink_url) {
        // Let the parent handle playlist resolution and loading
        onPlaylistClick?.({
          ...item,
          needsResolution: true, // Flag to indicate we need to resolve this URL
        });
      } else {
        onPlaylistClick?.(item);
      }
    }
  };

  const renderSection = (section: any) => {
    if (!section.items || section.items.length === 0) return null;

    return (
      <section key={section.title} className="homepage-section">
        <h2>{section.title}</h2>
        <div className="horizontal-scroll">
          {section.items.map((item: any, index: number) => {
            const key = item.id || `${section.title}-${index}`;
            const tracks = section.items.filter((i: any) => i.kind === "track");

            return (
              <div
                key={key}
                className="track-card home-track-card"
                onClick={() => handleItemClick(item, section.items)}
                onContextMenu={(event) =>
                  onTrackContextMenu?.(event, item, "search", section.items)
                }
              >
                <button
                  type="button"
                  className={`card-play-btn ${
                    isItemPlaying?.(item) ? "pause" : "play"
                  }`}
                  style={getCardCoverStyle(item)}
                  onClick={(event) =>
                    onCardPlayClick?.(event, item, "search", section.items)
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
                  src={getCardCover(item)}
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
                    {item.kind === "track" && (item.username || "Unknown")}
                    {(item.kind === "playlist" ||
                      item.kind === "playlist-like" ||
                      item.kind === "system-playlist") &&
                      `Playlist • ${item.track_count || 0} tracks`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="homepage-container">
      {loading && (
        <div className="homepage-loading">
          <p>Loading personalized content...</p>
        </div>
      )}
      {!loading && discoverSections.length === 0 && (
        <div className="homepage-empty">
          <p>
            Loading your personalized content...
            <br />
            If this persists, check the browser console for errors or try
            refreshing.
          </p>
        </div>
      )}
      {discoverSections.map((section) => renderSection(section))}
    </div>
  );
}
