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
  user?: {
    username?: string;
    avatar_url?: string;
    followers_count?: number;
  };
  track_count?: number;
  [key: string]: any;
};

type DiscoverSection = {
  title: string;
  items: SectionItem[];
};

const DISCOVER_CLIENT_TTL_MS = 5 * 60 * 1000;
const DISCOVER_EMPTY_TTL_MS = 20 * 1000;
const discoverClientCache = new Map<string, { sections: DiscoverSection[]; expiresAt: number }>();
const discoverRequests = new Map<string, Promise<DiscoverSection[]>>();

const normalizeItem = (item: any): SectionItem | null => {
  if (!item || typeof item !== "object") return null;

  // Discover can include artist profiles alongside songs and playlists. A
  // profile may also carry track-like fields, so keep its resource type.
  if (item.kind === "user" || item.kind === "artist") {
    return item;
  }

  // Mixed selections and history entries can wrap a track in a playlist-like
  // recommendation object. Prefer the actual embedded resource before using
  // the wrapper's kind, id, title, or duration.
  if (item.track && typeof item.track === "object") {
    return normalizeItem({
      ...item.track,
      played_at: item.played_at ?? item.created_at ?? item.track.played_at,
    });
  }
  if (item.origin && typeof item.origin === "object") {
    return normalizeItem(item.origin);
  }
  if (item.item && typeof item.item === "object") {
    return normalizeItem(item.item);
  }
  if (Array.isArray(item.collection) && item.collection.length > 0) {
    return normalizeItem(item.collection[0]);
  }
  if (item.playlist && typeof item.playlist === "object") {
    return normalizeItem({
      ...item.playlist,
      kind: item.playlist.kind || "playlist",
    });
  }
  if (item.system_playlist && typeof item.system_playlist === "object") {
    return normalizeItem({
      ...item.system_playlist,
      kind: item.system_playlist.kind || "system-playlist",
    });
  }
  if (item.album && typeof item.album === "object") {
    return normalizeItem({
      ...item.album,
      kind: item.album.kind || "playlist",
      is_album: true,
    });
  }
  if (item.station && typeof item.station === "object") {
    return normalizeItem({
      ...item.station,
      kind: item.station.kind || "system-playlist",
    });
  }

  const collectionKind = ["playlist", "playlist-like", "system-playlist"].includes(
    item.kind,
  );
  const hasTrackPayload =
    Boolean(item.media?.transcodings?.length) ||
    Boolean(item.track_authorization) ||
    (!collectionKind &&
      typeof item.duration === "number" &&
      !Number.isFinite(item.track_count) &&
      !Array.isArray(item.tracks));
  if (item.kind === "track" || hasTrackPayload) {
    return { ...item, kind: "track" };
  }

  if (item.kind && (item.title || item.user?.username || item.username)) {
    return item;
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

  const normalizedItems: SectionItem[] = sourceItems
    .map((item: any) => normalizeItem(item))
    .filter((item: SectionItem | null): item is SectionItem => item !== null);
  const isRecentlyPlayed = /recently played/i.test(section.title || section.name || "");
  const seenItems = new Set<string>();
  const items = normalizedItems.filter((item: SectionItem) => {
    const id = isRecentlyPlayed ? item.id ?? item.urn : item.urn || item.id;
    if (id === undefined || id === null) return true;
    const key = isRecentlyPlayed
      ? String(id)
      : `${item.kind || "item"}:${String(id)}`;
    if (seenItems.has(key)) return false;
    seenItems.add(key);
    return true;
  });

  if (!items.length) return null;

  return {
    title: section.title || section.name || "For You",
    items,
  };
};

const requestDiscoverSections = async (): Promise<DiscoverSection[]> => {
  let data: any = null;
  const electronAPI = (window as any).electronAPI;
  if (typeof electronAPI?.fetchDiscoverSelections === "function") {
    try {
      const electronData = await electronAPI.fetchDiscoverSelections();
      if (Array.isArray(electronData?.sections) && electronData.sections.length) {
        data = electronData;
      } else if (electronData?.error) {
        console.warn("Electron Discover session request failed:", electronData.error);
      }
    } catch (error) {
      console.warn("Electron Discover request failed:", error);
    }
  }

  if (!data) {
    const response = await fetch("/api/discover", { cache: "no-store" });
    data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load Discover.");
  }

  const sections = Array.isArray(data?.sections)
    ? data.sections
        .map((section: any) => normalizeSection(section))
        .filter((section: DiscoverSection | null): section is DiscoverSection => Boolean(section))
    : [];
  if (!sections.length) {
    const firstIssue = Array.isArray(data?.issues) ? data.issues[0] : null;
    throw new Error(
      firstIssue?.message ||
        "SoundCloud returned no Discover sections. Try again in a moment.",
    );
  }
  return sections;
};

const getDiscoverSections = (userKey: string) => {
  const existing = discoverRequests.get(userKey);
  if (existing) return existing;

  const request = requestDiscoverSections()
    .then((sections) => {
      discoverClientCache.delete(userKey);
      discoverClientCache.set(userKey, {
        sections,
        expiresAt: Date.now() + (sections.length ? DISCOVER_CLIENT_TTL_MS : DISCOVER_EMPTY_TTL_MS),
      });
      while (discoverClientCache.size > 8) {
        const oldestKey = discoverClientCache.keys().next().value;
        if (oldestKey === undefined) break;
        discoverClientCache.delete(oldestKey);
      }
      return sections;
    })
    .finally(() => {
      if (discoverRequests.get(userKey) === request) discoverRequests.delete(userKey);
    });
  discoverRequests.set(userKey, request);
  return request;
};

export default function HomePage({
  userId,
  onTrackClick,
  onTrackContextMenu,
  onCardPlayClick,
  onInfoClick,
  isTrackPlaying,
  isItemPlaying,
  onPlaylistClick,
  onArtistClick,
  onToggleTrackLike,
  likedTracks,
  renderHeartIcon,
  currentTrack,
  onPrevious,
  onNext,
  onTrackEnd,
}: {
  userId?: string | number | null;
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
  onArtistClick?: (artist: any) => void;
  onToggleTrackLike?: (trackId: number, track?: any) => void | Promise<void>;
  likedTracks?: Record<number, boolean>;
  renderHeartIcon?: (filled: boolean) => React.ReactNode;
  currentTrack: any;
  onPrevious: () => void;
  onNext: () => void;
  onTrackEnd: () => void;
}) {
  const [discoverSections, setDiscoverSections] = useState<DiscoverSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

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

  const getFirstPlaylistTrackArtwork = (item: SectionItem) => {
    const tracks = Array.isArray(item.tracks)
      ? item.tracks
      : Array.isArray((item.tracks as any)?.collection)
        ? (item.tracks as any).collection
        : Array.isArray(item.items?.collection)
          ? item.items.collection
          : [];
    const firstTrack = tracks[0]?.track || tracks[0]?.origin || tracks[0];
    const artworkUrl = firstTrack?.artwork_url || firstTrack?.user?.avatar_url;
    return artworkUrl ? artworkUrl.replace("-large", "-t500x500") : null;
  };

  const getCardCover = (item: SectionItem, sectionTitle: string) => {
    if (!item) return "/placeholder.png";
    if (item.kind === "user" || item.kind === "artist") {
      const avatarUrl = item.avatar_url || item.user?.avatar_url || item.artwork_url;
      return avatarUrl
        ? avatarUrl.replace("-large", "-t500x500")
        : "/placeholder.png";
    }
    const useFirstTrackArtwork =
      /^(more of what you like|trending by genre)\b/i.test(sectionTitle) &&
      ["playlist", "playlist-like", "system-playlist"].includes(item.kind || "");
    if (useFirstTrackArtwork) {
      const firstTrackArtwork = getFirstPlaylistTrackArtwork(item);
      if (firstTrackArtwork) return firstTrackArtwork;
    }
    return getTrackArtwork(item);
  };

  const getCardCoverStyle = (item: SectionItem, sectionTitle: string) => ({
    backgroundImage: `url(${getCardCover(item, sectionTitle)})`,
  });

  useEffect(() => {
    let cancelled = false;
    const userKey = userId === undefined || userId === null ? null : String(userId);
    const cached = userKey ? discoverClientCache.get(userKey) : undefined;
    if (cached) setDiscoverSections(cached.sections);
    setLoading(!cached);
    setDiscoverError("");

    if (cached && cached.expiresAt > Date.now()) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = userKey ? getDiscoverSections(userKey) : requestDiscoverSections();
    void load
      .then((sections) => {
        if (!cancelled) setDiscoverSections(sections);
      })
      .catch((error) => {
        console.error("Error fetching discover data:", error);
        if (!cancelled) {
          setDiscoverError(
            error instanceof Error ? error.message : "Could not load Discover.",
          );
        }
        if (!cancelled && !cached) setDiscoverSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount, userId]);

  const handleItemClick = (item: SectionItem, trackList: SectionItem[]) => {
    if (item.kind === "track") {
      onTrackClick(item, "search", trackList);
    } else if (item.kind === "user" || item.kind === "artist") {
      onArtistClick?.(item);
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
      const label = item.is_album ? "Album" : "Playlist";
      return `${label} - ${item.track_count || item.tracks?.length || 0} tracks`;
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
            const isArtistCard = item.kind === "user" || item.kind === "artist";

            return (
              <div
                key={key}
                className={`track-card home-track-card ${
                  isArtistCard ? "home-profile-card" : ""
                }`}
                onClick={() => handleItemClick(item, section.items)}
                onContextMenu={(event) =>
                  onTrackContextMenu?.(event, item, "search", section.items)
                }
              >
                {!isArtistCard && (
                  <button
                    type="button"
                    className={`card-play-btn ${
                      isItemPlaying?.(item) ? "pause" : "play"
                    }`}
                    style={getCardCoverStyle(item, section.title)}
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
                )}
                <img
                  src={getCardCover(item, section.title)}
                  alt={
                    isArtistCard
                      ? item.username || item.title || "Artist profile"
                      : item.title || section.title
                  }
                  className={`track-cover home-track-cover ${
                    isArtistCard ? "home-profile-cover" : ""
                  }`}
                  draggable={false}
                />
                <div
                  className="track-info clickable"
                  onClick={(event) => onInfoClick?.(event, item)}
                >
                  <div className="track-title">
                    {isArtistCard
                      ? item.username || item.title || "Unknown Artist"
                      : item.title || "Untitled"}
                  </div>
                  <div
                    className="track-artist clickable"
                    onClick={(event) => {
                      if (item.kind !== "track") return;
                      event.stopPropagation();
                      onArtistClick?.(item.user);
                    }}
                  >
                    {isArtistCard
                      ? `${Number(
                          item.followers_count ?? item.user?.followers_count ?? 0,
                        ).toLocaleString()} followers`
                      : getSubtitle(item)}
                  </div>
                  {item.kind === "track" && typeof item.id === "number" && (
                    <button
                      type="button"
                      className={`track-like-btn ${likedTracks?.[item.id] ? "liked" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onToggleTrackLike?.(item.id as number, item);
                      }}
                      aria-label={
                        likedTracks?.[item.id] ? "Remove like" : "Add like"
                      }
                    >
                      {renderHeartIcon?.(Boolean(likedTracks?.[item.id]))}
                    </button>
                  )}
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
            {discoverError || "No Discover content is available right now."}
          </p>
          <button
            type="button"
            className="homepage-retry"
            onClick={() => {
              const userKey =
                userId === undefined || userId === null ? null : String(userId);
              if (userKey) discoverClientCache.delete(userKey);
              setRetryCount((count) => count + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {discoverSections.map((section) => renderSection(section))}
    </div>
  );
}
