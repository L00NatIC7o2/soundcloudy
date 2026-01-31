import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewingLikes, setViewingLikes] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [viewingArtist, setViewingArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [artistTracks, setArtistTracks] = useState<any[]>([]);
  const [geniusCache, setGeniusCache] = useState<Record<string, any>>({});
  const [searchOffset, setSearchOffset] = useState<number>(0);
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false);
  const [searchNextHref, setSearchNextHref] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [queueSource, setQueueSource] = useState<"playlist" | "search">(
    "playlist",
  );
  const scrollTriggerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  // Fetch playlists
  const fetchPlaylists = async () => {
    try {
      const response = await fetch("/api/playlists");
      const data = await response.json();
      const sorted = (data.playlists || [])
        .sort((a: any, b: any) => (b.modified_at || 0) - (a.modified_at || 0))
        .slice(0, 5);
      setPlaylists(sorted);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  };

  // Fetch last played track
  const fetchLastPlayedTrack = async () => {
    try {
      const response = await fetch("/api/likes");
      if (!response.ok) {
        console.error("Failed to fetch last played track:", response.status);
        return;
      }
      const data = await response.json();
      if (data.likes && data.likes.length > 0) {
        setCurrentTrack(data.likes[0]);
        setQueue(data.likes);
        setCurrentQueueIndex(0);
      }
    } catch (error) {
      console.error("Failed to fetch last played track:", error);
    }
  };

  // Handle playlist click
  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setTracks([]);
    try {
      const response = await fetch(`/api/playlist/${playlist.id}`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    }
    pushTabState("playlist", { playlistId: playlist.id });
  };

  // Handle likes click
  const handleLikesClick = async () => {
    setViewingLikes(true);
    setSelectedPlaylist(null);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setTracks([]);
    try {
      const response = await fetch("/api/likes");
      const data = await response.json();
      setPlaylistTracks(data.likes || data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch liked songs:", error);
    }
    pushTabState("likes");
  };

  // Handle profile click
  const handleProfileClick = async () => {
    setViewingProfile(true);
    setViewingArtist(false); // <-- Reset artist view
    setSelectedArtist(null); // <-- Clear selected artist
    setSelectedPlaylist(null);
    setViewingLikes(false);
    setTracks([]);
    setArtistTracks([]); // <-- Clear artist tracks

    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      setUserProfile(data);
      if (data.tracks) {
        setPlaylistTracks(data.tracks);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
    pushTabState("profile");
  };

  // Handle artist click
  const handleArtistClick = async (artist: any) => {
    setViewingArtist(true);
    setSelectedPlaylist(null);
    setViewingProfile(false);
    setViewingLikes(false);
    setTracks([]);
    setSelectedArtist(artist);

    try {
      const response = await fetch(`/api/artist/${artist.id}`);
      if (!response.ok) {
        console.error("Artist fetch failed:", response.status);
        return;
      }
      const data = await response.json();
      setArtistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch artist tracks:", error);
    }
    pushTabState("artist", { artistId: artist.id });
  };

  // Handle search with pagination
  const handleSearch = async (nextPageHref: string | null = null) => {
    if (!query.trim() && !nextPageHref) {
      setTracks([]);
      setSearchHasMore(false);
      return;
    }

    if (!nextPageHref) {
      setLoading(true);
      setTracks([]);
      setSearchNextHref(null);
      setSearchHasMore(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      scrollToTop();
    } else {
      setIsLoadingMore(true);
    }

    setSelectedPlaylist(null);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);

    try {
      let url = "/api/search";
      if (nextPageHref) {
        url += `?nextHref=${encodeURIComponent(nextPageHref)}`;
      } else {
        url += `?q=${encodeURIComponent(query)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      console.log("Search response:", {
        query,
        resultsCount: (data.collection || []).length,
        hasMore: data.hasMore,
      });

      if (!nextPageHref) {
        setTracks(data.collection || []);
        scrollToTop();
      } else {
        const newTracks = data.collection || [];
        const existingIds = new Set(tracks.map((t: any) => t.id));
        const uniqueNewTracks = newTracks.filter(
          (t: any) => !existingIds.has(t.id),
        );
        setTracks((prev) => [...prev, ...uniqueNewTracks]);
      }

      setSearchHasMore(data.hasMore || false);
      setSearchNextHref(data.nextHref || null);
    } catch (error) {
      console.error("Search error:", error);
      setTracks([]);
      setSearchHasMore(false);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Handle track click
  const handleTrackClick = (
    track: any,
    source: "playlist" | "search",
    trackList: any[] = [],
  ) => {
    setCurrentTrack(track);
    setQueueSource(source);

    if (source === "playlist") {
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1) {
        setQueue(trackList);
        setCurrentQueueIndex(trackIndex);
      }
    } else if (source === "search") {
      setQueue(trackList);
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      setCurrentQueueIndex(trackIndex !== -1 ? trackIndex : 0);
    }
  };

  // Handle next track
  const handleNext = () => {
    if (currentQueueIndex < queue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    }
  };

  // Handle previous track
  const handlePrevious = () => {
    if (currentQueueIndex > 0) {
      const prevIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
    }
  };

  // Utility functions
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPlaylistCover = (playlist: any) => {
    if (playlist.artwork_url) {
      return playlist.artwork_url.replace("-large", "-t500x500");
    }
    if (
      playlist.tracks &&
      playlist.tracks.length > 0 &&
      playlist.tracks[0].artwork_url
    ) {
      return playlist.tracks[0].artwork_url.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getLikedSongsCover = () => {
    if (playlistTracks.length > 0 && playlistTracks[0].artwork_url) {
      return playlistTracks[0].artwork_url.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  const fetchGeniusMetadata = async (track: any) => {
    const cacheKey = `${track.id}`;
    if (geniusCache[cacheKey]) {
      return geniusCache[cacheKey];
    }

    try {
      const response = await fetch(
        `/api/genius-metadata?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.user?.username || "")}`,
      );
      const data = await response.json();

      if (data.found && data.releaseDate) {
        const metadata = {
          releaseYear: new Date(data.releaseDate).getFullYear(),
        };
        setGeniusCache((prev) => ({ ...prev, [cacheKey]: metadata }));
        return metadata;
      }
    } catch (error) {
      console.error("Genius fetch failed:", error);
    }

    return null;
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (!res.ok) {
          router.push("/login");
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
          fetchPlaylists();
          // fetchLastPlayedTrack(); // Removed autoplay on login
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, [router]);

  // Fetch genius metadata for playlist tracks
  useEffect(() => {
    if (playlistTracks.length > 0) {
      playlistTracks.forEach((track) => {
        if (track.id && !geniusCache[track.id]) {
          fetchGeniusMetadata(track).catch((err) => {
            console.warn(`Failed to fetch Genius data for ${track.id}:`, err);
          });
        }
      });
    }
  }, [playlistTracks, geniusCache]);

  // Infinite scroll for search results
  useEffect(() => {
    // Only enable infinite scroll when viewing search results
    if (
      !scrollTriggerRef.current ||
      !searchHasMore ||
      isLoadingMore ||
      loading ||
      !searchNextHref ||
      selectedPlaylist ||
      viewingLikes ||
      viewingProfile ||
      viewingArtist
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && searchHasMore && !isLoadingMore) {
          handleSearch(searchNextHref);
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );

    observer.observe(scrollTriggerRef.current);

    return () => observer.disconnect();
  }, [
    searchHasMore,
    isLoadingMore,
    loading,
    searchNextHref,
    selectedPlaylist,
    viewingLikes,
    viewingProfile,
    viewingArtist,
  ]);

  // Popstate handler for browser back/forward
  useEffect(() => {
    const onPopState = (event) => {
      const state = event.state || {};
      switch (state.tab) {
        case "profile":
          handleProfileClick();
          break;
        case "likes":
          handleLikesClick();
          break;
        case "playlist":
          if (state.playlistId) {
            const playlist = playlists.find((p) => p.id === state.playlistId);
            if (playlist) handlePlaylistClick(playlist);
          }
          break;
        case "artist":
          if (state.artistId) {
            handleArtistClick({ id: state.artistId });
          }
          break;
        case "search":
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setSelectedArtist(null);
          setQuery(state.query || "");
          handleSearch();
          break;
        default:
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setSelectedArtist(null);
          break;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [playlists]);

  const pushTabState = (tab, data = {}) => {
    window.history.pushState({ tab, ...data }, "", "");
  };

  if (authChecking) {
    return <div style={{ padding: "20px", color: "white" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayTitle = viewingLikes ? "Liked Songs" : selectedPlaylist?.title;
  const displayCover = viewingLikes
    ? getLikedSongsCover()
    : selectedPlaylist
      ? getPlaylistCover(selectedPlaylist)
      : null;

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}
      >
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
        >
          {sidebarExpanded ? "◀" : "▶"}
        </button>

        <nav className="sidebar-nav">
          <button
            className="nav-item"
            onClick={() => {
              // TODO: Implement home page
            }}
          >
            <span className="nav-icon">🏠</span>
            {sidebarExpanded && <span className="nav-label">Home</span>}
          </button>

          <button className="nav-item" onClick={handleProfileClick}>
            <span className="nav-icon">👤</span>
            {sidebarExpanded && <span className="nav-label">Profile</span>}
          </button>

          <button className="nav-item" onClick={handleLikesClick}>
            <span className="nav-icon">❤️</span>
            {sidebarExpanded && <span className="nav-label">Liked Songs</span>}
          </button>

          <button
            className="nav-item"
            onClick={() => {
              setSelectedPlaylist(null);
              setViewingLikes(false);
            }}
          >
            <span className="nav-icon">🆕</span>
            {sidebarExpanded && (
              <span className="nav-label">Newly Released</span>
            )}
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-playlists">
          {sidebarExpanded && (
            <div className="section-title">Recent Playlists</div>
          )}
          <div className="playlist-thumbs">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="playlist-item"
                  onClick={() => handlePlaylistClick(playlist)}
                >
                  <img
                    src={getPlaylistCover(playlist)}
                    alt={playlist.title}
                    className="playlist-thumb"
                  />
                  {sidebarExpanded && (
                    <div className="playlist-title-sidebar">
                      {playlist.title}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                {sidebarExpanded ? "No playlists yet" : "—"}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="top-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search for songs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={() => handleSearch(0)} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      </div>

      <main className="main-area">
        {selectedPlaylist || viewingLikes || viewingProfile || viewingArtist ? (
          <div className="playlist-view">
            <div
              className="playlist-header-sticky"
              style={
                viewingProfile || viewingArtist
                  ? {
                      backgroundImage: `url(${(viewingProfile ? userProfile?.banner_url : selectedArtist?.banner_url)?.replace("-large", "-t500x500") || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <img
                src={
                  viewingProfile || viewingArtist
                    ? (viewingProfile
                        ? userProfile?.avatar_url
                        : selectedArtist?.avatar_url
                      )?.replace("-large", "-t500x500") || "/placeholder.png"
                    : displayCover
                }
                alt={
                  viewingProfile || viewingArtist
                    ? viewingProfile
                      ? userProfile?.username
                      : selectedArtist?.username
                    : displayTitle
                }
                className="playlist-header-cover"
              />
              <h2 className="playlist-header-title">
                {viewingProfile || viewingArtist
                  ? viewingProfile
                    ? userProfile?.username
                    : selectedArtist?.username
                  : displayTitle}
              </h2>
            </div>
            <div className="track-list">
              {(viewingProfile
                ? playlistTracks
                : viewingArtist
                  ? artistTracks
                  : playlistTracks
              ).map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="track-row"
                  onClick={() =>
                    handleTrackClick(
                      track,
                      "playlist",
                      viewingProfile ? playlistTracks : artistTracks,
                    )
                  }
                >
                  <img
                    src={
                      track.artwork_url?.replace("-large", "-t200x200") ||
                      "/placeholder.png"
                    }
                    alt={track.title}
                    className="track-row-cover"
                  />
                  <div className="track-row-info">
                    <div className="track-row-title">{track.title}</div>
                    <div className="track-row-artist">
                      {track.user?.username || "Unknown"}
                    </div>
                  </div>
                  <div className="track-row-duration">
                    {formatDuration(track.duration)}
                  </div>
                  <div className="track-row-year">
                    {geniusCache[track.id]?.releaseYear ||
                      (track.created_at ? getYear(track.created_at) : "—")}
                  </div>
                  <div className="track-row-added">
                    {track.added_at
                      ? formatTimeAgo(track.added_at)
                      : track.created_at
                        ? formatTimeAgo(track.created_at)
                        : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="tracks-grid">
            {tracks.map((t: any) => (
              <div
                key={t.id}
                className="track-card"
                onClick={() => handleTrackClick(t, "search", tracks)}
              >
                <img
                  src={
                    t.artwork_url?.replace("-large", "-t500x500") ||
                    "/placeholder.png"
                  }
                  alt={t.title}
                  className="track-cover"
                />
                <div className="track-info">
                  <div className="track-title">{t.title}</div>
                  <div
                    className="track-artist"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArtistClick(t.user);
                    }}
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                  >
                    {t.user?.username || "Unknown"}
                  </div>
                </div>
              </div>
            ))}

            {searchHasMore && (
              <div
                ref={scrollTriggerRef}
                style={{
                  textAlign: "center",
                  padding: "40px",
                  gridColumn: "1 / -1",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "14px",
                }}
              >
                {isLoadingMore ? "⏳ Loading more..." : ""}
              </div>
            )}
          </div>
        )}
      </main>

      <Player
        currentTrack={currentTrack}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTrackEnd={handleNext} // <-- ensures next song plays automatically
      />
    </div>
  );
}
