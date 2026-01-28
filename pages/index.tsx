import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // State
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [viewingLikes, setViewingLikes] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Search pagination state
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check");
        if (response.ok) {
          setAuthenticated(true);
          fetchPlaylists();
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Fetch playlists
  const fetchPlaylists = async () => {
    try {
      console.log("Fetching playlists...");
      const response = await fetch("/api/playlists");
      const data = await response.json();
      setPlaylists(data.playlists || []);
      console.log("Playlists received:", data.playlists?.length || 0);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  };

  // Handle search input
  const handleSearchInput = (value: string) => {
    setQuery(value);
    setSearchOffset(0);
    setTracks([]);
    setSearchHasMore(false);
  };

  // Handle search with pagination
  const handleSearch = useCallback(
    async (offset = 0) => {
      if (!query.trim()) return;

      if (offset === 0) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setSelectedPlaylist(null);
      setViewingLikes(false);

      try {
        console.log("🔍 Fetching search results with offset:", offset);
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=20`,
        );
        const data = await response.json();

        console.log(
          "📦 Got results:",
          data.collection?.length,
          "Has more:",
          data.hasMore,
        );

        if (offset === 0) {
          // New search - replace all results
          setTracks(data.collection || []);
          setSearchOffset(20);
        } else {
          // Load more - append unique results
          const newTracks = data.collection || [];
          const existingIds = new Set(tracks.map((t: any) => t.id));
          const uniqueNewTracks = newTracks.filter(
            (t: any) => !existingIds.has(t.id),
          );

          console.log("➕ Appending", uniqueNewTracks.length, "new tracks");
          setTracks((prev) => [...prev, ...uniqueNewTracks]);
          setSearchOffset(offset + 20);
        }

        setSearchHasMore(data.hasMore || false);
      } catch (error) {
        console.error("❌ Search error:", error);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [query, tracks],
  );

  // Infinite scroll observer
  useEffect(() => {
    // Only observe if we're in search view
    if (!query.trim() || selectedPlaylist || viewingLikes) {
      return;
    }

    console.log(
      "👀 Setting up observer - tracks:",
      tracks.length,
      "hasMore:",
      searchHasMore,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0].isIntersecting;
        console.log(
          "🔔 Observer event - intersecting:",
          isIntersecting,
          "searchHasMore:",
          searchHasMore,
          "loading:",
          loading,
          "isLoadingMore:",
          isLoadingMore,
        );

        if (
          isIntersecting &&
          searchHasMore &&
          !loading &&
          !isLoadingMore &&
          tracks.length > 0
        ) {
          console.log("✅ Triggering load more - offset:", searchOffset);
          handleSearch(searchOffset);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "200px",
      },
    );

    const target = observerTarget.current;
    if (target) {
      console.log("🎯 Observing target element");
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.disconnect();
      }
    };
  }, [
    query,
    searchOffset,
    searchHasMore,
    loading,
    isLoadingMore,
    selectedPlaylist,
    viewingLikes,
    tracks.length,
    handleSearch,
  ]);

  // Handle playlist click
  const handlePlaylistClick = async (playlistId: string) => {
    setSelectedPlaylist(playlistId);
    setViewingLikes(false);
    setQuery("");
    setLoading(true);

    try {
      const response = await fetch(`/api/playlist/${playlistId}`);
      const data = await response.json();
      setTracks(data.tracks || []);
      setQueue(data.tracks || []);
      setQueueIndex(0);
    } catch (error) {
      console.error("Failed to fetch playlist:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle likes click
  const handleLikesClick = async () => {
    setViewingLikes(true);
    setSelectedPlaylist(null);
    setQuery("");
    setLoading(true);

    try {
      const response = await fetch("/api/likes");
      const data = await response.json();
      setTracks(data.likes || []);
      setQueue(data.likes || []);
      setQueueIndex(0);
    } catch (error) {
      console.error("Failed to fetch likes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle track click
  const handleTrackClick = (track: any, source: string, sourceQueue: any[]) => {
    setCurrentTrack(track);
    setQueue(sourceQueue);
    setQueueIndex(sourceQueue.findIndex((t: any) => t.id === track.id));
    setIsPlaying(true);
  };

  // Handle next track
  const handleNext = () => {
    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1;
      setQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
      setIsPlaying(true);
    } else {
      // Loop back to start
      setQueueIndex(0);
      setCurrentTrack(queue[0]);
      setIsPlaying(true);
    }
  };

  // Handle previous track
  const handlePrev = () => {
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      setQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
      setIsPlaying(true);
    } else {
      // Loop to end
      const lastIndex = queue.length - 1;
      setQueueIndex(lastIndex);
      setCurrentTrack(queue[lastIndex]);
      setIsPlaying(true);
    }
  };

  if (!authenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarCollapsed ? "collapsed" : "expanded"}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? "→" : "←"}
        </button>

        <div className="sidebar-nav">
          <div
            className={`nav-item ${viewingLikes ? "active" : ""}`}
            onClick={handleLikesClick}
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
                className={`playlist-item ${
                  selectedPlaylist === p.id ? "active" : ""
                }`}
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

      {/* MAIN AREA */}
      <div
        className="main-area"
        style={{
          marginLeft: sidebarCollapsed ? "80px" : "240px",
        }}
      >
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
          <>
            {loading && tracks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div className="loading">🔍 Searching...</div>
              </div>
            ) : tracks.length > 0 ? (
              <>
                <div className="tracks-grid">
                  {tracks.map((t: any, index: number) => (
                    <div
                      key={`search-${t.id}-${index}`}
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

                {/* INFINITE SCROLL TRIGGER */}
                <div
                  ref={observerTarget}
                  style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    marginTop: "40px",
                    minHeight: "120px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
          </>
        ) : selectedPlaylist || viewingLikes ? (
          <>
            <h2>
              {viewingLikes
                ? "Liked Songs"
                : playlists.find((p: any) => p.id === selectedPlaylist)?.title}
            </h2>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div className="loading">Loading...</div>
              </div>
            ) : (
              <div className="tracks-grid">
                {tracks.map((t: any) => (
                  <div
                    key={`${selectedPlaylist || "likes"}-${t.id}`}
                    className="track-card"
                    onClick={() => handleTrackClick(t, "playlist", tracks)}
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
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="end-message">Search for a song to get started</div>
          </div>
        )}
      </div>

      {/* PLAYER */}
      {currentTrack && (
        <div className="player-bar">
          <div className="player-track-info">
            <img
              src={
                currentTrack.artwork_url?.replace("-large", "-t500x500") ||
                "/placeholder.png"
              }
              alt={currentTrack.title}
              className="player-cover"
            />
            <div className="player-text">
              <div className="player-title">{currentTrack.title}</div>
              <div className="player-artist">{currentTrack.user?.username}</div>
            </div>
          </div>

          <div className="player-controls">
            <button onClick={handlePrev} title="Previous">
              ⏮️
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            <button onClick={handleNext} title="Next">
              ⏭️
            </button>
          </div>

          <audio
            ref={audioRef}
            src={currentTrack.stream_url}
            onEnded={handleNext}
            autoPlay={isPlaying}
          />
        </div>
      )}
    </div>
  );
}
