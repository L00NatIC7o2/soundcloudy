import { useEffect, useState, type MouseEvent } from "react";

type SectionItem = {
  id?: number | string;
  kind?: string;
  title?: string;
  username?: string;
  artwork_url?: string;
  avatar_url?: string;
  permalink_url?: string;
  tracks?: Array<{ artwork_url?: string }>;
  user?: { username?: string; avatar_url?: string };
  track_count?: number;
  [key: string]: any;
};

type DiscoverSection = {
  title: string;
  items: SectionItem[];
};

const normalizeItem = (item: any): SectionItem | null => {
  if (!item || typeof item !== "object") return null;

  if (item.kind && (item.title || item.user?.username || item.username)) {
    return item;
  }

  if (item.track) {
    return normalizeItem({
      ...item.track,
      played_at: item.played_at ?? item.created_at,
    });
  }

  if (item.playlist) {
    return normalizeItem({
      ...item.playlist,
      kind: item.playlist.kind || "playlist",
    });
  }

  if (item.system_playlist) {
    return normalizeItem({
      ...item.system_playlist,
      kind: item.system_playlist.kind || "system-playlist",
    });
  }

  if (item.album) {
    return normalizeItem({
      ...item.album,
      kind: item.album.kind || "playlist",
    });
  }

  if (item.station) {
    return normalizeItem({
      ...item.station,
      kind: item.station.kind || "system-playlist",
    });
  }

  if (item.origin) {
    return normalizeItem(item.origin);
  }

  if (item.item) {
    return normalizeItem(item.item);
  }

  if (Array.isArray(item.collection) && item.collection.length > 0) {
    return normalizeItem(item.collection[0]);
  }

  return null;
};

const normalizeSection = (section: any): DiscoverSection | null => {
  if (!section || typeof section !== "object") return null;

  const sourceItems = Array.isArray(section.items)
    ? section.items
    : Array.isArray(section.items?.collection)
      ? section.items.collection
      : Array.isArray(section.collection)
        ? section.collection
        : [];

  const items = sourceItems
    .map((item: any) => normalizeItem(item))
    .filter((item: SectionItem | null): item is SectionItem => Boolean(item));

  if (!items.length) return null;

  return {
    title: section.title || section.name || "For You",
    items,
  };
};

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
  const [discoverSections, setDiscoverSections] = useState<DiscoverSection[]>([]);
  const [loading, setLoading] = useState(false);

  const getTrackArtwork = (item: SectionItem) => {
    const artworkUrl = item.artwork_url;
    const firstTrackArtwork = Array.isArray(item.tracks)
      ? item.tracks[0]?.artwork_url
      : null;
    const avatarUrl = item.user?.avatar_url || item.avatar_url;
    if (artworkUrl) {
      return artworkUrl.replace("-large", "-t500x500");
    }
    if (firstTrackArtwork) {
      return firstTrackArtwork.replace("-large", "-t500x500");
    }
    if (avatarUrl) {
      return avatarUrl.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getCardCover = (item: SectionItem) => {
    if (!item) return "/placeholder.png";
    return getTrackArtwork(item);
  };

  const getCardCoverStyle = (item: SectionItem) => ({
    backgroundImage: `url(${getCardCover(item)})`,
  });

  useEffect(() => {
    setLoading(true);

    fetch("/api/discover")
      .then((res) => res.json())
      .then((data) => {
        if (data.sections && Array.isArray(data.sections)) {
          const normalizedSections = data.sections
            .map((section: any) => normalizeSection(section))
            .filter(
              (section: DiscoverSection | null): section is DiscoverSection =>
                Boolean(section),
            );
          setDiscoverSections(normalizedSections);
        } else {
          setDiscoverSections([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching discover data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleItemClick = (item: SectionItem, trackList: SectionItem[]) => {
    if (item.kind === "track") {
      onTrackClick(item, "search", trackList);
    } else if (
      item.kind === "playlist" ||
      item.kind === "playlist-like" ||
      item.kind === "system-playlist"
    ) {
      if (item.permalink_url) {
        onPlaylistClick?.({
          ...item,
          needsResolution: true,
        });
      } else {
        onPlaylistClick?.(item);
      }
    }
  };

  const getSubtitle = (item: SectionItem) => {
    if (item.kind === "track") {
      return item.user?.username || item.username || "Unknown";
    }

    if (
      item.kind === "playlist" ||
      item.kind === "playlist-like" ||
      item.kind === "system-playlist"
    ) {
      return `Playlist - ${item.track_count || item.tracks?.length || 0} tracks`;
    }

    return item.user?.username || item.username || "";
  };

  const renderSection = (section: DiscoverSection) => {
    if (!section.items.length) return null;

    return (
      <section key={section.title} className="homepage-section">
        <h2>{section.title}</h2>
        <div className="horizontal-scroll">
          {section.items.map((item, index) => {
            const key = item.id || `${section.title}-${index}`;

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
                  alt={item.title || section.title}
                  className="track-cover home-track-cover"
                  draggable={false}
                />
                <div
                  className="track-info clickable"
                  onClick={(event) => onInfoClick?.(event, item)}
                >
                  <div className="track-title">{item.title || "Untitled"}</div>
                  <div className="track-artist">{getSubtitle(item)}</div>
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
