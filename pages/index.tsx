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
  const [geniusCache, setGeniusCache] = useState<Record<string, any>>({});
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Queue management
  const [queue, setQueue] = useState<any[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [queueSource, setQueueSource] = useState<
    "playlist" | "search" | "related"
  >("playlist");

  // Define all functions BEFORE useEffect
  const fetchPlaylists = async () => {
    try {
      console.log("Calling /api/playlists");
      const response = await fetch("/api/playlists");

      if (!response.ok) {
        console.error("Playlists API failed:", response.status);
        throw new Error(`Failed to fetch playlists: ${response.status}`);
      }

      const data = await response.json();
      console.log("Playlists received:", data.playlists?.length || 0);

      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      setPlaylists([]);
    }
  };

  const fetchRelatedTracks = async (trackId: number) => {
    try {
      const response = await fetch(`/api/related-tracks?trackId=${trackId}`);
      const data = await response.json();
      return data.collection || [];
    } catch (error) {
      console.error("Failed to fetch related tracks:", error);
      return [];
    }
  };

  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setViewingLikes(false);
    setTracks([]);
    try {
      const response = await fetch(`/api/playlist/${playlist.id}`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    }
  };

  const handleLikesClick = async () => {
    setViewingLikes(true);
    setSelectedPlaylist(null);
    setTracks([]);
    try {
      const response = await fetch("/api/likes");
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch liked songs:", error);
    }
  };

  const handleSearch = useCallback(
    async (offsetValue = 0) => {
      if (!query.trim()) return;

      if (offsetValue === 0) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setSelectedPlaylist(null);
      setViewingLikes(false);

      try {
        console.log(
          "🔍 Fetching search with query:",
          query,
          "offset:",
          offsetValue,
        );
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&offset=${offsetValue}&limit=20`,
        );
        const data = await response.json();

        console.log(
          "📦 Got",
          data.collection?.length,
          "results, hasMore:",
          data.hasMore,
        );

        if (offsetValue === 0) {
          // New search - replace all results
          setTracks(data.collection || []);
          setSearchOffset(20);
        } else {
          // Load more - append to existing results (avoid duplicates)
          const newTracks = data.collection || [];
          const existingIds = new Set(tracks.map((t: any) => t.id));
          const uniqueNewTracks = newTracks.filter(
            (t: any) => !existingIds.has(t.id),
          );

          console.log(
            "➕ Appending",
            uniqueNewTracks.length,
            "new unique tracks",
          );
          setTracks((prev) => [...prev, ...uniqueNewTracks]);
          setSearchOffset(offsetValue + 20);
        }

        setSearchHasMore(data.hasMore);
      } catch (error) {
        console.error("❌ Search error:", error);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [query, tracks],
  );

  const handleSearchInput = (value: string) => {
    setQuery(value);
    setSearchOffset(0);
    if (value.trim()) {
      handleSearch(0);
    } else {
      setTracks([]);
      setSearchHasMore(false);
    }
  };

  const handleTrackClick = async (
    track: any,
    source: "playlist" | "search",
    trackList: any[] = [],
  ) => {
    setCurrentTrack(track);
    setQueueSource(source);

    if (source === "playlist") {
      // Set queue to playlist tracks starting from clicked track
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1) {
        setQueue(trackList);
        setCurrentQueueIndex(trackIndex);
      }
    } else if (source === "search") {
      // Fetch related tracks for autoplay
      const related = await fetchRelatedTracks(track.id);
      setQueue([track, ...related]);
      setCurrentQueueIndex(0);
    }
  };

  const handleTrackEnd = async () => {
    if (currentQueueIndex < queue.length - 1) {
      // Play next in queue
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    } else if (queueSource === "search" && currentTrack) {
      // Fetch more related tracks
      const related = await fetchRelatedTracks(currentTrack.id);
      if (related.length > 0) {
        setQueue([...queue, ...related]);
        setCurrentQueueIndex(queue.length);
        setCurrentTrack(related[0]);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQueueIndex > 0) {
      const prevIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
    }
  };

  const handleNext = () => {
    if (currentQueueIndex < queue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    } else if (queueSource === "search" && currentTrack) {
      // Fetch more related tracks
      fetchRelatedTracks(currentTrack.id).then((related) => {
        if (related.length > 0) {
          setQueue([...queue, ...related]);
          setCurrentQueueIndex(queue.length);
          setCurrentTrack(related[0]);
        }
      });
    }
  };

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
      const params = new URLSearchParams({
        title: track.title || "",
        artist: track.user?.username || "",
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(
        `/api/genius-metadata?${params.toString()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null; // Silent fail
      }

      const data = await response.json();

      if (data.found && data.releaseDate) {
        const metadata = {
          releaseYear: new Date(data.releaseDate).getFullYear(),
        };
        setGeniusCache((prev) => ({ ...prev, [cacheKey]: metadata }));
        return metadata;
      }
    } catch (error: any) {
      // Silent fail - Genius metadata is optional
      return null;
    }

    return null;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (!res.ok) {
          console.log("Not authenticated, redirecting to login");
          router.push("/login");
          setIsAuthenticated(false);
          return;
        }

        console.log("Authentication successful");
        setIsAuthenticated(true);

        // Fetch playlists
        try {
          console.log("Fetching playlists...");
          await fetchPlaylists();
        } catch (err) {
          console.error("Failed to fetch playlists:", err);
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

  useEffect(() => {
    if (playlistTracks.length > 0) {
      // Only fetch for first 10 tracks to avoid spamming API
      playlistTracks.slice(0, 10).forEach((track) => {
        if (track.id && !geniusCache[track.id]) {
          fetchGeniusMetadata(track).catch(() => {
            // Silently fail - not critical
          });
        }
      });
    }
  }, [playlistTracks, geniusCache]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;

          // Calculate progress from 0 to 1 based on scroll (0-150px range)
          const scrollProgress = Math.min(Math.max(scrollY / 150, 0), 1);
          setHeaderScrolled(scrollProgress > 0);

          // Set CSS variable for smooth interpolation
          document.documentElement.style.setProperty(
            "--scroll-progress",
            scrollProgress.toString(),
          );

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Refresh token every 50 minutes (token expires at 60 minutes)
    const refreshInterval = setInterval(
      async () => {
        try {
          console.log("Auto-refreshing token...");
          const response = await fetch("/api/auth/refresh");
          if (response.ok) {
            console.log("Token refreshed successfully");
          } else {
            console.error("Token refresh failed");
          }
        } catch (error) {
          console.error("Token refresh error:", error);
        }
      },
      50 * 60 * 1000,
    ); // 50 minutes

    return () => clearInterval(refreshInterval);
  }, []);

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
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
        >
          {sidebarExpanded ? "→" : "←"}
        </button>

        <div className="sidebar-nav">
          <div
            className={`nav-item ${viewingLikes ? "active" : ""}`}
            onClick={() => {
              setViewingLikes(true);
              setSelectedPlaylist(null);
              setQuery("");
            }}
          >
            <span className="nav-icon">❤️</span>
            <span className="nav-label">Likes</span>
          </div>
        </div>

        <div className="sidebar-playlists">
          <div className="section-title">Playlists</div>
          <div className="playlist-thumbs">
            {playlists.map((p: any) => (
              <div
                key={p.id}
                className={`playlist-item ${selectedPlaylist === p.id ? "active" : ""}`}
                onClick={() => handlePlaylistClick(p.id)}
              >
                <img
                  src={p.artwork_url || "/placeholder.png"}
                  alt={p.title}
                  className="playlist-thumb"
                />
                <span className="playlist-title-sidebar">{p.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="main-area">
        <div className="top-bar">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search for songs..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(0)}
            />
            <button onClick={() => handleSearch(0)}>Search</button>
          </div>
        </div>

        {/* SEARCH RESULTS VIEW */}
        {!selectedPlaylist && !viewingLikes && query.trim() ? (
          <div className="search-results-container">
            {loading && tracks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div className="loading">🔍 Searching...</div>
              </div>
            ) : tracks.length > 0 ? (
              <>
                <div className="tracks-grid">
                  {tracks.map((t: any) => (
                    <div
                      key={`search-${t.id}-${tracks.indexOf(t)}`}
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
                        <div className="track-artist">{t.user?.username}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* OBSERVER TARGET - MUST BE HERE */}
                <div
                  ref={observerTarget}
                  style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    marginTop: "40px",
                  }}
                >
                  {isLoadingMore && (
                    <div style={{ fontSize: "16px", opacity: 0.7 }}>
                      ⏳ Loading more results...
                    </div>
                  )}
                  {!isLoadingMore && searchHasMore && (
                    <div style={{ fontSize: "14px", opacity: 0.5 }}>
                      ↓ Scroll to load more
                    </div>
                  )}
                  {!searchHasMore && tracks.length > 0 && (
                    <div style={{ fontSize: "14px", opacity: 0.5 }}>
                      ✓ No more results
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div className="end-message">
                  No results found for "{query}"
                </div>
              </div>
            )}
          </div>
        ) : selectedPlaylist ? (
          // PLAYLIST VIEW
          <div className="playlist-view">
            <div
              className={`playlist-header-sticky ${headerScrolled ? "scrolled" : ""}`}
            >
              <img
                src={displayCover}
                alt={displayTitle}
                className="playlist-header-cover"
              />
              <h2 className="playlist-header-title">{displayTitle}</h2>
            </div>
            <div className="track-list">
              {playlistTracks.map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="track-row"
                  onClick={() =>
                    handleTrackClick(track, "playlist", playlistTracks)
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
        ) : viewingLikes ? (
          // LIKES VIEW
          <div className="likes-view">
            <div className="playlist-header-sticky">
              <img
                src={getLikedSongsCover()}
                alt="Liked Songs"
                className="playlist-header-cover"
              />
              <h2 className="playlist-header-title">Liked Songs</h2>
            </div>
            <div className="track-list">
              {playlistTracks.map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="track-row"
                  onClick={() =>
                    handleTrackClick(track, "playlist", playlistTracks)
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
          // DEFAULT VIEW
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="end-message">Search for a song to get started</div>
          </div>
        )}
      </div>

      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={handleNext}
        onPrev={handlePrev}
        queue={queue}
      />
    </div>
  );
}
